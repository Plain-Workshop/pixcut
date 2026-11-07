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
