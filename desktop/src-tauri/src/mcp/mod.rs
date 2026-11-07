mod auth;
mod backend;
mod config;
mod tools;

use crate::*;
use backend::{AppBackend, Backend};
use rmcp::transport::streamable_http_server::{
    session::local::LocalSessionManager, StreamableHttpServerConfig, StreamableHttpService,
};
use auth::TokenState;
use std::sync::RwLock;
use tokio_util::sync::CancellationToken;
use tools::PixCutServer;

/// The MCP server is opt-in. State is kept separate from the editor so it can
/// be started, stopped and inspected without touching the project.
#[derive(Default)]
pub(crate) struct McpState {
    inner: Mutex<McpStateInner>,
    frames: Mutex<std::collections::HashMap<String, std::sync::mpsc::Sender<Result<String, String>>>>,
    export: Mutex<AgentExport>,
}

/// An export an agent asked for. The window renders the frames, so the agent
/// starts it and then polls; this holds where the file goes and how it ended.
#[derive(Default)]
struct AgentExport {
    directory: Option<PathBuf>,
    running: bool,
    outcome: Option<Result<Vec<String>, String>>,
}

/// Remembers the folder for the next export and marks one as running.
pub(crate) fn begin_agent_export(app: &tauri::AppHandle, directory: PathBuf) -> Result<(), String> {
    let state = app.state::<McpState>();
    let mut export = state.export.lock().map_err(|e| e.to_string())?;
    if export.running {
        return Err("An agent export is already running. Poll get_export_status.".into());
    }
    *export = AgentExport { directory: Some(directory), running: true, outcome: None };
    Ok(())
}

/// The export commands call this where they would open a folder dialog.
pub(crate) fn take_export_directory(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.try_state::<McpState>()?.export.lock().ok()?.directory.take()
}

pub(crate) fn record_export(app: &tauri::AppHandle, result: &Result<Vec<String>, String>) {
    if let Some(state) = app.try_state::<McpState>() {
        if let Ok(mut export) = state.export.lock() {
            export.running = false;
            export.outcome = Some(result.clone());
        }
    }
}

/// The window reports that its export routine returned. If the export commands
/// never took the folder, the export stopped early and the window showed why.
#[tauri::command]
pub(crate) fn mcp_export_finished(app: tauri::AppHandle, reason: Option<String>) -> Result<(), String> {
    let state = app.state::<McpState>();
    let mut export = state.export.lock().map_err(|e| e.to_string())?;
    if export.directory.take().is_some() {
        export.running = false;
        let detail = reason.as_deref().map(str::trim).filter(|text| !text.is_empty()).map(|text| text.chars().take(400).collect::<String>());
        export.outcome = Some(Err(match detail {
            Some(detail) => format!("The export did not start: {detail}"),
            None => "The export did not start. The PixCut window may show the reason (for example missing media or an unavailable codec).".into(),
        }));
    }
    Ok(())
}

pub(crate) fn export_status(app: &tauri::AppHandle) -> serde_json::Value {
    let Some(state) = app.try_state::<McpState>() else { return serde_json::json!({ "state": "idle" }) };
    let Ok(export) = state.export.lock() else { return serde_json::json!({ "state": "idle" }) };
    match (&export.outcome, export.running) {
        (_, true) => serde_json::json!({ "state": "running" }),
        (Some(Ok(paths)), _) => serde_json::json!({ "state": "done", "paths": paths }),
        (Some(Err(error)), _) => serde_json::json!({ "state": "failed", "error": error }),
        (None, _) => serde_json::json!({ "state": "idle" }),
    }
}

