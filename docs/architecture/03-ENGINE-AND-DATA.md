# Technical architecture and project data

## Stack
Tauri 2 shell; React/TypeScript UI; Rust project core + native media workers; MLT media engine first prototype, GStreamer Editing Services alternative; FFmpeg for decoding/encoding in compliant build; optionally wgpu compositor after measurable need; SQLite cache/assets and versioned project manifest. Platform-specific preview integration must be tested before product commitment.

## Ownership
React is view-only for high-level state; high-frequency timeline paints on virtualized canvas; editing Rust core is authoritative. `EditorCommand` enum with `TrimClip`, `SplitClip`, `MoveClip`, `SetText`, `SetTransform`, `SetAnimation`, `SetTransition`, `SetCrop`, `SetAudioGain`, `SetOutro`, `CreateVariant`, `AcceptPolishBatch`; command history ensures undo/redo. Never directly mutate user source media. Background workers produce thumbnails/waveforms/proxies with limits and cancellation.

## Preview and renderer
Single playhead time source (rational frame/tick timestamps); avoid JS frame-by-frame IPC. Audio clock drives playback. Native preview path should avoid full-frame CPU transfers where feasible; measure WebView2/WebKit/WebKitGTK behavior. Pixel-diff golden renders for transformations and typography; audio/video sync tests for variable framerates. Separate renderer process with crash recovery where practical.

## Minimal project records
`Project {schema_version, id, name, canvas, source_media[], timeline, social_variants[], policy, snapshot_refs[]}`; `Timeline {tracks[], segments[], transitions[], markers[], source_audio}`; `TextLayer {content, font_fallback, rect_normalized, style, animations[], lock}`; `ProjectPolicy { watermark:false, pixcut_outro:false, privacy:'local' }`. Model output is stored as separate managed derivative asset with prompt/provider/consent metadata where applicable.

## Data safety
Atomic saves, journal, crash restoration, asset relinking, forward-only schema migration + pre-migration snapshot, filesystem permission prompts scoped to chosen folders, no assumptions about mobile/native interoperability. Never include private source videos in logs or diagnostics by default.

## Performance acceptance targets (subject to measurement)
First run usable offline; editor opens 100-image slideshow without hangs, audio and title playback preview remains usable, 1080p normal timeline plays smoothly on documented minimum hardware. Track cold startup/RSS/scrub p95/perceived latency/export RTF separately by OS. Don't promise a fixed installer size until packaging tests. Optional AI model weights never shipped in base installer.
