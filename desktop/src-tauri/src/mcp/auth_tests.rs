use super::*;

#[test]
fn accepts_only_the_exact_token() {
    assert!(token_matches("secret-token", "secret-token"));
    assert!(!token_matches("secret-token", "secret-toke"));
    assert!(!token_matches("secret-token", "secret-tokenn"));
    assert!(!token_matches("secret-token", "Secret-token"));
    assert!(!token_matches("", ""));
    assert!(!token_matches("secret-token", ""));
}

#[test]
fn reads_only_bearer_headers() {
    let mut headers = HeaderMap::new();
    assert!(bearer(&headers).is_none());
    headers.insert(AUTHORIZATION, "Bearer abc".parse().expect("valid header"));
    assert_eq!(bearer(&headers), Some("abc"));
    headers.insert(AUTHORIZATION, "Basic abc".parse().expect("valid header"));
    assert!(bearer(&headers).is_none());
    headers.insert(AUTHORIZATION, "Bearer   ".parse().expect("valid header"));
    assert!(bearer(&headers).is_none());
}
