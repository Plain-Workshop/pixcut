# Desktop verification — 2026-10-25

Validated on Apple Silicon macOS. This is a photo-movie editing slice; the full video-engine acceptance suite is not complete.

## Automated

- `npm run build`: TypeScript and production Vite build pass.
- `npm test`: 34 tests pass across 3 files.
  - Project tests cover cut boundaries, scene movement, malformed input, no remote image references, enforced local/no-branding policy, split, duplicate, batch update/remove/duplicate commands, field-level scene patches, color/filter/speed/fade/text-effect validation, split fade clamping, in-place image replacement preserving timing, text, and looks, frame-tick conversion, schema v1/v2/v3 migration, visual-track wrapping, multiple audio clip/trim validation, legacy music migration, free-positioned text styling, independent timed text layers, transitions, text animations, image-framing controls, and per-format override validation.
  - Shortcut tests cover unique and conflict-free defaults, platform formatting, event matching, JSON validation, reserved OS keys, presets, and generated references.
  - Color tests cover grade detection, brightness/exposure, monochrome/intensity, temperature direction, and signed highlight/shadow lifts.
- `cargo test --manifest-path crates/project/Cargo.toml`: 24 project-model tests pass, including control validation, camelCase serialization and batch command tags, legacy snake_case fade loading, split timing/fade clamping, atomic batch edits, duplicate-many insertion, undo, schema v1 second-to-tick migration, v2-to-v3 visual-track wrapping, start-tick normalization after move, audio validation/commands, legacy music migration, local asset-reference validation, text layout validation/serialization, text-layer migration/splitting, transition and text-animation validation, per-format override validation, and tick serialization.
- `cargo test --manifest-path src-tauri/Cargo.toml project_filename_is_safe_and_bounded`: passes; exported filenames strip path separators, fall back safely, and cap at 80 characters.
- `cargo check --manifest-path src-tauri/Cargo.toml`: passes.
- `npm run tauri -- build --debug --bundles app`: passes and produces `PixCut.app` (48.28 MiB debug) with the `.pixcut` document type and updater artifacts.
- `plutil -p .../Info.plist`: `CFBundleDocumentTypes` contains extension `pixcut`, name `PixCut Project`, role `Editor`, and default handler rank.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 8 non-ignored native tests pass (atomic save/reopen, invalid export preservation, cancelled export writes nothing, filename safety, legacy JSON migration, binary `.pixcut` roundtrip, bundle asset deduplication, and app-data asset-store roundtrip/deduplication).
- `cargo test --manifest-path src-tauri/Cargo.toml -- --ignored`: all three real FFmpeg tests pass, including export-progress emission; the video remains 1920×1080 H.264 with 30 frames and 1.0 s, and the multi-audio export contains a 1-channel AAC audio stream.

## Export cancellation, project frame rates, and CI gates

