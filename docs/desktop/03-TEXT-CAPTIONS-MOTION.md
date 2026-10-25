# Text, overlays, captions, transitions and motion graphics

## Core text editor
- Double-click live canvas to edit text; baseline, multiline, bold, italic, color, gradient, shadow, stroke, blur, rounded background, text box padding, custom font import, tracking, line height, paragraph/vertical alignment, responsive auto-fit, safe-zone snapping.
- Text remains structured and editable, not rasterized at import. Shape/text bounding boxes have drag handles and precision inspector values. Font missing warning with substitution preview; project bundling option for legally redistributable fonts only.
- Apply style presets by hover-preview and drag/apply. Every preset has stable id and version; serialized instances keep parameter overrides.

## Captions
- Generate from selected media/audio or entire sequence; on-device model where available or explicit cloud provider. Word-level timings when model supports; otherwise interpolate/manual correction with quality warning.
- Transcript pane with find, split/merge, edit words, shift timing, select language and speaker, redact a word, export SRT/VTT, import existing files. Optional captions baked into export or sidecar tracks.
- Caption styles: word-highlight, karaoke, pop, minimal, two-line, speaker-color, boxed, outline. Group 2–6 words per subtitle event as editable setting. Auto line break and avoid faces, titles and platform UI safe area. Rule-based layout fallback without AI.
- Transcript editing of source video: first provide non-destructive cut suggestions, with preview + undo before applying mapped cuts to video/audio. Handle crosstalk, stutters, speaker turns and time-stretched footage explicitly.

## Overlay catalog
- Vector shapes, SVG (sanitized), PNG/WebP, transparent videos, emoji, icons, GIF, social CTA, polls, progress bar, arrows, lower thirds, price tags, frame borders, PIP, mask, blur/privacy regions.
- Blend modes, transform, skew where supported, chroma key, alpha, masks, grouped objects, crop, object lock, aspect snapping, opacity automation and custom anchor point.
- Layer appearance in timeline: separate colored clips above video, trimmed duration, own keyframe lane. All layers visible in player; no separate preview window needed.

## Animation and transitions
- Every element supports In, Loop, Out plus manual keyframes. Ease presets include ease-in/out, cubic Bezier, bounce, spring-like procedural (baked to deterministic values). Per-letter animations explicitly optional advanced.
- Transition preset between two neighboring clips, duration bounded by available handle material (or defined freeze-frame policy), start/center/end align, direction, ease, example preview, drag onto boundary, replace by drag, no-transition remove.
- Scene/clip animations: slow pan, zoom, rotation, opacity, path following, camera shake, parallax (depth estimation optional AI), animated crop.
- Non-destructive effect stack ordered by user; enable/disable each effect, comparison toggle, reset single parameter/entire effect, preset save/export.

## Motion Studio
Separate focused composition canvas with same timeline engine; keyframe graph for x/y/scale/opacity/rotation/effect values. Templates are parameterized compositions exposing title/text/image/colors/timing slots, not opaque rendered videos. Nested compositions get duration/time remap, output alpha, editable parameters and version identifiers. Plugin-defined shapes/effects run only in permissioned environments.

## Acceptance tests
Inline text edit + undo/redo; transparent export produces expected alpha; effect hover does not change project; render matches preview for 20 sample frames; bilingual Unicode script and emoji render consistently; caption edit preserves timing across project reload; timeline animations remain visible at any zoom.
