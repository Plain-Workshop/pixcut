use base64::{engine::general_purpose::STANDARD, Engine};
use pixcut_project::{AudioClip, Command, History, Project, Session, View};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Command as Process, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager, State};
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

/// Native application menu. Items carry the same ids the command palette uses,
/// so a menu click and a keyboard shortcut run the same code. Accelerators are
/// left to the webview so a user-remapped shortcut never fires twice.
fn build_app_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let item = |id: &str, label: &str| MenuItem::with_id(app, id, label, true, None::<&str>);
    let app_menu = Submenu::with_items(app, "PixCut", true, &[
        &PredefinedMenuItem::about(app, Some("About PixCut"), None)?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::hide(app, None)?,
        &PredefinedMenuItem::hide_others(app, None)?,
        &PredefinedMenuItem::show_all(app, None)?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::quit(app, None)?,
    ])?;
    let file = Submenu::with_items(app, "File", true, &[
        &item("project.new", "New Project")?,
        &item("project.open", "Open Project…")?,
        &item("project.save", "Save")?,
        &PredefinedMenuItem::separator(app)?,
        &item("project.import", "Import Media…")?,
        &item("export.open", "Export Video…")?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::close_window(app, None)?,
    ])?;
    let edit = Submenu::with_items(app, "Edit", true, &[
        &item("history.undo", "Undo")?,
        &item("history.redo", "Redo")?,
    ])?;
    let view = Submenu::with_items(app, "View", true, &[
        &item("view.home", "Home")?,
        &PredefinedMenuItem::separator(app)?,
        &item("view.fullscreen", "Fullscreen Preview")?,
        &item("view.safe_area", "Safe Area")?,
        &PredefinedMenuItem::separator(app)?,
        &item("settings.open", "Settings…")?,
    ])?;
    let playback = Submenu::with_items(app, "Playback", true, &[
        &item("playback.toggle", "Play / Pause")?,
        &item("playback.forward", "Play Forward")?,
        &item("playback.reverse", "Play Backwards")?,
        &item("playback.stop", "Stop")?,
    ])?;
    let help = Submenu::with_items(app, "Help", true, &[
        &item("help.shortcuts", "Keyboard Shortcuts…")?,
    ])?;
    Menu::with_items(app, &[&app_menu, &file, &edit, &view, &playback, &help])
}

fn guard<T>(what: &str, f: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)) {
        Ok(result) => result,
        Err(payload) => {
            let detail = payload
                .downcast_ref::<&str>()
                .map(|value| (*value).to_string())
                .or_else(|| payload.downcast_ref::<String>().cloned())
                .unwrap_or_else(|| "unknown internal error".into());
            Err(format!(
                "PixCut recovered from an internal error while {what}: {detail}. Your work is still saved on this device."
            ))
        }
    }
}

struct Editor {
    session: Mutex<Session>,
    /// The same project in its on-disk shape (media as `pixcut-asset:` refs).
    /// Recovery writes start from this copy so a stack-order press does not
    /// base64-decode and re-hash every photo in the story.
    persisted: Mutex<Project>,
    exporting: AtomicBool,
    cancel_export: Arc<AtomicBool>,
    pending_open: Mutex<Option<PathBuf>>,
}
fn atomic_write(path: &Path, project: &Project) -> Result<(), String> {
    let parent = path.parent().ok_or("Invalid save location")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut tmp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    serde_json::to_writer(tmp.as_file_mut(), project).map_err(|e| e.to_string())?;
    tmp.as_file_mut().flush().map_err(|e| e.to_string())?;
    tmp.as_file().sync_all().map_err(|e| e.to_string())?;
    tmp.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}
fn recovery_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("recovery.pixcut.json"))
}
fn is_pixcut_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("pixcut"))
}
/// Finds the first project path in a process argument list, skipping flags and
/// the executable itself. Used for first launches and single-instance handoff.
fn pixcut_path_from_args<I, S>(args: I) -> Option<PathBuf>
where
    I: IntoIterator<Item = S>,
    S: AsRef<std::ffi::OsStr>,
{
    args.into_iter()
        .map(|arg| PathBuf::from(arg.as_ref()))
        .find(|path| is_pixcut_path(path))
}
fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
fn queue_open_project(app: &tauri::AppHandle, path: PathBuf) {
    if let Some(editor) = app.try_state::<Editor>() {
        if let Ok(mut pending) = editor.pending_open.lock() {
            *pending = Some(path);
        }
    }
    let _ = app.emit("project-opened", ());
}
const BUNDLE_FORMAT: &str = "pixcut";
const BUNDLE_VERSION: u32 = 1;
const BUNDLE_MANIFEST: &str = "manifest.json";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BundleAsset {
    id: String,
    path: String,
    name: String,
    mime: String,
    bytes: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BundleManifest {
    format: String,
    format_version: u32,
    created_with: String,
    project: Project,
    assets: Vec<BundleAsset>,
}
fn asset_extension(mime: &str) -> Option<&'static str> {
    match mime {
        "image/png" => Some("png"),
        "image/jpeg" => Some("jpg"),
        "image/webp" => Some("webp"),
        "audio/mpeg" | "audio/mp3" => Some("mp3"),
        "audio/wav" | "audio/x-wav" => Some("wav"),
        "audio/mp4" => Some("m4a"),
        "audio/aac" => Some("aac"),
        "audio/ogg" => Some("ogg"),
        "audio/webm" => Some("webm"),
        "video/webm" => Some("vwebm"),
        "video/mp4" => Some("mp4"),
        "video/x-m4v" => Some("m4v"),
        "video/quicktime" => Some("mov"),
        _ => None,
    }
}
fn parse_data_url(data: &str) -> Result<(&str, Vec<u8>), String> {
    let (meta, payload) = data
        .split_once(',')
        .ok_or("A project asset is not a data URL.")?;
    let mime = meta
        .strip_prefix("data:")
        .and_then(|value| value.strip_suffix(";base64"))
        .ok_or("A project asset uses an unsupported encoding.")?;
    if asset_extension(mime).is_none() {
        return Err(format!("Unsupported asset type: {mime}"));
    }
    let bytes = STANDARD.decode(payload).map_err(|e| e.to_string())?;
    Ok((mime, bytes))
}
fn asset_hash(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}
fn store_asset(
    data: &str,
    name: &str,
    assets: &mut Vec<BundleAsset>,
    by_id: &mut std::collections::HashMap<String, String>,
    files: &mut Vec<(String, Vec<u8>)>,
) -> Result<String, String> {
    let (mime, bytes) = parse_data_url(data)?;
    let extension = asset_extension(mime).ok_or("Unsupported asset type.")?;
    let id = asset_hash(&bytes);
    let path = format!("assets/{id}.{extension}");
    if !by_id.contains_key(&id) {
        by_id.insert(id.clone(), path.clone());
        assets.push(BundleAsset {
            id: id.clone(),
            path: path.clone(),
            name: name.chars().take(120).collect(),
            mime: mime.to_string(),
            bytes: bytes.len() as u64,
        });
        files.push((path, bytes));
    }
    Ok(id)
}
fn project_has_asset_refs(project: &Project) -> bool {
    project.overlays.iter().any(|element| element.source.as_deref().is_some_and(|source| source.starts_with("pixcut-asset:")))
        || project.tracks.iter().any(|track| track.clips.iter().any(|scene| {
            scene.image.starts_with("pixcut-asset:")
                || scene.elements.iter().any(|element| element.source.as_deref().is_some_and(|source| source.starts_with("pixcut-asset:")))
        }))
        || project.audio.iter().any(|clip| clip.data.starts_with("pixcut-asset:"))
        || project.legacy_music.as_ref().is_some_and(|music| music.data.starts_with("pixcut-asset:"))
}
fn build_bundle(project: &Project) -> Result<(BundleManifest, Vec<(String, Vec<u8>)>), String> {
    if project_has_asset_refs(project) {
        return Err("Relink missing media before saving this project.".into());
    }
    let mut portable = project.clone();
    let mut assets = Vec::new();
    let mut by_id = std::collections::HashMap::new();
    let mut files = Vec::new();
    for element in &mut portable.overlays {
                if let Some(source) = &element.source {
                    if source.starts_with("data:") {
                        let id = store_asset(source, element.label.as_deref().unwrap_or("Overlay"), &mut assets, &mut by_id, &mut files)?;
                        element.source = Some(format!("pixcut-asset:{id}"));
                    }
                }
            }
    for track in &mut portable.tracks {
        for scene in &mut track.clips {
            for element in &mut scene.elements {
                if let Some(source) = &element.source {
                    if source.starts_with("data:") {
                        let id = store_asset(source, element.label.as_deref().unwrap_or("Overlay"), &mut assets, &mut by_id, &mut files)?;
                        element.source = Some(format!("pixcut-asset:{id}"));
                    }
                }
            }
            if scene.image.starts_with("pixcut-asset:") {
                continue;
            }
            let id = store_asset(&scene.image, &scene.name, &mut assets, &mut by_id, &mut files)?;
            scene.image = format!("pixcut-asset:{id}").into();
        }
    }
    for clip in &mut portable.audio {
        if !clip.data.starts_with("pixcut-asset:") {
            let id = store_asset(&clip.data, &clip.name, &mut assets, &mut by_id, &mut files)?;
            clip.data = format!("pixcut-asset:{id}").into();
        }
    }
    let manifest = BundleManifest {
        format: BUNDLE_FORMAT.into(),
        format_version: BUNDLE_VERSION,
        created_with: format!("PixCut {}", env!("CARGO_PKG_VERSION")),
        project: portable,
        assets,
    };
    Ok((manifest, files))
}
fn write_project_bundle(path: &Path, project: &Project, asset_dir: Option<&Path>) -> Result<(), String> {
    let mut hydrated = project.clone();
    if let Some(directory) = asset_dir {
        // Bundles are portable, so even streamed video is embedded here.
        hydrate_project(directory, &mut hydrated, false)?;
    }
    let (manifest, files) = build_bundle(&hydrated)?;
    let parent = path.parent().ok_or("Invalid save location")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut tmp = tempfile::Builder::new()
        .suffix(".pixcut")
        .tempfile_in(parent)
        .map_err(|e| e.to_string())?;
    {
        let mut archive = ZipWriter::new(tmp.as_file_mut());
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
        archive
            .start_file(BUNDLE_MANIFEST, options)
            .map_err(|e| e.to_string())?;
        archive
            .write_all(&serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        for (name, bytes) in files {
            archive.start_file(name, options).map_err(|e| e.to_string())?;
            archive.write_all(&bytes).map_err(|e| e.to_string())?;
        }
        archive.finish().map_err(|e| e.to_string())?;
    }
    tmp.as_file_mut().flush().map_err(|e| e.to_string())?;
    tmp.as_file().sync_all().map_err(|e| e.to_string())?;
    tmp.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}
fn read_project_bundle(path: &Path) -> Result<Project, String> {
    if fs::metadata(path).map_err(|e| e.to_string())?.len() > 200_000_000 {
        return Err("Project package exceeds 200 MB.".into());
    }
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Cannot open .pixcut package: {e}"))?;
    let manifest_text = {
        let entry = archive
            .by_name(BUNDLE_MANIFEST)
            .map_err(|_| "The .pixcut package is missing its manifest.")?;
        if entry.size() > 5_000_000 {
            return Err("The .pixcut manifest is too large.".into());
        }
        let mut text = String::new();
        entry
            .take(5_000_001)
            .read_to_string(&mut text)
            .map_err(|e| e.to_string())?;
        text
    };
    let manifest: BundleManifest =
        serde_json::from_str(&manifest_text).map_err(|e| format!("Invalid .pixcut manifest: {e}"))?;
    if manifest.format != BUNDLE_FORMAT || manifest.format_version != BUNDLE_VERSION {
        return Err("This .pixcut package version is not supported.".into());
    }
    let mut hydrated = std::collections::HashMap::new();
    let mut total = 0u64;
    for asset in &manifest.assets {
        if !asset.path.starts_with("assets/") || asset.path.contains("..") {
            return Err("The .pixcut package contains an unsafe asset path.".into());
        }
        if asset_extension(&asset.mime).is_none() {
            return Err("The .pixcut package contains an unsupported asset type.".into());
        }
        let entry = archive
            .by_name(&asset.path)
            .map_err(|_| "The .pixcut package is missing an asset.")?;
        if entry.size() > 50_000_000 {
            return Err("A .pixcut asset exceeds the 50 MB limit.".into());
        }
        let mut bytes = Vec::new();
        entry
            .take(50_000_001)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        if bytes.len() > 50_000_000 {
            return Err("A .pixcut asset exceeds the 50 MB limit.".into());
        }
        total += bytes.len() as u64;
        if total > 200_000_000 {
            return Err("The .pixcut package exceeds the 200 MB asset budget.".into());
        }
        if asset_hash(&bytes) != asset.id || asset.bytes != bytes.len() as u64 {
            return Err("A .pixcut asset failed its integrity check.".into());
        }
        let data = format!("data:{};base64,{}", asset.mime, STANDARD.encode(&bytes));
        hydrated.insert(asset.id.clone(), data);
    }
    let mut project = manifest.project;
    for element in &mut project.overlays {
                if let Some(id) = element.source.as_deref().and_then(|s| s.strip_prefix("pixcut-asset:")) {
                    element.source = Some(hydrated.get(id).ok_or("A custom overlay asset is missing from the package.")?.clone());
                }
            }
    for track in &mut project.tracks {
        for scene in &mut track.clips {
            for element in &mut scene.elements {
                if let Some(id) = element.source.as_deref().and_then(|s| s.strip_prefix("pixcut-asset:")) {
                    element.source = Some(hydrated.get(id).ok_or("A custom overlay asset is missing from the package.")?.clone());
                }
            }
            if let Some(id) = scene.image.strip_prefix("pixcut-asset:") {
                let data = hydrated
                    .get(id)
                    .ok_or("A .pixcut image asset is missing.")?;
                scene.image = data.as_str().into();
            }
        }
    }
    for clip in &mut project.audio {
        if let Some(id) = clip.data.strip_prefix("pixcut-asset:") {
            let data = hydrated
                .get(id)
                .ok_or("A .pixcut audio asset is missing.")?;
            clip.data = data.as_str().into();
        }
    }
    if let Some(music) = &mut project.legacy_music {
        if let Some(id) = music.data.strip_prefix("pixcut-asset:") {
            let data = hydrated
                .get(id)
                .ok_or("A .pixcut music asset is missing.")?;
            music.data = data.as_str().into();
        }
    }
    project.validate()?;
    Ok(project)
}
fn is_zip_file(path: &Path) -> Result<bool, String> {
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut magic = [0u8; 4];
    let read = file.read(&mut magic).map_err(|e| e.to_string())?;
    Ok(read == 4 && magic == [0x50, 0x4b, 0x03, 0x04])
}
fn asset_file(directory: &Path, id: &str) -> Option<PathBuf> {
    if id.len() != 64 || !id.chars().all(|character| character.is_ascii_hexdigit()) {
        return None;
    }
    let entries = fs::read_dir(directory).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.file_stem().and_then(|stem| stem.to_str()) == Some(id) && path.extension().is_some() {
            return Some(path);
        }
    }
    None
}

#[tauri::command]
fn missing_asset_refs(app: tauri::AppHandle, references: Vec<String>) -> Vec<String> {
    let Ok(directory) = asset_store_dir(&app) else { return references };
    references
        .into_iter()
        .filter(|reference| {
            reference
                .strip_prefix("pixcut-asset:")
                .and_then(|id| asset_file(&directory, id))
                .is_none()
        })
        .collect()
}

