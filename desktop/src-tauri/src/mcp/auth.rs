use axum::{
    body::Body,
    extract::State,
    http::{header::AUTHORIZATION, HeaderMap, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::sync::{Arc, RwLock};

/// The live bearer token. It is shared with the running server so regenerating
/// the token takes effect immediately without rebinding the port.
#[derive(Clone)]
pub(crate) struct TokenState(pub(crate) Arc<RwLock<String>>);

/// Compares two tokens without returning early on the first different byte, so
/// a caller cannot learn the token one character at a time.
pub(crate) fn token_matches(expected: &str, provided: &str) -> bool {
    let expected = expected.as_bytes();
    let provided = provided.as_bytes();
    if expected.is_empty() || expected.len() != provided.len() {
        return false;
    }
    let mut difference = 0u8;
    for (left, right) in expected.iter().zip(provided) {
        difference |= left ^ right;
    }
    difference == 0
}

pub(crate) fn bearer(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(AUTHORIZATION)?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

/// Rejects every request that does not carry the configured bearer token. This
/// is the only gate on the loopback listener, so it runs before routing.
pub(crate) async fn require_token(
    State(expected): State<TokenState>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let current = expected.0.read().map(|token| token.clone()).unwrap_or_default();
    let allowed = bearer(request.headers()).is_some_and(|token| token_matches(&current, token));
    if !allowed {
        return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }
    next.run(request).await
}

#[cfg(test)]
#[path = "auth_tests.rs"]
mod tests;
