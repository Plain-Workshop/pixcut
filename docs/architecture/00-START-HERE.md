# PixCut — Unified product blueprint (2026-10-24)

**Status:** design specification, not shipped. **Name:** PixCut (subject to domain/trademark clearance). **Platform:** Windows, macOS, Linux; mobile later. **Client:** Tauri 2 + React/TypeScript + Rust. **Business:** genuine Free, optional Pro, separate optional cloud AI credits.

## Product promise — highest priority; supersedes reference documents
1. PixCut is an excellent **offline-first, manual video editor**. No account, AI, server, or network is required to install from a previously obtained installer, edit, preview, or export standard Free videos.
2. **No PixCut watermark/logo on any Free or Pro export.** No ending slate, promotional badge, forced attribution or hidden branding. An *optional* 1–2-second `Made with PixCut` outro is **OFF by default**, independently toggleable in exports and templates, can be removed freely, and never silently reenabled.
3. Home has exactly three primary entries: **New Video**, **Photo Movie**, **Templates**, plus recent projects. No AI-first prompts or forced registration.
4. Main editor permanently presents the **preview and timeline together**. Library left; contextual inspector right; resizable timeline below. Text/overlay editing is direct in preview, timing in timeline.
5. AI is optional, contextual, off by default, and never uploads user media absent informed consent. Native/non-generative tools and presets always have offline fallbacks.
6. Automatic quality checks, transitions, animations, audio/music beat detection, manual social crop, simple slideshow, subtitles imported or manually authored, and 1080p standard export are available in Free.
7. Updates do not interrupt editing, recordings, exports or active rendering jobs. Never require login for Free updates.
8. Free and Pro share the binary. Pro unlocked by signed local entitlement; server is authoritative for purchases and activations. Current Pro access survives offline within a clearly disclosed licensing policy.

## Package organization
- `01-USER-EXPERIENCE.md`: all navigation, workflows and UI states.
- `02-FEATURE-MATRIX.md`: complete Free/Pro and optional AI feature map.
- `03-ENGINE-AND-DATA.md`: native Rust boundary, media engine, project schemas.
- `04-WATERMARK-AND-EXPORT.md`: export policy and optional outro acceptance.
- `05-UPDATER.md`: Windows/macOS/Linux updater and rollback.
- `06-LOCAL-AI-AND-PRIVACY.md`: local/remote integration and consent.
- `07-WEBSITE-LICENSING.md`: Astro/Axum account, billing, licensing services.
- `08-RELEASE-PLAN-AND-TESTS.md`: phases, acceptance, agent backlog.
- `mockups/`: newly generated PixCut screen concepts, not executable UI nor pixel-perfect designs.
- `reference/`: older, detailed technical documents. **Where conflicting, documents in this folder do not override the current PixCut decisions.**

## Agent handoff
Build in numbered order, instrument reproducible timings and pixel/audio validation, ship small vertical slices. Protect local-first guarantees in automated tests. Record licensing/codec/dependency due diligence and avoid unverified claims of legal or domain clearance.
