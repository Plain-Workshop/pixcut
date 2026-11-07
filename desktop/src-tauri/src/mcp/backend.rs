use super::config;
use crate::*;

/// The editor operations the MCP tools need. The real implementation talks to
/// the running app; the test implementation is an in-memory session, so the
/// tool layer can be tested without a webview.
pub(crate) trait Backend: Send + Sync {
    fn view(&self) -> Result<View, String>;
    fn apply(&self, command: Command) -> Result<View, String>;
    fn import_media(&self, path: &str) -> Result<ImportedAsset, String>;
    fn import_audio(&self, path: &str) -> Result<(ImportedMedia, f64), String>;
    fn save_project(&self, path: &str) -> Result<String, String>;
    fn open_project(&self, path: &str) -> Result<(), String>;
    fn render_frame(&self, scene_id: Option<String>, at_seconds: Option<f64>, max_width: Option<u32>) -> Result<String, String>;
    fn probe_video(&self, reference: &str) -> Result<VideoInfo, String>;
    fn start_export(&self, directory: &str) -> Result<(), String>;
    fn export_status(&self) -> serde_json::Value;
    fn status(&self) -> AppStatus;
    fn asset_path(&self, reference: &str) -> Option<String>;
    fn asset_kind(&self, reference: &str) -> Option<&'static str>;
}

#[derive(Clone)]
pub(crate) struct AppBackend {
    app: tauri::AppHandle,
}
impl AppBackend {
    pub(crate) fn new(app: tauri::AppHandle) -> Self {
        Self { app }
    }
    fn editor(&self) -> State<'_, Editor> {
        self.app.state::<Editor>()
    }
    fn refuse_while_exporting(&self) -> Result<(), String> {
        if self.editor().exporting.load(Ordering::SeqCst) {
            return Err("PixCut is exporting a video. Try again when the export finishes.".into());
        }
        Ok(())
    }
}
impl Backend for AppBackend {
    fn view(&self) -> Result<View, String> {
        Ok(self.editor().session.lock().map_err(|e| e.to_string())?.view())
    }

    fn apply(&self, command: Command) -> Result<View, String> {
        self.refuse_while_exporting()?;
        let editor = self.editor();
        let view = guard("editing the project from an agent", || {
            apply_command(&self.app, &editor, command)
        })?;
        // The editor keeps its own copy of the project. Tell it to refresh so an
        // agent's change shows up immediately instead of on the next local edit.
        let _ = self.app.emit("project-changed", ());
        Ok(view)
    }

    fn import_media(&self, path: &str) -> Result<ImportedAsset, String> {
        self.refuse_while_exporting()?;
        import_media_from_path(&self.app, path)
    }

    fn import_audio(&self, path: &str) -> Result<(ImportedMedia, f64), String> {
        self.refuse_while_exporting()?;
        let imported = import_audio_from_path(&self.app, Path::new(path))?;
        let seconds = audio_seconds(Path::new(path))?;
        Ok((imported, seconds))
    }

    fn save_project(&self, path: &str) -> Result<String, String> {
        self.refuse_while_exporting()?;
        let editor = self.editor();
        let written = save_project_to(&self.app, &editor, Path::new(path))?;
        Ok(written.to_string_lossy().to_string())
    }

    fn open_project(&self, path: &str) -> Result<(), String> {
        self.refuse_while_exporting()?;
        let path = PathBuf::from(path);
        check_project_drop(&path)?;
        // Read the manifest first so an agent learns about a corrupt package
        // instead of the window showing the error after the tool reported success.
        read_project_with_migration(&path)
            .map_err(|error| format!("PixCut could not open “{}”: {error}", path.display()))?;
        queue_open_project(&self.app, path);
        Ok(())
    }

    fn render_frame(
        &self,
        scene_id: Option<String>,
        at_seconds: Option<f64>,
        max_width: Option<u32>,
    ) -> Result<String, String> {
        self.refuse_while_exporting()?;
        super::request_frame(&self.app, scene_id, at_seconds, max_width)
    }

    fn probe_video(&self, reference: &str) -> Result<VideoInfo, String> {
        self.refuse_while_exporting()?;
        let reply = super::request_video_probe(&self.app, reference)?;
        serde_json::from_str(&reply).map_err(|e| format!("The editor returned an unreadable video probe: {e}"))
    }