#[tauri::command]
fn asset_path(app: tauri::AppHandle, reference: String) -> Result<String, String> {
    let id = reference.strip_prefix("pixcut-asset:").ok_or("Not a local asset reference.")?;
    asset_file(&asset_store_dir(&app)?, id)
        .map(|path| path.to_string_lossy().to_string())
        .ok_or_else(|| "That local asset is missing. Relink the media.".into())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImportedMedia {
    reference: String,
    name: String,
    bytes: u64,
}

/// Imports a video by streaming it into the local asset store, so the editor
/// keeps only a reference in memory instead of a base64 copy.
#[tauri::command]
async fn import_video(app: tauri::AppHandle) -> Result<Option<ImportedMedia>, String> {
    let Some(file) = rfd::AsyncFileDialog::new()
        .add_filter("Videos", &["mp4", "m4v", "mov", "webm"])
        .pick_file()
        .await
    else {
        return Ok(None);
    };
    let source = file.path().to_path_buf();
    let name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Video")
        .to_string();
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let extension = match extension.as_str() {
        "mp4" => "mp4",
        "m4v" => "m4v",
        "mov" => "mov",
        "webm" => "vwebm",
        _ => return Err("Choose an MP4, MOV, M4V, or WebM video.".into()),
    };
    let size = fs::metadata(&source).map_err(|e| e.to_string())?.len();
    if size == 0 {
        return Err("That video file is empty.".into());
    }
    if size > 4 * 1024 * 1024 * 1024 {
        return Err("That video is larger than 4 GB. Split it into smaller clips.".into());
    }
    let directory = asset_store_dir(&app)?;
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let mut input = fs::File::open(&source).map_err(|e| e.to_string())?;
    let mut temporary = tempfile::Builder::new()
        .suffix(&format!(".{extension}"))
        .tempfile_in(&directory)
        .map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1 << 20];
    let mut written = 0u64;
    loop {
        let read = input.read(&mut buffer).map_err(|e| e.to_string())?;
        if read == 0 { break; }
        hasher.update(&buffer[..read]);
        temporary.write_all(&buffer[..read]).map_err(|e| e.to_string())?;
        written += read as u64;
    }
    temporary.flush().map_err(|e| e.to_string())?;
    let id = hasher.finalize().iter().map(|byte| format!("{byte:02x}")).collect::<String>();
    let destination = directory.join(format!("{id}.{extension}"));
    if !destination.exists() {
        temporary.persist(&destination).map_err(|e| e.to_string())?;
    }
    Ok(Some(ImportedMedia { reference: format!("pixcut-asset:{id}"), name, bytes: written }))
}

#[tauri::command]
async fn import_audio(app: tauri::AppHandle) -> Result<Option<ImportedMedia>, String> {
    let Some(file) = rfd::AsyncFileDialog::new()
        .add_filter("Audio", &["mp3", "wav", "m4a", "aac", "ogg", "oga", "webm"])
        .pick_file()
        .await
    else {
        return Ok(None);
    };
    let source = file.path().to_path_buf();
    let name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Audio")
        .to_string();
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !["mp3", "wav", "m4a", "aac", "ogg", "oga", "webm"].contains(&extension.as_str()) {
        return Err("Choose an MP3, WAV, M4A, AAC, OGG, or WebM audio file.".into());
    }
    let size = fs::metadata(&source).map_err(|e| e.to_string())?.len();
    if size == 0 {
        return Err("That audio file is empty.".into());
    }
    if size > 1024 * 1024 * 1024 {
        return Err("That audio file is larger than 1 GB. Choose a shorter clip.".into());
    }
    let directory = asset_store_dir(&app)?;
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let mut input = fs::File::open(&source).map_err(|e| e.to_string())?;
    let mut temporary = tempfile::Builder::new()
        .suffix(&format!(".{extension}"))
        .tempfile_in(&directory)
        .map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1 << 20];
    let mut written = 0u64;
    loop {
        let read = input.read(&mut buffer).map_err(|e| e.to_string())?;
        if read == 0 { break; }
        hasher.update(&buffer[..read]);
        temporary.write_all(&buffer[..read]).map_err(|e| e.to_string())?;
        written += read as u64;
    }
    temporary.flush().map_err(|e| e.to_string())?;
    let id = hasher.finalize().iter().map(|byte| format!("{byte:02x}")).collect::<String>();
    let destination = directory.join(format!("{id}.{extension}"));
    if !destination.exists() {
        temporary.persist(&destination).map_err(|e| e.to_string())?;
    }
    Ok(Some(ImportedMedia { reference: format!("pixcut-asset:{id}"), name, bytes: written }))
}

fn asset_store_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("assets"))
}
fn extension_mime(extension: &str) -> Option<&'static str> {
    match extension {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "webp" => Some("image/webp"),
        "mp3" => Some("audio/mpeg"),
        "wav" => Some("audio/wav"),
        "m4a" => Some("audio/mp4"),
        "aac" => Some("audio/aac"),
        "ogg" => Some("audio/ogg"),
        "webm" => Some("audio/webm"),
        "vwebm" => Some("video/webm"),
        "mp4" => Some("video/mp4"),
        "m4v" => Some("video/x-m4v"),
        "mov" => Some("video/quicktime"),
        _ => None,
    }
}
fn write_asset_file(
    directory: &Path,
    id: &str,
    extension: &str,
    bytes: &[u8],
) -> Result<PathBuf, String> {
    fs::create_dir_all(directory).map_err(|e| e.to_string())?;
    let path = directory.join(format!("{id}.{extension}"));
    if path.exists() {
        return Ok(path);
    }
    let mut temp = tempfile::NamedTempFile::new_in(directory).map_err(|e| e.to_string())?;
    temp.write_all(bytes).map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    temp.persist(&path).map_err(|e| e.to_string())?;
    Ok(path)
}
fn persist_data_url(directory: &Path, data: &str, name: &str) -> Result<String, String> {
    let (mime, bytes) = parse_data_url(data)?;
    let extension = asset_extension(mime).ok_or("Unsupported asset type.")?;
    let id = asset_hash(&bytes);
    write_asset_file(directory, &id, extension, &bytes)?;
    let _ = name;
    Ok(id)
}
fn persist_project(directory: &Path, project: &mut Project) -> Result<(), String> {
    for element in &mut project.overlays {
                if let Some(source) = &element.source {
                    if source.starts_with("data:") {
                        let id = persist_data_url(directory, source, "Overlay")?;
                        element.source = Some(format!("pixcut-asset:{id}"));
                    }
                }
            }
    for track in &mut project.tracks {
        for scene in &mut track.clips {
            for element in &mut scene.elements {
                if let Some(source) = &element.source {
                    if source.starts_with("data:") {
                        let id = persist_data_url(directory, source, "Overlay")?;
                        element.source = Some(format!("pixcut-asset:{id}"));
                    }
                }
            }
            if scene.image.starts_with("data:") {
                let id = persist_data_url(directory, &scene.image, &scene.name)?;
                scene.image = format!("pixcut-asset:{id}").into();
            }
        }
    }
    for clip in &mut project.audio {
        if clip.data.starts_with("data:") {
            let id = persist_data_url(directory, &clip.data, &clip.name)?;
            clip.data = format!("pixcut-asset:{id}").into();
        }
    }
    Ok(())
}
fn hydrate_project(directory: &Path, project: &mut Project, keep_video_refs: bool) -> Result<(), String> {
    let mut files = std::collections::HashMap::new();
    if directory.exists() {
        for entry in fs::read_dir(directory).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.extension().is_none() {
                continue;
            }
            if let Some(stem) = path.file_stem().and_then(|value| value.to_str()) {
                files.insert(stem.to_string(), path);
            }
        }
    }
    let load = |id: &str| -> Result<Option<String>, String> {
        let Some(path) = files.get(id) else {
            // A missing asset must not make the whole project unopenable. The
            // reference stays in place and the editor offers to relink it.
            return Ok(None);
        };
        let bytes = fs::read(path).map_err(|e| e.to_string())?;
        if asset_hash(&bytes) != id {
            return Err("A local asset failed its integrity check.".into());
        }
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .ok_or("A local asset has no extension.")?;
        let mime = extension_mime(extension).ok_or("Unsupported local asset type.")?;
        Ok(Some(format!("data:{mime};base64,{}", STANDARD.encode(&bytes))))
    };
    for element in &mut project.overlays {
                if let Some(id) = element.source.as_deref().and_then(|s| s.strip_prefix("pixcut-asset:")) { if let Some(data) = load(id)? { element.source = Some(data); } }
            }
    for track in &mut project.tracks {
        for scene in &mut track.clips {
            for element in &mut scene.elements {
                if let Some(id) = element.source.as_deref().and_then(|s| s.strip_prefix("pixcut-asset:")) { if let Some(data) = load(id)? { element.source = Some(data); } }
            }
            // Imported video stays on disk so the editor never holds it as base64.
            if !(keep_video_refs && scene.media_kind.as_deref() == Some("video")) {
                if let Some(id) = scene.image.strip_prefix("pixcut-asset:") {
                    if let Some(data) = load(id)? { scene.image = data.into(); }
                }
            }
        }
    }
    for clip in &mut project.audio {
        if keep_video_refs { continue; }
        if let Some(id) = clip.data.strip_prefix("pixcut-asset:") {
            if let Some(data) = load(id)? { clip.data = data.into(); }
        }
    }
    if let Some(music) = &mut project.legacy_music {
        if let Some(id) = music.data.strip_prefix("pixcut-asset:") {
            if let Some(data) = load(id)? { music.data = data.into(); }
        }
    }
    Ok(())
}
fn has_inline_media(project: &Project) -> bool {
    !project.overlays.is_empty() && project.overlays.iter().any(|e| e.source.as_ref().is_some_and(|s| s.starts_with("data:"))) || project
        .tracks
        .iter()
        .any(|track| track.clips.iter().any(|clip| clip.image.starts_with("data:") || clip.elements.iter().any(|e| e.source.as_ref().is_some_and(|s| s.starts_with("data:")))))
        || project.audio.iter().any(|clip| clip.data.starts_with("data:"))
        || project.legacy_music.as_ref().is_some_and(|music| music.data.starts_with("data:"))
}
fn read_recovery(app: &tauri::AppHandle, path: &Path) -> Result<(Project, bool), String> {
    if fs::metadata(path).map_err(|e| e.to_string())?.len() > 100_000_000 {
        return Err("Recovery file exceeds 100 MB.".into());
    }
    let mut project: Project = serde_json::from_reader(fs::File::open(path).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Cannot open recovery: {e}"))?;
    let legacy = project.schema_version != 13 || has_inline_media(&project);
    hydrate_project(&asset_store_dir(app)?, &mut project, true)?;
    project.validate()?;
    Ok((project, legacy))
}
/// Writes the recovery file and hands back the persisted shape, so callers can
/// keep `Editor::persisted` in step without re-cloning the hydrated project.
fn write_recovery(
    app: &tauri::AppHandle,
    project: &Project,
) -> Result<Project, String> {
    let mut persisted = project.clone();
    persist_project(&asset_store_dir(app)?, &mut persisted)?;
    atomic_write(&recovery_path(app)?, &persisted)?;
    Ok(persisted)
}
fn read_project_with_migration(path: &Path) -> Result<(Project, bool), String> {
    if is_zip_file(path)? {
        return Ok((read_project_bundle(path)?, false));
    }
    if fs::metadata(path).map_err(|e| e.to_string())?.len() > 100_000_000 {
        return Err("Project file exceeds 100 MB.".into());
    }
    let mut p: Project = serde_json::from_reader(fs::File::open(path).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Cannot open project: {e}"))?;
    let legacy = p.schema_version != 13;
    p.validate()?;
    Ok((p, legacy))
}
fn read_project(path: &Path) -> Result<Project, String> {
    read_project_with_migration(path).map(|(project, _)| project)
}
/// Reads the recovery file without hydrating media, i.e. exactly the shape that
/// lives on disk and can be re-written without re-encoding anything.
fn read_persisted(path: &Path) -> Result<Project, String> {
    serde_json::from_reader(fs::File::open(path).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Cannot open recovery: {e}"))
}
#[tauri::command]
fn initialize(app: tauri::AppHandle, editor: State<Editor>) -> Result<View, String> {
    let mut session = editor.session.lock().map_err(|e| e.to_string())?;
    let path = recovery_path(&app)?;
    let pending = editor
        .pending_open
        .lock()
        .map_err(|e| e.to_string())?
        .take();
    if let Some(source) = pending {
        let mut project = read_project(&source)?;
        hydrate_project(&asset_store_dir(&app)?, &mut project, true)?;
        session.project = project;
        session.past.clear();
        session.future.clear();
        let persisted = write_recovery(&app, &session.project)?;
        *editor.persisted.lock().map_err(|e| e.to_string())? = persisted;
        return Ok(session.view());
    }
    if path.exists() {
        let (project, legacy) = read_recovery(&app, &path)?;
        session.project = project;
        let persisted = if legacy {
            write_recovery(&app, &session.project)?
        } else {
            // The file is already in its persisted shape; reuse it instead of
            // decoding every photo again just to rebuild the mirror.
            read_persisted(&path)?
        };
        *editor.persisted.lock().map_err(|e| e.to_string())? = persisted;
    } else {
        *editor.persisted.lock().map_err(|e| e.to_string())? = session.project.clone();
    }
    Ok(session.view())
}
#[tauri::command]
fn take_pending_project(
    app: tauri::AppHandle,
    editor: State<Editor>,
) -> Result<Option<View>, String> {
    let Some(source) = editor
        .pending_open
        .lock()
        .map_err(|e| e.to_string())?
        .take()
    else {
        return Ok(None);
    };
    let mut project = read_project(&source)?;
    hydrate_project(&asset_store_dir(&app)?, &mut project, true)?;
    let mut session = editor.session.lock().map_err(|e| e.to_string())?;
    let previous = std::mem::replace(&mut session.project, project);
    session.past.push(previous);
    if session.past.len() > 30 {
        session.past.remove(0);
    }
    session.future.clear();
    let persisted = write_recovery(&app, &session.project)?;
    *editor.persisted.lock().map_err(|e| e.to_string())? = persisted;
    Ok(Some(session.view()))
}
#[tauri::command]
fn dispatch(
    app: tauri::AppHandle,
    editor: State<Editor>,
    command: Command,
) -> Result<View, String> {
    guard("editing the project", || {
        let mut current = editor.session.lock().map_err(|e| e.to_string())?;
        let mut next = current.clone();
        next.apply(command)?;
        let persisted = write_recovery(&app, &next.project)?;
        *editor.persisted.lock().map_err(|e| e.to_string())? = persisted;
        *current = next;
        Ok(current.view())
    })
}
/// Stack-order presses answer with history flags only. Returning the project
/// would mean shipping every photo in the story back over IPC for a number that
/// the editor can apply itself.
#[tauri::command]
fn apply_order(
    app: tauri::AppHandle,
    editor: State<Editor>,
    command: Command,
) -> Result<History, String> {
    guard("changing the layer order", || {
        let Command::Order {
            kind,
            scene_id,
            id,
            z,
        } = command
        else {
            return Err("Only layer order changes can use this command.".into());
        };
        let mut current = editor.session.lock().map_err(|e| e.to_string())?;
        let mut next = current.clone();
        next.apply(Command::Order {
            kind: kind.clone(),
            scene_id: scene_id.clone(),
            id: id.clone(),
            z,
        })?;

        let mut mirror = editor.persisted.lock().map_err(|e| e.to_string())?;
        let mut next_mirror = mirror.clone();
        next_mirror.reorder(&kind, scene_id.as_deref(), &id, z)?;
        atomic_write(&recovery_path(&app)?, &next_mirror)?;
        *mirror = next_mirror;
        *current = next;
        Ok(History {
            can_undo: !current.past.is_empty(),
            can_redo: !current.future.is_empty(),
        })
    })
}
fn safe_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '_'))
        .collect();
    let trimmed = cleaned.trim();
    let limited: String = trimmed.chars().take(120).collect();
    if limited.is_empty() {
        "PixCut project".into()
    } else {
        limited
    }
}
#[tauri::command]
async fn save_project(app: tauri::AppHandle, editor: State<'_, Editor>) -> Result<bool, String> {
    let project = editor
        .session
        .lock()
        .map_err(|e| e.to_string())?
        .project
        .clone();
    let Some(file) = rfd::AsyncFileDialog::new()
        .add_filter("PixCut project", &["pixcut"])
        .set_file_name(format!("{}.pixcut", safe_filename(&project.name)))
        .save_file()
        .await
    else {
        return Ok(false);
    };
    write_project_bundle(file.path(), &project, Some(&asset_store_dir(&app)?))?;
    Ok(true)
}
#[tauri::command]
async fn save_project_file(app: tauri::AppHandle, project: Project) -> Result<bool, String> {
    let mut project = project;
    project.validate()?;
    let Some(file) = rfd::AsyncFileDialog::new()
        .add_filter("PixCut project", &["pixcut"])
        .set_file_name(format!("{}.pixcut", safe_filename(&project.name)))
        .save_file()
        .await
    else {
        return Ok(false);
    };
    write_project_bundle(file.path(), &project, Some(&asset_store_dir(&app)?))?;
    Ok(true)
}

