# Responsive timeline and media preview

## Functional contract
Represent rational timebase (num/den) and integer media ticks/frames; never use floating-point seconds as authoritative clip boundaries. Support variable frame rate input by mapping source timestamps into a fixed rational project timeline. Keep audio sample timestamps and timebase conversion explicit. Clip source in/out, speed remapping, timeline start, track order, transforms and effects must serialize deterministically.

## Editing essentials
- Multi-track timeline with video/photo, text, caption, graphics and audio; reorder tracks; lock, hide, mute, solo.
- Trim, split, ripple, roll, slip, slide, insert, overwrite; snapping to clip edges, markers and beat grid; gap controls; magnetic mode optional with explicit track behavior.
- Group/un-group, compound clips, nested sequences (not foundation), adjustment layers, clip speed/reverse/freeze, transition overlap handles.
- Clip handles display entrance/exit animation and transitions distinctly; selecting badges goes to corresponding inspector.
- Click clip shows bounding box in main player; moving preview element changes timeline object transform. Multi-selection creates alignment/distribution actions.
- Player resolution independent of export resolution; show downscaled preview indicator; proxies optionally pre-generated based on disk/GPU budget.

## Rendering stack
Use MLT as leading candidate for prototype, GStreamer Editing Services as comparison; establish `MediaEngine` abstraction in Rust with open_project, seek, play, pause, render_frame, export, cancel, capabilities, diagnostics. Keep engine process isolated and restartable where feasible. Test feasibility of getting frame buffers or GPU surfaces into Tauri WebView without expensive copies. Prototype native child surface vs controlled frame delivery; no assumed zero-copy across OS. Do not run full video through JS event bridge.

## React performance
Virtualize timeline items by visible time range and track index. Draw filmstrips, waveforms, selection and drag previews with Canvas/OffscreenCanvas where supported; React handles toolbar/sidebar state. Coalesce user drags in UI then send committed commands to Rust; command acknowledgement reconciles authoritative state. Avoid per-frame React state updates. Separate playback clock from editing history. Cache keyframes, thumbnails and waveforms by source hash + render settings.

## Export parity
Deterministic effect parameter evaluation from shared project graph; golden-frame snapshots at sampled timestamps; compare preview to rendered output within defined color tolerances. Use separate audio-video sync drift metric. Retain intermediates until final file rename success. On crash, resume safe operations when possible, otherwise restart with preserved job config.

## Performance test scenes
1. 30-minute H.264 talking head + stereo audio + subtitle track.
2. 4K H.265 source -> 9:16 crop + tracking + 4 text overlays.
3. 30 photos + transitions + Ken Burns animations + music.
4. 4 simultaneous 1080p streams + effects + transparent overlay.
5. Hundreds of short cuts + 1,000 subtitle words.
Measure cold startup, scrubbing p50/p95, playback drops, CPU/GPU/RAM, thumbnail latency, export throughput and crash recovery on integrated GPU, discrete GPU, macOS Apple Silicon, Windows, Linux X11 and Wayland.

## Proposed initial targets (aspirational)
Basic idle <=300MB on a representative machine, UI update under 16ms at 60Hz for drag in moderate projects, source-accurate still-frame seeking within 250ms warm at 1080p, no lost user edit after crash beyond last autosave-journal write. Tune through benchmarks and publish hardware test profiles; never promise universal performance.


## Auto Polish integration
`14-AUTO-POLISH.md` defines ephemeral ghost edits, timeline cut/transition deltas, scene-local anchoring, locked segments, and an atomic single-transaction apply/undo flow. Never change timing in the preview without rendering candidate project graph.
