use super::backend::{clamp_seconds, new_scene_id, project_summary, redacted_json, seconds_to_ticks, set_scene_text, Backend};
use crate::*;use rmcp::{
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::{CallToolResult, ContentBlock, Implementation, ServerCapabilities, ServerConfig},
    schemars::{self, JsonSchema},
    tool, tool_handler, tool_router, ServerHandler,
};
use std::sync::Arc;

const INSTRUCTIONS: &str = "PixCut is an offline photo-movie editor. Use get_project to read the open story, import_media and add_scene to build it, update_scene to style a clip, and save_project to write a .pixcut package. Every edit is one undo step. Media is always referenced as `pixcut-asset:<hash>`, never as base64. Video import and export stay in the PixCut window.";

/// The MCP server's tool surface. It keeps a `Backend` so the same tool code
/// runs against the live app and against an in-memory editor in tests.
#[derive(Clone)]
pub(crate) struct PixCutServer {
    backend: Arc<dyn Backend>,
    tool_router: ToolRouter<Self>,
}

impl PixCutServer {
    pub(crate) fn new(backend: Arc<dyn Backend>) -> Self {
        Self { backend, tool_router: Self::tool_router() }
    }

    async fn blocking<T, F>(&self, work: F) -> Result<T, String>
    where
        T: Send + 'static,
        F: FnOnce(&dyn Backend) -> Result<T, String> + Send + 'static,
    {
        let backend = Arc::clone(&self.backend);
        tokio::task::spawn_blocking(move || work(backend.as_ref()))
            .await
            .map_err(|error| format!("PixCut did not finish the request: {error}"))?
    }
}

fn ok_json(value: serde_json::Value) -> CallToolResult {
    match serde_json::to_string_pretty(&value) {
        Ok(text) => CallToolResult::success(vec![ContentBlock::text(text)]),
        Err(error) => fail(format!("PixCut could not describe the result: {error}")),
    }
}

fn fail(message: impl Into<String>) -> CallToolResult {
    CallToolResult::error(vec![ContentBlock::text(message.into())])
}

const MAX_GLOBAL_TEXT_LAYERS: usize = 20;

fn valid_fit(value: &str) -> bool {
    matches!(value, "cover" | "contain" | "blur")
}

fn valid_motion(value: &str) -> bool {
    matches!(
        value,
        "none" | "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "pan-up" | "pan-down" | "ken-burns"
    )
}

fn valid_color(value: &str) -> bool {
    value.len() == 7 && value.starts_with('#') && value[1..].chars().all(|c| c.is_ascii_hexdigit())
}

fn clamped(value: Option<f64>, range: std::ops::RangeInclusive<f64>, label: &str) -> Result<Option<f64>, String> {
    match value {
        None => Ok(None),
        Some(number) if !number.is_finite() => Err(format!("{label} must be a number.")),
        Some(number) => Ok(Some(number.clamp(*range.start(), *range.end()))),
    }
}

fn truncate_name(value: &str) -> String {
    value.trim().chars().take(120).collect()
}

fn scene_json(project: &Project, scene: &Scene) -> Result<serde_json::Value, String> {
    let mut json = redacted_json(scene)?;
    if let serde_json::Value::Object(fields) = &mut json {
        fields.insert(
            "startSeconds".into(),
            serde_json::json!(project.timebase.ticks_to_seconds(scene.start_ticks)),
        );
        fields.insert(
            "durationSeconds".into(),
            serde_json::json!(project.timebase.ticks_to_seconds(scene.duration_ticks)),
        );
    }
    Ok(json)
}

fn find_scene<'a>(project: &'a Project, id: &str) -> Result<&'a Scene, String> {
    project
        .visual_clips()
        .iter()
        .find(|scene| scene.id == id)
        .ok_or_else(|| format!("No scene has the id “{id}”. Call get_project to list the scene ids."))
}

fn scene_index(project: &Project, id: &str) -> Result<usize, String> {
    project
        .visual_clips()
        .iter()
        .position(|scene| scene.id == id)
        .ok_or_else(|| format!("No scene has the id “{id}”. Call get_project to list the scene ids."))
}

