use super::*;

#[tauri::command]
pub(crate) fn initialize(app: tauri::AppHandle, editor: State<Editor>) -> Result<View, String> {
    let mut session = editor.session.lock().map_err(|e| e.to_string())?;
    let path = recovery_path(&app)?;
    let pending = editor
        .pending_open
        .lock()
        .map_err(|e| e.to_string())?
        .take();
    if let Some(source) = pending {
        let directory = asset_store_dir(&app)?;
        let mut project = read_project_to_store(&source, &directory)?;
        hydrate_project(&directory, &mut project, true)?;
        session.project = project;
        session.past.clear();
        session.future.clear();
        let persisted = write_recovery(&app, &session.project)?;
        session.project = persisted.clone();
        *editor.persisted.lock().map_err(|e| e.to_string())? = persisted;
        return Ok(session.view());
    }
    if path.exists() {
        let (project, legacy) = read_recovery(&app, &path)?;
        session.project = project;
        let persisted = if legacy {
            let persisted = write_recovery(&app, &session.project)?;
            session.project = persisted.clone();
            persisted
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
pub(crate) fn take_pending_project(
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
    let directory = asset_store_dir(&app)?;
    let mut project = read_project_to_store(&source, &directory)?;
    hydrate_project(&directory, &mut project, true)?;
    let mut session = editor.session.lock().map_err(|e| e.to_string())?;
    let previous = std::mem::replace(&mut session.project, project);
    session.past.push(previous);
    if session.past.len() > 30 {
        session.past.remove(0);
    }
    session.future.clear();
    let persisted = write_recovery(&app, &session.project)?;
    session.project = persisted.clone();
    *editor.persisted.lock().map_err(|e| e.to_string())? = persisted;
    Ok(Some(session.view()))
}
#[tauri::command]
pub(crate) fn dispatch(
    app: tauri::AppHandle,
    editor: State<Editor>,
    command: Command,
) -> Result<View, String> {
    guard("editing the project", || {
        let mut current = editor.session.lock().map_err(|e| e.to_string())?;
        let mut next = current.clone();
        next.apply(command)?;
        let persisted = write_recovery(&app, &next.project)?;
        next.project = persisted.clone();
        *editor.persisted.lock().map_err(|e| e.to_string())? = persisted;
        *current = next;
        Ok(current.view())
    })
}
/// Stack-order presses answer with history flags only. Returning the project
/// would mean shipping every photo in the story back over IPC for a number that
/// the editor can apply itself.
#[tauri::command]
pub(crate) fn apply_order(
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
pub(crate) fn safe_filename(name: &str) -> String {
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
pub(crate) async fn save_text_file(data: String, file_name: String, extension: String, label: String) -> Result<bool, String> {
    let extension = extension.to_ascii_lowercase();
    if !matches!(extension.as_str(), "srt" | "vtt" | "txt") {
        return Err("Unsupported text file type.".into());
    }
    if data.trim().is_empty() {
        return Err("That file is empty.".into());
    }
    if data.len() > 16 * 1024 * 1024 {
        return Err("That text file is larger than 16 MB.".into());
    }
    let Some(file) = rfd::AsyncFileDialog::new()
        .add_filter(&label, &[extension.as_str()])
        .set_file_name(format!("{}.{}", safe_filename(&file_name), extension))
        .save_file()
        .await
    else {
        return Ok(false);
    };
    let path = file.path();
    let parent = path.parent().ok_or("Choose a folder for the file.")?;
    let temporary = tempfile::Builder::new()
        .suffix(&format!(".{extension}"))
        .tempfile_in(parent)
        .map_err(|e| e.to_string())?;
    fs::write(temporary.path(), data.as_bytes()).map_err(|e| e.to_string())?;
    temporary.persist(path).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub(crate) async fn save_project(app: tauri::AppHandle, editor: State<'_, Editor>) -> Result<bool, String> {
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
pub(crate) async fn save_project_file(app: tauri::AppHandle, project: Project) -> Result<bool, String> {
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

pub(crate) fn still_frame_extension(mime: &str) -> Option<&'static str> {
    match mime {
        "image/png" => Some("png"),
        "image/jpeg" => Some("jpg"),
        _ => None,
    }
}

#[tauri::command]
pub(crate) async fn save_still_frame(data: String, file_name: String) -> Result<bool, String> {
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
pub(crate) async fn open_project(
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
    let directory = asset_store_dir(&app)?;
    let mut project = read_project_to_store(file.path(), &directory)?;
    hydrate_project(&directory, &mut project, true)?;
    dispatch(app, editor, Command::Replace { project }).map(Some)
}
