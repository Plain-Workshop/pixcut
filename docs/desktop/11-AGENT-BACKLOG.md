# Ordered developer-agent tasks

**Do not implement everything in one sprint.** Each item requires tests, docs and runnable demo. Explicitly log decisions and measured outcomes. All code must remain inside a single versioned mono-repository.

## Sprint 0: foundations
- [ ] Create repo with `desktop/`, `web/`, `docs/`, `design/`, `scripts/`, `tests/`; pin toolchains using lockfiles, Rust toolchain file, CI matrix.
- [ ] Build Tauri 2 + React starter, typed Rust commands, TS shared contracts, keyboard focus and base theme.
- [ ] Implement model experiment for rational timebase, project schema migrations, asset hashes and command journal.
- [ ] Build two media engine adapter spikes MLT and GES; collect CPU/GPU/RAM seek/render/export benchmark results across platforms.
- [ ] Prototype preview transport without per-frame JS IPC; document native surface constraints and fallback.
- [ ] Audit licenses/codec packages and generate SBOM; prohibit dependency with uncertain commercial rights until reviewed.

## Sprint 1: editor canvas and timeline
- [ ] Create resizable desktop layout and persistent preview / timeline.
- [ ] Build virtualized Canvas timeline with track labels, zoom, scrub, snapping, drag/trim/split.
- [ ] Add Rust authoritative project operations, undo/redo and autosave/recovery.
- [ ] Add thumbnail/waveform/proxy background workers; video/image/audio file import.
- [ ] Add timebase-correct seek and playback, background render job, 1080p export.

## Sprint 2: social editing fundamentals
- [ ] Create direct-manipulation bounding boxes for images/text/overlays.
- [ ] Add text browser and inspector, templates, local fonts, inline edits and animated title presets.
- [ ] Implement transition browser with hover-preview, boundary drag/apply, duration inspector and handles.
- [ ] Implement In/Loop/Out animations, keyframe lanes and basic easing curves.
- [ ] Add layout profiles 16:9, 9:16, 4:5, 1:1; fit/blur/smart crop baseline; safe-area guides.

## Sprint 3: AI and creator workflows
- [ ] Build provider capability manifest, queue, consent and cost estimation workflow.
- [ ] Add local ASR interface, captions and transcript editor; import/export subtitle tracks.
- [ ] Add generative image outpaint/regenerate panel, mask editor, versions/history and user-confirmed apply.
- [ ] Add thumbnail studio with editable title/graphics separate from AI background asset.
- [ ] Add linked social variants with base inheritance and override/reset UI.
- [ ] Implement secure Pro entitlement check and purchase flow; verify downgrade UX.

## Sprint 4: automation and advanced tools
- [ ] Long-video candidate Shorts from transcript with preview/approval and normal editable project output.
- [ ] Motion Studio keyframe graph, reusable composition templates and manifests.
- [ ] Bulk CSV/JSON video generation, preview validation, queue/retries and result report.
- [ ] Third-party safe declarative plugin manifests and model provider adapters; permission UI.
- [ ] Experimental video outpainting short-clip prototype with temporal consistency fixtures and fallback.

## Definition of done for every checkbox
Working user flow, deterministic save/reopen, undo/redo, error and loading states, profiling evidence, cross-OS smoke tests, automated unit/integration tests, documented license/entitlement policy, accessible labels/keyboard paths, published demo artifact and update to CHANGELOG/spec. Unsupported media must fail clearly without corrupting project.


## Auto Polish feature epic (see `14-AUTO-POLISH.md`)
- [ ] AP-00 fixtures and capability/licensing research; AP-01 snapshot and async analysis model.
- [ ] AP-02 readability and collisions; AP-03 scene duration, beats and reading minima.
- [ ] AP-04 transition/crop recommendations; AP-05 review, ghost preview, conflict solver, atomic transaction.
- [ ] AP-06 Pro batch and branded policies; AP-07 cross-OS quality, performance, privacy and downgrade acceptance.
