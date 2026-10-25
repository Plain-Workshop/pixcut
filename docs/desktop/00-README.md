# Social Video Studio — Implementation Blueprint

**Status:** product/engineering specification (not implemented). **Platforms:** Windows, macOS, Linux. **Stack:** Tauri 2, React, TypeScript, Rust. **Business:** free core + inexpensive Pro + metered hosted AI credits. **Date:** 2026-10-24.

## Vision and non-negotiables
A responsive, offline-first, non-destructive video editor optimized for TikTok, Instagram Reels, YouTube Shorts, traditional YouTube and social marketing. Be as approachable as iMovie, offer creator-centric CapCut-like tools, and keep the main preview and timeline visible at once.

- Genuine free edition, unlimited local projects, watermark-free standard exports.
- One shared application / project format for Quick Create, Editor, AI Studio, Motion Studio, Social Versions, Bulk Studio.
- Every AI result is a reversible, versioned generated media asset; preserve the original by default.
- Standard social exports need no sign-in; cloud AI requires explicit consent and estimate.
- Feature gating belongs in Rust core/export/worker layers; the UI merely reflects entitlements.
- Avoid shipping AI models in base installation. Benchmark target application size and startup, don't guarantee without tests.
- Local custom models and plugins must be sandboxed as feasible, opt-in, and clearly marked third-party.

## Read order
1. `01-PRODUCT-UX.md` interaction contract, IA, accessibility.
2. `02-EDITOR-TIMELINE.md` frame-accurate editing operations, render preview, overlays.
3. `03-TEXT-CAPTIONS-MOTION.md` typography, caption generation and motion.
4. `04-SOCIAL-VERSIONS.md` social layout conversion and linked variants.
5. `05-AI-GENERATION.md` generation, outpainting, regeneration, costs and provenance.
6. `06-CONTENT-AUTOMATION.md` Shorts, thumbnail, template and bulk creation.
7. `07-ARCHITECTURE.md` module ownership and contracts.
8. `08-DATA-MODEL-APIS.md` schemas and command operations.
9. `09-PRICING-LICENSING.md` commercial/free and dependency checks.
10. `10-RELEASES-ACCEPTANCE.md` milestones, testing and release gates.
11. `11-AGENT-BACKLOG.md` executable task order and definitions of done.
12. `12-DESIGN-SYSTEM.md` screen architecture and layout guidance.
13. `13-REFERENCES.md` official technical sources and due-diligence notes.

## Scope rule
All user-selected capabilities are included, but not all are Release 1. Video outpainting and arbitrary code plugins are explicitly R&D/late-stage because of motion consistency and security challenges. No high-cost AI action should run automatically.

## Delivery rubric
Each shipped feature needs: UX entry point, keyboard/accessibility behavior, undo/redo semantics, saved project representation, renderer equivalence tests, graceful errors, Free/Pro entitlement policy, and telemetry only with user permission.


14. `14-AUTO-POLISH.md` project-wide explainable Auto Polish: legibility, durations, beat cuts, transitions, social framing, caption collisions, acceptance and Rust service contracts.