    fn start_export(&self, directory: &str) -> Result<(), String> {
        self.refuse_while_exporting()?;
        let directory = PathBuf::from(directory);
        if !directory.is_absolute() || !directory.is_dir() {
            return Err("Give the absolute path of a folder that already exists.".into());
        }
        if self.editor().session.lock().map_err(|e| e.to_string())?.project.visual_clips().is_empty() {
            return Err("Add a clip before exporting.".into());
        }
        if ffmpeg().is_none() {
            return Err("Install FFmpeg to export videos.".into());
        }
        super::begin_agent_export(&self.app, directory)?;
        if let Err(error) = self.app.emit("mcp-export", ()) {
            super::record_export(&self.app, &Err(error.to_string()));
            return Err(error.to_string());
        }
        Ok(())
    }

    fn export_status(&self) -> serde_json::Value {
        super::export_status(&self.app)
    }

    fn status(&self) -> AppStatus {
        AppStatus {
            exporting: self.editor().exporting.load(Ordering::SeqCst),
            ffmpeg: ffmpeg().is_some(),
            version: env!("CARGO_PKG_VERSION").into(),
        }
    }

    fn asset_path(&self, reference: &str) -> Option<String> {
        let id = reference.strip_prefix("pixcut-asset:")?;
        asset_file(&asset_store_dir(&self.app).ok()?, id)
            .map(|path| path.to_string_lossy().to_string())
    }

    fn asset_kind(&self, reference: &str) -> Option<&'static str> {
        stored_asset_kind(&self.app, reference)
    }
}

/// Reads an audio file's length from `ffmpeg -i`, which prints
/// `Duration: HH:MM:SS.xx` on stderr. This avoids needing ffprobe.
fn audio_seconds(path: &Path) -> Result<f64, String> {
    let binary = ffmpeg().ok_or("Adding audio needs FFmpeg to read its length, and PixCut could not find it.")?;
    let output = std::process::Command::new(binary)
        .arg("-hide_banner")
        .arg("-i")
        .arg(path)
        .output()
        .map_err(|e| e.to_string())?;
    parse_duration(&String::from_utf8_lossy(&output.stderr))
        .ok_or_else(|| "PixCut could not read the length of that audio file.".to_string())
}

pub(crate) fn parse_duration(text: &str) -> Option<f64> {
    let rest = text.split("Duration:").nth(1)?.trim_start();
    let stamp = rest.split(',').next()?.trim();
    let mut parts = stamp.split(':');
    let hours: f64 = parts.next()?.parse().ok()?;
    let minutes: f64 = parts.next()?.parse().ok()?;
    let seconds: f64 = parts.next()?.parse().ok()?;
    let total = hours * 3600.0 + minutes * 60.0 + seconds;
    (total.is_finite() && total > 0.0).then_some(total)
}

/// What the window learned by decoding a video: its length and a poster frame.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VideoInfo {
    pub(crate) duration: f64,
    pub(crate) poster: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppStatus {
    pub(crate) exporting: bool,
    pub(crate) ffmpeg: bool,
    pub(crate) version: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SceneSummary {
    pub(crate) id: String,
    pub(crate) index: usize,
    pub(crate) name: String,
    pub(crate) start_seconds: f64,
    pub(crate) duration_seconds: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) media_kind: Option<String>,
    pub(crate) media: String,
    pub(crate) title: String,
    pub(crate) subtitle: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) transition: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectSummary {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) aspect: String,
    pub(crate) fps: f64,
    pub(crate) duration_seconds: f64,
    pub(crate) scene_count: usize,
    pub(crate) audio_count: usize,
    pub(crate) global_text_count: usize,
    pub(crate) can_undo: bool,
    pub(crate) can_redo: bool,
    pub(crate) scenes: Vec<SceneSummary>,
    pub(crate) audio: Vec<AudioSummary>,
    pub(crate) global_text: Vec<GlobalTextSummary>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AudioSummary {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) lane: u32,
    pub(crate) start_seconds: f64,
    pub(crate) duration_seconds: f64,
    pub(crate) volume: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GlobalTextSummary {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) subtitle: String,
    pub(crate) start_seconds: f64,
    pub(crate) duration_seconds: f64,
}

/// Never hand an agent megabytes of base64. Stored media is already a
/// `pixcut-asset:` reference; anything inline is reported as its size only.
pub(crate) fn media_label(value: &str) -> String {
    if value.starts_with("data:") {
        format!("<inline media, {} bytes>", value.len())
    } else {
        value.to_string()
    }
}

pub(crate) fn scene_summary(scene: &Scene, index: usize, timebase: &Timebase) -> SceneSummary {
    SceneSummary {
        id: scene.id.clone(),
        index,
        name: scene.name.clone(),
        start_seconds: timebase.ticks_to_seconds(scene.start_ticks),
        duration_seconds: timebase.ticks_to_seconds(scene.duration_ticks),
        media_kind: scene.media_kind.clone(),
        media: media_label(&scene.image),
        title: scene.title.clone(),
        subtitle: scene.subtitle.clone(),
        transition: scene.transition.as_ref().map(|transition| transition.kind.clone()),
    }
}

