use super::*;

pub(crate) const BUNDLE_FORMAT: &str = "pixcut";
pub(crate) const BUNDLE_VERSION: u32 = 1;
/// Large projects stream their media; the package limit is a disk/archive guard,
/// not the old embedded-image memory budget.
pub(crate) const MAX_BUNDLE_BYTES: u64 = 32 * 1024 * 1024 * 1024;
pub(crate) const MAX_BUNDLE_ASSET_BYTES: u64 = 8 * 1024 * 1024 * 1024;
pub(crate) const MAX_BUNDLE_ASSET_TOTAL: u64 = 64 * 1024 * 1024 * 1024;
pub(crate) const BUNDLE_MANIFEST: &str = "manifest.json";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BundleAsset {
    pub(crate) id: String,
    pub(crate) path: String,
    pub(crate) name: String,
    pub(crate) mime: String,
    pub(crate) bytes: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BundleManifest {
    pub(crate) format: String,
    pub(crate) format_version: u32,
    pub(crate) created_with: String,
    pub(crate) project: Project,
    pub(crate) assets: Vec<BundleAsset>,
}
pub(crate) fn asset_extension(mime: &str) -> Option<&'static str> {
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
pub(crate) fn parse_data_url(data: &str) -> Result<(&str, Vec<u8>), String> {
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
pub(crate) fn asset_hash(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}
/// A bundle entry either carries its bytes (small embedded media) or points at a
/// stored file that is streamed into the zip (video/audio references).
pub(crate) enum BundleSource {
    Bytes(Vec<u8>),
    File(PathBuf),
}
pub(crate) fn store_asset(
    data: &str,
    name: &str,
    assets: &mut Vec<BundleAsset>,
    by_id: &mut std::collections::HashMap<String, String>,
    files: &mut Vec<(String, BundleSource)>,
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
        files.push((path, BundleSource::Bytes(bytes)));
    }
    Ok(id)
}
/// Adds an already-stored asset to the bundle without reading it into memory.
pub(crate) fn store_asset_ref(
    id: &str,
    name: &str,
    asset_dir: Option<&Path>,
    assets: &mut Vec<BundleAsset>,
    by_id: &mut std::collections::HashMap<String, String>,
    files: &mut Vec<(String, BundleSource)>,
) -> Result<String, String> {
    if by_id.contains_key(id) {
        return Ok(id.to_string());
    }
    let path = asset_dir
        .and_then(|directory| asset_file(directory, id))
        .ok_or("Relink missing media before saving this project.")?;
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .ok_or("A stored asset has no extension.")?;
    let mime = extension_mime(extension).ok_or("A stored asset has an unsupported type.")?;
    let bytes = fs::metadata(&path).map_err(|e| e.to_string())?.len();
    let entry = format!("assets/{id}.{extension}");
    by_id.insert(id.to_string(), entry.clone());
    assets.push(BundleAsset {
        id: id.to_string(),
        path: entry.clone(),
        name: name.chars().take(120).collect(),
        mime: mime.to_string(),
        bytes,
    });
    files.push((entry, BundleSource::File(path)));
    Ok(id.to_string())
}
#[cfg(test)]
pub(crate) fn project_has_asset_refs(project: &Project) -> bool {
    project.overlays.iter().any(|element| element.source.as_deref().is_some_and(|source| source.starts_with("pixcut-asset:")))
        || project.tracks.iter().any(|track| track.clips.iter().any(|scene| {
            scene.image.starts_with("pixcut-asset:")
                || scene.elements.iter().any(|element| element.source.as_deref().is_some_and(|source| source.starts_with("pixcut-asset:")))
        }))
        || project.audio.iter().any(|clip| clip.data.starts_with("pixcut-asset:"))
        || project.legacy_music.as_ref().is_some_and(|music| music.data.starts_with("pixcut-asset:"))
}
pub(crate) fn build_bundle(project: &Project, asset_dir: Option<&Path>) -> Result<(BundleManifest, Vec<(String, BundleSource)>), String> {
    let mut portable = project.clone();
    let mut assets = Vec::new();
    let mut by_id = std::collections::HashMap::new();
    let mut files = Vec::new();
    for element in &mut portable.overlays {
                if let Some(source) = &element.source {
                    if let Some(id) = source.strip_prefix("pixcut-asset:") {
                        store_asset_ref(id, element.label.as_deref().unwrap_or("Overlay"), asset_dir, &mut assets, &mut by_id, &mut files)?;
                    } else if source.starts_with("data:") {
                        let id = store_asset(source, element.label.as_deref().unwrap_or("Overlay"), &mut assets, &mut by_id, &mut files)?;
                        element.source = Some(format!("pixcut-asset:{id}"));
                    }
                }
            }
    for track in &mut portable.tracks {
        for scene in &mut track.clips {
            for element in &mut scene.elements {
                if let Some(source) = &element.source {
                    if let Some(id) = source.strip_prefix("pixcut-asset:") {
                        store_asset_ref(id, element.label.as_deref().unwrap_or("Overlay"), asset_dir, &mut assets, &mut by_id, &mut files)?;
                    } else if source.starts_with("data:") {
                        let id = store_asset(source, element.label.as_deref().unwrap_or("Overlay"), &mut assets, &mut by_id, &mut files)?;
                        element.source = Some(format!("pixcut-asset:{id}"));
                    }
                }
            }
            if let Some(id) = scene.image.strip_prefix("pixcut-asset:") {
                store_asset_ref(id, &scene.name, asset_dir, &mut assets, &mut by_id, &mut files)?;
                continue;
            }
            let id = store_asset(&scene.image, &scene.name, &mut assets, &mut by_id, &mut files)?;
            scene.image = format!("pixcut-asset:{id}").into();
        }
    }
    for clip in &mut portable.audio {
        if let Some(id) = clip.data.strip_prefix("pixcut-asset:") {
            store_asset_ref(id, &clip.name, asset_dir, &mut assets, &mut by_id, &mut files)?;
        } else {
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
pub(crate) fn write_project_bundle(path: &Path, project: &Project, asset_dir: Option<&Path>) -> Result<(), String> {
    // Streamed media is streamed straight from the asset store into the zip, so
    // saving a project never has to hold a long video in memory.
    let (manifest, files) = build_bundle(project, asset_dir)?;
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
        for (name, source) in files {
            archive.start_file(name, options).map_err(|e| e.to_string())?;
            match source {
                BundleSource::Bytes(bytes) => archive.write_all(&bytes).map_err(|e| e.to_string())?,
                BundleSource::File(source_path) => {
                    let mut source_file = fs::File::open(&source_path).map_err(|e| e.to_string())?;
                    std::io::copy(&mut source_file, &mut archive).map_err(|e| e.to_string())?;
                }
            }
        }
        archive.finish().map_err(|e| e.to_string())?;
    }
    tmp.as_file_mut().flush().map_err(|e| e.to_string())?;
    tmp.as_file().sync_all().map_err(|e| e.to_string())?;
    tmp.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}
/// Opens a `.pixcut` package by streaming each asset straight into the native
/// asset store. Project media stays referenced, so a multi-gigabyte video does
/// not have to be base64-decoded into memory just to reopen its project.
pub(crate) fn read_project_bundle_to_store(path: &Path, directory: &Path) -> Result<Project, String> {
    if fs::metadata(path).map_err(|e| e.to_string())?.len() > MAX_BUNDLE_BYTES {
        return Err("Project package exceeds the 32 GB limit.".into());
    }
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("Cannot open .pixcut package: {e}"))?;
    let manifest_text = {
        let entry = archive.by_name(BUNDLE_MANIFEST).map_err(|_| "The .pixcut package is missing its manifest.")?;
        if entry.size() > 5_000_000 { return Err("The .pixcut manifest is too large.".into()); }
        let mut text = String::new();
        entry.take(5_000_001).read_to_string(&mut text).map_err(|e| e.to_string())?;
        text
    };
    let manifest: BundleManifest = serde_json::from_str(&manifest_text).map_err(|e| format!("Invalid .pixcut manifest: {e}"))?;
    if manifest.format != BUNDLE_FORMAT || manifest.format_version != BUNDLE_VERSION {
        return Err("This .pixcut package version is not supported.".into());
    }
    fs::create_dir_all(directory).map_err(|e| e.to_string())?;
    let mut total = 0u64;
    for asset in &manifest.assets {
        if !asset.path.starts_with("assets/") || asset.path.contains("..") {
            return Err("The .pixcut package contains an unsafe asset path.".into());
        }
        let extension = asset_extension(&asset.mime).ok_or("The .pixcut package contains an unsupported asset type.")?;
        if asset.bytes > MAX_BUNDLE_ASSET_BYTES { return Err("A .pixcut asset exceeds the 8 GB limit.".into()); }
        let mut entry = archive.by_name(&asset.path).map_err(|_| "The .pixcut package is missing an asset.")?;
        if entry.size() > MAX_BUNDLE_ASSET_BYTES { return Err("A .pixcut asset exceeds the 8 GB limit.".into()); }
        let mut temporary = tempfile::Builder::new().suffix(&format!(".{extension}")).tempfile_in(directory).map_err(|e| e.to_string())?;
        let mut hasher = Sha256::new();
        let mut written = 0u64;
        let mut buffer = vec![0u8; 1 << 20];
        loop {
            let read = entry.read(&mut buffer).map_err(|e| e.to_string())?;
            if read == 0 { break; }
            hasher.update(&buffer[..read]);
            temporary.write_all(&buffer[..read]).map_err(|e| e.to_string())?;
            written += read as u64;
            if written > MAX_BUNDLE_ASSET_BYTES { return Err("A .pixcut asset exceeds the 8 GB limit.".into()); }
        }
        if written != asset.bytes {
            return Err("A .pixcut asset has an unexpected size.".into());
        }
        let id = hasher.finalize().iter().map(|byte| format!("{byte:02x}")).collect::<String>();
        if id != asset.id {
            return Err("A .pixcut asset failed its integrity check.".into());
        }
        total += written;
        if total > MAX_BUNDLE_ASSET_TOTAL { return Err("The .pixcut package exceeds the 64 GB asset budget.".into()); }
        let destination = directory.join(format!("{id}.{extension}"));
        if !destination.exists() {
            temporary.persist(&destination).map_err(|e| e.to_string())?;
        }
    }
    let mut project = manifest.project;
    project.validate()?;
    Ok(project)
}

pub(crate) fn read_project_to_store(path: &Path, directory: &Path) -> Result<Project, String> {
    if is_zip_file(path)? {
        read_project_bundle_to_store(path, directory)
    } else {
        read_project(path)
    }
}

pub(crate) fn read_project_bundle(path: &Path) -> Result<Project, String> {
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
pub(crate) fn is_zip_file(path: &Path) -> Result<bool, String> {
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut magic = [0u8; 4];
    let read = file.read(&mut magic).map_err(|e| e.to_string())?;
    Ok(read == 4 && magic == [0x50, 0x4b, 0x03, 0x04])
}
pub(crate) fn asset_file(directory: &Path, id: &str) -> Option<PathBuf> {
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

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AssetUsage {
    pub(crate) files: u64,
    pub(crate) bytes: u64,
}

pub(crate) fn is_store_file(path: &Path) -> bool {
    path.extension().is_some()
        && path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .is_some_and(|id| id.len() == 64 && id.chars().all(|character| character.is_ascii_hexdigit()))
}

pub(crate) fn store_usage(directory: &Path) -> AssetUsage {
    let mut usage = AssetUsage::default();
    let Ok(entries) = fs::read_dir(directory) else { return usage };
    for entry in entries.flatten() {
        let path = entry.path();
        if !is_store_file(&path) {
            continue;
        }
        if let Ok(metadata) = entry.metadata() {
            if metadata.is_file() {
                usage.files += 1;
                usage.bytes += metadata.len();
            }
        }
    }
    usage
}

/// Deletes stored assets whose hash is not in `keep`. Returns what was removed.
pub(crate) fn prune_store(directory: &Path, keep: &std::collections::HashSet<String>) -> Result<AssetUsage, String> {
    let mut removed = AssetUsage::default();
    if !directory.exists() {
        return Ok(removed);
    }
    for entry in fs::read_dir(directory).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        if !is_store_file(&path) {
            continue;
        }
        let Some(id) = path.file_stem().and_then(|stem| stem.to_str()) else { continue };
        if keep.contains(id) {
            continue;
        }
        let bytes = entry.metadata().map(|metadata| metadata.len()).unwrap_or(0);
        if fs::remove_file(&path).is_ok() {
            removed.files += 1;
            removed.bytes += bytes;
        }
    }
    Ok(removed)
}

pub(crate) fn project_refs(project: &Project, into: &mut std::collections::HashSet<String>) {
    let mut add = |value: &str| {
        if let Some(id) = value.strip_prefix("pixcut-asset:") {
            into.insert(id.to_string());
        }
    };
    for element in &project.overlays {
        if let Some(source) = element.source.as_deref() { add(source); }
    }
    for track in &project.tracks {
        for scene in &track.clips {
            add(&scene.image);
            for element in &scene.elements {
                if let Some(source) = element.source.as_deref() { add(source); }
            }
        }
    }
    for clip in &project.audio {
        add(&clip.data);
    }
}