fn still_frame_extension(mime: &str) -> Option<&'static str> {
    match mime {
        "image/png" => Some("png"),
        "image/jpeg" => Some("jpg"),
        _ => None,
    }
}

#[tauri::command]
async fn save_still_frame(data: String, file_name: String) -> Result<bool, String> {
    let (mime, bytes) = parse_data_url(&data)?;
    let extension = still_frame_extension(mime)
        .ok_or("Still frames must be PNG or JPEG images.")?;
    if bytes.is_empty() {
        return Err("The still frame is empty.".into());
    }
    if bytes.len() > 64 * 1024 * 1024 {
        return Err("That still frame is larger than 64 MB. Choose a smaller output format.".into());
    }
    let (filter, label) = if extension == "png" {
        ("png", "PNG image")
    } else {
        ("jpg", "JPEG image")
    };
    let Some(file) = rfd::AsyncFileDialog::new()
        .add_filter(label, &[filter])
        .set_file_name(format!("{}.{}", safe_filename(&file_name), extension))
        .save_file()
        .await
    else {
        return Ok(false);
    };
    let path = file.path();
    let parent = path.parent().ok_or("Choose a folder for the still frame.")?;
    let temporary = tempfile::Builder::new()
        .suffix(&format!(".{extension}"))
        .tempfile_in(parent)
        .map_err(|e| e.to_string())?;
    fs::write(temporary.path(), &bytes).map_err(|e| e.to_string())?;
    temporary.persist(path).map_err(|e| e.to_string())?;
    Ok(true)
}
#[tauri::command]
async fn open_project(
    app: tauri::AppHandle,
    editor: State<'_, Editor>,
) -> Result<Option<View>, String> {
    let Some(file) = rfd::AsyncFileDialog::new()
        .add_filter("PixCut project", &["pixcut"])
        .add_filter("Legacy PixCut JSON", &["json"])
        .pick_file()
        .await
    else {
        return Ok(None);
    };
    let mut project = read_project(file.path())?;
    hydrate_project(&asset_store_dir(&app)?, &mut project, true)?;
    dispatch(app, editor, Command::Replace { project }).map(Some)
}
fn ffmpeg() -> Option<PathBuf> {
    [
        PathBuf::from("ffmpeg"),
        PathBuf::from("/opt/homebrew/bin/ffmpeg"),
        PathBuf::from("/usr/local/bin/ffmpeg"),
    ]
    .into_iter()
    .find(|p| {
        Process::new(p)
            .arg("-version")
            .output()
            .is_ok_and(|o| o.status.success())
    })
}
#[tauri::command]
async fn exporter_available() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(|| ffmpeg().is_some())
        .await
        .map_err(|e| e.to_string())
}
struct ExportGuard<'a>(&'a AtomicBool);
impl Drop for ExportGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PickedMedia {
    name: String,
    mime: String,
    data: String,
}

#[tauri::command]
async fn pick_media(kind: String) -> Result<Vec<PickedMedia>, String> {
    let (label, extensions) = match kind.as_str() {
        "image" => ("Images", vec!["png", "jpg", "jpeg", "webp"]),
        "audio" => ("Audio", vec!["mp3", "wav", "m4a", "aac", "ogg", "oga", "webm"]),
        "video" => ("Videos", vec!["mp4", "m4v", "mov"]),
        _ => return Err("Unknown media type.".into()),
    };
    let Some(files) = rfd::AsyncFileDialog::new()
        .add_filter(label, &extensions)
        .pick_files()
        .await
    else {
        return Ok(vec![]);
    };
    let mut picked = Vec::new();
    for file in files {
        let path = file.path().to_path_buf();
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        let mime = match extension.as_str() {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "webp" => "image/webp",
            "mp3" => "audio/mpeg",
            "wav" => "audio/wav",
            "m4a" => "audio/mp4",
            "aac" => "audio/aac",
            "ogg" | "oga" => "audio/ogg",
            "webm" => "audio/webm",
            "mp4" => "video/mp4",
            "m4v" => "video/x-m4v",
            "mov" => "video/quicktime",
            _ => continue,
        };
        if kind == "video" {
            let size = fs::metadata(&path).map_err(|error| error.to_string())?.len();
            if size > 50 * 1024 * 1024 {
                return Err(format!("“{}” is larger than 50 MB. Choose a shorter clip.", file.file_name()));
            }
        }
        let bytes = fs::read(&path).map_err(|error| format!("Could not read {}: {error}", path.display()))?;
        picked.push(PickedMedia {
            name: file.file_name(),
            mime: mime.into(),
            data: format!("data:{mime};base64,{}", STANDARD.encode(bytes)),
        });
    }
    Ok(picked)
}

#[derive(Clone, Copy, Debug, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
enum ExportCodec { #[default] H264, Hevc, Vp9, Prores }
impl ExportCodec {
    fn encoder(self) -> &'static str {
        match self {
            Self::H264 => "libx264",
            Self::Hevc => "libx265",
            Self::Vp9 => "libvpx-vp9",
            Self::Prores => "prores_ks",
        }
    }
    fn audio_encoder(self) -> &'static str {
        match self {
            Self::Vp9 => "libopus",
            Self::Prores => "pcm_s16le",
            Self::H264 | Self::Hevc => "aac",
        }
    }
    fn supports(self, container: ExportContainer) -> bool {
        match self {
            Self::Vp9 => container == ExportContainer::Webm,
            Self::Prores => container == ExportContainer::Mov,
            Self::H264 | Self::Hevc => matches!(container, ExportContainer::Mp4 | ExportContainer::Mov | ExportContainer::Mkv),
        }
    }
    fn label(self) -> &'static str {
        match self {
            Self::H264 => "H.264",
            Self::Hevc => "H.265 / HEVC",
            Self::Vp9 => "VP9",
            Self::Prores => "ProRes 422",
        }
    }
}
#[derive(Clone, Copy, Debug, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
enum ExportContainer { #[default] Mp4, Mov, Mkv, Webm }
impl ExportContainer {
    fn extension(self) -> &'static str {
        match self { Self::Mp4 => "mp4", Self::Mov => "mov", Self::Mkv => "mkv", Self::Webm => "webm" }
    }
    fn label(self) -> &'static str {
        match self { Self::Mp4 => "MP4", Self::Mov => "QuickTime", Self::Mkv => "Matroska", Self::Webm => "WebM" }
    }
    fn is_quicktime_family(self) -> bool { matches!(self, Self::Mp4 | Self::Mov) }
}
#[derive(Clone, Copy, Debug, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
enum EncodeSpeed { Fast, #[default] Medium, Slow }
impl EncodeSpeed {
    fn preset(self) -> &'static str { match self { Self::Fast => "fast", Self::Medium => "medium", Self::Slow => "slow" } }
    fn vp9_cpu_used(self) -> &'static str { match self { Self::Fast => "5", Self::Medium => "2", Self::Slow => "0" } }
    fn prores_profile(crf: u8) -> &'static str { if crf >= 30 { "1" } else if crf >= 24 { "2" } else { "3" } }
}
fn encoder_available(binary: &Path, codec: ExportCodec) -> bool {
    encoder_named(binary, codec.encoder())
}
fn encoder_named(binary: &Path, name: &str) -> bool {
    std::process::Command::new(binary).args(["-hide_banner", "-encoders"]).output().is_ok_and(|output| {
        output.status.success() && String::from_utf8_lossy(&output.stdout).lines().any(|line| line.split_whitespace().nth(1) == Some(name))
    })
}
#[tauri::command]
async fn exporter_capabilities() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let Some(binary) = ffmpeg() else { return vec![] };
        [(ExportCodec::H264,"h264"),(ExportCodec::Hevc,"hevc"),(ExportCodec::Vp9,"vp9"),(ExportCodec::Prores,"prores")]
            .into_iter()
            .filter(|(codec,_)| encoder_available(&binary,*codec) && encoder_named(&binary, codec.audio_encoder()))
            .map(|(_,name)| name.to_owned())
            .collect()
    }).await.map_err(|error| error.to_string())
}
fn check_encoder(binary: &Path, options: &ExportOptions) -> Result<(), String> {
    if !encoder_available(binary, options.codec) {
        return Err(format!("Your FFmpeg does not include {}. Choose another codec or install FFmpeg with this encoder.", options.codec.encoder()));
    }
    if !encoder_named(binary, options.codec.audio_encoder()) {
        return Err(format!("Your FFmpeg does not include the {} audio encoder needed for this format. Choose another format or install a fuller FFmpeg build.", options.codec.audio_encoder()));
    }
    Ok(())
}
fn export_output_name(options: &ExportOptions) -> String {
    let raw = options.filename.trim();
    let stem = [".mp4", ".mov", ".mkv", ".webm"].into_iter().find_map(|suffix| raw.strip_suffix(suffix)).unwrap_or(raw);
    format!("{}.{}", safe_filename(stem), options.container.extension())
}
fn video_encoding_args(options: &ExportOptions) -> Vec<String> {
    let mut args: Vec<String> = match options.codec {
        ExportCodec::H264 | ExportCodec::Hevc => vec![
            "-c:v".into(), options.codec.encoder().into(),
            "-preset".into(), options.speed.preset().into(),
            "-crf".into(), options.crf.to_string(),
            "-pix_fmt".into(), "yuv420p".into(),
        ],
        ExportCodec::Vp9 => vec![
            "-c:v".into(), "libvpx-vp9".into(),
            "-crf".into(), options.crf.to_string(),
            "-b:v".into(), "0".into(),
            "-row-mt".into(), "1".into(),
            "-deadline".into(), "good".into(),
            "-cpu-used".into(), options.speed.vp9_cpu_used().into(),
            "-pix_fmt".into(), "yuv420p".into(),
        ],
        ExportCodec::Prores => vec![
            "-c:v".into(), "prores_ks".into(),
            "-profile:v".into(), EncodeSpeed::prores_profile(options.crf).into(),
            "-vendor".into(), "apl0".into(),
            "-pix_fmt".into(), "yuv422p10le".into(),
        ],
    };
    if options.codec == ExportCodec::Hevc && options.container.is_quicktime_family() {
        args.extend(["-tag:v".into(), "hvc1".into()]);
    }
    if options.container.is_quicktime_family() {
        args.extend(["-movflags".into(), "+faststart".into()]);
    }
    args
}
fn audio_encoding_args(options: &ExportOptions) -> Vec<String> {
    match options.codec {
        ExportCodec::Vp9 => vec!["-c:a".into(), "libopus".into(), "-b:a".into(), "160k".into(), "-ar".into(), "48000".into()],
        ExportCodec::Prores => vec!["-c:a".into(), "pcm_s16le".into(), "-ar".into(), "48000".into()],
        ExportCodec::H264 | ExportCodec::Hevc => vec!["-c:a".into(), "aac".into(), "-b:a".into(), "192k".into(), "-ar".into(), "48000".into()],
    }
}
fn validate_export_options(options: &ExportOptions) -> Result<(), String> {
    if options.width < 240
        || options.height < 240
        || options.width > 3840
        || options.height > 3840
        || options.width % 2 != 0
        || options.height % 2 != 0
        || !(15..=60).contains(&options.fps)
        || !(10..=35).contains(&options.crf)
    {
        return Err("Invalid export settings.".into());
    }
    if !options.codec.supports(options.container) {
        return Err(format!(
            "{} cannot be written to {}. Choose {} or another codec.",
            options.codec.label(),
            options.container.label(),
            if options.codec == ExportCodec::Vp9 { "WebM" } else if options.codec == ExportCodec::Prores { "QuickTime" } else { "MP4, QuickTime or Matroska" }
        ));
    }
    Ok(())
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportOptions {
    width: u32,
    height: u32,
    fps: u32,
    crf: u8,
    filename: String,
    #[serde(default)]
    codec: ExportCodec,
    #[serde(default)]
    container: ExportContainer,
    #[serde(default)]
    speed: EncodeSpeed,
}

#[tauri::command]
fn cancel_export(editor: State<'_, Editor>) {
    if editor.exporting.load(Ordering::SeqCst) {
        editor.cancel_export.store(true, Ordering::SeqCst);
    }
}

#[tauri::command]
async fn export_movie(
    app: tauri::AppHandle,
    editor: State<'_, Editor>,
    project_id: String,
    frames: Vec<String>,
    durations: Vec<u64>,
    options: ExportOptions,
) -> Result<Option<String>, String> {
    if editor
        .exporting
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("An export is already running.".into());
    }
    let _guard = ExportGuard(&editor.exporting);
    let cancel = Arc::clone(&editor.cancel_export);
    cancel.store(false, Ordering::SeqCst);
    let mut project = editor
        .session
        .lock()
        .map_err(|e| e.to_string())?
        .project
        .clone();
    hydrate_project(&asset_store_dir(&app)?, &mut project, false)?;
    if project.id != project_id
        || project.visual_clips().is_empty()
        || frames.is_empty()
        || frames.len() != durations.len()
        || durations.iter().any(|duration| *duration == 0)
        || durations.iter().sum::<u64>() != project.total_ticks()
    {
        return Err("The project changed. Please try exporting again.".into());
    }
    validate_export_options(&options)?;
    let binary = ffmpeg().ok_or(
        "Install FFmpeg to export videos.",
    )?;
    check_encoder(&binary, &options)?;
    let filename = export_output_name(&options);
    let Some(file) = rfd::AsyncFileDialog::new()
        .add_filter("Video", &[options.container.extension()])
        .set_file_name(&filename)
        .save_file()
        .await
    else {
        return Ok(None);
    };
    let destination = file.path().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || {
        let progress_app = app.clone();
        guard("encoding the video", || {
            encode_movie(project, frames, durations, options, binary, destination, cancel, move |percent| {
                let _ = progress_app.emit("export-progress", percent);
            })
        })
    })
        .await
        .map_err(|e| e.to_string())?
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportJob {
    frames: Vec<String>,
    durations: Vec<u64>,
    options: ExportOptions,
}

fn checked_export_snapshot(project_id: &str, mut project: Project) -> Result<Project, String> {
    project.validate()?;
    if project.id != project_id || project.visual_clips().is_empty() { return Err("The captured export project is invalid. Start the export again.".into()); }
    Ok(project)
}