- Export now has a **Cancel export** action during both frame rendering and FFmpeg encoding. The native command sets an atomic flag, kills the encoder within ~120 ms, removes the temporary output, and leaves any previous destination file untouched.
- A cancelled export reports "Export cancelled. No file was written." instead of an error card.
- New native test `cancelled_export_writes_nothing` covers the pre-cancelled path; total non-ignored native tests are now 8.
- The new-project dialog offers **24, 25, 30, or 60 fps**. `emptyProject(name, aspect, fps)` derives the rational timebase, unknown rates fall back to 30, and per-format FPS also lists 25 fps. Tests cover 24/60 fps and the fallback.
- Updates gain a **Copy download link** fallback when the feed cannot be reached or verified.
- The export dialog shows a platform-specific FFmpeg install command (`brew install ffmpeg`, `winget install Gyan.FFmpeg`, or `sudo apt install ffmpeg`) when the encoder is missing.
- CI now runs a packaging smoke build on macOS (`app`) and Windows (`nsis`) for main pushes and manual runs, using `src-tauri/tauri.ci.conf.json` to disable updater signing. It also runs `cargo audit` and desktop `npm audit`.
- `cargo audit` reports three `zip` extraction advisories (RUSTSEC-2026-0367/0368/0369) in `zip` 2.6.1 and the updater's 4.6.1. PixCut never calls `ZipArchive::extract`; it reads entries with `by_name` and writes with `ZipWriter`, so the advisories are documented and ignored in CI until upstream ships `zip >= 9`.
- Verification: 34 TypeScript tests, 24 project-model tests, 8 native tests, and 3 FFmpeg tests pass; `actionlint` is clean on all workflows.
- First unsigned draft release: [run 40217279382](https://github.com/Plain-Workshop/pixcut/actions/runs/40217279382) built and published a draft `v0.1.0` with all four platforms, `latest.json` for 4 platforms, `SHA256SUMS.txt`, and 9 installer/updater assets. The draft is intentionally left unpublished for review.
- The first full GitHub dry run ([run 40214818313](https://github.com/Plain-Workshop/pixcut/actions/runs/40214818313)) passed on all four runners: macOS arm64, macOS x64 (cross-built on an arm runner), Windows x64, and Linux x86_64, after the version and test gates. Windows produced NSIS, MSI, and portable ZIP; Linux produced AppImage and deb; macOS produced DMG and updater tarball plus signature. Packaging-only failures found and fixed during the run: an extra `--` forwarded bundle flags to Cargo, empty Apple secrets requested a certificate import, an unsupported `macos-15-intel` label, a YAML alias GitHub rejects, and a case-sensitive Linux binary check.

## Video import and preview (media-engine slice 1)

- Added optional `mediaKind` and `videoPoster` fields to the scene model in both TypeScript and Rust, serialized only when present so existing projects stay compatible.
- Import accepts MP4, MOV, and M4V up to 50 MB in the native app; the browser preview also accepts WebM. The app reads the file, decodes metadata, captures a 480 px JPEG poster, and adds a video scene with a clamped 0.5–30 s duration.
- The preview uses a hidden `<video>` element, keeps it within 120 ms of the playhead, pauses on scrub, and draws the current frame into the existing canvas compositor so text layers, framing, and color grading still apply.
- Media tiles and timeline clips show the poster frame with a **VIDEO** badge; library thumbnails use the poster through the existing `drawScene` path.
- Native persistence stores video bytes in the content-addressed asset store (`assets/<sha>.mp4`) and hydrates them back to data URLs; the `.pixcut` bundle already handles the same MIME types. A new roundtrip test covers it.
- Video export uses a new FFmpeg plan path: image segments stay as rendered PNGs, video segments are trimmed and normalized, text overlays are composited as transparent PNGs, and the existing audio mix is preserved. Transitions touching video become hard cuts; video color grading, fades, and speed changes are not applied yet. (Superseded by the video export parity section below.)
- Verification: imported a 2 s VP9 WebM through the browser preview; the poster rendered, the timeline showed `VIDEO`, the recovery record contained `mediaKind: 'video'` and a JPEG poster, and there were no console errors. Screenshot: `output/playwright/video-import-chromium.png`.
- Ignored FFmpeg test `plan_export_encodes_video_and_image_segments` mixes one image segment, one trimmed video segment, and a timed transparent text overlay; the output is H.264, exactly 1.00 s, and includes the audio mix when present.
- Tests: 34 TypeScript, 24 project-model, 9 native, 4 FFmpeg. `tsc` and production build pass.

## Usability pass: margins, audio delete, labels, blur, shortcuts, social elements, playhead

- Home is flush again: no outer margin, no rounded card, no extra border. The sidebar is fixed to the viewport and only the main column scrolls (`x=0, y=0, 250×1000`). The **Offline first** badge was removed; the status reads **Saved** and the editor badge **Local only**.
- Clicking an audio clip now clears the scene selection, so the scene delete button disappears. `Delete`/`Backspace` with an audio clip selected removes only the audio; the scene count stayed 3 in the regression check.
- Scene actions (replace, duplicate, delete) only appear when a clip is explicitly selected; the active scene no longer acts as an implicit selection for destructive actions.
- Status text is now **Saved**; the editor badge says **Local only** instead of the misleading **Offline** toggle.
- Shortcut help and settings text increased to 10–12 px with larger keys and descriptions.
- Blur fill now uses a 6× higher-resolution sample, high-quality smoothing, and an optional canvas blur; it no longer looks pixelated. The image-zoom slider accepts 100% in blur mode.
- Expanded elements to 22 kinds: Subscribe, Like, Bell, Comment, Share, Play, Progress, Location, Music, Check, Cross, Ring, Cursor, Underline, plus the original shapes. Elements now look like other timeline clips, get a small cascade offset when added, and support pulse/float animations. Entry animations remain preview-accurate and are approximated in exports.
- The vertical playhead is draggable across its full height (scrubber value changed from 0 to 1.67 s in the check).
- Text, element, image-pan, audio-trim, scene-reorder, and playhead drags were exercised; all changed project state without console errors.
- Not implemented: a second/third video track for picture-in-picture. It needs a multi-track compositor, multi-track export, and a track UI; the current model intentionally validates one visual track.
- Tests: 34 TypeScript, 26 project-model, 10 native, 4 FFmpeg; `npm run ci` passes. Screenshots: `home-margins-chromium.png`, `social-elements-chromium.png`, `blur-fill-chromium.png`, `audio-delete-chromium.png`.

## Elements, photo motion, text lanes, transitions, audio trim, and MP4 import

- Added shape/sticker element layers (`elements` on a scene) with rectangle, circle, triangle, star, sparkle, line, arrow, and heart shapes. Each has color, opacity, size, rotation, start/duration, and a fade/pop/slide entrance. Elements render below text, above the photo, drag on the canvas, appear in their own timeline lane, and are included in image and video export.
- Added photo motion: zoom in/out, pan in four directions, and Ken Burns with an amount slider. Image exports split the scene at 0.5 s intervals so the motion is baked into the MP4; video clips skip photo motion for now.
- The text timeline now renders one chip per layer at its actual start and duration, stacked into lanes when layers overlap, instead of one chip per whole scene.
- Added four transitions: Soft blur, Circle, Slide up, and Spin, alongside Crossfade, Slide, Wipe, and Zoom.
- Audio trim handles are always visible and wider, with tooltips; the Audio panel keeps numeric start/trim-in/duration sliders. Verified a drag changed a 3.0 s clip to 2.0 s.
- The home sidebar is fixed to the viewport; only the main content column scrolls.
- Timeline rows are ordered Visuals → Audio → Text → Elements, with track numbers following that order. The visual clip name sits in a bottom gradient bar instead of the middle.
- Timeline zoom goes down to 50%; the ruler and scrubber are sticky at the top of the timeline while lanes scroll vertically.
- Fixed MP4/MOV import: the Rust validator accepted only image data URLs, so a valid video scene failed with “Invalid scene, image, or duration.” It now accepts `video/mp4`, `video/quicktime`, `video/x-m4v`, and `video/webm`, validates the poster, and raises the media budget to 140 MB. A Rust test covers a video payload and rejects a mismatched kind. A browser check imported a 2 s H.264 MP4 without an error banner.
- Split now clips element timings on both halves, and element timings are clamped when a scene gets shorter.
- Verification: 34 TypeScript, 26 project-model, 10 native, 4 FFmpeg tests; `tsc`, production build, and `npm run ci` pass. Screenshots: `elements-panel-chromium.png`, `element-star-chromium.png`, `motion-zoom-chromium.png`, `final-editor-chromium.png`.

## Engineering guardrails and the first live release

- Added `AGENTS.md` with architecture, commands, and the rules that matter: never crash, stay offline, no paid tiers, schema migrations in both models, preview/export parity, tests and screenshots, release safety.
- Added `npm run ci` (`scripts/ci.mjs`): site build and link check, desktop tests and build, version consistency, project-model and native Rust tests, plus optional `actionlint` and `cargo audit` when installed.
- Added a `guard()` wrapper around command dispatch and both FFmpeg export paths. A panic now returns a friendly "PixCut recovered… your work is still saved" error instead of taking down the editor. New test `guard_turns_a_panic_into_a_friendly_error`.
- Diagnostics now include the build commit and build date (`VITE_BUILD_SHA` / `VITE_BUILD_DATE` from CI; `dev` and the local build time otherwise).
- Added the OpenSSF Scorecard workflow.
- Removed `PUBLIC_GITHUB_URL`; `site.ts` uses the repository URL directly.
- Published the first unsigned release: [v0.1.0](https://github.com/Plain-Workshop/pixcut/releases/tag/v0.1.0) with macOS arm64/x64 DMGs, Windows NSIS/MSI/portable, Linux AppImage/deb, `latest.json` and `SHA256SUMS.txt`.
- Verified the live update feed: `https://github.com/Plain-Workshop/pixcut/releases/latest/download/latest.json` returns `200` with version `0.1.0` and all four platform keys.
- Tests: 34 TypeScript, 24 project-model, 10 native, 4 FFmpeg.

## Open-source plan removal

- Removed the legacy paid portal (customer and admin builds) from the workspace. It was untracked build output from the old Free / Pro monthly / Pro annual / Perpetual plans, including license activation, device slots, Stripe checkout and subscription management. It is recoverable from the macOS Trash.
- Removed the unused pricing and plan CSS from the website, including the leftover responsive `.price-card` rule.
- Removed the leftover `free` flag and `data-free` attribute from the website template catalogue; every template was already marked free, so the field only carried old tier logic.
- Removed tier language from the site and documentation: no "Download Free" CTA and no "open-source build" qualifiers that implied a separate paid build.
- Every capability that the old Pro tier listed is available without a gate in the desktop app:
  - 4K export: formats validate from 240 px to 3840 px on both edges, with no resolution tier.
  - Batch social export: multiple selected formats export into one folder.
  - Advanced effects and motion: transitions, text animations, filters, color grading, framing.
  - Templates: all five built-in template families.
  - No account, license key, activation server, watermark, or device limit.
- Website rebuild: 16 pages, `node scripts/check-links.mjs` passes on all 16 routes.

## Release pipeline and in-app updates

- `.github/workflows/release.yml` is tag-driven (`v*`) with a manual dry-run mode. It resolves one version, builds macOS arm64 and x64, Windows x64 (NSIS, MSI, portable ZIP), and Linux x86_64 (AppImage, deb), verifies each output, then creates a **draft** GitHub Release with `latest.json` and `SHA256SUMS.txt`.
- Tag builds fail fast when Apple or Windows signing secrets are missing, so an unsigned installer cannot be published through a tag. Signing secrets themselves are not in the repository.
- `.github/workflows/packaging-lint.yml` runs `actionlint`, validates the Tauri/updater config, checks version consistency across manifests, and checks shell syntax on workflow changes.
- `tauri-plugin-updater` and `tauri-plugin-process` are registered; the main window capability grants `updater:default` and `process:allow-restart`.
- Settings → Updates now shows the installed version, an explicit **Check for updates** action, release notes, download progress, and **Restart to update**. Browser preview disables the action and says updates belong to the installed app.
- `scripts/version.mjs` keeps `tauri.conf.json`, `package.json`, both lockfiles, and `Cargo.toml` in sync; `npm run version:check` detects drift.
- Local release build: `PixCut.app` 16.57 MiB, DMG 6.41 MiB, updater `.app.tar.gz` 6.47 MiB with a valid `.sig`.
- Feed assembly dry run produced a valid one-platform `latest.json` and matching `SHA256SUMS.txt`; the script rejects a missing updater artifact, missing `.sig`, or empty signature.
- `actionlint` reports no issues on `release.yml` or `packaging-lint.yml`.
- Browser check at 1440×920: the Updates card rendered at 488 px wide, the check button was disabled in preview, diagnostics reported schema 7 and the real version, and there were no console or page errors. Screenshot: `output/playwright/updates-panel-chromium.png`.
- Not yet verified: a notarized DMG, an Authenticode-signed installer, and a real update from an older published build. Those require Apple and Windows certificates.

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

## Text legibility and effects

- Split text styling into four independent groups, each with its own toggle, controls, and visual template buttons:
  - **Backdrop** — color, opacity, blur, padding, radius, noise.
  - **Outline** — color and width.
  - **Glow** — additive three-pass halo with color, blur, and intensity.
  - **Drop shadow** — color, blur, intensity, and X/Y offset.
- `Make text readable` is a combo preset for backdrop + outline + shadow; it leaves glow off. `Reset effects` clears all groups.
- There are 18 template buttons total: 5 backdrop, 4 outline, 5 glow, 4 shadow. Each button contains an `Aa` preview and applies only its own group.
- The glow is now visually separate from the drop shadow: an additive multi-pass halo rather than a dark shadow offset. The compositor draws drop shadow, then glow, then outline, then fill.
- Browser checks:
  - Initial state had all four groups off. Enabling Outline changed only Outline; enabling Glow changed only Glow; enabling Backdrop changed only Backdrop. Turning Backdrop off left Outline/Glow/Shadow enabled. Reset cleared all four.
  - The readable preset enabled Backdrop/Outline/Shadow and left Glow off.
  - 18 template cards rendered. `Dark glass` and `Neon` showed active states. Neon read back `#9b7cff`, blur 28, intensity 70.
  - Neon + Dark glass persisted after switching clips and back.
  - Copy/paste from one clip to another carried the glow and backdrop group settings.
  - Backdrop color now runs through a color blend before the opacity plate, so the plate does not inherit the photo’s green cast. Chromium sampled chroma `9.9 → 1.1`; WebKit `9.4 → 0.9`. Template preview stages were changed from green to neutral slate.
  - Backdrop/readability rendering remains shared with still-frame export.
  - No console or page errors.
- Screenshots: `output/playwright/text-effects-panel.png`, `text-glow.png`, `text-effects-groups.png`, `text-backdrop-neutral-chromium.png`, `text-backdrop-neutral-webkit.png`.

## Rational timebase, schema v7, and audio clips

- Project schema is now v7 with `timebase: { numerator: 1, denominator: 30 }`, one `visual` track, clips carrying `startTicks`, `sourceInTicks`, and `durationTicks`, multiple audio clips, independent timed text layers, transitions, and text animations. Floating-point scene seconds are no longer stored.
- Split, scene duration, speed, total duration, playback frame stepping, timeline labels, and export durations all derive from ticks. `mod 30` timecode is frame-exact.
- Start ticks are normalized on validation and after every edit command, so the current UI remains contiguous while the wire format has real clip positions.
- Schema v1–v6 projects migrate on read: v1 second-based `duration` becomes rounded ticks; v1/v2 wrap scenes into a visual track; v3/v4 music becomes a positioned audio clip; v5 scene title/subtitle/text styling becomes the first independent text layer. Browser recovery is rewritten to v7 immediately; native recovery is migrated and atomically rewritten, while user-opened project files are only migrated in memory (the source file is not modified).
- Library summaries carry an optional timebase for correct card timecodes, and legacy stored projects migrate through `validateProject` on read.
- Added tests for tick conversion, frame-quantized duration, timecode, exact split boundaries, v1 second-to-tick migration, v2-to-v3 track wrapping, v3 track validation, and source-file non-mutation.
- Browser checks, Chromium and WebKit:
  - Seeded a v1 recovery project with a 4.0 s scene; reload produced v7 with one visual track, clip `legacy-scene:0+120`, no legacy `duration`, and no legacy `scenes`.
  - Travel clips stored `0+120 | 120+120 | 240+135`.
  - Split at 1.5 s produced `0+45 | 45+75 | 120+120 | 240+135`.
  - Moving the 75-tick clip earlier produced `0+75 | 75+45 | 120+120 | 240+135`; undo restored the split layout.
  - Library records for the migrated legacy project and the edited Travel project were both v7 with one track.
  - Duration 3.3 s stored `99` ticks; 2× stored `50` ticks with speed `2` and a frame-quantized 1.7 s result.
  - No console or page errors.
- Screenshots: `output/playwright/timebase-chromium.png`, `tracks-chromium.png`.
- Boundary: the wire format has a track/clip container, but the UI still edits one contiguous visual track plus a derived text lane. Multi-track editing, gaps, trim/source-in handles, VFR conversion, and engine timing are not implemented yet; the app still creates 30 fps projects.

## Portable `.pixcut` packages and OS association

- Native project save/open now uses a `.pixcut` ZIP package:
  - `manifest.json` with format/version, project JSON, and an asset table.
  - `assets/<sha256>.<ext>` for images and audio.
  - Manifest references assets as `pixcut-asset:<hash>`; no base64 media in the saved manifest.
  - SHA-256 and byte-length checks run on load; unsafe paths, oversized assets, and unsupported MIME types are rejected.
  - Binary entries use ZIP `Stored`; duplicate media is stored once.
- Save/export filenames use `<project>.pixcut`. The open dialog accepts `.pixcut` and legacy `.json`; the loader detects ZIP magic versus legacy JSON.
- Bundled app registers the `.pixcut` document type for macOS:
  - `CFBundleDocumentTypes` contains extension `pixcut`, role `Editor`, default handler rank.
  - Startup paths are captured from command-line arguments.
  - macOS `RunEvent::Opened` sets a pending open and emits `project-opened`; the frontend consumes it through `take_pending_project`.
  - The frontend also polls once after subscribing so an early open event cannot be lost.
- Native tests:
  - Binary bundle roundtrip with two PNG assets and one WAV asset preserves the full project.
  - Manifest contains `pixcut-asset:` and contains neither `data:image` nor `data:audio`.
  - Two identical images produce one asset entry and roundtrip correctly.
  - Legacy JSON project files still open and migrate.
- `PixCut.app` built successfully; `Info.plist` association inspected with `plutil`.
- Not verified here: an interactive Finder double-click in a signed/installed build. The document type and open handler compile and the association is present in the generated bundle. Windows/Linux installer registration remains release work.
- Boundary: `.pixcut`, native recovery, and the browser recovery/library now store assets separately, but native and webview stores are not unified; relinking and asset GC are still future work.

## Shared content-addressed asset store

- Native recovery now stores media in `<app-data>/assets/<sha256>.<ext>` and writes a small recovery manifest containing `pixcut-asset:<hash>` references. The session is hydrated back to data URLs for the existing Canvas renderer.
- Browser recovery and the library use an IndexedDB asset store (`pixcut-assets`) with the same reference format. Library rows and recovery records no longer contain embedded image/audio payloads.
- `saveLibraryProject` extracts inline media into the store before writing the project row; `getLibraryProject` hydrates references on read and migrates old inline projects back into the store.
- Duplicating a project copies references, not media. Identical assets are deduplicated by SHA-256.
- Native `.pixcut` save hydrates any references from the app-data store before packaging, so packages always contain the binary assets.
- Added a Rust test covering persist/hydrate roundtrip and deduplication, plus an asset-reference validation test.
- Browser checks, Chromium and WebKit:
  - Travel library and recovery records stored `pixcut-asset:` references for all 3 images.
  - Restarting the page hydrated the media back to `data:image/jpeg` for the renderer.
  - Importing audio added one asset reference and stored one audio asset.
  - Duplicating the project left the asset count unchanged at 4 while project count became 2.
  - Reopening the duplicate hydrated both audio and images.
  - No console or page errors.
- Screenshot: `output/playwright/asset-store-chromium.png`.
- Boundary: native recovery assets and webview library assets are still separate stores; missing-media relinking, unreferenced-asset cleanup, and a unified SQLite-backed native store remain future work.

## Movable text and bundled fonts

- Added per-scene text layout and typography:
  - X/Y position, text box width, rotation, opacity, alignment.
  - Font family, weight, italic, size, line height, letter spacing, subtitle scale.
  - Title/subtitle wrapping and measured text bounds.
- Added direct manipulation on the preview:
  - dashed text bounding box with drag-to-move.
  - left/right resize handles.
  - snapping to canvas edges and center.
  - inline text editing at the text box.
- Added a typography inspector with live font preview, font size, weight, italic, alignment, position, spacing, rotation, opacity, and subtitle scale controls.
- Bundled eight offline fonts under the SIL Open Font License:
  - Inter
  - Space Grotesk
  - DM Sans
  - Playfair Display
  - Libre Baskerville
  - Bebas Neue
  - Archivo Black
  - Caveat
- Added `public/fonts/OFL.txt` and `public/fonts/LICENSES.md`.
- Canvas rendering and text measurement use the same font files and layout function; `drawScene` waits for the selected fonts before drawing.
- Browser checks, Chromium and WebKit:
  - Family template text box measured and rendered inside the canvas.
  - Dragging moved the text to X `0.18`, Y `0.85`.
  - Switching to Playfair Display loaded the font (`document.fonts.check` true) and rendered it.
  - Setting size `110 px` stored normalized size `0.10185`.
  - Center alignment applied.
  - Dragging the right handle changed width to `0.7075`.
  - Double-click opened the inline editing overlay.
  - Fixed the commit signature so text layout fields are included. Verified these persist after release in Chromium and WebKit: text size `0.1111`, X `0.2`, Y `0.4`, width `0.5`, rotation `15`, line height `1.5`, letter spacing `0.0111`, opacity `70`, subtitle scale `0.6`.
  - Range-slider drag commits also persist: size `0.1296`, X `0.3`, rotation `20`, opacity `55`.
  - No console or page errors.
- Screenshots: `output/playwright/text-move-fonts-chromium.png`, `text-edit-chromium.png`, `text-slider-persistence-chromium.png`.
- Boundary: text layers are independent inside a scene. Cross-scene text, animations, layer grouping, and user font import remain future work.

## Independent text layers, timing, and reset

- Added a `textLayers` array to each scene. Each layer owns its content, style, position, effects, and scene-relative in/out timing.
- Schema v6 migrates the previous one-block scene text into the first layer; deleting every layer also clears the legacy fallback fields.
- The inspector now has a dedicated **Text** tab with a layer list, add/delete, layer timing, and a unified **Reset text styling** button. Reset restores font, size, position, spacing, opacity, and effects while keeping the words and timing; **Reset timing** is separate.
- Canvas drag/resize and double-click inline editing now target the selected layer. Selecting a layer seeks the playhead to its start so its box is visible.
- Preview renders only layers active at the playhead. MP4 export splits each scene at text in/out boundaries, so timed layers appear at the correct moment.
- Commit no longer clears the preview before the asynchronous update resolves. A canvas hash stayed identical across pointer release at 0/16/32/64/120/240 ms, confirming no one-frame snap-back.
- Browser checks, Chromium and WebKit:
  - Opened the Family template and added a second layer; both engines stored schema v6 with two layers on the first scene.
  - Changed the new layer to 150 px and an appear time of 1.0 s. Stored timing was `startTicks = 30`, `durationTicks = 75`.
  - At 0 s no text box was shown for the 1.0 s layer; at 1.2 s it was visible.
  - Reset styling restored `size = 0.068`, `x = 0.09`, and default effects while keeping the text.
  - Dragging the layer updated its position without a release flicker.
  - Selecting a PNG in the audio picker showed: “PixCut Marketing Website Collage.png” is an image, not audio. Choose an MP3, WAV, M4A, OGG, or WebM audio file. There was no raw `Error:` prefix.
  - No console or page errors.
- Screenshot: `output/playwright/text-layers-chromium.png`.

## Multiple audio clips and trimming

- Replaced the single project-level music bed with an `audio` array. Each clip has start, duration, source-in, source duration, volume, fade-in, and fade-out.
- Add audio at the playhead; multiple clips can overlap and mix.
- Timeline clips can be dragged to move and trimmed from either edge.
- Audio panel controls: start, trim-in, duration, volume, fade-in, and fade-out.
- Playback uses one hidden audio element per clip; all active clips mix and follow the playhead and fades.
- Export writes each clip to a temp file, seeks to its trim-in point, delays it to its timeline start, applies volume/fades, and mixes all clips with `amix` into AAC 192 kbps.
- Schema v6 retains the v5 audio migration: an existing v4 music bed becomes one audio clip at 0:00.
- Browser checks, Chromium and WebKit:
  - Imported an 8.6 MB WAV into a 12.5 s project. It was accepted (the old 8 MB cap rejected it) and stored as an asset reference with a 565 s source duration.
  - Added a 2 s clip at 0:00 and a 3 s clip at 0:05. Stored starts were `0` and `150` ticks; durations `60` and `90`; schema v7.
  - Dragging the first clip changed start to `16` ticks.
  - Right-edge trim changed duration to `48` ticks.
  - Trim-in `0.5 s` stored `sourceInSeconds = 0.5` and reduced duration to `45` ticks.
  - Removing the second clip left one audio clip, one timeline clip, and one audio element.
  - Playback at 0:00 played only the first clip; at 0:05 it played only the second.
  - No console or page errors.
- Native FFmpeg test: two audio clips export as one mixed 1-channel AAC stream alongside H.264.
- Screenshot: `output/playwright/audio-multi-chromium.png`.
- Boundary: each audio file can be up to 50 MB and a project up to 200 MB. All clips live in one audio lane. Separate audio tracks, waveforms, ducking, voiceover, and clip-level effects are still future work.

## Wider new-project modal, 4K presets, and timeline playhead

- The **A fresh start** dialog now uses a 760 px medium width, so the custom-size form and 15 format presets fit without horizontal squeeze.
- Added 4K presets:
  - 4K Landscape — 3840×2160
  - 4K Vertical — 2160×3840
  - 4K Square — 2160×2160
- Custom formats already accept even dimensions up to 3840×3840, so 4K social masters are supported. Export renders at the saved format size and uses the format’s FPS/quality.
- Added a live vertical playhead line spanning the ruler and all timeline lanes. It follows timeline zoom and horizontal scrolling and updates during playback.
- Chromium check:
  - New-project modal measured `760×828`; all 15 presets and the custom-size fields were visible.
  - Playhead at 2 s measured x=769 against a track starting at x=166 and 1206 px wide, matching the midpoint.
  - No console or page errors.
- Screenshots: `wide-new-project-chromium.png`, `timeline-playhead-chromium.png`.

## Legacy audio-project open fix

- Older projects saved before audio lanes existed could fail validation with `Invalid audio track.` because the lane field was required before the default was applied.
- Validation now treats a missing lane as lane 0 for both legacy recovery records and imported project files. Error titles also classify invalid project audio as an open failure instead of a media-format problem.
- Browser regression: seeded a project with `Legacy.wav` and deleted its `lane` field, then reloaded. The app recovered without an error banner, kept the audio clip, and migrated the missing lane to 0.
- Added a TypeScript regression assertion for a legacy audio clip without `lane`.
- Browser console and page errors: none.

## Social media presets and custom sizes

- Expanded deliverables to 12 checkbox presets with exact platform sizes: YouTube Video (1920×1080), YouTube Shorts (1080×1920), Instagram Post (1080×1350), Instagram Reels (1080×1920), Instagram Story (1080×1920), TikTok (1080×1920), Facebook Post (1080×1350), Facebook Reels (1080×1920), X/Twitter (1920×1080), LinkedIn (1080×1080), Pinterest (1000×1500), and Snapchat (1080×1920).
- Formats persist width, height, FPS, quality, preset ID, and per-scene framing overrides. Name and size can be edited after creation; custom formats accept any even width/height from 240–3840 plus FPS and quality.
- The Deliverables modal shows social checkboxes, selected formats, active-format settings, custom-format creation, and a common-vs-per-format explanation.
- Preview, text layout, thumbnails, transitions, and batch export use the active format’s real width/height rather than a fixed four-ratio lookup.
- Browser checks, Chromium:
  - New project showed 12 social checkboxes; selected YouTube Video, Instagram Post, and Instagram Reels.
  - Reels preview rendered at 1080×1920; YouTube framing stored `zoom 1.4 / contain / #101820`; Reels stored `zoom 2.2 / contain`.
  - Edited Reels to 60 fps/high quality, then added custom `Client 2:3` at 1000×1500, 24 fps, draft.
  - Export listed all four formats with their saved sizes and settings and previewed four filenames.
  - No console or page errors.
- Screenshots: `social-formats-create-chromium.png`, `social-formats-manager-chromium.png`, `social-reels-framing-chromium.png`, `social-export-formats-chromium.png`.

## Multi-format deliverables

- Projects now store up to six output formats (`formats` in schema v7), each with a platform name, aspect, and scene framing overrides.
- New projects can select YouTube, Reels & TikTok, Instagram Feed, Square, and Story before starting. The preview header switches formats; the Deliverables modal adds/removes formats and explains common vs per-format fields.
- Per-format: canvas aspect, image zoom/pan/fit/letterbox, and export resolution. Common: photos, text content/style, timing, transitions, audio, and looks.
- The framing inspector shows which format the override belongs to and offers **Apply framing to all formats**.
- Export supports selecting multiple formats, renders each aspect with its own framing, and writes all selected files into one chosen folder. Filenames include the format name when exporting more than one.
- Browser checks, Chromium:
  - Created a blank project with YouTube, Reels & TikTok, and Instagram Feed.
  - YouTube framing stored `zoom 1.4`, `contain`, `#101820`; Reels stored `zoom 2.2`, `contain`; Instagram Feed remained unedited.
  - Switching back to YouTube restored its own framing.
  - Export dialog listed three checked formats and previewed per-format filenames.
  - No console or page errors.
- Screenshots: `new-project-formats-chromium.png`, `formats-manager-chromium.png`, `multi-format-reels-chromium.png`, `export-formats-chromium.png`.
- Boundary: automatic per-format text repositioning is not implemented; text layout remains common. Video overlays remain blocked by the media engine.

## Image framing, zoom, and letterboxing

- Added per-scene image framing fields: fit mode, zoom (100–400%), horizontal/vertical pan, and letterbox color.
- **Fill** crops the image to the frame; **Fit** shows the whole image with the chosen background color; **Blur fill** keeps the blurred backdrop and frames the image above it.
- The Video inspector exposes zoom, pan, letterbox color, Center, Reset framing, and a **Drag on canvas** mode.
- Canvas drag mode overlays a rule-of-thirds guide and repositions the image with live preview; releasing commits one undoable update.
- The same geometry is used by the viewer, project thumbnails, template previews, and MP4 export.
- Verified with a square Product image switched to 16:9: the stored framing was `contain`, zoom `1.6`, X `0.1646`, Y `-0.13`, letterbox `#101820`; dark side bars and the repositioned subject were visible. No console errors.
- Screenshot: `output/playwright/image-framing-chromium.png`.

## Transitions, text animation, and timeline reorder

- Added scene-boundary transitions stored in schema v7: Crossfade, Slide, Wipe, and Zoom, with a clamped 0.1–2 s duration. Last scenes keep the setting but have no next clip to blend into.
- Preview composites the outgoing and incoming scene during the transition. Export adds transition boundaries to its frame segments and renders both stills at the correct progress, so transitions reach the MP4.
- Added text entrance/exit animations to every layer: Fade, Slide up, Slide left, and Pop, each with a 0.1–2 s speed. Preview and export share the same renderer; the Text inspector exposes an Animation section.
- The Transitions and Effects left-rail panels are now functional rather than placeholders. Transitions applies a transition in one click; Effects applies Original or any look with a sensible default intensity.
- Visual timeline clips can be dragged to reorder. Fade handles are excluded from drag starts, and file drops still replace images.
- Project library gained search, sort, favorites, and a group manager for rename/remove.
- Export modal shows live frame-render progress and then waits for FFmpeg encoding.
- Browser checks, Chromium and WebKit:
  - Crossfade persisted as `{ type: 'fade', duration: 0.6 }`; the Transitions panel changed it to Wipe; Effects applied Vivid.
  - Text animation persisted as `slide-up` with `animationDuration = 0.5`.
  - Dragging the first visual clip onto the second reordered the project to `The scenic route`, `Morning in the mountains`, `A quieter place`.
  - Search matched one project; favorite toggled on; the Favorites filter returned the same project.
  - The group manager renamed `Client work` to `Client projects` and removed it, returning projects to Ungrouped.
  - No console or page errors.
- Screenshots: `transition-preview-chromium.png`, `library-search-favorites-chromium.png`, `group-manager-chromium.png`, `group-removed-chromium.png`.

## Library groups, settings, and interface polish

- Project groups:
  - Added local `group` metadata to library summaries. The project ••• menu now has **Move to group…**, with existing-group suggestions and a remove action.
  - The Projects page filters by All, Ungrouped, or a named group and renders separate group sections.
  - Groups do not enter the project file, so exported `.pixcut` packages remain portable.
- Project cards now render the real aspect ratio inside a tall preview area. Chromium/WebKit measured `92×164` for a 9:16 project and `292×164` for a 16:9 project instead of identical landscape thumbnails.
- Timeline add buttons are now a consistent `34×34` control at the same x-position in the Text, Visuals, and Audio lanes, with a high-contrast white plus icon. Added a Text-lane add action that creates a layer at the playhead and opens the Text inspector.
- Error banner redesigned as a bottom-right alert with a warning badge, friendly title, full message, and dismiss action. Verified the image-as-audio path shows “That file needs a different format” with no raw `Error:` prefix.
- Timeline zoom:
  - Added −/+ buttons, a 100–600% slider, and a click-to-fit percentage in the timeline toolbar.
  - The timeline scrolls horizontally as a single surface; track labels and add buttons stay pinned, and the playhead is kept in view when zoom changes.
  - Chromium measured `scrollWidth 1440 → 2844`, scene clip width `386 → 835` at 200%; WebKit measured `2830` and `831`. Both returned to the fit width and 100% after clicking the percentage.
- Inline text editing was redesigned as a compact **Edit text** card with labeled **Title** and **Optional subtitle** fields, a header, and **Cancel**/**Done** actions. It no longer presents as two unexplained boxes over the canvas.
- Screenshots: `timeline-zoom-chromium.png`, `text-inline-editor-chromium.png`.
- Settings are now functional:
  - General: default canvas format, photo duration, image fit, language preference, and reset preferences.
  - Appearance: compact editor, reduced motion, and quick-start hints.
  - Editing: autosave delay, default snapping, and panel-layout reset.
  - Privacy: live local-storage estimate and local-only guarantees.
  - Updates: build diagnostics, runtime/platform/schema/FFmpeg status, copy diagnostics, and recheck FFmpeg.
- Template gallery rebuilt with themed procedural art: travel ridges, warm family keepsakes, a plum-and-gold birthday with balloons/cake/confetti, a studio product pedestal, and bold social gradients. Previews preserve 16:9, 4:5, 9:16, and 1:1 frames.
- Audio per-file limit raised from 8 MB to 50 MB, with a 200 MB per-project budget and a 3,600-second source-duration ceiling. The audio panel states the new limit.
- Browser checks, Chromium and WebKit: created two projects with different aspects, moved one into “Client work”, verified group chips/sections, opened Settings/Appearance/Updates, and confirmed all three timeline add buttons align at x = 1383.
- No console or page errors in either engine.
- Screenshots: `output/playwright/projects-groups-chromium.png`, `templates-themed-chromium.png`, `settings-general-chromium.png`, `settings-appearance-chromium.png`, `timeline-aligned-chromium.png`, `error-banner-chromium.png`, and the five `template-scene-*.png` captures.

## Dark gray, multi-lane audio, and export options

- Dark gray is now the default theme across Home and the editor, with a light theme selectable in Settings → Appearance. Home/project cards, menus, modals, settings, fields, selects, and the timeline were restyled to a consistent neutral gray palette.
- Project dropdowns now raise their card above neighbors, so long action menus are no longer hidden under adjacent cards.
- Native Open dialogs now use filtered pickers: images only for image import, audio only for audio import, and videos only for video import. Browser inputs use the same accept lists.
- Audio clips now carry a `lane` (0–7). The timeline renders separate audio lanes with independent add buttons; audio from all lanes mixes during preview and export. The Audio panel exposes a Track selector.
- Export modal now supports presets, resolution (720p/1080p/1440p), fps (24/30/60), quality (draft/standard/high), custom base filename, version, and optional preset/quality suffixes. Default filename is derived from the project name.
- Rust emits `export-progress` events while FFmpeg runs; the UI maps frame-render progress to 0–70% and FFmpeg progress to 72–99%.
- Templates now build three text layers per scene (kicker, title, subtitle) with entrance animations and transitions, and the gallery renders the real first scene with text instead of artwork-only previews.
- Browser checks, Chromium:
  - Dark home class resolved to `app home theme-dark`; computed background `rgb(27, 27, 29)`.
  - Two audio clips imported into lanes `0` and `1`; timeline rendered two audio rows.
  - Export default name `Travel`, filename `Travel - v1 - Standard.mp4`.
  - Projects sorted by name as `Birthday`, `Travel`; project menu rendered above neighboring cards.
  - No console or page errors.
- Screenshots: `dark-home-chromium.png`, `dark-templates-chromium.png`, `dark-editor-chromium.png`, `dark-audio-lanes-chromium.png`, `dark-export-options-chromium.png`, `dark-projects-sort-chromium.png`, `dark-project-menu-chromium.png`.
- Boundary: video picture-in-picture is still not implemented; it needs the media engine. Audio lanes are visual organization plus mixed playback, not separate routing buses.

## In-place image replacement and library management

- Added photo replacement without rebuilding a scene: from the inspector Video tab, the inspector scene actions, the Media panel, the clip context menu, or by dropping an image onto a media tile or timeline clip.
- Replacement keeps scene ID, duration, title, subtitle, image fit, color grade, filter/intensity, speed, fades, and all text-effect settings. Only `image` and the display name change.
- The inspector flushes pending text/control edits before opening the picker, so a replacement cannot be overwritten by a stale inspector draft.
- The Media panel marks the selected tile/clip with a `DROP TO REPLACE` overlay while dragging a file.
- Library cards now support **Rename…** and **Export project file** in addition to open, duplicate, and delete. Rename updates the library and the active editor title; backup exports the stored copy as a portable `.pixcut.json` file with embedded images.
- Native backup uses a new Rust `save_project_file` command, validation, atomic write, and a sanitized filename. Browser backup downloads the same JSON.
- Chromium and WebKit checks:
  - Replaced the first Travel template photo with a generated PNG. Duration, title, subtitle, filter, filter intensity, and outline were unchanged; image and name changed.
  - Dropped a second PNG onto the second timeline clip; the scene name became `dropped.png` and its image became the dropped data URL.
  - Dropped a third PNG on the Media grid; it was added as a new scene instead of replacing one.
  - Renamed the project to `Weekend in the mountains`; the card and reopened editor header both showed the new name.
  - Exported a backup; the downloaded file contained 3 scenes, the new name, `replacement.png`, and `dropped.png`.
  - No console or page errors.
- Native HTML5 drop requires the updated Tauri window config (`dragDropEnabled: false`) and a restart/packaged pass; the browser drop path is verified in both engines.
- Screenshots: `output/playwright/replace-image-editor-chromium.png`, `replace-image-actions-chromium.png`, `replace-image-drop-target-chromium.png`, `project-menu-rename-chromium.png`, `project-rename-chromium.png`.

## Project library and template gallery

- Added an IndexedDB-backed local project library (`pixcut-library`) separate from the one-slot recovery adapter. Projects with at least one scene are autosaved after edits; projects with zero scenes are removed.
- Library cards show a generated 480 px thumbnail, project name, aspect, scene count, duration, and relative edit time. Open, duplicate, and confirmed delete are available from a per-card actions menu.
- Opening, starting a blank project, or applying a template flushes the current story to the library before replacing the active session. Deleting the active project also clears the editor and recovery copy safely.
- Replaced the placeholder template modal and home strip with the five-definition catalog: Travel (16:9), Family (4:5), Birthday (9:16), Product (1:1), and Social (9:16). Each has real scenes, timing, filters, color grades, and text effects, plus category chips and search.
- Applying a template over an existing story now shows a confirmation with the template preview and scene count instead of silently replacing work.
- Removed the nonfunctional “Made with PixCut outro” checkbox from the export dialog. The export summary now states the no-watermark and no-account guarantees.
- Added **Export reference** to the shortcut help overlay. It downloads a UTF-8 text file generated from the effective bindings for the current preset and platform.
- Browser checks, Chromium and WebKit:
  - Started with an empty library, opened the gallery, found 5 templates, filtered to 1 Travel card, and created a 3-scene Travel project.
  - Applied Family over the open project; the confirmation appeared, and the library then listed 2 projects.
  - Project actions opened correctly; Duplicate produced 3 cards in the library.
  - Delete showed the confirmation, removed the duplicate, and returned the library to 2 cards.
  - Starting a blank project from the new-project modal kept the saved Travel project in the library and did not add an empty card.
  - Deleting the currently open project from the home menu removed it, cleared the editor, and showed the empty-library state with no console errors.
  - Shortcut export produced `pixcut-keyboard-shortcuts.txt` with 41 lines and all 7 shortcut categories.
  - Export dialog text contains no outro option.
  - No console or page errors in either engine.
- Screenshots: `output/playwright/project-library-chromium.png`, `project-library-two-chromium.png`, `project-menu-chromium.png`, `project-delete-chromium.png`, `template-gallery-chromium.png`, `template-confirm-chromium.png`, `shortcut-export-chromium.png`, `export-panel-chromium.png`, plus WebKit versions.

## Timeline filmstrip

- Replaced the stretched, cover-cropped photo inside each Visuals clip with a filmstrip background.
- Images now preserve their natural aspect ratio at the clip height and repeat horizontally across the clip, similar to video/image filmstrips in CapCut and Premiere.
- This avoids over-zooming landscape photos into a narrow vertical crop when the clip is wide.
- Chromium check: three Travel clips rendered filmstrips with no console errors.
- Screenshot: `output/playwright/timeline-filmstrip-chromium.png`.

## Timeline time-scale correction

- Fixed the text/visual row mismatch: the add-clip control now sits outside the clip area, both rows use identical width, zero inter-clip gaps, `min-width: 0`, and no max width, and the ruler/scrubber share the exact track width.
- Selected clips now keep a constant 1 px border and use an outline shadow, so selection cannot change layout width.
- Playwright regression with 2 s / 4 s / 4 s clips:
  - Text vs visual width deltas: 0, 0, 0.
  - Left-edge deltas: 0, 0, 0.
  - Right-edge deltas: 0, 0, 0.
  - Track and scrubber widths: both 1204 px.
  - Clip labels: 2.0 s, 4.0 s, 4.0 s.
- Screenshot: `output/playwright/timeline-time-scale.png`.

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
- `output/playwright/timeline-time-scale.png`
- `output/playwright/text-effects-panel.png`
- `output/playwright/text-glow.png`
- `output/playwright/text-effects-groups.png`
- `output/playwright/text-backdrop-neutral-chromium.png`
- `output/playwright/text-backdrop-neutral-webkit.png`
- `output/playwright/project-library-chromium.png`
- `output/playwright/project-library-two-chromium.png`
- `output/playwright/project-menu-chromium.png`
- `output/playwright/project-delete-chromium.png`
- `output/playwright/template-gallery-chromium.png`
- `output/playwright/template-confirm-chromium.png`
- `output/playwright/shortcut-export-chromium.png`
- `output/playwright/export-panel-chromium.png`
- `output/playwright/new-project-modal-chromium.png`
- `output/playwright/library-empty-after-delete-chromium.png`
- `output/playwright/replace-image-editor-chromium.png`
- `output/playwright/replace-image-actions-chromium.png`
- `output/playwright/replace-image-drop-target-chromium.png`
- `output/playwright/project-menu-rename-chromium.png`
- `output/playwright/project-rename-chromium.png`
- `output/playwright/timebase-chromium.png`
- `output/playwright/tracks-chromium.png`
- `output/playwright/music-panel-chromium.png`
- `output/playwright/music-empty-chromium.png`
- `output/playwright/audio-multi-chromium.png`
- `output/playwright/asset-store-chromium.png`
- `output/playwright/text-move-fonts-chromium.png`
- `output/playwright/text-edit-chromium.png`
- `output/playwright/timeline-filmstrip-chromium.png`
- `output/playwright/text-slider-persistence-chromium.png`
- `output/playwright/text-layers-chromium.png`
- `output/playwright/projects-groups-chromium.png`
- `output/playwright/templates-themed-chromium.png`
- `output/playwright/settings-general-chromium.png`
- `output/playwright/settings-appearance-chromium.png`
- `output/playwright/timeline-aligned-chromium.png`
- `output/playwright/error-banner-chromium.png`
- `output/playwright/timeline-zoom-chromium.png`
- `output/playwright/text-inline-editor-chromium.png`
- `output/playwright/transition-preview-chromium.png`
- `output/playwright/library-search-favorites-chromium.png`
- `output/playwright/group-manager-chromium.png`
- `output/playwright/group-removed-chromium.png`
- `output/playwright/dark-home-chromium.png`
- `output/playwright/dark-templates-chromium.png`
- `output/playwright/dark-editor-chromium.png`
- `output/playwright/dark-audio-lanes-chromium.png`
- `output/playwright/dark-export-options-chromium.png`
- `output/playwright/dark-projects-sort-chromium.png`
- `output/playwright/dark-project-menu-chromium.png`
- `output/playwright/image-framing-chromium.png`
- `output/playwright/new-project-formats-chromium.png`
- `output/playwright/formats-manager-chromium.png`
- `output/playwright/multi-format-reels-chromium.png`
- `output/playwright/export-formats-chromium.png`
- `output/playwright/social-formats-create-chromium.png`
- `output/playwright/social-formats-manager-chromium.png`
- `output/playwright/social-reels-framing-chromium.png`
- `output/playwright/social-export-formats-chromium.png`
- `output/playwright/wide-new-project-chromium.png`
- `output/playwright/updates-panel-chromium.png`
- `output/playwright/timeline-playhead-chromium.png`
- `output/playwright/template-scene-travel.png`
- `output/playwright/template-scene-family.png`
- `output/playwright/template-scene-birthday.png`
- `output/playwright/template-scene-product.png`
- `output/playwright/template-scene-social.png`
- `output/playwright/export-frame.png`
- `output/playwright/PixCut sample.mp4`
- `output/playwright/PixCut sample.pixcut.json`
- `src-tauri/target/debug/bundle/macos/PixCut.app`

Generated review outputs and build artifacts are ignored. Automated test fixtures and both dependency lockfiles are retained in the desktop project.

## Remaining validation

Windows/Linux builds, signing/notarization, FFmpeg redistribution, full native media-engine integration, audio/video import, transitions, MP4 fade encoding, speed curves/reverse playback, audio fades, accessible screen-reader flows, large-media stress tests, and interrupted-export recovery remain future work. Browser preview does not export MP4; use the native app. The new inspector was exercised in Chromium and WebKit headless, and multi-selection in Chromium; a final packaged-app pass is still worthwhile.

## Creative libraries and sidebar updates — 2026-10-25

- Replaced the five template designs with Field Notes, Sunday Keepsakes, Make Some Noise, Object / Study, and On Repeat. Artwork is generated locally, with independent editable text and element layers on every new project. Browser checks validated all five projects and confirmed separate layer IDs across launches.
- Elements now have canvas previews, category filters, readable labels, controls above the gallery, and five new graphics: Sunburst, Frame, Dot grid, Paper tape, and Chevrons.
- Added seven element motions (drop, both horizontal directions, zoom out, bounce, spin, swing), giving 12 motions plus Still. Canvas checks verified all five new graphics draw nonempty pixels and all 12 animations change between sampled frames. Reduced-motion preferences suppress interface demo animations.
- Project schema v8 accepts v1–v7. TypeScript and Rust tests cover the new graphics and motions, v7 migration, and round trips. Native and browser migration detection use v8.
- Photo export now retains every animated project frame and static element visibility boundaries in both photo-only and mixed-media export paths. Video overlays use a PNG sequence with the same canvas transforms and a correctly offset FFmpeg input. The real FFmpeg test checks early black and later red overlay pixels after a delayed video cut, as well as H.264 and the expected duration.
- Lower home sidebar shows manual-update status and links to release notes, install/restart controls, or errors. No background checks were added. Version & build details explains app version, desktop/browser mode, build ID/date, and FFmpeg availability; browser version now comes from package.json.
- Shortcut help and customization use 15 px action labels, 13 px descriptions/keys, and more spacing.
- Verification: 38 TypeScript tests, 26 project-model tests, 10 native tests, production TypeScript/Vite build, and the four FFmpeg tests passed (animated-overlay test rerun after correcting its fixture dimensions). Updated native development build left running.
- Visually reviewed screenshots: `output/playwright/redesign-home.png`, `redesign-templates.png`, `redesign-shortcuts.png`, `redesign-elements.png`, `redesign-animations.png`, and `redesign-build-details.png`.
- Rendering animation frame sequences uses more memory and export time than the previous still-frame approximation. Existing mixed-video limitations for video grading, speed, and transitions remain.

## Editor simplification and element fixes — 2026-10-25

- Replaced the left vertical rail with a compact horizontal icon toolbar. Scene adjustments use a single icon toolbar in the right inspector. Removed duplicate transition/look libraries, repeated panel descriptions, storage footers, framing/text callouts, placeholder advanced controls, and routine element-add notices.
- Framing shows duration, Fill/Fit/Blur, zoom, and reposition; position and camera movement are collapsed. Background color appears only for Fit. Photos no longer expose speed or audio-pitch controls. Video speed uses a compact preset/slider panel. Empty timelines show one audio lane, and extra audio controls appear when audio is present.
- Six title presets now add real, independent text layers at the playhead, open the text inspector, and respect the eight-layer limit. The previous title button wrote obsolete fields. Timing, animation, typography, and text effects are collapsible.
- Elements use consistent vector paths for bell, comment, share, play, location, music, thumbs-up, check, cross, and cursor in both library previews and exported canvas frames. Default icon/badge dimensions retain their physical proportions across landscape and portrait formats. Narrow legacy badges omit the icon to keep their labels legible.
- Subscribe and Like text is editable, preserves case and Unicode, can be blank, and uses automatic contrasting foreground colors. Schema v9 accepts v1–v8; TypeScript and Rust tests cover multilingual labels, absent legacy labels, limits, and serialization.
- Selected element controls live in the inspector; the library stays available for browsing. Text handles are hidden while an element is selected. Animation thumbnails run automatically using the shared motion evaluator, pause offscreen, respect reduced-motion settings, and display the selected label. Browser checks confirmed five visible previews changed over sampled animation frames.
- Automatic updates are enabled by default per the user's request: check after launch and daily while Home is visible and online, with no automatic checks during editing/export. Settings provides an opt-out. Errors/no-update/checking states do not display a sidebar notification; available/downloading/ready states do. Downloads/install remain user initiated. AGENTS.md reflects this requested exception.
- Verification: 43 TypeScript tests, 26 Rust project tests, 10 native tests, and all four real FFmpeg tests pass. Production TypeScript/Vite build passes. Browser interaction checks confirmed title insertion, persisted translated labels, scrubbing, exclusive element handles, and no idle update card. Native development process remains running.
- Visually reviewed UI screenshots under `output/playwright/refine-*.png`. Render QA covers corrected icons plus Polish, Japanese, and Arabic labels in `refine-render-2.png`; the same sequence is encoded in `refine-render.mp4` and decoded for comparison.
- Final packaged-app check: `npm run tauri -- build --debug --bundles app --config '{"bundle":{"createUpdaterArtifacts":false}}'` passes and produces the 49.00 MiB `desktop/target/debug/bundle/macos/PixCut.app`. Opened this exact bundle, verified native v0.1.3 and the compact toolbars/inspector, dismissed the old quick-start strip, and left the app raised with the existing House project open. Other installed copies were not replaced.

## Compositing, source media, and playback — 2026-10-26

- Fixed project opening when a native output format contains `presetId: null`. Native serialization now omits absent preset IDs; browser validation accepts legacy nulls and cached video asset references.
- Delete routes to the explicitly selected text, element, or audio clip. Browser checks removed each layer type while preserving the scene count; Undo restored audio. Element clips have neutral styling and separate rows. Removed a CSS class collision between timeline rows and element-list buttons that caused the blue background, extra padding, and inconsistent alignment.
- Imports enter a local source bin and open a source player before insertion. Append adds sequential scenes; Place on top creates image/video overlays, with unused corners chosen first. Imported sources appear once even when reused by multiple timeline clips. The bin persists locally per project; unused bin media is not included in portable project packages.
- Custom PNG/JPEG/WebP graphics and MP4/WebM/MOV video overlays use the shared compositor. Schema v10 accepts v1–v9 and preserves media references, optional labels, repeat settings, and cycle speed. Both native package and local-asset-store tests cover custom image/video overlays, including video MIME types. Overlays are scene-scoped, muted, and capped at 12 per scene; music uses audio tracks.
- Animation previews no longer hold between cycles. Selecting a motion enables continuous repeat; cycle speed works for both entry and periodic motions. The right inspector opens its Element tab on selection and places compact animated previews before geometry/timing controls.
- Expanded the title library to 12 independent text presets. Rebuilt five templates as photo-led storyboards (Travel journal, Everyday moments, Birthday reel, Product reveal, Social story) with editable titles and current imported/timeline media. Browser checks validated all five, each with three scenes and three text layers per scene.
- Fixed audio restart/seek races during pending `play()` and replaced a React-state-dependent playback clock with elapsed wall time. The initial long browser test caught backward clock jumps; after the clock correction, 12 successive samples advanced from 0.67 s to 7.96 s with no paused or seeking samples. Tests cover pending playback requests and delayed/skipped UI frames. This verifies playback state/clock continuity, not an external speaker or loopback recording.
- Added a render queue that finishes a slow-decoding frame and then draws the latest request, rather than canceling every frame before it can reach the preview.
- Final verification: 53 TypeScript tests, 26 Rust project-model tests, 12 native tests, and 4 real FFmpeg tests pass. TypeScript/Vite and the native debug app bundle build pass. Native House project opens successfully in the rebuilt bundle. Cross-platform packaging and physical audio-output testing remain unverified.
- Render checks verified moving video-overlay frames, exact preview/export canvas equality at a sampled frame, preserved background pixels, and continued movement for all 12 repeating motions. A real 640×360 H.264 encode contains 60 frames over 2.000 s; the decoded sample differs from its canvas source by mean absolute RGB error 1.216/255.
- Reviewed screenshots: `output/playwright/final-editor.png`, `final-source-player.png`, `final-audio.png`, and `composite-render-check.png`. The editor fits a 1550×1100 viewport with no document overflow. Temporary QA pages and source video were removed from the production public directory before packaging. Browser outputs are ignored by Git.
- Native bundle: `desktop/target/debug/bundle/macos/PixCut.app`. Other installed copies were not replaced; use this exact bundle to test these changes.

## Independent overlay timing and background export — 2026-10-26

- Native format overrides omit absent framing fields; the reader also accepts existing nulls, fixing reopening projects with partial format framing. Schema v11 accepts v1–v10 in TypeScript and Rust. Project overlays have project-relative start/duration, remain visible across scene cuts, and persist through browser/native asset storage and portable packages. Legacy scene elements retain their position and become independent when edited. Removing all scenes clears dependent overlays; Undo restores them.
- Image, video, and graphic overlays have individual timeline rows, thumbnails, move/trim handles, Start/Duration numbers and sliders. The element library lists project overlays. Video timing respects the available source duration. Browser interaction checks changed Start/Duration with keyboard sliders, trimmed an edge, and moved a clip, then restored its cross-scene timing.
- Entrance animation and later actions are separate. Ring/shake, pulse, float, and spin have a relative start, duration, and optional repeat. Ring can synthesize an offline bell sound, mixed in preview and export. A gold timeline segment marks the action interval.
- Overlay dragging stages local geometry and commits after dragging. The inspector scene reference stays stable, preventing repeated form resets; the preview uses a smaller render during movement. A six-step image drag responded in 123 ms without resizing or snapping back. Background reposition uses the same framing travel as the compositor and preserves the active format's zoom (160% before and after the check).
- Export exposes resolution, quality, frame rate, filename/version, and format selection. Rendering uses an immutable project snapshot; the progress panel shows the phase, percentage, approximate remaining time, and cancel while editing and project switching stay available. PNG encoding yields through asynchronous canvas blobs.
- Native end-to-end check: started a 40-second export, created a new blank project at 58% preparation, and completed export from the captured original. FFprobe reports H.264, 960×540, 30 fps, 1,200 frames, 40.000 s. Decoded frame at 9 s retains both overlays across cuts. Audio RMS before/at/after the scheduled cue is 0 / 0.12737 / 0. Separate preview/export canvas comparison at 3.2 s has zero pixel difference.
- Verification: 61 TypeScript tests, 27 Rust project tests, 13 native tests, four real FFmpeg tests, production TypeScript/Vite build, and the native debug bundle build pass. Reviewed `output/playwright/v11-final-cross-scene.png`, `v11-final-export.png`, and `v11-native-export-frame.png`. Large render jobs still consume CPU during frame preparation; ETA is approximate, and the native destination picker briefly takes focus.
- Final native bundle opens the existing House project with all four scenes, five output formats, audio, and image overlay. Fixed inherited thumbnail CSS that stretched the media placement buttons; the browser check measures their row at 32 px and `v11-final-media.png` was visually reviewed. Left the rebuilt `desktop/target/debug/bundle/macos/PixCut.app` running with House open; other installed copies are unchanged. Cross-platform packaging and physical speaker/loopback testing remain unverified.

## Canvas and timeline selection follow-up — 2026-10-26

- Selecting a main scene clears the prior overlay selection and inspector, including when switching between text, images, and elements. The playhead line no longer intercepts clip clicks; its top handle still scrubs.
- Image/video clips now have a dedicated Overlays track directly below Visuals, before decorative elements, text, and audio. Imported and legacy media both appear, with independent rows, thumbnails, start/duration, trim handles, and keyboard activation.
- All active overlays expose direct canvas selection and dragging, without selecting them in the library first. Dragging uses the picked layer rather than stale React selection state. Selection bounds follow the shared entrance/action transform and compositor stacking; inactive layers do not intercept clicks.
- Fixed a related development lifecycle issue where an audio blob URL was revoked during Strict Mode effect replay and then reused. Audio URLs are now created and revoked in the same effect; fresh mount test reports readyState 4, no media error, and fetch status 200.
- Verification: 62 TypeScript tests and the production/native bundle build pass. Browser interaction checks cover scene clicks at the playhead, deselection of stale overlays, mouse and keyboard timeline selection, direct dragging and persistence for global images, legacy image promotion, and video overlays. Both media rows precede text/audio. Reviewed `output/playwright/selection-direct-drag.png` and `selection-image-video.png`. Native House check selected an overlay, opened its timing inspector, and selected the second scene with the overlay controls correctly cleared. Existing House media/timing were preserved.

## Export studio and curated elements — 2026-10-26

- Replaced the export dialog with a two-column studio: codec, container, quality, resolution, frame rate, encoder speed, audio inclusion, output selection and file naming. One contained scroll region retains the title and export footer; background scrolling is locked. File naming details stay collapsed. Tested six outputs at 1550×1100 and 1000×700, with the export footer fully visible.
- Added H.264/libx264 and H.265/libx265 output in MP4, MOV and MKV. Native capability detection disables encoders absent from the installed FFmpeg. Codec/container/speed are validated enums with legacy H.264/MP4/medium defaults. Both export paths share encoder arguments, use the correct temporary-file/container extension, and tag HEVC MP4/MOV as hvc1. Quality presets use codec-specific CRF values; job progress now says “Encoding video” for every container.
- All five FFmpeg integration tests pass, including six new HEVC encodes (three containers through both render paths). A native export from the new dialog produced a MOV containing HEVC/hvc1, 320×240, 24 fps, 1.000 s, confirmed with ffprobe.
- Removed the duplicate empty-scene Add text layer button. Native and browser first-click checks insert a text layer and Reset framing opens no file picker. The circular-arrow action was image replacement; it now has an ImagePlus icon and an explicit “Replace image…” label. Buttons explicitly use type=button where appropriate. The originally reported text-to-picker behavior was not reproduced in either checked runtime.
- Curated the element picker from 27 presets to ten. Removed primitive/decorative shapes from the picker while preserving rendering, names and round trips of existing artwork. Added six editable designs: Label, Name card, Website, Quote, Step number and Status badge. Shared canvas artwork uses typography, rounded cards, restrained accent colors and contrast-aware text; quotes wrap whole words and fall back to character wrapping for long/CJK strings. Kept Subscribe, Bell, Progress and Location. Categories are Text, Social and Utility.
- Schema v12 accepts v1–v11 in TypeScript and Rust. Both paths test new kinds, Unicode labels and round trips; the old arrow survives migration without appearing in the picker. Browser checks add/edit/reopen name cards and Polish quotes. Selection and motion use the existing independent overlay system.
- Verification: 66 TypeScript tests, 28 Rust model tests, 14 native tests, and five real FFmpeg tests pass. Production/native bundle builds pass. New artwork has zero sampled pixel difference between preview/export canvases; an HEVC encode of the artwork was decoded and reviewed. Reviewed screenshots: `export-studio-desktop.png`, `export-studio-small.png`, `modern-elements-library.png`, `modern-elements-contact.png`, and `modern-elements-decoded.png` under `output/playwright/`.
- Final native check: schema-v11 House opens in the schema-v12 bundle with four scenes, five formats and five existing overlays intact. The Elements picker exposes exactly the ten curated presets, with no arrow/rectangle/sparkle add buttons. Left this exact rebuilt app running with House open on Elements.

## Export dialog stacking — 2026-10-26

- Reproduced selected overlay borders escaping over the export dialog: preview hitboxes used z-index 100+ while the modal backdrop used 40. The preview now has an isolated stacking context; its editing guides are hidden and the stage is inert while any dialog is open. Closing the dialog restores selection/handles without changing the rendered project image.
- Extended modal keyboard navigation to include textareas, links and disclosure summaries, making File naming options and File names reachable without leaving the dialog.
- Added `desktop/tests/browser/export-dialog.js`, a CLI-driven regression using an isolated browser profile and 64 overlay layers. It checks overlay/text/framing guides, mouse hit coverage at eight preview points, codec/container/quality controls, keyboard containment and naming disclosures, selection restoration and unchanged canvas pixels. Result passed; reviewed `output/playwright/export-layer-fixed.png` after reproducing the issue in `export-layer-before.png`.
- Current TypeScript suite: 70 tests pass. Production TypeScript/Vite build passes. This change affects editor UI only; the encoding/compositor paths are unchanged.
- Native debug bundle rebuilt successfully (49.49 MiB). No encoder, project-schema or export-render changes were needed for the stacking fix.
- Final native verification selected House's image overlay and opened Export: no preview border or editing handle appears above the dialog, while all five output checkboxes and the export action remain available. Left House's export dialog open in the rebuilt app.

## Video export parity and ripple trim handles — 2026-10-26

- Video scenes now export with the same colour grade and look shown in the preview. `gradeLutCube()` bakes the portable canvas grade pipeline into a standard 33³ `.cube` file (neutral scenes skip the LUT), and FFmpeg applies it with `lut3d` after scaling and before concatenation. The LUT is capped at 8 MB and must contain `LUT_3D_SIZE`; it is rejected on non-video segments.
- Video speed is respected end to end: preview playback sets `playbackRate` and maps the playhead to `sourceIn + localTime × speed`, while export reads `duration × speed` from the source and applies `setpts=(PTS-STARTPTS)/speed`. Validation enforces 0.25–4×.
- Clip fades are now encoded into MP4 export for both images and videos. A global `fade=t=in/out` chain runs after all overlay compositing so the encoded result matches the preview’s black fade overlay and the scene boundaries. Fades remain clamped to each clip’s duration.
- Every visual clip has a ripple edge-trim affordance: mid-height handles appear on hover/selection. Dragging the right handle changes duration; dragging the left handle moves the source in-point. Later clips close the gap automatically. Video right trims stop at the available source using the new `sourceDurationSeconds` field; photos clamp to 0.5–30 s. Fades are clamped to the new duration, and each drag is one undo step.
- `Scene.sourceDurationSeconds` is optional so older projects without it still open. New video imports store the probed source length; legacy video clips fall back to their current window and cannot be extended past it.
- Verification: 74 TypeScript tests (9 colour/LUT tests, 28 model tests including four trim tests), 28 Rust project-model tests, 15 non-ignored native tests, and seven real FFmpeg tests pass. `npm run build` and the debug native bundle pass. The new ignored FFmpeg test `real_video_export_applies_grade_fade_and_speed` decodes a 0.50 s, 2× clip and confirms a white LUT plus a dark first fade frame; `real_image_export_applies_fades` checks the image-only encode path darkens the first and last frames while staying bright in the middle. Browser interaction checks trimmed a 4 s clip to 2 s from the right, trimmed 1 s from the left (source-in 1 s, total 7 s), and undid the right trim. Reviewed `output/playwright/trim-handles-chromium.png` and `trim-handles-editor-chromium.png`.
- Remaining boundaries: video transitions still degrade to hard cuts, a true multi-track video composition and native media engine are not implemented, and signed/notarised installers plus FFmpeg redistribution still depend on certificates and licensing.

## Timeline audio waveforms — 2026-10-26

- Audio clips now draw a decoded waveform behind their name and volume label. The decoder uses a low-rate `OfflineAudioContext` (8 kHz) so even long clips stay cheap, averages up to two channels, and reduces the result to 320 min/max buckets.
- Decoding is serialised through one queue and the peaks cache is keyed per clip/data length with a 64-entry cap. A failed or unsupported decode simply hides the waveform; it never throws into the editor.
- The visible source window follows `sourceInSeconds`, clip duration and `sourceDurationSeconds`, so trimming a clip redraws the correct slice without decoding again.
- Verification: 87 TypeScript tests pass, including five waveform tests for bucketed peaks, stereo averaging, empty input, source-window mapping and the no-Web-Audio fallback. Production/native builds pass. Browser check decoded a generated 4 s WAV (14,912 painted canvas pixels), confirmed the waveform sits under the clip label, and reviewed `output/playwright/audio-waveform-chromium.png` and `audio-waveform-editor-chromium.png`.
- Waveform-level editing, audio ducking, EQ and clip effects remain unimplemented.

## Single instance and `.pixcut` handoff — 2026-10-26

- `tauri-plugin-single-instance` is registered before the updater and process plugins, as Tauri requires. A second launch focuses the main window (`unminimize` + `show` + `set_focus`) instead of opening a second editor.
- Arguments from the second launch are scanned by `pixcut_path_from_args`, which accepts only the first case-insensitive `.pixcut` path and ignores the executable, flags, and unrelated files. A matching path is stored in `pending_open` and `project-opened` is emitted; the existing frontend `takePendingProject` flow adopts and persists it.
- macOS `RunEvent::Opened` now uses the same `queue_open_project` helper, so Finder/Open With events and second-launch handoffs share one code path.
- `second_instance_routes_only_project_paths` covers executable-only, non-project, and mixed argument lists.
- Manual native check: with one app running (`PID 5249`), launching `target/debug/pixcut` again exited immediately and left exactly one process. Launching it with `/tmp/PixCut Handoff.pixcut` also exited, and the running editor rewrote its recovery manifest to the fixture project name `Handoff Check`, proving the file was adopted rather than ignored.
- Boundary: the plugin is cross-platform and shares this code on Windows/Linux, but only macOS was exercised on this machine.


## Dynamic elements — 2026-10-26

- Added 14 new presets (24 curated entries total), retained the name-card artwork as Lower third, and added a Dynamic category. Captions, chapters, callout pins, shortcut keycaps, mouse interactions, browser/phone frames, comparison dividers, checklists, ratings, countdowns, audio waveforms, chat bubbles, offline QR cards, and end screens share canvas artwork between previews and export.
- Behavior is a pure function of element-local time: timed click/double-click/drag, key presses, sequential checks/stars, countdown/up with hold/repeat, typing/reveal, and divider sweeps. Inspector controls configure action time, intervals, values, repetition, audio source, and exit; Preview action seeks and plays. Newly added countdowns adapt to short remaining timelines. Existing entrance/later-action controls remain independent.
- Waveforms sample a cached 4096-bucket decoded audio envelope, honoring source trim, track timing, volume and fades. All audio or one track can drive it; absent/unsupported audio remains flat. Export retains the original audio analysis source independently of the audio-output toggle and synthesized bell cues. Thumbnail-only samples are illustrative; project artwork uses actual local audio.
- Schema 13 migrates versions 1–12 in both models. Behavior/exit settings are validated and round-trip through native serde; optional native settings omit null fields, and the frontend accepts null optional settings safely. Existing decorative elements remain loadable.
- Both photo export planners now emit every frame for internal dynamic behavior and exits even when the entrance is Still. Scene-local and global waveform rendering receive the correct project time/audio context, including transitions. Device/end-screen interiors remain transparent; comparison artwork is a divider/labels rather than an automatic media wipe.
- Verification: 88 TypeScript tests, 29 Rust project tests, 16 native tests pass (7 FFmpeg tests remain ignored in that run). Browser regression `tests/browser/dynamic-elements.js` verifies 14 new artworks, true local-audio response (peak 0.4211), flat silence, category filtering, independent Start/Duration, settings autosave, and reopening. It captures 120 shared-compositor frames. FFmpeg encoded/decoded the 4 s 960×540 H.264/AAC sample; decoded artwork was visually reviewed. macOS Vision decoded the QR payload exactly as `https://example.com/東京`.
- Visually reviewed `output/playwright/dynamic-elements-contact.png`, `dynamic-elements-editor.png`, and `dynamic-elements-decoded.png`. Production build and final native debug bundle pass (50.01 MiB), and `git diff --check` passes.
- Native relaunch completed after the user explicitly authorized stopping the older development instance. Opened the final bundle, reopened House (four scenes / 16 seconds / five overlays), verified all 24 presets in native accessibility and selected Elements → Dynamic. The updated app is left running with House saved. No packaged native export was claimed for this change; the renderer/FFmpeg verification above ran locally through the browser fixture.

## WebM/VP9 and ProRes export — 2026-10-26

- The export dialog now offers four codecs: H.264 and H.265 (MP4/QuickTime/Matroska), VP9 (WebM), and ProRes 422 (QuickTime). The container dropdown is derived from the chosen codec, so invalid pairs cannot be selected; picking VP9 or ProRes automatically switches to the required container.
- Rust validates the codec/container pair before opening a save dialog or encoding. VP9 uses `libvpx-vp9` with CRF/`-b:v 0`, `-row-mt`, and speed-mapped `-cpu-used`; ProRes uses `prores_ks`, `yuv422p10le`, and a CRF-mapped 422 LT/422/HQ profile. H.264/H.265 keep their existing presets and `hvc1` tagging.
- Audio follows the container: AAC 192 kbps for MP4/MOV/MKV, Opus 160 kbps for WebM, and 48 kHz PCM for ProRes. FFmpeg capabilities now also require the paired audio encoder, so a build without `libopus` disables VP9 instead of failing mid-export.
- The export dialog shows matching audio labels (AAC, Opus, or PCM) and explains each codec, while the encoding-speed control is disabled for ProRes because quality selects the profile.
- Tests: `webm_and_prores_options_use_their_own_encoders_and_containers` covers output names, encoder arguments, audio arguments, and rejected codec/container pairs. `real_webm_and_prores_exports_match_their_containers` encodes a two-scene project with audio and probes the output for `vp9` + `opus` and `prores` + `pcm_s16le`; duration is within 80 ms of 1 s.
- Verification: 88 TypeScript tests, 29 project-model tests, 17 native tests, and all 8 FFmpeg integration tests pass. Browser checks selected ProRes (forced MOV, speed disabled) and VP9 (forced WebM), confirmed H.264 still returns MP4/MOV/MKV, and found no console errors. Reviewed `output/playwright/export-prores-chromium.png` and `export-webm-chromium.png`.
- Boundary: Windows/Linux codec availability is reported from the local FFmpeg build; only the macOS FFmpeg 9.0.2 build was exercised here.

## Editor trust and creator essentials — 2026-10-26

- Decoded photos now live in a weight-aware LRU (`src/components/preview/image-cache.ts`): 48 entries and a 256 MB budget, where cost is recorded from the decoded dimensions after `img.decode()`. The newest entry is never evicted, so the visible photo cannot re-decode every frame; a failed decode removes its own entry. `loadImage` rejects an empty source with a human-readable message instead of creating a broken draw.
- The live preview renders at 1280 px on the long edge while paused and 720 px while playing or dragging an overlay; the export path still renders at the active format's full size. This keeps 4K and overlay-heavy stories responsive without changing what a still frame or export contains.
- Playback gained a **Repeat** toggle in the transport. The rAF clock restarts from 0 at the end (and from the end when playing backwards) so preview loops match what the viewer hears; the toggle is keyboard reachable and reports its state in `aria-label`.
- Canvas dragging now shares `src/components/preview/snapping.ts` between text and overlay elements: the canvas centre, canvas edges, and the centres of other visible overlays produce violet guide lines, and the guides clear on pointer up. Element drags snap the overlay centre; text drags snap the box's left and top edges. The text selection box follows the in-progress draft, so the box, the canvas text, and the guides stay together while dragging.
- **Save still frame** (camera button in the preview header) renders the current frame at the active format's full output size, including overlays, colour grade, and an in-progress transition blend, then writes a PNG. Native builds use the new `save_still_frame` command (PNG/JPEG only, 64 MB cap, tempfile + atomic persist, returns `false` when the dialog is cancelled); the browser preview falls back to a download. No upload or network call is involved.
- Tests: the full TypeScript suite (107 tests in 15 files at the time of this slice, including 7 for the weighted LRU and 8 for snap maths), 29 Rust project-model tests, and 27 non-ignored native tests including `still_frames_accept_only_png_and_jpeg_payloads`. `npx tsc -b`, the production Vite build, and `npm run ci` pass.
- Browser checks (`desktop/tests/browser/creator-slice.js`) confirmed the preview canvas at 1280×720 paused and 720×405 while playing, loop playback still running after 3.2 s on a 1.5 s story, both guides drawn during text and overlay drags and removed on drop, and a 1920×1080 PNG still frame (56,954 bytes) whose sampled pixels matched the preview at the same playhead. Reviewed `output/playwright/creator-text-guides.png`, `creator-snap-guides.png`, `creator-loop-active.png`, and `creator-preview-header.png`.
- Docs truth-up: the README timeline rows now read Visuals → Overlays → Elements → Text → Audio and describe loop, still frames, and alignment guides; the website no longer lists AI settings as shipped (the AI page and privacy entry mark it as planned).
- Boundary: the native save dialog, atomic write, and PNG/JPEG validation are unit-tested and compiled, but the still-frame dialog itself was exercised through the browser fallback only. Full-size still frames from 4K formats and still frames taken mid-transition were not visually compared against a native export.

## Missing media stays openable and relinkable — 2026-10-26

- Missing assets no longer make a project unopenable. Native `hydrate_project` and browser `hydrateProjectAssets` keep the `pixcut-asset:<sha256>` reference when the bytes are gone; SHA-256 mismatches are still integrity errors. The media bin follows the same rule instead of failing the whole panel.
- `project_has_asset_refs` detects unresolved references in scenes, overlays, audio and legacy music. Portable `.pixcut` saves fail with **Relink missing media before saving this project.** until every reference is replaced, and the editor blocks Save and Export before they reach native code.
- The editor shows a persistent banner with the missing-file count and a **Relink media** dialog listing one row per reference with its kind and label. Relinking opens the native picker for that kind and swaps every use of the old reference through the existing `replace` command, so the change is one undo step and timing is untouched. The browser preview disables the picker and explains that relinking is native-only.
- Previews avoid requesting unknown schemes: images fall back to a transparent placeholder, missing overlay video is skipped, missing scene video is not attached, audio sources and waveforms stay silent, and timeline/media-bin thumbnails render a dashed **Missing** tile instead of a broken image. The verification script no longer records `ERR_UNKNOWN_URL_SCHEME` console errors.
- Tests: `missing_assets_stay_referenced_and_block_portable_saves` covers tolerant native hydration, the save guard, and the successful post-relink state. `tests/missing-assets.test.ts` covers deduplication, kinds/labels, and clone-safe replacement across every occurrence. `tests/errors.test.ts` maps relink, integrity, and unreadable-project messages to distinct titles.
- Verification: 116 TypeScript tests in 17 files, 30 project-model tests, 19 non-ignored native tests, and all 8 FFmpeg integration tests pass. `npm run build` passes.
- Browser check opened a project with one missing image and one missing audio clip: the banner reported **2 media files missing**, the dialog listed **Lost beach clip (image)** and **Lapel mic.wav (audio)**, the native-only chooser and **Add** action were disabled, and Export produced **Media needs relinking** without opening the export dialog. Reviewed `output/playwright/missing-media-banner-chromium.png`, `missing-media-dialog-chromium.png`, and `missing-media-export-block-chromium.png`.
- Boundary: the native file-picker relink itself was not driven end to end because the browser cannot open Tauri dialogs; the command path is unit-tested and the native build compiles. Missing media is still referenced in recovery until the user relinks or removes those scenes.

## Layer order across text, elements and overlays — 2026-10-26

- Everything drawn over a scene now shares one stack: element layers, text layers and project overlays. Each layer can carry an optional `z` number (0–100000); bigger draws later. Layers without one fall back to the classic bands (elements 1000+, text 2000+, overlays 3000+), so existing projects and saved files composite exactly as before and no migration is needed.
- `src/components/elements/stack.ts` owns the ordering: `sceneStack` builds the bottom-to-top list, `stackZ` computes the value for "send to back", "back one", "forward one" and "bring to front". One press moves one place by landing between its neighbours, so only the moved layer changes and the edit is one undo step.
- New optional fields in both models: `ElementLayer.z` and `TextLayer.z` in `src/stores/model.ts` and `crates/project/src/lib.rs`, validated as finite numbers inside the range and omitted from JSON when unset. Text and element values survive save, reopen and the Rust command round trip.
- `drawScene` now composites the merged stack instead of drawing elements, then text, then overlays. New `drawOverlayStack` draws the same stack without the footage, which is what the video-scene export bakes into its transparent frame series; thumbnails, still frames and both export planners pass the overlays into `drawScene`. Preview and export therefore agree on order.
- The inspector gains a four-button **Layer order** control (send to back, back one, forward one, bring to front) with a "2 of 5 · back to front" readout. It appears for the selected text layer in the Text tab and for the selected element or overlay in the Elements tab, and only counts overlays that overlap the current scene. The preview hitboxes stack in the same order, so the top-most layer is the one that takes the click.
- Tests: `tests/stack.test.ts` covers the classic default order, text above a video overlay and the reverse, single-step moves, front/back saturation, scene-window filtering, save/validate round trip, rejected out-of-range values, and clamping so a press at either end can never suggest a value outside 0–100000. Rust `keeps_layer_stack_order_and_rejects_out_of_range_values` covers serde round trip, omitted fields, and non-finite/out-of-range rejection. Suite totals: 118 TypeScript tests in 17 files, 30 project-model tests, 19 non-ignored native tests; `npx tsc -b`, `npm run build`, and `cargo test --manifest-path src-tauri/Cargo.toml` pass.
- Browser regression `desktop/tests/browser/layer-order.js` against the Vite preview: a white "ABOVE" title over a red rectangle overlay went from 0 to 14,815 white pixels after **Bring to front** (red fell 413,946 → 398,021), then back to 0 white after moving the overlay **up** one place; the project stored `textZ: 3001` and `overlayZ: 3001.1`. The export renderer `drawOverlayStack` was checked separately (3,919 white pixels with the panel behind the text, 0 with it in front). No console errors. Reviewed `output/playwright/layer-order.png`, `layer-order-panel.png`, and `layer-order-element.png`.
- `desktop/tests/browser/export-stack.js` checks the photo-only export job in `App.tsx` (the frames path, which used to draw the scene and then paint every overlay over it): 3,919 white text pixels with the overlay behind the text and 0 pixels with the overlay in front, matching the preview. No console errors.
- Boundary: during a scene transition the two scenes are blended first and the overlays are painted once on top, in both preview and export, so a text layer that was raised above an overlay sits under it for the length of the blend. A packaged native build was not re-run for this change; the native command path is unchanged and its tests pass.

## Layer-order presses stay responsive on big stories — 2026-10-26

- Problem: on the developer's own project (4 scenes, 4 overlays, 2 elements, 6 text layers, 24 MB of media in the asset store) every **Layer order** press froze the editor for seconds.
- Measured cause, in a debug build against that real project: the press sent the whole `overlays`/`update` command (media included), Rust base64-decoded and SHA-256 hashed every asset to rewrite the recovery file (≈744–914 ms), then returned the fully hydrated 29–31 MB project over IPC (≈666 ms to serialise, plus the webview parse and a full React render). Each press also cloned the 29 MB project into undo history, so repeated presses added ~29 MB per step up to 30 steps.
- New `order` command (`{ type: 'order', kind, sceneId?, id, z }`) carries only the new stack position. `Project::reorder` in `crates/project/src/lib.rs` finds the layer by id in the project, scene or text list and sets `z`; nothing else in the project changes.
- Native `apply_order` answers with `{ canUndo, canRedo }` only and the editor applies the same edit locally through `edit()`, so no project payload crosses IPC for a press. Rust keeps a `persisted` mirror of the project in its on-disk shape (`pixcut-asset:` refs), so the recovery write is a 14 KB JSON write instead of re-encoding every photo; the mirror is refreshed by `dispatch` whenever a command actually changes media.
- Undo history is now capped by media size as well as by count (`MAX_HISTORY_MEDIA_BYTES` 160 MB, `trimHistory` in `src/stores/model.ts` for the browser bridge): a 24 MB story keeps about five snapshots instead of thirty, so rapid presses no longer pin hundreds of megabytes.
- Result on the same real project, debug build: a press costs **2–16 ms** (recovery file 14 KB) instead of **≈744 ms plus 29 MB back over IPC**; the command JSON stays under 120 bytes.
- Tests: `tests/stack.test.ts` covers the order command (moves text/element/overlay, leaves media and other layers alone, is idempotent, rejects missing layers, missing scene ids, unknown ids and out-of-range values) and the history cap (`caps undo history by count and by held media`). Rust adds `order_command_moves_one_layer_and_keeps_undo_history` (tiny serialised command, overlay/text moves, undo steps, rejects bad z, unknown layer, missing scene) and `keeps_undo_history_within_the_media_budget` (8 MB snapshots trimmed to the budget, newest kept, undo still works). Suite totals: 120 TypeScript tests in 17 files, 32 project-model tests, 19 non-ignored native tests; `npx tsc -b`, `npm run build` and `cargo test --manifest-path src-tauri/Cargo.toml` pass.
- Browser check `desktop/tests/browser/order-fast-path.js`: the readout walks 1 → 2 → 1 as the buttons are pressed and undo steps back 2 → 1 → 2, with no console errors. `desktop/tests/browser/layer-order-profile.js` on a 21 MB seeded project shows 76–83 ms long tasks per press in the dev build (React's dev renderer dominates), no frame gap over 200 ms. Screenshot reviewed: `output/playwright/order-fast-path.png`.
- Rollout: the debug bundle in `desktop/target/debug/bundle/macos/PixCut.app` and the locally installed `/Applications/PixCut.app` (release, 2026-10-26 10:32) were both rebuilt and relaunched with this change; the installed binary contains the `changing the layer order` guard string, so it is the fast path. The updater signing step still needs `TAURI_SIGNING_PRIVATE_KEY` from `.secrets/`; the `.app` bundles themselves build fine without it.

## Imported video audio — 2026-10-26

- Imported video clips no longer export silent. `encode_plan` probes each temporary clip with `ffprobe` and, when an audio stream exists, adds it to the same filter graph as the music: trimmed to the clip's source window, `atempo`-matched to the clip speed (chained in 0.5–2.0 steps so older FFmpeg builds work), trimmed to the timeline duration, faded with the clip's fade-in/out, delayed to its timeline offset, and mixed with `amix` at `normalize=0`. A missing `ffprobe`, a clip without sound, or the dialog's **Include audio** switch all leave the graph exactly as it was before.
- The export dialog's include-audio switch now reaches video clips too: `PlanSegment.includeAudio` (default `true` for older callers) gates the probe, so "Silent video" really is silent.
- The canvas preview plays the clip's own soundtrack. It is unmuted only while playing forward, muted while paused, scrubbing, or playing backwards, and its volume follows `videoGain()` — the same linear, multiplied fade envelope that the chained `afade` filters apply in the export. Speed is applied as `playbackRate` in preview and `atempo` in export, both pitch-preserving.
- Tests: `videoGain` covers unity, fade-in/out ramps, overlapping fades, clamping, broken values, and range safety. Rust covers `atempo_chain` step limits and products, plan validation of negative/NaN/infinite fades, and the ignored `plan_export_keeps_imported_video_audio` test, which builds a 1 s H.264+AAC tone clip, asserts the exported MP4 has an audio stream whose `volumedetect` mean stays above −40 dB, then re-exports with `includeAudio: false` and asserts no audio stream remains.
- Verification: 126 TypeScript tests, 32 project-model tests, 21 native tests, and all 9 real FFmpeg tests pass; `tsc`, the production build, and the native debug bundle pass. Browser check with a generated `ffmpeg -f lavfi -i testsrc ... -f lavfi -i sine ...` clip: preview element unmuted (`false`) with volume 1 while playing forward, muted when paused and when playing backwards, volume 0 at a faded clip start rising to 1 after the 0.25 s fade, no console errors. Reviewed `output/playwright/video-audio-preview.png`.
- Boundary: audio/video sync for very long single clips and multi-format batch exports were not measured with a physical audio device; the preferred stream (`[input:a]`) is the first audio track, and per-clip volume, ducking, and channel remixing are not implemented.

## Deliverables, grouping and the project setup sheet — 2026-10-26

- The 6-format cap that produced errors on project creation is gone: a project now accepts up to 24 deliverables (`MAX_PROJECT_FORMATS` in TypeScript, 24 in the Rust validator), which covers every preset plus custom sizes. The check runs before the format is added, and the setup and Deliverables screens disable adding past the cap instead of failing later.
- The new-project modal is now a fixed-height sheet: a scrolling body with the header and the summary/actions pinned, so it fits a laptop. Measured at 1280×800 (sheet 768 px tall, actions visible) and 1440×900 (868 px, actions visible). The preset grid is grouped into platform sections (YouTube, Instagram, TikTok, Facebook, X, LinkedIn, Pinterest, Snapchat, 4K masters) laid out in two columns; the setup and Deliverables screens both use the same groups and show "N formats · M files" before starting.
- Identical renders are combined at export. `groupFormatsByOutput()` groups selected formats by size, frame rate, quality, and per-scene framing overrides; one plan is built per group, so six 1080×1920 social formats cost one encode instead of six. The file name lists each platform once with a two-letter code (`yt-ig-tt-fb-sc`), drops the quality suffix, and keeps the size in a hyphenated name, e.g. `Story-v1-yt-ig-tt-fb-sc-1080x1920.mp4`. The project token is capped at 48 characters and `safe_filename` allows 120, so the platform codes and size never truncate.
- The export dialog reports the combined result up front ("10 selected · 3 files"), explains why ("10 formats share 3 renders…"), lists one file name per group with the platforms it serves, and labels the action "Export 3 videos". Project cards show the project's aspect chips and format count so the deliverables are visible from the library.
- Tests: `tests/formats.test.ts` covers platform grouping completeness and order, slug rules, output signatures (name-insensitive, override-sensitive), group collapsing/preserving order, custom sizes joining a group, and the 24/25 cap boundary. Rust adds `accepts_twenty_four_deliverables_and_rejects_more`. Totals: 136 TypeScript tests, 33 project-model tests, 21 native tests; `tsc`, the production build, and `npm run ci` pass.
- Browser checks: all 15 presets selected in both viewports with the sheet fully on screen and the footer visible; a project with 10 formats opens without errors (header shows "Formats 10"); card badges read 16:9 · 9:16 · 4:5 · 10 formats; the export dialog collapses those 10 formats into 3 files with the combined names above; the Deliverables sheet shows the same grouping and summary. Reviewed `output/playwright/format-setup-1280.png`, `format-setup-1440.png`, `format-project-card.png`, `format-export-combined.png`, and `format-deliverables.png`.
- Boundary: grouping compares framing overrides, so two formats with different per-scene framing still render separately. Batch exports of many distinct outputs still encode each one; only identical renders are shared.

## Captions, video clip sound and longer clips — 2026-10-26

- **Caption import.** `src/components/text/captions.ts` parses SRT and WebVTT locally, strips `<i>`/`<c>`/`{\an8}` markup and entities, ignores `NOTE` blocks and inverted/empty cues, sorts cues, and reports a readable error when nothing is found. `placeCaptions()` clips each cue to the scene it starts in, respects the eight-layer scene limit, splits cues longer than 110 characters at word boundaries with proportional timings, and returns only the changed scenes so the editor applies one undoable `updateMany`. The Text panel gained **Import captions** (hidden file input, works in the browser and the native webview). Verified with a two-scene, ten-second project and a three-cue SRT: two captions landed at 1.0–2.5 s and 3.0–5.0 s, the cue at 11 s was reported as skipped, and the toast read “2 captions across 1 scene · 1 skipped”.
- **Per-clip video sound.** Scenes gain an optional `videoVolume` (0–100, missing = 100) in TypeScript and Rust with validation (negative, over 100, NaN rejected). The preview multiplies its fade envelope by the level via `videoGain(..., level)`; the export plan carries `videoVolume` and the FFmpeg graph applies `volume=` before the clip fades; the Speed inspector exposes **Clip sound** and a **Play the clip's own audio** toggle. Verified in the browser with a 40 % clip: the playing video element reported `volume 0.4`, unmuted.
- **Longer video clips.** Photos stay at the 30 s cap; video scenes can now run to ten minutes, bounded by the imported source (validator, `setSceneSeconds`, `trimSceneWindow`, the import clamp, the Duration slider and its speed-derived clamp all use the per-kind cap). Rust adds `max_video_ticks()`. Verified with a 90 s video scene: it opens as 90.0 s instead of truncating, and the Duration slider reports `max=600`.
- Tests: `tests/captions.test.ts` (12) covers SRT/VTT parsing, tags, NOTE blocks, inverted cues, ordering, splitting, placement across scenes, clipping, the eight-layer cap, out-of-timeline cues, and caption styling. `tests/video-clip.test.ts` (5) covers the per-kind duration cap, fades, `videoVolume` bounds and scene patches. Rust adds `video_clips_allow_longer_durations_and_a_clip_sound_level`; totals are 154 TypeScript tests, 34 project-model tests and 21 native tests.
- Reviewed `output/playwright/captions-imported.png` and `video-clip-sound.png`.
- Not done in this pass: disk-streamed media (the 50 MB import cap still applies), keyframes, multi-track video, beat markers, i18n, or signing. Those are separate slices.

## Motion keyframes — 2026-10-26

- Text layers and elements accept up to 24 keyframes each, stored as seconds from the layer start with optional x, y, scale, rotation and opacity. A property with one key holds that value; properties a key omits keep the layer's static value; interpolation is linear per property.
- `src/components/animation/keyframes.ts` holds the pure maths (`motionAt`, `applyTextMotion`, `applyElementMotion`, `upsertKeyframe`, `removeKeyframe`, `keyframeAtPlayhead`); `KeyframeControls` is the shared inspector panel used by the Text inspector and the element inspector. Text motion scales the font size; element motion scales around the element's centre so it stays anchored.
- The renderer resolves motion before entrance/exit animation in all four places that draw layers: scene text, the standalone text overlay used for stills/frames, `drawMediaOrShape` for elements and project overlays, and the canvas selection boxes. Exported overlay frames are rasterised through the same functions, so preview and export agree by construction.
- Validation: TypeScript and Rust reject keyframes outside the layer duration, out-of-range values, non-finite times, and more than 24 keys. Rust adds `validate_keyframes()` and validates both text layers and elements.
- Tests: `tests/keyframes.test.ts` (13) covers interpolation before/between/after keys, per-property fallback, single-key holds, text and element transforms, editing/capping, and model validation. Counts are listed in the build-state section at the end of this log.
- Browser checks: a text layer keyframed from x 15 % to 60 % moved its selection box (15 → 37.5 → 60) and its canvas glyphs (minX 36 → 58 → 81, minY 31 → 41 → 51) across 0 s, 2 s and 4 s; the inspector added a third key (2 → 3 rows, "Motion keyframes · 3"). An element keyframed from 30 % to 70 % moved its hitbox (12.5 % → 52.5 %) and showed "Motion keyframes · 2". Reviewed `output/playwright/keyframes-preview.png` and `keyframes-element.png`.
- Boundary: keyframes animate text and element geometry only. Photo framing (zoom/pan) and per-format framing still use the existing presets plus static values; easing curves, per-character effects, and keyframes on audio levels are not implemented.

## Shape masks for photos and overlays — 2026-10-26

- Photo scenes and image/video overlays accept an optional shape mask: rectangle, ellipse, triangle, or star, with centre, width, height, rotation, feather (0–100), and inversion. Geometry is relative to the layer's own box, so overlay masks follow drag, scale, and keyframe animation without a separate mask track; photo masks follow the scene's framing.
- The mask is baked into the photo/overlay alpha before compositing. `applyMaskAlpha()` builds a blurred white alpha matte and applies it with `destination-in`; inverted masks punch the shape out of a full matte. Photo masks leave the scene's framing background visible outside the shape. Because the transparent overlay frames used by the MP4 exporter come from the same compositor, preview, still frames, thumbnails, and exported frames share the cutout.
- The element inspector exposes **Shape mask** for image/video overlays, and the Framing inspector exposes it for photo scenes. Slider drags stage one edit and commit on release; shape changes, inversion, centring, and removal are immediate undoable commands. Video scenes, shape elements, captions, and text layers do not offer masks.
- Validation in TypeScript and Rust rejects unknown shapes, out-of-range geometry or feather, masks attached to non-media layers, and masks on video scenes. Older projects omit the field and keep working.
- Tests: `tests/mask.test.ts` (5) covers defaults, polygon geometry, overlay and photo-scene round-trips, video-scene rejection, and rejected shapes/values/non-media targets. Rust adds `shape_masks_round_trip_and_stay_on_media_layers`. Totals: 183 TypeScript tests in 24 files, 38 project-model tests, and 21 non-ignored native tests; all 9 ignored FFmpeg integration tests also pass.
- Browser checks: a red 80 %-wide image overlay with a 40 % ellipse mask over a blue scene sampled `[226,59,59,255]` at the centre and `[27,79,216,255]` at the overlay edge; the exported overlay frame sampled alpha `255` at the centre and `0` at the edge/corner. Selecting Star and inverting swapped the centre back to blue and the edge to red. A masked photo scene sampled `[211,59,59,255]` at the centre and `[0,0,0,255]` at the corner, with the framing background visible outside the ellipse. No console errors.
- Reviewed `output/playwright/shape-mask-ellipse.png`, `output/playwright/shape-mask-star-inverted.png`, and `output/playwright/shape-mask-photo-scene.png`.
- Boundary: masks cover photo scenes and overlay images/videos only. Blend modes, chroma key, mask animation as a separate property, and polygon/pen masks are not implemented.

## Photo framing keyframes — 2026-10-26

- Photos gain up to 24 framing keyframes (`at`, optional `x`, `y`, `zoom`) stored on the scene and validated in TypeScript and Rust (time inside the scene, pan −1…1, zoom 1–4). Missing values fall back to the scene's static framing, and a single key holds.
- `framingAt()` resolves the pan/zoom before the motion presets are combined, so hand-authored keys work with Fill, Fit, Blur fill, and the camera-movement presets. The result is used by the canvas compositor, so preview, thumbnails, still frames, and the baked photo frames in every export format share it.
- The Framing inspector gained **Framing keyframes** with the playhead-capture workflow, per-key values, delete, and clear. The panel is hidden for video scenes, whose framing is encoded by FFmpeg rather than the canvas.
- Tests: framing interpolation/fallback/capture/validation in `tests/keyframes.test.ts` (now 17), plus the Rust `validates_framing_keyframes`. Counts are listed in the build-state section at the end of this log.
- Browser check: a red/white/blue split photo keyframed from x −0.6 to +0.6 moved its centre sample from red to blue between 0 s and 3 s, and the inspector added a third key at 1.5 s (“Framing keyframes · 3”). Reviewed `output/playwright/framing-keyframes.png`.
- Boundary: framing keys apply to photos only; video clip framing stays static because the encoder path crops in FFmpeg. Easing is linear.

## Beat markers — 2026-10-26

- Projects store up to 500 manual beat markers as sorted, deduplicated project ticks (`beatTicks`), validated in TypeScript and Rust and applied through a dedicated `beats` command. Old projects simply have none.
- The timeline toolbar gained **Add beat at playhead**; markers render as amber lines with a diamond at the top across every track. Clicking a marker removes it. Markers are editing aids only and never reach the export.
- Overlay moves and trims snap to the nearest marker (whichever edge is closer for a move, the dragged edge for a trim) while the snapping toggle is on, using an 8 px threshold converted to ticks. `src/components/timeline/beats.ts` holds the pure snapping maths.
- Tests: `tests/beats.test.ts` (7) covers nearest-beat selection, move/trim snapping, threshold and empty-list behaviour, the one-tick minimum, and project storage/validation. Rust adds `beat_markers_are_sorted_bounded_and_deduplicated`. Counts are listed in the build-state section at the end of this log.
- Browser check: a project with three markers showed three lines; adding one at 1.5 s produced a fourth and clicking a marker removed it again, with no console or app errors. Reviewed `output/playwright/beat-markers.png`.
- Boundary: markers are manual. There is no tempo detection or audio analysis, and only overlay timing snaps today (clip order is list-based).

## Local beat detection and cut sync — 2026-10-26

- `src/components/timeline/beat-sync.ts` adds energy-novelty beat detection and image-free cut snapping. It decodes the selected audio locally at 8 kHz, computes frame RMS, positive energy change, a standard-deviation threshold and a 180 ms minimum gap, then estimates tempo from the median beat interval (normalised to 60–180 BPM).
- **Detect beats** in the Audio panel adds the detected pulse to the existing beat-marker system, offset by the clip's timeline start, clipped to the story, deduplicated within two ticks, capped at 500 and merged with any manual markers. The amber markers immediately snap overlay moves and trims through the existing `beats.ts` path.
- **Snap cuts** uses the markers when present (or analyzes the clip once if not), and moves each photo cut within 0.35 s of a beat. Scene count, order, text, effects and the final end stay fixed; the minimum clip length and 30 s photo cap are enforced. Video stories are rejected with an explanation, and the whole retime is one `updateMany` undo step.
- Tests: `tests/beat-sync.test.ts` (8) covers a synthetic 120 BPM click track, silence/invalid input, marker conversion/offset/clamping/deduplication, cut snapping, tolerance, minimum duration, fade clamping, audio offset and one-scene stories. No Rust changes were needed because markers already validate and sync through existing commands.
- Verification: 202 TypeScript tests in 27 files, 38 project-model tests, 22 non-ignored native tests, and all 9 ignored FFmpeg integration tests pass.
- Browser check: an 8 s, 120 BPM click-track WAV on a four-scene story showed **120 BPM**, added 15 markers, and reported “Found 120 BPM · 15 beat markers added”. **Snap cuts** then changed the four scene durations from `2.3 / 2.3 / 2.3 / 2.3 s` to `2.5 / 2.5 / 2.5 / 2.3 s`, aligning the three cuts to markers. No console errors. Reviewed `output/playwright/beat-sync-detected.png`.
- Boundary: detection is a lightweight local pulse tracker, not a downbeat/key detector or a full tempo map. It works best on steady music; cut sync intentionally handles photo stories only, and markers are not exported.

## Music ducking — 2026-10-26

- Projects can store a ducking depth (`0–100`, missing = off), validated in TypeScript and Rust and set through a `ducking` command. The Audio panel exposes **Lower music under video sound** with a 10–90 % slider and a hint that explains when it applies.
- `audibleVideoWindows()` collects the timeline windows where a video clip has sound (per-clip level above zero); `duckGain()` returns the music gain with 150 ms ramps at each edge, using the deepest overlap. The preview multiplies every music clip's volume by it while leaving action sounds alone.
- The export builds the same envelope per music clip: `ducking_expression()` emits `1-amount/100*max(0, clip(...)*clip(...))` in clip-local time, injected as `volume='…':eval=frame` before the clip fades and delay. `max` always carries a leading `0` because FFmpeg rejects a one-argument `max`.
- Tests: `tests/ducking.test.ts` (5) covers window collection, depth, ramps, overlap and project validation; Rust adds `ducking_expression_targets_video_windows`, and the ignored `plan_export_keeps_imported_video_audio` now includes a music bed plus ducking so a real FFmpeg graph evaluates the expression. Counts are listed in the build-state section at the end of this log.
- Browser check: a video + photo project with a two-second music bed and 60 % ducking played the music at volume 0.42 inside the clip (ramping out) and 1.00 over the photo, with the Audio panel showing 60 %. Reviewed `output/playwright/music-ducking.png`.
- Boundary: ducking applies to imported music clips, not action sounds, and is a single project-wide amount rather than a per-clip envelope.

## Hue, vibrance and split toning — 2026-10-26

- Photo scenes gain six optional colour controls: hue rotation (−180–180°), vibrance (−100–100), shadow tint colour/strength, and highlight tint colour/strength. Missing fields keep old projects neutral, and the new values round-trip through TypeScript, Rust and the native bundle.
- The controls extend the existing portable RGBA grade rather than using Canvas filters. Hue rotates the colour matrix, vibrance weights saturation toward already-muted pixels, and split toning blends the chosen colours by luminance with squared shadow/highlight weights. `hasColorGrade()` now recognises the new controls, so a neutral scene still skips the pixel pass and the `.cube` LUT.
- Video export needs no new FFmpeg code: `gradeLutCube()` bakes the same pipeline used by the preview into the existing `lut3d` path. The LUT test now samples a lattice point from a scene using every new control and compares it to `applyColorGrade`.
- The Color inspector adds **Hue**, **Vibrance**, and a **Split toning** panel with two colour pickers and two strength sliders. Reset colour restores all six fields.
- Tests: `tests/filters.test.ts` now has 11 tests (new coverage for detection, hue/vibrance/tints, model round-trip and range rejection) and the Rust project suite adds `colour_balance_fields_round_trip_and_validate`. Totals: 208 TypeScript tests in 28 files, 39 project-model tests, and 23 non-ignored native tests.
- Browser check: a black-to-white gradient with hue 20°, vibrance 35, red shadows at 100 % and blue highlights at 100 % sampled `[196,8,13]` near the top, `[119,72,136]` in the middle and `[54,53,246]` near the bottom, with the split-tone panel showing the chosen colours. No console errors. Reviewed `output/playwright/colour-balance.png`.
- Boundary: these are global per-scene controls, not masked HSL bands or a full RGB curve editor. Video frames use the baked LUT; split toning and vibrance preview through the canvas only.

## Streamed native video — 2026-10-26

- Native video import now streams the picked file into the local asset store (`assets/<sha256>.<ext>`, 1 MB chunks, 4 GB cap) and writes `pixcut-asset:<hash>` into the scene instead of base64. `asset_path` plus Tauri's asset protocol (`app.security.assetProtocol`, scope `$APPDATA/assets/**`, CSP `asset:`/`http://asset.localhost`) turn that reference into a playable URL; the browser preview keeps data URLs and the 50 MB cap.
- Hydration keeps scene video references on native (`hydrate_project(..., keep_video_refs)`), so the editor, undo history and recovery JSON never hold the clip. Project bundles still embed the video (bundle save hydrates everything), and images/audio keep their existing embedded flow.
- The export plan accepts `pixcut-asset:` segments; `encode_plan` resolves them to the stored file and feeds FFmpeg directly, with a clear error when the store lost the file. Plan validation accepts both data URLs and well-formed references.
- Missing-media detection stays honest: `missing_asset_refs` asks the store which references still exist, new references are treated as present until the check answers (no banner flash on import), and the save/export guards use the same set.
- Tests: `tests/media-url.test.ts` (3) covers reference recognition and pass-through; `tests/missing-assets.test.ts` adds present-reference handling and `projectAssetRefs`; Rust adds `asset_file_finds_streamed_media_and_rejects_bad_ids`, `ducking_expression_targets_video_windows`, and the ignored `plan_export_reads_streamed_video_assets`, which writes a real clip into a temp store, exports a `pixcut-asset:` plan segment and probes 1920×1080 output. Counts are listed in the build-state section at the end of this log.
- Boundary: the asset-protocol playback path was verified by build, config and the Rust export test; it was not exercised through the packaged webview here (no accessibility automation). Saving a `.pixcut` bundle still reads the whole video into memory to embed it, and audio/images remain in-memory.

## Template projects keep their own photos — 2026-10-26

- `startTemplate()` no longer passes the open project's `sourceMedia` into `buildTemplateProject()`. A template now always starts from its bundled photography, including when the template confirmation is opened over an existing story.
- Replaced the previous “swap in current media” path with an explicit comment and regression browser check. Users can still replace any scene photo afterwards from the Media panel or inspector.
- Browser check: opened the blue `Template isolation` project, chose **Wild escape**, confirmed the new project, and found three bundled JPEG data URLs in the media panel. The old blue image was not present (`old photo reused false`), the project title was `Wild escape`, and there were no console errors.
- Reviewed `output/playwright/template-isolation.png`.

## Streamed native audio — 2026-10-26

- Native audio import now uses `import_audio`, streaming the file into the same asset store (1 MB chunks, 1 GB cap) and storing a `pixcut-asset:<hash>` reference in the clip. The browser build keeps data URLs and the 50 MB cap.
- Runtime hydration keeps audio references on native alongside video; project bundles still embed both. `AudioSource` resolves references to `asset://` URLs, the waveform decoder fetches the resolved URL (CSP `connect-src` now allows the asset scheme), and `audioDuration` reads metadata from the resolved source.
- Both export paths resolve audio references: the plan path passes the stored file straight to `write_audio`, while the legacy photo path hydrates audio into data URLs before encoding. A missing file produces a relink error.
- Tests: the ignored `plan_export_reads_streamed_video_assets` now also stores a WAV, gives the project a `pixcut-asset:` audio clip, exports and asserts an audio stream; native tests remain green. Counts are listed in the build-state section at the end of this log.
- Boundary: browser audio is unchanged, and project-bundle saves read streamed media into memory to embed it.

## Real-photo templates with a CapCut-style gallery — 2026-10-26

- The gallery grew from 5 procedural-gradient stories to 13 stories across Nature, Travel, People, Family, Birthday, Social and Food. Each story has three scenes, its own type system (Bebas, Playfair, Archivo Black, Space Grotesk, DM Sans, Caveat), entrance animation, transition, colour filter and framing move, plus a small accent bar where the design calls for one.
- Photography: 33 CC0 photos ship in `public/templates` (7.5 MB, 1200 px JPEGs) with `credits.json` (title, photographer, licence, Wikimedia Commons page). Sources are Unsplash photographs archived on Commons; nothing is fetched at runtime. `src/templates/photos.ts` is the typed catalogue and the loader: it reads a bundled file into a data URL once per session, so a project embeds its media and stays self-contained when saved or moved.
- `buildTemplateProject` is now async: it reads the three photos for a story (falling back to a bundled neutral placeholder, then to a 1×1 image, so a template always opens), builds the scenes and then lets your own media replace the bundled photos as before. When your photo replaces the artwork, text keeps the template's look — a stronger drop shadow always, a backdrop only where the design already had one (previously every layer was forced to a 35 % backdrop).
- Gallery cards now show the story's first photograph full-bleed with the real headline type over it (container-query sizing, so it scales with the card), instead of a generated gradient. The old thumbnail pre-render pass was removed; the photos are the previews, so opening Home or the gallery does no canvas work.
- Photo credits are visible in the gallery under **Photo credits** (33 entries) and in `public/templates/credits.json`; the app stays offline.
- Tests: new `tests/templates.test.ts` (7 tests) checks every story has three CC0 photos with a Commons source, unique ids/names, valid categories/aspects/durations, three editable text layers per scene, embedded data URLs, scene chaining without gaps, user-photo substitution (including a video clip keeping its own duration and losing motion), the fallback path, and that each story has a distinct typographic signature. The substitution test also asserts the design survives your photos (shadow on, backdrop only where the template already used one). `npx tsc -b` and `npm run build` pass; the template tests pass 7/7. (The wider suite was 208 passing at the time of writing with one unrelated failure in `tests/element-catalog.test.ts`, which is mid-edit in the same working tree.)
- Browser check `desktop/tests/browser/templates.js` against the Vite preview: 8 category tabs, 13 cards, 0 broken images (naturalWidth 1200), and starting “Wild escape” produced 3 scenes whose images are `data:image/jpeg` (no network links) with the expected titles; no console errors. Reviewed `output/playwright/templates-gallery.png`, `templates-scene.png`, `templates-credits.png`, `preview-mountain-air.png`, `preview-caf-diary.png`, and `output/playwright/template-*` for 9:16 and 1:1 stories. A layout probe over every story at its real project size found no title overflowing its box (right edge ≤ 97 %, bottom ≤ 95 %).
- Not changed: opening a template while another story with photos is open still fills the new scenes with those photos (existing behaviour); the gallery artwork shows the bundled photo, which is what the card advertises.

## Native application menu — 2026-10-26

- A native menu is built during setup: PixCut (about, hide, quit), File (new, open, save, import, export, close), Edit (undo/redo), View (home, fullscreen preview, safe area, settings), Playback (play/pause, forward, backwards, stop), and Help (keyboard shortcuts).
- Menu items emit their id to the webview and run through the same `runCommandId` path as shortcuts, so disabled states and notices match. Home and fullscreen are handled directly; accelerators are intentionally left to the webview so a remapped shortcut cannot fire twice.
- Verification: `cargo test` compiles the menu, `npm run ci` passes, and the debug bundle builds. Menu clicks were not automated (the packaged webview is not scriptable from this environment); the mapping is a one-to-one copy of existing command ids.

## Media preview navigation and video controls — 2026-10-26

- The media preview now has previous/next buttons and ←/→ keyboard navigation across the current media list (the filtered list when it contains the previewed item, otherwise all project media). The counter shows the position, and switching resets the video transport.
- Video previews use a custom transport instead of native browser chrome: play/pause, a seek slider with elapsed/total time, mute, and a 0–100 % volume slider. Space toggles playback, ↑/↓ change volume, and M toggles mute; these shortcuts are ignored while a slider or text field has focus.
- Audio volume is shared across previews and applied when the video element mounts. The preview keeps `autoPlay`; if the browser blocks audible autoplay the user can start it with Space or the play button.
- Browser check: a project with two video entries and one image opened `Aurora A` at `1 / 2` (identical videos are deduplicated), ← moved to `Still frame`, → returned to `Aurora A`, Space paused the already-playing clip, ↓ reduced volume from 0.80 to 0.75, and the mouse next arrow switched again. The transport rendered one seek slider and one volume slider. No console errors. Reviewed `output/playwright/media-preview-controls.png`.

## Video template and local template music — 2026-10-26

- `src/templates/media.ts` adds a bundled six-second generated motion background (`aurora-motion.mp4` + poster), two generated 20-second music beds (`soft-pulse`, `night-drive`), and data-URL loaders. All are CC0, generated for PixCut, and listed in `public/templates/credits.json`.
- Every template now carries a local score, selected by category, with a clip volume, fade-in and fade-out. Photo templates use `soft-pulse`; Social/Birthday/Food templates use `night-drive`. A missing score falls back to a silent template instead of failing creation.
- A new **Motion opener** template builds three two-second video scenes from the bundled clip with poster frames, source windows at 0/2/4 s, text layers, and `Night drive` audio. Its gallery card shows VIDEO and MUSIC badges. Templates that cannot read their video keep the bundled-photo fallback.
- `buildTemplateProject()` accepts injectable video, poster, and audio loaders for tests. `tests/templates.test.ts` now has 7 tests covering the video/poster/image paths, source windows, score duration and CC0 metadata.
- Browser check: applying **Motion opener** produced `Motion opener`, three timeline clips with VIDEO badges, and an audio clip named `Night drive`; no console errors. Reviewed `output/playwright/video-template.png` and `output/playwright/template-gallery-media.png`.
- Verification: 209 TypeScript tests in 28 files, 39 project-model tests, 23 non-ignored native tests, and all 10 ignored FFmpeg tests pass.
- Boundary: the motion background and scores are generated assets, not a curated stock-video or licensed-music library. Video templates currently use one bundled clip; user-supplied video slots and per-template video galleries remain future work.

## Timeline accessibility — 2026-10-26

- Scene clips announce `Scene N: name, start to end seconds, video/photo` plus `aria-pressed` and `aria-current`; text layers announce their scene, title and visible window; overlays and audio clips announce their name and timing with selection state. All are buttons, so Enter selects a focused clip.
- Timeline rows are labelled `role="group"` regions (Text, Elements/Overlays, Visuals, Audio track N); the timeline is `aria-describedby` a visually hidden hint describing J/K/L, arrow stepping and Space. The save status is a `role="status"` polite live region.
- Verified in the browser: the labels, roles, `aria-current`, and live status are present; focusing the second scene and pressing Enter moved selection (first `aria-pressed` true→false, second false→true) with no console errors. Reviewed `output/playwright/timeline-a11y.png`.
- Boundary: this is a labelling and keyboard-selection pass, not full screen-reader workflow validation; narration of colour, filters and drag-only gestures is still limited.

## Hardware (VideoToolbox) encoding — 2026-10-26

- `ExportOptions` gains an optional `hardware` flag. On macOS, H.264 and H.265 can use `h264_videotoolbox`/`hevc_videotoolbox` with a bitrate derived from the CRF presets (bits-per-pixel mapping, HEVC scaled by 0.6, clamped to 1.5–60 Mbps). VP9 and ProRes ignore the flag; other platforms report no hardware encoder.
- `exporter_hardware` reports availability from the local FFmpeg, and the export dialog shows a **Hardware encoder** checkbox (disabled for unsupported codecs or when unavailable). Both export paths pass the flag.
- `check_encoder` verifies the hardware encoder and the container's audio encoder before opening a destination.
- Tests: `hardware_encoding_uses_videotoolbox_and_a_sane_bitrate` (macOS) covers encoder args, the bitrate bounds and the VP9 fallback; the ignored `real_hardware_export_encodes_h264` encoded a real project with VideoToolbox and probed `h264` 320×240 output. Counts are listed in the build-state section at the end of this log.
- Boundary: hardware encoding is macOS-only in this build. Windows NVENC/QSV, constant-quality controls (VideoToolbox is driven by bitrate here), and cross-machine size/quality comparisons are not covered.

## Template text bounds, shapes and replacement feedback — 2026-10-26

- Restored the basic shape library that templates and older projects use: Rectangle, Circle, Triangle, Star, Line, Arrow, Sparkle and Heart now appear under a dedicated **Shape** category. The catalogue is 32 presets; legacy shape artwork still opens unchanged.
- Text layout now clamps the text box horizontally and vertically inside the canvas, and clamps width to the remaining canvas width. This keeps template/editor text inside the frame when an older project or template stores a generous x/y/width. Gallery title previews also wrap long words instead of spilling past the card.
- Timeline replacement now has visible state: dragging files over the editor shows a full-timeline **“Drop an image or video on a scene”** hint, highlights every scene clip, and the hovered clip shows **REPLACE IMAGE**. While a replacement is processed the clip shows **REPLACING…** with a spinner; the overlay clears on success or failure.
- **Replace media…** and timeline drops now accept video as well as images. A video replacement probes the clip, uses its poster, keeps the scene’s text/effects and timeline position, clamps the duration to the source, and renames the scene to the file name.
- Browser check evaluated every text layer in all 14 templates at 16:9, 9:16, 1:1 and 4:5 and found no box outside the canvas after the clamp.
- Browser checks: the Shape category showed eight cards; a synthetic file drag exposed the timeline hint and the hovered `REPLACE IMAGE` state; dropping a PNG showed the replacing state and finished with “Image replaced”; dropping a generated MP4 produced a VIDEO badge and “Video replaced”. No console errors. Reviewed `output/playwright/shape-library-restored.png`, `timeline-file-drop-hint.png`, and `timeline-replacement-done.png`.
- Verification: 209 TypeScript tests in 28 files, 39 project-model tests, 24 non-ignored native tests, and all 11 ignored FFmpeg tests pass.
- Boundary: native Finder/Explorer drops are now handled through Tauri drag-drop events and `import_media_path`; only macOS has been exercised locally. Replacement still hashes/decodes the source before committing, so very large images can take a moment; the replacing state makes that wait visible.

## Streamed bundle saves — 2026-10-26

- `.pixcut` bundle creation no longer hydrates streamed media into memory. `build_bundle` now accepts the asset directory, records references as bundle entries and hands `write_project_bundle` a `BundleSource::File`, which `std::io::copy`s from the store into the zip. Embedded data URLs still take the byte path.
- Missing references keep blocking portable saves with the relink message; opening a bundle resolves references from its assets exactly as before.
- Tests: the new `streamed_media_saves_into_a_portable_bundle` persists a photo and a music bed, saves the bundle from references, and asserts the reopened project equals the original (with data URLs); `missing_assets_stay_referenced_and_block_portable_saves` still covers the failure path. Counts are listed in the build-state section at the end of this log.
- Boundary: zips still use stored (uncompressed) entries; compression is a separate trade-off.

## Streamed native photos — 2026-10-26

- `import_images` streams each picked PNG/JPEG/WebP into the local asset store (1 MB chunks, 500 MB per file) and returns references; the native image import path now creates scenes with `pixcut-asset:` photos instead of base64. The browser path is unchanged (10 MB per file, ~64 MB combined).
- Runtime hydration keeps scene photo references alongside video and audio; overlays and their posters still hydrate. Missing-reference detection already covers photos, so a deleted photo still shows the relink banner.
- Rendering resolves references through the tested asset URL path: the canvas compositor (`loadImage`), the media grid, overlay thumbnails, the timeline filmstrip, and the media preview modal now use a small `AssetImage`/`ClipFilmstrip` component that waits for the asset protocol and falls back to a “missing” state.
- Testing: native tests keep passing after the hydration change (photo round-trip tests now use full hydration where they compare data URLs), and the browser media check confirmed two tiles, both filmstrips, the preview image at 1920 px, and no console errors. Counts are listed in the build-state section at the end of this log.
- Boundary: the native asset-protocol image path is verified by build and Rust tests, not by driving the packaged webview; bundle saves stream photos like video/audio.

## 200 designer elements and clean templates — 2026-10-26

- Replaced the 32-entry picker (including the reintroduced Shape category) with exactly 200 individually named presets in 20 collections: Creator, Lower thirds, Captions, Chapters, Notifications, Tutorials, Timers, Audio, Screens, Travel, Food, Fitness, Shopping, Events, Reactions, Badges, Data, Callouts, End screens, and Stories. They combine composed layouts, editable copy, 165 local Lucide illustration symbols and timeline motion. The icon artwork retains its ISC license in `preset-icons.LICENSE`.
- Removed standalone rectangle, circle, triangle, star, line, arrow, sparkle and heart presets. Removed the rectangle accent generator from all bundled photo and video stories. Existing project artwork is retained for compatibility; new templates contain no decorative element layers.
- Added search, 20 collection filters, seven use-case category filters, an explicit 200-item count, progressive 40-preview loading, and a collapsed project-overlay list. Category and collection choices reset each other to avoid confusing empty intersections. Thumbnails animate only while visible, respect reduced-motion preferences and stay visible at the low-opacity portion of an entrance preview.
- Added schema 14 with stable per-element `presetId`, validated in both models and preserved through commands, save/reopen and old-schema migration. Versions 1–13 remain accepted. Unknown future preset IDs gracefully use the base artwork. Both export planners render the presets' internal animation frame by frame even with a Still entrance. Preview and FFmpeg use the shared designer compositor and loaded local fonts.
- Primary and secondary artwork text is editable, including Unicode. Decorative English microcopy was removed. QR cards remain offline. Audio cards use actual decoded audio; tutorial key presses, mouse interactions and checklists retain their real behavior. Message notifications honor their reveal time. Device presets use their own distinct frame designs rather than exposing an unrelated legacy frame-style selector.
- Native template verification exposed a platform MIME mismatch: WebKit/Tauri can return M4A with a noncanonical content type. The bundled-media loader now preserves the bytes while canonicalizing M4A, MP4 and JPEG to the project's accepted MIME types. A test covers octet-stream input for all three types.
- Verification: 220 TypeScript tests, 40 Rust project tests and 25 native tests pass (11 FFmpeg integration tests were ignored in that native run). The browser regression `tests/browser/preset-library.js` renders all 200 designs and asserts 200 distinct outputs, reaches all 200 tiles, tests search/collection filtering, confirms removed primitives are absent, edits Polish/Japanese copy and reopens it with the same preset identity. Tests build every bundled template with no decorative element layers and validate all 200 preset IDs through both migration paths.
- Visually reviewed all five 40-design contact sheets, the editor and the decoded 90-frame / 3 s / 1280×720 H.264 montage. Artifacts: `output/playwright/designer-contact-1.png` through `designer-contact-5.png`, `designer-library-editor.png`, `designer-elements-export.mp4` and `designer-elements-decoded.png`. `git diff --check` passes.
- Final production/debug app bundle passes (59.67 MiB). Native verification opened a fresh Motion opener video template with its Night drive music, three video scenes and no decorative element layers; the previous audio-format rejection is resolved. The native gallery reports 200 elements and all 20 collections. Adding Editorial nameplate preserved the design identity and editable copy through the native command response; that test addition was undone. The saved Motion opener project is left running on Elements.

## Media store usage and cleanup — 2026-10-26

- `asset_usage` reports the hashed media files and bytes in the desktop store; `referenced_refs` collects every asset reference from the open project plus its undo and redo history; `prune_assets` deletes stored files whose hash is not in the supplied keep set and returns what was removed.
- Settings → General (desktop only) shows the usage and a two-step **Remove unused media** action. The frontend combines session history refs with `libraryAssetRefs()`, which scans every saved library project, so cleanup never touches media used by a saved project. Empty keep sets are rejected by Rust as a safety guard.
- Non-hashed files in the directory are ignored by both usage and pruning.
- Tests: `asset_store_reports_and_prunes_only_hashed_media` covers counting, pruning, the keep set and ignoring stray files. Browser check: `libraryAssetRefs()` found a stored reference inside a saved project, the native-only block stayed hidden in the browser, no console errors. Counts are listed in the build-state section at the end of this log.
- Boundary: cleanup cannot see projects exported outside the app or media referenced only by a project that is currently being imported; the confirmation step explains what it keeps.

## More output formats and a deliverables filter — 2026-10-26

- Preset catalogue grew from 15 to 27: 3 new platform variants (Instagram Square 1080×1080, Facebook Feed 1920×1080, LinkedIn Video 1920×1080) and a **Sizes & drafts** group with QHD 1440p, HD 720p, SD 480p, Compact 640×360, Tiny 320×180, Vertical 720p (720×1280), Vertical 480p (480×854), Square 640 and Portrait 864 (864×1080). `FORMAT_GROUPS` keeps one section per destination; `Sizes` sits before the 4K masters.
- New `FORMAT_FILTERS` + `filterFormatGroups()`: `all`, `social` (everything except sizes), `sizes`, or a single platform. Both the new-project setup dialog and the deliverables dialog render the same chip row, so 27 cards no longer arrive as one long scroll. The deliverables dialog also has a **Custom size** chip that scrolls to the custom form and focuses the name field. `Sizes` has its own short filename code (`size`), so combined names stay readable.
- Compact sizes needed a lower floor: the format validator (TypeScript and `crates/project`), the native export validator and the three UI guards moved from 240 px to 160 px minimum, still even and ≤ 3840. 320×180 and 480×854 now pass the model, the Rust project model and `validate_export_options`. Custom-size inputs accept 160–3840.
- Preview sharpness for compact deliverables: the preview canvas now renders at up to 720 px on its long edge even when the deliverable is smaller, so a 320×180 format stays crisp in the editor (measured 720×405) while the export keeps 320×180.
- Tests: `tests/formats.test.ts` gained 5 tests (15 in the file) — size ladder contents, every preset even/in-range/valid fps-quality/unique id and slug and accepted by `edit()`, compact sizes accepted with 158 px and odd heights rejected, the filter semantics and chip coverage, and the `size` filename code. Rust adds `accepts_compact_exports_down_to_160_pixels` for the encoder options and `accepts_compact_output_formats_down_to_160_pixels` for the project model (320×180, 480×854, 640×360, 160×160 accepted; 158×160 and 320×181 rejected). Full suites: 221 TypeScript tests in 30 files, 44 project-model tests, 27 native tests (11 ignored FFmpeg tests).
- End-to-end encode check: `real_compact_deliverables_encode_at_their_own_size` (ignored, needs FFmpeg) renders 320×180, 480×854 and 640×360 through both export paths — the frame-series encoder and the plan encoder — and probes each file with ffprobe: codec h264 and exactly the requested width and height. It ran green locally.
- Browser check: 27 cards in 10 groups, 12 filter chips plus **Custom size**, the Sizes chip shows exactly the 9 new presets, Instagram shows its 4, the custom chip focuses `custom-format-name`; selecting Tiny 320 + Compact 640 + HD 720p produced 4 deliverables, Tiny 320 as the active format gave a 720×405 preview canvas at a 320×180 timeline, no console errors. Reviewed `output/playwright/formats-modal-all.png`, `formats-modal-instagram.png`, `formats-modal-custom.png`, `formats-new-sizes.png`, `formats-selected.png`, `formats-compact-preview.png` and `formats-320-preview.png`.

## Streamed photos instead of base64 — 2026-10-26

- Photos now follow the same asset-reference path as video and audio. Native import/replace streams a picked file into `assets/<sha256>.<ext>` and returns `pixcut-asset:<sha>`; browser import/replace stores the original bytes in IndexedDB and returns the same reference. The live session and saved project carry the reference, not a base64 copy.
- Native `hydrate_project(..., true)` now keeps every streamed reference (images, overlays, elements, audio and legacy music), and `dispatch()` returns the persisted reference-shaped project after writing recovery. Browser `hydrateProjectAssets()` is a reference-preserving clone, while `persistProjectAssets()` still migrates old data URLs on first save.
- The browser resolver in `media-url.ts` turns a reference into an IndexedDB object URL, with a bounded URL cache. `AssetImage`, `ClipFilmstrip`, the canvas `loadImage()`, video elements, overlay video and audio elements all use it. Media-bin entries and library projects stay referenced.
- Missing-media checks in the browser now ask the asset store whether each reference exists instead of treating every reference as missing. A reference is shown as present until the check answers.
- Native `import_media` adds a single-image-or-video replacement picker that returns only a reference. `requestReplaceImage` uses it on desktop; browser replace uses `storeAssetBlob`. The old base64 hidden-input path remains only for browser/no-native file-drop fallback.
- Portable `.pixcut` saves and exports already resolve references from the asset store. The native video export plan accepts `pixcut-asset:` clips directly; no base64 round-trip is required for video.
- Native file drops now use Tauri drag-drop events (`dragDropEnabled: true`) rather than HTML5 file bytes: `import_media_path` streams the dropped path into the asset store and returns a reference, the scene under the cursor is highlighted, and dropping on a scene replaces it. Drops elsewhere import all paths into the media panel. Browser HTML5 drops still use the blob store.
- Browser check: a project saved with a green canvas photo reopened with media-tile `src` and timeline filmstrip as `blob:` URLs, a non-empty canvas (`[43,143,111]`), stored project reference `pixcut-asset:73948…`, and no missing-media banner. No console errors. Reviewed `output/playwright/streamed-images.png`.
- Verification: 290 TypeScript tests in 41 files, 44 project-model tests, 33 non-ignored native tests, and all 13 ignored FFmpeg tests pass.
- Boundary: template builds still read bundled photos as temporary data URLs before the first project commit turns them into references. Browser drag/drop uses IndexedDB blobs; the native Finder-drop path still needs a packaged-app pass on Windows/Linux. Replacing a very large image can still spend time hashing/decoding the source, but the project no longer serializes or stores it as base64.

## Cross-platform hardware encoders — 2026-10-26

- Hardware encoding now has an explicit family model: VideoToolbox on macOS and NVENC (`h264_nvenc`/`hevc_nvenc`) on Windows/Linux. Availability is still probed from the installed FFmpeg, so an unsupported build simply hides the option.
- NVENC uses constant quality (`-rc vbr -cq <crf> -b:v 0`) with p3/p5/p7 presets mapped from the speed setting, plus `hvc1` tagging for QuickTime containers. VideoToolbox keeps its bitrate model.
- Tests: `nvenc_arguments_use_constant_quality` covers the NVENC arguments, speed presets, HEVC tagging and the VP9 fallback; the macOS `hardware_encoding_uses_videotoolbox_and_a_sane_bitrate` and the real VideoToolbox encode test still pass.
- Boundary: NVENC was not exercised on real Windows/Linux hardware here — only its arguments and availability logic — so those platforms remain unverified. QSV, AMF and VAAPI are not implemented.


### Social Buttons collection — 2026-10-26

- Added ten compact CTA presets in Elements → Social Buttons: subscribe pill/outline, like counter, love sticker, bell signal, alerts switch, share arrow, comment bubble, save ribbon, and split follow button. The original 200 presets retain their identifiers and artwork.
- The collection uses the shared canvas compositor for gallery thumbnails, preview, and exported overlay frames. Text, accent color, size, entrance, and later actions remain editable. Library counts now follow the catalog.
- Validation: 223 TypeScript tests passed, including all preset identifiers, local icons, aspect ratios in landscape/square/portrait, and schema migration/reopening. Frontend production build and native debug build passed.
- Visual QA: inspected the actual editor gallery and all ten compositor-rendered designs in output/playwright/social-buttons-sheet.png. A representative H.264 encode of that sheet matched the canvas at SSIM 0.9982; this checks encoded artwork, not a full native project export.

## SRT caption export — 2026-10-26

- `textLayersAsCaptions()` converts every scene's text layers into absolute-timeline cues (title plus subtitle on a separate line, empty layers skipped, sorted by time); `toSrt()` serialises stable numbering, `HH:MM:SS,mmm` stamps, blank separators and a trailing newline.
- The Text panel's caption block now offers **Import** and **Export SRT**. Export uses `save_text_file` on desktop (SRT/VTT/TXT only, 16 MB cap, safe filename, tempfile + atomic persist) and a local download in the browser.
- Tests: `tests/captions-export.test.ts` (5) covers cross-scene absolute times, subtitle lines, empty layers, ordering, timestamp padding/rounding and exact SRT text. Counts are listed in the build-state section at the end of this log.
- Browser check with two scenes: the downloaded file was `… - captions.srt` containing cues at 0.5–1.5 s and 2.0–3.5 s with the subtitle on its own line, toast “2 captions exported as an SRT file.”, no console errors. Reviewed `output/playwright/captions-export.png`.
- Boundary: exports every text layer, not only caption-styled ones; no WebVTT output yet (import supports it).

## Social Studio and multilingual element input — 2026-10-26

- Added ten Social Studio presets (ticket, neon, halo, editorial underline, raised key, orbit, bookmark tab, playback capsule, heart stamp, and stacked plates), bringing the library to 220 presets across 22 collections.
- Element text uses automatic input direction, a Unicode code-point limit matching Rust/TypeScript validation, and composition-safe editing for IMEs. The shared canvas renderer sets direction from the first strong letter and loads the label's Inter glyph subset before drawing. Other scripts use installed system font fallbacks, with no remote font requests.
- Validation: full TypeScript suite, production frontend build, and native debug build passed. The 22 language cases cover accented Latin, Cyrillic, CJK, Korean, Arabic, Hebrew, Hindi, emoji budgets and project reopening. The browser test tests/browser/element-text.js checks Japanese composition start/end and final Unicode commits using the real React field.
- Visual QA: inspected output/playwright/social-studio-languages.png, multilingual-inspector.png, and social-studio-export-frame.png. The Arabic label was verified in IndexedDB project recovery after editing. The representative H.264 sheet encode scored SSIM 0.998865; this is an artwork frame check, not a full native project export.

## User font import — 2026-10-26

- Projects can embed up to eight imported TTF/OTF/WOFF/WOFF2 fonts (2 MB each, 9 MB total) as `fonts` entries, validated in TypeScript and Rust (IDs, names, data-URL MIME and limits). The field is optional, so older projects load unchanged; the schema is shared with v14.
- `registerCustomFonts()` adds each face to `document.fonts`, unregisters fonts removed from the project, and requests a re-render when a face finishes loading. `allFonts()` feeds the inspector picker; custom fonts fall back to Inter if loading fails.
- The Text panel has **Import font**; files are read locally into a data URL, added with a fonts command, and the canvas, still frames, thumbnails and export share the same face.
- Tests: `tests/font-import.test.ts` (4) covers storing fonts, bundled fallbacks outside a document, bad data/duplicate/empty names, the eight-font cap and clearing; Rust adds `validates_imported_fonts`. Counts are listed in the build-state section at the end of this log.
- Browser check imported the system Andale Mono face: the picker gained “Andale Mono · Custom”, the FontFace registered and loaded, the canvas rendered the monospaced face, the toast confirmed, and there were no console errors. Reviewed `output/playwright/font-import.png`.
- Boundary: fonts are embedded in the project (not subset), so very large CJK faces exceed the 2 MB limit; no font management UI beyond the cap message.

## Selection and quick-add shortcuts — 2026-10-26

- Four commands join the registry: **Select all clips** (`Mod+A`), **Clear selection** (`Esc`), **Add beat marker** (`B`), and **Add text layer** (`T`). They appear in the palette, the shortcut reference, settings and remapping like every other command.
- Availability is context-aware: select-all needs scenes, beat needs a timeline, text needs a selected scene; clearing is always available. Clearing also drops text/element selections and any overlay draft.
- Tests: `tests/shortcuts.test.ts` now checks the four default bindings, conflict-free defaults and event matching (8 tests in the file). Counts are listed in the build-state section at the end of this log.
- Browser check: `Mod+A` marked both clips selected, `Esc` cleared them, `T` added a text layer and `B` a beat marker, with no console errors. Reviewed `output/playwright/timeline-shortcuts.png`.

## Video-to-video transitions — 2026-10-26

- A transition now covers both sides of a video cut. The export planner splits a video scene into its moving part and a baked tail: the tail frames are decoded from a hidden `<video>` at the clip's own speed and blended with the next clip's first frame using the same `drawTransition` the preview uses. The segment keeps the original timeline duration, and `audioDurationTicks` lets the clip's soundtrack run through the baked tail instead of stopping at the cut.
- `drawTransition` accepts optional decoded frames for each side, so the preview blends live video frames rather than posters.
- Incoming video transitions (photo → video) reuse the existing baked photo path; the incoming video's poster is its first frame.
- Tests: `tests/transition-timing.test.ts` (4) covers the split, the one-tick floor, no-transition and 24 fps rounding; Rust adds `plan_allows_sound_to_outlast_a_shortened_video_segment` and the ignored `real_video_transition_keeps_duration_and_sound` (real FFmpeg encode: 1.0 s output, 30 frames, audio present). Counts are listed in the build-state section at the end of this log.
- Browser check imported two 1.5 s WebM clips and set a 0.6 s crossfade: at 0.2 s into the transition the canvas showed a real red/blue blend (purple) from the live `<video>` frames, the blob source was resolved, the clip badge read `0.6s`, and there were no console errors. Reviewed `output/playwright/video-transition.png`.

## QSV, AMF and VAAPI encoders — 2026-10-26

- Hardware candidates now include Intel Quick Sync (`h264_qsv`/`hevc_qsv`), AMD AMF (`h264_amf`/`hevc_amf`) on Windows and VAAPI (`h264_vaapi`/`hevc_vaapi`) on Linux, probed from `ffmpeg -encoders` and gated by platform. VAAPI also requires a render node (`PIXCUT_VAAPI_DEVICE`, `/dev/dri/renderD128`, or `renderD129`) and gets `format=nv12,hwupload` plus `-vaapi_device`; a missing device falls through to the software encoder with an actionable message.
- The chosen encoder is resolved once and threaded into the argument builder, so a machine with QSV but no NVENC does not emit NVENC flags.
- Tests: `qsv_amf_and_vaapi_arguments_match_their_encoders` and `hardware_encoder_falls_back_to_software_when_none_is_available`; the existing VideoToolbox/NVENC tests still pass.
- Hardware verification: VideoToolbox remains verified on Apple Silicon. QSV, AMF and VAAPI are generated by unit tests only; no Intel/AMD GPU is available here, so they are marked unverified on hardware.

## Speed ramps and reverse — 2026-10-26

- Video clips gain an optional `speedEnd` (a linear ramp from `speed` to `speedEnd`) and a picture-only `reverse` flag. `src/components/preview/speed.ts` is the single source of truth for the curve: it integrates the ramp for source offsets and walks the used range backwards when reversed.
- Preview: the hidden `<video>` is seeked from `sourceSecondsAt()` and `playbackRate` follows `speedAt()`; reversed clips are paused, muted and stepped by seeking because HTML video cannot play at a negative rate. Changing the end speed keeps the same source span, so the clip duration adjusts (1×→2× halves the duration for the same footage).
- Export: a ramp becomes an inverse `setpts` expression (`s = v0·t + (v1−v0)·t²/(2D)` solved for `t`), and the soundtrack is split into eight `atempo` slices joined with `concat`, keeping picture and sound aligned. Reverse uses FFmpeg `reverse`; its soundtrack is muted to match the silent preview.
- Tests: `tests/speed-curve.test.ts` (5) covers constant speed, the integral, reverse offsets, a reversed ramp and clamping; Rust adds `ramp_and_reverse_arguments_are_well_formed` and the ignored `real_reverse_and_ramp_video_export` (real encodes: a white flash moves to the start when reversed, and a 1×→2× 1 s output consumes 1.5 s of a 2 s source with a 1.0 s duration). Counts are listed in the build-state section at the end of this log.
- Browser check: a 2 s test pattern at 1.2 s with reverse showed source time 1.8 s, paused and muted; the 1×→2× ramp shortened the clip to 1.3 s, reported `Ramps 1× → 2×`, and at local 0.7 s the element sat at 0.88 s with rate 1.525 — matching the curve. No console errors. Reviewed `output/playwright/reverse-preview.png` and `output/playwright/speed-ramp.png`.

## Audio EQ and voiceover — 2026-10-26

- Music clips gain optional `low`/`mid`/`high` bands (−12…12 dB, flat by default), validated in TypeScript and Rust. The Audio panel exposes Bass 120 Hz, Voice 1 kHz and Treble 6 kHz sliders plus Reset.
- Preview routes each music element through a lazy Web Audio graph (lowshelf, peaking, highshelf) only when a band is non-zero; the element's own volume and ducking still apply. A browser that refuses the element source keeps the plain path instead of going silent.
- Export inserts matching FFmpeg `equalizer` filters after the clip volume, in both the plan encoder and the photo `encode_movie` path. Flat bands emit nothing.
- Voiceover: **Record voiceover** captures the microphone with `MediaRecorder`, shows elapsed time, and on stop stores the take as a local audio asset at the playhead (name `Voiceover N`, full volume, clamped to the project). Permission denial and missing `MediaRecorder` produce actionable messages; nothing is uploaded.
- Tests: `tests/audio-eq.test.ts` (3) covers flat detection, band validation and old clips defaulting to 0 dB; Rust adds `audio_eq_only_emits_bands_that_change` and extends `audio_must_be_local_and_bounded` with ±12 dB acceptance and out-of-range rejection. Counts are listed in the build-state section at the end of this log.
- Browser check (fake microphone): boosting Bass created exactly three biquad filters and showed `+12 dB`; the one-second take became `Voiceover 1` (1.37 s) with the toast confirmation and no console errors. Reviewed `output/playwright/audio-eq-voiceover.png`.

## Cross-scene (project) text — 2026-10-26

- Projects gain an optional `globalText` list (up to 40 layers) whose timing is absolute project ticks. `readGlobalText` validates and clamps the layers to the timeline; Rust adds the matching `globalText` command, reuses the shared text-field validator, clamps in `normalize_global_text`, and prunes layers when the last scene is removed.
- `drawProjectText()` renders the layers above scene text and elements in the preview, stills, thumbnails, baked video overlay frames, every photo segment and both transition paths, so the same text crosses cuts in preview and export.
- The Tiles panel has a **Project text** section with add, select and delete; the existing text inspector edits the selected layer through the same controls. Selecting a scene, clip or element clears the project-text selection. Staged edits use a separate draft so typing never feeds the synthetic scene into the main preview.
- Tests: `tests/global-text.test.ts` (4) covers spanning, clamping, duplicates/limit/long text and clearing; Rust adds `validates_project_level_text` (clamping, duplicates, the 40-layer cap, the command and pruning). Counts are listed in the build-state section at the end of this log.
- Browser check: two scenes with `ACROSS THE CUT` added as project text; the title rendered at 0.4 s on the blue scene and at 1.6 s on the brown scene, the panel row and inspector agreed, and there were no console errors. Reviewed `output/playwright/project-text-first.png` and `project-text-second.png`.
- Boundary: project text has no timeline row or direct drag handle yet; position, width, timing and styling are edited in the inspector.

## Interface language — 2026-10-26

- A dependency-free `src/i18n/` module keys translations by the English source string, so untranslated text falls back to English instead of rendering a blank. `setLocale()` is driven by the existing stored preference; `t()` supports `{name}` placeholders and `projectCount()` handles Polish and Ukrainian plurals.
- Polish and Ukrainian cover the home screen (navigation, headings, create cards, recent section), the editor chrome (mode, Save, Export, tool rail, panel title) and the Settings section titles and language note. The table also translates the tags used by the panel titles.
- The selector now validates the stored value, switches the interface immediately, and survives a reload. The Settings note explains that remaining editor panels are still being translated.
- Tests: `tests/i18n.test.ts` (5) covers locale validation, English fallback, Ukrainian strings, plural forms and key parity between both dictionaries. Counts are listed in the build-state section at the end of this log.
- Browser check: switching to Polski changed the home nav to Start/Projekty/Szablony/Ustawienia, the heading to “Co chcesz stworzyć?”, the create cards and the sidebar card; after a reload the choice persisted, and the editor showed “Edytor wideo”, “Zapisz”, “Eksportuj” and “Twoje media”. No console errors. Reviewed `output/playwright/language-home.png` and `language-editor.png`.
- Boundary: inspector controls, dialogs and messages are still English and fall back cleanly; they are the next extraction pass.

## Picture-in-picture labelling — 2026-10-26

- The existing timed image/video overlay path is now labelled **Picture in picture** on media tiles and in the source preview, matching what it does: a 34%-width copy in the first free corner, with the source's own timing and optional video playback.
- This is not a second visual track; the timeline still edits one contiguous base track. The overlay can be moved, resized, faded and keyframed in the element inspector, and it is baked into preview and export identically.

## Build state — 2026-10-27 (end of pass)

- `npm run ci` passes: 323 TypeScript tests, 48 project-model tests, 37 native tests (15 ignored FFmpeg tests), plus the website, link, workflow, audit and formatting gates.
- Ignored FFmpeg tests also pass locally for the new work: `real_video_transition_keeps_duration_and_sound`, `real_reverse_and_ramp_video_export`, and the existing exporter/hardware suites.
- `npm run tauri -- build --debug --bundles app` produced a fresh `PixCut.app` after the PiP, menu and export-dialog work. The updater tarball could not be signed because `TAURI_SIGNING_PRIVATE_KEY` is not exported in this shell; the app bundle itself is complete and is running from `target/debug/bundle/macos/PixCut.app` (PID 89828). The SQLite catalog survived the rebuild with 10 rows.
- No release, tag or version bump was made. Signing remains deferred by the user's decision.

## Selection-driven inspector and motion previews — 2026-10-27

- Left sidebar browses and selects media, titles, elements and audio; the right inspector follows the selected item. Audio editing controls now live on the right. Text selection exposes text properties without scene media replacement actions. Replace media is scoped to scene Framing.
- Audited scene tabs, final-scene transitions, video duration bounds, element timing and selection-specific delete actions. Removed duplicate element timing sliders and duplicate text-layer creation from the inspector.
- All 13 element motion choices have distinct live previews. Pulse, Float and Swing default to continuous repetition; text animation choices also have live previews.
- Validation: 282 TypeScript tests passed; production build and debug macOS bundle passed (60.13 MiB). Browser sidebar regression passed for scene, text, audio and element selections, saved property edits and all motion canvases.
- Rendered 96 frames through the shared compositor and encoded/decoded a 1280×720 H.264 sample with FFmpeg: every animated choice changed across sampled frames and Still remained static. Reviewed exported frame and text/audio/element inspector screenshots.
- Opened the rebuilt native app and confirmed Audio properties and Text properties follow selection in the saved Motion opener project. App left running with a text layer selected. No schema changes or release actions in this inspector pass.

## Picture-in-picture visual track — 2026-10-27

- Visual tracks gain a `role` (`base` or `overlay`). A project keeps exactly one base visual track that defines the timeline; at most one overlay track holds picture-in-picture clips. Overlay clips keep their own start ticks, cannot overlap, must sit inside the base duration and carry a `pip` placement; the base track still normalises to a contiguous timeline. Old projects load unchanged and the `Pip` command adds, replaces or removes the overlay track atomically.
- Media tiles and the source preview’s **Picture in picture** action build a PiP clip from the selected media: it probes the source aspect, finds the first free gap at the playhead, copies fit/grade/framing, clears clip text/elements/transition, and places it at 80%/78% with a 32% size, rounded corners and a shadow.
- `drawPipClips()` composites each active clip through the same `drawScene` path as the base track (photos, video frames via `overlayVideoFrame`, fit, grade), clips it to a rounded rectangle, adds a shadow and a subtle border. Preview, stills, thumbnails, baked video overlay frames, transitions and both export paths call it, so the layer matches everywhere.
- The timeline shows a **Picture in picture** row with click-to-select, drag-to-move and edge trims constrained to neighbours and the source footage. The inspector exposes start, duration, width, height, horizontal/vertical position, corner radius, shadow and fill; Delete removes the clip.
- Tests: `tests/pip-track.test.ts` (5) covers the second track, timeline length, gaps/overlaps/bounds, required placement, one-overlay limit and clearing; `tests/pip-timing.test.ts` (3) covers free-gap placement, move and trim constraints; Rust adds `validates_the_picture_in_picture_track` (track roles, bounds, overlap, placement, 50-clip cap, command and removal). Counts are listed in the build-state section.
- Browser check: adding Scene 2 as PiP over Scene 1 created one timeline clip with the inspector heading “Picture in picture”; changing width to 50% and horizontal to 22% drew a clearly visible brown rounded rectangle over the blue base, and seeking to 2.4 s removed it at the clip’s end. No console errors. Reviewed `output/playwright/pip-track.png` and `pip-track-after.png`.
- Boundary: one PiP track, no PiP-to-PiP transitions, and PiP audio is muted (the base clip’s sound and music still play).

## Inspector and timeline translations — 2026-10-27

- The second i18n pass translates the inspector tab names and tool labels (Framing, Transitions, Color, Speed, Fades, Looks), the inspector headings (scene/video/text/element/audio properties), `RangeField` labels (so Duration, Zoom, Horizontal, Vertical, Speed and others translate once for every panel), the fill modes, transition-card labels, text sections, common summaries (Position, Timing, Animation, Typography, Camera movement, Framing keyframes, Shape mask) and actions (Reposition, Make text readable, Reset styling).
- The timeline now translates its heading, Visuals, Picture in picture, Text and Elements labels, the audio lane prefix, the empty-audio hint and Add text. The preview chrome translates PREVIEW, Local only, Formats and Safe area with on/off states, and the footer translates its local-editor line.
- Browser check in Polish: the inspector read “Właściwości sceny”, tabs “Kadrowanie / Przejścia / Kolor / Zanikanie / Wygląd”, the duration field “Czas trwania”, the timeline “Twoja historia / Wizualia / Obraz w obrazie / Dźwięk 1”, Add text “Dodaj tekst”, PREVIEW “PODGLĄD” and Local only “Tylko lokalnie”; no console errors. Reviewed `output/playwright/polish-inspector.png`.
- Remaining English strings fall back cleanly; the deeper element, export and dialog controls are the next extraction pass.

## Content-first libraries — 2026-10-27

- Moved media and element imports into compact, labelled header icon buttons. Audio import shares its heading row; templates start directly with cards. Removed redundant library labels, counts and template explanatory copy.
- Title presets now appear immediately below one collapsed Layers & text tools disclosure, which retains existing project/scene text selection, project text creation, subtitle import/export and custom font import.
- Element search precedes a single row of collection/category selectors, replacing wrapping filter chips. Existing overlays remain available in a compact In project disclosure.
- Validation: 290 TypeScript tests and production build passed. Extended browser sidebar regression passed selection, persistence, animation and accessible utility checks. Main content begins 158 px (media), 150 px (titles), 239 px (elements), and 112 px (audio/templates) below the panel top at the checked viewport. No horizontal overflow. Reviewed screenshots of all five libraries.
- Rebuilt the debug macOS bundle (60.38 MiB), launched it, and confirmed compact media imports and immediately visible title presets in the saved Motion opener project. Left the desktop app running on Titles.

## Native menu localization — 2026-10-27

- The Tauri application menu is now built from `menu_label(language, key)`: English, Polish and Ukrainian cover the app, File, Edit, View, Playback and Help menus plus every item (New Project, Save, Import Media, Export Video, Undo/Redo, Home, Fullscreen Preview, Safe Area, Settings, Play/Pause, forward/reverse/stop and Keyboard Shortcuts).
- A `set_app_menu(language)` command rebuilds and replaces the menu; the frontend calls it whenever the stored language changes and at startup, so switching in Settings updates the OS menu without a restart. Unknown languages and keys fall back to English.
- Test: `menu_labels_follow_the_interface_language` covers Polish, Ukrainian, and both fallbacks. Native counts are listed in the build-state section.
- Boundary: macOS also localizes some predefined items from the system language; PixCut now supplies explicit labels so the menu follows the in-app choice.

## Export dialog translations — 2026-10-27

- The export studio now translates its section headings and controls: Encoding, Container, Encoding speed, Quality, Picture, Resolution, Frame rate, Project dimensions, Match each output, Include audio, Hardware encoder, File name, Name, Version, File naming options, Add output name, Add quality, Outputs, File names and the empty-selection hint, plus fast/balanced/slower and quality summary labels.
- The “Video source rendering” note was stale: it claimed video transitions become hard cuts and PiP is unsupported. It now says transitions keep their blend when either side is video and that PiP clips are baked into the encode.
- The i18n key-parity test still passes, so both translations cover the same keys.

## Shorter editor toolbar — 2026-10-27

- Reduced editor toolbar height from 64 to 44 CSS pixels (31.25%); Save/Export retain 32-pixel targets. Compact mode no longer imposes a conflicting 54-pixel minimum.
- 290 TypeScript tests, production build, debug macOS bundle and browser sidebar regression passed. Browser checks verify 44-pixel height in both density modes, unclipped buttons and minimum 32-pixel target height. Reviewed compact-editor-header.png. Native app remained running; a native refresh could not be confirmed because input reported that the app changed during restart.

## Bounded deliverables picker — 2026-10-27

- Split the project format picker into Social, Standard sizes (including 4K), and Custom. Preserved all 27 presets. Social platform filtering and search operate inside the selected section; custom creation has a separate panel.
- Bounded the modal to 680 CSS pixels or the available window height. Only the catalog and selection areas scroll; selected formats, per-format settings and the Done footer remain accessible. Removed long scope explanations from the picker.
- Validation: 290 TypeScript tests, production build and debug macOS bundle passed. New formats-browser.js regression verifies all 27 presets, platform/search filters and empty search state, selection retention, custom creation and quality persistence, fixed footer and no modal overflow at 1050×720. Reviewed Social, Standard sizes, Custom and minimum-window screenshots.
- Restarted the saved native app, opened Motion opener, and visually confirmed the new bounded Deliverables dialog with all three tabs. Left the rebuilt desktop app running with the dialog open. No schema or rendering changes.

## Animated transition examples — 2026-10-27

- Replaced static transition swatches with looping A-to-B sample scenes for all nine choices, including a hard-cut example. Enlarged thumbnails preserve readable names and short descriptions. Selecting a sample applies the existing transition.
- Extracted the existing transition compositing unchanged into drawTransitionFrames, shared by sample canvases and the scene playback/export compositor. Sample frames are generated locally; animation runs only while visible and pauses for app/system reduced motion or a hidden document.
- Validation: 290 TypeScript tests, production build and debug macOS bundle passed. Browser regression samples every example over a full cycle, checks reduced-motion stability and saved selection, and compares 40 compositor frames with exact pixels using consistent software canvas readback. Reviewed browser and native screenshots.
- Restarted the saved desktop app and left Motion opener open on the Transitions tab with live sample cards. No schema or transition-math changes.

## Settings and project-card translations — 2026-10-27

- Settings now translates its labels and descriptions: canvas format, photo duration, image scaling, storage refresh, reset preferences, theme (including dark/light descriptions), compact editor, reduce motion, quick-start hints, the theme preview, snapping, reset panel layout, application updates, automatic checks, update actions, diagnostics/FFmpeg checks, the storage note and the privacy cards.
- Project cards translate their status (Open now / Edited …), relative times (just now, minutes/hours/days ago) and locale-aware scene/format counts, including Polish and Ukrainian plurals. The home library controls translate sort options, Favorites, All and the search placeholder; the ghost card, “Skip the blank page” section and “Browse templates” action follow.
- `tests/i18n.test.ts` now also covers scene and format plurals (6 tests). Key parity between Polish and Ukrainian still passes.
- Browser check: home navigation, create cards, section headings and “Przeglądaj szablony” rendered in Polish with no console errors. Reviewed `output/playwright/polish-home-final.png`.

## Portable browser `.pixcut` packages — 2026-10-27

- Browser **Save/Export project** now writes the same ZIP package shape as the native app: `manifest.json` plus binary assets under `assets/<sha256>.<ext>`. The project inside the manifest keeps `pixcut-asset:` references, so no base64 media is written.
- The package builder reads referenced blobs from IndexedDB, adds SHA-256 asset entries, and stores media with `level: 0` ZIP compression (the files are already encoded photos/video/audio; only the manifest benefits from compression).
- Browser Open detects the ZIP signature and calls `readPixcutBundle()`, which validates format/version, refuses unsafe paths, checks each asset's SHA-256 and size, writes the bytes into the browser asset store, and returns the reference-shaped project. Legacy `.pixcut.json` imports still work.
- Native and browser packages are now interchangeable: native `write_project_bundle()` emits the same manifest/assets layout and can open a browser export; browser `readPixcutBundle()` accepts a native export.
- Browser check: built a one-scene project with a streamed image and audio reference, exported it to a 3,746-byte `.pixcut`, read it back, and confirmed the image/audio references and scene count survived with no data URLs.
- Verification: 298 TypeScript tests in 44 files, 44 project-model tests, 37 non-ignored native tests, and all 13 ignored FFmpeg tests pass.
- Limits: native packages allow a 32 GB archive, 8 GB per asset and 64 GB total while streaming each entry directly into the asset store; browser packages use a 2 GB archive, 1 GB per asset and 4 GB total because `unzipSync` expands in memory. Browser packages use stored (uncompressed) media, so package size is the sum of the source files. A malicious compressed archive can still consume browser memory before inner checks; native opening streams entry-by-entry.

## Template media dragging, social actions and sound cues — 2026-10-27

- Library thumbnails now carry an internal media drag identity instead of exposing their embedded/local asset URL as an external file. Dropping on the timeline appends the same source, with duplicate native/DOM drop handling guarded. The thumbnail button is explicitly draggable in WebKit and drag-end retains identity briefly for delayed native events. Existing external file imports remain available.
- Added ten Social Actions compositions (230 presets / 23 collections): subscription, like, notification, follow, share, save, comment, channel, heart and reminder designs with cursor clicks and confirmation states. Labels and confirmation text remain editable in any language.
- Fresh Social templates use catalog-backed CTA elements and omit title backdrop blocks; all template scene counters explicitly disable their inherited backdrop. Saved legacy elements remain intact until replaced through the inspector's Replace old decoration selector, which preserves position and timing.
- Added six deterministic local WAV effects: bell, click, pop, whoosh, chime and shutter. Audio library adds at playhead; element Sound controls add at entrance or timed-action start. Cues are ordinary editable/mixable audio clips shared by playback and export. Existing built-in timed ringing audio remains supported.
- Validation: 293 TypeScript tests and production/native debug build passed (60.40 MiB). Browser regression directly drags the template video's thumbnail button, verifies identical source reuse, replacement of an old rectangle without timing loss, all ten animated designs, a bell cue aligned with a ring action, and general audio-library insertion. Reviewed UI screenshots and 36 compositor frames encoded/decoded as H.264/AAC (1280×540, 3.6 s); audio measured -21.5 dB mean and -6.4 dB peak during the cue.
- Native UI confirmed fresh templates and new controls. Final native drag gestures could not be conclusively verified while the user was actively changing the app; browser drag regression passed. Left the user's running app intact; the rebuilt bundle is ready to reopen for the final WebKit-specific fixes. Also removed six identical duplicate translation keys encountered during the final build. No schema or release changes.

## Hover previews, front insertion and offline music — 2026-10-27

- Replaced the malformed social-action cursor silhouette with a conventional pointer. New catalog and custom media elements get an explicit z above the current element/text stack, including manually raised layers and capped z values. Selection itself does not rewrite existing ordering.
- Library elements animate only while hovered/focused; video thumbnails decode and play muted while hovered/focused. Project audio, bundled music and sound effects preview locally. Leaving the tile, switching tabs/projects, starting timeline playback, opening a modal, hiding or blurring the window cancels transient previews. Direct Listen clicks keep playback in the user-activation event for browser autoplay compatibility.
- Audio now has Project / Music / Sounds sublibraries. Added six locally synthesized/arranged stereo instrumentals and exposed the two existing PixCut tracks, with mood filters, duration, known BPM, hover/Listen preview and insertion at playhead. Tracks remain ordinary editable audio clips. All eight originals are CC0 with a bundled license and copyable permission text; imported music retains its own rights. No platform claim-free guarantee is made.
- Validation: 298 TypeScript tests passed. Browser regression verified muted advancing video, hover-only element animation and cancellation, audible audio hover and cancellation on leave/blur, explicit Listen, insertion over a z=9000 layer, all eight music entries, mood filtering, insertion and project reopening. Reviewed browser music screenshots and native Audio/Music UI.
- Rendered 36 social-action compositor frames and encoded/decoded H.264 with the new Morning coffee AAC track (1280×540, 3.6 s). Reviewed the corrected pointer in the decoded frame. Reproducible original music synthesis is in desktop/scripts/generate-music.py; CC0 text is in public/music/LICENSE.txt.
- Production/frontend and debug macOS bundle builds passed (66.57 MiB). Opened the rebuilt native app, loaded the saved Motion opener project and left it running on Audio → Music with all eight tracks visible. No schema changes or release actions.

## SQLite library index — 2026-10-27

- Native builds now ship a bundled SQLite catalog (`library-index.sqlite3`) via `rusqlite` 0.41. Each row holds `id`, `name`, `updated_at` and the full summary JSON (including the thumbnail and formats), so the home library lists projects without reading every IndexedDB record.
- The catalog is a **mirror**, never the source of truth: IndexedDB still stores every project body. On first listing, a missing/empty catalog is rebuilt from IndexedDB; on every listing the catalog row count is compared with the project-store count, and any mismatch rebuilds it. Saves, deletes, favourites, groups and renames update both. If a catalog write fails the catalog is cleared so the next listing rebuilds it; a card whose body is missing is dropped.
- One shared connection behind a mutex serialises concurrent commands, with `busy_timeout=5000` and WAL mode, so the first schema creation cannot race a listing. The schema is idempotent and a corrupt row is skipped by the frontend parser.
- Tests: Rust `roundtrips_the_library_index` and `rejects_oversized_entries_without_partial_writes`; `tests/library-index.test.ts` (3) covers row parsing, ordering, corrupt/incomplete rows and optional fields. Counts are listed in the build-state section.
- Native verification: after launching the rebuilt app, `~/Library/Application Support/studio.pixcut.desktop/library-index.sqlite3` contained the `projects` table and **10 rows** migrated from the existing IndexedDB library, with names and summaries (thousands to ~90 KB each) and no lost projects. The app remained running.
- Boundary: project bodies remain in IndexedDB, and custom element graphics still use the webview asset store; only the summary index and primary media are native.

## Polish and Ukrainian for the deliverables picker — 2026-10-27

- The format surfaces are translated end to end. New-project setup: title, intro, project frame rate and all four frame-rate options, filter chips (All / Social / Sizes), group headings (Sizes & drafts, 4K masters), the per-group count ("1 format", "2 formaty", "4 формати"), the custom-size form (Name, Width, Height, Quality, Draft/Standard/High, Add), the shared/per-format note, the selected-format summary and Start blank / Use Travel sample / Cancel.
- Deliverables dialog: title, intro, the Social / Standard sizes / Custom tabs, search placeholder, "All platforms", platform names in the dropdown, group headings and counts, the empty-search note, "Selected formats", "Settings for {name}", Name/Width/Height/Quality and the quality options, "Custom format", "Add custom", and the export summary.
- New locale-aware helpers `fileCount()` (built on the existing `plural`) and the summary sentences as placeholder templates: `{formats} selected · {files} will be written`, `{formats} · {files} when you export`, plus the "identical sizes are combined" and "same size, frame rate and framing share one video" notes.
- Format card titles stay in their product form (YouTube Video, Instagram Square, Tiny 320) because they are stored on the project as the deliverable's name; translating stored data was deliberately avoided.
- Tests: `tests/i18n.test.ts` covers the new counts — `fileCount` 1/3/11 in Ukrainian and 5 in Polish, `formatCount` 12 in Polish, and the existing pl/uk key-parity test keeps both dictionaries aligned. Full suite: 302 tests in 45 files; `npx tsc -b` and `npm run build` pass.
- Browser check in both locales: the new-project dialog renders "Nowy początek." / "Новий початок.", translated frame rates and chips, "2 FORMATY" / "2 ФОРМАТИ" counts, "Wybrano 1 format · zostanie zapisanych 1 plik" / the Ukrainian equivalent, and translated footer buttons; the deliverables dialog shows translated tabs (Wszystkie / Social media / Rozmiary, Усі / Соцмережі / Розміри), headings, field labels and quality options. No console errors. Reviewed `output/playwright/formats-pl-setup.png` and `formats-uk-setup.png`.

## Live timeline trimming and layer badges — 2026-10-27

- Scene trim now uses the draft scene for the timeline clip width and duration label, so the clip visibly grows or shrinks under the pointer. Pointer moves are coalesced to one `requestAnimationFrame`, and the final trim is applied optimistically before the command persists; the clip no longer snaps back while the native/browser store catches up.
- Element and overlay rows are sorted by effective stack order (higher `z` first), so trimming an element no longer moves it to the end of the row and top layers stay above lower ones. Promoting a legacy scene element to a project overlay now preserves its element stack band, so it does not jump above media/text layers after a duration edit.
- Every visual clip shows **L0** for the base photo/video layer. Overlay/element clips show their layer number (`L1`, `L2`, …) based on the same stack order; ordering is top-to-bottom in the row.
- Overlay/element clips that overlap more than one scene show a scene span badge such as **S1–2**, with the full scene range in the tooltip. This makes it visible when an element or video overlay runs across cuts.
- Browser check: two scenes with two overlays spanning both; dragging scene 1's trim handle changed the live width from 603 to 647 px and the label to `4.6s` before pointer-up, then kept it after release. The element order was Star L2 above Rectangle L1, both showed S1–2, visual clips showed L0, and dragging the top element's end handle kept both elements present and in order after saving. No console errors.
- Reviewed `output/playwright/timeline-trim-and-layers.png`.
- Verification: 306 TypeScript tests in 45 files, 47 project-model tests, and 37 non-ignored native tests at the time of this pass; all 14 ignored FFmpeg tests pass.

## One native media store — 2026-10-27

- Custom element imports in native no longer round-trip a file through base64 into the webview and then duplicate it in IndexedDB. The native picker streams the chosen image or video into the Rust asset store, validates the MIME against the requested kind and the 50 MB custom-element cap, and the overlay stores only its `pixcut-asset:` reference.
- Relinking a missing photo, video or audio file in native now uses the same streamed import commands (`import_media` / `import_audio`) and swaps the reference, so a relink never creates an IndexedDB copy.
- Fixed a saved-overlay bug: `drawMediaOrShape` returned early for every `pixcut-asset:` source, so image and video overlays vanished after their data URL was moved into the local store. Both image and video paths already resolve references, so the guard was removed.
- Browser check: a red image overlay saved with an inline data URL was persisted as `pixcut-asset:b87a…`, reloaded from the library and rendered as a red rounded card over the blue scene with no console errors (`output/playwright/ref-overlay.png`).
- Native verification remains the SQLite run: the app keeps its media in `assets/` and project bodies carry refs. Boundary: legacy `.pixcut` files or old inline-data projects can still migrate their inline bytes into IndexedDB through `persistProjectAssets`; new imports are native-only.

## Font subsetting — 2026-10-27

- User font import now accepts TTF/OTF sources up to 40 MB and subsets them in the browser through the bundled HarfBuzz `hb-subset` WASM (`harfbuzzjs`, 668 KB asset). The subset keeps the project's current text, Latin/Latin-1/Extended, Greek, Cyrillic, punctuation, currency, arrows, math, geometric and misc symbols, kana, CJK punctuation and 1,000 common CJK ideographs. Hinting is dropped to keep CJK faces small.
- The subset is embedded as the project font (≤2 MB, same schema); small TTF/OTF files and WOFF/WOFF2 under 2 MB stay whole. WOFF/WOFF2 over 2 MB is rejected with a message asking for a TTF/OTF. Subsetting failure falls back to the original when it fits; otherwise the import explains the limit.
- The Tauri CSP now allows `'wasm-unsafe-eval'` for the local, fixed subsetter; no remote code or eval is enabled.
- Tests: `tests/font-subset.test.ts` (3) covers the alphabet/kana ranges, common CJK plus project text, and title punctuation. Browser check imported the 22 MB system `Arial Unicode.ttf` into a project whose title read “你好世界 PixCut”: the stored font shrank to 428,833 base64 characters (~321 KB), the picker showed “Arial Unicode · Custom”, the FontFace loaded, `document.fonts.check` for 你好世界 passed and the canvas rendered the CJK title and subtitle. No console errors. Reviewed `output/playwright/cjk-subset.png`.
- CSP/WASM check: a static page served with the same `script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'` policy fetched and instantiated the emitted subsetter (39 exports, no CSP error).
- Boundary: characters typed after import outside the subset use the fallback font; WOFF/WOFF2 large faces are not subsetted; a project supports eight fonts and the embedded subset stays under the 2 MB per-font budget.

## Polish and Ukrainian for the template gallery — 2026-10-27

- The gallery is translated end to end: title, intro, the "your current story is saved" note, search field, category chips (Wszystkie / Natura / Podróże / Ludzie / Rodzina / Urodziny / Social media / Jedzenie · Усі / Природа / Подорожі / Люди / Родина / День народження / Соцмережі / Їжа), card names and descriptions, "3 sceny · 12.0 s · Natura" style counts (via the existing `sceneCount`), "Użyj szablonu" / "Використати шаблон", the empty-search message, media credits and the whole confirmation dialog ("Zacząć od «Dzika ucieczka»?", "Twoja bieżąca historia jest już zapisana…", the start button).
- All 14 bundled stories (13 photo stories plus Motion opener) have translated names and descriptions; the headline type baked into each preview stays as designed, because it is the template's artwork.
- Template names/descriptions stay English in stored project names — only the gallery renders the translation, so project data is never rewritten by a language switch.
- Tests: `tests/i18n.test.ts` gained a drift guard — every `TEMPLATES` name, description and category must exist in both dictionaries, plus the six gallery chrome strings. Full suite: 310 tests in 46 files; `npx tsc -b` and `npm run build` pass.
- Browser check in both locales: Polish gallery shows "Zacznij od historii.", translated categories and card text ("Dzika ucieczka", "3 sceny · 12.0 s · Natura", "Użyj szablonu", "AUTORZY MEDIÓW"); Ukrainian shows "Почніть з історії.", "Природа", "Дика втеча", "3 сцени". No console errors. Reviewed `output/playwright/templates-pl.png` and `templates-uk.png`.

## Font management and subset refresh — 2026-10-27

- The Text panel lists every imported font with its embedded size, a **Refresh** action and a delete button. Refresh re-picks the original TTF/OTF and re-subsets it for the project text as it is now; delete removes the font and text using it falls back to Inter. Adding a font resets the refresh target, so cancelling a file dialog never turns the next import into an update.
- `registerCustomFonts` now tracks the data behind each face and re-registers it when a refresh changes the bytes under the same font id; previously the cached `FontFace` kept rendering the old subset.
- Browser check: imported the 22 MB Arial Unicode face (428,833 base64 chars), changed the title to the rare 龘 and refreshed from the same file — the subset grew to 429,877 chars, the list still showed one 315 KB font, the picker kept “Arial Unicode · Custom”, and the canvas rendered the new glyph. Removing it left zero fonts, zero list rows and the eight bundled picker entries. No console errors. Reviewed `output/playwright/font-refresh.png`.
- Boundary: Refresh needs the original file again (the app intentionally keeps only the subset); removing a font does not rewrite text layers, they fall back to Inter until another font is chosen.

## Polish and Ukrainian for the export studio — 2026-10-27

- The export dialog is fully translated: eyebrow and title, the project line ("Wild escape · 12.0 s · 3 sceny"), codec cards and their notes (Szeroka zgodność, Wydajna kompresja, WebM do sieci, Materiał do montażu, plus the per-codec note under the outputs), container and speed selects, hardware encoder state ("Niedostępne w tej wersji", "Tylko H.264 i H.265", "Koder platformy · znacznie szybciej"), quality labels and their descriptions (Mniejszy / Szybkie wersje robocze, Zbalansowana / Codzienne udostępnianie, Wysoka / Ostrzejsze szczegóły), resolution and frame-rate labels, the audio toggle details, file naming (Nazwa, Wersja, Opcje nazewnictwa, Dodaj nazwę pliku, Dodaj jakość), the video-source rendering note, the outputs summary and combine note, the file-name preview counts, the footer states (desktop-only notice, FFmpeg install hint with the platform command, unavailable codec, ProRes quality note, "możesz kontynuować edycję") and the export button ("Eksportuj wideo" / "Eksportuj: 2 filmy").
- New plural helpers `renderCount()` and `videoCount()` join `formatCount()`/`fileCount()`, so combined-delivery copy reads correctly: "{formats} dzielą {renders}, więc PixCut zapisze {videos} …" and Ukrainian equivalents; the outputs summary uses `{formats} selected · {files}` placeholders.
- Also translated the Home template strip (names + "3 sceny · 12.0 s") and the media panel's "Importuj zdjęcia" / "Імпортувати світлини" button.
- Stored names (deliverable names, project names, "Original") stay as saved — only rendered UI copy is translated.
- Tests: full suite 318 tests in 48 files, `npx tsc -b` and `npm run build` pass.
- Browser check in Polish: the whole dialog reads in Polish end to end (encoding, codecs, quality, picture, naming, outputs, footer, button) and the Home template strip shows "Dzika ucieczka · 3 sceny · 12.0 s". Reviewed `output/playwright/export-pl.png`, `home-pl.png` and `home-uk.png`; no console errors.

## Chroma key for image and video overlays — 2026-10-27

- Added an optional `chroma` setting to media overlays: key colour, similarity, softness and spill suppression. It is validated in TypeScript and Rust and is rejected on non-media layers.
- The renderer applies colour-distance keying plus smooth alpha and spill suppression before the shape mask is applied. The result is baked into the transparent overlay frame used by image scenes, video segments, stills, thumbnails and export.
- The element inspector adds a **Chroma key** panel with a colour picker and three sliders. Removing the key restores the original overlay; the whole operation is undoable.
- Browser check: a green overlay with a red centre over a blue scene sampled red at the centre, blue at the keyed overlay edge and blue at the canvas corner. A direct `drawOverlayStack` export frame had alpha `255` at the red centre and `0` on the green area. No console errors. Reviewed `output/playwright/chroma-key.png`.
- Tests: `tests/chroma-key.test.ts` covers colour distance, alpha falloff, round-trip validation and invalid/shape-layer rejection. Rust adds `chroma_keys_round_trip_and_reject_invalid_values`.
- Verification: 318 TypeScript tests in 48 files, 48 project-model tests, 37 non-ignored native tests, and all 15 ignored FFmpeg tests pass.
- Boundary: keying runs per overlay frame in the canvas, so very large video overlays cost CPU during export. The keyed frames are not cached for video; image overlays are re-keyed when drawn.

## Element panel translations — 2026-10-27

- The Elements panel now translates its search placeholder (“Szukaj 230 elementów…”), collection filter (“Wszystkie 23 kolekcji”), category filter (All categories, Titles, Social, Tutorials, Dynamic, Lifestyle, Business, Frames), empty result and “Show 40 more” action. Import graphic/Video overlay tooltips and “In project” were already wired.
- Category chips/options and the collection counter use `{count}` placeholders; collection names remain product names, like the element cards.
- Browser check in Polish: search, both filters, all eight category labels and “Pokaż kolejne 40 · 40 / 230” rendered as expected with no console errors. Reviewed `output/playwright/elements-pl.png`.
- Also records the concurrent tree’s export-studio/chroma-key work in README and the roadmap; the full suite (318 TypeScript, 48 project-model, 37 native) passes.

## Canvas transform handles for overlays — 2026-10-27

- Selecting an image, video, element or legacy scene layer on the preview now shows four corner resize handles and a round rotation handle connected by a stem. Text boxes keep their existing edge handles.
- Corner resizing anchors the opposite corner, including on a rotated layer: the pointer delta is projected onto the layer's own axes in screen pixels, then converted back to model fractions. Shift preserves the original aspect ratio; width, height and centre stay inside the model's `0.02–1` size and `0–1` centre ranges.
- The rotation handle adds the pointer's angle change to the layer's stored rotation, wraps the result into the model's `-180…180` range, and snaps to 15° while Shift is held.
- Every gesture stages the draft and commits once on pointer-up, so a whole drag is one undo step and the inspector sliders update live. Nothing extra is stored in the project or export plan: preview, still frames, thumbnails and MP4 all use the same `x`, `y`, `width`, `height` and `rotation`.
- Browser check: a 25 % × 30 % overlay was dragged from its south-east corner to 38.3 % × 45.8 % while its north-west corner stayed at 37.5 % / 35 %, then rotated to 60° with Shift. Both values survived a reload. No console errors. Reviewed `output/playwright/transform-handles.png`.
- Tests: `tests/transform-handles.test.ts` covers corner anchoring at 0°, 30° and 90°, aspect locking, minimum/maximum clamping, rotation wrapping and 15° snapping.
- Verification: 323 TypeScript tests in 49 files, 48 project-model tests, 37 non-ignored native tests, and all 15 ignored FFmpeg tests pass.

## Polish and Ukrainian for the audio inspector and empty states — 2026-10-27

- Audio inspector: music-mix ducking (Miks muzyki projektu, Ścisz muzykę pod dźwiękiem wideo, Ścisz muzykę o …%), voiceover (Narracja, Nagraj narrację, Zatrzymaj i dodaj, the record hint), clip editor (Zapisane lokalnie · 20.0 s źródła, Ścieżka audio, Ścieżka N, Początek, Przycięcie, Czas trwania, Głośność, Płynne wejście/wyjście), the three-band EQ (Bas · 120 Hz, Głos · 1 kHz, Sopran · 6 kHz, Resetuj EQ) and beat tools (Narzędzia rytmu, Wykryj rytm, Nasłuchiwanie…, Przyciągaj cięcia, the hint).
- Audio library and timeline chrome: Dźwięk, Dodaj dźwięk, Projekt / Muzyka / Efekty, Więcej dźwięku, Dodaj kolejną ścieżkę audio, Spektrogram / Fala.
- Project card menu: Zmień nazwę…, Dodaj do ulubionych / Usuń z ulubionych, Grupa: {name} / Przenieś do grupy…, Duplikuj, Eksportuj plik projektu, Usuń z urządzenia….
- Empty states: "Każda historia gdzieś się zaczyna.", "Dodaj kilka zdjęć. Zrób je swoimi.", "Dodaj pierwsze obrazy", "Albo zobacz przykładową historię", "Historia zaczyna się od zdjęcia.", "Importuj obrazy z urządzenia.", "Nic nie jest wysyłane.", "Brak pasujących mediów." and the search hint.
- Browser check in Polish: the audio inspector reads fully in Polish (Miks muzyki projektu, Narracja, Zapisane lokalnie · 20.0 s źródła, Ścieżka 1, Początek/Przycięcie/Czas trwania, Głośność, Płynne wejście/wyjście, Korektor trzypasmowy, Bas/Głos/Sopran, Narzędzia rytmu), the empty editor state and the audio library tabs are translated, and the timeline audio display select shows Spektrogram / Fala. Screenshots reviewed: `audio-inspector-pl.png`, `audio-panel-pl.png`, `empty-pl.png`. No console errors.
- Full suite: 323 tests in 49 files, `npx tsc -b` and `npm run build` pass.

## Video preview playback and the linked video-audio lane — 2026-10-27

- Adding an imported video showed a bar that looked like a broken waveform in the new **Video audio** lane, the preview ran at 2–5 fps and there was no sound.
- Three real defects behind it. `play()` was only issued when the play state or scene changed, so pressing Play before the video's data URL finished decoding was rejected and never retried — the clip stayed on its poster and mute for the whole scene. The sync effect also rewrote `currentTime` whenever the element was more than 0.12 s off on every animation frame, which queued a decoder seek ~60 times a second. And `drawScene` always created the canvas with `willReadFrequently: true`, forcing a CPU-backed surface, so every video frame took a software copy even though only a colour grade ever reads pixels.
- `src/components/preview/video-sync.ts` now decides the seek: 0.4 s tolerance while a clip plays forward (its own clock drives the picture), 0.05 s while paused, scrubbing or reversing, and never while a seek is already running or before frames exist. `App.tsx` retries `element.play()` from the `videoTick` effect once the source loads, and only creates a readback canvas in `render.ts` when `hasColorGrade()` is true. Masks never read pixels, so the conditional context loses nothing.
- The fake `.video-audio-wave` gradient is gone: the lane shows the clip name, its level and the inline slider, because documenting a waveform for audio that cannot be decoded would be a lie. Video sound stays inside the clip and the lane's trim handles move picture and sound together.
- WebKit check with a 1080p clip and a music bed: video `readyState 4`, playing, unmuted, `volume` 0.7 × 0.7 = 0.49 as the mixer asks, clock in sync, **54–63 preview fps** and 3 seeks per run (one per scene change). Clicking Play 0 ms after import, while the source was still `readyState 0`, recovered the picture and sound as soon as decoding finished. Adding a picture-in-picture video keeps 42 fps.
- Colour grade and PiP regression check after the canvas change: a mono-graded video rendered grayscale while a colour PiP video kept its own colours and shadow, so `getImageData` still bakes grades. Reviewed WebKit screenshots of playback, the graded/PiP project and the timeline crops (`webkit-playing.png`, `webkit-pip.png`, `timeline-crop.png`, `audio-lane.png`).
- Tests: `tests/video-sync.test.ts` covers forward drift, corrections, tight scrub tracking, in-flight seeks and non-finite clocks. Full suite 323 tests in 49 files, 48 project-model tests, 37 non-ignored native tests and all 15 ignored FFmpeg tests pass; `npx tsc -b`, `npm run build` and `npm run ci -- --fast` pass.
- Boundary: Web Audio cannot demux MP4, so the video lane will never have a real waveform or spectrogram. Overlay and PiP videos still preview by seeking in ~60 ms steps, which is smooth but costs about a third of the frame rate when one is on screen; export stays frame-accurate.

## RGB tone curves — 2026-10-27

- Added optional `curves` to a scene: `master`, `red`, `green` and `blue`, each a list of 2–12 `[input, output]` points in 0–1 with strictly increasing inputs. Channels that are absent are the identity, so old projects open unchanged and no schema version bump was needed.
- Interpolation is monotone cubic Hermite (Fritsch–Carlson), so a dragged point cannot overshoot or invert neighbouring tones. Master runs first and its 256-entry table feeds the per-channel table.
- The canvas pipeline applies the curves after brightness, contrast, hue, vibrance and split toning. `gradeLutCube` runs the same pixel pipeline, so video export, still frames, thumbnails and the viewer share one result.
- The colour inspector has a **Tone curves** panel with Master/Red/Green/Blue tabs, a draggable graph, click-to-add, double-click-to-remove, per-channel reset and reset-all. Dragging stages a preview and commits once on pointer-up, so one gesture is one undo step.
- Copy/paste attributes and **Reset color** include the curves. Validation lives in TypeScript (`readCurves`) and Rust (`valid_curves`), and rejects unsorted, out-of-range, single-point, over-12-point and unknown-channel data.
- Browser check: a grey scene with a master curve `[0,0] [.5,.7] [1,1]` rendered **179/179/179** at the centre; dragging the midpoint down changed the same pixel to **130/130/130**, and the graph and value survived a reload. No console errors. Reviewed `output/playwright/tone-curves.png`.
- Tests: `tests/curves.test.ts` covers identity, clamping, monotonicity, LUT composition, single-channel grading, `.cube` output, model round-trip and invalid data. Rust adds `tone_curves_round_trip_and_reject_invalid_points`.
- Verification: 328 TypeScript tests in 50 files, 49 project-model tests, 37 non-ignored native tests, and all 15 ignored FFmpeg tests pass.

## Polish and Ukrainian for the element inspector, home groups and dialogs — 2026-10-27

- Element inspector: Replace old decoration, the overlay-audio note, Start/Duration (project seconds), Sound and sound effect, Entrance / WEJŚCIE, Entrance duration, Timed action and the later action picker, action start/duration, Repeat action, Bell sound, Size & position, Opacity (Krycie) and Rotation (Obrót).
- Home: Ungrouped (Bez grupy), Manage groups, the "New · Start a fresh story" section, the empty group note, the empty library block and the four perks (Prosty, Potężny, Na tym urządzeniu, Bez znaku wodnego with their descriptions).
- Dialogs: project card menu (Open project now translated too), rename project, organize/move/remove from group, group name placeholder and existing groups, and the group manager copy.
- Browser check in Polish: the project menu reads "Otwórz projekt / Zmień nazwę… / Dodaj do ulubionych / Przenieś do grupy… / Duplikuj / Eksportuj plik projektu / Usuń z urządzenia…", the rename dialog is fully Polish (PROJECT DETAILS, Zmień nazwę projektu., Nazwa projektu, Zapisz nazwę, Anuluj), and the element inspector/home sections follow the same dictionaries. Screenshots reviewed: `rename-pl.png`.
- Full suite: 328 tests in 50 files (the tree also had an unrelated in-progress curve-editor file from another session; I waited for a green window before building).

## Picture-in-picture videos play instead of stepping — 2026-10-27

- A PiP video used to preview by seeking one cached hidden element and awaiting `seeked` for roughly every 60 ms of playhead movement, which serialised the render queue: 41.7 preview fps with one 1080p PiP clip against 62 without it.
- Each PiP video clip now owns its own muted hidden `<video>` (the same `.scene-video` element the base track uses). It plays forward with the timeline and `drawPipClips` draws it directly whenever it has frames; export and any element that is still loading keep the frame-accurate `overlayVideoFrame` seek path.
- `src/components/preview/pip-playback.ts` centralises the playhead → source mapping (`sourceIn + local`, clamped a frame short of the media duration). It is the same formula `overlayVideoFrame` already received, so exported PiP frames are unchanged.
- Seeking reuses the video sync policy: 0.4 s tolerance while playing forward, 0.05 s while paused or scrubbing, and never while a seek is in flight or before frames exist. `pipVideoTick` redraws the preview when a PiP source loads or finishes a seek.
- WebKit check with a graded base clip, one PiP video and a music bed: **51 preview fps** (up from 42), both elements playing in sync, no console errors. Paused scrubbing to 1 s and 3 s put both elements exactly on the playhead (1.00 / 3.00) and the PiP frame visibly changed between the two screenshots. Reviewed `pip-seek-1s.png`, `pip-seek-3s.png`, `webkit-pip2.png`.
- Tests: `tests/pip-playback.test.ts` covers pre-roll, in-point mapping, clip boundaries, a missing in-point and duration clamping. Current tree: 335 TypeScript tests in 51 files, 49 project-model tests, 37 non-ignored native tests, all 15 ignored FFmpeg tests, and `npm run ci -- --fast` green.
- Boundary: PiP clips still ignore speed and reverse, exactly as the export path does, and their sound stays muted because export does not include it. Video element overlays (the Elements track) still preview through the seek path.

## Reopened projects load their video, and the mixer applies its mix — 2026-10-27

- Reopening a stored project showed only the first video's poster: the source effect only reran when the clip or its image changed, so an effect that fired before the preview `<video>` mounted never ran again. Its volume had the same problem one step later — the sync effect could run before the element existed and then stay quiet, so pressing Play would have used full volume instead of the saved mix.
- The base video's source effect, its seek/volume effect and the PiP sync effect now run after every render behind cheap guards (the `dataset.sceneId` and source-map equality checks, `readyState`, `seeking`). That costs a string compare and a couple of assignments per frame; measured playback is unchanged at **61.9 fps** for a single video and **51.2 fps** with a PiP clip.
- End-to-end mixer check in WebKit after a reload and reopen: header bus 55 %, second clip 30 % → element `volume` 0.165 (0.55 × 0.30); header mute → 0 and the button flips to Unmute; unmute → 100 %; the per-clip slider updates the clip label and the element live; no `.video-audio-wave` in the DOM; no console errors. Reviewed `audio-mixer.png`, `reopen-probe` output and `after-mount-fix.png`.
- Boundary: `volume` is set on the element rather than through Web Audio, so the very first frame after opening a project can use the element default while the source decodes; it settles before playback starts.

## Video-audio mixer gate — 2026-10-27

- `tests/browser/video-audio-mixer.js` drives the whole feature against a dev server: it records a real 1.2 s VP8 + Opus clip in the page (no fixture), builds a two-clip project with a 70 % bus and a 70 % second clip, asserts the Video audio lane has no fake waveform and that its spectrogram becomes ready, selects a clip, moves its inline level to 30 %, checks the hidden video's `volume` (0.7 bus × 0.3 clip = 0.21), mutes and unmutes the bus, sets the bus to 55 % and confirms 0.165, then reloads and reopens the project to confirm the header (55 %), clip level (30 %), element `volume` (0.55) and the spectrogram all survive. Passed in WebKit with no console errors.
- The recording's data URL strips the recorder's `;codecs=vp8` parameter because the project validator only accepts `data:video/webm;base64,` and the browser sniffs the codec from the bytes. Run the check with the same manual `playwright-cli run-code` flow as the other browser checks.

## Video audio shows a real spectrogram, and playback follows the playhead — 2026-10-27

- The Video audio lane drew no analysis because video sources were excluded from the spectrogram decoder. They are included now: WebKit's `OfflineAudioContext.decodeAudioData` reads the audio track out of an MP4/AAC file (a 349.6 s, 20 MB track decoded in 245 ms) and out of WebM/Opus, so the lane reuses the existing FFT worker and colour map instead of inventing a pattern. The Waveform display uses the same decoded audio.
- Each video clip draws the window its trim shows (`sourceIn` for `sourceSpan` seconds), so trimming updates the picture on the lane immediately. Videos without an audio track stay clean: no canvas, no "unavailable" label, no console error.
- The fixture check that drove this: a 5:49 music video appended to an empty project produced `data-ready="true"` with 1024 columns and 173,440 lit pixels, and a 6 s silent clip produced `data-ready="false"` with no status text. Reviewed `video-spectrogram-row.png` and `video-waveform-row.png`.
- Playback could lock onto a pinned preview scene: trimming a video-audio clip keeps a draft scene for the live preview, and a lost `pointerup` (released outside the window) left it pinned. Playback then seeked the video back to that clip's in-point every 0.4 s, which looked like half a second of video and sound looping forever. `src/components/preview/preview-target.ts` now ignores the draft while playing, playback clears it when it starts, and timeline drags capture the pointer and handle `pointercancel`, reverting the draft if the drag is interrupted.
- The video-audio trim handles now stop the click they generate, the same as the picture trim handles. Before, releasing a trim also selected the clip and jumped the playhead to its start.
- WebKit check: starting a trim on the second clip (playhead on the first) and pressing Space kept the preview on "Opening shot" and advanced it to 1.69 s; releasing the pointer left playback running at 1.9 s instead of jumping to 2.0 s. Preview stayed at 57–59 fps for the single-video project (matching requestAnimationFrame) and 52.4 fps with a PiP clip.
- `tests/browser/video-audio-mixer.js` now records Opus audio alongside VP8 video and asserts the lane's spectrogram reaches `data-ready="true"` with non-zero columns before running the mixer assertions. `tests/preview-target.test.ts` covers the playback/pinned rule. Current tree: 339 TypeScript tests in 52 files, 49 project-model tests, all ignored FFmpeg tests, and `npm run ci -- --fast` green.

## Hover previews and timeline spectrum controls — 2026-10-27

- The timeline defaults to the decoded, logarithmic spectrogram and keeps a **Waveform** switch for editors who prefer amplitude-only detail. Audio analysis runs in a worker and the painted strip follows source trims rather than repeating an ornamental pattern.
- Look cards now render the actual scene through the compositor at thumbnail size, including source framing and the selected colour grade. They no longer rely on applying CSS filters to a generic preview image.
- Transition and element-entrance examples animate only while pointer or keyboard focus is on their card. They are static when idle, respect reduced-motion, and the **None** transition remains a true still hard-cut sample.
- Browser checks: an 8 s decoded bell audio source produced 690 FFT columns and 4,709 distinct painted RGB values; waveform fallback toggled successfully; four look cards were visually distinct; wipe transition and fade entrance frames changed while hovered. The transition parity test sampled 40 preview/export frames with max channel difference 0. Reviewed `output/playwright/spectrogram-and-hover-previews.png` and `spectrogram-track.png`.
- Verification: 339 TypeScript tests in 52 files pass; `npm run build` passes; a debug macOS app bundle builds at 67.50 MiB and is running.

## Splitting audio, selecting it, and the split-playback loop — 2026-10-27

- Split on a selected audio clip used to look at `selectedScenes`, which falls back to the scene under the playhead when no visual clip is selected. Selecting audio cleared the visual selection, so Split cut the video and its linked sound instead. `splitAtPlayhead` now branches on `editTarget === 'audio'`, and `src/components/timeline/audio-split.ts` replaces the clip with two halves that keep lane, level, EQ and outer fades while the right half continues the source. Shortcut/menu availability measures the audio clip's own window.
- Clicking the Video audio strip ran the scene-selection path, which jumps the playhead to the clip's start. That strip now selects the linked scene without seeking or stopping playback, the same way the music lanes already behaved. It stays linked for trims and for splitting the picture with its own sound.
- The 0.5 s freeze/loop was the clip source being reloaded at every video cut. After a split the right half is a new scene id, so the source effect reset `src` and called `load()`, freezing both picture and sound while WebKit reopened the file; with a 0.5 s first half that looked like half a second of video looping. Only a real source change touches `src` now. A scene or source change gets one exact sync seek at the new in-point, then the video's own clock runs without inheriting the previous clip's drift.
- The hidden preview video is now a full-size, 0.2 %-opaque layer behind the canvas instead of a 1×1 fully transparent element. Native WKWebView can throttle frame decoding for an invisible media element while its audio keeps playing, which looks like a frozen picture; the canvas sits above the video and the rendered frame is unchanged (screenshots re-checked, 58.6 preview fps).
- Browser check: the mixer gate now builds two 0.5 s halves from one recording (the second starts at 0.5 s of source). At 0.93 s of playback the element was at 0.91 s and still playing, so it crossed the shared-source cut instead of restarting at 0 s. Selecting the music clip and pressing Split produced two audio clips and left the video tracks at 3 clips / 2 video-audio clips; clicking the linked strip at 1 s left the playhead at 1 s.
- Current tree: 344 TypeScript tests in 53 files (new `audio-split.test.ts`), 49 project-model tests, all FFmpeg export tests, and `npm run ci -- --fast` green.

## Video playback is driven by the media clock — 2026-10-27

- The timeline used wall time while the preview `<video>` ran on its media clock. When a decoder stalled — normal at a cut or during a seek — the playhead pulled ahead, `videoSeekTarget` crossed its 0.4 s tolerance, and the seek stalled the decoder again. On a slower machine this repeated about every half second: the observed freeze/loop.
- While a constant-speed video plays forward, the playhead now follows `video.currentTime` mapped back through the clip's in-point and speed (`mediaClockPosition` in `src/components/preview/video-sync.ts`). A stall slows the playhead instead of triggering a catch-up seek; playback resumes together. Scrubbing, reverse, ramped speeds and the one exact sync at a new clip/source keep the existing seek policy, and a media time outside the clip (loop wrap, ended media) falls back to it.
- WebKit check on the reported project (three short clips, then the 5:49 music video): from 6.0 s to 9.0 s of wall time the playhead held 5.87–8.60 and the element 0.09–2.83, with **no seeks** (`seeking:false` for every sample). The same project previously seeked at 6.4, 7.2, 8.0 and 8.8 s, each one a visible freeze. Loop wrap from 5.6 s restarted at 0.07 s and the element resumed at 0.25 s.
- `mediaClockPosition` covers in-point mapping, speed, out-of-window media and broken values in four tests. Paused scrubbing still put both video elements exactly on 1 s and 3 s; loop and PiP playback still run; preview stayed 47 fps in the single-video project and 43.6 fps with a PiP clip.
- Selection now matches the edit target: clicking the linked Video audio strip no longer leaves the music clip highlighted (it used to fall back to the first audio clip while the video was the actual target, which made Split look like an audio action). Audio clips highlight only in audio mode, and the linked strip only in scene mode. The strip's tooltip and the split notice say that splitting a video changes its picture and its own sound together.

- Clicking an audio clip without dragging no longer commits an audio move either; only a real drag writes the clip back, so a plain selection cannot shift the track or trigger a save.

## Audio selection is synchronous, so an immediate Split hits audio — 2026-10-28

- Clicking a music clip and pressing Split immediately could still split the video: `focusAudio` queued `editTarget`/`selectedAudioId` state, but the keyboard handler ran the previous render's command closure, whose `editTarget` was still `scene`. Selecting audio and pressing the shortcut quickly reproduced it.
- `focusAudio` and `selectScene` now update `editTargetRef`/`audioTargetRef` synchronously, before React re-renders. Split and Delete resolve their target from those refs, as does Split availability. A same-task test (pointerdown, pointerup, click, Meta+B in one evaluate call) split the music clip into two while the video tracks stayed at 3 clips; the notice read "Audio split at the playhead".
- Selecting audio no longer changes the playhead: the click anchor is captured and restored if any overlapping handler/focus moves it. Audio clips also take focus with `preventScroll`, and trim/split targets focus the clip without scrolling the timeline.
- The linked Video audio strip still splits picture and sound together by design; it is now clearly the scene target and its tooltip/notice say so. The music Audio lane is the independent audio target.


## Bundled music previews play in the desktop build — 2026-10-28

- The Music library's Listen button (and its hover/focus preview) gave `new Audio()` the bundled `/music/<track>.m4a` URL. That plays in the browser preview but not in the packaged app: the shell serves the page from a WKWebView custom scheme, where a media element never leaves `readyState 0`, `play()` neither resolves nor rejects, and `currentTime` stays 0 — the reported "clicked play, nothing happened" with no error card.
- Reproduced outside the app with a minimal WKWebView probe: the real `morning-coffee.m4a` served by a custom `WKURLSchemeHandler` reported `time=0.00 readyState=0 paused=false` after 1.6 s and never fired `playing` or settled `play()`; the same bytes as a `blob:` URL reported `playing`, `readyState=4` and `time=1.15`. A generated WAV over `blob:` and `data:` played in the same harness, so decoding itself was fine.
- `musicTrackPreviewUrl` (`src/stores/music-library.ts`) now fetches each bundled track once, fixes the type to `audio/mp4` (WebKit labels M4A inconsistently) and returns a cached `blob:` URL, which the CSP already allows. The Music tab warms those URLs when it opens, `hoverLibraryAudio` accepts a provider as well as a URL, and the URLs are released when the editor unmounts. Adding a track still stores its own project copy through `musicTrackData`, unchanged.
- Browser checks (Chromium and WebKit, `tests/browser/music-preview.js`): the preview element's source was `blob:`, it advanced 0.90 s and 0.64 s over the same window, a second Listen reused the cache (one audio element per click), and Add music still produced project audio. Reviewed `output/playwright/music-preview.png`.
- Tests: `tests/music-library.test.ts` covers the shared blob URL, the `audio/mp4` type, release on unmount, retry after an unreadable file, and the actionable message. Full suite 349 tests in 53 files; `npm run build` and `npm run tauri -- build --debug` pass (debug bundle written to `target/debug/bundle/macos/PixCut.app`).

## Grouped sound-effect library in the left sidebar — 2026-10-28

- The Sounds tab of the Audio panel now lists **300 curated effects**, 30 in each of ten collapsible groups: Interface, Chimes & bells, Whooshes & swells, Impacts & hits, Cartoon & comedy, Alerts & notifications, Nature & ambience, Sci-fi & tech, Musical stings, Camera & Foley. A search field filters across labels and ids, opens matching groups and hides empty ones; each row has Listen and Add-at-playhead.
- The library favours sounds editors reach for (dings, whooshes, risers, booms, vine boom, sad trombone, record scratch, notification/achievement cues, shutter, footsteps, SFX staples) instead of long lists of tiny variants.
- `src/components/elements/sound-catalog.ts` renders every effect from a compact spec across twelve engines — tone, chime, FM, Karplus-Strong pluck, formant voice, filtered noise, swept whoosh, impact, chirp, arpeggio, ambience and click — plus reverse envelopes and chime beating. Nothing is downloaded, no binary assets were added, and the same bytes feed preview and FFmpeg. Rendering is lazy and LRU-cached (24 entries); the slowest effect takes ~80 ms on first use, the average ~8 ms.
- Uniqueness is measured, not assumed: the test builds a perceptual fingerprint per effect (16 log-spaced spectrum bands, 8 RMS envelope steps, zero-crossing brightness and log length) and checks all 44,850 pairs. The closest pair now scores 0.142 (threshold 0.12); before the pass it was 0.026 for mirrored slide whistles and 0.038 for two low impacts, which is what made the first version sound repetitive.
- `sound-effects.ts` stays the short inspector list (bell, click, pop, whoosh, success, shutter) and delegates to the catalog, so element sounds and the sidebar share one engine. `addSound` accepts any catalog id through `createSoundClip`, which keeps the existing lane/trim rules.
- Browser check `tests/browser/sound-library.js` (Chromium): ten groups summing to 300 sounds, search for "whoosh" narrowed to one group, Listen used a `data:audio/wav` source that started, Add produced one "Click" clip on the audio timeline, and no console errors. Reviewed `output/playwright/sound-library-chromium.png`, `sound-library-groups-chromium.png` and `sound-library-search-chromium.png`.
- Tests: `tests/sound-catalog.test.ts` checks the 300-item catalog and even group sizes, unique ids, exact WAV lengths, audible peaks, click-free tails, 300 distinct renders, the pairwise fingerprint distance, group/search ordering, and model round-trip. Full suite 357 tests in 54 files; `npm run build` passes and the desktop app runs against the dev server.

## Recorded sound library pipeline

- Added `public/sounds/manifest.json` (empty until the first import), `src/stores/sound-library.ts`, and `scripts/import-sounds.mjs`. The Sounds tab lists recorded sounds in their own categories below the 300 synthesized effects and shows nothing extra while the manifest is empty.
- Only CC0 1.0 and CC BY 4.0 are accepted, because PixCut redistributes the files. The import script and `tests/sound-library.test.ts` reject NC/ND licences and site licences that forbid redistribution (Pixabay, Mixkit, Zapsplat, Sonniss).
- CC BY sounds name the author in the clip and surface the credit line with the music credits; CC0 sounds need none.
- Checked in the browser preview with two temporary imported sounds (a CC0 one and a CC BY one), then removed them.

## Online sound effects

- The Sounds tab now has Bundled / Online, mirroring the Music panel. Online searches Openverse `sound_effect` audio (CC0, CC BY, public domain only) and lets the user listen and add in the app. The Rust command takes a whitelisted category (`music` or `sound_effect`); anything else falls back to music.
- Requests happen only when the user searches, listens or adds. The CC BY credit line is saved with the clip.
- Tests: `tests/online-music.test.ts` (sound-effect duration limits and license filtering) and `online_music::tests` (category whitelist).
- Not verified live: the Openverse API did not answer from this environment (timeout), so only the error state was checked in the browser preview, not real results.

## Online catalogues and fallback

- Online music and sound effects search Openverse and Wikimedia Commons. In Auto mode both start together; if Openverse errors, hangs for 6 s or returns nothing, the Commons results are shown with a note. The user can also pin one catalogue.
- Commons results are accepted only as CC0, plain CC BY or public domain (share-alike, NC and ND are rejected). Ogg files use Commons' MP3 transcode first and fall back to the original file.
- Rust: `online_audio_get` fetches only from an allow-list of catalogue hosts (https, no user-info, exact host match).
- Tests: Commons parsing, license mapping, transcode URL, paging, and fallback on error and on a hung request (`tests/online-music.test.ts`); host allow-list (`online_music::tests`).
- Checked in the browser preview while Openverse was down: Auto fell back to Commons, results listed, Listen played, Add placed the clip with its credit.
- Not covered: Rust-side network calls (the sandbox cannot reach the catalogues); the desktop path uses the same URLs and parsers.

## Free Music Archive source

- Added a music-only "Free Music Archive" catalogue: the Internet Archive's `collection:freemusicarchive` mirror, filtered to CC BY 2.0–4.0 and CC0 licence URLs. All of archive.org is deliberately not searched, because its licence field is uploader-asserted. Each item's MP3 files come from `archive.org/metadata/<id>`, up to 4 per item.
- `online_audio_get` allow-list now includes `archive.org` (exact host, https only).
- Checked live in the browser preview: a search returned CC BY 3.0 tracks with durations, and the download URL answered 200 audio/mpeg.
- Jamendo (needs a user-supplied key) is not added; it waits on a product decision.

## Results on open

- Opening Online (music or sounds) now runs one starter search ("Lo-fi" music, "Whoosh" sounds) so the list is never empty; the result is remembered per kind, so switching tabs does not refetch. This is a user-initiated browse, not a background request; nothing runs while editing or exporting.
- Checked in the browser preview: opening Sounds → Online listed Commons results for Whoosh with no typing.

## Load more fix

- Paging no longer stops a playing preview. Each load now fetches up to 5 pages until about 10 new tracks are found (licence and length filters can empty a page), follows Commons' own `continue.gsroffset` cursor, drops duplicates, and shows "No more results" when the catalogue is exhausted.
- Checked live in the browser preview (Applause): 12 → 32 tracks on Load more with the preview still playing.

## Online search loading state

- A new search shows a status line naming the catalogue being searched ("Searching Openverse and Wikimedia Commons…", or the pinned one) and replaces the old list with skeleton rows. After 6 s in Auto it says Openverse is slow and Commons is being used; pinned searches say "Still waiting for …". Load more shows "Loading more…" under the list. Both lines are `role="status"` / `aria-live="polite"`; the search button keeps its spinner; chips stay enabled and a newer search cancels the older one.
- Checked in the browser preview (screenshot): status text and skeleton rows while a pinned Openverse search was pending, real list afterwards. The 6-second wording was not observed live because Commons answered first.

## "All" browses instead of doing nothing

- Choosing the "All" chip (or a catalogue chip) with nothing typed used to skip the search, so the list stayed empty. It now searches a broad starter word ("music" or "sound") and shows results.
- Checked in the browser preview: music All returned 31 tracks from Free Music Archive and 13 from Commons (Auto fell back to Commons with its note); Openverse itself was still down at the time.

## Favorites, catalogue health, more topics

- Sound topics now include Rimshot, Heartbeat, Drum roll, Record scratch, Explosion and Notification.
- Star a result to save it; the "Saved" view lists starred tracks per kind (music or sound effects). Favorites are catalogue entries (links, licence, credit) in local storage, validated on load (https only, CC0 / CC BY / public domain, capped at 100); playing or adding one still contacts its host.
- Catalogue chips show "· down" for ten minutes after a catalogue failed or timed out.
- Browser-preview downloads are labelled by file extension (`application/ogg` → `audio/ogg`) so export accepts them. Desktop downloads go through the asset store and straight to FFmpeg.
- Checked in the browser preview: 17 topic chips, the Openverse "down" badge, star → Saved (2) → stored in local storage.

## Download throttling (HTTP 429)

- All catalogue requests send `PixCut/<version> (https://github.com/Plain-Workshop/pixcut; free offline photo-movie editor)` as the User-Agent, as Wikimedia's robot policy asks.
- Desktop requests retry on 429/502/503/504: first after 2 s, then `Retry-After` capped at 10 s, at most twice. The browser preview retries once after 2 s.
- Errors name the host and status ("upload.wikimedia.org is busy right now (HTTP 429)…") and suggest another track or catalogue. If a Commons MP3 transcode fails for any reason, the original file is tried; the track list stays on screen.
- Tests: Rust `retry_delay` and error-text tests; TypeScript retry, fallback and final-error tests. Not reproduced against the real 429: it depends on the user's IP and the running desktop app must be rebuilt (tauri dev does this on Rust changes).

## Download progress and cancel

- Rust `online_music_download` copies in 64 KiB chunks (50 MB cap kept) and emits `online-download-progress` `{ url, received, total, retryIn }` at most about 10 times a second; `online_download_cancel` stops the copy or a retry wait with "Download cancelled.". One download runs at a time, so a single flag is used.
- The Add button on a row becomes Cancel (X) while that track downloads, with "Downloading 1.2 / 4.8 MB" and a `<progress>` bar (indeterminate when the size is unknown) in a polite live region; "Busy host, retrying in 2 s…" shows during a 429 backoff. The browser preview streams the response and reports the same progress; cancelling aborts it.
- A cancelled download never tries the fallback file and gets no "try another track" hint.
- Tests: Rust chunked copy (progress, cap, cancel); TypeScript formatting, percent, streaming progress, unsubscribe and cancel. Checked in the browser preview with a throttled download: progress advanced 0.0 → 0.1 / 1.2 MB, Cancel worked.

## Converting FLAC / Opus downloads

- Online search lists only files PixCut can use: MP3, WAV, M4A, AAC, Ogg, WebM, plus FLAC, Opus, WMA, AIFF and MKA when FFmpeg is installed (asked once through `exporter_available`). MIDI is never listed. Without FFmpeg, or in the browser preview, the convertible formats are hidden so Add cannot fail on the format.
- On the desktop, a downloaded convertible file is converted by FFmpeg to AAC in M4A (192 kbps) before it goes into the asset store; cancel also stops the conversion. Commons keeps the MP3 transcode for preview and as the first download, with the original (converted) as the fallback.
- Tests: `convertible_extension` cases, an FFmpeg-gated conversion test (`cargo test -- --ignored`: FLAC → M4A, cancel, broken input) which passes here, and TypeScript listing rules with the converter on and off.

## Timeline mute and volume lost in the desktop app

- Cause: the Rust `Project` serialized `audio_mix`, `global_text` and `beat_ticks` in snake_case while the editor reads `audioMix`, `globalText` and `beatTicks`. In the desktop app every Rust answer therefore dropped the mixer levels (and global text and beat markers), so the track mute and volume controls reverted and changed nothing; exports ignored the mixer for the same reason. The browser preview never touches Rust, so it worked.
- Fix: those three fields are now written in camelCase and still read the old snake_case keys, so projects and recovery files saved by earlier builds load. The editor's project validation also accepts the old keys.
- Tests: JSON round trip of the `audioMix` command through a session, camelCase output with snake_case input accepted, and a TypeScript load of an old-key project.

## Transition frames survive concat (2026-10-29)

- Found by running the real planner and encoder end to end on FFmpeg 9.0.2: a video-to-video fade planned 15 baked still frames, but the MP4 kept only 2 of them. `concat` stamps runs of one-frame segments with the same timestamp and the muxer drops the duplicates.
- `encode_plan` now renumbers the concatenated stream with `setpts=N/(fps*TB)`; every segment is already constant-rate after `fps`, so this keeps one output frame per tick.
- New ignored FFmpeg test `real_transition_frames_all_reach_the_output` asserts the exact output frame count and a strictly progressing red-to-blue blend. It fails without the fix (19 of 30 frames) and passes with it.
- Tests: 49 native (17 ignored FFmpeg tests all pass), 53 project-model, 432 TypeScript.

## Pixel parity for exported video clips (2026-10-29)

- New ignored FFmpeg tests compare exported pixels with the preview model:
  - `real_video_cover_and_contain_match_the_preview_framing`: cover fills a square frame from a 16:9 clip (left/right halves keep their colours), contain keeps the whole picture with black bars above and below.
  - `real_video_fades_follow_the_preview_opacity_curve`: every frame of a fade-in/fade-out clip is within 24/255 of `fadeOpacity`.
  - `real_video_speed_ramps_and_reverse_show_the_preview_source_time`: brightness encodes source time, and every frame of constant, ramped (up and down) and reversed clips matches `consumedSeconds`/`sourceSecondsAt` within 10/255.
- The expected values mirror `fadeOpacity` (preview/render.ts) and `consumedSeconds` (preview/speed.ts); change both sides together.
- Video framing now matches the preview (found as gaps while writing the tests above; each new test failed before the fix):
  - The export plan carries `framing { background, x, y, zoom }` per video clip, and `fit: 'blur'` is honoured instead of being encoded as cover.
  - `encode_plan` builds these in FFmpeg only when needed (zoomed, panned, blurred, or a coloured contain backdrop); plain cover/contain keeps the old scale-and-crop path. Zoom is clamped to 1-4, pan to -1..1 and the colour must be `#RRGGBB`, like the preview.
  - Tests: `real_video_letterbox_uses_the_framing_background`, `real_video_zoom_and_pan_match_the_preview_framing`, `real_video_blur_fit_fills_the_bars_with_a_dimmed_blur`, and `plan_segment_reads_framing_from_the_editor_json`.
  - The blur backdrop approximates the canvas version (small blurred cover, dimmed by rgba(8,10,16,.42)); it is not pixel-identical.

## Settings, updates, timeline, inspector, audio lanes and music search (2026-10-29)

Verified in the browser preview (Chrome engine, 1440×900) with the Vite dev server; native-only paths are listed at the end.

- **Settings:** two-pane dialog; the System theme follows the OS and switches live (checked light and dark emulation). `tests/preferences.test.ts`.
- **Updates:** a failed quiet check retries after an hour, a new version is announced once, the project is saved and exports block before install or restart, failed downloads can be retried. `tests/updates.test.ts`.
- **Timeline:** ruler ticks and timecodes, cursor-anchored zoom (a point stayed at 2.262 s across zoom steps), 16 px per frame at full zoom, navigation shortcuts, collapsible lanes, labelled snap guide, 36 px toolbar and 20 px ruler, playhead line centred on its handle (665.58 px for line, handle and tick). `tests/timeline-ruler.test.ts`, `tests/timeline-snap.test.ts`.
- **Inspector:** labelled tabs with changed dots, per-tab reset, apply to all clips as one undo step (verified by undoing three steps). `tests/scene-tabs.test.ts`.
- **Audio lanes:** spectrogram uses a 2048-point FFT with interpolated low bands; the old code was confirmed to paint runs of up to 7 identical bands. Waveform uses a decibel scale and a one-sided envelope; names sit in a strip above the graph; silent video clips say "No sound". `tests/spectrogram.test.ts`, `tests/waveform.test.ts`.
- **Music search:** Openverse's search API did not answer at the time (its stats endpoint did); Auto now skips it while marked down and falls back to the Free Music Archive, then Commons. "piano" returned 19 results and Add downloaded and placed a clip.
- **Startup:** a failed Tauri start now shows an error dialog and exits instead of panicking.
- Tests: 50 native (24 ignored FFmpeg tests not run this round), 489 TypeScript. `cargo clippy` is clean for the library; two `field_reassign_with_default` warnings remain in test code.

Not verified: pinch zoom on a real trackpad, an update download/install/restart against a published release, an online download through the Rust path, and clicking through the native window (only the browser preview was driven).

## Editing basics: ripple, trim, nudge, copy/paste, marquee, lane lock (2026-10-29)

Verified in the browser preview on "Motion opener" with real key events, undoing every change afterwards.

- Delete vs ripple delete on three back-to-back audio clips: Delete left 3.5–5.0 in place; Ripple delete moved it to 2.0–3.5; the other lane did not move; both undid cleanly.
- `Q` / `W` trimmed to 0.50 and 2.00 s and refused a playhead outside the clip with a notice. `Alt+→` moved 0.50 → 0.53 s (one frame), `Alt+Shift+→` ten frames more.
- Copy and paste: audio landed on the next free lane when its own lane was busy; three pastes made back-to-back clips; visual clip paste added one scene and undid.
- Lane lock: Backspace, Shift+Backspace, nudge, trim and a pointer drag were all refused on the locked lane with a notice; a different lane still edited; unlocking restored editing.
- Marquee selected 1 clip mid-drag and all 3 at the end, showed a band and removed it on release; Mod+Shift+→ at 2.0 s selected scenes 2 and 3.
- Tests: 501 TypeScript (`tests/clip-edit.test.ts` adds 12). Test copies were removed afterwards, leaving the original single audio clip.

Not verified: marquee with a real mouse (events were dispatched), and any of this in the native window.

## Inspector polish: shared number field, camera movement, colour and speed tabs (2026-10-29)

Verified in the browser preview on "Birthday reel" (photos) and "Motion opener" (video), undoing every edit.

- Typed value: typing 150 into Zoom moved the slider to 150; Shift+↑ made it 160; typing 900 clamped to 400; three undos returned it to 100. Typing 30 into the audio Volume set the slider and the clip badge to 30% and undo restored 62%.
- All 9 audio sliders keep their old accessible names ("Audio volume", "Audio low EQ", …) and now have a typed value.
- Camera movement is open for photo clips with 8 cards; it is hidden for video clips. The cards' keyframes were confirmed by forcing the animation on (scale 1.2 → 1.0 for Zoom out at 20%).
- Found and fixed while testing: an `animation:` shorthand on the hover/active rule reset `animation-name`, so no card animated.
- Colour: groups Light and Colour, 12 sliders each with a typed value, split toning collapsed. Speed: groups Speed, Direction, Sound.
- Tests: 507 TypeScript (`tests/number-field.test.ts` adds 6).

Not verified: the card animation as a user sees it. The preview pane reports `prefers-reduced-motion: reduce`, which PixCut honours by stopping all animation, so cards stay still there by design. Also not checked: chroma key and mask sliders (they need an image overlay selected), and the native window.

## Translation sweep (2026-10-29)

- Coverage: `tests/i18n-coverage.test.ts` fails if any `t()` key, tooltip label, `IconButton`/`RangeField` label or disabled reason lacks a translation in any of the ten languages, if a `{placeholder}` differs, or if a hand-built plural or `t(cond ? 'a' : 'b')` appears.
- Checked in the app with real key presses: in German the toolbar, timeline labels, tooltips, the copy notice and the trim message were translated, with variables filled in ("Textebene 1 in …: … 0.00 bis 2.00 Sekunden"). In Polish the copy notice read "1 klip", "2 klipy", "3 klipy"; "5 klipów" is covered by a unit test.
- Found by the new checks: about 30 slider labels, 92 strings from earlier this session, and `t(safeArea ? 'on' : 'off')`, which hid two keys.
- Tests: 535 TypeScript. The translations are mine, not a native speaker's review; a proofread by native speakers is advisable before release.

## Selection store (Phase 4, step 1) (2026-10-29)

- Replaced eight selection `useState` calls in `App.tsx` with `src/app/selection-store.tsx`; `TimelinePanel` reads it directly. `tests/selection-store.test.ts` (8 tests): setter shape, no-op on equal values, stable setter identity, subscribe/unsubscribe, reset, store isolation, provider.
- Checked in the browser preview: click and shift-click range, select all, Escape, audio and element selection (inspector switches), marquee, delete then undo (select all → 0 scenes → undo → 3). An early run appeared to fail because the undo shortcut was pressed while the delete was still pending and was refused; repeating with waits worked.
- Tests: 543 TypeScript.

## Layout store (Phase 4, step 2) (2026-10-29)

- `src/app/layout-store.tsx` replaces `usePanelLayout`: validated and clamped state, persistence to `pixcut-layout`, and `reset()`. `tests/layout-store.test.ts` (6): normalising garbage and old layouts, limits, load/corrupt storage, save and notify per change, reset, splitter drags (clamped, written to storage only when the drag ends).
- Checked in the browser preview: all three splitters (library 280→340, inspector 288→340, timeline 340→400), saved on release; zoom 150%, one collapsed and one locked lane and the library width survived a reload; Settings → Editing → Reset panel layout restored defaults and cleared storage.
- Props: `TimelinePanel` 93 → 79, `EditorBody` 180 → 177. Tests: 549 TypeScript.

## Editor model context (Phase 4, step 3) (2026-10-29)

- `src/app/editor-model.tsx`: one context for the twelve project-level values both panels read. `tests/editor-model.test.ts` (2). `TimelinePanel` 79 → 71 props, `EditorBody` 177 → 165.
- Browser preview: delete a scene (notice shown) and undo (3 → 2 → 3 scenes), copy notice, audio inspector with its nine typed fields, preview canvas and media library present, no console errors.
- Playback timings were not measured: the Browser pane was hidden, so frame times were throttled. Playback store deferred until measured in the desktop app (see IMPROVEMENT_PLAN.md).
- Tests: 551 TypeScript.

## Editor view (Phase 4, step 4) (2026-10-29)

- `src/app/editor-view.tsx`: `deriveEditorView` (pure) plus hook and context for the active clip, selected clips, preview target, project text, picture-in-picture and text-layer selection. `tests/editor-view.test.ts` (8). `TimelinePanel` 71 → 65 props, `EditorBody` 165 → 150.
- Browser preview: with nothing selected the inspector followed the playhead (MOVE WITH IT. at 0.5 s, KEEP GOING. at 2.5 s); a click overrode it; shift-click gave "Editing 3 clips"; text, element and audio inspectors opened; playback ran; no console errors. No project data was edited.
- Tests: 559 TypeScript.

## Editor actions context (Phase 4, step 5) (2026-10-29)

- `src/app/editor-actions.tsx`: 62 callbacks as one typed context. `tests/editor-actions.test.ts` (2). `EditorBody` 150 → 88 props.
- Browser preview, each undone afterwards: duplicate clip (3 → 4 → 3), add element (1 → 2 → 1), add bundled sound (1 → 2 → 1), add text with `T` (9 → 10 → 9); no console errors. The project ended in its starting state.
- Tests: 561 TypeScript.
