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
pub(crate) mod fake {
    use super::*;
    use std::sync::Mutex;

    /// An in-memory editor used by the tool tests. It applies the same
    /// `Session` commands the app does, without a Tauri handle.
    pub(crate) struct FakeBackend {
        session: Mutex<Session>,
        assets: Mutex<Vec<String>>,
        open: Mutex<Option<String>>,
        saved: Mutex<Option<String>>,
    }
    impl Default for FakeBackend {
        fn default() -> Self {
            Self {
                session: Mutex::new(Session::default()),
                assets: Mutex::new(vec![]),
                open: Mutex::new(None),
                saved: Mutex::new(None),
            }
        }
    }
    impl FakeBackend {
        pub(crate) fn with_project(project: Project) -> Self {
            let backend = Self::default();
            backend.session.lock().expect("session").project = project;
            backend
        }
        pub(crate) fn project(&self) -> Project {
            self.session.lock().expect("session").project.clone()
        }
        pub(crate) fn opened(&self) -> Option<String> {
            self.open.lock().expect("open").clone()
        }
        pub(crate) fn saved(&self) -> Option<String> {
            self.saved.lock().expect("saved").clone()
        }
    }
    impl Backend for FakeBackend {
        fn view(&self) -> Result<View, String> {
            Ok(self.session.lock().map_err(|e| e.to_string())?.view())
        }
        fn apply(&self, command: Command) -> Result<View, String> {
            let mut session = self.session.lock().map_err(|e| e.to_string())?;
            session.apply(command)?;
            Ok(session.view())
        }
        fn import_media(&self, path: &str) -> Result<ImportedAsset, String> {
            let name = Path::new(path)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("Media")
                .to_string();
            let extension = Path::new(path)
                .extension()
                .and_then(|value| value.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            let mime = match extension.as_str() {
                "png" => "image/png",
                "jpg" | "jpeg" => "image/jpeg",
                "webp" => "image/webp",
                "mp4" | "m4v" | "mov" | "webm" => "video/mp4",
                _ => return Err(format!("“{name}” is not a supported image or video.")),
            };
            let reference = format!("pixcut-asset:{}", "a".repeat(64));
            self.assets.lock().map_err(|e| e.to_string())?.push(reference.clone());
            Ok(ImportedAsset { reference, name, bytes: 1, mime: mime.into() })
        }
        fn import_audio(&self, path: &str) -> Result<(ImportedMedia, f64), String> {
            if !path.ends_with(".mp3") {
                return Err("Choose an MP3, WAV, M4A, AAC, OGG, or WebM audio file.".into());
            }
            let reference = format!("pixcut-asset:{}", "b".repeat(64));
            Ok((ImportedMedia { reference, name: "Song.mp3".into(), bytes: 1 }, 20.0))
        }
        fn save_project(&self, path: &str) -> Result<String, String> {
            *self.saved.lock().map_err(|e| e.to_string())? = Some(path.into());
            Ok(path.into())
        }
        fn open_project(&self, path: &str) -> Result<(), String> {
            *self.open.lock().map_err(|e| e.to_string())? = Some(path.into());
            Ok(())
        }
        fn status(&self) -> AppStatus {
            AppStatus { exporting: false, ffmpeg: true, version: "test".into() }
        }
        fn asset_path(&self, reference: &str) -> Option<String> {
            self.assets
                .lock()
                .ok()?
                .iter()
                .find(|stored| *stored == reference)
                .map(|_| format!("/tmp/{}", &reference["pixcut-asset:".len()..]))
        }
        fn asset_kind(&self, reference: &str) -> Option<&'static str> {
            let id = reference.strip_prefix("pixcut-asset:")?;
            (id.len() == 64 && id.chars().all(|value| value.is_ascii_hexdigit())).then_some("image")
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reference() -> String {
        format!("pixcut-asset:{}", "a".repeat(64))
    }

    #[test]
    fn summaries_measure_seconds_from_ticks() {
        let mut project = Project::default();
        project.tracks[0].clips = vec![Scene::photo("one", "Photo", reference(), 120, "cover")];
        let view = Session { project, ..Default::default() }.view();
        let summary = project_summary(&view);
        assert_eq!(summary.scene_count, 1);
        assert!((summary.duration_seconds - 4.0).abs() < 0.01);
        assert_eq!(summary.scenes[0].media, reference());
        assert_eq!(summary.scenes[0].duration_seconds, 4.0);
    }

    #[test]
    fn inline_media_is_never_returned_verbatim() {
        let mut project = Project::default();
        let mut scene = Scene::photo("one", "Photo", reference(), 120, "cover");
        scene.video_poster = Some("data:image/png;base64,AAAA".into());
        project.tracks[0].clips = vec![scene];
        let json = redacted_json(&project).expect("serializes");
        let text = serde_json::to_string(&json).expect("encodes");
        assert!(!text.contains("data:image/png"));
        assert!(text.contains("<inline media"));
    }

    #[test]
    fn text_updates_create_the_first_layer_and_mirror_the_label() {
        let mut scene = Scene::photo("one", "Photo", reference(), 120, "cover");
        set_scene_text(&mut scene, Some("Hello".into()), Some("World".into()));
        assert_eq!(scene.title, "Hello");
        assert_eq!(scene.subtitle, "World");
        assert_eq!(scene.text_layers.len(), 1);
        assert_eq!(scene.text_layers[0].title, "Hello");
        assert_eq!(scene.text_layers[0].duration_ticks, 120);
        set_scene_text(&mut scene, Some("Again".into()), None);
        assert_eq!(scene.text_layers.len(), 1);
        assert_eq!(scene.text_layers[0].title, "Again");
        assert_eq!(scene.text_layers[0].subtitle, "World");
    }

    #[test]
    fn scene_ids_do_not_collide_with_existing_clips() {
        let mut project = Project::default();
        project.tracks[0].clips = vec![Scene::photo("taken", "Photo", reference(), 120, "cover")];
        let id = new_scene_id(&project);
        assert!(id.starts_with("scene-"));
        assert_ne!(id, "taken");
    }

    #[test]
    fn ffmpeg_durations_are_parsed() {
        let text = "  Duration: 00:03:12.50, start: 0.0, bitrate: 128 kb/s";
        assert!((parse_duration(text).unwrap() - 192.5).abs() < 1e-9);
        assert!(parse_duration("Duration: N/A, bitrate").is_none());
        assert!(parse_duration("nothing").is_none());
    }

    #[test]
    fn seconds_convert_and_are_clamped() {
        let timebase = Timebase::default();
        assert_eq!(seconds_to_ticks(4.0, &timebase), 120);
        assert_eq!(clamp_seconds(f64::NAN), 4.0);
        assert_eq!(clamp_seconds(0.0), 0.5);
        assert_eq!(clamp_seconds(100.0), 30.0);
    }
}