#[tauri::command]
async fn export_variants(
    app: tauri::AppHandle,
    editor: State<'_, Editor>,
    project_id: String,
    jobs: Vec<ExportJob>,
    snapshot: Option<Project>,
) -> Result<Vec<String>, String> {
    if jobs.is_empty() || jobs.len() > 6 {
        return Err("Choose between one and six export formats.".into());
    }
    if editor
        .exporting
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("An export is already running.".into());
    }
    let _guard = ExportGuard(&editor.exporting);
    let cancel = Arc::clone(&editor.cancel_export);
    cancel.store(false, Ordering::SeqCst);
    let project = match snapshot { Some(project) => project, None => editor.session.lock().map_err(|e| e.to_string())?.project.clone() };
    let mut project = checked_export_snapshot(&project_id, project)?;
    hydrate_project(&asset_store_dir(&app)?, &mut project, false)?;
    for job in &jobs {
        if job.frames.is_empty()
            || job.frames.len() != job.durations.len()
            || job.durations.iter().any(|duration| *duration == 0)
            || job.durations.iter().sum::<u64>() != project.total_ticks()
        {
            return Err("The project changed or export settings are invalid.".into());
        }
        validate_export_options(&job.options)?;
    }
    let binary = ffmpeg().ok_or(
        "Install FFmpeg to export videos.",
    )?;
    for job in &jobs { check_encoder(&binary, &job.options)?; }
    let Some(folder) = rfd::AsyncFileDialog::new().set_title("Choose a folder for your exports").pick_folder().await else {
        return Ok(vec![]);
    };
    let directory = folder.path().to_path_buf();
    let asset_directory = asset_store_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let total = jobs.len() as f64;
        let mut written = Vec::new();
        for (index, job) in jobs.into_iter().enumerate() {
            if cancel.load(Ordering::SeqCst) {
                return Err("Export cancelled.".into());
            }
            check_encoder(&binary, &job.options)?;
            let filename = export_output_name(&job.options);
            let destination = directory.join(filename);
            let progress_app = app.clone();
            guard("encoding a video", || {
                encode_movie(project.clone(), job.frames, job.durations, job.options, binary.clone(), destination.clone(), Arc::clone(&cancel), move |percent| {
                    let overall = ((index as f64 + percent as f64 / 100.0) / total * 100.0).clamp(0.0, 99.0) as u8;
                    let _ = progress_app.emit("export-progress", overall);
                })
            })?;
            written.push(destination.to_string_lossy().to_string());
        }
        Ok(written)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlanOverlay {
    png: String,
    #[serde(default)]
    frames: Vec<String>,
    start_ticks: u64,
    duration_ticks: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlanSegment {
    kind: String,
    png: Option<String>,
    video: Option<String>,
    source_in_seconds: Option<f64>,
    fit: Option<String>,
    /// Playback speed for imported video clips. 1.0 means real time.
    #[serde(default)]
    speed: Option<f64>,
    /// A `.cube` 3D LUT baked from the same grade the preview canvas uses.
    #[serde(default)]
    lut: Option<String>,
    /// Visual fade lengths for an imported video clip, used for its own audio.
    #[serde(default)]
    fade_in: f64,
    #[serde(default)]
    fade_out: f64,
    /// Imported clip sound level (0–100). Missing means full volume.
    #[serde(default)]
    video_volume: Option<f64>,
    /// The export dialog's include-audio switch. Older callers omit it.
    #[serde(default = "default_true")]
    include_audio: bool,
    duration_ticks: u64,
    #[serde(default)]
    overlays: Vec<PlanOverlay>,
}

fn default_true() -> bool {
    true
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportPlan {
    segments: Vec<PlanSegment>,
    options: ExportOptions,
}

fn validate_plan(project: &Project, plan: &ExportPlan) -> Result<(), String> {
    let options = &plan.options;
    validate_export_options(options)?;
    if plan.segments.is_empty() || plan.segments.len() > 200 {
        return Err("The export plan is empty or too long.".into());
    }
    let mut total = 0u64;
    for segment in &plan.segments {
        if segment.duration_ticks == 0 {
            return Err("An export segment has no duration.".into());
        }
        total += segment.duration_ticks;
        if !segment.fade_in.is_finite()
            || !segment.fade_out.is_finite()
            || segment.fade_in < 0.0
            || segment.fade_out < 0.0
        {
            return Err("An export segment has an invalid fade.".into());
        }
        match segment.kind.as_str() {
            "image" => {
                if !segment.png.as_deref().is_some_and(|value| value.starts_with("data:image/png;base64,")) {
                    return Err("An image segment is missing its render.".into());
                }
            }
            "video" => {
                let source = segment.video.as_deref().unwrap_or_default();
                let streamed = source.strip_prefix("pixcut-asset:").is_some_and(|id| id.len() == 64 && id.chars().all(|character| character.is_ascii_hexdigit()));
                if !source.starts_with("data:video/") && !streamed {
                    return Err("A video segment is missing its source.".into());
                }
                let speed = segment.speed.unwrap_or(1.0);
                if !speed.is_finite() || !(0.25..=4.0).contains(&speed) {
                    return Err("A video segment has an invalid speed.".into());
                }
                if let Some(volume) = segment.video_volume {
                    if !volume.is_finite() || !(0.0..=100.0).contains(&volume) {
                        return Err("A video segment has an invalid sound level.".into());
                    }
                }
                if let Some(lut) = segment.lut.as_deref() {
                    if lut.is_empty()
                        || lut.len() > 8_000_000
                        || lut.contains('\0')
                        || !lut.lines().any(|line| line.trim().starts_with("LUT_3D_SIZE"))
                    {
                        return Err("A video grade lookup table is invalid.".into());
                    }
                }
            }
            _ => return Err("An export segment has an unknown type.".into()),
        }
        if segment.lut.is_some() && segment.kind != "video" {
            return Err("Only video segments can carry a grade lookup table.".into());
        }
        for overlay in &segment.overlays {
            if overlay.duration_ticks == 0 || !overlay.png.starts_with("data:image/png;base64,")
                || (!overlay.frames.is_empty() && (overlay.frames.len() as u64 != overlay.duration_ticks
                    || overlay.frames.iter().any(|frame| !frame.starts_with("data:image/png;base64,")))) {
                return Err("A text overlay is invalid.".into());
            }
        }
    }
    if total != project.total_ticks() {
        return Err("The project changed. Please try exporting again.".into());
    }
    Ok(())
}

fn filter_path(path: &Path) -> String {
    let text = path.to_string_lossy();
    let escaped = text.replace('\\', "\\\\").replace('\'', "\\'");
    format!("'{escaped}'")
}

/// FFmpeg volume expression that lowers music inside the given timeline windows.
/// Times are clip-local, so the windows are shifted by the clip's start.
fn ducking_expression(windows: &[(f64, f64)], clip_start: f64, amount: f64) -> String {
    const RAMP: f64 = 0.15;
    let terms: Vec<String> = windows
        .iter()
        .map(|(start, end)| {
            format!(
                "min(max((t+{clip_start:.6}-{start:.6})/{RAMP:.6},0),1)*min(max(({end:.6}-(t+{clip_start:.6}))/{RAMP:.6},0),1)"
            )
        })
        .collect();
    format!("1-{:.6}*max(0,{})", amount / 100.0, terms.join(","))
}

/// True when the media file carries an audio track. A missing ffprobe is not an
/// error: the export simply keeps behaving like it always has, without the
/// clip's own sound.
fn has_audio_stream(binary: &Path, media: &Path) -> bool {
    let probe = Process::new(binary.with_file_name("ffprobe"))
        .args([
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=codec_type",
            "-of",
            "csv=p=0",
        ])
        .arg(media)
        .output();
    match probe {
        Ok(output) => output.status.success() && !String::from_utf8_lossy(&output.stdout).trim().is_empty(),
        Err(_) => false,
    }
}

/// Chains `atempo` so every step stays inside the range older FFmpeg builds
/// accept (0.5–2.0). The product is the requested playback speed.
fn atempo_chain(speed: f64) -> String {
    let mut remaining = if speed.is_finite() { speed.clamp(0.25, 4.0) } else { 1.0 };
    let mut steps = Vec::new();
    while remaining > 2.0 + 1e-9 {
        steps.push(2.0);
        remaining /= 2.0;
    }
    while remaining < 0.5 - 1e-9 {
        steps.push(0.5);
        remaining /= 0.5;
    }
    steps.push(remaining);
    steps
        .iter()
        .map(|value| format!("atempo={value:.6}"))
        .collect::<Vec<_>>()
        .join(",")
}

fn write_plan_payload(directory: &Path, name: &str, data: &str, prefix: &str) -> Result<PathBuf, String> {
    let payload = data.strip_prefix(prefix).ok_or("A media payload has an unsupported format.")?;
    if payload.len() > 160_000_000 {
        return Err("A media payload exceeds the export size limit.".into());
    }
    let bytes = STANDARD.decode(payload).map_err(|e| e.to_string())?;
    let path = directory.join(name);
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path)
}

fn encode_plan(
    project: &Project,
    plan: ExportPlan,
    binary: PathBuf,
    destination: PathBuf,
    asset_dir: &Path,
    cancel: Arc<AtomicBool>,
    progress: impl Fn(u8) + Send + 'static,
) -> Result<Option<String>, String> {
    if cancel.load(Ordering::SeqCst) {
        return Err("Export cancelled.".into());
    }
    let temp = tempfile::tempdir().map_err(|e| e.to_string())?;
    let mut command = Process::new(&binary);
    command.current_dir(temp.path());
    command.args(["-y", "-nostdin", "-hide_banner", "-loglevel", "error"]);
    let mut visual: Vec<(usize, f64, String, f64, Option<PathBuf>)> = Vec::new();
    let mut overlays: Vec<(usize, f64, f64)> = Vec::new();
    // Imported video clips contribute their own soundtrack: (input, speed,
    // duration, timeline start, fade in, fade out).
    let mut video_audio: Vec<(usize, f64, f64, f64, f64, f64, Option<f64>)> = Vec::new();
    let mut duck_windows: Vec<(f64, f64)> = Vec::new();
    let mut input_index = 0usize;
    let mut timeline_offset = 0.0f64;
    for (index, segment) in plan.segments.iter().enumerate() {
        if cancel.load(Ordering::SeqCst) {
            return Err("Export cancelled.".into());
        }
        let duration = project.timebase.ticks_to_seconds(segment.duration_ticks);
        let segment_start = timeline_offset;
        let mut speed = 1.0;
        let mut lut_path = None;
        match segment.kind.as_str() {
            "image" => {
                let path = write_plan_payload(temp.path(), &format!("frame-{index}.png"), segment.png.as_deref().unwrap_or_default(), "data:image/png;base64,")?;
                command.args(["-loop", "1", "-t", &format!("{duration:.6}"), "-i"]).arg(path);
            }
            "video" => {
                let data = segment.video.as_deref().unwrap_or_default();
                let path = if let Some(id) = data.strip_prefix("pixcut-asset:") {
                    asset_file(asset_dir, id).ok_or("A streamed video is missing from the local store. Relink the clip.")?
                } else {
                    let mime = data.split_once(',').map(|(meta, _)| meta).unwrap_or_default();
                    let extension = if mime.starts_with("data:video/mp4") {
                        "mp4"
                    } else if mime.starts_with("data:video/quicktime") {
                        "mov"
                    } else if mime.starts_with("data:video/x-m4v") {
                        "m4v"
                    } else {
                        "webm"
                    };
                    let payload = data.split_once(',').map(|(_, payload)| payload).ok_or("A video payload is invalid.")?;
                    let path = temp.path().join(format!("video-{index}.{extension}"));
                    let bytes = STANDARD.decode(payload).map_err(|e| e.to_string())?;
                    fs::write(&path, bytes).map_err(|e| e.to_string())?;
                    path
                };
                speed = segment.speed.unwrap_or(1.0);
                let start = segment.source_in_seconds.unwrap_or(0.0).max(0.0);
                let source_length = (duration * speed).max(duration);
                command.args(["-ss", &format!("{start:.6}"), "-t", &format!("{source_length:.6}"), "-i"]).arg(path.clone());
                if segment.include_audio && has_audio_stream(&binary, &path) {
                    if segment.video_volume.unwrap_or(100.0) > 0.0 {
                        duck_windows.push((segment_start, segment_start + duration));
                    }
                    video_audio.push((
                        input_index,
                        speed,
                        duration,
                        segment_start,
                        segment.fade_in.min(duration),
                        segment.fade_out.min(duration),
                        segment.video_volume,
                    ));
                }
                if let Some(lut) = segment.lut.as_deref() {
                    let path = temp.path().join(format!("grade-{index}.cube"));
                    fs::write(&path, lut.as_bytes()).map_err(|e| e.to_string())?;
                    lut_path = Some(path);
                }
            }
            _ => return Err("An export segment has an unknown type.".into()),
        }
        visual.push((input_index, duration, segment.fit.clone().unwrap_or_else(|| "cover".into()), speed, lut_path));
        timeline_offset += duration;
        input_index += 1;
        for overlay in &segment.overlays {
            let start = project.timebase.ticks_to_seconds(overlay.start_ticks);
            let length = project.timebase.ticks_to_seconds(overlay.duration_ticks);
            if overlay.frames.is_empty() {
                let path = write_plan_payload(temp.path(), &format!("overlay-{input_index}.png"), &overlay.png, "data:image/png;base64,")?;
                command.args(["-loop", "1", "-t", &format!("{length:.6}"), "-i"]).arg(path);
            } else {
                for (frame_index, frame) in overlay.frames.iter().enumerate() {
                    if cancel.load(Ordering::SeqCst) { return Err("Export cancelled.".into()); }
                    write_plan_payload(temp.path(), &format!("overlay-{input_index}-{frame_index:06}.png"), frame, "data:image/png;base64,")?;
                }
                let fps = project.timebase.denominator as f64 / project.timebase.numerator as f64;
                command.args(["-framerate", &format!("{fps:.6}"), "-i"])
                    .arg(temp.path().join(format!("overlay-{input_index}-%06d.png")));
            }
            overlays.push((input_index, start, start + length));
            input_index += 1;
        }
    }
    let audio_files = project
        .audio
        .iter()
        .enumerate()
        .map(|(index, clip)| write_audio(temp.path(), clip, index, asset_dir).map(|path| (path, clip)))
        .collect::<Result<Vec<_>, _>>()?;
    let audio_start = input_index;
    for (path, clip) in &audio_files {
        let duration = project.timebase.ticks_to_seconds(clip.duration_ticks);
        command
            .arg("-ss")
            .arg(format!("{:.6}", clip.source_in_seconds))
            .arg("-t")
            .arg(format!("{duration:.6}"))
            .arg("-i")
            .arg(path);
    }

    let width = plan.options.width;
    let height = plan.options.height;
    let fps = plan.options.fps;
    let mut filters = Vec::new();
    for (index, (input, duration, fit, speed, lut)) in visual.iter().enumerate() {
        let geometry = if fit == "contain" {
            format!("scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2")
        } else {
            format!("scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}")
        };
        let mut chain = format!("[{input}:v]{geometry},setsar=1");
        if (speed - 1.0).abs() > 1e-9 {
            chain.push_str(&format!(",setpts=(PTS-STARTPTS)/{speed:.6}"));
        }
        chain.push_str(&format!(
            ",fps={fps},tpad=stop_mode=clone:stop_duration=2,trim=duration={duration:.6},setpts=PTS-STARTPTS"
        ));
        if let Some(path) = lut {
            chain.push_str(&format!(",lut3d=file={}", filter_path(path)));
        }
        chain.push_str(&format!("[v{index}]"));
        filters.push(chain);
    }
    let mut current = if visual.len() == 1 {
        "v0".to_string()
    } else {
        let labels: String = (0..visual.len()).map(|index| format!("[v{index}]")).collect();
        filters.push(format!("{labels}concat=n={}:v=1:a=0[base]", visual.len()));
        "base".to_string()
    };
    for (index, (input, start, end)) in overlays.iter().enumerate() {
        let next = format!("ov{index}");
        filters.push(format!("[{input}:v]setpts=PTS-STARTPTS+{start:.6}/TB[overlay{index}]"));
        filters.push(format!("[{current}][overlay{index}]overlay=0:0:enable='gte(t,{start:.6})*lt(t,{end:.6})'[{next}]"));
        current = next;
    }
    let mut fade_index = 0usize;
    for clip in project.visual_clips() {
        let clip_start = project.timebase.ticks_to_seconds(clip.start_ticks);
        let clip_end = project.timebase.ticks_to_seconds(clip.start_ticks + clip.duration_ticks);
        let clip_length = (clip_end - clip_start).max(0.001);
        if clip.fade_in > 0.0 {
            let length = clip.fade_in.min(clip_length).max(0.001);
            let next = format!("fade{fade_index}");
            filters.push(format!("[{current}]fade=t=in:st={clip_start:.6}:d={length:.6}[{next}]"));
            current = next;
            fade_index += 1;
        }
        if clip.fade_out > 0.0 {
            let length = clip.fade_out.min(clip_length).max(0.001);
            let start = (clip_end - length).max(0.0);
            let next = format!("fade{fade_index}");
            filters.push(format!("[{current}]fade=t=out:st={start:.6}:d={length:.6}[{next}]"));
            current = next;
            fade_index += 1;
        }
    }
    let ducking = project.ducking.unwrap_or(0.0);
    let mut audio_nodes: Vec<String> = Vec::new();
    for (index, (_, clip)) in audio_files.iter().enumerate() {
        let input = audio_start + index;
        let duration = project.timebase.ticks_to_seconds(clip.duration_ticks);
        let mut node = format!("[{input}:a]asetpts=PTS-STARTPTS,aresample=48000,volume={:.3}", clip.volume);
        if ducking > 0.0 && !duck_windows.is_empty() {
            let clip_start = project.timebase.ticks_to_seconds(clip.start_ticks);
            node.push_str(&format!(",volume='{}':eval=frame", ducking_expression(&duck_windows, clip_start, ducking)));
        }
        if clip.fade_in > 0.0 {
            node.push_str(&format!(",afade=t=in:st=0:d={:.3}", clip.fade_in.min(duration)));
        }
        if clip.fade_out > 0.0 {
            let start = (duration - clip.fade_out).max(0.0);
            node.push_str(&format!(",afade=t=out:st={start:.3}:d={:.3}", clip.fade_out.min(duration)));
        }
        let delay = (project.timebase.ticks_to_seconds(clip.start_ticks) * 1000.0).round() as u64;
        node.push_str(&format!(",adelay={delay}:all=1[am{}]", index));
        audio_nodes.push(node);
    }
    for (index, (input, speed, duration, start, fade_in, fade_out, volume)) in video_audio.iter().enumerate() {
        let mut node = format!("[{input}:a]asetpts=PTS-STARTPTS,aresample=48000");
        if let Some(volume) = volume {
            if *volume < 99.999 {
                node.push_str(&format!(",volume={:.3}", volume / 100.0));
            }
        }
        if (speed - 1.0).abs() > 1e-9 {
            node.push_str(&format!(",{}", atempo_chain(*speed)));
        }
        node.push_str(&format!(",atrim=duration={duration:.6},asetpts=PTS-STARTPTS"));
        if *fade_in > 0.0 {
            node.push_str(&format!(",afade=t=in:st=0:d={fade_in:.3}"));
        }
        if *fade_out > 0.0 {
            node.push_str(&format!(",afade=t=out:st={:.3}:d={fade_out:.3}", (duration - fade_out).max(0.0)));
        }
        let delay = (start * 1000.0).round() as u64;
        node.push_str(&format!(",adelay={delay}:all=1[av{index}]"));
        audio_nodes.push(node);
    }
    if !audio_nodes.is_empty() {
        let mix = if audio_nodes.len() == 1 {
            let label = if audio_files.is_empty() { "[av0]" } else { "[am0]" };
            format!("{label}anull[aout]")
        } else {
            let mut labels = String::new();
            for index in 0..audio_files.len() {
                labels.push_str(&format!("[am{index}]"));
            }
            for index in 0..video_audio.len() {
                labels.push_str(&format!("[av{index}]"));
            }
            format!(
                "{labels}amix=inputs={}:duration=longest:dropout_transition=0:normalize=0[aout]",
                audio_nodes.len()
            )
        };
        filters.push(format!("{};{mix}", audio_nodes.join(";")));
    }

    let duration = project.timebase.ticks_to_seconds(project.total_ticks());
    let output = tempfile::Builder::new()
        .suffix(&format!(".{}", plan.options.container.extension()))
        .tempfile_in(destination.parent().ok_or("Invalid output path")?)
        .map_err(|e| e.to_string())?;
    command
        .args(["-filter_complex", &filters.join(";"), "-map"])
        .arg(format!("[{current}]"));
    if !audio_files.is_empty() || !video_audio.is_empty() {
        command.args(["-map", "[aout]"]).args(audio_encoding_args(&plan.options));
    }
    command.args(video_encoding_args(&plan.options));
    command.args([
        "-progress",
        "pipe:1",
        "-nostats",
        "-t",
        &format!("{duration:.6}"),
    ]);
    command.arg(output.path()).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().ok_or("FFmpeg progress stream is unavailable.")?;
    let stderr = child.stderr.take().ok_or("FFmpeg error stream is unavailable.")?;
    let progress_thread = std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().flatten() {
            let micros = line
                .strip_prefix("out_time_us=")
                .or_else(|| line.strip_prefix("out_time_ms="))
                .and_then(|value| value.trim().parse::<f64>().ok());
            if let Some(micros) = micros {
                let percent = (micros / 1_000_000.0 / duration.max(0.001) * 100.0).clamp(0.0, 99.0) as u8;
                progress(percent);
            }
        }
    });
    let error_thread = std::thread::spawn(move || {
        let mut text = String::new();
        let _ = BufReader::new(stderr).read_to_string(&mut text);
        text
    });
    let status = loop {
        if cancel.load(Ordering::SeqCst) {
            let _ = child.kill();
        }
        match child.try_wait().map_err(|e| e.to_string())? {
            Some(status) => break status,
            None => std::thread::sleep(std::time::Duration::from_millis(120)),
        }
    };
    let _ = progress_thread.join();
    let error = error_thread.join().unwrap_or_default();
    if cancel.load(Ordering::SeqCst) {
        return Err("Export cancelled.".into());
    }
    if !status.success() {
        return Err(format!(
            "FFmpeg export failed: {}",
            error.chars().take(1000).collect::<String>()
        ));
    }
    output.persist(&destination).map_err(|e| e.to_string())?;
    Ok(Some(destination.to_string_lossy().to_string()))
}

