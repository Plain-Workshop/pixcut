# One-click update UX and release engineering

## User story
On network availability, asynchronously check update manifest; download only suitable signed artifact (option to disable background downloads or on metered networks); verify signature and checksum; unobtrusive badge `Update ready`. Do not display modal while dragging, playing, recording, exporting, generating or saving. On close or when idle, offer `Restart & Update` / `Later`; snapshot current project and selection/playhead/workspace. Run updater after workers have stopped and files closed. After relaunch restore session and show short `What's new` card.

## Delivery
Use official Tauri 2 updater artifacts and signature verification with protected signing key; server/CI securely signs releases. Dynamic Rust/Axum endpoint or signed manifest resolves OS/architecture/install channel (stable default, beta opt-in), rollout cohort and min/max compatibility. Builds use a pinned dependency lock, SBOM and cross-platform CI, artifacts in object storage+CDN. Use code-signed Windows distribution, Apple signing/notarization; Linux native distro package formats normally update via package manager (DEB/RPM/Flatpak); Tauri AppImage update separately. No forced Tauri updater for packages owned by package manager.

## Reliability / recovery
Retry resume-download where supported; validate disk space and network loss; do not interrupt editor; retain previous compatible installers. Tauri updater does not provide automatic full rollback: implement recovery script/service only after tests. Preserve projects before schema migrations and warn before opening migrated projects with older binary. Gate staged rollout with observed crash/installation failure rates, ability to withdraw bad release. Free does not need sign-in to update; license service outage cannot block updater security fixes.

## User acceptance
Offline => check quietly skipped, Free export unaffected; network restored => check; interrupted download resumes/retries; invalid signature fails safely; user chooses Later => no recurring nag in same session; in-progress export => defers; cross-platform update retains unsaved UI state after safe save; channel mismatch never installs wrong package; downgrading incompatible data cannot silently corrupt projects.
