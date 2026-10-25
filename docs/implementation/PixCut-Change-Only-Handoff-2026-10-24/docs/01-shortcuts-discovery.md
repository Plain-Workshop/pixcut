# NEW: Keyboard Shortcut Discoverability UX

## Primary objective
A first-time user can discover the six most valuable shortcuts without leaving editing; an experienced user can discover any command using search. No AI, no internet.

## Exposure layers
1. **Tooltips**: hovering an enabled toolbar action (600–900 ms delay) shows `Split clip · Ctrl+B` (or `⌘B`). Also show disabled reason for locked clips / text entry.
2. **Menu item accelerators**: File, Edit, View, Timeline, Clip and Help display the effective user-assigned shortcut, never a hard-coded default.
3. **Help → Keyboard Shortcuts** and clickable `?` icon in editor footer/header open a non-destructive, searchable overlay. Accessible via `?` only when not editing text; `F1` should open Help on platforms where free.
4. **First-run learning**: maximum three inline hints (Space, Split, Undo) during initial editing; dismissible, remembered locally. Never block import or export.
5. **Command palette**: Ctrl/Cmd+K. Search by command label, synonym and localized names; show shortcut on each result.
6. **Context menu**: selection-specific commands show shortcuts: split, duplicate, ripple delete, fade etc.
7. **Timeline overlay mini-help**: optional `Show shortcut hints` toggle, unobtrusive and off after user dismissal.

## Help dialog screen
- Modal/dockable panel: header `Keyboard Shortcuts`; search input; left categories Essential / Timeline / Playback / Editing / View / Export / Custom.
- Right: table with action, shortcut chip, short explanation, optionally context/binding status. Keyboard-focusable results.
- Footer buttons: `Customize Shortcuts`, `Reset Tips`, `Export Reference` (text or printable page), Close.
- Show OS-specific modifier labels, actual binding currently configured and conflict indicator if present.
- Empty state: `No matching shortcuts` with advice to change search.
- Supports scalable UI 100–200%, dark/light modes, keyboard-only use and screen readers.

## Default essential mappings (proposal; subject to collision audit)
| Command ID | Windows/Linux | macOS | Context |
|---|---|---|---|
| playback.toggle | Space | Space | editor, not text input |
| clip.split | Ctrl+B | Cmd+B | timeline selection/playhead |
| history.undo | Ctrl+Z | Cmd+Z | editor |
| history.redo | Ctrl+Shift+Z | Cmd+Shift+Z | editor |
| project.save | Ctrl+S | Cmd+S | app |
| media.import | Ctrl+I | Cmd+I | app |
| export.open | Ctrl+M | Cmd+M | app |
| palette.open | Ctrl+K | Cmd+K | app, except native composition |
| edit.selection_tool | V | V | timeline focused |
| edit.blade_tool | B | B | timeline focused |
| timeline.snapping | N | N | timeline focused |
| timeline.marker | M | M | timeline focused |
| timeline.fit | Shift+Z | Shift+Z | timeline focused |
| timeline.frame_prev/next | Left/Right | Left/Right | timeline focused |
| playback.reverse/stop/forward | J/K/L | J/K/L | editor focused |
| clip.ripple_delete | Shift+Delete | Shift+Delete | timeline selection |
| help.shortcuts | ? | ? | app, not text field |

## Important conflict handling
- `B` selects blade tool; `Ctrl/Cmd+B` splits; both are separate events.
- `K` plays stop in timeline context but **Ctrl/Cmd+K** opens command palette.
- Input fields, subtitles, rename editors, IME composition and dialogs suppress single-letter tool shortcuts.
- Polish, Ukrainian, German, Spanish key layouts, AltGr, dead keys, macOS symbols, and built-in OS shortcuts require testing. `?` must have visible menu alternative.

## Done when
User can locate every active keybinding via at most two interactions: `?` or Help menu; a changed binding is reflected immediately in menus, tooltips, palette and documentation generated in app.
