# Implementation architecture — Tauri 2 / React / Rust

## Packages and responsibilities
```
/desktop/src-tauri          Tauri shell, updater, native integrations, security permissions
/desktop/src                React + TS, layout, controls, Canvas timeline, accessibility
/desktop/crates/project     Rust canonical project state and scene graph
/desktop/crates/timeline    typed editing commands, validation, undo/redo journal, timing
/desktop/crates/media       MediaEngine trait, capability negotiation, asset store
/desktop/crates/render      previews, caches, proxies, audio mix, exports
/desktop/crates/effects     effect definitions and GPU/CPU implementations
/desktop/crates/audio       audio graph, mixing, and waveform data
/desktop/crates/templates   bundled template catalog and instantiation
/desktop/crates/ai-optional optional local/remote AI integrations
/desktop/assets             brand assets and bundled sample media
/desktop/tests              frontend, golden-media, and project-model tests
/docs                       specifications, API and developer guides
```

## Data flow
React command -> validated Tauri command -> Rust EditSession/command journal -> updated project model -> notification/diff to React -> renderer revision -> preview request -> native media worker -> optimized preview frame/surface. Renderer is never authoritative for project data. Drag actions can use optimistic UI but must reconcile. AI result writes a new asset, creates variant reference command; export consumes immutable project snapshot. Sidecar process crashed? retain project, recover worker and re-seek.

## Media stack choice
First compare MLT and GES against the same edit fixture and Tauri preview integration. MLT has timeline, keyframes, effect ecosystem and cross-platform support; GES has Rust bindings and editing pipelines. Use FFmpeg for diagnostics and tasks only with license-vetted configuration. wgpu may be introduced for custom compositor/effects only when preview/export parity is practical. Do not combine two full timeline engines in production without justified need.

## Native surface research
Option A decoded frames forwarded through shared memory to a WebGL/WebGPU canvas; Option B native child window/surface tied to Tauri window; Option C optimized frame transport with bounded queues. Benchmark copy costs, resizing, HiDPI, capture, Wayland/X11, minimized and hidden windows, transparency/overlays, z-order, occlusion and color correctness. Avoid direct per-frame JS invoke IPC.

## Offline-first persistence
Project JSON schema with atomic writes + append-only command journal for crash recovery. SQLite for project and asset index, render cache metadata, AI job queue, entitlement cache, recent files. Store large assets and proxy/render cache as files outside DB. Content address dedup only for opt-in imported/generation assets; user keeps control of originals and cleanup.

## Concurrency
Separate bounded decode/render/encode/AI queues. Prioritize preview over thumbnail jobs and background export; cap worker CPU/GPU/RAM use; pause low-priority jobs while scrubbing if needed. Dedicated IO workers for import/hash and thumbnail generation. Explicit cancellation and job progress.

## Security
Tauri capabilities least privilege; no arbitrary shell execution from webview. Localhost servers require authentication and origin checks. AI provider credentials in OS secure store; plugin processes restricted filesystem/API grants, signatures/checksums for downloads, prompt inputs and user data treated as untrusted. Cloud upload consent, crash report opt-in.

## Build, release
CI matrix Windows x64 (ARM64 later), macOS arm64/x64, Linux x64 X11/Wayland. Codesign/notarize, updater signature, SBOM, dependency license manifests, deterministic builds where feasible, installer and bundle size monitoring, GPU fallback smoke tests. Native media libraries need platform packaging and code signing research.


## Auto Polish analysis services
Add `analysis-core`, `visual-analysis`, `audio-analysis`, `layout-optimizer`, `pacing-optimizer`, `transition-ranker`, `auto-polish` crates (see `14-AUTO-POLISH.md`). Results must be revision-bound proposals, not mutations; use the canonical edit journal for atomic apply. Workers operate offline by default with bounded memory and cancellation.
