use rusqlite::{params, Connection};
use tauri::Manager;
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

/// A project summary mirrored from IndexedDB. The JSON body stays the source
/// of truth; this catalog only makes native listing and lookups fast and keeps
/// the thumbnail and counts in one queryable place.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexEntry {
    pub id: String,
    pub name: String,
    pub updated_at: u64,
    pub summary: String,
}

const MAX_SUMMARY_BYTES: usize = 8_000_000;

/// One connection shared by every index command. Saves, listings and cleanup
/// can arrive at the same time; serialising them avoids SQLite lock errors
/// during the first schema creation.
#[derive(Default)]
pub struct LibraryIndex(pub Mutex<Option<Connection>>);

fn open_at(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let connection = Connection::open(path).map_err(|e| e.to_string())?;
    connection
        .execute_batch(
            "PRAGMA busy_timeout=5000;
             PRAGMA journal_mode=WAL;
             CREATE TABLE IF NOT EXISTS projects (
                 id TEXT PRIMARY KEY,
                 name TEXT NOT NULL,
                 updated_at INTEGER NOT NULL,
                 summary TEXT NOT NULL
             );
             CREATE INDEX IF NOT EXISTS projects_updated ON projects(updated_at DESC);",
        )
        .map_err(|e| e.to_string())?;
    Ok(connection)
}

fn upsert_at(connection: &mut Connection, entries: &[IndexEntry]) -> Result<(), String> {
    let transaction = connection.transaction().map_err(|e| e.to_string())?;
    {
        let mut statement = transaction
            .prepare(
                "INSERT INTO projects (id, name, updated_at, summary)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(id) DO UPDATE SET
                     name = excluded.name,
                     updated_at = excluded.updated_at,
                     summary = excluded.summary",
            )
            .map_err(|e| e.to_string())?;
        for entry in entries {
            if entry.id.is_empty() || entry.id.len() > 200 || entry.name.len() > 400 {
                return Err("A library index entry has an invalid identity.".into());
            }
            if entry.summary.len() > MAX_SUMMARY_BYTES {
                return Err("A project summary is too large for the library index.".into());
            }
            statement
                .execute(params![
                    entry.id,
                    entry.name,
                    // SQLite stores signed 64-bit integers; timestamps are far
                    // below the limit and this keeps the column sortable.
                    entry.updated_at as i64,
                    entry.summary
                ])
                .map_err(|e| e.to_string())?;
        }
    }
    transaction.commit().map_err(|e| e.to_string())
}

fn list_at(connection: &Connection) -> Result<Vec<String>, String> {
    let mut statement = connection
        .prepare("SELECT summary FROM projects ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn count_at(connection: &Connection) -> Result<u64, String> {
    connection
        .query_row("SELECT COUNT(*) FROM projects", [], |row| row.get::<_, i64>(0))
        .map(|count| count.max(0) as u64)
        .map_err(|e| e.to_string())
}

fn remove_at(connection: &Connection, id: &str) -> Result<(), String> {
    connection
        .execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn clear_at(connection: &Connection) -> Result<(), String> {
    connection
        .execute("DELETE FROM projects", [])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn index_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("library-index.sqlite3"))
}

fn with_connection<T>(app: &tauri::AppHandle, index: &State<'_, LibraryIndex>, run: impl FnOnce(&mut Connection) -> Result<T, String>) -> Result<T, String> {
    let mut guard = index.0.lock().map_err(|_| "The library index is unavailable.".to_string())?;
    if guard.is_none() {
        *guard = Some(open_at(&index_path(app)?)?);
    }
    let connection = guard.as_mut().ok_or("The library index could not be opened.")?;
    run(connection)
}

#[tauri::command]
pub fn library_index_list(app: tauri::AppHandle, index: State<'_, LibraryIndex>) -> Result<Vec<String>, String> {
    with_connection(&app, &index, |connection| list_at(connection))
}

#[tauri::command]
pub fn library_index_upsert(app: tauri::AppHandle, index: State<'_, LibraryIndex>, entries: Vec<IndexEntry>) -> Result<(), String> {
    if entries.is_empty() {
        return Ok(());
    }
    with_connection(&app, &index, |connection| upsert_at(connection, &entries))
}

#[tauri::command]
pub fn library_index_remove(app: tauri::AppHandle, index: State<'_, LibraryIndex>, id: String) -> Result<(), String> {
    with_connection(&app, &index, |connection| remove_at(connection, &id))
}

#[tauri::command]
pub fn library_index_clear(app: tauri::AppHandle, index: State<'_, LibraryIndex>) -> Result<(), String> {
    with_connection(&app, &index, |connection| clear_at(connection))
}

#[tauri::command]
pub fn library_index_count(app: tauri::AppHandle, index: State<'_, LibraryIndex>) -> Result<u64, String> {
    with_connection(&app, &index, |connection| count_at(connection))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(id: &str, updated_at: u64) -> IndexEntry {
        IndexEntry {
            id: id.into(),
            name: format!("Project {id}"),
            updated_at,
            summary: format!("{{\"id\":\"{id}\",\"updatedAt\":{updated_at}}}"),
        }
    }

    #[test]
    fn roundtrips_the_library_index() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("library-index.sqlite3");
        let mut connection = open_at(&path).unwrap();
        assert_eq!(count_at(&connection).unwrap(), 0);
        upsert_at(&mut connection, &[entry("a", 10), entry("b", 20)]).unwrap();
        assert_eq!(count_at(&connection).unwrap(), 2);
        let rows = list_at(&connection).unwrap();
        assert_eq!(rows.len(), 2);
        assert!(rows[0].contains("\"b\""), "newest first: {rows:?}");

        // Upsert replaces both name and summary.
        let mut updated = entry("a", 30);
        updated.name = "Renamed".into();
        updated.summary = "{\"id\":\"a\",\"name\":\"Renamed\"}".into();
        upsert_at(&mut connection, &[updated]).unwrap();
        let rows = list_at(&connection).unwrap();
        assert_eq!(rows.len(), 2);
        assert!(rows[0].contains("Renamed"), "{rows:?}");

        remove_at(&connection, "b").unwrap();
        assert_eq!(count_at(&connection).unwrap(), 1);
        clear_at(&connection).unwrap();
        assert_eq!(count_at(&connection).unwrap(), 0);
    }

    #[test]
    fn rejects_oversized_entries_without_partial_writes() {
        let temp = tempfile::tempdir().unwrap();
        let mut connection = open_at(&temp.path().join("index.sqlite3")).unwrap();
        let mut huge = entry("huge", 1);
        huge.summary = "x".repeat(MAX_SUMMARY_BYTES + 1);
        assert!(upsert_at(&mut connection, &[entry("ok", 1), huge]).is_err());
        // The transaction rolls back both rows.
        assert_eq!(count_at(&connection).unwrap(), 0);
        assert_eq!(upsert_at(&mut connection, &[]).unwrap(), ());
    }
}
