//! Online music search and download.
//!
//! This is the one place PixCut talks to the network on its own, and only when
//! the user searches, previews or adds a track in the Music panel. Search goes
//! to the Openverse catalogue (openly licensed audio); a download streams one
//! file into the local asset store. Nothing runs while editing or exporting.
use super::*;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};
use tauri::Emitter;

const SEARCH_ENDPOINT: &str = "https://api.openverse.org/v1/audio/";
/// Only licenses that allow commercial use and edits: CC0, CC BY, public domain.
const SEARCH_LICENSES: &str = "cc0,by,pdm";
const MAX_SEARCH_BYTES: u64 = 4 * 1024 * 1024;
const MAX_DOWNLOAD_BYTES: u64 = 50 * 1024 * 1024;
/// Formats FFmpeg can turn into AAC so PixCut can use them. MIDI is not here: it has no sound until a synthesizer renders it.
const CONVERTIBLE_EXTENSIONS: [&str; 6] = ["flac", "opus", "wma", "aif", "aiff", "mka"];

/// Formats the rest of the app can import, preview and export. FLAC and Opus are not among them.
const AUDIO_EXTENSIONS: [&str; 7] = ["mp3", "wav", "m4a", "aac", "ogg", "oga", "webm"];

fn agent(timeout: Duration) -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout(timeout)
        .user_agent(concat!("PixCut/", env!("CARGO_PKG_VERSION"), " (https://github.com/Plain-Workshop/pixcut; free offline photo-movie editor)"))
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

fn host_of(url: &str) -> &str {
    url.strip_prefix("https://").unwrap_or(url).split(['/', '?', '#']).next().unwrap_or("the host")
}

/// Names the host and status so a throttled or missing file is easy to tell apart from a dead network.
fn friendly_http_error(error: ureq::Error, url: &str) -> String {
    let host = host_of(url);
    match error {
        ureq::Error::Status(429, _) => format!("{host} is busy right now (HTTP 429). Wait a minute, or pick another catalogue or track."),
        ureq::Error::Status(code, _) => format!("{host} answered with HTTP {code}. Try another track or catalogue."),
        ureq::Error::Transport(_) => format!("Could not reach {host}. Check your internet connection; the service may also be down, so try again later."),
    }
}

/// How long to wait before retrying a throttled or overloaded answer, or `None` to give up.
/// First retry waits 2 s; later ones follow `Retry-After` (seconds), capped at 10 s. Other statuses never retry.
pub(crate) fn retry_delay(status: u16, retry_after: Option<&str>, attempt: u32) -> Option<Duration> {
    if !matches!(status, 429 | 502 | 503 | 504) || attempt >= MAX_RETRIES {
        return None;
    }
    let requested = retry_after.and_then(|value| value.trim().parse::<u64>().ok());
    let seconds = if attempt == 0 { 2 } else { requested.unwrap_or(5).clamp(2, 10) };
    Some(Duration::from_secs(seconds))
}

const MAX_RETRIES: u32 = 2;

const CANCELLED: &str = "Download cancelled.";

/// GET with a short backoff on 429/5xx, so a brief per-IP throttle does not fail the whole request.
/// Errors come back already worded for the user. `on_wait` hears each backoff (in seconds) so the
/// panel can say "Retrying…", and `cancel` is checked every 100 ms while waiting.
fn get_with_retry(agent: &ureq::Agent, url: &str, cancel: &AtomicBool, on_wait: &mut dyn FnMut(u64)) -> Result<ureq::Response, String> {
    let mut attempt = 0;
    loop {
        if cancel.load(Ordering::SeqCst) {
            return Err(CANCELLED.into());
        }
        match agent.get(url).call() {
            Err(ureq::Error::Status(code, response)) => match retry_delay(code, response.header("retry-after"), attempt) {
                Some(delay) => {
                    on_wait(delay.as_secs());
                    let waited = Instant::now();
                    while waited.elapsed() < delay {
                        if cancel.load(Ordering::SeqCst) {
                            return Err(CANCELLED.into());
                        }
                        std::thread::sleep(Duration::from_millis(100));
                    }
                    attempt += 1;
                }
                None => return Err(friendly_http_error(ureq::Error::Status(code, response), url)),
            },
            Err(other) => return Err(friendly_http_error(other, url)),
            Ok(response) => return Ok(response),
        }
    }
}

/// Search requests are quick and not cancellable.
fn get_plain(url: &str, timeout: Duration) -> Result<ureq::Response, String> {
    get_with_retry(&agent(timeout), url, &AtomicBool::new(false), &mut |_| {})
}

