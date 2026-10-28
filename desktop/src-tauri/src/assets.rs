use super::*;

#[tauri::command]
pub(crate) fn referenced_refs(editor: State<'_, Editor>) -> Result<Vec<String>, String> {
    let session = editor.session.lock().map_err(|e| e.to_string())?;
    let mut ids = std::collections::HashSet::new();
    project_refs(&session.project, &mut ids);
    for project in session.past.iter().chain(session.future.iter()) {
        project_refs(project, &mut ids);
    }
    Ok(ids.into_iter().map(|id| format!("pixcut-asset:{id}")).collect())
}

#[tauri::command]
pub(crate) fn asset_usage(app: tauri::AppHandle) -> Result<AssetUsage, String> {
    Ok(store_usage(&asset_store_dir(&app)?))
}

#[tauri::command]
pub(crate) fn prune_assets(app: tauri::AppHandle, keep: Vec<String>) -> Result<AssetUsage, String> {
    if keep.is_empty() {
        return Err("Refusing to remove every stored asset. Open a project first.".into());
    }
    let ids: std::collections::HashSet<String> = keep
        .into_iter()
        .filter_map(|reference| reference.strip_prefix("pixcut-asset:").map(str::to_string))
        .collect();
    prune_store(&asset_store_dir(&app)?, &ids)
}

