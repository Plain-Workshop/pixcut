# CHANGED: Everyday Inspector and Fast Editing Controls

## Goal
After selecting a clip, reach Color, Speed, Fades, or Filters in **one click** within the right inspector; most edits within two interactions. No AI prompts for standard operations.

## Fixed main app layout
- Left: Media, Text, Elements, Transitions, Effects, Audio, Templates; no prominent AI item.
- Middle: large video viewer with direct manipulation of text and transform handles.
- Right: contextual clip inspector with tabs `Video | Color | Speed | Fade | Filters`; for audio: `Audio | Fade | EQ | Effects`; for text: `Text | Style | Animation | Layout`.
- Bottom: resizable multitrack timeline with video, overlay, text, captions and audio tracks; remember sizing per workspace.

## Color tab
Basic: brightness, contrast, exposure, highlights, shadows, saturation, temperature, tint; `Reset` and copy/paste properties. Advanced accordion: curves, HSL, LUT. Sliders + exact numeric entry, live non-destructive preview.

## Speed tab
Presets .5×, 1×, 1.5×, 2×; custom 0.25–4× initially (engine may support more later), maintain audio pitch toggle, reverse (where implementation supported), optional speed curve in Advanced. Changing speed obeys chosen ripple/freeform mode, with duration preview before commit.

## Fade tab
Separate fade-in/out durations for **video opacity** and audio where applicable. Visible draggable handles on both ends of clips with clear, accurate tooltip `Fade in 0.5 s`; numeric inspector entry. Disallow duration larger than clip length and show reason.

## Filters tab
Searchable image thumbnail presets; hover live preview; click applies; intensity 0–100%; Original/None always first; avoid changing destructive source media.

## Fast timeline behaviors
- Drag edge trims; optional snapping guides to playhead, boundaries, markers.
- Alt/Option+drag duplicates selection; Shift-click ranges; drag volume line on audio clips.
- One right-click context menu for Split, Delete, Ripple Delete, Speed, Fade, Copy/Paste Attributes, Lock, Group.
- `Space` play/pause; `J/K/L` playback; `Ctrl/Cmd+B` split; `V` select; `B` blade when timeline focused.
- Multi-select inspector supports setting same duration, fade, filters or color values on many clips.
- All mutations undoable, saved in project with explicit schema version; no network dependencies.

## Visual reference
See `visuals/01-full-app-and-website-design-board.png` and `02-editor-shortcuts-and-site-board.png`. Concept art is not an exact technical spec; use written behavior as authority.

## Acceptance
Selected photo clip -> Color tab -> brightness change -> preview and undo -> saved/reopened project retains edit. Selected audio -> Fade tab. Text input focus prevents B and V activation. Export has no watermark by default.