/// One download runs at a time (the panel disables Add on other rows meanwhile), so a single flag is enough.
static DOWNLOAD_CANCEL: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub(crate) fn online_download_cancel() {
    DOWNLOAD_CANCEL.store(true, Ordering::SeqCst);
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    url: String,
    received: u64,
    /// From Content-Length; 0 when the host does not say.
    total: u64,
    /// Seconds until a throttled request is retried; 0 when not waiting.
    retry_in: u64,
}

#[derive(Debug, PartialEq)]
enum CopyError {
    Cancelled,
    TooLarge,
    Io,
}

/// Copies in 64 KiB chunks, stopping at `limit` bytes or when `cancel` is set, and reports the running total.
fn copy_limited(reader: &mut impl Read, writer: &mut impl Write, limit: u64, cancel: &AtomicBool, on_progress: &mut impl FnMut(u64)) -> Result<u64, CopyError> {
    let mut buffer = vec![0u8; 64 * 1024];
    let mut total = 0u64;
    loop {
        if cancel.load(Ordering::SeqCst) {
            return Err(CopyError::Cancelled);
        }
        let read = reader.read(&mut buffer).map_err(|_| CopyError::Io)?;
        if read == 0 {
            return Ok(total);
        }
        total += read as u64;
        if total > limit {
            return Err(CopyError::TooLarge);
        }
        writer.write_all(&buffer[..read]).map_err(|_| CopyError::Io)?;
        on_progress(total);
    }
}

/// Catalogues the editor may query through `online_audio_get`. Search only; downloads use their own command.
const SEARCH_HOSTS: [&str; 3] = ["api.openverse.org", "commons.wikimedia.org", "archive.org"];

pub(crate) fn search_host_allowed(url: &str) -> bool {
    let Some(rest) = url.strip_prefix("https://") else { return false };
    let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
    !authority.contains('@') && SEARCH_HOSTS.contains(&authority)
}

