# PixCut UX specification

## Product entry
**Home:** brand + Help + Settings in header; three prominent cards New Video (empty 16:9 or user-chosen canvas), Photo Movie (import → reorder → choose music → offline style → edit), Templates (bundled, ready offline). Recent Projects grid with thumbnails, dates, local locations, resume. No promotional modal or login gate.

## Main workspace
On 1440×900 target: top header 48–56px (project/save/undo/redo/export), vertical tools 60–76px, collapsible left library 260–330px, central preview elastic, right contextual inspector 280–340px, timeline bottom 30–55% of content height, splitter handles on all major panels. At 1366×768 inspector may auto-collapse; preview and timeline must remain visible. Accessible keyboard navigation, high contrast, reduced-motion mode, scalable controls, explicit tooltips, locale-safe layouts.

### Left tools
Media | Text | Elements | Transitions | Animations | Effects | Audio | Templates; no prominent AI tab by default. Clicking tool changes library only and does not hide preview/timeline. Search + category filters + hover previews + Favorites/Recent. Drag-and-drop to canvas or tracks; double-click effect can apply to selected object; show exactly where it goes before commit.

### Object edit
Click text inside preview to select; double-click to edit directly. Resize/reposition with handles; use snap lines; Alt/Option precision modifier, Shift constrain. Inspector changes to appropriate content (Text: typography/outline/shadow/readability/animation; Transition: duration/ease/alignment; Overlay: transform, mask, blend/animation; Clip: crop/speed/color). Every object remains separately editable and labeled in track; group/collapse tracks for captions/overlays. Undo/redo across all operations.

### Simple and advanced
Simple editing does not remove tracks or convert project format; optional advanced inspector shows keyframes, curves, track grouping, masks, color, audio mixing. Keyboard commands discoverable via Help > Shortcuts and command search. Free trial/pro promotional controls do not interrupt dragging or playback.

## Offline photo movie flow
1. Import 1–200 photos/videos. Detect orientation, color profile, EXIF without modifying originals. 2. Review order; choose fixed duration or pace `Fast/Balanced/Cinematic` as heuristics, editable per slide. 3. Choose optional user-supplied music and bundled style (cut/dissolve/zoom); optional local beat analysis. 4. Show generated editable storyboard + main timeline; default readable titles. 5. Preview, adjust, export local watermark-free MP4 at 1080p.

## Social versions
User can select 9:16, 16:9, 1:1, 4:5 presets for separate layout variants; standard crop / fit / blur fill / manual keyframe framing offline. Preserve common media and editable layout-specific text positions; alert on layout conflicts. Safe area overlays are local metadata with overridable settings and must not be burned into export.

## Automated polish (not generative AI)
Button in inspector/tools is named `Polish` rather than `AI Director`. Offers six optional operations: text readability, scene timing, music cuts, transition suggestions, crop-safe guides, collision warnings. Each produces `Preview / Apply / Ignore` recommendations with reasons and single undoable batch. Never rearrange locked scenes; explain disabled recommendations.

## Export dialog
Top: canvas, format, resolution, fps, destination and filename. Show `No watermark` fact, never a checkbox that has to be purchased. Optional `Add Made with PixCut outro` switch OFF initially; preview outro and music overlap if enabled. Hide all premium upsells from the export path unless user selected a Pro-only option. Offline error states actionable and nonblocking.

## Localization
English, Polish, Ukrainian initial locales; future German and Spanish. ICU/Fluent or i18next translation keys, pluralization, localized numbers/dates, pseudolocalization tests, font fallback, directionality, user-selectable language requiring no new installer. Video subtitles and editor-language are separate settings.
