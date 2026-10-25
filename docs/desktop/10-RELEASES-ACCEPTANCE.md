# Releases, dependencies and acceptance gates

## Phase 0 — Research spikes (4–8 weeks, estimate only)
- Benchmark MLT vs GES across Win/macOS/Linux, license audit, two native preview transport approaches.
- Select rendering path on measured seek latency, dropped frames, parity, packaging.
- Prototype timeline schema/timebase/undo with 1000 cuts and 4K proxies.
**Gate:** preview can scrub, seek and export same content on all target OS with clear performance baseline and reproducible builds.

## Phase 1 — Free usable editor (3–5 months estimate)
- Home, import, media index, main layout, timeline editing, photo/video/text/audio tracks, transparent overlays, keyframe basics, transitions, standard social profiles, Fit/Crop, save/reopen, autosave recovery, 1080p export.
- Inline text editing, draggable UI, search preset gallery, profile guides, undo/redo, accessibility keyboard baseline.
**Gate:** 15-minute realistic social video edit completed from import to export on all platforms; test project recovery; no original mutation; editing from laptop resolution.

## Phase 2 — Creator toolkit / early Pro (3–5 months estimate)
- Caption ASR + transcript correction, linked social variants, thumbnail studio, image AI extend/regenerate providers, branded text/overlay templates, motion graphics basics, Pro billing/entitlements, 4K export and batch profile exports.
**Gate:** a landscape tutorial successfully produces distinct 9:16/16:9 versions, caption timings preserved, AI accept/undo, Pro downgrade does not lock assets.

## Phase 3 — Workflow acceleration (3–6 months estimate)
- Long-form to Shorts suggestions, text-based cuts, motion/keyframe graph, reusable pack authoring, bulk video generation, modular model-manager/providers, safe third-party declarative plugins. Add reliability/performance hardening.
**Gate:** 100-item bulk template batch resumable; local/custom AI connection validated; plugins cannot access unapproved files/network.

## Phase 4 — Advanced R&D / later launch
- Video spatial outpainting and temporal regeneration, motion tracking for protected subjects, sophisticated multi-camera, remote render, richer plugin SDK and collaboration as market signals warrant.
**Gate:** flicker/continuity and temporal QA met with documented limitations; per-clip cost estimate; fallback to safe adaptation methods. No promise of universal suitability.

## Cross-phase quality gates
Compatibility test Win 11 macOS arm64/x86_64 and modern Linux X11/Wayland, code-signing, memory regression, asset relink, autosave after forced kill, HDR/SDR and color consistency, security fuzzing media imports, quote/locale text, upgrades and rollback, offline licensing. Visual regression for UI and golden media render fixtures. Benchmarks run on weak/strong hardware; package size monitored but not artificially set before codec analysis.

## Risks / mitigations
1. Webview preview texture transfer -> early experiment; alternative native surface or switch renderer presentation technology without project rewrite.
2. GPL/codec exposure -> license audit and reproducible dependency configuration before paid beta.
3. Video AI flicker/cost -> stage as short experimental feature, disclose limits and allow reversion.
4. Scope creep -> per-phase gates, users can accomplish core workflow without AI.
5. Paid gating resentment -> strong watermark-free Free tier, predictable entitlements and portable projects.
6. Device and source variance -> codec fallback, proxies, tested GPU/software compatibility matrix.


## Auto Polish release gates
Phase 1: prototype readability/collision checks with preview/accept/undo for selected scenes, basic timing/beat guides, safe-area overlays. Phase 2: end-to-end Auto Polish proposal review, offline basic suite, transition/crop suggestions and Pro whole-project batch. Phase 3: rich optimization variants, advanced temporal tracking and bulk integration. Acceptance suite in `14-AUTO-POLISH.md` is mandatory at each relevant gate.