pub(crate) fn project_summary(view: &View) -> ProjectSummary {
    let project = &view.project;
    let scenes = project
        .visual_clips()
        .iter()
        .enumerate()
        .map(|(index, scene)| scene_summary(scene, index, &project.timebase))
        .collect();
    ProjectSummary {
        id: project.id.clone(),
        name: project.name.clone(),
        aspect: project.aspect.clone(),
        fps: project.timebase.fps(),
        duration_seconds: project.timebase.ticks_to_seconds(project.total_ticks()),
        scene_count: project.visual_clips().len(),
        audio_count: project.audio.len(),
        global_text_count: project.global_text.len(),
        can_undo: view.can_undo,
        can_redo: view.can_redo,
        scenes,
        audio: project
            .audio
            .iter()
            .map(|clip| AudioSummary {
                id: clip.id.clone(),
                name: clip.name.clone(),
                lane: clip.lane,
                start_seconds: project.timebase.ticks_to_seconds(clip.start_ticks),
                duration_seconds: project.timebase.ticks_to_seconds(clip.duration_ticks),
                volume: clip.volume,
            })
            .collect(),
        global_text: project
            .global_text
            .iter()
            .map(|layer| GlobalTextSummary {
                id: layer.id.clone(),
                title: layer.title.clone(),
                subtitle: layer.subtitle.clone(),
                start_seconds: project.timebase.ticks_to_seconds(layer.start_ticks),
                duration_seconds: project.timebase.ticks_to_seconds(layer.duration_ticks),
            })
            .collect(),
    }
}

/// Replaces every inline data URL in a serialized project with a size marker.
/// Stored media is untouched, so a `get_project` answer stays small even for a
/// story made of large photos.
pub(crate) fn redact_inline(value: &mut serde_json::Value) {
    match value {
        serde_json::Value::String(text) if text.starts_with("data:") => {
            *text = media_label(text);
        }
        serde_json::Value::Array(items) => items.iter_mut().for_each(redact_inline),
        serde_json::Value::Object(fields) => fields.values_mut().for_each(redact_inline),
        _ => {}
    }
}

pub(crate) fn redacted_json<T: Serialize>(value: &T) -> Result<serde_json::Value, String> {
    let mut json = serde_json::to_value(value).map_err(|e| e.to_string())?;
    redact_inline(&mut json);
    Ok(json)
}

pub(crate) fn seconds_to_ticks(seconds: f64, timebase: &Timebase) -> u64 {
    let ticks = (seconds / timebase.seconds_per_tick()).round();
    if !ticks.is_finite() || ticks <= 0.0 {
        0
    } else {
        ticks as u64
    }
}

pub(crate) fn clamp_seconds(seconds: f64) -> f64 {
    if !seconds.is_finite() {
        4.0
    } else {
        seconds.clamp(0.5, 30.0)
    }
}

/// A short collision-resistant id for scenes the agent adds.
pub(crate) fn new_scene_id(project: &Project) -> String {
    for _ in 0..32 {
        let random = config::new_token();
        let id = format!("scene-{}", &random[..12]);
        if project.visual_clips().iter().all(|scene| scene.id != id) {
            return id;
        }
    }
    format!("scene-{}", std::process::id())
}

pub(crate) fn new_text_id(scene: &Scene) -> String {
    for _ in 0..32 {
        let random = config::new_token();
        let id = format!("text-{}", &random[..12]);
        if scene.text_layers.iter().all(|layer| layer.id != id) {
            return id;
        }
    }
    format!("text-{}", std::process::id())
}

/// Applies the editable text fields to a scene. The first text layer is the
/// one the editor shows, and `title`/`subtitle` mirror it, so both stay in step.
pub(crate) fn set_scene_text(scene: &mut Scene, title: Option<String>, subtitle: Option<String>) {
    let title = title.unwrap_or_else(|| scene.title.clone());
    let subtitle = subtitle.unwrap_or_else(|| scene.subtitle.clone());
    if let Some(layer) = scene.text_layers.first_mut() {
        layer.title = title.clone();
        layer.subtitle = subtitle.clone();
    } else if !title.is_empty() || !subtitle.is_empty() {
        scene.text_layers.push(TextLayer {
            id: new_text_id(scene),
            title: title.clone(),
            subtitle: subtitle.clone(),
            duration_ticks: scene.duration_ticks,
            ..Default::default()
        });
    }
    scene.title = title;
    scene.subtitle = subtitle;
}

#[cfg(test)]
#[path = "backend_fake_tests.rs"]
pub(crate) mod fake;

#[cfg(test)]
#[path = "backend_tests.rs"]
mod tests;
