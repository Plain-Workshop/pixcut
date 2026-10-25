# Product information architecture and end-to-end UX

## Target audiences
- Social creator: short vertical edits, captions, hooks, fast uploads.
- YouTube creator: long-form timeline, chapters, titles, thumbnail, extract Shorts.
- Marketing/solo business: brand kit, repeatable templates, batch exports.
- Family/travel creator: photo-to-video guided workflow, clean transitions, basic audio.

## First-run flow
Welcome -> choose optional theme/language -> select `Create Video`, `Photos to Video`, `Create Shorts`, `Generate Image`, `Start from Template` or `Open Project`. Never require an account to edit or export local content. On file import, show only the project format chooser (source, YouTube 16:9, Shorts/Reels 9:16, Feed 4:5, Square 1:1, custom). No disruptive tutorial; tooltips and 2-minute guided sample project are optional.

## Workspace layout
- Global chrome (44–52 px): project title/status, undo/redo, mode switching, export.
- Tool rail (60–76 px): Media, Text & Captions, Elements, Transitions, Animations, Effects, Audio, AI, Templates.
- Content browser left (240–360 px): search, filters, previews, favorite/recent, drag/drop.
- Player center: persistent main preview, safe-area overlays, transform handles, playback, zoom, target-format toggle.
- Context inspector right (280–360 px): changes automatically according to selection. Collapsible sections and a search-in-properties function.
- Timeline bottom: adjustable 240–650+ px, filmstrip clips, separate captions/overlay/text/video/audio tracks, keyframe lanes, playhead, zoom, snapping. Adjustable to >50% available height. Timeline or inspector can auto-collapse at small resolutions.
- Panels resizable, layout persists per workspace; single-window first, detachable preview later.

## Core interactions
- Select media/object -> inspector shows relevant properties. Double-click text in player -> edit inline; Enter commits, Esc cancels.
- Click/hover template/effect -> non-destructive preview; double-click -> apply to selected item; drag -> drop at exact timeline position.
- Transition object is located at adjacent clip boundary; hover gives sample, click opens duration/ease/direction settings. Show handles indicating overlap required.
- Animation presets belong to an item, with In / Loop / Out and an optional Motion tab. Display bands at item edges in timeline, expand to keyframes.
- Direct manipulation supports drag/scale/rotate, aspect snapping, center guides, align/distribute, safe-area indicators, temporary rulers.
- `Ctrl/Cmd+K`: universal command palette. `Space`: play/pause, `S`: split at playhead, `Ctrl/Cmd+Z`: undo, `+/-`: timeline zoom, `J/K/L`: playback shuttle optional configurable.
- Preview playback always represents the active social layout, all text, overlays, and effects. Indicate when low-quality proxy/partial-quality preview is being shown.

## Context inspectors
- Photo/video: Transform, Crop/Fill, Animation, Color, Speed, Effects, AI Adapt, Audio (if present).
- Text: content, font, size, weight, tracking, line-height, stroke, backdrop, layout, In/Loop/Out animation, per-word optional.
- Overlay: source, blend mode, position, mask, opacity, timing, keyframes.
- Transition: style, duration, alignment, ease, motion blur optional.
- Caption group: transcript, language, grouping, style, word timings, safe placement.
- Audio: volume, ducking, fades, EQ, normalize, caption extraction.

## Project flows
### Simple photo movie
Import -> select style/music -> storyboard order -> preview -> enter timeline when desired -> export; keep all elements editable.
### Vertical talking-head video
Import landscape -> choose 9:16 -> Smart Crop preview -> select speaker tracking -> Generate Captions -> select style -> adjust safe zones -> export.
### Social ad
New project -> product photos/videos -> brand kit -> video + animated price + CTA -> platform variants -> compare -> batch export.
### AI recompose
Select media -> Adapt to format -> compare Crop / Fit / AI Extend / AI Recompose -> mask protected regions -> Generate variants -> accept one -> timeline replaces reference non-destructively.

## UX states and guardrails
Show empty-state import and drag targets, generated-content placeholder, proxy progress, rendering busy state, model unavailable state, queued jobs, invalid media, no billing credits, and missing files. Undo must work even after AI result is accepted. Disable only impossible controls with explanation. Warn before destructive file deletion; editor operations never mutate original file.

## Accessibility/localization
WCAG-oriented contrast, keyboard operation for timeline edits, scalable UI (90–175%), screen-reader labels on actions, reduced-motion option, OS-native file dialogs, RTL-aware layout in future, UI translations independent of model/transcription language. Support 1366x768, 1080p, ultrawide; handle Linux font variation.
