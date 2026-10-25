# PixCut Desktop

An offline-first Tauri 2 / React / TypeScript / Rust desktop application. This is the first working **photo-movie editor**, not the complete video editor described in the product plan.

Every feature is included. There are no paid tiers, license keys, activation servers, or device limits — 4K export, batch social export, effects, and templates are available to everyone.

## Run

Requirements: Node.js 22+, Rust stable, and the platform prerequisites for [Tauri](https://v2.tauri.app/start/prerequisites/). Native MP4 export additionally needs FFmpeg with the `libx264` encoder available on PATH (Homebrew's standard paths are also checked on macOS). When FFmpeg is missing, the export dialog shows the install command for the current platform.

```sh
cd desktop
npm ci
npm run desktop
```

If Homebrew Rust is installed but Cargo is not on PATH on macOS:

```sh
export PATH="/opt/homebrew/opt/rustup/bin:$PATH"
npm run desktop
```

Browser development preview (editing and project downloads; MP4 export requires native):

```sh
npm run dev
```

Validation and native packaging:

```sh
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --bundles app
```

Release builds are produced by `.github/workflows/release.yml`: a macOS DMG for Apple Silicon and Intel, a Windows NSIS installer plus MSI and portable zip, and Linux AppImage and deb packages. Each release also publishes updater artifacts, `latest.json`, and SHA256 checksums as a draft GitHub Release. See `RELEASING.md` for the tag flow and the signing secrets the workflow expects.

A local dry run needs the updater key:

```sh
export TAURI_SIGNING_PRIVATE_KEY="$PWD/../.secrets/pixcut-updater.key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat ../.secrets/updater-key-password.txt)"
CI=true npm run tauri -- build --bundles app,dmg
```

## Releases and updates

- Tags matching `v*` build every platform and open a **draft** release. Publishing the draft is what enables updates.
- Releases are **unsigned by default** so the project can ship without paid certificates. Set `PIXCUT_SIGN=true` and add the Apple/Windows secrets to sign and notarize. Unsigned macOS builds need right-click → Open; Windows shows a SmartScreen prompt.
- Settings → Updates checks `releases/latest/download/latest.json`, verifies the Tauri signature, and installs after an explicit restart. Nothing is fetched while editing or exporting.
- Windows updates use the NSIS installer; MSI is for managed installs only.
- The version lives in `src-tauri/tauri.conf.json`; `npm run version:set <version>` keeps `package.json`, `Cargo.toml`, and both lockfiles in sync.
- `npm run version:check` and `.github/workflows/packaging-lint.yml` catch manifest drift, invalid workflow syntax, and a broken updater config before a release is tagged.
- `npm run ci` at the repository root runs the same checks as GitHub: site build and links, desktop tests/build, version consistency, the Rust model and native suites, and optional `actionlint`/`cargo audit` when installed.
- The latest **published** GitHub Release is the update feed. A running install sees the next published version under Settings → Updates; drafts and prereleases are ignored.

## What works

- Home with app navigation (Home, Projects, Templates, Settings), New Video, Photo Movie, Templates, sample inspiration, and a real local project library. Project cards now show their true 16:9, 9:16, 1:1, or 4:5 frame instead of a cropped landscape tile.
- Local project library stored in IndexedDB: every project with scenes is autosaved, listed with a generated thumbnail, scene count, duration, and last edit time. Project cards support open, rename, project-file backup/export, duplicate, and confirmed delete; deleting the active project safely clears the editor. Manual Save also snapshots the library copy.
- Image framing: choose Fill (crop), Fit (whole image with letterboxing), or Blur fill; zoom from 100–400%, pan horizontally and vertically, pick a custom letterbox color, center or reset the framing, or drag directly on the canvas to choose the visible area. Preview, thumbnails, and export share the same geometry.
- Replace any scene’s photo in place from the inspector, the Media panel, the clip context menu, or by dropping a JPEG/PNG/WebP onto a media tile or timeline clip. Timing, text, filters, speed, fades, and text effects are preserved.
- A real template gallery with Travel, Family, Birthday, Product, and Social stories: category filters, search, aspect-specific canvases, scene counts, durations, and real timing/looks/text effects. Applying a template over an existing story asks for confirmation and saves the current project first; template photos can then be replaced without rebuilding the scene.
- Multi-format deliverables: choose from 15 presets including 4K Landscape (3840×2160), 4K Vertical (2160×3840), and 4K Square (2160×2160). Social presets include YouTube Video, YouTube Shorts, Instagram Post, Instagram Reels, Instagram Story, TikTok, Facebook Post, Facebook Reels, X/Twitter, LinkedIn, Pinterest, and Snapchat — with proper output sizes. 4K exports are supported for every custom size up to 3840 px on either edge. Add custom width/height/FPS/quality formats up to 4K, switch formats from the preview header, and keep per-format framing and export settings. Export selected formats together into one folder. Export shows live FFmpeg progress and can be cancelled; a cancelled or failed export leaves any existing destination file untouched.
- Dark-gray theme is the default across Home, Projects, Templates, Settings, and the editor, with the PixCut violet accent and the app icon from `src-tauri/icons/`. A light theme remains selectable in Settings → Appearance.
- Offline bundled sample landscapes, with no external fonts or media requests.
- JPEG, PNG, and WebP import; up to 100 scenes, 10 MB per file, approximately 64 MB combined image data. Native Open dialogs filter to images, audio, or video before selection; browser pickers use the same accept filters.
- **Video clips:** import MP4, MOV, or M4V files up to 50 MB (WebM also works in the browser preview). PixCut decodes the clip, stores a poster frame, adds it to the visual track, and plays it in the canvas preview with text layers on top. Export trims each video to its timeline range, fits or crops it to the output, concatenates it with image scenes, overlays timed text, and mixes audio. Scene transitions touching video become hard cuts; video color grading, fades, and speed changes are not applied yet.
- Preview and timeline together, preview/timeline scrubbing, playback, fullscreen preview, media search, scene reordering, duplication, and deletion.
- Separate text and visual timeline lanes, with clickable title chips that jump into the Text inspector and count independent layers. Visual clips use an aspect-preserving filmstrip instead of stretching each photo across the clip width.
- Per-scene duration (0.5–30 seconds) and image fit.
- Double-clicking text in the preview opens a labeled inline editor for **Title** and **Subtitle** with **Done** and **Cancel**, instead of two unlabeled fields sitting over the canvas.
- Text animations: each layer can enter and exit with **Fade**, **Slide up**, **Slide left**, or **Pop**, with its own animation speed. Preview and MP4 export use the same timing.
- Independent text layers: up to eight per scene, each with its own text, subtitle, color, font, weight, italic, size, alignment, X/Y, width, rotation, opacity, line height, letter spacing, subtitle scale, effects, and appear/visible timing. Drag a layer on the canvas, resize its width, or edit it inline by double-clicking. The timeline shows each layer as its own chip at its real start/end, stacked into lanes when several overlap.
- A dedicated **Text** inspector tab with a layer list, add/delete, a one-click **Reset text styling** action, and a separate timing reset. The same layout and timing engine drives preview and MP4 export.
- Eight bundled offline fonts under the SIL Open Font License: Inter, Space Grotesk, DM Sans, Playfair Display, Libre Baskerville, Bebas Neue, Archivo Black, and Caveat. The font picker shows live previews; licenses are in `public/fonts/`.
- Project schema v7 stores a rational timebase (24/25/30/60 fps), a visual track of clips, integer clip start/source-in/duration ticks, frame-exact split/duration/speed operations, multiple local audio clips, independent timed text layers, shape/sticker element layers, per-scene photo motion, scene-to-scene transitions, and text entrance/exit animations. Schema v1–v6 projects migrate automatically on recovery/open.
- Audio: add multiple MP3, WAV, M4A/AAC, OGG, or WebM clips up to **50 MB each** (200 MB per project), positioned at the playhead. Clips can live on up to **8 separate audio lanes**, overlap, and mix simultaneously. Drag the middle of a clip to move it and the always-visible white edges to trim; the Audio panel also exposes start, trim-in, duration, volume, fade-in, and fade-out sliders. Preview mixes all active clips in sync and MP4 export mixes them as AAC audio.
- Eight-point color grade (brightness, contrast, exposure, highlights, shadows, saturation, temperature, tint) with exact numeric entry, reset, and copy/paste of color attributes.
- Speed presets (0.5×, 1×, 1.5×, 2×) and custom 0.25–4× speed with a source-to-timeline duration summary and a stored audio-pitch preference.
- Fade-in/out values with live preview and draggable handles on selected timeline clips; fades are clamped to the clip and overlap warnings are shown.
- The five bundled templates use layered editorial text, entrance animations, transitions, and themed procedural artwork. Gallery previews render the actual first scene, including titles, instead of a shared green landscape: cinematic travel ridges, warm family keepsakes, a plum-and-gold birthday scene, a studio product pedestal, and bold social gradients. Template previews preserve their real aspect ratio.
- Seven offline looks plus Original, with search, thumbnail previews, hover preview in the main viewer, intensity control, and a portable pixel color pipeline shared by preview and still-frame export.
- Independent text-effect groups: **Backdrop**, **Outline**, **Glow**, and **Drop Shadow**. Each has its own on/off toggle, fine controls, and small visual template buttons.
  - Backdrop: color, opacity, blur, padding, radius, and noise, color-blended so the plate does not inherit the photo’s cast.
  - Outline: color and width.
  - Glow: additive multi-pass halo with color, blur, and intensity, separate from the drop shadow.
  - Drop shadow: color, blur, intensity, and X/Y offset.
  - `Make text readable` is a combo preset for backdrop + outline + shadow; glow stays off until you enable it.
- Text timing is stored in scene-relative ticks. The exporter splits each scene at text in/out boundaries so layers appear and disappear at the right frame instead of being baked into one still.
- Project groups: name a group from a project’s ••• menu, filter by group, rename or remove groups from the group manager, and see projects grouped into titled sections. Groups are local metadata and never change the project file.
- Project search, sort (`Recently edited`, `Name A–Z`, `Longest first`), favorite projects, and a Favorites filter.
- Effects panel offers one-click original/look presets; Transitions panel applies scene transitions without opening the inspector.
- Multi-selection with Shift-click ranges and Cmd/Ctrl-click toggles. Color, filter, speed, fade, duration, text, and text-effect fields apply to every selected clip; copy/paste attributes and duplicate/delete batches commit as single undo steps. The primary selected clip keeps the inspector and fade handles.
- New projects can be created at 24, 25, 30, or 60 fps. Timing stays tick-accurate at any of those rates, and each output format keeps its own FPS.
- Landscape, portrait, and square canvases.
- Undo/redo, native project open/save dialogs, atomic native recovery saves, and portable `.pixcut` project packages.
- `.pixcut` files are ZIP packages containing a JSON manifest plus binary assets under `assets/`. Images and audio are stored as files with SHA-256 integrity checks, not as base64 inside the manifest; identical assets are deduplicated. Legacy `.pixcut.json` files still open.
- A shared content-addressed asset store now backs recovery and the project library: native recovery uses `assets/<sha256>.<ext>` in app data; browser recovery and library use an IndexedDB blob store. Project records store `pixcut-asset:<sha256>` references, so duplicate projects share media instead of copying it.
- The packaged macOS app registers the `.pixcut` document type. Double-click or Open With sends the file to the app; startup command-line paths are handled for Windows/Linux. The browser preview falls back to a JSON download because it cannot write native packages.
- A live shortcut registry powers tooltips, the searchable `?` reference, the `Cmd/Ctrl+K` command palette, timeline clip context menus, and first-run hints for Space, Split, and Undo.
- The shortcut reference can be exported as a plain-text file for printing or sharing, generated from the same effective bindings.
- Settings → Shortcuts offers search, click-to-record bindings, conflict resolution, PixCut/Premiere/Resolve presets, per-command and full reset, and validated JSON import/export. Settings are local, versioned, and update the whole UI immediately after Apply.
- Settings → Appearance switches between dark-gray (default) and light. Settings → General/Appearance/Editing controls new-project defaults (canvas, photo duration, image fit), compact editor density, reduced motion, quick-start hints, autosave delay, and default snapping. Privacy shows local storage usage; Updates shows build diagnostics, FFmpeg status, and a diagnostics copy action.
- **Elements:** add rectangles, circles, triangles, stars, sparkles, lines, arrows, and hearts to a scene. Each element has its own color, opacity, size, rotation, timing, and fade/pop/slide entrance. Drag it on the canvas; elements render below text and above the photo, and are baked into image and video exports.
- **Photo motion:** zoom in, zoom out, pan in four directions, or Ken Burns with an adjustable amount. Motion previews live and is rendered into exported image scenes; video clips keep their own motion for now.
- Scene-to-scene transitions: **Crossfade**, **Slide**, **Wipe**, **Zoom**, **Soft blur**, **Circle**, **Slide up**, and **Spin**, with a 0.1–2 s duration. Transitions preview in the viewer, export into the MP4, and show a duration badge on the visual clip. The Transitions panel applies them in one click.
- Drag visual clips directly on the timeline to reorder them. Timeline zoom from **100% to 600%** with −/+ controls, a slider, and a click-to-fit percentage. The view scrolls horizontally and keeps the playhead in view when zoom changes.
- Split at the playhead (`Cmd/Ctrl+B`), duplicate a clip after itself (`Cmd/Ctrl+D`), delete/ripple delete, one-frame arrow stepping, J/K/L transport, snapping toggle (`N`), and safe-area toggle (`Shift+S`).
- Batch export for multiple output formats. Choose formats in the Export dialog, pick a destination folder once, and PixCut renders each format using its saved size, FPS, quality, filename, and framing. Native H.264 MP4 export: 720p/1080p/1440p, 24/30/60 fps, draft/standard/high quality, editable filename, version, and optional preset/quality suffixes. Export reports live frame-render and FFmpeg progress. Landscape output is 1920×1080; portrait is 1080×1920; square is 1080×1080. Transitions and timed text are baked into frame segments, all audio clips are trimmed, delayed, faded, and mixed into AAC at 192 kbps. Export shows live frame-render progress. No watermark or outro.

Shortcuts are displayed as `Mod` (⌘ on macOS, Ctrl on Windows/Linux). Every effective binding is remappable in Settings → Shortcuts; tooltips, help, and the palette read the same registry, and OS-reserved combinations such as ⌘Q are rejected. Text fields commit on blur.

Color and filter grading runs through a portable RGBA pipeline rather than platform-dependent Canvas filter strings, so the Chromium preview, WebKit preview, and exported still frames stay visually consistent.

## Visual design

The desktop UI uses a light lavender home with gradient creation cards, and a dense navy editor with a violet-accented tool rail, inspector, and timeline. The native icon set lives in `src-tauri/icons/`.

## Organization

Everything for the desktop product stays in this folder. This desktop project does not depend on root-level package managers, shared packages, web projects, or cloud services.

- `src/app/`: React entry point, application shell, and native bridge.
- `src/components/`: shared UI, preview compositor, inspector, timeline, and dialog components.
- `src/components/preview/`: Canvas compositor, portable RGBA color grade, filter catalog, text layout, and offline sample imagery.
- `src/components/text/`: bundled font registry, categories, previews, and typography defaults.
- `src/components/shortcuts/`: searchable shortcut help with text export, command palette, and the shortcut editor.
- `src/shortcuts/`: central typed command registry, defaults, presets, binding parsing, conflicts, and local storage.
- `src/stores/`: typed project contracts, frontend state helpers, and the IndexedDB project library.
- `src/templates/`: the five bundled template definitions, preview artwork, and project builder.
- `src/styles/`: application styles.
- `public/fonts/`: SIL OFL license text and attribution for bundled fonts.
- `crates/project/`: authoritative native project model, validated edit commands, bounded undo/redo history.
- `src-tauri/src/lib.rs`: restricted native dialogs, atomic persistence, FFmpeg export adapter.
- `tests/`: project invariants, split/duplicate behavior, atomic batch edits, playback boundaries, shortcut registry validation, and the portable color pipeline.

The native app sends validated commands to Rust and uses the returned project snapshot. Its recovery file lives in Tauri's application data directory. The browser-only preview uses an equivalent TypeScript command adapter and IndexedDB. In both runtimes the current editing session has one recovery slot, while the project library (`pixcut-library` in the webview) keeps every project with at least one scene. Opening, starting, or applying a template first flushes the current story into the library, so several local projects can coexist. Undo history is session-only, capped at 30 edits.

## Current boundaries and next work

This slice deliberately uses a canvas compositor for still images and a locally installed FFmpeg for export. It does **not** implement the planned MLT/GES video engine or claim cross-platform native preview validation. Titles are rasterized locally by the same compositor used for preview and export. Up to five title lines and three subtitle lines are shown. Color and filter grading are baked into each still frame; fades preview in the viewer and timeline, while MP4 fade encoding waits for the video engine.

Video clips can be imported, previewed, trimmed, and exported; picture-in-picture overlays, video color grading, video fades, and speed changes still await the next media-engine pass; keyframes, advanced transform handles, clip-level MP4 fades, speed curves/reverse playback, audio routing buses (waveforms, ducking, EQ, voiceover), native application menus, localization, and packaged codec distribution remain unimplemented. Export progress and cancellation work for single and batch exports. In-app updates and a signed cross-platform release pipeline are implemented; producing public signed installers still needs Apple and Windows certificates. The timeline now supports zoom and drag reorder, but still edits one contiguous visual track plus a derived text lane; multi-track editing, gaps, trim/source in-out handles, VFR conversion, and engine-driven timing are still future work. Transitions are scene-boundary blends, not arbitrary overlapping layers. New projects can be created at 24, 25, 30, or 60 fps; existing projects keep their stored timebase. Multiple audio clips can be organized into eight audio lanes and mixed together; waveform editing, ducking, EQ, and clip-level audio effects are not yet implemented. Video overlays and true video tracks still require the planned media engine. Text layers are supported per scene; cross-scene text, animations, per-character effects, and user font import remain future work. Asset storage is now separated from project manifests, but native recovery assets and the webview library's IndexedDB assets are still two stores; missing-media relinking, unreferenced-asset cleanup, a unified native asset store, and SQLite project indexing remain future work. Browser HTML5 drag-and-drop is verified; the Tauri window now disables native file-drop interception so the webview receives drops, but that path still needs a packaged native pass after restart. Import does not alter source files. Export temporarily locks edits and replaces an existing destination only after encoding succeeds; keep the app open until it finishes. The external FFmpeg dependency must be packaged and reviewed before distribution.

Before expanding to the full editor, compare MLT/GES native preview, timing, and rendering across the target OS matrix.
