use base64::{engine::general_purpose::STANDARD, Engine};
use pixcut_project::{AudioClip, Command, Project, Session, View};
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
use tauri::{Emitter, Manager, State};
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

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
fn build_bundle(project: &Project) -> Result<(BundleManifest, Vec<(String, Vec<u8>)>), String> {
    let mut portable = project.clone();
    let mut assets = Vec::new();
    let mut by_id = std::collections::HashMap::new();
    let mut files = Vec::new();
    for track in &mut portable.tracks {
        for scene in &mut track.clips {
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
        hydrate_project(directory, &mut hydrated)?;
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
    for track in &mut project.tracks {
        for scene in &mut track.clips {
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
    for track in &mut project.tracks {
        for scene in &mut track.clips {
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
fn hydrate_project(directory: &Path, project: &mut Project) -> Result<(), String> {
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
    let load = |id: &str| -> Result<String, String> {
        let path = files
            .get(id)
            .ok_or_else(|| format!("Missing asset {id} from the local store."))?;
        let bytes = fs::read(path).map_err(|e| e.to_string())?;
        if asset_hash(&bytes) != id {
            return Err("A local asset failed its integrity check.".into());
        }
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .ok_or("A local asset has no extension.")?;
        let mime = extension_mime(extension).ok_or("Unsupported local asset type.")?;
        Ok(format!("data:{mime};base64,{}", STANDARD.encode(&bytes)))
    };
    for track in &mut project.tracks {
        for scene in &mut track.clips {
            if let Some(id) = scene.image.strip_prefix("pixcut-asset:") {
                scene.image = load(id)?.into();
            }
        }
    }
    for clip in &mut project.audio {
        if let Some(id) = clip.data.strip_prefix("pixcut-asset:") {
            clip.data = load(id)?.into();
        }
    }
    if let Some(music) = &mut project.legacy_music {
        if let Some(id) = music.data.strip_prefix("pixcut-asset:") {
            music.data = load(id)?.into();
        }
    }
    Ok(())
}
fn has_inline_media(project: &Project) -> bool {
    project
        .tracks
        .iter()
        .any(|track| track.clips.iter().any(|clip| clip.image.starts_with("data:")))
        || project.audio.iter().any(|clip| clip.data.starts_with("data:"))
        || project.legacy_music.as_ref().is_some_and(|music| music.data.starts_with("data:"))
}
fn read_recovery(app: &tauri::AppHandle, path: &Path) -> Result<(Project, bool), String> {
    if fs::metadata(path).map_err(|e| e.to_string())?.len() > 100_000_000 {
        return Err("Recovery file exceeds 100 MB.".into());
    }
    let mut project: Project = serde_json::from_reader(fs::File::open(path).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Cannot open recovery: {e}"))?;
    let legacy = project.schema_version != 7 || has_inline_media(&project);
    hydrate_project(&asset_store_dir(app)?, &mut project)?;
    project.validate()?;
    Ok((project, legacy))
}
fn write_recovery(app: &tauri::AppHandle, project: &Project) -> Result<(), String> {
    let mut persisted = project.clone();
    persist_project(&asset_store_dir(app)?, &mut persisted)?;
    atomic_write(&recovery_path(app)?, &persisted)
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
    let legacy = p.schema_version != 7;
    p.validate()?;
    Ok((p, legacy))
}
fn read_project(path: &Path) -> Result<Project, String> {
    read_project_with_migration(path).map(|(project, _)| project)
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
        hydrate_project(&asset_store_dir(&app)?, &mut project)?;
        session.project = project;
        session.past.clear();
        session.future.clear();
        write_recovery(&app, &session.project)?;
        return Ok(session.view());
    }
    if path.exists() {
        let (project, legacy) = read_recovery(&app, &path)?;
        session.project = project;
        if legacy {
            write_recovery(&app, &session.project)?;
        }
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
    hydrate_project(&asset_store_dir(&app)?, &mut project)?;
    let mut session = editor.session.lock().map_err(|e| e.to_string())?;
    let previous = std::mem::replace(&mut session.project, project);
    session.past.push(previous);
    if session.past.len() > 30 {
        session.past.remove(0);
    }
    session.future.clear();
    write_recovery(&app, &session.project)?;
    Ok(Some(session.view()))
}
#[tauri::command]
fn dispatch(
    app: tauri::AppHandle,
    editor: State<Editor>,
    command: Command,
) -> Result<View, String> {
    guard("editing the project", || {
        if editor.exporting.load(Ordering::SeqCst) {
            return Err("Wait for the current export to finish.".into());
        }
        let mut current = editor.session.lock().map_err(|e| e.to_string())?;
        let mut next = current.clone();
        next.apply(command)?;
        write_recovery(&app, &next.project)?;
        *current = next;
        Ok(current.view())
    })
}
fn safe_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '_'))
        .collect();
    let trimmed = cleaned.trim();
    let limited: String = trimmed.chars().take(80).collect();
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
    hydrate_project(&asset_store_dir(&app)?, &mut project)?;
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

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportOptions {
    width: u32,
    height: u32,
    fps: u32,
    crf: u8,
    filename: String,
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
    let project = editor
        .session
        .lock()
        .map_err(|e| e.to_string())?
        .project
        .clone();
    if project.id != project_id
        || project.visual_clips().is_empty()
        || frames.is_empty()
        || frames.len() != durations.len()
        || durations.iter().any(|duration| *duration == 0)
        || durations.iter().sum::<u64>() != project.total_ticks()
    {
        return Err("The project changed. Please try exporting again.".into());
    }
    if options.width < 240 || options.height < 240 || options.width > 3840 || options.height > 3840 || options.width % 2 != 0 || options.height % 2 != 0 || !(15..=60).contains(&options.fps) || !(10..=35).contains(&options.crf) {
        return Err("Invalid export settings.".into());
    }
    let binary = ffmpeg().ok_or(
        "Install FFmpeg with the libx264 encoder to export MP4 in this development build.",
    )?;
    let stem = options.filename.trim().trim_end_matches(".mp4");
    let filename = format!("{}.mp4", safe_filename(stem));
    let Some(file) = rfd::AsyncFileDialog::new()
        .add_filter("MP4 video", &["mp4"])
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

#[tauri::command]
async fn export_variants(
    app: tauri::AppHandle,
    editor: State<'_, Editor>,
    project_id: String,
    jobs: Vec<ExportJob>,
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
    let project = editor.session.lock().map_err(|e| e.to_string())?.project.clone();
    if project.id != project_id || project.visual_clips().is_empty() {
        return Err("The project changed. Please try exporting again.".into());
    }
    for job in &jobs {
        if job.frames.is_empty()
            || job.frames.len() != job.durations.len()
            || job.durations.iter().any(|duration| *duration == 0)
            || job.durations.iter().sum::<u64>() != project.total_ticks()
            || job.options.width < 240
            || job.options.height < 240
            || job.options.width > 3840
            || job.options.height > 3840
            || job.options.width % 2 != 0
            || job.options.height % 2 != 0
            || !(15..=60).contains(&job.options.fps)
            || !(10..=35).contains(&job.options.crf)
        {
            return Err("The project changed or export settings are invalid.".into());
        }
    }
    let binary = ffmpeg().ok_or(
        "Install FFmpeg with the libx264 encoder to export MP4 in this development build.",
    )?;
    let Some(folder) = rfd::AsyncFileDialog::new().set_title("Choose a folder for your exports").pick_folder().await else {
        return Ok(vec![]);
    };
    let directory = folder.path().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || {
        let total = jobs.len() as f64;
        let mut written = Vec::new();
        for (index, job) in jobs.into_iter().enumerate() {
            if cancel.load(Ordering::SeqCst) {
                return Err("Export cancelled.".into());
            }
            let stem = job.options.filename.trim().trim_end_matches(".mp4");
            let filename = format!("{}.mp4", safe_filename(stem));
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
    duration_ticks: u64,
    #[serde(default)]
    overlays: Vec<PlanOverlay>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportPlan {
    segments: Vec<PlanSegment>,
    options: ExportOptions,
}

fn validate_plan(project: &Project, plan: &ExportPlan) -> Result<(), String> {
    let options = &plan.options;
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
    if plan.segments.is_empty() || plan.segments.len() > 200 {
        return Err("The export plan is empty or too long.".into());
    }
    let mut total = 0u64;
    for segment in &plan.segments {
        if segment.duration_ticks == 0 {
            return Err("An export segment has no duration.".into());
        }
        total += segment.duration_ticks;
        match segment.kind.as_str() {
            "image" => {
                if !segment.png.as_deref().is_some_and(|value| value.starts_with("data:image/png;base64,")) {
                    return Err("An image segment is missing its render.".into());
                }
            }
            "video" => {
                if !segment.video.as_deref().is_some_and(|value| value.starts_with("data:video/")) {
                    return Err("A video segment is missing its source.".into());
                }
            }
            _ => return Err("An export segment has an unknown type.".into()),
        }
        for overlay in &segment.overlays {
            if overlay.duration_ticks == 0 || !overlay.png.starts_with("data:image/png;base64,") {
                return Err("A text overlay is invalid.".into());
            }
        }
    }
    if total != project.total_ticks() {
        return Err("The project changed. Please try exporting again.".into());
    }
    Ok(())
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
    cancel: Arc<AtomicBool>,
    progress: impl Fn(u8) + Send + 'static,
) -> Result<Option<String>, String> {
    if cancel.load(Ordering::SeqCst) {
        return Err("Export cancelled.".into());
    }
    let temp = tempfile::tempdir().map_err(|e| e.to_string())?;
    let mut command = Process::new(binary);
    command.current_dir(temp.path());
    command.args(["-y", "-nostdin", "-hide_banner", "-loglevel", "error"]);
    let mut visual: Vec<(usize, f64, String)> = Vec::new();
    let mut overlays: Vec<(usize, f64, f64)> = Vec::new();
    let mut input_index = 0usize;
    for (index, segment) in plan.segments.iter().enumerate() {
        if cancel.load(Ordering::SeqCst) {
            return Err("Export cancelled.".into());
        }
        let duration = project.timebase.ticks_to_seconds(segment.duration_ticks);
        match segment.kind.as_str() {
            "image" => {
                let path = write_plan_payload(temp.path(), &format!("frame-{index}.png"), segment.png.as_deref().unwrap_or_default(), "data:image/png;base64,")?;
                command.args(["-loop", "1", "-t", &format!("{duration:.6}"), "-i"]).arg(path);
            }
            "video" => {
                let data = segment.video.as_deref().unwrap_or_default();
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
                let start = segment.source_in_seconds.unwrap_or(0.0).max(0.0);
                command.args(["-ss", &format!("{start:.6}"), "-t", &format!("{duration:.6}"), "-i"]).arg(path);
            }
            _ => return Err("An export segment has an unknown type.".into()),
        }
        visual.push((input_index, duration, segment.fit.clone().unwrap_or_else(|| "cover".into())));
        input_index += 1;
        for overlay in &segment.overlays {
            let start = project.timebase.ticks_to_seconds(overlay.start_ticks);
            let length = project.timebase.ticks_to_seconds(overlay.duration_ticks);
            let path = write_plan_payload(temp.path(), &format!("overlay-{input_index}.png"), &overlay.png, "data:image/png;base64,")?;
            command.args(["-loop", "1", "-t", &format!("{length:.6}"), "-i"]).arg(path);
            overlays.push((input_index, start, start + length));
            input_index += 1;
        }
    }
    let audio_files = project
        .audio
        .iter()
        .enumerate()
        .map(|(index, clip)| write_audio(temp.path(), clip, index).map(|path| (path, clip)))
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
    for (index, (input, duration, fit)) in visual.iter().enumerate() {
        let geometry = if fit == "contain" {
            format!("scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2")
        } else {
            format!("scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}")
        };
        filters.push(format!(
            "[{input}:v]{geometry},setsar=1,fps={fps},tpad=stop_mode=clone:stop_duration=2,trim=duration={duration:.6},setpts=PTS-STARTPTS[v{index}]"
        ));
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
        filters.push(format!("[{current}][{input}:v]overlay=0:0:enable='between(t,{start:.6},{end:.6})'[{next}]"));
        current = next;
    }
    if !audio_files.is_empty() {
        let mut nodes = Vec::new();
        for (index, (_, clip)) in audio_files.iter().enumerate() {
            let input = audio_start + index;
            let duration = project.timebase.ticks_to_seconds(clip.duration_ticks);
            let mut node = format!("[{input}:a]asetpts=PTS-STARTPTS,aresample=48000,volume={:.3}", clip.volume);
            if clip.fade_in > 0.0 {
                node.push_str(&format!(",afade=t=in:st=0:d={:.3}", clip.fade_in.min(duration)));
            }
            if clip.fade_out > 0.0 {
                let start = (duration - clip.fade_out).max(0.0);
                node.push_str(&format!(",afade=t=out:st={start:.3}:d={:.3}", clip.fade_out.min(duration)));
            }
            let delay = (project.timebase.ticks_to_seconds(clip.start_ticks) * 1000.0).round() as u64;
            node.push_str(&format!(",adelay={delay}:all=1[a{}]", index + 1));
            nodes.push(node);
        }
        let mix = if audio_files.len() == 1 {
            "[a1]anull[aout]".to_string()
        } else {
            let inputs: String = (1..=audio_files.len()).map(|index| format!("[a{index}]")).collect();
            format!("{inputs}amix=inputs={}:duration=longest:dropout_transition=0:normalize=0[aout]", audio_files.len())
        };
        filters.push(format!("{};{mix}", nodes.join(";")));
    }

    let duration = project.timebase.ticks_to_seconds(project.total_ticks());
    let output = tempfile::Builder::new()
        .suffix(".mp4")
        .tempfile_in(destination.parent().ok_or("Invalid output path")?)
        .map_err(|e| e.to_string())?;
    command
        .args(["-filter_complex", &filters.join(";"), "-map"])
        .arg(format!("[{current}]"));
    if !audio_files.is_empty() {
        command.args(["-map", "[aout]", "-c:a", "aac", "-b:a", "192k", "-ar", "48000"]);
    }
    command.args([
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        &plan.options.crf.to_string(),
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
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
    let project = editor.session.lock().map_err(|e| e.to_string())?.project.clone();
    if project.id != project_id || project.visual_clips().is_empty() {
        return Err("The project changed. Please try exporting again.".into());
    }
    for plan in &plans {
        validate_plan(&project, plan)?;
    }
    let binary = ffmpeg().ok_or(
        "Install FFmpeg with the libx264 encoder to export MP4 in this development build.",
    )?;
    let Some(folder) = rfd::AsyncFileDialog::new()
        .set_title("Choose a folder for your exports")
        .pick_folder()
        .await
    else {
        return Ok(vec![]);
    };
    let directory = folder.path().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || {
        let total = plans.len() as f64;
        let mut written = Vec::new();
        for (index, plan) in plans.into_iter().enumerate() {
            if cancel.load(Ordering::SeqCst) {
                return Err("Export cancelled.".into());
            }
            let stem = plan.options.filename.trim().trim_end_matches(".mp4");
            let filename = format!("{}.mp4", safe_filename(stem));
            let destination = directory.join(filename);
            let progress_app = app.clone();
            guard("encoding a video", || {
                encode_plan(&project, plan, binary.clone(), destination.clone(), Arc::clone(&cancel), move |percent| {
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

fn write_audio(dir: &Path, clip: &AudioClip, index: usize) -> Result<PathBuf, String> {
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
        .suffix(".mp4")
        .tempfile_in(destination.parent().ok_or("Invalid output path")?)
        .map_err(|e| e.to_string())?;
    let duration = project.timebase.ticks_to_seconds(project.total_ticks());
    let fps = format!("fps={}", options.fps);
    let audio_files = project
        .audio
        .iter()
        .enumerate()
        .map(|(index, clip)| write_audio(temp.path(), clip, index).map(|path| (path, clip)))
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
    command.args([
        "-vf",
        &format!("scale={}:{}:flags=lanczos,{}", options.width, options.height, fps),
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        &options.crf.to_string(),
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
    ]);
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
        command.args([
            "-filter_complex",
            filter.as_str(),
            "-map",
            "0:v:0",
            "-map",
            "[aout]",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
        ]);
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
    let pending = std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .find(|path| is_pixcut_path(path));
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Editor {
            session: Mutex::new(Session::default()),
            exporting: AtomicBool::new(false),
            cancel_export: Arc::new(AtomicBool::new(false)),
            pending_open: Mutex::new(pending),
        })
        .invoke_handler(tauri::generate_handler![
            initialize,
            take_pending_project,
            dispatch,
            save_project,
            save_project_file,
            open_project,
            pick_media,
            exporter_available,
            export_movie,
            export_variants,
            export_plan_variants,
            cancel_export
        ])
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
                if let Some(editor) = app_handle.try_state::<Editor>() {
                    if let Ok(mut pending) = editor.pending_open.lock() {
                        *pending = Some(path);
                    }
                }
                let _ = app_handle.emit("project-opened", ());
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
        ExportOptions { width: 1920, height: 1080, fps: 30, crf: 20, filename: "Test export".into() }
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
                id: i.to_string(),
                name: "Fixture".into(),
                image: frame.as_str().into(),
                start_ticks: i as u64 * 15,
                source_in_ticks: 0,
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
                framing_background: "#000000".into(),
                brightness: 1.0,
                contrast: 1.0,
                saturation: 1.0,
                exposure: 0.0,
                highlights: 0.0,
                shadows: 0.0,
                temperature: 0.0,
                tint: 0.0,
                filter: "none".into(),
                filter_intensity: 100.0,
                speed: 1.0,
                pitch: true,
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
        hydrate_project(temp.path(), &mut p).unwrap();
        assert_eq!(p.tracks[0].clips[0].image.as_ref(), "data:video/mp4;base64,AAAA");
        assert_eq!(p.tracks[0].clips[0].media_kind.as_deref(), Some("video"));
    }

    #[test]
    fn project_filename_is_safe_and_bounded() {
        assert_eq!(safe_filename("A little further"), "A little further");
        assert_eq!(safe_filename("../../etc/passwd"), "etcpasswd");
        assert_eq!(safe_filename("   "), "PixCut project");
        assert_eq!(safe_filename(&"x".repeat(200)).chars().count(), 80);
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
        assert_eq!(project.schema_version, 7);
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
                    duration_ticks: 15,
                    overlays: vec![],
                },
                PlanSegment {
                    kind: "video".into(),
                    png: None,
                    video: Some(video),
                    source_in_seconds: Some(0.0),
                    fit: Some("cover".into()),
                    duration_ticks: 15,
                    overlays: vec![PlanOverlay { png: overlay, start_ticks: 15, duration_ticks: 15 }],
                },
            ],
            options: export_options(),
        };
        let output = temp.path().join("plan.mp4");
        encode_plan(&project, plan, binary.clone(), output.clone(), Arc::new(AtomicBool::new(false)), |_| {}).unwrap();
        assert!(output.exists());
        let probe = Process::new(&binary)
            .args(["-hide_banner", "-i"])
            .arg(&output)
            .output()
            .unwrap();
        let text = String::from_utf8_lossy(&probe.stderr);
        assert!(text.contains("Video: h264"), "{text}");
        assert!(text.contains("Duration: 00:00:01.00"), "{text}");
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
        hydrate_project(&directory, &mut project).unwrap();
        assert_eq!(project, original);
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
}
