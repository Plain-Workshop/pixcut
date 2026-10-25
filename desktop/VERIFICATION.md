# Desktop verification — 2026-10-24

Validated on Apple Silicon macOS. This is a photo-movie editing slice; the full video-engine acceptance suite is not complete.

## Automated

- `npm run build`: TypeScript and production Vite build pass.
- `npm test`: 22 tests pass across 3 files.
  - Project tests cover cut boundaries, scene movement, malformed input, no remote image references, enforced local/no-branding policy, split, duplicate, batch update/remove/duplicate commands, field-level scene patches, color/filter/speed/fade validation, and split fade clamping.
  - Shortcut tests cover unique and conflict-free defaults, platform formatting, event matching, JSON validation, reserved OS keys, presets, and generated references.
  - Color tests cover grade detection, brightness/exposure, monochrome/intensity, temperature direction, and signed highlight/shadow lifts.
- `cargo test --manifest-path crates/project/Cargo.toml`: 14 project-model tests pass, including control validation, camelCase serialization and batch command tags, legacy snake_case fade loading, split timing/fade clamping, atomic batch edits, duplicate-many insertion, and undo.
- `cargo check --manifest-path src-tauri/Cargo.toml`: passes.
- The existing native `--include-ignored` suite (atomic save/reopen and FFmpeg encoding) was last run in the prior slice and was not rerun here. Native command signatures did not change.

## Design and icon refresh

- Home and editor restyled to the current design system: lavender home surface, gradient creation cards, project library, and a navy/violet editing workspace.
- Native icon set regenerated in `src-tauri/icons/`; `icon.icns` verified at 1024×1024 and `icon.ico` contains the generated Windows sizes.
- Browser review rerun at 1440×920 with no console errors; `npm run build`, `npm test`, and `cargo check` pass.

## Shortcut registry and command UX

- Added one typed command registry for defaults, effective bindings, categories, scopes, synonyms, presets, and platform formatting (`Mod` becomes ⌘ on macOS and Ctrl elsewhere).
- Tooltips, the searchable help overlay, command palette, first-run hints, and timeline context menus all read the same bindings and update after Apply.
- Settings → Shortcuts supports click-to-record, per-command reset/clear, reset all, PixCut/Premiere/Resolve presets, conflict replacement, reserved-key rejection, and versioned JSON import/export in local storage (`pixcut-shortcuts`).
- OS-reserved combinations such as ⌘Q, ⌘W, and ⌘Tab are rejected when recording or importing. Export uses `Mod+Shift+E` rather than macOS's native minimize shortcut.
- Browser Playwright checks with the bundled sample: split 3→4 clips, undo 4→3, redo 3→4, duplicate 4→5, delete 5→4 with `⌫`, and ripple delete 4→3 with `⇧⌫`. Frame step moved 0.000→0.033 s; L and J started playback; K stopped it; N toggled snapping; Shift+S showed the safe-area guide. Windows/Linux default to Delete and Shift+Delete.
- An out-of-range split was blocked with the half-second guidance notice. The palette executed Split from search and closed. Help filtered by both `⌘B` and “split”. The context menu showed Split/Duplicate/Ripple delete/Delete with live keys and split successfully.
- Settings recorded a deliberate `⌘S` conflict (Split vs Save), showed both commands and scopes, replaced the save binding, applied it, and updated the Save tooltip to “Unassigned”. Reset restored `⌘S`.
- JSON export produced `pixcut-shortcuts.json`. A conflicting import was rejected with “⌘S is assigned to both Save project and Split clip.” Cancel discarded a Premiere-style draft without applying it; reload kept PixCut Default and remembered dismissed hints.
- With unapplied edits, the close button, Escape, and tab changes show an in-app warning instead of discarding; Cancel is the explicit discard path. No browser dialogs are required.
- No browser console errors or page errors were observed.

## Inspector, color grading, and filters

- Color tab now exposes brightness, contrast, exposure, highlights, shadows, saturation, temperature, and tint with sliders plus exact numeric entry, Reset color, Copy, and Paste.
- Chromium check: brightness 1.5 raised average preview luminance 119.80 → 169.32; undo restored 119.80; pasted brightness read back as 1.4 on another clip.
- Speed tab: 2× changed a 4.0 s source to 2.0 s; custom 0.5× changed it to 8.0 s; the Video tab duration matched 8; pitch preference remained checked.
- Fade tab and timeline handles: dragging the in/out handles set 0.6 s each; the viewer overlay read 0.60 at 0.4 s into a 1 s fade and 0.00 past it; undo restored the fade-out.
- Filters: Original plus seven looks with search, thumbnails, hover preview, selection, and intensity. Hovering Mono dropped sampled preview saturation 15.01 → 0.00; applying it and setting intensity 45 persisted, while a “mono” search returned one card.
- Timeline fade handles stay inside the clip for hit-testing, show a live `Fade in/out 0.x s` label while dragging, and commit one undoable update on release.
- WebKit verification exposed that Canvas `ctx.filter` is unreliable even when reported as supported. The compositor now uses a portable RGBA grade pipeline shared by preview and still-frame export.
  - WebKit brightness 1.5 raised luminance 119.63 → 169.23.
  - WebKit Mono dropped sampled saturation 16.48 → 0.08; filter thumbnails rendered their looks.
  - No WebKit console or page errors.
