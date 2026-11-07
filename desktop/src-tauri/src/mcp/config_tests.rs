use super::*;

#[test]
fn defaults_are_off_and_use_a_safe_port() {
    let config = McpConfig::default();
    assert!(!config.enabled);
    assert_eq!(config.port, DEFAULT_PORT);
    assert!(config.port > 1024);
    assert!(config.token.is_empty());
}

#[test]
fn normalizing_generates_a_token_and_repairs_a_privileged_port() {
    let config = McpConfig { enabled: true, port: 80, token: String::new() }.normalized();
    assert_eq!(config.port, DEFAULT_PORT);
    assert_eq!(config.token.len(), 64);
    assert!(config.token.chars().all(|value| value.is_ascii_hexdigit()));
}

#[test]
fn tokens_do_not_repeat() {
    assert_ne!(new_token(), new_token());
}

#[test]
fn config_round_trips_through_json() {
    let config = McpConfig { enabled: true, port: 50000, token: new_token() };
    let text = serde_json::to_string(&config).expect("serializes");
    let parsed: McpConfig = serde_json::from_str(&text).expect("parses");
    assert_eq!(parsed, config);
}

#[test]
fn a_privileged_port_is_repaired_on_load() {
    let parsed: McpConfig =
        serde_json::from_str(r#"{"enabled":true,"port":80,"token":""}"#).expect("parses");
    let normalized = parsed.normalized();
    assert_eq!(normalized.port, DEFAULT_PORT);
    assert_eq!(normalized.token.len(), 64);
}
