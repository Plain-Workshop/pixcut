//! Online music search and download.
//!
//! This is the one place PixCut talks to the network on its own, and only when
//! the user searches, previews or adds a track in the Music panel. Search goes
//! to the Openverse catalogue (openly licensed audio); a download streams one
//! file into the local asset store. Nothing runs while editing or exporting.
use super::*;
use std::time::Duration;

const SEARCH_ENDPOINT: &str = "https://api.openverse.org/v1/audio/";
/// Only licenses that allow commercial use and edits: CC0, CC BY, public domain.
const SEARCH_LICENSES: &str = "cc0,by,pdm";
const MAX_SEARCH_BYTES: u64 = 4 * 1024 * 1024;
const MAX_DOWNLOAD_BYTES: u64 = 50 * 1024 * 1024;
const AUDIO_EXTENSIONS: [&str; 6] = ["mp3", "wav", "m4a", "aac", "ogg", "oga"];

fn agent(timeout: Duration) -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout(timeout)
        .user_agent(concat!("PixCut/", env!("CARGO_PKG_VERSION"), " (offline-first video editor)"))
        .build()
}

fn percent_encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(byte as char),
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

/// Openverse audio categories PixCut searches. Anything else falls back to music.
pub(crate) fn search_category(category: Option<&str>) -> &'static str {
    match category {
        Some("sound_effect") => "sound_effect",
        _ => "music",
    }
}

pub(crate) fn search_url(query: &str, page: u32, category: Option<&str>) -> Result<String, String> {
    let query = query.trim();
    if query.is_empty() {
        return Err("Type a word or pick a genre to search.".into());
    }
    if query.chars().count() > 120 {
        return Err("That search is too long. Try a few words.".into());
    }
    let page = page.clamp(1, 50);
    Ok(format!(
        "{SEARCH_ENDPOINT}?q={}&license={SEARCH_LICENSES}&category={}&mature=false&page_size=20&page={page}",
        percent_encode(query),
        search_category(category)
    ))
}

fn friendly_http_error(error: ureq::Error, what: &str) -> String {
    match error {
        ureq::Error::Status(429, _) => format!("{what} is busy right now. Wait a minute and try again."),
        ureq::Error::Status(code, _) => format!("{what} answered with an error ({code}). Try again later."),
        ureq::Error::Transport(_) => format!("Could not reach {what}. Check your internet connection and try again."),
    }
}

/// Returns the catalogue's JSON untouched; the editor parses and filters it.
#[tauri::command]
pub(crate) async fn online_music_search(query: String, page: u32, category: Option<String>) -> Result<String, String> {
    let url = search_url(&query, page, category.as_deref())?;
    tauri::async_runtime::spawn_blocking(move || {
        guard("online music search", || {
            let response = agent(Duration::from_secs(25))
                .get(&url)
                .call()
                .map_err(|e| friendly_http_error(e, "The music catalogue"))?;
            let mut body = String::new();
            response
                .into_reader()
                .take(MAX_SEARCH_BYTES)
                .read_to_string(&mut body)
                .map_err(|_| "The music catalogue sent an unreadable answer.".to_string())?;
            Ok(body)
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

pub(crate) fn download_extension(url: &str, content_type: &str) -> Option<&'static str> {
    let path = url.split(['?', '#']).next().unwrap_or(url);
    let from_path = path.rsplit('.').next().map(|ext| ext.to_ascii_lowercase());
    if let Some(ext) = from_path {
        if let Some(found) = AUDIO_EXTENSIONS.iter().find(|candidate| **candidate == ext) {
            return Some(found);
        }
    }
    match content_type.split(';').next().unwrap_or("").trim().to_ascii_lowercase().as_str() {
        "audio/mpeg" | "audio/mp3" => Some("mp3"),
        "audio/wav" | "audio/x-wav" => Some("wav"),
        "audio/mp4" | "audio/x-m4a" => Some("m4a"),
        "audio/aac" => Some("aac"),
        "audio/ogg" => Some("ogg"),
        _ => None,
    }
}

/// Streams one track into the asset store and returns a `pixcut-asset:` reference.
#[tauri::command]
pub(crate) async fn online_music_download(app: tauri::AppHandle, url: String, title: String) -> Result<ImportedMedia, String> {
    if !url.starts_with("https://") {
        return Err("Only secure (https) downloads are allowed.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        guard("online music download", || {
            let response = agent(Duration::from_secs(120))
                .get(&url)
                .call()
                .map_err(|e| friendly_http_error(e, "The music host"))?;
            let content_type = response.header("content-type").unwrap_or("").to_string();
            let extension = download_extension(&url, &content_type)
                .ok_or("That track is not an MP3, WAV, M4A, AAC, or OGG file, so PixCut cannot use it.")?;
            if let Some(length) = response.header("content-length").and_then(|value| value.parse::<u64>().ok()) {
                if length > MAX_DOWNLOAD_BYTES {
                    return Err("That track is larger than 50 MB. Pick a shorter one.".to_string());
                }
            }
            let directory = asset_store_dir(&app)?;
            fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
            let mut temporary = tempfile::Builder::new()
                .suffix(&format!(".{extension}"))
                .tempfile_in(&directory)
                .map_err(|e| e.to_string())?;
            let mut reader = response.into_reader().take(MAX_DOWNLOAD_BYTES + 1);
            let written = std::io::copy(&mut reader, &mut temporary)
                .map_err(|_| "The download was interrupted. Check your connection and try again.".to_string())?;
            if written == 0 {
                return Err("The music host sent an empty file.".into());
            }
            if written > MAX_DOWNLOAD_BYTES {
                return Err("That track is larger than 50 MB. Pick a shorter one.".into());
            }
            temporary.flush().map_err(|e| e.to_string())?;
            let (id, bytes) = stream_file_into_store(&app, temporary.path(), extension)?;
            let name: String = title.trim().chars().take(100).collect();
            let name = if name.is_empty() { "Online track".to_string() } else { name };
            Ok(ImportedMedia { reference: format!("pixcut-asset:{id}"), name, bytes })
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_url_encodes_and_limits_the_query() {
        let url = search_url("lo-fi beats & chill", 2, None).unwrap();
        assert!(url.contains("q=lo-fi%20beats%20%26%20chill"));
        assert!(url.contains("license=cc0,by,pdm"));
        assert!(url.contains("page=2"));
        assert!(url.contains("category=music"));
        assert!(search_url("  ", 1, None).is_err());
        assert!(search_url(&"a".repeat(121), 1, None).is_err());
        assert!(search_url("pop", 0, None).unwrap().contains("page=1"));
    }

    #[test]
    fn search_category_is_a_whitelist() {
        assert!(search_url("applause", 1, Some("sound_effect")).unwrap().contains("category=sound_effect"));
        assert!(search_url("applause", 1, Some("podcast&license=all")).unwrap().contains("category=music"));
        assert_eq!(search_category(None), "music");
    }

    #[test]
    fn download_extension_prefers_the_path_then_the_content_type() {
        assert_eq!(download_extension("https://x.test/a/song.MP3?token=1", ""), Some("mp3"));
        assert_eq!(download_extension("https://x.test/stream", "audio/ogg; codecs=vorbis"), Some("ogg"));
        assert_eq!(download_extension("https://x.test/file.flac", "audio/flac"), None);
        assert_eq!(download_extension("https://x.test/page.html", "text/html"), None);
    }
}
