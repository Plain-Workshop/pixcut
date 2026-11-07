use super::*;

/// The loopback port the MCP server prefers. It is high and uncommon so it
/// rarely collides, and it is persisted so an agent's configuration stays valid
/// across restarts.
pub(crate) const DEFAULT_PORT: u16 = 47821;
const PORT_ATTEMPTS: u16 = 10;
const CONFIG_FILE: &str = "mcp.json";

/// Everything the server needs to start. The token is the only secret in the
/// file; it lives in the app config directory with owner-only permissions.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct McpConfig {
    pub(crate) enabled: bool,
    pub(crate) port: u16,
    pub(crate) token: String,
}
impl Default for McpConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            port: DEFAULT_PORT,
            token: String::new(),
        }
    }
}
impl McpConfig {
    /// A configuration that is safe to serve: the port is in the ephemeral
    /// range and the token is present.
    pub(crate) fn normalized(mut self) -> Self {
        if self.port < 1024 {
            self.port = DEFAULT_PORT;
        }
        if self.token.len() < 32 {
            self.token = new_token();
        }
        self
    }
}

/// 32 random bytes as lowercase hex. Short enough to paste into a client
/// configuration, long enough that guessing it is not a concern.
pub(crate) fn new_token() -> String {
    let mut bytes = [0u8; 32];
    if getrandom::fill(&mut bytes).is_err() {
        // The platform entropy source failing is not a reason to serve without
        // a token. Fall back to hashing the clock and process id, which is
        // weaker but still unguessable over a loopback socket.
        let seed = format!(
            "{}-{}-{:?}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|value| value.as_nanos())
                .unwrap_or_default(),
            std::thread::current().id()
        );
        let digest = Sha256::digest(seed.as_bytes());
        return digest.iter().map(|byte| format!("{byte:02x}")).collect();
    }
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub(crate) fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join(CONFIG_FILE))
}

pub(crate) fn load(app: &tauri::AppHandle) -> Result<McpConfig, String> {
    let path = config_path(app)?;
    if !path.exists() {
        return Ok(McpConfig::default());
    }
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    if bytes.len() > 64 * 1024 {
        return Err("The MCP settings file is too large.".into());
    }
    let config: McpConfig = serde_json::from_slice(&bytes)
        .map_err(|e| format!("The MCP settings file is not valid: {e}"))?;
    Ok(config.normalized())
}

pub(crate) fn save(app: &tauri::AppHandle, config: &McpConfig) -> Result<(), String> {
    let path = config_path(app)?;
    let parent = path.parent().ok_or("The MCP settings folder is missing.")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut temporary = tempfile::Builder::new()
        .suffix(".json")
        .tempfile_in(parent)
        .map_err(|e| e.to_string())?;
    serde_json::to_writer(temporary.as_file_mut(), config).map_err(|e| e.to_string())?;
    temporary.as_file_mut().flush().map_err(|e| e.to_string())?;
    temporary.as_file().sync_all().map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(temporary.path(), fs::Permissions::from_mode(0o600))
            .map_err(|e| e.to_string())?;
    }
    temporary.persist(&path).map_err(|e| e.to_string())?;
    Ok(())
}

/// Binds the first free loopback port at or after the configured one. The
/// actual port is returned so the caller can persist it and show it.
pub(crate) async fn bind(port: u16) -> Result<(tokio::net::TcpListener, u16), String> {
    let mut candidate = port.max(1024);
    let last = candidate.saturating_add(PORT_ATTEMPTS);
    loop {
        match tokio::net::TcpListener::bind(("127.0.0.1", candidate)).await {
            Ok(listener) => return Ok((listener, candidate)),
            Err(error) if candidate < last => {
                let _ = error;
                candidate += 1;
            }
            Err(error) => {
                return Err(format!(
                    "PixCut could not open a local port for MCP between {port} and {last}: {error}."
                ))
            }
        }
    }
}

#[cfg(test)]
mod tests {
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
}