#[tauri::command]
async fn export_plan_variants(
    app: tauri::AppHandle,
    editor: State<'_, Editor>,
    project_id: String,
    plans: Vec<ExportPlan>,
    snapshot: Option<Project>,
) -> Result<Vec<String>, String> {
    if plans.is_empty() || plans.len() > 6 {
        return Err("Choose between one and six export formats.".into());
    }
    if editor
        .exporting
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("An export is already running.".into());
    }
    let _guard = ExportGuard(&editor.exporting);
    let cancel = Arc::clone(&editor.cancel_export);
    cancel.store(false, Ordering::SeqCst);
    let project = match snapshot { Some(project) => project, None => editor.session.lock().map_err(|e| e.to_string())?.project.clone() };
    let project = checked_export_snapshot(&project_id, project)?;
    for plan in &plans {
        validate_plan(&project, plan)?;
    }
    let binary = ffmpeg().ok_or(
        "Install FFmpeg with libx264 or libx265 to export videos.",
    )?;
    for plan in &plans { check_encoder(&binary, &plan.options)?; }
    let Some(folder) = rfd::AsyncFileDialog::new()
        .set_title("Choose a folder for your exports")
        .pick_folder()
        .await
    else {
        return Ok(vec![]);
    };
    let directory = folder.path().to_path_buf();
    let asset_directory = asset_store_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let total = plans.len() as f64;
        let mut written = Vec::new();
        for (index, plan) in plans.into_iter().enumerate() {
            if cancel.load(Ordering::SeqCst) {
                return Err("Export cancelled.".into());
            }
            check_encoder(&binary, &plan.options)?;
            let filename = export_output_name(&plan.options);
            let destination = directory.join(filename);
            let progress_app = app.clone();
            guard("encoding a video", || {
                encode_plan(&project, plan, binary.clone(), destination.clone(), &asset_directory, Arc::clone(&cancel), move |percent| {
                    let overall = ((index as f64 + percent as f64 / 100.0) / total * 100.0).clamp(0.0, 99.0) as u8;
                    let _ = progress_app.emit("export-progress", overall);
                })
            })?;
            written.push(destination.to_string_lossy().to_string());
        }
        Ok(written)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn write_audio(dir: &Path, clip: &AudioClip, index: usize, asset_dir: &Path) -> Result<PathBuf, String> {
    if let Some(id) = clip.data.strip_prefix("pixcut-asset:") {
        return asset_file(asset_dir, id).ok_or_else(|| "An audio clip is missing from the local store. Relink it and export again.".into());
    }
    let (meta, payload) = clip.data.split_once(',').ok_or("Invalid audio data.")?;
    let mime = meta
        .strip_prefix("data:")
        .and_then(|value| value.strip_suffix(";base64"))
        .ok_or("Invalid audio encoding.")?;
    let extension = match mime {
        "audio/mpeg" | "audio/mp3" => "mp3",
        "audio/wav" | "audio/x-wav" => "wav",
        "audio/mp4" => "m4a",
        "audio/aac" => "aac",
        "audio/ogg" => "ogg",
        "audio/webm" => "webm",
        _ => return Err("Unsupported audio format.".into()),
    };
    let bytes = STANDARD.decode(payload).map_err(|e| e.to_string())?;
    if bytes.len() > 50_000_000 {
        return Err("An audio clip exceeds the 50 MB budget.".into());
    }
    let path = dir.join(format!("audio-{index}.{extension}"));
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path)
}

fn encode_movie(
    project: Project,
    frames: Vec<String>,
    durations: Vec<u64>,
    options: ExportOptions,
    binary: PathBuf,
    destination: PathBuf,
    cancel: Arc<AtomicBool>,
    progress: impl Fn(u8) + Send + 'static,
) -> Result<Option<String>, String> {
    if cancel.load(Ordering::SeqCst) {
        return Err("Export cancelled.".into());
    }
    let temp = tempfile::tempdir().map_err(|e| e.to_string())?;
    let mut list = String::new();
    for (i, (frame, duration)) in frames.iter().zip(durations.iter()).enumerate() {
        if cancel.load(Ordering::SeqCst) {
            return Err("Export cancelled.".into());
        }
        if frame.len() > 120_000_000 {
            return Err("An export frame exceeds the size limit.".into());
        }
        let bytes = STANDARD
            .decode(
                frame
                    .strip_prefix("data:image/png;base64,")
                    .ok_or("Invalid render frame")?,
            )
            .map_err(|e| e.to_string())?;
        if !bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
            return Err("Invalid PNG frame".into());
        }
        fs::write(temp.path().join(format!("frame-{i}.png")), bytes).map_err(|e| e.to_string())?;
        list.push_str(&format!(
            "file 'frame-{i}.png'\nduration {:.6}\n",
            project.timebase.ticks_to_seconds(*duration)
        ));
    }
    list.push_str(&format!("file 'frame-{}.png'\n", frames.len() - 1));
    fs::write(temp.path().join("scenes.txt"), list).map_err(|e| e.to_string())?;
    // Encode beside the destination, then atomically replace it after success.
    let output = tempfile::Builder::new()
        .suffix(&format!(".{}", options.container.extension()))
        .tempfile_in(destination.parent().ok_or("Invalid output path")?)
        .map_err(|e| e.to_string())?;
    let duration = project.timebase.ticks_to_seconds(project.total_ticks());
    let fps = format!("fps={}", options.fps);
    let audio_files = project
        .audio
        .iter()
        .enumerate()
        .map(|(index, clip)| write_audio(temp.path(), clip, index, temp.path()).map(|path| (path, clip)))
        .collect::<Result<Vec<_>, _>>()?;
    let mut command = Process::new(binary);
    command.current_dir(temp.path()).args([
        "-y",
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "1",
        "-i",
        "scenes.txt",
    ]);
    for (index, (path, clip)) in audio_files.iter().enumerate() {
        let clip_duration = project.timebase.ticks_to_seconds(clip.duration_ticks);
        command
            .arg("-ss")
            .arg(format!("{:.6}", clip.source_in_seconds))
            .arg("-t")
            .arg(format!("{clip_duration:.6}"))
            .arg("-i")
            .arg(path);
        let _ = index;
    }
    command.args(video_encoding_args(&options));
    let mut video_filter = format!("scale={}:{}:flags=lanczos,{}", options.width, options.height, fps);
    for clip in project.visual_clips() {
        let clip_start = project.timebase.ticks_to_seconds(clip.start_ticks);
        let clip_end = project.timebase.ticks_to_seconds(clip.start_ticks + clip.duration_ticks);
        let clip_length = (clip_end - clip_start).max(0.001);
        if clip.fade_in > 0.0 {
            let length = clip.fade_in.min(clip_length).max(0.001);
            video_filter.push_str(&format!(",fade=t=in:st={clip_start:.6}:d={length:.6}"));
        }
        if clip.fade_out > 0.0 {
            let length = clip.fade_out.min(clip_length).max(0.001);
            let start = (clip_end - length).max(0.0);
            video_filter.push_str(&format!(",fade=t=out:st={start:.6}:d={length:.6}"));
        }
    }
    command.args(["-vf", &video_filter]);
    if !audio_files.is_empty() {
        let mut filter_nodes = Vec::new();
        for (index, (_, clip)) in audio_files.iter().enumerate() {
            let clip_duration = project.timebase.ticks_to_seconds(clip.duration_ticks);
            let mut node = format!(
                "[{}:a]asetpts=PTS-STARTPTS,aresample=48000,volume={:.3}",
                index + 1,
                clip.volume
            );
            if clip.fade_in > 0.0 {
                node.push_str(&format!(",afade=t=in:st=0:d={:.3}", clip.fade_in.min(clip_duration)));
            }
            if clip.fade_out > 0.0 {
                let start = (clip_duration - clip.fade_out).max(0.0);
                node.push_str(&format!(",afade=t=out:st={start:.3}:d={:.3}", clip.fade_out.min(clip_duration)));
            }
            let delay = (project.timebase.ticks_to_seconds(clip.start_ticks) * 1000.0).round() as u64;
            node.push_str(&format!(",adelay={delay}:all=1[a{}]", index + 1));
            filter_nodes.push(node);
        }
        let mix = if audio_files.len() == 1 {
            "[a1]anull[aout]".to_string()
        } else {
            let inputs: String = (1..=audio_files.len()).map(|index| format!("[a{index}]")).collect();
            format!(
                "{inputs}amix=inputs={}:duration=longest:dropout_transition=0:normalize=0[aout]",
                audio_files.len()
            )
        };
        let filter = format!("{};{mix}", filter_nodes.join(";"));
        command.args(["-filter_complex", filter.as_str(), "-map", "0:v:0", "-map", "[aout]"])
            .args(audio_encoding_args(&options));
    }
    command
        .args(["-progress", "pipe:1", "-nostats", "-t"])
        .arg(format!("{duration:.6}"))
        .arg(output.path())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().ok_or("FFmpeg progress stream is unavailable.")?;
    let stderr = child.stderr.take().ok_or("FFmpeg error stream is unavailable.")?;
    let progress_thread = std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().flatten() {
            let micros = line
                .strip_prefix("out_time_us=")
                .or_else(|| line.strip_prefix("out_time_ms="))
                .and_then(|value| value.trim().parse::<f64>().ok());
            if let Some(micros) = micros {
                let percent = (micros / 1_000_000.0 / duration.max(0.001) * 100.0).clamp(0.0, 99.0) as u8;
                progress(percent);
            }
        }
    });
    let error_thread = std::thread::spawn(move || {
        let mut text = String::new();
        let _ = BufReader::new(stderr).read_to_string(&mut text);
        text
    });
    let status = loop {
        if cancel.load(Ordering::SeqCst) {
            let _ = child.kill();
        }
        match child.try_wait().map_err(|e| e.to_string())? {
            Some(status) => break status,
            None => std::thread::sleep(std::time::Duration::from_millis(120)),
        }
    };
    let _ = progress_thread.join();
    let error = error_thread.join().unwrap_or_default();
    if cancel.load(Ordering::SeqCst) {
        return Err("Export cancelled.".into());
    }
    if !status.success() {
        return Err(format!(
            "FFmpeg export failed: {}",
            error.chars().take(1000).collect::<String>()
        ));
    }
    output.persist(&destination).map_err(|e| e.to_string())?;
    Ok(Some(destination.to_string_lossy().to_string()))
}

