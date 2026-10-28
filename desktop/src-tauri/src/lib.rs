#![cfg_attr(test, allow(clippy::unwrap_used, clippy::expect_used, clippy::panic))]
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

mod library_index;
mod menu;
mod bundle;
mod assets;
mod project_io;
mod export;
mod plan;
mod encode;
mod online_music;

#[allow(unused_imports)]
use {assets::*, bundle::*, encode::*, export::*, menu::*, online_music::*, plan::*, project_io::*};

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

#[allow(clippy::expect_used)] // Tauri cannot recover if the shell fails to start.
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
            online_music::online_music_search,
            online_music::online_music_download,
            project_io::initialize,
            project_io::take_pending_project,
            project_io::apply_order,
            project_io::dispatch,
            project_io::save_project,
            project_io::save_project_file,
            project_io::save_still_frame,
            project_io::save_text_file,
            project_io::open_project,
            export::pick_media,
            assets::import_video,
            assets::import_audio,
            assets::import_images,
            assets::import_media,
            assets::import_media_path,
            assets::asset_path,
            assets::missing_asset_refs,
            assets::referenced_refs,
            assets::asset_usage,
            assets::prune_assets,
            export::exporter_available,
            export::exporter_capabilities,
            export::exporter_hardware,
            menu::set_app_menu,
            library_index::library_index_list,
            library_index::library_index_upsert,
            library_index::library_index_remove,
            library_index::library_index_clear,
            library_index::library_index_count,
            export::export_movie,
            export::export_variants,
            encode::export_plan_variants,
            export::cancel_export
        ])
        .setup(|app| {
            app.manage(library_index::LibraryIndex::default());
            let menu = build_app_menu(app.handle(), "en")?;
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
mod integration_tests;