#[tauri::command]
pub(crate) fn missing_asset_refs(app: tauri::AppHandle, references: Vec<String>) -> Vec<String> {
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
pub(crate) fn asset_path(app: tauri::AppHandle, reference: String) -> Result<String, String> {
    let id = reference.strip_prefix("pixcut-asset:").ok_or("Not a local asset reference.")?;
    asset_file(&asset_store_dir(&app)?, id)
        .map(|path| path.to_string_lossy().to_string())
        .ok_or_else(|| "That local asset is missing. Relink the media.".into())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportedMedia {
    pub(crate) reference: String,
    pub(crate) name: String,
    pub(crate) bytes: u64,
}

/// Copies a picked file into the asset store in chunks and returns its hash and
/// size, so the editor keeps only a reference instead of a base64 copy.
pub(crate) fn stream_file_into_store(app: &tauri::AppHandle, source: &Path, extension: &str) -> Result<(String, u64), String> {
    let directory = asset_store_dir(app)?;
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let mut input = fs::File::open(source).map_err(|e| e.to_string())?;
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
    Ok((id, written))
}

/// Imports a video by streaming it into the local asset store, so the editor
/// keeps only a reference in memory instead of a base64 copy.
#[tauri::command]
pub(crate) async fn import_video(app: tauri::AppHandle) -> Result<Option<ImportedMedia>, String> {
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
    let (id, written) = stream_file_into_store(&app, &source, extension)?;
    Ok(Some(ImportedMedia { reference: format!("pixcut-asset:{id}"), name, bytes: written }))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportedImage {
    pub(crate) reference: String,
    pub(crate) name: String,
    pub(crate) bytes: u64,
}

/// Imports photos by streaming them into the asset store; a photo story can now
/// hold far more than the old embedded-image budget.
#[tauri::command]
pub(crate) async fn import_images(app: tauri::AppHandle) -> Result<Vec<ImportedImage>, String> {
    let Some(files) = rfd::AsyncFileDialog::new()
        .add_filter("Images", &["png", "jpg", "jpeg", "webp"])
        .pick_files()
        .await
    else {
        return Ok(vec![]);
    };
    let mut imported = Vec::new();
    for file in files {
        let source = file.path().to_path_buf();
        let name = source
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Photo")
            .to_string();
        let extension = source
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !["png", "jpg", "jpeg", "webp"].contains(&extension.as_str()) {
            return Err(format!("“{name}” is not a PNG, JPEG, or WebP image."));
        }
        let size = fs::metadata(&source).map_err(|e| e.to_string())?.len();
        if size == 0 {
            return Err(format!("“{name}” is empty."));
        }
        if size > 500 * 1024 * 1024 {
            return Err(format!("“{name}” is larger than 500 MB."));
        }
        let (id, bytes) = stream_file_into_store(&app, &source, &extension)?;
        imported.push(ImportedImage { reference: format!("pixcut-asset:{id}"), name, bytes });
    }
    Ok(imported)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportedAsset {
    pub(crate) reference: String,
    pub(crate) name: String,
    pub(crate) bytes: u64,
    pub(crate) mime: String,
}

/// Imports one image or video through the native picker without ever putting
/// the file into the project as base64. The editor receives only its reference.
#[tauri::command]
pub(crate) async fn import_media(app: tauri::AppHandle) -> Result<Option<ImportedAsset>, String> {
    let Some(file) = rfd::AsyncFileDialog::new()
        .add_filter("Images and videos", &["png", "jpg", "jpeg", "webp", "mp4", "m4v", "mov", "webm"])
        .pick_file()
        .await
    else {
        return Ok(None);
    };
    let source = file.path().to_path_buf();
    let name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Media")
        .to_string();
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let mime = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "mp4" => "video/mp4",
        "m4v" => "video/x-m4v",
        "mov" => "video/quicktime",
        "webm" => "video/webm",
        _ => return Err(format!("“{name}” is not a supported image or video.")),
    };
    let size = fs::metadata(&source).map_err(|e| e.to_string())?.len();
    if size == 0 {
        return Err(format!("“{name}” is empty."));
    }
    let image = mime.starts_with("image/");
    if size > if image { 500 * 1024 * 1024 } else { 4 * 1024 * 1024 * 1024 } {
        return Err(format!("“{name}” is too large."));
    }
    let (id, bytes) = stream_file_into_store(&app, &source, &extension)?;
    Ok(Some(ImportedAsset { reference: format!("pixcut-asset:{id}"), name, bytes, mime: mime.into() }))
}

#[tauri::command]
pub(crate) async fn import_media_path(app: tauri::AppHandle, path: String) -> Result<ImportedAsset, String> {
    let source = PathBuf::from(&path);
    if !source.is_file() {
        return Err("That drop is not a readable file.".into());
    }
    let name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Media")
        .to_string();
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let mime = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "mp4" => "video/mp4",
        "m4v" => "video/x-m4v",
        "mov" => "video/quicktime",
        "webm" => "video/webm",
        _ => return Err(format!("“{name}” is not a supported image or video.")),
    };
    let size = fs::metadata(&source).map_err(|e| e.to_string())?.len();
    let image = mime.starts_with("image/");
    if size == 0 {
        return Err(format!("“{name}” is empty."));
    }
    if size > if image { 500 * 1024 * 1024 } else { 4 * 1024 * 1024 * 1024 } {
        return Err(format!("“{name}” is too large."));
    }
    let (id, bytes) = stream_file_into_store(&app, &source, &extension)?;
    Ok(ImportedAsset { reference: format!("pixcut-asset:{id}"), name, bytes, mime: mime.into() })
}

#[tauri::command]
pub(crate) async fn import_audio(app: tauri::AppHandle) -> Result<Option<ImportedMedia>, String> {
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
    let (id, written) = stream_file_into_store(&app, &source, &extension)?;
    Ok(Some(ImportedMedia { reference: format!("pixcut-asset:{id}"), name, bytes: written }))
}

pub(crate) fn asset_store_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("assets"))
}
pub(crate) fn extension_mime(extension: &str) -> Option<&'static str> {
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
pub(crate) fn write_asset_file(
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
pub(crate) fn persist_data_url(directory: &Path, data: &str, name: &str) -> Result<String, String> {
    let (mime, bytes) = parse_data_url(data)?;
    let extension = asset_extension(mime).ok_or("Unsupported asset type.")?;
    let id = asset_hash(&bytes);
    write_asset_file(directory, &id, extension, &bytes)?;
    let _ = name;
    Ok(id)
}
pub(crate) fn persist_project(directory: &Path, project: &mut Project) -> Result<(), String> {
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
pub(crate) fn hydrate_project(directory: &Path, project: &mut Project, keep_video_refs: bool) -> Result<(), String> {
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
    if !keep_video_refs {
        for element in &mut project.overlays {
            if let Some(id) = element.source.as_deref().and_then(|s| s.strip_prefix("pixcut-asset:")) { if let Some(data) = load(id)? { element.source = Some(data); } }
        }
        for track in &mut project.tracks {
            for scene in &mut track.clips {
                for element in &mut scene.elements {
                    if let Some(id) = element.source.as_deref().and_then(|s| s.strip_prefix("pixcut-asset:")) { if let Some(data) = load(id)? { element.source = Some(data); } }
                }
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
    if !keep_video_refs {
        if let Some(music) = &mut project.legacy_music {
            if let Some(id) = music.data.strip_prefix("pixcut-asset:") {
                if let Some(data) = load(id)? { music.data = data.into(); }
            }
        }
    }
    Ok(())
}
pub(crate) fn has_inline_media(project: &Project) -> bool {
    !project.overlays.is_empty() && project.overlays.iter().any(|e| e.source.as_ref().is_some_and(|s| s.starts_with("data:"))) || project
        .tracks
        .iter()
        .any(|track| track.clips.iter().any(|clip| clip.image.starts_with("data:") || clip.elements.iter().any(|e| e.source.as_ref().is_some_and(|s| s.starts_with("data:")))))
        || project.audio.iter().any(|clip| clip.data.starts_with("data:"))
        || project.legacy_music.as_ref().is_some_and(|music| music.data.starts_with("data:"))
}
pub(crate) fn read_recovery(app: &tauri::AppHandle, path: &Path) -> Result<(Project, bool), String> {
    if fs::metadata(path).map_err(|e| e.to_string())?.len() > 100_000_000 {
        return Err("Recovery file exceeds 100 MB.".into());
    }
    let mut project: Project = serde_json::from_reader(fs::File::open(path).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Cannot open recovery: {e}"))?;
    let legacy = project.schema_version != 15 || has_inline_media(&project);
    hydrate_project(&asset_store_dir(app)?, &mut project, true)?;
    project.validate()?;
    Ok((project, legacy))
}
/// Writes the recovery file and hands back the persisted shape, so callers can
/// keep `Editor::persisted` in step without re-cloning the hydrated project.
pub(crate) fn write_recovery(
    app: &tauri::AppHandle,
    project: &Project,
) -> Result<Project, String> {
    let mut persisted = project.clone();
    persist_project(&asset_store_dir(app)?, &mut persisted)?;
    atomic_write(&recovery_path(app)?, &persisted)?;
    Ok(persisted)
}
pub(crate) fn read_project_with_migration(path: &Path) -> Result<(Project, bool), String> {
    if is_zip_file(path)? {
        return Ok((read_project_bundle(path)?, false));
    }
    if fs::metadata(path).map_err(|e| e.to_string())?.len() > 100_000_000 {
        return Err("Project file exceeds 100 MB.".into());
    }
    let mut p: Project = serde_json::from_reader(fs::File::open(path).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Cannot open project: {e}"))?;
    let legacy = p.schema_version != 15;
    p.validate()?;
    Ok((p, legacy))
}
pub(crate) fn read_project(path: &Path) -> Result<Project, String> {
    read_project_with_migration(path).map(|(project, _)| project)
}
/// Reads the recovery file without hydrating media, i.e. exactly the shape that
/// lives on disk and can be re-written without re-encoding anything.
pub(crate) fn read_persisted(path: &Path) -> Result<Project, String> {
    serde_json::from_reader(fs::File::open(path).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Cannot open recovery: {e}"))
}
