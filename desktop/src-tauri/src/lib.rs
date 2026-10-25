use base64::{engine::general_purpose::STANDARD, Engine};
use pixcut_project::{Command, Project, Session, View};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::Command as Process,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};
use tauri::{Manager, State};

struct Editor {
    session: Mutex<Session>,
    exporting: AtomicBool,
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
fn read_project(path: &Path) -> Result<Project, String> {
    if fs::metadata(path).map_err(|e| e.to_string())?.len() > 100_000_000 {
        return Err("Project file exceeds 100 MB.".into());
    }
    let mut p: Project = serde_json::from_reader(fs::File::open(path).map_err(|e| e.to_string())?)
        .map_err(|e| format!("Cannot open project: {e}"))?;
    p.validate()?;
    Ok(p)
}
#[tauri::command]
fn initialize(app: tauri::AppHandle, editor: State<Editor>) -> Result<View, String> {
    let mut session = editor.session.lock().map_err(|e| e.to_string())?;
    let path = recovery_path(&app)?;
    if path.exists() {
        session.project = read_project(&path)?;
    }
    Ok(session.view())
}
#[tauri::command]
fn dispatch(
    app: tauri::AppHandle,
    editor: State<Editor>,
    command: Command,
) -> Result<View, String> {
    if editor.exporting.load(Ordering::SeqCst) {
        return Err("Wait for the current export to finish.".into());
    }
    let mut current = editor.session.lock().map_err(|e| e.to_string())?;
    let mut next = current.clone();
    next.apply(command)?;
    atomic_write(&recovery_path(&app)?, &next.project)?;
    *current = next;
    Ok(current.view())
}
#[tauri::command]
async fn save_project(editor: State<'_, Editor>) -> Result<bool, String> {
    let project = editor
        .session
        .lock()
        .map_err(|e| e.to_string())?
        .project
        .clone();
    let Some(file) = rfd::AsyncFileDialog::new()
        .add_filter("PixCut project", &["json"])
        .set_file_name("My story.pixcut.json")
        .save_file()
        .await
    else {
        return Ok(false);
    };
    atomic_write(file.path(), &project)?;
    Ok(true)
}
#[tauri::command]
async fn open_project(
    app: tauri::AppHandle,
    editor: State<'_, Editor>,
) -> Result<Option<View>, String> {
    let Some(file) = rfd::AsyncFileDialog::new()
        .add_filter("PixCut project", &["json"])
        .pick_file()
        .await
    else {
        return Ok(None);
    };
    let project = read_project(file.path())?;
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
#[tauri::command]
async fn export_movie(
    editor: State<'_, Editor>,
    project_id: String,
    frames: Vec<String>,
) -> Result<Option<String>, String> {
    if editor
        .exporting
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("An export is already running.".into());
    }
    let _guard = ExportGuard(&editor.exporting);
    let project = editor
        .session
        .lock()
        .map_err(|e| e.to_string())?
        .project
        .clone();
    if project.id != project_id || project.scenes.is_empty() || frames.len() != project.scenes.len()
    {
        return Err("The project changed. Please try exporting again.".into());
    }
    let binary = ffmpeg().ok_or(
        "Install FFmpeg with the libx264 encoder to export MP4 in this development build.",
    )?;
    let Some(file) = rfd::AsyncFileDialog::new()
        .add_filter("MP4 video", &["mp4"])
        .set_file_name("My story.mp4")
        .save_file()
        .await
    else {
        return Ok(None);
    };
    let destination = file.path().to_path_buf();
    tauri::async_runtime::spawn_blocking(move || encode_movie(project, frames, binary, destination))
        .await
        .map_err(|e| e.to_string())?
}

fn encode_movie(
    project: Project,
    frames: Vec<String>,
    binary: PathBuf,
    destination: PathBuf,
) -> Result<Option<String>, String> {
    let temp = tempfile::tempdir().map_err(|e| e.to_string())?;
    let mut list = String::new();
    for (i, (scene, frame)) in project.scenes.iter().zip(frames.iter()).enumerate() {
        if frame.len() > 25_000_000 {
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
            scene.duration
        ));
    }
    list.push_str(&format!("file 'frame-{}.png'\n", frames.len() - 1));
    fs::write(temp.path().join("scenes.txt"), list).map_err(|e| e.to_string())?;
    // Encode beside the destination, then atomically replace it after success.
    let output = tempfile::Builder::new()
        .suffix(".mp4")
        .tempfile_in(destination.parent().ok_or("Invalid output path")?)
        .map_err(|e| e.to_string())?;
    let duration: f64 = project.scenes.iter().map(|s| s.duration).sum();
    let result = Process::new(binary)
        .current_dir(temp.path())
        .args([
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
            "-vf",
            "fps=30",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-t",
        ])
        .arg(format!("{duration:.6}"))
        .arg(output.path())
        .output()
        .map_err(|e| e.to_string())?;
    if !result.status.success() {
        return Err(format!(
            "FFmpeg export failed: {}",
            String::from_utf8_lossy(&result.stderr)
                .chars()
                .take(1000)
                .collect::<String>()
        ));
    }
    output.persist(&destination).map_err(|e| e.to_string())?;
    Ok(Some(destination.to_string_lossy().to_string()))
}

pub fn run() {
    tauri::Builder::default()
        .manage(Editor {
            session: Mutex::new(Session::default()),
            exporting: AtomicBool::new(false),
        })
        .invoke_handler(tauri::generate_handler![
            initialize,
            dispatch,
            save_project,
            open_project,
            exporter_available,
            export_movie
        ])
        .run(tauri::generate_context!())
        .expect("Unable to start PixCut");
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    fn fixture_project() -> (Project, Vec<String>) {
        let frames: Vec<String> = [
            include_bytes!("../../tests/fixtures/red.png").as_slice(),
            include_bytes!("../../tests/fixtures/green.png").as_slice(),
        ]
        .iter()
        .map(|bytes| format!("data:image/png;base64,{}", STANDARD.encode(bytes)))
        .collect();
        let mut p = Project::default();
        p.scenes = frames
            .iter()
            .enumerate()
            .map(|(i, frame)| pixcut_project::Scene {
                id: i.to_string(),
                name: "Fixture".into(),
                image: frame.as_str().into(),
                duration: 0.5,
                title: "".into(),
                subtitle: "".into(),
                color: "#ffffff".into(),
                fit: "cover".into(),
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
            })
            .collect();
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
        assert!(encode_movie(p, vec!["invalid".into(); 2], "ffmpeg".into(), path.clone()).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"original movie");
    }
    #[test]
    #[ignore = "Requires FFmpeg with libx264 and ffprobe installed"]
    fn real_mp4_has_expected_dimensions_duration_and_frame_count() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("movie.mp4");
        let (p, frames) = fixture_project();
        let binary = ffmpeg().expect("FFmpeg must be installed for this test");
        encode_movie(p, frames, binary.clone(), path.clone()).unwrap();
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