- Native `Scene` serialization now uses camelCase (`fadeIn`, `fadeOut`, `filterIntensity`, `speed`, `pitch`), covered by a Rust test. Legacy snake_case fade keys load through compatibility aliases; other new controls default safely.
- Inspector tab switches reset the panel scroll to the top, while direct scrolling still exposes the full control set and scene actions.

## Multi-selection and batch edits

- Timeline, media, and text clips share one selection model. Shift-click selects a contiguous range; Cmd/Ctrl-click toggles individual clips; plain click selects one and moves the playhead.
- The inspector shows the primary clip, a `N selected` badge, and a banner explaining that changes apply to every selected clip, with an `Edit only this clip` escape hatch.
- Batch property updates use a field-level patch, so only changed controls propagate; unrelated per-clip values remain intact.
- Chromium checks:
  - Range-selected all three sample clips and set brightness 1.5; all three read back 1.5, and one undo restored 1.0.
  - Multi-duplicate 3→5 clips with 2 copies selected; undo restored 3.
  - Multi-delete 3→1 clips; undo restored 3 in one step.
  - Batch 2× speed on two 4 s clips produced 2.0 s each; a subsequent batch duration set both to 3.0 s.
  - Mixed 4 s/6 s clips at 2× produced 2.0 s/3.0 s, proving speed is applied per clip.
  - Batch copy/paste of brightness 1.3 reached both clips and undid in one step.
  - Batch Golden look reached both clips; batch fade-in 0.5 s reached both; each batch undid once.
  - Cmd/Ctrl toggles moved selection 1→2→1.
  - The context menu labelled `Duplicate 2 clips`, `Ripple delete 2 clips`, and `Delete 2 clips`; Split was disabled with “Select one clip to split.”
  - Fade handles are visible only on the primary selected clip (plus hover); non-primary selected clips report opacity 0.
  - Explicit look and speed presets, Reset color, fit/pitch changes, and Paste force their fields onto every selected clip even when the primary already matches; verified re-applying Golden, 2×, Reset color, and pasted brightness 1.2 to a differing clip. Duration/fade edits apply when the primary value changes.
  - No console or page errors.

## Interactive

- Browser: bundled sample loads, title edits appear in preview/timeline, undo/redo restore the expected title, portrait aspect switch works, and a PNG import adds a fourth scene.
- Browser recovery: a frontend reload returns to home with the last project available to resume.
- Layout inspected at 1440×920 and 1366×768. Preview and timeline stay visible together, including portrait canvas. Inspector and library scroll independently at shorter heights.
- Packaged native application opened at `tauri://localhost`; loaded the bundled sample and showed Rust-owned saved state.
- Native save dialog produced a portable `.pixcut.json` project with three embedded images and `watermark=false`, `pixcut_outro=false`, `privacy=local`.
- Native export dialog produced `output/playwright/PixCut sample.mp4`. ffprobe reports H.264, 1920×1080, 12.000 seconds, 360 frames. The first exported frame was visually checked for the expected scene/title and absence of added branding.

## Local review artifacts

- `output/playwright/home.png` (updated light home)
- `output/playwright/editor.png` (updated navy editor)
- `output/playwright/portrait-1366.png`
- `output/playwright/shortcuts-home.png`
- `output/playwright/shortcuts-editor-hints.png`
- `output/playwright/shortcuts-editor-split.png`
- `output/playwright/shortcuts-help.png`
- `output/playwright/shortcuts-help-filtered.png`
- `output/playwright/shortcuts-palette.png`
- `output/playwright/shortcuts-settings.png`
- `output/playwright/shortcuts-conflict.png`
- `output/playwright/shortcuts-context-menu.png`
- `output/playwright/inspector-color.png`
- `output/playwright/inspector-color-actions.png`
- `output/playwright/inspector-speed.png`
- `output/playwright/inspector-fade.png`
- `output/playwright/inspector-fade-drag.png`
- `output/playwright/inspector-filters.png`
- `output/playwright/webkit-color.png`
- `output/playwright/webkit-filters.png`
- `output/playwright/multi-select.png`
- `output/playwright/multi-select-context.png`
- `output/playwright/export-frame.png`
- `output/playwright/PixCut sample.mp4`
- `output/playwright/PixCut sample.pixcut.json`
- `src-tauri/target/debug/bundle/macos/PixCut.app`

Generated review outputs and build artifacts are ignored. Automated test fixtures and both dependency lockfiles are retained in the desktop project.

## Remaining validation

Windows/Linux builds, signing/notarization, FFmpeg redistribution, full native media-engine integration, audio/video import, transitions, MP4 fade encoding, speed curves/reverse playback, audio fades, accessible screen-reader flows, large-media stress tests, and interrupted-export recovery remain future work. Browser preview does not export MP4; use the native app. The new inspector was exercised in Chromium and WebKit headless, and multi-selection in Chromium; a final packaged-app pass is still worthwhile.