#[derive(Default)]
struct McpStateInner {
    starting: bool,
    running: Option<McpHandle>,
    error: Option<String>,
}
struct McpHandle {
    port: u16,
    token: Arc<RwLock<String>>,
    stop: Option<tokio::sync::oneshot::Sender<()>>,
    cancel: CancellationToken,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct McpStatus {
    enabled: bool,
    running: bool,
    port: u16,
    url: String,
    token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn url_for(port: u16) -> String {
    format!("http://127.0.0.1:{port}/mcp")
}

/// Reads the running handle without holding the lock across an await.
fn running(state: &McpState) -> Option<(u16, String)> {
    let inner = state.inner.lock().ok()?;
    let handle = inner.running.as_ref()?;
    let token = handle.token.read().map(|token| token.clone()).unwrap_or_default();
    Some((handle.port, token))
}

fn status_of(app: &tauri::AppHandle) -> Result<McpStatus, String> {
    let config = config::load(app).unwrap_or_default();
    let state = app.state::<McpState>();
    let inner = state.inner.lock().map_err(|e| e.to_string())?;
    let (running, port, token) = match &inner.running {
        Some(handle) => (
            true,
            handle.port,
            handle.token.read().map(|token| token.clone()).unwrap_or_default(),
        ),
        None => (false, config.port, config.token.clone()),
    };
    Ok(McpStatus {
        enabled: config.enabled,
        running,
        port,
        url: url_for(port),
        token,
        error: inner.error.clone(),
    })
}

fn build_router(
    backend: Arc<dyn Backend>,
    token: Arc<RwLock<String>>,
    cancel: CancellationToken,
) -> axum::Router {
    let factory = move || Ok(PixCutServer::new(Arc::clone(&backend)));
    let server_config = StreamableHttpServerConfig::default()
        .with_legacy_session_mode(false)
        .with_json_response(true)
        .with_cancellation_token(cancel);
    let service = StreamableHttpService::new(factory, LocalSessionManager::default().into(), server_config);
    axum::Router::new()
        .nest_service("/mcp", service)
        .layer(axum::middleware::from_fn_with_state(TokenState(token), auth::require_token))
}

pub(crate) async fn start(app: &tauri::AppHandle) -> Result<McpStatus, String> {
    // Only one start may bind a port at a time; a second caller would otherwise
    // bind the next port and leave the first server without a handle to stop.
    {
        let state = app.state::<McpState>();
        let mut inner = state.inner.lock().map_err(|e| e.to_string())?;
        if inner.starting {
            return Err("Agent access is already starting.".into());
        }
        inner.starting = true;
    }
    let result = start_inner(app).await;
    if let Ok(mut inner) = app.state::<McpState>().inner.lock() {
        inner.starting = false;
    }
    result
}

async fn start_inner(app: &tauri::AppHandle) -> Result<McpStatus, String> {
    if let Some((port, token)) = running(&app.state::<McpState>()) {
        let mut config = config::load(app)?.normalized();
        config.enabled = true;
        config.port = port;
        config.token = token.clone();
        config::save(app, &config)?;
        return Ok(McpStatus { enabled: true, running: true, port, url: url_for(port), token, error: None });
    }

    let mut config = config::load(app)?.normalized();
    if config.port < 1024 {
        config.port = config::DEFAULT_PORT;
    }
    let (listener, port) = config::bind(config.port).await?;
    config.port = port;
    config.enabled = true;
    config::save(app, &config)?;

    let cancel = CancellationToken::new();
    let token = Arc::new(RwLock::new(config.token.clone()));
    let backend: Arc<dyn Backend> = Arc::new(AppBackend::new(app.clone()));
    let router = build_router(backend, Arc::clone(&token), cancel.clone());

    let (stop, stopped) = tokio::sync::oneshot::channel();
    tauri::async_runtime::spawn(async move {
        let served = axum::serve(listener, router)
            .with_graceful_shutdown(async {
                let _ = stopped.await;
            })
            .await;
        if let Err(error) = served {
            eprintln!("PixCut MCP server stopped: {error}");
        }
    });

    let state = app.state::<McpState>();
    let mut inner = state.inner.lock().map_err(|e| e.to_string())?;
    inner.running = Some(McpHandle { port, token, stop: Some(stop), cancel });
    inner.error = None;
    Ok(McpStatus {
        enabled: true,
        running: true,
        port,
        url: url_for(port),
        token: config.token,
        error: None,
    })
}

pub(crate) fn stop(app: &tauri::AppHandle) -> Result<McpStatus, String> {
    let state = app.state::<McpState>();
    {
        let mut inner = state.inner.lock().map_err(|e| e.to_string())?;
        inner.error = None;
        if let Some(mut handle) = inner.running.take() {
            handle.cancel.cancel();
            if let Some(stop) = handle.stop.take() {
                let _ = stop.send(());
            }
        }
    }
    let mut config = config::load(app)?.normalized();
    config.enabled = false;
    config::save(app, &config)?;
    status_of(app)
}

/// Called once at startup. If the user left agent access on, the server comes
/// back on the same port so the client configuration keeps working.
pub(crate) fn start_if_enabled(app: tauri::AppHandle) {
    let enabled = config::load(&app).map(|config| config.enabled).unwrap_or(false);
    if !enabled {
        return;
    }
    tauri::async_runtime::spawn(async move {
        if let Err(error) = start(&app).await {
            if let Ok(mut inner) = app.state::<McpState>().inner.lock() {
                inner.error = Some(error);
            }
        }
    });
}

/// Asks the editor window to do something only the webview can (render a
/// frame, decode a video) and waits for its text reply. Called from a blocking
/// thread, so waiting on a plain channel is fine.
fn request_window(
    app: &tauri::AppHandle,
    event: &str,
    mut payload: serde_json::Value,
    wait: std::time::Duration,
) -> Result<String, String> {
    let request_id = config::new_token()[..16].to_string();
    payload["requestId"] = serde_json::json!(request_id);
    let (sender, receiver) = std::sync::mpsc::channel();
    let state = app.state::<McpState>();
    state.frames.lock().map_err(|e| e.to_string())?.insert(request_id.clone(), sender);
    let outcome = match app.emit(event, payload) {
        Err(error) => Err(error.to_string()),
        Ok(()) => receiver
            .recv_timeout(wait)
            .map_err(|_| "The PixCut window did not answer in time. Make sure it is open and try again.".to_string())
            .and_then(|reply| reply),
    };
    if let Ok(mut frames) = state.frames.lock() {
        frames.remove(&request_id);
    }
    outcome
}

pub(crate) fn request_frame(
    app: &tauri::AppHandle,
    scene_id: Option<String>,
    at_seconds: Option<f64>,
    max_width: Option<u32>,
) -> Result<String, String> {
    request_window(
        app,
        "mcp-render-frame",
        serde_json::json!({ "sceneId": scene_id, "atSeconds": at_seconds, "maxWidth": max_width }),
        std::time::Duration::from_secs(20),
    )
}

/// The window decodes the stored video to learn its length and make a poster.
pub(crate) fn request_video_probe(app: &tauri::AppHandle, reference: &str) -> Result<String, String> {
    request_window(
        app,
        "mcp-probe-video",
        serde_json::json!({ "reference": reference }),
        std::time::Duration::from_secs(30),
    )
}

/// The editor answers a window request with a payload (a base64 PNG, or JSON for a probe) or an error.
#[tauri::command]
pub(crate) fn mcp_frame_reply(
    app: tauri::AppHandle,
    request_id: String,
    payload: Option<String>,
    error: Option<String>,
) -> Result<(), String> {
    let state = app.state::<McpState>();
    let sender = state.frames.lock().map_err(|e| e.to_string())?.remove(&request_id);
    if let Some(sender) = sender {
        let reply = match (payload, error) {
            (Some(payload), _) if payload.len() <= 40 * 1024 * 1024 => Ok(payload),
            (Some(_), _) => Err("The editor's reply was too large.".to_string()),
            (None, Some(error)) => Err(error),
            (None, None) => Err("The editor returned no frame.".to_string()),
        };
        let _ = sender.send(reply);
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn mcp_status(app: tauri::AppHandle) -> Result<McpStatus, String> {
    status_of(&app)
}

#[tauri::command]
pub(crate) async fn mcp_set_enabled(app: tauri::AppHandle, enabled: bool) -> Result<McpStatus, String> {
    if enabled {
        match start(&app).await {
            Ok(status) => Ok(status),
            Err(error) => {
                if let Ok(mut inner) = app.state::<McpState>().inner.lock() {
                    inner.error = Some(error.clone());
                }
                Err(error)
            }
        }
    } else {
        stop(&app)
    }
}

#[tauri::command]
pub(crate) fn mcp_regenerate_token(app: tauri::AppHandle) -> Result<McpStatus, String> {
    let mut config = config::load(&app)?.normalized();
    config.token = config::new_token();
    config::save(&app, &config)?;
    // The running server reads the shared token on every request, so a new
    // token takes effect at once and the port never changes.
    if let Ok(inner) = app.state::<McpState>().inner.lock() {
        if let Some(handle) = inner.running.as_ref() {
            if let Ok(mut token) = handle.token.write() {
                *token = config.token.clone();
            }
        }
    }
    status_of(&app)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::backend::fake::FakeBackend;

    #[test]
    fn the_url_is_loopback_only() {
        assert_eq!(url_for(47821), "http://127.0.0.1:47821/mcp");
    }

    fn rpc(url: &str, token: Option<&str>, body: &str, protocol: Option<&str>) -> (u16, String) {
        let mut request = ureq::post(url)
            .set("Content-Type", "application/json")
            .set("Accept", "application/json, text/event-stream");
        if let Some(token) = token {
            request = request.set("Authorization", &format!("Bearer {token}"));
        }
        if let Some(protocol) = protocol {
            request = request.set("MCP-Protocol-Version", protocol);
        }
        match request.send_string(body) {
            Ok(response) => (response.status(), response.into_string().unwrap_or_default()),
            Err(ureq::Error::Status(code, response)) => (code, response.into_string().unwrap_or_default()),
            Err(error) => (0, error.to_string()),
        }
    }

    fn payload(text: &str) -> serde_json::Value {
        let line = text
            .lines()
            .filter_map(|line| line.strip_prefix("data:"))
            .last()
            .unwrap_or(text)
            .trim();
        serde_json::from_str(line).unwrap_or_else(|_| serde_json::json!({ "raw": text }))
    }

    #[tokio::test]
    async fn the_endpoint_requires_the_token_and_lists_tools() {
        let backend: Arc<dyn Backend> = Arc::new(FakeBackend::default());
        let token = Arc::new(RwLock::new("test-token".to_string()));
        let router = build_router(backend, Arc::clone(&token), CancellationToken::new());
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.expect("bind");
        let address = listener.local_addr().expect("address");
        let server = tokio::spawn(async move { let _ = axum::serve(listener, router).await; });
        let url = format!("http://{address}/mcp");

        let unauthorized = tokio::task::spawn_blocking({
            let url = url.clone();
            move || rpc(&url, None, "{}", None)
        })
        .await
        .expect("request");
        assert_eq!(unauthorized.0, 401, "{}", unauthorized.1);

        let initialize = tokio::task::spawn_blocking({
            let url = url.clone();
            move || rpc(&url, Some("test-token"), r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"pixcut-test","version":"1"}}}"#, Some("2025-06-18"))
        })
        .await
        .expect("initialize");
        assert_eq!(initialize.0, 200, "{}", initialize.1);

        let list = tokio::task::spawn_blocking({
            let url = url.clone();
            move || rpc(&url, Some("test-token"), r#"{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}"#, Some("2025-06-18"))
        })
        .await
        .expect("tools");
        assert_eq!(list.0, 200, "{}", list.1);
        let body = payload(&list.1);
        let tools = body["result"]["tools"].as_array().expect("tools array");
        assert!(tools.iter().any(|tool| tool["name"] == "get_project"));
        assert!(tools.iter().any(|tool| tool["name"] == "add_scene"));

        server.abort();
    }
}