/// One GET against an allow-listed catalogue, returned as text for the editor to parse.
#[tauri::command]
pub(crate) async fn online_audio_get(url: String) -> Result<String, String> {
    if !search_host_allowed(&url) {
        return Err("That catalogue is not supported.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        guard("online audio search", || {
            let response = get_plain(&url, Duration::from_secs(15))?;
            let mut body = String::new();
            response
                .into_reader()
                .take(MAX_SEARCH_BYTES)
                .read_to_string(&mut body)
                .map_err(|_| "The sound catalogue sent an unreadable answer.".to_string())?;
            Ok(body)
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Returns the catalogue's JSON untouched; the editor parses and filters it.
#[tauri::command]
pub(crate) async fn online_music_search(query: String, page: u32, category: Option<String>) -> Result<String, String> {
    let url = search_url(&query, page, category.as_deref())?;
    tauri::async_runtime::spawn_blocking(move || {
        guard("online music search", || {
            let response = get_plain(&url, Duration::from_secs(15))?;
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
        "audio/ogg" | "application/ogg" => Some("ogg"),
        "audio/webm" => Some("webm"),
        _ => None,
    }
}

/// The extension of a file PixCut cannot use directly but can convert, from the URL or the content type.
pub(crate) fn convertible_extension(url: &str, content_type: &str) -> Option<&'static str> {
    let path = url.split(['?', '#']).next().unwrap_or(url);
    if let Some(ext) = path.rsplit('.').next().map(|ext| ext.to_ascii_lowercase()) {
        if let Some(found) = CONVERTIBLE_EXTENSIONS.iter().find(|candidate| **candidate == ext) {
            return Some(found);
        }
    }
    match content_type.split(';').next().unwrap_or("").trim().to_ascii_lowercase().as_str() {
        "audio/flac" | "audio/x-flac" => Some("flac"),
        "audio/opus" => Some("opus"),
        "audio/x-ms-wma" => Some("wma"),
        "audio/aiff" | "audio/x-aiff" => Some("aiff"),
        _ => None,
    }
}

/// Converts a downloaded file to AAC in an M4A container, which every part of PixCut can preview and export.
fn convert_to_m4a(binary: &Path, input: &Path, output: &Path, cancel: &AtomicBool) -> Result<(), String> {
    let mut child = Process::new(binary)
        .args(["-y", "-v", "error", "-i"])
        .arg(input)
        .args(["-vn", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"])
        .arg(output)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "FFmpeg could not be started to convert this track.".to_string())?;
    let stderr = child.stderr.take();
    let reader = std::thread::spawn(move || {
        let mut text = String::new();
        if let Some(mut stderr) = stderr {
            let _ = stderr.read_to_string(&mut text);
        }
        text
    });
    let status = loop {
        if cancel.load(Ordering::SeqCst) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(CANCELLED.into());
        }
        match child.try_wait().map_err(|e| e.to_string())? {
            Some(status) => break status,
            None => std::thread::sleep(Duration::from_millis(80)),
        }
    };
    let text = reader.join().unwrap_or_default();
    if status.success() {
        Ok(())
    } else {
        let tail: String = text.lines().last().unwrap_or("").chars().take(160).collect();
        Err(format!("This track could not be converted ({tail}). Try another track or catalogue."))
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
            DOWNLOAD_CANCEL.store(false, Ordering::SeqCst);
            let emit = |received: u64, total: u64, retry_in: u64| {
                let _ = app.emit("online-download-progress", DownloadProgress { url: url.clone(), received, total, retry_in });
            };
            let response = get_with_retry(&agent(Duration::from_secs(120)), &url, &DOWNLOAD_CANCEL, &mut |seconds| emit(0, 0, seconds))?;
            let content_type = response.header("content-type").unwrap_or("").to_string();
            let (extension, convert) = match download_extension(&url, &content_type) {
                Some(extension) => (extension, false),
                None => (
                    convertible_extension(&url, &content_type)
                        .ok_or("That track is not an MP3, WAV, M4A, AAC, OGG, WebM, FLAC or Opus file, so PixCut cannot use it.")?,
                    true,
                ),
            };
            let converter = if convert {
                Some(ffmpeg().ok_or("This track needs FFmpeg to be converted. Install FFmpeg, then try again, or pick an MP3 track.")?)
            } else {
                None
            };
            let total = response.header("content-length").and_then(|value| value.parse::<u64>().ok()).unwrap_or(0);
            if total > MAX_DOWNLOAD_BYTES {
                return Err("That track is larger than 50 MB. Pick a shorter one.".to_string());
            }
            let directory = asset_store_dir(&app)?;
            fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
            let mut temporary = tempfile::Builder::new()
                .suffix(&format!(".{extension}"))
                .tempfile_in(&directory)
                .map_err(|e| e.to_string())?;
            emit(0, total, 0);
            let mut last = Instant::now();
            let mut reader = response.into_reader();
            let written = copy_limited(&mut reader, &mut temporary, MAX_DOWNLOAD_BYTES, &DOWNLOAD_CANCEL, &mut |received| {
                if last.elapsed() >= Duration::from_millis(100) {
                    last = Instant::now();
                    emit(received, total, 0);
                }
            })
            .map_err(|error| match error {
                CopyError::Cancelled => CANCELLED.to_string(),
                CopyError::TooLarge => "That track is larger than 50 MB. Pick a shorter one.".to_string(),
                CopyError::Io => "The download was interrupted. Check your connection and try again.".to_string(),
            })?;
            if written == 0 {
                return Err("The music host sent an empty file.".into());
            }
            emit(written, total.max(written), 0);
            temporary.flush().map_err(|e| e.to_string())?;
            let converted;
            let (stored_path, stored_extension) = if let Some(binary) = converter {
                let output = tempfile::Builder::new().suffix(".m4a").tempfile_in(&directory).map_err(|e| e.to_string())?;
                convert_to_m4a(&binary, temporary.path(), output.path(), &DOWNLOAD_CANCEL)?;
                converted = output;
                (converted.path(), "m4a")
            } else {
                (temporary.path(), extension)
            };
            let (id, bytes) = stream_file_into_store(&app, stored_path, stored_extension)?;
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
    #[ignore = "needs FFmpeg"]
    fn flac_is_converted_to_playable_m4a() {
        let binary = ffmpeg().expect("FFmpeg is installed");
        let dir = tempfile::tempdir().unwrap();
        let (flac, m4a) = (dir.path().join("ring.flac"), dir.path().join("ring.m4a"));
        let made = Process::new(&binary).args(["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=880:duration=1"]).arg(&flac).status().unwrap();
        assert!(made.success());
        convert_to_m4a(&binary, &flac, &m4a, &AtomicBool::new(false)).unwrap();
        assert!(fs::metadata(&m4a).unwrap().len() > 500);
        let cancelled = convert_to_m4a(&binary, &flac, &dir.path().join("again.m4a"), &AtomicBool::new(true));
        assert_eq!(cancelled, Err(CANCELLED.to_string()));
        let broken = dir.path().join("broken.flac");
        fs::write(&broken, b"not audio").unwrap();
        assert!(convert_to_m4a(&binary, &broken, &dir.path().join("x.m4a"), &AtomicBool::new(false)).is_err());
    }

    #[test]
    fn chunked_copy_reports_progress_and_respects_the_cap() {
        let data = vec![7u8; 200_000];
        let mut seen = Vec::new();
        let mut out = Vec::new();
        let cancel = AtomicBool::new(false);
        let written = copy_limited(&mut &data[..], &mut out, 1_000_000, &cancel, &mut |total| seen.push(total)).unwrap();
        assert_eq!(written, 200_000);
        assert_eq!(out.len(), 200_000);
        assert!(seen.len() >= 3 && seen.windows(2).all(|pair| pair[0] < pair[1]) && *seen.last().unwrap() == 200_000);

        let mut out = Vec::new();
        assert_eq!(copy_limited(&mut &data[..], &mut out, 100_000, &cancel, &mut |_| {}), Err(CopyError::TooLarge));
        assert!(out.len() <= 100_000);
    }

    #[test]
    fn chunked_copy_stops_when_cancelled() {
        let data = vec![1u8; 500_000];
        let cancel = AtomicBool::new(false);
        let mut out = Vec::new();
        let result = copy_limited(&mut &data[..], &mut out, 10_000_000, &cancel, &mut |received| {
            if received >= 64 * 1024 {
                cancel.store(true, Ordering::SeqCst);
            }
        });
        assert_eq!(result, Err(CopyError::Cancelled));
        assert!(out.len() < data.len());
        assert_eq!(copy_limited(&mut &data[..], &mut Vec::new(), 10, &cancel, &mut |_| {}), Err(CopyError::Cancelled));
    }

    #[test]
    fn throttled_answers_back_off_and_then_give_up() {
        assert_eq!(retry_delay(429, None, 0), Some(Duration::from_secs(2)));
        assert_eq!(retry_delay(429, Some("7"), 1), Some(Duration::from_secs(7)));
        assert_eq!(retry_delay(429, Some("600"), 1), Some(Duration::from_secs(10)));
        assert_eq!(retry_delay(503, Some("0"), 1), Some(Duration::from_secs(2)));
        assert_eq!(retry_delay(429, Some("soon"), 1), Some(Duration::from_secs(5)));
        assert_eq!(retry_delay(429, None, MAX_RETRIES), None);
        for status in [200u16, 301, 400, 403, 404, 500] {
            assert_eq!(retry_delay(status, None, 0), None, "{status}");
        }
    }

    #[test]
    fn errors_name_the_host_and_status() {
        let url = "https://upload.wikimedia.org/wikipedia/commons/transcoded/a/ab/X.ogg/X.ogg.mp3";
        assert_eq!(host_of(url), "upload.wikimedia.org");
        assert_eq!(host_of("https://a.test?x=1"), "a.test");
        let busy = friendly_http_error(ureq::Error::Status(429, ureq::Response::new(429, "Too Many Requests", "").unwrap()), url);
        assert!(busy.contains("upload.wikimedia.org") && busy.contains("429") && busy.contains("another catalogue"));
        let missing = friendly_http_error(ureq::Error::Status(404, ureq::Response::new(404, "Not Found", "").unwrap()), url);
        assert!(missing.contains("HTTP 404") && missing.contains("upload.wikimedia.org"));
    }

    #[test]
    fn search_hosts_are_an_allow_list() {
        assert!(search_host_allowed("https://commons.wikimedia.org/w/api.php?action=query"));
        assert!(search_host_allowed("https://api.openverse.org/v1/audio/?q=a"));
        assert!(search_host_allowed("https://archive.org/metadata/some_item"));
        assert!(!search_host_allowed("https://archive.org.evil.test/metadata/x"));
        assert!(!search_host_allowed("http://commons.wikimedia.org/w/api.php"));
        assert!(!search_host_allowed("https://commons.wikimedia.org.evil.test/x"));
        assert!(!search_host_allowed("https://user@commons.wikimedia.org/x"));
        assert!(!search_host_allowed("https://evil.test/?u=commons.wikimedia.org"));
        assert!(!search_host_allowed("file:///etc/passwd"));
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
        assert_eq!(convertible_extension("https://x.test/Ring.FLAC?x=1", ""), Some("flac"));
        assert_eq!(convertible_extension("https://x.test/stream", "audio/opus; codecs=opus"), Some("opus"));
        assert_eq!(convertible_extension("https://x.test/a.mid", "audio/midi"), None);
        assert_eq!(convertible_extension("https://x.test/a.mp3", "audio/mpeg"), None);
        assert_eq!(download_extension("https://x.test/file.opus", "audio/opus"), None);
        assert_eq!(download_extension("https://x.test/stream", "application/ogg"), Some("ogg"));
        assert_eq!(download_extension("https://x.test/a.webm", ""), Some("webm"));
        assert_eq!(download_extension("https://x.test/page.html", "text/html"), None);
    }
}
