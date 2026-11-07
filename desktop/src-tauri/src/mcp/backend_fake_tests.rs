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
    fn render_frame(&self, scene_id: Option<String>, _at: Option<f64>, _width: Option<u32>) -> Result<String, String> {
        if scene_id.as_deref() == Some("broken") {
            return Err("The PixCut window did not answer in time.".into());
        }
        Ok("iVBORw0KGgo=".into())
    }
    fn probe_video(&self, reference: &str) -> Result<VideoInfo, String> {
        if reference.ends_with("dead") {
            return Err("That video format could not be decoded.".into());
        }
        Ok(VideoInfo { duration: 8.0, poster: "data:image/jpeg;base64,AA==".into() })
    }
    fn start_export(&self, directory: &str) -> Result<(), String> {
        if !directory.starts_with('/') {
            return Err("Give the absolute path of a folder that already exists.".into());
        }
        Ok(())
    }
    fn export_status(&self) -> serde_json::Value {
        serde_json::json!({ "state": "idle" })
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
