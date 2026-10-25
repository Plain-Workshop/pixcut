# Roadmap, engineering backlog and acceptance

## Phase 0 — validate fundamentals
Implement two competing media engine spikes (MLT, GES), native preview path in Tauri on Windows/macOS/Linux, video/audio sync, 100-photo timeline, one text/title layer, one transition. Benchmark frame seek/p95 drag latency/memory/export parity. Verify dependency licenses and codec patent distribution in target markets. **Gate:** one responsive, stable, cross-platform prototype.

## Phase 1 — Free offline editor
Home New Video/Photo Movie/Templates; media import, timeline, main preview, title and stickers, music waveforms, core transitions/animations, manual crop and fit/blur, duration presets, project persistence, autosave, 1080p MP4 export **without watermark**. No account or network in build/runtime tests. Add bundled template previews and optional PixCut outro OFF default.

## Phase 2 — usability, Polish and Pro
Readability checks, safe areas, overlay collision warnings, beat sync, scene duration and transition recommendations with reversible apply, copy/paste presets, 4K Pro exports, basic license activation, safe updater, localization English/Polish/Ukrainian; performance and accessibility passes.

## Phase 3 — advanced creator tools
Caption transcription with optional installed local models, dynamic templates, linked social variants, advanced motion/brand kits, audio polish, thumbnails, batch creation, timeline versions, richer publishing package; no mandatory cloud.

## Phase 4 — optional AI ecosystem
Local/remote providers, user opt-in AI image extend/regenerate, video outpainting R&D, plugin sandbox, advanced recipe workflows and optional hosted metering, with privacy/cost audit.

## Acceptance suite (automated and manual)
1. Fresh Win/macOS/Linux, network blocked, no account: create 30-photo movie, add title/music, export H.264 MP4 at 1080p with no watermark or final slate.
2. Fresh project export defaults `pixcut_outro=false`; user enables outro and sees explicit layer; disable and re-export contains no branded content.
3. Network-blocked edit/preview/export with unavailable license/API/cloud/AI endpoints; no login prompt and no hangs.
4. Layer/multitrack: 100 clips, 6 overlay/text lanes, timeline virtualization, frame-exact seek and render match, undo/redo.
5. Crop for 9:16 and 16:9; local fit/blur works with no models; safe-area guides omitted from actual file.
6. Preview and timeline simultaneously visible at 1366×768, 1440×900, 4K scaled UI; keyboard and screen-reader pass for key controls.
7. Auto Polish proposals do not change projects until Accept; preserve locks; Undo once restores full previous state.
8. User-selected premium template/resolution: clear pre-render notice; changing to Free alternative works without applying logo.
9. Signed updater valid/invalid packages, interrupted downloads, active export deferral, session restoration; distro packages use system updater.
10. AI provider opt-in shows upload scope/cost and supports cancel; private media absent from telemetry by default.
11. Multilingual screenshots and localization missing-key/pseudolocale tests.
12. Upgrade/downgrade/backup paths never delete original media; CI runs reproducible core tests and per-OS smoke tests.

## Work item format
Each backlog ticket: user story, relevant spec link, precise Rust/UI interfaces, migrations, entitlement gate, offline behavior, accessibility and keyboard notes, undo semantics, telemetry/privacy implications, tests and definition of done. Do not bundle too many features before real user usability tests.
