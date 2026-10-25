# Interface design specifications

## Visual language
Professional dark default (graphite, charcoal), optional light theme, one restrained purple/indigo accent, clear semantic highlight for active clip/selection, consistent layer colors. Typography readable at 13–15 px body, 12px secondary when density requires. Touch targets 32–40px desktop and larger on mobile. Strong keyboard focus ring and reduced motion mode.

## Responsive layouts
At >=1440: rail 64, browser 300, flexible preview, inspector 320, timeline minimum 300. At 1366x768: collapse secondary browser by shortcut, timeline 200–340 adjustable, preview always significant, inspector overlay/collapsible but no loss of playback/timeline. Ultrawide: allow pinning browser/inspector and compare views.

## Main editor states
1. Empty: clear drag/import area and start template tile; timeline appears but empty.
2. Active media: image/video visible with selection bounds, safe guides toggle, inspector contextual.
3. Hovering transition: live temporary preview, obvious 'Preview only' chip; no project mutation.
4. Transition selected: center player plus visible timeline transition badge and properties.
5. Text selected: inline edit in main player, right inspector Text/Animation/Style; purple text track.
6. AI Extend: overlay source vs generated boundaries, compare swipe, variant history strip, regenerate mask brush and explicit Apply.
7. Social Versions: format tabs over player, optional side-by-side, per-format overrides, current active label on timeline.
8. Export: side panel or dialog with preset summary, path, quality, size estimate, license/paid restrictions and preview thumbnail; export jobs run in background.

## Screen-specific contracts
Home: New Video, Quick Create, Import, New from Template, Record, recent projects with autosave status.
Quick Create: Media -> Style -> Music -> Review -> Edit/Export, stage navigation without data loss.
AI Studio: task browser, source/target preview, mask editor, generation options, credits estimate, variations, generation history, apply/revert.
Motion Studio: composition preview, graph and keyframe tracks, property exposer, save component/template.
Bulk Studio: template picker, CSV/JSON mapping, batch sample preview, job progress and retry.

## Motion/transition browser
Cards show short looping representative animation only when hovered/selected or visible (avoid many autoplay decoders); keyboard focus also previews. Two ways to apply: double-click with current clip selected, drag-drop onto exact clip boundary or object. Right click 'favorites/add to recent'. Toolbar search across installed and downloadable packs; mark Pro only when locked.

## Timeline colors and semantics
Video blue, photos teal-blue, text purple, overlays orange, captions lavender, audio green, transitions neutral accent with double-arrow glyph. Do not communicate meaning only by color; retain icons/names. Selected object high contrast; playhead high contrast; grouped/locked track status indicated by icon.

## Microinteractions
Tooltip on hover with shortcut; inspector changes without jumping scroll unnecessarily; direct resize shows snap lines; undo toast nonblocking; AI jobs show persistent queue status not blocking editor; Pro preview explains restriction before export, never on unrelated actions.