// ---------------------------------------------------------------------------
// Tool arguments
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct EmptyArgs {}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct GetSceneArgs {
    /// The scene id from get_project.
    id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct ImportMediaArgs {
    /// Absolute path to a picture on this device (PNG, JPEG or WebP).
    path: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct AddSceneArgs {
    /// Absolute path to a picture on this device. Use this or `reference`.
    #[serde(default)]
    path: Option<String>,
    /// A `pixcut-asset:` reference returned by import_media.
    #[serde(default)]
    reference: Option<String>,
    /// Clip name shown in the timeline. Defaults to the file name.
    #[serde(default)]
    name: Option<String>,
    /// Length in seconds (0.5–30). Defaults to 4.
    #[serde(default)]
    seconds: Option<f64>,
    /// Headline text drawn on the clip.
    #[serde(default)]
    title: Option<String>,
    /// Supporting text drawn under the headline.
    #[serde(default)]
    subtitle: Option<String>,
    /// cover, contain or blur. Defaults to cover.
    #[serde(default)]
    fit: Option<String>,
    /// none, zoom-in, zoom-out, pan-left, pan-right, pan-up, pan-down or ken-burns.
    #[serde(default)]
    motion: Option<String>,
    /// Motion strength, 0–0.6.
    #[serde(default)]
    motion_amount: Option<f64>,
    /// Background colour as `#RRGGBB`.
    #[serde(default)]
    color: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct UpdateSceneArgs {
    /// The scene id from get_project.
    id: String,
    #[serde(default)]
    name: Option<String>,
    /// Headline text on the first text layer.
    #[serde(default)]
    title: Option<String>,
    /// Supporting text on the first text layer.
    #[serde(default)]
    subtitle: Option<String>,
    /// Length in seconds (0.5–30).
    #[serde(default)]
    seconds: Option<f64>,
    /// cover, contain or blur.
    #[serde(default)]
    fit: Option<String>,
    #[serde(default)]
    motion: Option<String>,
    /// Motion strength, 0–0.6.
    #[serde(default)]
    motion_amount: Option<f64>,
    /// Background colour as `#RRGGBB`.
    #[serde(default)]
    color: Option<String>,
    /// Fade-in seconds; clamped to the clip length.
    #[serde(default)]
    fade_in: Option<f64>,
    /// Fade-out seconds; clamped to the clip length.
    #[serde(default)]
    fade_out: Option<f64>,
    /// Picture position, −1…1.
    #[serde(default)]
    image_x: Option<f64>,
    #[serde(default)]
    image_y: Option<f64>,
    /// Picture zoom, 1…4.
    #[serde(default)]
    image_zoom: Option<f64>,
    #[serde(default)]
    brightness: Option<f64>,
    #[serde(default)]
    contrast: Option<f64>,
    #[serde(default)]
    saturation: Option<f64>,
    #[serde(default)]
    exposure: Option<f64>,
    #[serde(default)]
    highlights: Option<f64>,
    #[serde(default)]
    shadows: Option<f64>,
    #[serde(default)]
    temperature: Option<f64>,
    #[serde(default)]
    tint: Option<f64>,
    #[serde(default)]
    hue: Option<f64>,
    #[serde(default)]
    vibrance: Option<f64>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct SceneIdArgs {
    id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct MoveSceneArgs {
    id: String,
    /// How many places to move. Positive moves later, negative earlier. Defaults to 1.
    #[serde(default)]
    offset: Option<i32>,
    /// Move to this zero-based index instead of by an offset.
    #[serde(default)]
    to_index: Option<usize>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct SplitSceneArgs {
    id: String,
    /// Seconds from the start of the clip to cut at.
    at_seconds: f64,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct UpdateProjectArgs {
    #[serde(default)]
    name: Option<String>,
    /// 16:9, 9:16, 1:1 or 4:5.
    #[serde(default)]
    aspect: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct AddAudioArgs {
    /// Absolute path to an MP3, WAV, M4A, AAC, OGG or WebM file. Use this or `reference`.
    #[serde(default)]
    path: Option<String>,
    /// A `pixcut-asset:` audio reference already in the project's store. Needs `sourceSeconds`.
    #[serde(default)]
    reference: Option<String>,
    /// Length of the whole source file; only needed with `reference`.
    #[serde(default)]
    source_seconds: Option<f64>,
    #[serde(default)]
    name: Option<String>,
    /// Where the track starts on the timeline. Defaults to 0.
    #[serde(default)]
    start_seconds: Option<f64>,
    /// How long it plays. Defaults to the rest of the story, up to the file length.
    #[serde(default)]
    seconds: Option<f64>,
    /// Where in the file to start playing. Defaults to 0.
    #[serde(default)]
    source_in_seconds: Option<f64>,
    /// 0-1. Defaults to 0.8.
    #[serde(default)]
    volume: Option<f64>,
    #[serde(default)]
    fade_in: Option<f64>,
    #[serde(default)]
    fade_out: Option<f64>,
    /// Audio track 0-7. Defaults to 0.
    #[serde(default)]
    lane: Option<u32>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct UpdateAudioArgs {
    id: String,
    #[serde(default)]
    start_seconds: Option<f64>,
    #[serde(default)]
    seconds: Option<f64>,
    #[serde(default)]
    volume: Option<f64>,
    #[serde(default)]
    fade_in: Option<f64>,
    #[serde(default)]
    fade_out: Option<f64>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct SetGlobalTextArgs {
    /// Omit to add a new text layer; give an id from get_project to change one.
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    subtitle: Option<String>,
    /// Defaults to 0.
    #[serde(default)]
    start_seconds: Option<f64>,
    /// Defaults to the rest of the story.
    #[serde(default)]
    seconds: Option<f64>,
    /// Text colour as `#RRGGBB`.
    #[serde(default)]
    color: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct PreviewFrameArgs {
    /// Clip to show. With it, `atSeconds` counts from the clip start; without it, from the story start.
    #[serde(default)]
    id: Option<String>,
    /// Moment to show, in seconds. Defaults to the start.
    #[serde(default)]
    at_seconds: Option<f64>,
    /// Image width in pixels, 160-1920. Defaults to 960.
    #[serde(default)]
    max_width: Option<u32>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct ExportVideoArgs {
    /// Absolute path of an existing folder to write the video into.
    directory: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct SetTransitionArgs {
    /// The scene the transition leads into from the previous clip.
    id: String,
    /// none, fade, slide, wipe, zoom, blur, circle, slide-up or spin.
    kind: String,
    /// Length in seconds (0.1-2, at most half the clip). Defaults to 0.6.
    #[serde(default)]
    seconds: Option<f64>,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
struct ProjectPathArgs {
    /// Absolute path to a `.pixcut` file.
    path: String,
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

#[tool_router(router = tool_router)]
impl PixCutServer {
    #[tool(
        name = "get_project",
        description = "Read the open project: name, aspect, duration, undo state and every clip's id, length and text. Start here before editing."
    )]
    async fn get_project(&self, Parameters(_): Parameters<EmptyArgs>) -> CallToolResult {
        match self
            .blocking(|backend| {
                let view = backend.view()?;
                redacted_json(&project_summary(&view))
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(
        name = "get_scene",
        description = "Read one clip with every style field: framing, grade, fades, motion and text layers. Media is a pixcut-asset reference."
    )]
    async fn get_scene(&self, Parameters(args): Parameters<GetSceneArgs>) -> CallToolResult {
        match self
            .blocking(move |backend| {
                let view = backend.view()?;
                let scene = find_scene(&view.project, &args.id)?;
                scene_json(&view.project, scene)
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(name = "get_history", description = "Whether undo and redo are available.")]
    async fn get_history(&self, Parameters(_): Parameters<EmptyArgs>) -> CallToolResult {
        match self
            .blocking(|backend| {
                let view = backend.view()?;
                Ok(serde_json::json!({
                    "canUndo": view.can_undo,
                    "canRedo": view.can_redo,
                }))
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(
        name = "list_media",
        description = "List the media files the project references, with the absolute path in PixCut's local store."
    )]
    async fn list_media(&self, Parameters(_): Parameters<EmptyArgs>) -> CallToolResult {
        match self
            .blocking(|backend| {
                let view = backend.view()?;
                let mut ids = std::collections::HashSet::new();
                project_refs(&view.project, &mut ids);
                let mut sorted: Vec<String> = ids.into_iter().collect();
                sorted.sort();
                let media: Vec<serde_json::Value> = sorted
                    .into_iter()
                    .map(|id| {
                        let reference = format!("pixcut-asset:{id}");
                        serde_json::json!({
                            "reference": reference,
                            "path": backend.asset_path(&reference),
                            "kind": backend.asset_kind(&reference),
                        })
                    })
                    .collect();
                Ok(serde_json::json!({ "media": media }))
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(
        name = "get_app_status",
        description = "Whether PixCut is exporting, whether FFmpeg is available, and the app version."
    )]
    async fn get_app_status(&self, Parameters(_): Parameters<EmptyArgs>) -> CallToolResult {
        match self.blocking(|backend| redacted_json(&backend.status())).await {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(
        name = "import_media",
        description = "Copy a picture or video from disk into PixCut's local asset store. Returns a pixcut-asset reference for add_scene."
    )]
    async fn import_media(&self, Parameters(args): Parameters<ImportMediaArgs>) -> CallToolResult {
        match self
            .blocking(move |backend| {
                let imported = backend.import_media(&args.path)?;
                redacted_json(&imported)
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(
        name = "add_scene",
        description = "Append a picture or video clip to the end of the story. Give a path or a pixcut-asset reference; sets length, text, fit, motion and colour. Videos are decoded by the PixCut window, which must be open."
    )]
    async fn add_scene(&self, Parameters(args): Parameters<AddSceneArgs>) -> CallToolResult {
        match self
            .blocking(move |backend| {
                let view = backend.view()?;
                let project = &view.project;
                if project.visual_clips().len() >= 100 {
                    return Err("A project supports up to 100 clips. Remove one before adding another.".into());
                }
                if let Some(fit) = args.fit.as_deref() {
                    if !valid_fit(fit) {
                        return Err("fit must be cover, contain or blur.".into());
                    }
                }
                if let Some(motion) = args.motion.as_deref() {
                    if !valid_motion(motion) {
                        return Err("motion must be none, zoom-in, zoom-out, pan-left, pan-right, pan-up, pan-down or ken-burns.".into());
                    }
                }
                if let Some(color) = args.color.as_deref() {
                    if !valid_color(color) {
                        return Err("color must look like #1a2b3c.".into());
                    }
                }
                let (reference, imported_name, kind) = match (args.path.as_deref(), args.reference.as_deref()) {
                    (Some(_), Some(_)) => return Err("Give either path or reference, not both.".into()),
                    (None, None) => return Err("Give a path to a picture or a pixcut-asset reference.".into()),
                    (Some(path), None) => {
                        let imported = backend.import_media(path)?;
                        let kind = imported.mime.split('/').next().unwrap_or_default().to_string();
                        (imported.reference, Some(imported.name), kind)
                    }
                    (None, Some(reference)) => {
                        let kind = backend
                            .asset_kind(reference)
                            .ok_or_else(|| format!("“{reference}” is not in PixCut's media store. Import it first."))?
                            .to_string();
                        (reference.to_string(), None, kind)
                    }
                };
                if kind != "image" && kind != "video" {
                    return Err("Agents can add pictures and videos.".into());
                }
                // A video is decoded by the window, which reports its length
                // and a poster frame; a picture needs neither.
                let video = if kind == "video" { Some(backend.probe_video(&reference)?) } else { None };
                let seconds = match &video {
                    Some(info) => {
                        let limit = info.duration.clamp(0.5, 600.0);
                        args.seconds.filter(|value| value.is_finite()).map_or(limit, |value| value.clamp(0.5, limit))
                    }
                    None => clamp_seconds(args.seconds.unwrap_or(4.0)),
                };
                let minimum = project.timebase.min_ticks();
                let maximum = project.timebase.max_ticks();
                let duration_ticks = seconds_to_ticks(seconds, &project.timebase).clamp(minimum, maximum);
                let name = truncate_name(
                    args.name
                        .as_deref()
                        .or(imported_name.as_deref())
                        .unwrap_or("Photo"),
                );
                let name = if name.is_empty() { "Photo".to_string() } else { name };
                let id = new_scene_id(project);
                let mut scene = Scene::photo(
                    id.clone(),
                    name,
                    reference.clone(),
                    duration_ticks,
                    args.fit.as_deref().unwrap_or("cover"),
                );
                if let Some(info) = video {
                    scene.media_kind = Some("video".into());
                    scene.video_poster = Some(info.poster);
                    scene.source_duration_seconds = Some(info.duration.clamp(0.01, 3600.0));
                }
                scene.motion = args.motion.clone();
                scene.motion_amount = clamped(args.motion_amount, 0.0..=0.6, "motionAmount")?;
                if let Some(color) = args.color.clone() {
                    scene.color = color;
                }
                set_scene_text(&mut scene, args.title.clone(), args.subtitle.clone());
                backend.apply(Command::Add { scenes: vec![scene] })?;
                Ok(serde_json::json!({
                    "id": id,
                    "reference": reference,
                    "durationSeconds": project.timebase.ticks_to_seconds(duration_ticks),
                }))
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(
        name = "update_scene",
        description = "Change one clip: name, first-layer text, length, fit, motion, fades, framing and grade. Values are clamped to the editor's ranges."
    )]
    async fn update_scene(&self, Parameters(args): Parameters<UpdateSceneArgs>) -> CallToolResult {
        match self
            .blocking(move |backend| {
                let view = backend.view()?;
                let project = &view.project;
                let mut scene = find_scene(project, &args.id)?.clone();
                if let Some(name) = args.name.as_deref() {
                    let name = truncate_name(name);
                    if !name.is_empty() {
                        scene.name = name;
                    }
                }
                if let Some(fit) = args.fit.as_deref() {
                    if !valid_fit(fit) {
                        return Err("fit must be cover, contain or blur.".into());
                    }
                    scene.fit = fit.to_string();
                }
                if let Some(motion) = args.motion.as_deref() {
                    if !valid_motion(motion) {
                        return Err("motion must be none, zoom-in, zoom-out, pan-left, pan-right, pan-up, pan-down or ken-burns.".into());
                    }
                    scene.motion = Some(motion.to_string());
                }
                if let Some(color) = args.color.as_deref() {
                    if !valid_color(color) {
                        return Err("color must look like #1a2b3c.".into());
                    }
                    scene.color = color.to_string();
                }
                scene.motion_amount = clamped(args.motion_amount, 0.0..=0.6, "motionAmount")?.or(scene.motion_amount);
                scene.image_x = clamped(args.image_x, -1.0..=1.0, "imageX")?.unwrap_or(scene.image_x);
                scene.image_y = clamped(args.image_y, -1.0..=1.0, "imageY")?.unwrap_or(scene.image_y);
                scene.image_zoom = clamped(args.image_zoom, 1.0..=4.0, "imageZoom")?.unwrap_or(scene.image_zoom);
                scene.brightness = clamped(args.brightness, 0.0..=2.5, "brightness")?.unwrap_or(scene.brightness);
                scene.contrast = clamped(args.contrast, 0.0..=2.5, "contrast")?.unwrap_or(scene.contrast);
                scene.saturation = clamped(args.saturation, 0.0..=2.5, "saturation")?.unwrap_or(scene.saturation);
                scene.exposure = clamped(args.exposure, -3.0..=3.0, "exposure")?.unwrap_or(scene.exposure);
                scene.highlights = clamped(args.highlights, -1.0..=1.0, "highlights")?.unwrap_or(scene.highlights);
                scene.shadows = clamped(args.shadows, -1.0..=1.0, "shadows")?.unwrap_or(scene.shadows);
                scene.temperature = clamped(args.temperature, -1.0..=1.0, "temperature")?.unwrap_or(scene.temperature);
                scene.tint = clamped(args.tint, -1.0..=1.0, "tint")?.unwrap_or(scene.tint);
                scene.hue = clamped(args.hue, -180.0..=180.0, "hue")?.unwrap_or(scene.hue);
                scene.vibrance = clamped(args.vibrance, -100.0..=100.0, "vibrance")?.unwrap_or(scene.vibrance);
                if args.seconds.is_some() {
                    let seconds = clamp_seconds(args.seconds.unwrap_or(scene.duration_ticks as f64));
                    let minimum = project.timebase.min_ticks();
                    let maximum = project.timebase.max_ticks();
                    scene.duration_ticks = seconds_to_ticks(seconds, &project.timebase).clamp(minimum, maximum);
                }
                let seconds = project.timebase.ticks_to_seconds(scene.duration_ticks);
                scene.fade_in = clamped(args.fade_in, 0.0..=seconds, "fadeIn")?.unwrap_or(scene.fade_in.min(seconds));
                scene.fade_out = clamped(args.fade_out, 0.0..=seconds, "fadeOut")?.unwrap_or(scene.fade_out.min(seconds));
                if args.title.is_some() || args.subtitle.is_some() {
                    set_scene_text(&mut scene, args.title.clone(), args.subtitle.clone());
                }
                let view = backend.apply(Command::Update { scene: scene.clone() })?;
                let updated = find_scene(&view.project, &args.id)?;
                scene_json(&view.project, updated)
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(name = "remove_scene", description = "Delete one clip and close the gap it leaves.")]
    async fn remove_scene(&self, Parameters(args): Parameters<SceneIdArgs>) -> CallToolResult {
        match self
            .blocking(move |backend| {
                let view = backend.view()?;
                find_scene(&view.project, &args.id)?;
                backend.apply(Command::Remove { id: args.id.clone() })?;
                Ok(serde_json::json!({ "removed": args.id }))
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(
        name = "move_scene",
        description = "Move a clip to another position in the story, either by an offset or to an absolute index."
    )]
    async fn move_scene(&self, Parameters(args): Parameters<MoveSceneArgs>) -> CallToolResult {
        match self
            .blocking(move |backend| {
                let view = backend.view()?;
                let index = scene_index(&view.project, &args.id)?;
                let last = view.project.visual_clips().len().saturating_sub(1);
                let target = match (args.to_index, args.offset) {
                    (Some(target), _) => target.min(last),
                    (None, Some(offset)) => {
                        let target = index as i64 + offset as i64;
                        target.clamp(0, last as i64) as usize
                    }
                    (None, None) => (index + 1).min(last),
                };
                let offset = target as i64 - index as i64;
                if offset != 0 {
                    backend.apply(Command::Move { id: args.id.clone(), offset: offset as i32 })?;
                }
                Ok(serde_json::json!({ "id": args.id, "index": target }))
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(
        name = "add_audio",
        description = "Add a music or sound track from a file path (or an existing pixcut-asset reference plus sourceSeconds). Needs FFmpeg to read the file length when given a path."
    )]
    async fn add_audio(&self, Parameters(args): Parameters<AddAudioArgs>) -> CallToolResult {
        match self
            .blocking(move |backend| {
                let view = backend.view()?;
                let project = &view.project;
                if project.audio.len() >= 256 {
                    return Err("A project supports up to 256 audio clips.".into());
                }
                let (reference, name, source_seconds) = match (args.path.as_deref(), args.reference.as_deref()) {
                    (Some(path), _) => {
                        let (imported, seconds) = backend.import_audio(path)?;
                        (imported.reference, imported.name, seconds)
                    }
                    (None, Some(reference)) => {
                        if backend.asset_kind(reference) != Some("audio") {
                            return Err("That reference is not an audio file in PixCut's store. Use a path instead.".into());
                        }
                        let seconds = args.source_seconds.filter(|value| value.is_finite() && *value > 0.0)
                            .ok_or("sourceSeconds is required with a reference.")?;
                        (reference.to_string(), "Audio".to_string(), seconds)
                    }
                    (None, None) => return Err("Give a path or a reference.".into()),
                };
                let timebase = &project.timebase;
                let total = timebase.ticks_to_seconds(project.total_ticks());
                if total <= 0.0 {
                    return Err("Add a clip before adding audio.".into());
                }
                let start = clamped(args.start_seconds, 0.0..=total, "startSeconds")?.unwrap_or(0.0);
                let source_in = clamped(args.source_in_seconds, 0.0..=source_seconds, "sourceInSeconds")?.unwrap_or(0.0);
                let available = (source_seconds - source_in).min(total - start);
                let length = clamped(args.seconds, 0.05..=available.max(0.05), "seconds")?.unwrap_or(available);
                let duration_ticks = seconds_to_ticks(length, timebase).max(1);
                let start_ticks = seconds_to_ticks(start, timebase);
                let mut id = String::new();
                for _ in 0..32 {
                    let candidate = format!("audio-{}", &super::config::new_token()[..12]);
                    if project.audio.iter().all(|clip| clip.id != candidate) { id = candidate; break; }
                }
                if id.is_empty() { return Err("PixCut could not make an id for the track.".into()); }
                let fade = |value: Option<f64>| clamped(value, 0.0..=length, "fade").map(|v| v.unwrap_or(0.0));
                let clip = AudioClip {
                    id: id.clone(),
                    name: truncate_name(args.name.as_deref().unwrap_or(&name)).chars().take(120).collect::<String>().trim().to_string(),
                    data: reference.into(),
                    lane: args.lane.unwrap_or(0).min(7),
                    start_ticks,
                    duration_ticks,
                    source_in_seconds: source_in,
                    source_duration_seconds: source_seconds,
                    volume: clamped(args.volume, 0.0..=1.0, "volume")?.unwrap_or(0.8),
                    fade_in: fade(args.fade_in)?,
                    fade_out: fade(args.fade_out)?,
                    low: 0.0, mid: 0.0, high: 0.0, credit: None,
                };
                let mut audio = project.audio.clone();
                audio.push(clip);
                backend.apply(Command::Audio { audio })?;
                Ok(serde_json::json!({ "id": id, "durationSeconds": length }))
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(
        name = "update_audio",
        description = "Change a track's start, length, volume or fades. Get track ids from get_project."
    )]
    async fn update_audio(&self, Parameters(args): Parameters<UpdateAudioArgs>) -> CallToolResult {
        match self
            .blocking(move |backend| {
                let view = backend.view()?;
                let project = &view.project;
                let timebase = &project.timebase;
                let total = timebase.ticks_to_seconds(project.total_ticks());
                let mut audio = project.audio.clone();
                let clip = audio.iter_mut().find(|clip| clip.id == args.id)
                    .ok_or_else(|| format!("No audio track has the id “{}”. Call get_project to list them.", args.id))?;
                if let Some(start) = clamped(args.start_seconds, 0.0..=total, "startSeconds")? {
                    clip.start_ticks = seconds_to_ticks(start, timebase);
                }
                let start = timebase.ticks_to_seconds(clip.start_ticks);
                if let Some(length) = clamped(args.seconds, 0.05..=30000.0, "seconds")? {
                    clip.duration_ticks = seconds_to_ticks(length, timebase).max(1);
                }
                // Keep the clip inside both the story and its source file.
                let room = (total - start).min(clip.source_duration_seconds - clip.source_in_seconds).max(0.05);
                let length = timebase.ticks_to_seconds(clip.duration_ticks).min(room);
                clip.duration_ticks = seconds_to_ticks(length, timebase).max(1);
                clip.volume = clamped(args.volume, 0.0..=1.0, "volume")?.unwrap_or(clip.volume);
                clip.fade_in = clamped(args.fade_in, 0.0..=length, "fadeIn")?.unwrap_or(clip.fade_in.min(length));
                clip.fade_out = clamped(args.fade_out, 0.0..=length, "fadeOut")?.unwrap_or(clip.fade_out.min(length));
                let id = clip.id.clone();
                backend.apply(Command::Audio { audio })?;
                Ok(serde_json::json!({ "id": id, "startSeconds": start, "durationSeconds": length }))
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(name = "remove_audio", description = "Remove an audio track by id.")]
    async fn remove_audio(&self, Parameters(args): Parameters<SceneIdArgs>) -> CallToolResult {
        match self
            .blocking(move |backend| {
                let view = backend.view()?;
                let mut audio = view.project.audio.clone();
                let before = audio.len();
                audio.retain(|clip| clip.id != args.id);
                if audio.len() == before {
                    return Err(format!("No audio track has the id “{}”. Call get_project to list them.", args.id));
                }
                backend.apply(Command::Audio { audio })?;
                Ok(serde_json::json!({ "removed": args.id }))
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(
        name = "set_global_text",
        description = "Add (no id) or change (with id) a text layer that spans the whole story rather than one clip, such as a title card or watermark-free credit line."
    )]
    async fn set_global_text(&self, Parameters(args): Parameters<SetGlobalTextArgs>) -> CallToolResult {
        match self
            .blocking(move |backend| {
                let view = backend.view()?;
                let project = &view.project;
                let timebase = &project.timebase;
                let total = timebase.ticks_to_seconds(project.total_ticks());
                if let Some(color) = args.color.as_deref() {
                    if !valid_color(color) { return Err("color must look like #1a2b3c.".into()); }
                }
                let mut layers = project.global_text.clone();
                let start = clamped(args.start_seconds, 0.0..=total, "startSeconds")?;
                let length = clamped(args.seconds, 0.05..=total.max(0.05), "seconds")?;
                let index = match args.id.as_deref() {
                    Some(id) => layers.iter().position(|layer| layer.id == id)
                        .ok_or_else(|| format!("No text layer has the id “{id}”. Call get_project to list them."))?,
                    None => {
                        if layers.len() >= MAX_GLOBAL_TEXT_LAYERS {
                            return Err("A project supports up to 20 whole-story text layers.".into());
                        }
                        let id = format!("gtext-{}", &super::config::new_token()[..12]);
                        layers.push(TextLayer { id, start_ticks: 0, duration_ticks: project.total_ticks(), ..Default::default() });
                        layers.len() - 1
                    }
                };
                let layer = &mut layers[index];
                if let Some(title) = args.title { layer.title = title; }
                if let Some(subtitle) = args.subtitle { layer.subtitle = subtitle; }
                if let Some(color) = args.color { layer.color = color; }
                if let Some(start) = start { layer.start_ticks = seconds_to_ticks(start, timebase); }
                if let Some(length) = length { layer.duration_ticks = seconds_to_ticks(length, timebase).max(1); }
                let id = layer.id.clone();
                backend.apply(Command::GlobalText { global_text: layers })?;
                Ok(serde_json::json!({ "id": id }))
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(name = "remove_global_text", description = "Remove a whole-story text layer by id.")]
    async fn remove_global_text(&self, Parameters(args): Parameters<SceneIdArgs>) -> CallToolResult {
        match self
            .blocking(move |backend| {
                let view = backend.view()?;
                let mut layers = view.project.global_text.clone();
                let before = layers.len();
                layers.retain(|layer| layer.id != args.id);
                if layers.len() == before {
                    return Err(format!("No text layer has the id “{}”. Call get_project to list them.", args.id));
                }
                backend.apply(Command::GlobalText { global_text: layers })?;
                Ok(serde_json::json!({ "removed": args.id }))
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(
        name = "preview_frame",
        description = "Return a PNG of one moment of the story, drawn by the same renderer as the viewer and export. Needs the PixCut window open. Use it to check a clip's framing, text and colour."
    )]
    async fn preview_frame(&self, Parameters(args): Parameters<PreviewFrameArgs>) -> CallToolResult {
        if let Some(seconds) = args.at_seconds {
            if !seconds.is_finite() {
                return fail("atSeconds must be a number.");
            }
        }
        match self
            .blocking(move |backend| backend.render_frame(args.id, args.at_seconds, args.max_width))
            .await
        {
            Ok(png) => CallToolResult::success(vec![ContentBlock::image(png, "image/png")]),
            Err(error) => fail(error),
        }
    }

    #[tool(
        name = "export_video",
        description = "Start exporting the story to a video in an existing folder, using the export settings shown in the PixCut window (codec, size, formats). Returns at once; poll get_export_status. The window must be open and FFmpeg installed. An existing file is never overwritten."
    )]
    async fn export_video(&self, Parameters(args): Parameters<ExportVideoArgs>) -> CallToolResult {
        match self.blocking(move |backend| backend.start_export(&args.directory)).await {
            Ok(()) => ok_json(serde_json::json!({ "state": "running" })),
            Err(error) => fail(error),
        }
    }

    #[tool(
        name = "get_export_status",
        description = "State of the last agent export: idle, running, done (with the written file paths) or failed (with the reason)."
    )]
    async fn get_export_status(&self, Parameters(_): Parameters<EmptyArgs>) -> CallToolResult {
        match self.blocking(|backend| Ok(backend.export_status())).await {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(
        name = "set_transition",
        description = "Set or clear the transition into a clip. kind is none, fade, slide, wipe, zoom, blur, circle, slide-up or spin."
    )]
    async fn set_transition(&self, Parameters(args): Parameters<SetTransitionArgs>) -> CallToolResult {
        match self
            .blocking(move |backend| {
                let view = backend.view()?;
                let mut scene = find_scene(&view.project, &args.id)?.clone();
                if args.kind == "none" {
                    scene.transition = None;
                } else {
                    if !["fade", "slide", "wipe", "zoom", "blur", "circle", "slide-up", "spin"].contains(&args.kind.as_str()) {
                        return Err("kind must be none, fade, slide, wipe, zoom, blur, circle, slide-up or spin.".into());
                    }
                    let duration = clamped(args.seconds, 0.1..=2.0, "seconds")?.unwrap_or(0.6);
                    scene.transition = Some(pixcut_project::Transition { kind: args.kind.clone(), duration });
                }
                let view = backend.apply(Command::Update { scene })?;
                scene_json(&view.project, find_scene(&view.project, &args.id)?)
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(name = "duplicate_scene", description = "Copy a clip and place the copy right after it. Returns the new id.")]
    async fn duplicate_scene(&self, Parameters(args): Parameters<SceneIdArgs>) -> CallToolResult {
        match self
            .blocking(move |backend| {
                let view = backend.view()?;
                find_scene(&view.project, &args.id)?;
                let new_id = new_scene_id(&view.project);
                backend.apply(Command::Duplicate { id: args.id.clone(), new_id: new_id.clone() })?;
                Ok(serde_json::json!({ "id": args.id, "newId": new_id }))
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(
        name = "split_scene",
        description = "Cut a clip at a number of seconds from its start, keeping both halves. Returns the new right-hand id."
    )]
    async fn split_scene(&self, Parameters(args): Parameters<SplitSceneArgs>) -> CallToolResult {
        match self
            .blocking(move |backend| {
                let view = backend.view()?;
                let project = &view.project;
                let scene = find_scene(project, &args.id)?;
                let at_ticks = seconds_to_ticks(args.at_seconds, &project.timebase);
                let minimum = project.timebase.min_ticks();
                if at_ticks < minimum || scene.duration_ticks.saturating_sub(at_ticks) < minimum {
                    return Err("atSeconds must be at least half a second from either end of the clip.".into());
                }
                let new_id = new_scene_id(project);
                backend.apply(Command::Split {
                    id: args.id.clone(),
                    at_ticks,
                    new_id: new_id.clone(),
                })?;
                Ok(serde_json::json!({
                    "id": args.id,
                    "newId": new_id,
                    "atSeconds": project.timebase.ticks_to_seconds(at_ticks),
                    "durationSeconds": project.timebase.ticks_to_seconds(scene.duration_ticks),
                }))
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(name = "update_project", description = "Rename the project or change its aspect ratio (16:9, 9:16, 1:1, 4:5).")]
    async fn update_project(&self, Parameters(args): Parameters<UpdateProjectArgs>) -> CallToolResult {
        match self
            .blocking(move |backend| {
                if let Some(aspect) = args.aspect.as_deref() {
                    if !matches!(aspect, "16:9" | "9:16" | "1:1" | "4:5") {
                        return Err("aspect must be 16:9, 9:16, 1:1 or 4:5.".into());
                    }
                }
                if args.name.is_none() && args.aspect.is_none() {
                    let view = backend.view()?;
                    return Ok(serde_json::json!({
                        "name": view.project.name,
                        "aspect": view.project.aspect,
                    }));
                }
                // One Replace keeps a two-field change to a single undo step.
                let mut project = backend.view()?.project;
                if let Some(name) = args.name.as_deref() {
                    let name = truncate_name(name);
                    if name.is_empty() {
                        return Err("The project name cannot be empty.".into());
                    }
                    project.name = name;
                }
                if let Some(aspect) = args.aspect.clone() {
                    project.aspect = aspect;
                }
                let view = backend.apply(Command::Replace { project })?;
                Ok(serde_json::json!({
                    "name": view.project.name,
                    "aspect": view.project.aspect,
                }))
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(name = "undo", description = "Undo the last edit, including edits made in the PixCut window.")]
    async fn undo(&self, Parameters(_): Parameters<EmptyArgs>) -> CallToolResult {
        match self.blocking(|backend| backend.apply(Command::Undo)).await {
            Ok(view) => ok_json(serde_json::json!({
                "canUndo": view.can_undo,
                "canRedo": view.can_redo,
            })),
            Err(error) => fail(error),
        }
    }

    #[tool(name = "redo", description = "Redo the last undone edit.")]
    async fn redo(&self, Parameters(_): Parameters<EmptyArgs>) -> CallToolResult {
        match self.blocking(|backend| backend.apply(Command::Redo)).await {
            Ok(view) => ok_json(serde_json::json!({
                "canUndo": view.can_undo,
                "canRedo": view.can_redo,
            })),
            Err(error) => fail(error),
        }
    }

    #[tool(
        name = "save_project",
        description = "Write the open project to a .pixcut package at an absolute path. PixCut adds the extension when it is missing."
    )]
    async fn save_project(&self, Parameters(args): Parameters<ProjectPathArgs>) -> CallToolResult {
        match self
            .blocking(move |backend| {
                let written = backend.save_project(&args.path)?;
                Ok(serde_json::json!({ "path": written }))
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }

    #[tool(
        name = "open_project",
        description = "Open a .pixcut package in the PixCut window, replacing the story currently on screen."
    )]
    async fn open_project(&self, Parameters(args): Parameters<ProjectPathArgs>) -> CallToolResult {
        match self
            .blocking(move |backend| {
                backend.open_project(&args.path)?;
                Ok(serde_json::json!({ "opening": args.path }))
            })
            .await
        {
            Ok(json) => ok_json(json),
            Err(error) => fail(error),
        }
    }
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for PixCutServer {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("pixcut", env!("CARGO_PKG_VERSION")))
            .with_instructions(INSTRUCTIONS)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::backend::fake::FakeBackend;

    fn reference() -> String {
        format!("pixcut-asset:{}", "a".repeat(64))
    }

    fn project_with_two_scenes() -> Project {
        let mut project = Project::default();
        let mut second = Scene::photo("two", "Two", reference(), 120, "cover");
        second.start_ticks = 120;
        project.tracks[0].clips = vec![
            Scene::photo("one", "One", reference(), 120, "cover"),
            second,
        ];
        project
    }

    fn server(project: Project) -> PixCutServer {
        PixCutServer::new(Arc::new(FakeBackend::with_project(project)))
    }

    fn text(result: &CallToolResult) -> String {
        result
            .content
            .iter()
            .filter_map(|block| block.as_text().map(|text| text.text.clone()))
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn json(result: &CallToolResult) -> serde_json::Value {
        serde_json::from_str(&text(result)).expect("tool returns JSON")
    }

    #[tokio::test]
    async fn project_summary_lists_every_clip() {
        let result = server(project_with_two_scenes())
            .get_project(Parameters(EmptyArgs {}))
            .await;
        assert_eq!(result.is_error, Some(false));
        let value = json(&result);
        assert_eq!(value["sceneCount"], 2);
        assert_eq!(value["scenes"][1]["id"], "two");
        assert_eq!(value["durationSeconds"], 8.0);
    }

    #[tokio::test]
    async fn add_scene_appends_and_can_be_undone() {
        let backend = Arc::new(FakeBackend::default());
        let server = PixCutServer::new(backend.clone());
        let result = server
            .add_scene(Parameters(AddSceneArgs {
                path: None,
                reference: Some(reference()),
                name: Some("From the agent".into()),
                seconds: Some(3.0),
                title: Some("Hello".into()),
                subtitle: None,
                fit: Some("contain".into()),
                motion: Some("zoom-in".into()),
                motion_amount: Some(0.4),
                color: None,
            }))
            .await;
        assert_eq!(result.is_error, Some(false), "{}", text(&result));
        let value = json(&result);
        assert_eq!(value["durationSeconds"], 3.0);
        let project = backend.project();
        assert_eq!(project.visual_clips().len(), 1);
        assert_eq!(project.visual_clips()[0].title, "Hello");
        assert_eq!(project.visual_clips()[0].fit, "contain");
        server.undo(Parameters(EmptyArgs {})).await;
        assert!(backend.project().visual_clips().is_empty());
    }

    #[tokio::test]
    async fn add_scene_adds_a_video_with_its_probed_length() {
        let server = server(project_with_two_scenes());
        let args = |path: &str, seconds| AddSceneArgs {
            path: Some(path.into()), reference: None, name: None, seconds, title: None, subtitle: None,
            fit: None, motion: None, motion_amount: None, color: None,
        };
        let added = server.add_scene(Parameters(args("/tmp/clip.mp4", None))).await;
        assert_ne!(added.is_error, Some(true), "{}", text(&added));
        let scene = server.backend.view().unwrap().project.visual_clips().last().cloned().unwrap();
        assert_eq!(scene.media_kind.as_deref(), Some("video"));
        assert_eq!(scene.source_duration_seconds, Some(8.0));
        assert!(scene.video_poster.is_some());
        let shorter = server.add_scene(Parameters(args("/tmp/clip.mp4", Some(2.0)))).await;
        assert_ne!(shorter.is_error, Some(true));
        let last = server.backend.view().unwrap().project.visual_clips().last().cloned().unwrap();
        assert!((server.backend.view().unwrap().project.timebase.ticks_to_seconds(last.duration_ticks) - 2.0).abs() < 0.05);
    }

    #[tokio::test]
    async fn add_scene_rejects_video_and_bad_arguments() {
        let server = server(project_with_two_scenes());
        let video = server
            .add_scene(Parameters(AddSceneArgs {
                path: None,
                reference: Some(reference()),
                name: None,
                seconds: None,
                title: None,
                subtitle: None,
                fit: Some("sideways".into()),
                motion: None,
                motion_amount: None,
                color: None,
            }))
            .await;
        let message = text(&video);
        assert_eq!(video.is_error, Some(true));
        assert!(message.contains("fit must be"), "{message}");
    }

    #[tokio::test]
    async fn update_scene_edits_text_and_clamps_values() {
        let backend = Arc::new(FakeBackend::with_project(project_with_two_scenes()));
        let server = PixCutServer::new(backend.clone());
        let result = server
            .update_scene(Parameters(UpdateSceneArgs {
                id: "one".into(),
                name: None,
                title: Some("Headline".into()),
                subtitle: Some("Support".into()),
                seconds: Some(2.0),
                fit: None,
                motion: None,
                motion_amount: None,
                color: None,
                fade_in: Some(99.0),
                fade_out: None,
                image_x: None,
                image_y: None,
                image_zoom: Some(99.0),
                brightness: None,
                contrast: None,
                saturation: None,
                exposure: None,
                highlights: None,
                shadows: None,
                temperature: None,
                tint: None,
                hue: None,
                vibrance: None,
            }))
            .await;
        assert_eq!(result.is_error, Some(false), "{}", text(&result));
        let project = backend.project();
        let scene = &project.visual_clips()[0];
        assert_eq!(scene.title, "Headline");
        assert_eq!(scene.subtitle, "Support");
        assert_eq!(scene.duration_ticks, 60);
        assert_eq!(scene.fade_in, 2.0);
        assert_eq!(scene.image_zoom, 4.0);
        assert_eq!(scene.text_layers.len(), 1);
    }

    #[tokio::test]
    async fn duplicate_and_split_return_new_ids() {
        let server = server(project_with_two_scenes());
        let duplicated = server
            .duplicate_scene(Parameters(SceneIdArgs { id: "one".into() }))
            .await;
        let value = json(&duplicated);
        let new_id = value["newId"].as_str().expect("new id").to_string();
        assert_ne!(new_id, "one");

        let split = server
            .split_scene(Parameters(SplitSceneArgs { id: "one".into(), at_seconds: 2.0 }))
            .await;
        assert_eq!(split.is_error, Some(false), "{}", text(&split));
        assert!(json(&split)["newId"].as_str().is_some());
    }

    #[tokio::test]
    async fn move_scene_by_offset_stops_at_the_edges() {
        let backend = Arc::new(FakeBackend::with_project(project_with_two_scenes()));
        let server = PixCutServer::new(backend.clone());
        let result = server
            .move_scene(Parameters(MoveSceneArgs { id: "one".into(), offset: Some(1), to_index: None }))
            .await;
        assert_eq!(result.is_error, Some(false));
        assert_eq!(backend.project().visual_clips()[0].id, "two");
        let clamped = server
            .move_scene(Parameters(MoveSceneArgs { id: "two".into(), offset: Some(-99), to_index: None }))
            .await;
        assert_eq!(clamped.is_error, Some(false));
        assert_eq!(backend.project().visual_clips()[0].id, "two");
    }

    #[tokio::test]
    async fn unknown_scene_ids_are_reported_clearly() {
        let result = server(project_with_two_scenes())
            .get_scene(Parameters(GetSceneArgs { id: "missing".into() }))
            .await;
        assert_eq!(result.is_error, Some(true));
        assert!(text(&result).contains("No scene has the id"));
    }

    #[tokio::test]
    async fn get_scene_never_returns_inline_media() {
        let mut project = project_with_two_scenes();
        project.tracks[0].clips[0].video_poster = Some("data:image/png;base64,AAAA".into());
        let result = server(project)
            .get_scene(Parameters(GetSceneArgs { id: "one".into() }))
            .await;
        assert!(!text(&result).contains("base64"));
    }

    #[tokio::test]
    async fn update_project_validates_the_aspect() {
        let server = server(project_with_two_scenes());
        let bad = server
            .update_project(Parameters(UpdateProjectArgs { name: None, aspect: Some("2:1".into()) }))
            .await;
        assert_eq!(bad.is_error, Some(true));
        let good = server
            .update_project(Parameters(UpdateProjectArgs { name: Some("Trip".into()), aspect: Some("9:16".into()) }))
            .await;
        assert_eq!(good.is_error, Some(false));
        assert_eq!(json(&good)["aspect"], "9:16");
    }

    #[tokio::test]
    async fn a_name_and_aspect_change_is_one_undo_step() {
        let backend = Arc::new(FakeBackend::with_project(project_with_two_scenes()));
        let server = PixCutServer::new(backend.clone());
        let result = server
            .update_project(Parameters(UpdateProjectArgs { name: Some("Trip".into()), aspect: Some("9:16".into()) }))
            .await;
        assert_eq!(result.is_error, Some(false));
        server.undo(Parameters(EmptyArgs {})).await;
        let project = backend.project();
        assert_eq!(project.name, "Untitled story");
        assert_eq!(project.aspect, "16:9");
    }

    #[tokio::test]
    async fn save_and_open_pass_the_path_to_the_editor() {
        let backend = Arc::new(FakeBackend::with_project(project_with_two_scenes()));
        let server = PixCutServer::new(backend.clone());
        let saved = server
            .save_project(Parameters(ProjectPathArgs { path: "/tmp/story.pixcut".into() }))
            .await;
        assert_eq!(saved.is_error, Some(false));
        assert_eq!(backend.saved().as_deref(), Some("/tmp/story.pixcut"));

        let opened = server
            .open_project(Parameters(ProjectPathArgs { path: "/tmp/story.pixcut".into() }))
            .await;
        assert_eq!(opened.is_error, Some(false));
        assert_eq!(backend.opened().as_deref(), Some("/tmp/story.pixcut"));
    }

    #[tokio::test]
    async fn set_transition_sets_clamps_clears_and_rejects() {
        let server = server(project_with_two_scenes());
        let id = server.backend.view().unwrap().project.visual_clips()[0].id.clone();
        let args = |kind: &str, seconds| SetTransitionArgs { id: id.clone(), kind: kind.into(), seconds };
        let result = server.set_transition(Parameters(args("fade", Some(99.0)))).await;
        assert_ne!(result.is_error, Some(true), "{}", text(&result));
        let t = server.backend.view().unwrap().project.visual_clips()[0].transition.clone().unwrap();
        assert_eq!(t.kind, "fade");
        assert!(t.duration <= 2.0);
        assert_eq!(server.set_transition(Parameters(args("bogus", None))).await.is_error, Some(true));
        server.set_transition(Parameters(args("none", None))).await;
        assert!(server.backend.view().unwrap().project.visual_clips()[0].transition.is_none());
    }

    #[tokio::test]
    async fn audio_tracks_are_added_edited_and_removed() {
        let server = server(project_with_two_scenes());
        let added = server.add_audio(Parameters(AddAudioArgs {
            path: Some("/tmp/song.mp3".into()), reference: None, source_seconds: None, name: None,
            start_seconds: None, seconds: None, source_in_seconds: None, volume: Some(9.0),
            fade_in: None, fade_out: None, lane: None,
        })).await;
        assert_ne!(added.is_error, Some(true), "{}", text(&added));
        let id = json(&added)["id"].as_str().unwrap().to_string();
        let clip = server.backend.view().unwrap().project.audio[0].clone();
        assert_eq!(clip.volume, 1.0);
        assert!(clip.duration_ticks > 0);
        let updated = server.update_audio(Parameters(UpdateAudioArgs {
            id: id.clone(), start_seconds: Some(1.0), seconds: Some(500.0), volume: Some(0.3), fade_in: Some(99.0), fade_out: None,
        })).await;
        assert_ne!(updated.is_error, Some(true), "{}", text(&updated));
        let clip = server.backend.view().unwrap().project.audio[0].clone();
        assert_eq!(clip.volume, 0.3);
        assert!(clip.fade_in <= 20.0);
        let bad = server.add_audio(Parameters(AddAudioArgs {
            path: Some("/tmp/song.txt".into()), reference: None, source_seconds: None, name: None,
            start_seconds: None, seconds: None, source_in_seconds: None, volume: None, fade_in: None, fade_out: None, lane: None,
        })).await;
        assert_eq!(bad.is_error, Some(true));
        let removed = server.remove_audio(Parameters(SceneIdArgs { id })).await;
        assert_ne!(removed.is_error, Some(true));
        assert!(server.backend.view().unwrap().project.audio.is_empty());
    }

    #[tokio::test]
    async fn global_text_is_added_changed_and_removed() {
        let server = server(project_with_two_scenes());
        let added = server.set_global_text(Parameters(SetGlobalTextArgs {
            id: None, title: Some("Hello".into()), subtitle: None, start_seconds: Some(1.0), seconds: Some(2.0), color: Some("#ff0000".into()),
        })).await;
        assert_ne!(added.is_error, Some(true), "{}", text(&added));
        let id = json(&added)["id"].as_str().unwrap().to_string();
        assert_eq!(server.backend.view().unwrap().project.global_text[0].title, "Hello");
        let bad = server.set_global_text(Parameters(SetGlobalTextArgs {
            id: Some(id.clone()), title: None, subtitle: None, start_seconds: None, seconds: None, color: Some("red".into()),
        })).await;
        assert_eq!(bad.is_error, Some(true));
        let removed = server.remove_global_text(Parameters(SceneIdArgs { id })).await;
        assert_ne!(removed.is_error, Some(true));
        assert!(server.backend.view().unwrap().project.global_text.is_empty());
    }

    #[tokio::test]
    async fn preview_frame_returns_an_image_or_the_window_error() {
        let server = server(project_with_two_scenes());
        let ok = server.preview_frame(Parameters(PreviewFrameArgs { id: None, at_seconds: Some(1.0), max_width: None })).await;
        assert_ne!(ok.is_error, Some(true));
        assert!(serde_json::to_string(&ok).unwrap().contains("image/png"));
        let broken = server.preview_frame(Parameters(PreviewFrameArgs { id: Some("broken".into()), at_seconds: None, max_width: None })).await;
        assert_eq!(broken.is_error, Some(true));
        let nan = server.preview_frame(Parameters(PreviewFrameArgs { id: None, at_seconds: Some(f64::NAN), max_width: None })).await;
        assert_eq!(nan.is_error, Some(true));
    }

    #[tokio::test]
    async fn export_needs_an_absolute_folder_and_reports_status() {
        let server = server(project_with_two_scenes());
        let bad = server.export_video(Parameters(ExportVideoArgs { directory: "relative/dir".into() })).await;
        assert_eq!(bad.is_error, Some(true));
        let ok = server.export_video(Parameters(ExportVideoArgs { directory: "/tmp".into() })).await;
        assert_ne!(ok.is_error, Some(true));
        let status = server.get_export_status(Parameters(EmptyArgs {})).await;
        assert_eq!(json(&status)["state"], "idle");
    }

    #[test]
    fn every_tool_is_registered() {
        let tools = PixCutServer::tool_router().list_all();
        let names: Vec<&str> = tools.iter().map(|tool| tool.name.as_ref()).collect();
        for expected in [
            "get_project", "get_scene", "get_history", "list_media", "get_app_status",
            "import_media", "add_scene", "update_scene", "remove_scene", "move_scene",
            "duplicate_scene", "split_scene", "update_project", "undo", "redo",
            "save_project", "open_project", "set_transition", "add_audio", "update_audio", "preview_frame", "export_video", "get_export_status",
            "remove_audio", "set_global_text", "remove_global_text",
        ] {
            assert!(names.contains(&expected), "missing tool {expected}");
        }
    }
}
