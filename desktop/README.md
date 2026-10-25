# PixCut Desktop

An offline-first Tauri 2 / React / TypeScript / Rust desktop application. This is the first working **photo-movie editor**, not the complete video editor described in the product plan.

## Run

Requirements: Node.js 22+, Rust stable, and the platform prerequisites for [Tauri](https://v2.tauri.app/start/prerequisites/). Native MP4 export additionally needs FFmpeg with the `libx264` encoder available on PATH (Homebrew's standard paths are also checked on macOS).

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

The initial package target is a local macOS `.app`. Windows/Linux packaging and signing are not configured or validated yet. The Tauri CLI can select other bundle targets once their prerequisites and icons are configured.

## What works

- Home with app navigation (Home, Projects, Templates, Settings), New Video, Photo Movie, Templates, sample inspiration, and recovery of the last local project.
- A light, focused home surface paired with a deep navy editing workspace, using the PixCut violet gradient accent and the app icon from `../design/brand/`.
- Offline bundled sample landscapes, with no external fonts or media requests.
- JPEG, PNG, and WebP import; up to 100 scenes, 10 MB per file, approximately 64 MB combined image data.
- Preview and timeline together, preview/timeline scrubbing, playback, fullscreen preview, media search, scene reordering, duplication, and deletion.
- Separate text and visual timeline lanes, with clickable title chips that jump into the text tools.
- Per-scene duration (0.5–30 seconds), title, subtitle, text color, and image fit.
- Eight-point color grade (brightness, contrast, exposure, highlights, shadows, saturation, temperature, tint) with exact numeric entry, reset, and copy/paste of color attributes.
- Speed presets (0.5×, 1×, 1.5×, 2×) and custom 0.25–4× speed with a source-to-timeline duration summary and a stored audio-pitch preference.
- Fade-in/out values with live preview and draggable handles on selected timeline clips; fades are clamped to the clip and overlap warnings are shown.
- Seven offline looks plus Original, with search, thumbnail previews, hover preview in the main viewer, intensity control, and a portable pixel color pipeline shared by preview and still-frame export.
- Multi-selection with Shift-click ranges and Cmd/Ctrl-click toggles. Color, filter, speed, fade, duration, and text fields apply to every selected clip; copy/paste attributes and duplicate/delete batches commit as single undo steps. The primary selected clip keeps the inspector and fade handles.
- Landscape, portrait, and square canvases.
- Undo/redo, native project open/save dialogs, atomic native recovery saves, portable JSON projects with embedded images.
- A live shortcut registry powers tooltips, the searchable `?` reference, the `Cmd/Ctrl+K` command palette, timeline clip context menus, and first-run hints for Space, Split, and Undo.
- Settings → Shortcuts offers search, click-to-record bindings, conflict resolution, PixCut/Premiere/Resolve presets, per-command and full reset, and validated JSON import/export. Settings are local, versioned, and update the whole UI immediately after Apply.
- Split at the playhead (`Cmd/Ctrl+B`), duplicate a clip after itself (`Cmd/Ctrl+D`), delete/ripple delete, one-frame arrow stepping, J/K/L transport, snapping toggle (`N`), and safe-area toggle (`Shift+S`).
- Native 30 fps H.264 MP4 slideshow export. Landscape output is 1920×1080; portrait is 1080×1920; square is 1080×1080. No watermark or outro.

Shortcuts are displayed as `Mod` (⌘ on macOS, Ctrl on Windows/Linux). Every effective binding is remappable in Settings → Shortcuts; tooltips, help, and the palette read the same registry, and OS-reserved combinations such as ⌘Q are rejected. Text fields commit on blur.

Color and filter grading runs through a portable RGBA pipeline rather than platform-dependent Canvas filter strings, so the Chromium preview, WebKit preview, and exported still frames stay visually consistent.

## Visual design

The desktop UI follows the boards in `../design/desktop/` and the brand assets in `../design/brand/`: a light lavender home with gradient creation cards, and a dense navy editor with a violet-accented tool rail, inspector, and timeline. The native icon set (`src-tauri/icons/`) is generated from `../design/brand/pixcut-app-icon-1024.png`.

## Organization

Everything for the desktop product stays in this folder. This desktop project does not depend on root-level package managers, shared packages, web projects, or cloud services.

- `src/app/`: React entry point, application shell, and native bridge.
- `src/components/`: shared UI, preview compositor, inspector, timeline, and dialog components.
- `src/components/preview/`: Canvas compositor, portable RGBA color grade, filter catalog, and offline sample imagery.
- `src/components/shortcuts/`: searchable shortcut help, command palette, and the shortcut editor.
- `src/shortcuts/`: central typed command registry, defaults, presets, binding parsing, conflicts, and local storage.
- `src/stores/`: typed project contracts and frontend state helpers.
- `src/styles/`: application styles.
- `crates/project/`: authoritative native project model, validated edit commands, bounded undo/redo history.
- `src-tauri/src/lib.rs`: restricted native dialogs, atomic persistence, FFmpeg export adapter.
- `tests/`: project invariants, split/duplicate behavior, atomic batch edits, playback boundaries, shortcut registry validation, and the portable color pipeline.

The native app sends validated commands to Rust and uses the returned project snapshot. Its recovery file lives in Tauri's application data directory. The browser-only preview uses an equivalent TypeScript command adapter and IndexedDB. Opening a different project replaces the recovery copy; explicitly save projects you want to keep. Undo history is session-only, capped at 30 edits.

## Current boundaries and next work

This slice deliberately uses a canvas compositor for still images and a locally installed FFmpeg for export. It does **not** implement the planned MLT/GES video engine or claim cross-platform native preview validation. Titles are rasterized locally by the same compositor used for preview and export. Up to five title lines are shown; long subtitles are fitted to one line. Color and filter grading are baked into each still frame; fades preview in the viewer and timeline, while MP4 fade encoding waits for the video engine.

Video/audio import, transitions, keyframes, advanced transform handles, MP4 fade encoding, speed curves/reverse playback, audio fades, background export cancellation/progress, optional branded outro, native application menus, licensing, updater, localization, code signing, and packaged codec distribution remain unimplemented. Import does not alter source files. Export temporarily locks edits and replaces an existing destination only after encoding succeeds; keep the app open until it finishes. The external FFmpeg dependency must be packaged and reviewed before distribution.

Before expanding to the full editor, follow Phase 0 in `../docs/architecture/08-RELEASE-PLAN-AND-TESTS.md`: compare MLT/GES native preview, timing, and rendering across the target OS matrix.
