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
- The first full GitHub dry run ([run 40214818313](https://github.com/Plain-Workshop/pixcut/actions/runs/40214818313)) passed on all four runners: macOS arm64, macOS x64 (cross-built on an arm runner), Windows x64, and Linux x86_64, after the version and test gates. Windows produced NSIS, MSI, and portable ZIP; Linux produced AppImage and deb; macOS produced DMG and updater tarball plus signature. Packaging-only failures found and fixed during the run: an extra `--` forwarded bundle flags to Cargo, empty Apple secrets requested a certificate import, an unsupported `macos-15-intel` label, a YAML alias GitHub rejects, and a case-sensitive Linux binary check.

## Video import and preview (media-engine slice 1)

- Added optional `mediaKind` and `videoPoster` fields to the scene model in both TypeScript and Rust, serialized only when present so existing projects stay compatible.
- Import accepts MP4, MOV, and M4V up to 50 MB in the native app; the browser preview also accepts WebM. The app reads the file, decodes metadata, captures a 480 px JPEG poster, and adds a video scene with a clamped 0.5–30 s duration.
- The preview uses a hidden `<video>` element, keeps it within 120 ms of the playhead, pauses on scrub, and draws the current frame into the existing canvas compositor so text layers, framing, and color grading still apply.
- Media tiles and timeline clips show the poster frame with a **VIDEO** badge; library thumbnails use the poster through the existing `drawScene` path.
- Native persistence stores video bytes in the content-addressed asset store (`assets/<sha>.mp4`) and hydrates them back to data URLs; the `.pixcut` bundle already handles the same MIME types. A new roundtrip test covers it.
- Export for video projects is deliberately blocked with a clear message until the FFmpeg scene pipeline lands. Image-only projects export exactly as before.
- Verification: imported a 2 s VP9 WebM through the browser preview; the poster rendered, the timeline showed `VIDEO`, the recovery record contained `mediaKind: 'video'` and a JPEG poster, and there were no console errors. Screenshot: `output/playwright/video-import-chromium.png`.
- Tests: 34 TypeScript, 24 project-model, 9 native, 3 FFmpeg. `tsc` and production build pass.

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
- Not verified here: an interactive Finder double-click in a signed/installed build. The document type and open handler compile and the association is present in the generated bundle. Windows/Linux installer registration and single-instance routing remain release work.
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
