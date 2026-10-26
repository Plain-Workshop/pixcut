# PixCut Desktop

An offline-first Tauri 2 / React / TypeScript / Rust desktop application. This is the first working **photo-movie editor**, not the complete video editor described in the product plan.

Every feature is included. There are no paid tiers, license keys, activation servers, or device limits — 4K export, batch social export, effects, and templates are available to everyone.

## Run

Requirements: Node.js 22+, Rust stable, and the platform prerequisites for [Tauri](https://v2.tauri.app/start/prerequisites/). Native video export additionally needs FFmpeg with the `libx264` encoder available on PATH (Homebrew's standard paths are also checked on macOS); VP9/WebM and ProRes exports need `libvpx-vp9`/`libopus` and `prores_ks`. When FFmpeg is missing, the export dialog shows the install command for the current platform.

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
- Replace any scene’s photo or video in place from the inspector (**Replace media…**), the clip context menu, or by dropping a file onto a timeline clip. Image and video drops replace the scene and keep its timing, text, filters, speed, fades, and effects; a full-timeline drop hint and per-scene **REPLACE IMAGE / REPLACING…** state show exactly where the file will land and that it is being processed.
- A real template gallery with 14 Nature, Travel, People, Family, Birthday, Social and Food stories, including one video opener: category filters, search, aspect-specific canvases, scene counts, durations, real timing/looks/text effects, and a local music bed. Cards show the story's own photograph or video poster with its headline type over it, the way a finished scene looks. Applying a template over an existing story asks for confirmation and saves the current project first; the new project starts with the template's bundled imagery (never the previous project's media) and any scene can be replaced at any time.
- Multi-format deliverables: choose from 15 presets including 4K Landscape (3840×2160), 4K Vertical (2160×3840), and 4K Square (2160×2160), grouped by the platform you publish to — YouTube, Instagram, TikTok, Facebook, X, LinkedIn, Pinterest, Snapchat, and 4K masters. A project holds up to 24 deliverables, including custom sizes. Formats that resolve to the same size, frame rate, quality, and framing are rendered once and written as one file whose name lists every platform it serves, for example `Story-v1-yt-ig-tt-fb-sc-1080x1920.mp4` (one two-letter code per platform); the setup and export screens show the selected formats and the exact number of files. 4K exports are supported for every custom size up to 3840 px on either edge. Add custom width/height/FPS/quality formats up to 4K, switch formats from the preview header, and keep per-format framing and export settings. Export selected formats together into one folder. Choose H.264 or H.265 in MP4/QuickTime/Matroska, VP9 in WebM, or ProRes 422 in QuickTime; the container list follows the codec so only valid combinations are offered. Export shows live FFmpeg progress and can be cancelled; a cancelled or failed export leaves any existing destination file untouched.
- Dark-gray theme is the default across Home, Projects, Templates, Settings, and the editor, with the PixCut violet accent and the app icon from `src-tauri/icons/`. A light theme remains selectable in Settings → Appearance.
- Offline bundled sample landscapes, with no external fonts or media requests.
- JPEG, PNG, and WebP import; up to 100 scenes. On desktop each photo is streamed into the local asset store (up to 500 MB each) and the project keeps a reference, so a long photo story no longer hits the old combined-image budget; the browser build still embeds photos (10 MB per file, roughly 64 MB combined). Native Open dialogs filter to images, audio, or video before selection; browser pickers use the same accept filters.
- **Video clips:** on desktop, MP4/MOV/M4V/WebM files up to 4 GB are streamed into PixCut's local asset store and the project keeps only a reference, so long clips no longer sit in memory. The browser preview still embeds them as data URLs and keeps the 50 MB cap. PixCut decodes the clip, stores a poster frame and its source duration, adds it to the visual track, and plays it in the canvas preview with text layers on top at the clip's speed. PixCut decodes the clip, stores a poster frame and its source duration, adds it to the visual track, and plays it in the canvas preview with text layers on top at the clip's speed. The clip's own soundtrack plays in the preview — muted while scrubbing, paused, or playing backwards — and is mixed into the export at the same speed, with the clip's fade-in and fade-out applied to the sound as well as the picture. Export trims each video to its timeline range, applies the same speed change (`setpts` and a matching `atempo`), bakes the scene's color grade and look into a generated `.cube` LUT, encodes clip fades, fits or crops it to the output, concatenates it with image scenes, overlays timed text, and mixes every audio source. Scene transitions touching video still become hard cuts.
- Media preview with previous/next arrows and ←/→ keys, plus video play/pause, seeking, mute and volume controls (Space toggles playback, ↑/↓ change volume).
- Preview and timeline together, preview/timeline scrubbing, playback, fullscreen preview, media search, scene reordering, duplication, and deletion. Playback renders at a lighter resolution than the paused frame so 4K and overlay-heavy stories stay smooth, and **Repeat** loops the story in either direction until you stop it.
- **Save still frame** from the camera button in the preview header. It renders the current frame at the active format's full output size (for example 1920×1080) with overlays, colour grade, and transition blend applied, then writes a PNG through the native save dialog or the browser download. Nothing is uploaded.
- Separate text and visual timeline lanes, with clickable title chips that jump into the Text inspector and count independent layers. Visual clips use an aspect-preserving filmstrip instead of stretching each photo across the clip width.
- Per-scene duration and image fit, plus edge trim handles on every visual clip. Dragging a handle ripples the rest of the story; photos run 0.5–30 seconds, while imported video can fill up to ten minutes, bounded by its source length.
- Double-clicking text in the preview opens a labeled inline editor for **Title** and **Subtitle** with **Done** and **Cancel**, instead of two unlabeled fields sitting over the canvas.
- Text animations: each layer can enter and exit with **Fade**, **Slide up**, **Slide left**, or **Pop**, with its own animation speed. Preview and MP4 export use the same timing.
- Independent text layers: up to eight per scene, each with its own text, subtitle, color, font, weight, italic, size, alignment, X/Y, width, rotation, opacity, line height, letter spacing, subtitle scale, effects, and appear/visible timing. Drag a layer on the canvas to move it — it snaps to the canvas edges, centre, and the centres of other visible overlays with violet alignment guides — resize its width, or edit it inline by double-clicking. Overlay images, videos, and elements snap the same way. The timeline shows each layer as its own chip at its real start/end, stacked into lanes when several overlap. Elements get their own timeline row with the same timing model.
- A dedicated **Text** inspector tab with a layer list, add/delete, a one-click **Reset text styling** action, and a separate timing reset. The same layout and timing engine drives preview and MP4 export.
- **Motion keyframes:** text layers, elements, and photo framing can each hold up to 24 keyframes. Place the playhead, move, scale, rotate, fade, pan, or zoom, then add a key; values interpolate linearly between keys and enter/exit animations still apply on top. Layer keyframes are baked into the preview, still frames, thumbnails, and every exported overlay frame; photo framing keyframes are baked into preview, still frames, and every rendered photo frame.
- **Shape masks:** photo scenes and image/video overlays can be cut into a rectangle, ellipse, triangle, or star. The inspector controls the mask's centre, size, rotation, feather, and inversion; geometry is relative to the layer's box, so overlay cutouts follow moves, scale changes, and keyframes. Photo masks keep the framing background visible outside the shape. Masks are baked into the layer alpha before compositing, which keeps the preview, still frames, and every exported frame identical.
- **Beat markers and beat sync:** drop manual markers at the playhead from the timeline toolbar, or select an audio clip and **Detect beats** to analyze it locally and fill markers from its pulse. Markers draw as amber guides across every track; overlay trims/moves snap to them while snapping is on. **Snap cuts** moves each photo cut within 0.35 s of a detected beat in one undo step, with the BPM shown in the Audio panel. Everything stays on-device, and markers are editing aids only — nothing is baked into the export. Click a marker to remove it.
- **Caption import:** drop in an SRT or WebVTT file and PixCut turns each cue into an editable text layer at the right time, styled as a readable caption. Cues are clipped to the scene they start in, long cues split at word boundaries, and anything outside the story or over the eight-layer limit is reported instead of silently dropped. Fully local: no speech model, no upload.
- **Music ducking:** an optional 10–90 % dip lowers the music while an audible video clip plays, with a 150 ms ramp at each edge. Preview and export build the same envelope; silent or muted clips never trigger it.
- **Native menus:** File (new, open, save, import, export), Edit (undo/redo), View (home, fullscreen preview, safe area, settings), Playback and Help run the same commands as the keyboard shortcuts, so availability and notices stay consistent. Accelerators stay with the webview so remapped shortcuts never fire twice.
- **Screen-reader labels on the timeline:** every scene, text layer, overlay and audio clip announces its name, start and end time, media type and selection state; tracks are labelled groups, the save status is a polite live region, and Enter selects a focused clip.
- **Layer order** works across everything drawn over the photo or video: text layers, elements and project overlays share one stack. Select any of them and use the four-way **Layer order** control in the inspector (send to back, back one, forward one, bring to front) to put text above a video overlay, an overlay above text, or one element above another. Order is stored as a `z` number per layer, so old projects keep their existing order and the preview, still frames, thumbnails and MP4 export all composite the same way.
- Eight bundled offline fonts under the SIL Open Font License: Inter, Space Grotesk, DM Sans, Playfair Display, Libre Baskerville, Bebas Neue, Archivo Black, and Caveat. The font picker shows live previews; licenses are in `public/fonts/`.
- Project schema v13 stores a rational timebase (24/25/30/60 fps), a visual track of clips, integer clip start/source-in/duration ticks, each video clip’s full source duration, frame-exact split/duration/speed operations, multiple local audio clips, independent timed text layers, shape/sticker element layers, per-scene photo motion, scene-to-scene transitions, and text entrance/exit animations. Schema v1–v12 projects migrate automatically on recovery/open.
- Audio: add multiple MP3, WAV, M4A/AAC, OGG, or WebM clips. On desktop the file is streamed into the local asset store (up to **1 GB each**) and the project keeps a reference; the browser build embeds clips up to 50 MB (200 MB per project). Clips are positioned at the playhead. Clips can live on up to **8 separate audio lanes**, overlap, and mix simultaneously. Each clip shows a decoded waveform that follows its trimmed source window. Drag the middle of a clip to move it and the always-visible white edges to trim; the Audio panel also exposes start, trim-in, duration, volume, fade-in, and fade-out sliders. Deleting an audio clip removes only that clip, never the scene. Preview mixes all active clips in sync and exports mix them as AAC, Opus, or PCM depending on the chosen format.
- Eight-point color grade (brightness, contrast, exposure, highlights, shadows, saturation, temperature, tint) plus hue, vibrance, and shadow/highlight split toning, with exact numeric entry, reset, and copy/paste of color attributes. All controls share the portable canvas pipeline and the generated `.cube` LUT used for video export.
- Speed presets (0.5×, 1×, 1.5×, 2×) and custom 0.25–4× speed with a source-to-timeline duration summary and a stored audio-pitch preference. Preview videos play at the chosen rate and MP4 export applies the same retiming.
- Fade-in/out values with live preview and draggable handles on selected timeline clips; fades are clamped to the clip and overlap warnings are shown. Fades are now encoded into MP4 export for image and video scenes alike.
- Templates are built from 33 bundled photographs (valleys, coastlines, city nights, portraits, couples, café tables) with editorial type, entrance animations, transitions, colour filters and framing moves. One **Motion opener** uses a bundled six-second generated video background; every template carries a generated 20-second local music bed with fades. All media is CC0 and ships inside the app — `public/templates` holds the photos, generated music/video and `credits.json`, so the gallery needs no network and credits are visible in the gallery. Template previews preserve their real aspect ratio.
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
- **Missing media stays recoverable:** if an asset disappears from the local store, the project still opens with a banner listing each missing file. The editor shows empty placeholders instead of broken requests, keeps every edit and timing decision, and pauses saving and exporting until **Relink media** replaces each reference. Relinking accepts a fresh image, video, or audio file and swaps every use of the old reference in one undo step. Assets that fail their SHA-256 integrity check are still treated as damaged rather than relinkable. Streamed video is checked against the local store when a project opens, so a deleted file still blocks saving and export until it is relinked.
- The packaged macOS app registers the `.pixcut` document type. Double-click or Open With sends the file to the app; startup command-line paths are handled for Windows/Linux. Only one editor runs per machine: launching PixCut again focuses the existing window, and any `.pixcut` path passed to the second launch is opened there instead of starting a rival instance. The browser preview falls back to a JSON download because it cannot write native packages.
- A live shortcut registry powers tooltips, the searchable `?` reference, the `Cmd/Ctrl+K` command palette, timeline clip context menus, and first-run hints for Space, Split, and Undo.
- The shortcut reference can be exported as a plain-text file for printing or sharing, generated from the same effective bindings.
- Settings → Shortcuts offers search, click-to-record bindings, conflict resolution, PixCut/Premiere/Resolve presets, per-command and full reset, and validated JSON import/export. Settings are local, versioned, and update the whole UI immediately after Apply.
- Settings → Appearance switches between dark-gray (default) and light. Settings → General/Appearance/Editing controls new-project defaults (canvas, photo duration, image fit), compact editor density, reduced motion, quick-start hints, autosave delay, and default snapping. Privacy shows local storage usage; Updates shows build diagnostics, FFmpeg status, and a diagnostics copy action.
- **Elements:** add social graphics (Subscribe, Like, Bell, Comment, Share, Play, Progress, Location, Music, Check, Cross, Ring, Cursor, Underline) and shapes (rectangle, circle, triangle, star, sparkle, line, arrow, heart). Each element has its own color, opacity, size, rotation, timing, and fade/pop/slide/pulse/float entrance. Drag it on the canvas; elements render below text and above the photo, and are baked into image and video exports.
- **Photo motion:** zoom in, zoom out, pan in four directions, or Ken Burns with an adjustable amount. Motion previews live and is rendered into exported image scenes; video clips keep their own motion for now.
- Scene-to-scene transitions: **Crossfade**, **Slide**, **Wipe**, **Zoom**, **Soft blur**, **Circle**, **Slide up**, and **Spin**, with a 0.1–2 s duration. Transitions preview in the viewer, export into the MP4, and show a duration badge on the visual clip. The Transitions panel applies them in one click.
- Timeline rows read top-down as **Visuals → Overlays → Elements → Text → Audio**. Drag visual clips directly on the timeline to reorder them. Timeline zoom from **50% to 600%** with −/+ controls, a slider, and a click-to-fit percentage. The ruler and scrubber stay pinned while the lanes scroll. The view scrolls horizontally and keeps the playhead in view when zoom changes.
- Split at the playhead (`Cmd/Ctrl+B`), duplicate a clip after itself (`Cmd/Ctrl+D`), delete/ripple delete, one-frame arrow stepping, J/K/L transport, snapping toggle (`N`), and safe-area toggle (`Shift+S`).
- Batch export for multiple output formats. Choose formats in the Export dialog, pick a destination folder once, and PixCut renders each format using its saved size, FPS, quality, filename, and framing. Codecs are H.264 and H.265 in MP4/MOV/MKV, VP9 in WebM, and ProRes 422 in MOV, at 720p/1080p/1440p, 24/30/60 fps, draft/standard/high quality, editable filename, version, and optional preset/quality suffixes. Audio follows the container: AAC at 192 kbps for MP4/MOV/MKV, Opus at 160 kbps for WebM, and 48 kHz PCM for ProRes. On macOS, an optional **hardware encoder** (Apple VideoToolbox) encodes H.264/H.265 several times faster at a comparable bitrate; it is offered only when the local FFmpeg includes it. Export reports live frame-render and FFmpeg progress. Landscape output is 1920×1080; portrait is 1080×1920; square is 1080×1080. Transitions and timed text are baked into frame segments, and all audio clips are trimmed, delayed, faded, and mixed. No watermark or outro.

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
- `src/templates/`: the bundled template definitions (`catalog.ts`), photo and media catalogues/loaders (`photos.ts`, `media.ts`), and `public/templates/` for the bundled CC0 photography, generated music/video and credits.
- `src/styles/`: application styles.
- `public/fonts/`: SIL OFL license text and attribution for bundled fonts.
- `crates/project/`: authoritative native project model, validated edit commands, bounded undo/redo history.
- `src-tauri/src/lib.rs`: restricted native dialogs, atomic persistence, FFmpeg export adapter.
- `tests/`: project invariants, split/duplicate behavior, atomic batch edits, playback boundaries, shortcut registry validation, and the portable color pipeline.

The native app sends validated commands to Rust and uses the returned project snapshot. Its recovery file lives in Tauri's application data directory. The browser-only preview uses an equivalent TypeScript command adapter and IndexedDB. In both runtimes the current editing session has one recovery slot, while the project library (`pixcut-library` in the webview) keeps every project with at least one scene. Opening, starting, or applying a template first flushes the current story into the library, so several local projects can coexist. Undo history is session-only, capped at 30 edits.

## Timeline elements

Elements includes 200 curated presets in 20 collections: editable lower thirds, captions, chapters, callout pins, keycaps, mouse interactions, device frames, comparison dividers, checklists, ratings, countdowns, waveforms, chat bubbles, QR cards, end screens, and the existing social/text utilities. Search by name, text or icon, or browse a collection. The gallery initially loads 40 previews and exposes all 200 with Show more. Standalone primitive shapes are removed from the picker and new bundled templates; old projects retain their artwork.

Select **Elements → Dynamic**, add a preset, and use **Timeline behavior** in the inspector. Action time is measured from the overlay's start; moving the block moves the behavior. Countdown controls set the first/last number and step interval. Mouse presets support click, double click, and a diagonal drag (rotate the element to change direction). Keycaps press at the chosen time; checklist lines check sequentially; messages show a typing indicator until reveal. Entrance, additional motion, and exit are independent. **Preview action** seeks to the behavior and plays it.

Audio waveforms use a cached local PCM envelope, with the audio clip's source trim, project start, volume, and fades. Choose all audio tracks or one track; silence stays flat. This is a waveform of imported audio tracks, not microphone capture or a frequency spectrum. Omitting audio from an export keeps its waveform artwork. Device frames and end-screen slots are transparent: position your image/video overlays underneath them. Comparison presets supply labels and an animated divider, not an automatic two-source wipe. QR cards encode the entered text/link locally without visiting it.

Dynamic behavior is calculated from timeline time, including when scrubbing backward. Preview, thumbnails, and export share the canvas artwork; both photo export planners render dynamic elements and exits every frame. Project schema 14 accepts versions 1–13 and preserves both design preset identity and behavior settings in TypeScript and Rust. The 20 collections cover creator prompts, lower thirds, captions, chapters, notifications, tutorials, timers, audio, screens, travel, food, fitness, shopping, events, reactions, badges, data graphics, callouts, end screens, and personal stories. The composed artwork uses 165 locally bundled Lucide symbols (ISC license in `src/components/elements/preset-icons.LICENSE`). Editable primary and secondary copy is stored in each element.

## Current boundaries and next work

This slice deliberately uses a canvas compositor for still images and a locally installed FFmpeg for export. It does **not** implement the planned MLT/GES video engine or claim cross-platform native preview validation. Titles are rasterized locally by the same compositor used for preview and export. Up to five title lines and three subtitle lines are shown. Color and filter grading are baked into each still frame and into a generated `.cube` LUT for video; clip fades are encoded globally after overlay compositing, and video speed is applied in both preview playback and the export filter graph.

Video clips can be imported, previewed, trimmed, graded, faded, retimed, and exported, and their own audio track is mixed with the music at the clip's speed and fades; picture-in-picture **video tracks** still await the next media-engine pass. Scene transitions that touch a video clip are hard cuts, and video overlays are still baked as timed image/video overlays rather than a true multi-track composition. Blend modes, chroma key, advanced transform handles, speed curves/reverse playback, EQ, voiceover, native application menus, localization, and packaged codec distribution remain unimplemented. Export progress and cancellation work for single and batch exports. In-app updates and a signed cross-platform release pipeline are implemented; producing public signed installers still needs Apple and Windows certificates. The timeline now supports zoom, drag reorder, and ripple trim handles, but still edits one contiguous visual track plus a derived text lane; multi-track editing, gaps, VFR conversion, and engine-driven timing are still future work. Transitions are scene-boundary blends, not arbitrary overlapping layers. New projects can be created at 24, 25, 30, or 60 fps; existing projects keep their stored timebase. Multiple audio clips can be organized into eight audio lanes and mixed together; clips draw a decoded waveform and can drive local beat detection; waveform-level editing, EQ, and clip-level audio effects are not yet implemented. Imported video audio is mixed at its own clip level with the clip's fades and speed, and music can duck under video sound project-wide; EQ and voiceover remain future work. Text layers are supported per scene; cross-scene text, animations, per-character effects, and user font import remain future work. Asset storage is now separated from project manifests. Streamed video, audio and photos stay on disk with an `asset://` URL in the native webview; the browser preview embeds its media. Saving a `.pixcut` bundle streams stored media straight into the archive, so a large project does not have to be loaded into memory to save it, and reopening resolves every asset. Native recovery assets and the webview library's IndexedDB assets are still two stores; missing-media relinking is implemented, while unreferenced-asset cleanup, a unified native asset store, and SQLite project indexing remain future work. Browser HTML5 drag-and-drop is verified; the Tauri window now disables native file-drop interception so the webview receives drops, but that path still needs a packaged native pass after restart. Import does not alter source files. Export temporarily locks edits and replaces an existing destination only after encoding succeeds; keep the app open until it finishes. The external FFmpeg dependency must be packaged and reviewed before distribution.


Before expanding to the full editor, compare MLT/GES native preview, timing, and rendering across the target OS matrix.