pub fn run() {
    let pending = pixcut_path_from_args(std::env::args_os().skip(1));
    let app = tauri::Builder::default()
        // Single-instance must be registered first: a second launch focuses the
        // existing window and hands any .pixcut file to the running editor.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            focus_main_window(app);
            if let Some(path) = pixcut_path_from_args(args) {
                queue_open_project(app, path);
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Editor {
            session: Mutex::new(Session::default()),
            persisted: Mutex::new(Project::default()),
            exporting: AtomicBool::new(false),
            cancel_export: Arc::new(AtomicBool::new(false)),
            pending_open: Mutex::new(pending),
        })
        .invoke_handler(tauri::generate_handler![
            initialize,
            take_pending_project,
            apply_order,
            dispatch,
            save_project,
            save_project_file,
            save_still_frame,
            open_project,
            pick_media,
            import_video,
            import_audio,
            asset_path,
            missing_asset_refs,
            exporter_available,
            exporter_capabilities,
            export_movie,
            export_variants,
            export_plan_variants,
            cancel_export
        ])
        .setup(|app| {
            let menu = build_app_menu(app.handle())?;
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| {
                let _ = app.emit("menu", event.id().0.as_str());
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Unable to start PixCut");
    app.run(|app_handle, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = event {
            if let Some(path) = urls
                .iter()
                .filter_map(|url| url.to_file_path().ok())
                .find(|path| is_pixcut_path(path))
            {
                queue_open_project(app_handle, path);
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = (app_handle, event);
        }
    });
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    fn export_options() -> ExportOptions {
        ExportOptions { width: 1920, height: 1080, fps: 30, crf: 20, filename: "Test export".into(), codec: ExportCodec::H264, container: ExportContainer::Mp4, speed: EncodeSpeed::Medium }
    }
    #[test]
    fn export_codec_container_defaults_and_arguments() {
        let old: ExportOptions = serde_json::from_str(r#"{"width":320,"height":240,"fps":30,"crf":23,"filename":"Story.mp4"}"#).unwrap();
        assert_eq!(old.codec, ExportCodec::H264); assert_eq!(old.container, ExportContainer::Mp4);
        let mut options = old; options.codec = ExportCodec::Hevc; options.container = ExportContainer::Mov;
        assert_eq!(export_output_name(&options), "Story.mov");
        let args = video_encoding_args(&options); assert!(args.iter().any(|a| a == "libx265")); assert!(args.iter().any(|a| a == "hvc1"));
        options.container = ExportContainer::Mkv;
        assert_eq!(export_output_name(&options), "Story.mkv"); assert!(!video_encoding_args(&options).iter().any(|a| a == "-movflags"));
        assert!(serde_json::from_str::<ExportOptions>(r#"{"width":320,"height":240,"fps":30,"crf":23,"filename":"x","codec":"injected"}"#).is_err());
    }
    #[test]
    fn webm_and_prores_options_use_their_own_encoders_and_containers() {
        let mut options = export_options();
        options.codec = ExportCodec::Vp9;
        options.container = ExportContainer::Webm;
        options.filename = "Story.webm".into();
        assert_eq!(export_output_name(&options), "Story.webm");
        assert!(validate_export_options(&options).is_ok());
        let video = video_encoding_args(&options);
        assert!(video.iter().any(|arg| arg == "libvpx-vp9"));
        assert!(video.windows(2).any(|pair| pair == ["-b:v", "0"]));
        assert!(!video.iter().any(|arg| arg == "-preset"));
        assert!(!video.iter().any(|arg| arg == "-movflags"));
        let audio = audio_encoding_args(&options);
        assert!(audio.iter().any(|arg| arg == "libopus"));

        options.codec = ExportCodec::Prores;
        options.container = ExportContainer::Mov;
        options.filename = "Story.mov".into();
        assert_eq!(export_output_name(&options), "Story.mov");
        assert!(validate_export_options(&options).is_ok());
        let video = video_encoding_args(&options);
        assert!(video.iter().any(|arg| arg == "prores_ks"));
        assert!(video.iter().any(|arg| arg == "yuv422p10le"));
        assert!(video.iter().any(|arg| arg == "-movflags"));
        assert!(audio_encoding_args(&options).iter().any(|arg| arg == "pcm_s16le"));

        options.codec = ExportCodec::Vp9;
        assert!(validate_export_options(&options).is_err());
        options.codec = ExportCodec::Prores;
        options.container = ExportContainer::Mp4;
        assert!(validate_export_options(&options).is_err());
        options.codec = ExportCodec::H264;
        options.container = ExportContainer::Webm;
        assert!(validate_export_options(&options).is_err());
    }
    #[test]
    #[ignore = "Requires FFmpeg with libvpx-vp9, libopus, prores_ks and ffprobe installed"]
    fn real_webm_and_prores_exports_match_their_containers() {
        let binary = ffmpeg().expect("FFmpeg is installed");
        let temp = tempfile::tempdir().unwrap();
        for (codec, container, expected_video, expected_audio) in [
            (ExportCodec::Vp9, ExportContainer::Webm, "vp9", "opus"),
            (ExportCodec::Prores, ExportContainer::Mov, "prores", "pcm_s16le"),
        ] {
            let (mut project, frames) = fixture_project();
            project.audio = vec![AudioClip {
                id: "audio-1".into(),
                name: "Bed.wav".into(),
                data: format!("data:audio/wav;base64,{}", STANDARD.encode(wav_silence(1.0))).into(),
                lane: 0,
                start_ticks: 0,
                duration_ticks: 30,
                source_in_seconds: 0.0,
                source_duration_seconds: 1.0,
                volume: 0.8,
                fade_in: 0.0,
                fade_out: 0.0,
            }];
            let mut options = export_options();
            options.width = 320; options.height = 240; options.codec = codec;
            options.container = container; options.speed = EncodeSpeed::Fast;
            options.crf = if codec == ExportCodec::Vp9 { 32 } else { 24 };
            let output = temp.path().join(format!("photo.{}", container.extension()));
            let plan = ExportPlan {
                segments: frames.into_iter().map(|png| PlanSegment {
                    kind: "image".into(), png: Some(png), video: None, source_in_seconds: None,
                    fit: None, speed: None, lut: None, fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio: true, duration_ticks: 15, overlays: vec![],
                }).collect(),
                options: options.clone(),
            };
            encode_plan(&project, plan, binary.clone(), output.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
            let probe = Process::new(binary.with_file_name("ffprobe"))
                .args(["-v","error","-show_entries","stream=codec_type,codec_name:format=format_name,duration","-of","json"])
                .arg(&output)
                .output()
                .unwrap();
            assert!(probe.status.success(), "{}", String::from_utf8_lossy(&probe.stderr));
            let info: serde_json::Value = serde_json::from_slice(&probe.stdout).unwrap();
            let streams = info["streams"].as_array().unwrap();
            let video = streams.iter().find(|stream| stream["codec_type"] == "video").unwrap();
            let audio = streams.iter().find(|stream| stream["codec_type"] == "audio").unwrap();
            assert_eq!(video["codec_name"], expected_video);
            assert_eq!(audio["codec_name"], expected_audio);
            let duration: f64 = info["format"]["duration"].as_str().unwrap().parse().unwrap();
            assert!((duration - 1.0).abs() < 0.08);
        }
    }
    #[test]
    #[ignore = "Requires FFmpeg with libx264, libx265 and ffprobe installed"]
    fn real_hevc_exports_all_containers_and_both_render_paths() {
        let binary = ffmpeg().expect("FFmpeg is installed"); assert!(encoder_available(&binary, ExportCodec::Hevc));
        let temp = tempfile::tempdir().unwrap();
        for container in [ExportContainer::Mp4, ExportContainer::Mov, ExportContainer::Mkv] {
            let (project, frames) = fixture_project();
            let mut options = export_options(); options.width = 320; options.height = 240; options.codec = ExportCodec::Hevc; options.container = container; options.speed = EncodeSpeed::Fast;
            let output = temp.path().join(format!("photo.{}", container.extension()));
            encode_movie(project.clone(), frames.clone(), vec![15,15], options.clone(), binary.clone(), output.clone(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
            let plan = ExportPlan { segments: frames.into_iter().map(|png| PlanSegment { kind: "image".into(), png: Some(png), video: None, source_in_seconds: None, fit: None, speed: None, lut: None, fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio: true, duration_ticks: 15, overlays: vec![] }).collect(), options };
            let plan_output = temp.path().join(format!("plan.{}", container.extension()));
            encode_plan(&project, plan, binary.clone(), plan_output.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
            for file in [output, plan_output] {
                let probe = Process::new("ffprobe").args(["-v","error","-select_streams","v:0","-show_entries","stream=codec_name,width,height:format=duration","-of","json"]).arg(file).output().unwrap();
                assert!(probe.status.success()); let info: serde_json::Value = serde_json::from_slice(&probe.stdout).unwrap();
                assert_eq!(info["streams"][0]["codec_name"], "hevc"); assert_eq!(info["streams"][0]["width"], 320);
                let duration: f64 = info["format"]["duration"].as_str().unwrap().parse().unwrap(); assert!((duration - 1.0).abs() < 0.05);
            }
        }
    }
    #[test]
    fn plan_validates_video_speed_and_grade_lut() {
        let (project, frames) = fixture_project();
        let image = || PlanSegment {
            kind: "image".into(), png: Some(frames[0].clone()), video: None, source_in_seconds: None,
            fit: Some("cover".into()), speed: None, lut: None, fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio: true, duration_ticks: 15, overlays: vec![],
        };
        let video = |speed: Option<f64>, lut: Option<String>| PlanSegment {
            kind: "video".into(), png: None, video: Some("data:video/mp4;base64,AA==".into()),
            source_in_seconds: Some(0.0), fit: Some("cover".into()), speed, lut,
            fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio: true, duration_ticks: 15, overlays: vec![],
        };
        let plan = |second: PlanSegment| ExportPlan { segments: vec![image(), second], options: export_options() };
        assert!(validate_plan(&project, &plan(video(None, None))).is_ok());
        assert!(validate_plan(&project, &plan(video(Some(2.0), Some("LUT_3D_SIZE 2\n".into())))).is_ok());
        assert!(validate_plan(&project, &plan(video(Some(0.1), None))).is_err());
        assert!(validate_plan(&project, &plan(video(Some(9.0), None))).is_err());
        assert!(validate_plan(&project, &plan(video(None, Some("not a lut".into())))).is_err());
        assert!(validate_plan(&project, &plan(video(None, Some(String::new())))).is_err());
    }

    #[test]
    fn plan_rejects_negative_or_non_finite_fades() {
        let (project, frames) = fixture_project();
        let segment = |fade_in: f64, fade_out: f64| PlanSegment {
            kind: "image".into(), png: Some(frames[0].clone()), video: None, source_in_seconds: None,
            fit: None, speed: None, lut: None, fade_in, fade_out, video_volume: None, include_audio: true, duration_ticks: 15, overlays: vec![],
        };
        let plan = |first: PlanSegment, second: PlanSegment| ExportPlan { segments: vec![first, second], options: export_options() };
        assert!(validate_plan(&project, &plan(segment(0.25, 0.25), segment(0.25, 0.25))).is_ok());
        assert!(validate_plan(&project, &plan(segment(-0.1, 0.0), segment(0.0, 0.0))).is_err());
        assert!(validate_plan(&project, &plan(segment(0.0, f64::NAN), segment(0.0, 0.0))).is_err());
        assert!(validate_plan(&project, &plan(segment(0.0, f64::INFINITY), segment(0.0, 0.0))).is_err());
    }

    #[test]
    fn tempo_chain_uses_supported_steps_and_keeps_the_speed() {
        assert_eq!(atempo_chain(1.0), "atempo=1.000000");
        assert_eq!(atempo_chain(2.0), "atempo=2.000000");
        assert_eq!(atempo_chain(4.0), "atempo=2.000000,atempo=2.000000");
        assert_eq!(atempo_chain(0.5), "atempo=0.500000");
        assert_eq!(atempo_chain(0.25), "atempo=0.500000,atempo=0.500000");
        for speed in [0.3, 0.75, 1.5, 2.5, 3.0] {
            let steps: Vec<f64> = atempo_chain(speed)
                .split(',')
                .map(|step| step.trim_start_matches("atempo=").parse::<f64>().unwrap())
                .collect();
            let product: f64 = steps.iter().product();
            assert!((product - speed).abs() < 1e-5, "speed {speed} became {steps:?}");
            assert!(steps.iter().all(|step| (0.5..=2.0).contains(step)), "out-of-range step in {steps:?}");
        }
    }

    #[test]
    #[ignore = "Requires FFmpeg with libx264, aac and ffprobe installed"]
    fn plan_export_keeps_imported_video_audio() {
        let binary = ffmpeg().expect("FFmpeg must be installed for this test");
        assert!(encoder_available(&binary, ExportCodec::H264));
        let temp = tempfile::tempdir().unwrap();
        let clip = temp.path().join("tone.mp4");
        let status = Process::new(&binary)
            .args([
                "-y", "-v", "error",
                "-f", "lavfi", "-i", "testsrc=size=320x240:rate=30",
                "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
                "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-shortest",
            ])
            .arg(&clip)
            .status()
            .unwrap();
        assert!(status.success());
        assert!(has_audio_stream(&binary, &clip), "the fixture clip must carry audio");
        let silent = temp.path().join("silent.mp4");
        let silent_status = Process::new(&binary)
            .args(["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=320x240:r=30:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p"])
            .arg(&silent)
            .status()
            .unwrap();
        assert!(silent_status.success());
        assert!(!has_audio_stream(&binary, &silent));

        let video = format!("data:video/mp4;base64,{}", STANDARD.encode(fs::read(&clip).unwrap()));
        let (mut project, frames) = fixture_project();
        // A music bed plus ducking exercises the volume expression in the graph.
        project.audio = vec![AudioClip {
            id: "music".into(),
            name: "Bed.wav".into(),
            data: format!("data:audio/wav;base64,{}", STANDARD.encode(wav_silence(1.0))).into(),
            lane: 0,
            start_ticks: 0,
            duration_ticks: 30,
            source_in_seconds: 0.0,
            source_duration_seconds: 1.0,
            volume: 0.8,
            fade_in: 0.0,
            fade_out: 0.0,
        }];
        project.ducking = Some(60.0);
        let plan = |include_audio: bool| ExportPlan {
            segments: vec![
                PlanSegment {
                    kind: "video".into(), png: None, video: Some(video.clone()), source_in_seconds: Some(0.0),
                    fit: Some("cover".into()), speed: None, lut: None, fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio,
                    duration_ticks: 15, overlays: vec![],
                },
                PlanSegment {
                    kind: "image".into(), png: Some(frames[0].clone()), video: None, source_in_seconds: None,
                    fit: Some("cover".into()), speed: None, lut: None, fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio,
                    duration_ticks: 15, overlays: vec![],
                },
            ],
            options: export_options(),
        };
        let output = temp.path().join("video-audio.mp4");
        encode_plan(&project, plan(true), binary.clone(), output.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
        let probe = Process::new(binary.with_file_name("ffprobe"))
            .args(["-v", "error", "-show_entries", "stream=codec_type", "-of", "json"])
            .arg(&output)
            .output()
            .unwrap();
        assert!(probe.status.success(), "{}", String::from_utf8_lossy(&probe.stderr));
        let info: serde_json::Value = serde_json::from_slice(&probe.stdout).unwrap();
        assert!(info["streams"].as_array().unwrap().iter().any(|stream| stream["codec_type"] == "audio"));
        let volume = Process::new(&binary)
            .args(["-hide_banner", "-nostats", "-i"])
            .arg(&output)
            .args(["-af", "volumedetect", "-f", "null", "-"])
            .output()
            .unwrap();
        let log = String::from_utf8_lossy(&volume.stderr);
        let mean = log.lines().find(|line| line.contains("mean_volume:")).unwrap_or("mean_volume: -inf dB");
        let db: f64 = mean.split("mean_volume:").nth(1).unwrap_or(" -inf ").split("dB").next().unwrap_or(" -inf ").trim().parse().unwrap_or(-100.0);
        assert!(db > -40.0, "expected the imported tone, got {mean}");

        // The export dialog's include-audio switch also drops the music bed.
        project.audio.clear();
        project.ducking = None;
        let muted = temp.path().join("video-muted.mp4");
        encode_plan(&project, plan(false), binary.clone(), muted.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
        let muted_probe = Process::new(binary.with_file_name("ffprobe"))
            .args(["-v", "error", "-show_entries", "stream=codec_type", "-of", "json"])
            .arg(&muted)
            .output()
            .unwrap();
        assert!(muted_probe.status.success(), "{}", String::from_utf8_lossy(&muted_probe.stderr));
        let muted_info: serde_json::Value = serde_json::from_slice(&muted_probe.stdout).unwrap();
        assert!(!muted_info["streams"].as_array().unwrap().iter().any(|stream| stream["codec_type"] == "audio"));
    }

    #[test]
    #[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
    fn real_video_export_applies_grade_fade_and_speed() {
        let binary = ffmpeg().expect("FFmpeg is installed");
        assert!(encoder_available(&binary, ExportCodec::H264));
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("source.mp4");
        let status = Process::new(&binary)
            .args(["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=red:s=320x240:r=30:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p"])
            .arg(&source).status().unwrap();
        assert!(status.success());
        let video = format!("data:video/mp4;base64,{}", STANDARD.encode(fs::read(&source).unwrap()));
        let (mut project, _) = fixture_project();
        project.tracks[0].clips.truncate(1);
        project.tracks[0].clips[0].media_kind = Some("video".into());
        project.tracks[0].clips[0].image = video.clone().into();
        project.tracks[0].clips[0].duration_ticks = 15;
        project.tracks[0].clips[0].speed = 2.0;
        project.tracks[0].clips[0].fade_in = 0.2;
        // A 2-point LUT that maps every input colour to white proves the cube reaches FFmpeg.
        let mut lut = String::from("LUT_3D_SIZE 2\n");
        for _ in 0..8 { lut.push_str("1.000000 1.000000 1.000000\n"); }
        let mut options = export_options();
        options.width = 320; options.height = 240; options.speed = EncodeSpeed::Fast; options.filename = "graded.mp4".into();
        let plan = ExportPlan {
            segments: vec![PlanSegment {
                kind: "video".into(), png: None, video: Some(video), source_in_seconds: Some(0.0),
                fit: Some("cover".into()), speed: Some(2.0), lut: Some(lut),
                fade_in: 0.0, fade_out: 0.0, video_volume: None, include_audio: true, duration_ticks: 15, overlays: vec![],
            }],
            options,
        };
        let output = temp.path().join("graded.mp4");
        encode_plan(&project, plan, binary.clone(), output.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
        let probe = Process::new(&binary).args(["-hide_banner", "-i"]).arg(&output).output().unwrap();
        let text = String::from_utf8_lossy(&probe.stderr);
        assert!(text.contains("Duration: 00:00:00.50"), "{text}");
        let pixel_at = |seconds: &str| {
            let result = Process::new(&binary).args(["-v", "error", "-ss", seconds, "-i"]).arg(&output)
                .args(["-frames:v", "1", "-vf", "crop=2:2:0:0,format=rgb24", "-f", "rawvideo", "-"])
                .output().unwrap();
            assert!(result.status.success());
            result.stdout
        };
        let faded = pixel_at("0.02");
        let graded = pixel_at("0.4");
        assert!(faded[0] < 140, "fade-in should darken the first frame: {faded:?}");
        assert!(graded[0] > 240 && graded[1] > 240 && graded[2] > 240, "the LUT should turn the red clip white: {graded:?}");
    }

    fn fixture_project() -> (Project, Vec<String>) {
        let frames: Vec<String> = [
            include_bytes!("../../tests/fixtures/red.png").as_slice(),
            include_bytes!("../../tests/fixtures/green.png").as_slice(),
        ]
        .iter()
        .map(|bytes| format!("data:image/png;base64,{}", STANDARD.encode(bytes)))
        .collect();
        let mut p = Project::default();
        p.tracks[0].clips = frames
            .iter()
            .enumerate()
            .map(|(i, frame)| pixcut_project::Scene {
                media_kind: None,
                video_poster: None,
                elements: vec![],
                motion: None,
                motion_amount: None,
                id: i.to_string(),
                name: "Fixture".into(),
                image: frame.as_str().into(),
                start_ticks: i as u64 * 15,
                source_in_ticks: 0,
                source_duration_seconds: None,
                duration_ticks: 15,
                legacy_duration: None,
                title: "".into(),
                subtitle: "".into(),
                text_layers: vec![],
                transition: None,
                color: "#ffffff".into(),
                fit: "cover".into(),
                image_x: 0.0,
                image_y: 0.0,
                image_zoom: 1.0,
                framing_keyframes: vec![],
                mask: None,
                framing_background: "#000000".into(),
                brightness: 1.0,
                contrast: 1.0,
                saturation: 1.0,
                exposure: 0.0,
                highlights: 0.0,
                shadows: 0.0,
                temperature: 0.0,
                tint: 0.0,
                hue: 0.0,
                vibrance: 0.0,
                shadow_tint_color: "#000000".into(),
                shadow_tint_amount: 0.0,
                highlight_tint_color: "#000000".into(),
                highlight_tint_amount: 0.0,
                filter: "none".into(),
                filter_intensity: 100.0,
                speed: 1.0,
                pitch: true,
                video_volume: None,
                fade_in: 0.0,
                fade_out: 0.0,
                text_backdrop_enabled: false,
                text_backdrop_color: "#000000".into(),
                text_backdrop_opacity: 45.0,
                text_backdrop_blur: 18.0,
                text_backdrop_padding: 24.0,
                text_backdrop_radius: 16.0,
                text_backdrop_noise: 8.0,
                text_stroke_color: "#000000".into(),
                text_outline_enabled: false,
                text_stroke_width: 0.0,
                text_shadow_color: "#000000".into(),
                text_shadow_enabled: false,
                text_shadow_intensity: 60.0,
                text_shadow_blur: 0.0,
                text_shadow_offset_x: 0.0,
                text_shadow_offset_y: 0.0,
                text_glow_enabled: false,
                text_glow_color: "#FFFFFF".into(),
                text_glow_blur: 24.0,
                text_glow_intensity: 55.0,
                text_x: 0.09,
                text_y: 0.78,
                text_width: 0.82,
                text_align: "left".into(),
                text_font: "inter".into(),
                text_font_weight: 600.0,
                text_font_style: "normal".into(),
                text_size: 0.068,
                text_line_height: 1.2,
                text_letter_spacing: 0.0,
                text_rotation: 0.0,
                text_opacity: 100.0,
                text_subtitle_scale: 0.4,
            })
            .collect();
        p.formats = vec![pixcut_project::FormatVariant {
            id: "format-original".into(),
            name: "Original".into(),
            platform: "Original".into(),
            aspect: "16:9".into(),
            width: 1920,
            height: 1080,
            fps: 30,
            quality: "standard".into(),
            preset_id: None,
            overrides: Default::default(),
        }];
        (p, frames)
    }
    #[test]
    fn project_save_roundtrips_and_replaces_atomically() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("project.json");
        let (mut p, _) = fixture_project();
        atomic_write(&path, &p).unwrap();
        assert_eq!(read_project(&path).unwrap(), p);
        p.name = "Changed".into();
        atomic_write(&path, &p).unwrap();
        assert_eq!(read_project(&path).unwrap().name, "Changed");
    }
    #[test]
    fn invalid_export_preserves_existing_destination() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("movie.mp4");
        fs::write(&path, b"original movie").unwrap();
        let (p, _) = fixture_project();
        assert!(encode_movie(p, vec!["invalid".into(); 2], vec![15, 15], export_options(), "ffmpeg".into(), path.clone(), Arc::new(AtomicBool::new(false)), |_| {}).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"original movie");
    }
    #[test]
    fn guard_turns_a_panic_into_a_friendly_error() {
        let error = guard("testing", || -> Result<(), String> { panic!("boom") }).unwrap_err();
        assert!(error.contains("recovered"), "{error}");
        assert!(error.contains("boom"), "{error}");
        assert!(error.contains("still saved"), "{error}");
    }

    #[test]
    fn cancelled_export_writes_nothing() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("movie.mp4");
        let (p, frames) = fixture_project();
        let error = encode_movie(
            p,
            frames,
            vec![15, 15],
            export_options(),
            "ffmpeg".into(),
            path.clone(),
            Arc::new(AtomicBool::new(true)),
            |_| {},
        )
        .unwrap_err();
        assert!(error.contains("cancelled"), "{error}");
        assert!(!path.exists());
    }

    #[test]
    fn video_assets_roundtrip_through_the_local_store() {
        let temp = tempfile::tempdir().unwrap();
        let (mut p, _) = fixture_project();
        p.tracks[0].clips[0].image = "data:video/mp4;base64,AAAA".into();
        p.tracks[0].clips[0].media_kind = Some("video".into());
        persist_project(temp.path(), &mut p).unwrap();
        assert!(p.tracks[0].clips[0].image.starts_with("pixcut-asset:"));
        // The editor keeps imported video on disk and serves it through the
        // asset protocol; a full hydration still returns the original data.
        hydrate_project(temp.path(), &mut p, true).unwrap();
        assert!(p.tracks[0].clips[0].image.starts_with("pixcut-asset:"));
        assert_eq!(p.tracks[0].clips[0].media_kind.as_deref(), Some("video"));
        hydrate_project(temp.path(), &mut p, false).unwrap();
        assert_eq!(p.tracks[0].clips[0].image.as_ref(), "data:video/mp4;base64,AAAA");
    }

    #[test]
    fn second_instance_routes_only_project_paths() {
        assert_eq!(pixcut_path_from_args(["/Applications/PixCut.app/Contents/MacOS/pixcut"]), None);
        assert_eq!(pixcut_path_from_args(["--flag", "/tmp/notes.txt"]), None);
        assert_eq!(
            pixcut_path_from_args(["/Applications/PixCut.app/Contents/MacOS/pixcut", "/tmp/Story.PIXCUT"]),
            Some(PathBuf::from("/tmp/Story.PIXCUT"))
        );
    }

    #[test]
    fn project_filename_is_safe_and_bounded() {        assert_eq!(safe_filename("A little further"), "A little further");
        assert_eq!(safe_filename("../../etc/passwd"), "etcpasswd");
        assert_eq!(safe_filename("   "), "PixCut project");
        assert_eq!(safe_filename(&"x".repeat(200)).chars().count(), 120);
    }

    #[test]
    fn asset_file_finds_streamed_media_and_rejects_bad_ids() {
        let temp = tempfile::tempdir().unwrap();
        let bytes = b"streamed video bytes";
        let id = asset_hash(bytes);
        fs::write(temp.path().join(format!("{id}.mp4")), bytes).unwrap();
        let found = asset_file(temp.path(), &id).expect("stored asset is found");
        assert!(found.ends_with(format!("{id}.mp4")));
        assert!(asset_file(temp.path(), "../escape").is_none());
        assert!(asset_file(temp.path(), &"z".repeat(64)).is_none());
        assert!(asset_file(temp.path(), &id[..63]).is_none());
    }

    #[test]
    #[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
    fn plan_export_reads_streamed_video_assets() {
        let binary = ffmpeg().expect("FFmpeg is installed");
        assert!(encoder_available(&binary, ExportCodec::H264));
        let temp = tempfile::tempdir().unwrap();
        let clip = temp.path().join("source.mp4");
        let status = Process::new(&binary)
            .args(["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=30", "-t", "1", "-pix_fmt", "yuv420p"])
            .arg(&clip)
            .status()
            .unwrap();
        assert!(status.success());
        let bytes = fs::read(&clip).unwrap();
        let id = asset_hash(&bytes);
        let store = temp.path().join("store");
        fs::create_dir_all(&store).unwrap();
        fs::write(store.join(format!("{id}.mp4")), &bytes).unwrap();

        let audio_bytes = wav_silence(1.0);
        let audio_id = asset_hash(&audio_bytes);
        fs::write(store.join(format!("{audio_id}.wav")), &audio_bytes).unwrap();
        let (mut project, frames) = fixture_project();
        project.audio = vec![AudioClip {
            id: "streamed-audio".into(),
            name: "Bed.wav".into(),
            data: format!("pixcut-asset:{audio_id}").into(),
            lane: 0,
            start_ticks: 0,
            duration_ticks: 30,
            source_in_seconds: 0.0,
            source_duration_seconds: 1.0,
            volume: 0.8,
            fade_in: 0.0,
            fade_out: 0.0,
        }];
        let plan = ExportPlan {
            segments: vec![
                PlanSegment {
                    kind: "video".into(), png: None, video: Some(format!("pixcut-asset:{id}")), source_in_seconds: Some(0.0),
                    fit: Some("cover".into()), speed: None, lut: None, fade_in: 0.0, fade_out: 0.0, video_volume: None,
                    include_audio: true, duration_ticks: 15, overlays: vec![],
                },
                PlanSegment {
                    kind: "image".into(), png: Some(frames[0].clone()), video: None, source_in_seconds: None,
                    fit: Some("cover".into()), speed: None, lut: None, fade_in: 0.0, fade_out: 0.0, video_volume: None,
                    include_audio: true, duration_ticks: 15, overlays: vec![],
                },
            ],
            options: export_options(),
        };
        validate_plan(&project, &plan).unwrap();
        let output = temp.path().join("streamed.mp4");
        encode_plan(&project, plan, binary.clone(), output.clone(), &store, Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
        let probe = Process::new(binary.with_file_name("ffprobe"))
            .args(["-v", "error", "-show_entries", "stream=codec_type,width,height", "-of", "json"])
            .arg(&output)
            .output()
            .unwrap();
        assert!(probe.status.success(), "{}", String::from_utf8_lossy(&probe.stderr));
        let info: serde_json::Value = serde_json::from_slice(&probe.stdout).unwrap();
        let video = info["streams"].as_array().unwrap().iter().find(|stream| stream["codec_type"] == "video").unwrap();
        assert_eq!(video["width"], 1920);
        assert_eq!(video["height"], 1080);
        assert!(info["streams"].as_array().unwrap().iter().any(|stream| stream["codec_type"] == "audio"));
    }

    #[test]
    fn ducking_expression_targets_video_windows() {
        let expression = ducking_expression(&[(2.0, 4.0)], 1.0, 60.0);
        assert!(expression.starts_with("1-0.600000*max(0,"), "{expression}");
        assert!(expression.contains("t+1.000000-2.000000"), "{expression}");
        assert!(expression.contains("4.000000-(t+1.000000)"), "{expression}");
        let two = ducking_expression(&[(2.0, 4.0), (6.0, 8.0)], 0.0, 50.0);
        assert_eq!(two.matches("min(max(").count(), 4);
        assert!(!two.contains("clip("));
        assert!(ducking_expression(&[(2.0, 4.0)], 0.0, 0.0).starts_with("1-0.000000*max(0,"));
    }

    #[test]
    fn still_frames_accept_only_png_and_jpeg_payloads() {
        assert_eq!(still_frame_extension("image/png"), Some("png"));
        assert_eq!(still_frame_extension("image/jpeg"), Some("jpg"));
        assert_eq!(still_frame_extension("image/webp"), None);
        assert_eq!(still_frame_extension("audio/mpeg"), None);
        let (mime, bytes) = parse_data_url("data:image/png;base64,iVBORw0KGgo=").unwrap();
        assert_eq!(still_frame_extension(mime), Some("png"));
        assert_eq!(bytes.len(), 8);
    }
    #[test]
    fn legacy_project_file_migrates_without_mutating_source() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("legacy.json");
        let legacy = serde_json::json!({
            "schema_version": 1,
            "id": "legacy",
            "name": "Legacy",
            "aspect": "16:9",
            "scenes": [{
                "id": "one",
                "name": "Photo",
                "image": "data:image/png;base64,AA==",
                "duration": 4.0,
                "title": "",
                "subtitle": "",
                "color": "#ffffff",
                "fit": "cover"
            }],
            "policy": { "watermark": false, "pixcut_outro": false, "privacy": "local" }
        });
        fs::write(&path, serde_json::to_vec(&legacy).unwrap()).unwrap();
        let before = fs::read_to_string(&path).unwrap();
        let (project, migrated) = read_project_with_migration(&path).unwrap();
        assert!(migrated);
        assert_eq!(project.schema_version, 13);
        assert_eq!(project.visual_clips()[0].duration_ticks, 120);
        assert_eq!(fs::read_to_string(&path).unwrap(), before);
    }
    fn wav_silence(seconds: f32) -> Vec<u8> {
        let sample_rate = 8_000u32;
        let samples = (sample_rate as f32 * seconds) as u32;
        let data_len = samples * 2;
        let mut bytes = Vec::with_capacity(44 + data_len as usize);
        bytes.extend(b"RIFF");
        bytes.extend(&(36 + data_len).to_le_bytes());
        bytes.extend(b"WAVEfmt ");
        bytes.extend(&16u32.to_le_bytes());
        bytes.extend(&1u16.to_le_bytes());
        bytes.extend(&1u16.to_le_bytes());
        bytes.extend(&sample_rate.to_le_bytes());
        bytes.extend(&(sample_rate * 2).to_le_bytes());
        bytes.extend(&2u16.to_le_bytes());
        bytes.extend(&16u16.to_le_bytes());
        bytes.extend(b"data");
        bytes.extend(&data_len.to_le_bytes());
        bytes.extend(vec![0u8; data_len as usize]);
        bytes
    }
    #[test]
    #[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
    fn plan_export_encodes_video_and_image_segments() {
        let binary = ffmpeg().expect("FFmpeg must be installed for this test");
        let temp = tempfile::tempdir().unwrap();
        let clip = temp.path().join("clip.mp4");
        let status = Process::new(&binary)
            .args(["-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=30", "-t", "1", "-pix_fmt", "yuv420p"])
            .arg(&clip)
            .status()
            .unwrap();
        assert!(status.success());
        let video = format!(
            "data:video/mp4;base64,{}",
            STANDARD.encode(fs::read(&clip).unwrap())
        );
        let overlay_path = temp.path().join("overlay.png");
        let overlay_status = Process::new(&binary)
            .args(["-y", "-f", "lavfi", "-i", "color=c=black@0.0:s=640x360", "-frames:v", "1"])
            .arg(&overlay_path)
            .status()
            .unwrap();
        assert!(overlay_status.success());
        let overlay = format!(
            "data:image/png;base64,{}",
            STANDARD.encode(fs::read(&overlay_path).unwrap())
        );
        let red_path = temp.path().join("red-overlay.png");
        let red_status = Process::new(&binary)
            .args(["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=red:s=640x360", "-frames:v", "1"])
            .arg(&red_path).status().unwrap();
        assert!(red_status.success());
        let red_overlay = format!("data:image/png;base64,{}", STANDARD.encode(fs::read(red_path).unwrap()));
        let (mut project, frames) = fixture_project();
        project.tracks[0].clips[1].media_kind = Some("video".into());
        let plan = ExportPlan {
            segments: vec![
                PlanSegment {
                    kind: "image".into(),
                    png: Some(frames[0].clone()),
                    video: None,
                    source_in_seconds: None,
                    fit: Some("cover".into()),
                    speed: None,
                    lut: None,
                    fade_in: 0.0,
                    fade_out: 0.0,
                    video_volume: None,
                    include_audio: true,
                    duration_ticks: 15,
                    overlays: vec![],
                },
                PlanSegment {
                    kind: "video".into(),
                    png: None,
                    video: Some(video),
                    source_in_seconds: Some(0.0),
                    fit: Some("cover".into()),
                    speed: None,
                    lut: None,
                    fade_in: 0.0,
                    fade_out: 0.0,
                    video_volume: None,
                    include_audio: true,
                    duration_ticks: 15,
                    overlays: vec![PlanOverlay { png: overlay.clone(), frames: (0..15).map(|index| if index < 7 { overlay.clone() } else { red_overlay.clone() }).collect(), start_ticks: 15, duration_ticks: 15 }],
                },
            ],
            options: export_options(),
        };
        let output = temp.path().join("plan.mp4");
        encode_plan(&project, plan, binary.clone(), output.clone(), temp.path(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
        assert!(output.exists());
        let probe = Process::new(&binary)
            .args(["-hide_banner", "-i"])
            .arg(&output)
            .output()
            .unwrap();
        let text = String::from_utf8_lossy(&probe.stderr);
        assert!(text.contains("Video: h264"), "{text}");
        assert!(text.contains("Duration: 00:00:01.00"), "{text}");
        // The overlay sequence begins at the video cut, not at the project origin.
        let pixel_at = |seconds: &str| {
            let result = Process::new(&binary).args(["-v", "error", "-ss", seconds, "-i"])
                .arg(&output).args(["-frames:v", "1", "-vf", "crop=2:2:0:0,format=rgb24", "-f", "rawvideo", "-"])
                .output().unwrap();
            assert!(result.status.success());
            result.stdout
        };
        let early = pixel_at("0.55");
        let late = pixel_at("0.85");
        assert!(early.len() >= 3 && late.len() >= 3);
        assert!(early[0] < 40, "first overlay frame should be black: {early:?}");
        assert!(late[0] > 180 && late[1] < 60, "later overlay frame should be red: {late:?}");
    }

    #[test]
    #[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
    fn real_mp4_includes_multiple_audio_clips() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("music.mp4");
        let (mut project, frames) = fixture_project();
        project.audio = vec![AudioClip {
            id: "audio-1".into(),
            name: "Bed.wav".into(),
            data: format!(
                "data:audio/wav;base64,{}",
                STANDARD.encode(wav_silence(1.0))
            )
            .into(),
            lane: 0,
            start_ticks: 0,
            duration_ticks: 15,
            source_in_seconds: 0.0,
            source_duration_seconds: 1.0,
            volume: 0.8,
            fade_in: 0.2,
            fade_out: 0.2,
        }, AudioClip {
            id: "audio-2".into(),
            name: "Bed 2.wav".into(),
            data: format!(
                "data:audio/wav;base64,{}",
                STANDARD.encode(wav_silence(1.0))
            )
            .into(),
            lane: 0,
            start_ticks: 15,
            duration_ticks: 15,
            source_in_seconds: 0.2,
            source_duration_seconds: 1.0,
            volume: 0.6,
            fade_in: 0.0,
            fade_out: 0.1,
        }];
        let binary = ffmpeg().expect("FFmpeg must be installed for this test");
        encode_movie(project, frames, vec![15, 15], export_options(), binary.clone(), path.clone(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
        let result = Process::new(binary.with_file_name("ffprobe"))
            .args([
                "-v",
                "error",
                "-select_streams",
                "a:0",
                "-show_entries",
                "stream=codec_name,channels",
                "-of",
                "json",
            ])
            .arg(path)
            .output()
            .unwrap();
        assert!(result.status.success());
        let info: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
        assert_eq!(info["streams"][0]["codec_name"], "aac");
        assert_eq!(info["streams"][0]["channels"], 1);
    }
    #[test]
    fn project_bundle_roundtrips_with_binary_assets() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("story.pixcut");
        let (mut project, _) = fixture_project();
        project.audio = vec![AudioClip {
            id: "audio-1".into(),
            name: "Bed.wav".into(),
            data: format!(
                "data:audio/wav;base64,{}",
                STANDARD.encode(wav_silence(1.0))
            )
            .into(),
            lane: 0,
            start_ticks: 0,
            duration_ticks: 15,
            source_in_seconds: 0.0,
            source_duration_seconds: 1.0,
            volume: 0.8,
            fade_in: 0.2,
            fade_out: 0.2,
        }, AudioClip {
            id: "audio-2".into(),
            name: "Bed 2.wav".into(),
            data: format!(
                "data:audio/wav;base64,{}",
                STANDARD.encode(wav_silence(1.0))
            )
            .into(),
            lane: 0,
            start_ticks: 15,
            duration_ticks: 15,
            source_in_seconds: 0.2,
            source_duration_seconds: 1.0,
            volume: 0.6,
            fade_in: 0.0,
            fade_out: 0.1,
        }];
        write_project_bundle(&path, &project, None).unwrap();
        let manifest_text = {
            let file = fs::File::open(&path).unwrap();
            let mut archive = ZipArchive::new(file).unwrap();
            let mut text = String::new();
            archive
                .by_name("manifest.json")
                .unwrap()
                .read_to_string(&mut text)
                .unwrap();
            text
        };
        assert!(!manifest_text.contains("data:image"));
        assert!(!manifest_text.contains("data:audio"));
        assert!(manifest_text.contains("pixcut-asset:"));
        let manifest: BundleManifest = serde_json::from_str(&manifest_text).unwrap();
        assert_eq!(manifest.format, "pixcut");
        assert_eq!(manifest.assets.len(), 3);
        assert_eq!(read_project_bundle(&path).unwrap(), project);
    }
    #[test]
    fn captured_export_is_independent_of_later_edits_or_new_projects() {
        let (project, _) = fixture_project(); let frozen = checked_export_snapshot(&project.id, project.clone()).unwrap();
        let mut editor = pixcut_project::Session { project, ..Default::default() };
        editor.apply(Command::Rename { name: "Working version".into() }).unwrap();
        let mut other = Project::default(); other.id = "another-project".into();
        editor.apply(Command::Replace { project: other }).unwrap();
        assert_ne!(editor.project.id, frozen.id);
        assert!(checked_export_snapshot(&frozen.id, frozen.clone()).is_ok());
        assert!(checked_export_snapshot("wrong-id", frozen).is_err());
    }
    #[test]
    fn custom_overlays_roundtrip_in_bundle_and_local_store() {
        let temp = tempfile::tempdir().unwrap();
        let (mut project, _) = fixture_project();
        let source = project.visual_clips()[0].image.clone();
        let overlay = serde_json::json!({"id":"overlay", "kind":"image", "source":source, "loop":true, "animationDuration":0.8, "x":0.7,"y":0.3,"width":0.3,"height":0.2,"rotation":0,"color":"#FFFFFF","opacity":100,"startTicks":0,"durationTicks":15,"animation":"float"});
        project.tracks[0].clips[0].elements = vec![serde_json::from_value(overlay).unwrap()];
        project.overlays = project.tracks[0].clips[0].elements.clone();
        project.overlays[0].id = "global-overlay".into();
        project.audio = vec![AudioClip {
            id: "audio-1".into(),
            name: "Bed.wav".into(),
            data: format!("data:audio/wav;base64,{}", STANDARD.encode(wav_silence(1.0))).into(),
            lane: 0,
            start_ticks: 0,
            duration_ticks: 15,
            source_in_seconds: 0.0,
            source_duration_seconds: 1.0,
            volume: 0.8,
            fade_in: 0.0,
            fade_out: 0.0,
        }];
        project.validate().unwrap();
        let path = temp.path().join("overlay.pixcut");
        write_project_bundle(&path, &project, None).unwrap();
        assert_eq!(read_project_bundle(&path).unwrap(), project);
        let original = project.clone();
        let directory = temp.path().join("assets");
        persist_project(&directory, &mut project).unwrap();
        assert!(project.tracks[0].clips[0].elements[0].source.as_ref().unwrap().starts_with("pixcut-asset:"));
        assert!(project.overlays[0].source.as_ref().unwrap().starts_with("pixcut-asset:"));
        hydrate_project(&directory, &mut project, true).unwrap();
        hydrate_project(&directory, &mut project, false).unwrap();
        assert_eq!(project, original);
    }
    #[test]
    fn video_overlay_assets_keep_their_mime_when_reopened() {
        for mime in ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"] {
            let temp = tempfile::tempdir().unwrap();
            let (mut project, _) = fixture_project();
            let source = format!("data:{mime};base64,{}", STANDARD.encode(b"local-video-test"));
            project.tracks[0].clips[0].elements = vec![serde_json::from_value(serde_json::json!({"id":"video", "kind":"video", "source":source, "x":0.7,"y":0.3,"width":0.3,"height":0.2,"rotation":0,"color":"#FFFFFF","opacity":100,"startTicks":0,"durationTicks":15,"animation":"none"})).unwrap()];
            project.validate().unwrap(); let original = project.clone();
            let path = temp.path().join("video.pixcut");
            write_project_bundle(&path, &project, None).unwrap();
            assert_eq!(read_project_bundle(&path).unwrap(), original);
            persist_project(temp.path(), &mut project).unwrap();
            hydrate_project(temp.path(), &mut project, true).unwrap();
            assert_eq!(project, original);
        }
    }
    #[test]
    fn project_bundle_deduplicates_identical_assets() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("duplicate.pixcut");
        let (mut project, _) = fixture_project();
        let shared = project.visual_clips()[0].image.clone();
        project.tracks[0].clips[1].image = shared;
        write_project_bundle(&path, &project, None).unwrap();
        let manifest_text = {
            let file = fs::File::open(&path).unwrap();
            let mut archive = ZipArchive::new(file).unwrap();
            let mut text = String::new();
            archive
                .by_name("manifest.json")
                .unwrap()
                .read_to_string(&mut text)
                .unwrap();
            text
        };
        let manifest: BundleManifest = serde_json::from_str(&manifest_text).unwrap();
        assert_eq!(manifest.assets.len(), 1);
        assert_eq!(read_project_bundle(&path).unwrap(), project);
    }
    #[test]
    fn local_asset_store_roundtrips_and_deduplicates() {
        let temp = tempfile::tempdir().unwrap();
        let directory = temp.path().join("assets");
        let (mut project, _) = fixture_project();
        project.audio = vec![AudioClip {
            id: "audio-1".into(),
            name: "Bed.wav".into(),
            data: format!(
                "data:audio/wav;base64,{}",
                STANDARD.encode(wav_silence(1.0))
            )
            .into(),
            lane: 0,
            start_ticks: 0,
            duration_ticks: 15,
            source_in_seconds: 0.0,
            source_duration_seconds: 1.0,
            volume: 0.8,
            fade_in: 0.2,
            fade_out: 0.2,
        }, AudioClip {
            id: "audio-2".into(),
            name: "Bed 2.wav".into(),
            data: format!(
                "data:audio/wav;base64,{}",
                STANDARD.encode(wav_silence(1.0))
            )
            .into(),
            lane: 0,
            start_ticks: 15,
            duration_ticks: 15,
            source_in_seconds: 0.2,
            source_duration_seconds: 1.0,
            volume: 0.6,
            fade_in: 0.0,
            fade_out: 0.1,
        }];
        let original = project.clone();
        persist_project(&directory, &mut project).unwrap();
        assert!(project
            .visual_clips()
            .iter()
            .all(|scene| scene.image.starts_with("pixcut-asset:")));
        assert!(project.audio[0].data.starts_with("pixcut-asset:"));
        assert_eq!(fs::read_dir(&directory).unwrap().count(), 3);
        project.validate().unwrap();
        let mut again = original.clone();
        persist_project(&directory, &mut again).unwrap();
        assert_eq!(fs::read_dir(&directory).unwrap().count(), 3);
        // This test round-trips the stored media, so resolve every reference.
        hydrate_project(&directory, &mut project, false).unwrap();
        assert_eq!(project, original);
    }
    #[test]
    fn missing_assets_stay_referenced_and_block_portable_saves() {
        let temp = tempfile::tempdir().unwrap();
        let directory = temp.path().join("assets");
        let (mut project, _) = fixture_project();
        let missing = "a".repeat(64);
        project.tracks[0].clips[0].image = format!("pixcut-asset:{missing}").into();
        let available = project.tracks[0].clips[1].image.clone();
        persist_project(&directory, &mut project).unwrap();
        hydrate_project(&directory, &mut project, true).unwrap();
        assert_eq!(project.tracks[0].clips[0].image, format!("pixcut-asset:{missing}").into());
        assert_eq!(project.tracks[0].clips[1].image, available);
        assert!(project_has_asset_refs(&project));
        assert!(build_bundle(&project).is_err());
        // Relinking replaces the reference with fresh media bytes, then both
        // portable saves and exports are allowed again.
        project.tracks[0].clips[0].image = "data:image/png;base64,iVBORw0KGgo=".into();
        assert!(!project_has_asset_refs(&project));
        assert!(build_bundle(&project).is_ok());
    }
    #[test]
    #[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
    fn real_export_reports_progress() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("progress.mp4");
        let (p, frames) = fixture_project();
        let binary = ffmpeg().expect("FFmpeg must be installed for this test");
        let values = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let sink = values.clone();
        encode_movie(p, frames, vec![15, 15], export_options(), binary, path, Arc::new(AtomicBool::new(false)), move |percent| {
            sink.lock().unwrap().push(percent);
        })
        .unwrap();
        let values = values.lock().unwrap();
        assert!(!values.is_empty());
        assert!(values.iter().max().copied().unwrap_or(0) > 0);
    }
    #[test]
    #[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
    fn real_mp4_has_expected_dimensions_duration_and_frame_count() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("movie.mp4");
        let (p, frames) = fixture_project();
        let binary = ffmpeg().expect("FFmpeg must be installed for this test");
        encode_movie(p, frames, vec![15, 15], export_options(), binary.clone(), path.clone(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
        let result = Process::new(binary.with_file_name("ffprobe"))
            .args([
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-count_frames",
                "-show_entries",
                "stream=width,height,nb_read_frames,codec_name:format=duration",
                "-of",
                "json",
            ])
            .arg(path)
            .output()
            .unwrap();
        assert!(result.status.success());
        let info: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
        assert_eq!(info["streams"][0]["width"], 1920);
        assert_eq!(info["streams"][0]["height"], 1080);
        assert_eq!(info["streams"][0]["codec_name"], "h264");
        assert_eq!(info["streams"][0]["nb_read_frames"], "30");
        let duration: f64 = info["format"]["duration"]
            .as_str()
            .unwrap()
            .parse()
            .unwrap();
        assert!((duration - 1.0).abs() < 0.04);
    }
    #[test]
    #[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
    fn real_image_export_applies_fades() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("faded.mp4");
        let (mut project, frames) = fixture_project();
        project.tracks[0].clips[0].fade_in = 0.2;
        project.tracks[0].clips[1].fade_out = 0.2;
        let binary = ffmpeg().expect("FFmpeg must be installed for this test");
        encode_movie(project, frames, vec![15, 15], export_options(), binary.clone(), path.clone(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
        let pixel_at = |seconds: &str| {
            let result = Process::new(&binary).args(["-v", "error", "-ss", seconds, "-i"])
                .arg(&path)
                .args(["-frames:v", "1", "-vf", "crop=2:2:0:0,format=rgb24", "-f", "rawvideo", "-"])
                .output().unwrap();
            assert!(result.status.success());
            result.stdout
        };
        let faded_in = pixel_at("0.02");
        let steady = pixel_at("0.3");
        let faded_out = pixel_at("0.94");
        assert!(faded_in[0] < 120, "fade-in should darken the first frame: {faded_in:?}");
        assert!(steady[0] > 200, "the middle of the clip should stay bright: {steady:?}");
        assert!(faded_out[1] < 120, "fade-out should darken the last frame: {faded_out:?}");
    }
}
