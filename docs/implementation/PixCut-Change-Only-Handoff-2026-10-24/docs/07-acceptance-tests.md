# NEW: Acceptance Criteria & Engineering Task List

## Priority P0 — discoverability
- [ ] Centralized command registry with unique stable IDs, contexts, enabled predicates.
- [ ] Shortcut tooltip strings reflect actual platform/profile/user bindings.
- [ ] Help → Keyboard Shortcuts opens indexed searchable help overlay; `?` opens it when safe.
- [ ] Ctrl/Cmd+K command palette functions without AI or internet.
- [ ] Shortcuts Ctrl/Cmd+B split, Space play, undo/redo/save/import/export work end-to-end.
- [ ] No shortcut activates tools while typing titles, subtitles, file names, input or IME.

## Priority P0 — visual and branding
- [ ] Implement BrandLogo reusable component from `brand/pixcut-symbol.svg` / wordmark.
- [ ] Replace stray bad icon references across native app, website, About, installer config and update UI.
- [ ] Screen APP-02 exposes Video/Color/Speed/Fade/Filters as contextual inspector tabs.
- [ ] Export explicitly confirms no watermark; optional PixCut outro disabled by default.
- [ ] Website hero shows product rather than generic AI; `Download Free` above fold.

## Priority P1 — customization
- [ ] Settings → Shortcuts: searchable bindings, remap, conflicts, reset per-command/all.
- [ ] Local versioned JSON migration, import/export validation, OS/layout handling.
- [ ] Built-in profiles PixCut Default and best-effort Premiere/Resolve mappings.
- [ ] Menu/context menu/help/palette all update immediately when binding changed.
- [ ] Provide generated printable shortcut reference (from registry, not hard-coded).

## Priority P1 — detailed editing ergonomics
- [ ] Color brightness/contrast/temperature changes non-destructively.
- [ ] Speed preset 0.5/1/1.5/2, custom entry, pitch retention semantics.
- [ ] Opacity and audio fade handles + exact time inputs.
- [ ] Filter thumbnails with hover preview and intensity.
- [ ] Multi-selection property edits and copy/paste attributes undo atomically.

## Automated tests
Unit: resolver precedence, collisions, validation, serialization migrations, command enablement, localization. UI: keyboard-only shortcut editor, screen reader labels, pointer tooltips, mobile marketing nav. Integration: split via hotkey equals split via menu, opens persisted project after app restart, offline Free export has no watermark, settings remain local.

## Demo video requirement
Record 60–90 second screencast: import 3 media items → split with shortcut → open help → remap split → verify tooltip changed → adjust colors/speed/fade → export without watermark. Show website hero + feature screenshots and the consistent native app icon.

## PR evidence
Screenshots of APP-02, APP-08, APP-09, APP-10, APP-11 and homepage at desktop/mobile; report platform tests on Windows/macOS/Linux, keyboard layout notes; tests that fail or features incomplete must be reported not hidden.

## DO NOT IMPLEMENT in this delta
Do not rebuild AI modules, rewrite licensing, rename project, change Free/Pro entitlement policy, add online dependency or copy Behance designs.
