# PixCut — CHANGE-ONLY Implementation Handoff (24 October 2026)

## Scope
This archive contains **ONLY NEW/CHANGED requirements** requested after the previous PixCut plan. Do not replace the original product plan. Apply these documents as an **addendum** to that plan. Where the previous plan conflicts with this delta, this delta wins. Existing decisions not mentioned here remain unchanged.

## What changes now
1. Introduce a discoverable keyboard shortcut help overlay, tooltips, shortcut editor, presets, import/export and conflict detection.
2. Introduce local, searchable command palette, shortcut display in menus and contextual hints; **AI is not involved**.
3. Refine editor to expose **Color, Speed, Fade and Filters** in at most two interactions after selecting a clip.
4. Website visual direction: **Vidit-inspired presentation** with accurate large app screenshots, feature detail sections, downloadable offline editor; do not copy anyone else's graphics/layout verbatim.
5. Pin official PixCut brand assets and eliminate agent-generated replacement logos.
6. Visual references and implementation acceptance checklist covering home/editor/photo movie/template/export/shortcut help/settings/website.

## Required reading order
`01-shortcuts-discovery.md` → `02-shortcut-editor-and-engine.md` → `03-editor-controls-and-timeline.md` → `04-screen-by-screen-design.md` → `05-website-delta.md` → `06-brand-asset-policy.md` → `07-acceptance-tests.md`.

## Deliverables to implement
- Keyboard Shortcuts Help dialog and Settings → Shortcuts.
- Command Palette; key hints in menus and tooltips.
- Clip inspector tabs; timeline direct manipulation.
- Website update according to new design system.
- Use delivered brand SVGs and PNGs as a fixed baseline.

## Visual files
`visuals/01-full-app-and-website-design-board.png` and `visuals/02-editor-shortcuts-and-site-board.png` are inspiration sheets created for this handoff. **They are conceptual, not pixel-perfect production source files.** Some tiny labels may be imperfect. Interpret via the written specification; do not copy unreadable/erroneous text. `visuals/03-previous-home-editor-board.png` and `visuals/04-previous-feature-board.png` provide additional screen references.

`brand/pixcut-symbol.svg` and `brand/pixcut-wordmark.svg` are the **canonical editable vector draft assets for implementation until the user approves a different logo**. They are original vector source, not raster tracing from a reference image. Do not invent a new logo. The visual identity still requires trademark/domain clearance before public release.

## Non-negotiables carried forward
Free exports no watermark. Optional Made with PixCut outro off by default. No forced account or internet for normal editing. AI optional and discreet. Project save/restore; one-click updater; Tauri 2 / React / TypeScript / Rust.

## For coding agents
Begin with repository inventory and report what exists. Make changes incrementally. Do not silently rename brands, adjust pricing, implement paid AI, swap iconography or introduce login. Provide before/after screenshot evidence and keyboard navigation tests. Never rely solely on AI-generated collage as final specification.
