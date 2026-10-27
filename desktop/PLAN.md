# PixCut build plan — the remaining backlog

This plan covers the features still listed as future work in `README.md` and
`VERIFICATION.md`. It is ordered by user value per unit of risk: every slice is
independently shippable, keeps preview and export in step, and lands with tests
and a verification note. Nothing here adds an account, network call, paid tier,
watermark or telemetry.

Status legend: **shipped** · **partial** · **planned** · **deferred**

`*` QSV, AMF and VAAPI argument paths are covered by unit tests; no Intel or AMD GPU was available here, so they are unverified on hardware. VideoToolbox is verified on Apple Silicon.

| # | Feature | Status | Schema |
|---|---------|--------|--------|
| 1 | Video-to-video transitions | shipped | no |
| 2 | Cross-scene (project-level) text | shipped | no |
| 3 | Speed ramps and reverse | shipped | no |
| 4 | Audio EQ and voiceover | shipped | no |
| 5 | QSV / AMF / VAAPI hardware encoders | shipped* | no |
| 6 | Multi-track and picture-in-picture | shipped (one overlay track) | no |
| 7 | i18n: translatable interface | shipped (shell) | no |
| 8 | One asset store and a SQLite index | planned | no |
| 9 | Font subsetting for large faces | planned | no |
| 10 | Signed and notarised releases | deferred | no |

## Ground rules

- The project model is the contract. `desktop/src/stores/model.ts` and
  `desktop/crates/project/src/lib.rs` change together, old versions keep
  loading, and both directions get tests.
- A transition or effect is only done when the canvas preview and the FFmpeg
  output agree. Timing math is shared rather than duplicated.
- New work stays inside `guard()` on the Rust side and returns an actionable
  message, never a panic.
- Each slice ends with `npm run ci`, a rebuilt debug bundle, and a short entry
  in `VERIFICATION.md`.

---

## 1. Video-to-video transitions

**Why it is missing.** Photo scenes bake the transition into the outgoing
clip's tail as frames. Video scenes are handed to FFmpeg as one source, so the
bake path was skipped, and the UI fell back to a hard cut whenever the next
scene was a video.

**Approach.** Keep the timeline model exactly as it is (a transition lives in
the outgoing clip's last *n* seconds and the total duration does not change).

1. Extend `drawTransition` to accept an optional decoded frame for each side, so
   a video can be blended from its real frames rather than its poster.
2. In the export planner, split a video scene that has an outgoing transition:
   - the moving part becomes a `video` segment trimmed to
     `duration - transition`;
   - the transition window becomes per-frame `image` segments rendered with
     `drawTransition`, using a seeked hidden `<video>` for the outgoing clip and
     the incoming clip's first frame (a seeked video or the photo itself);
   - the clip's own audio keeps playing through the transition via an
     `audioDurationTicks` hint, so the crossfade does not cut the sound.
3. Remove the `next.mediaKind !== 'video'` restriction for the incoming side;
   photo → video already works because the incoming poster is its first frame.
4. Preview uses the same frame-aware `drawTransition`.

**Tests.** Planner unit tests for the split and total duration; an ignored
FFmpeg test that renders a 1 s video → 1 s photo crossfade and checks the
output duration, frame count and that both sources appear. Browser check on a
project with two video clips and a fade.

**Boundary.** A transition longer than the outgoing clip is clamped (existing
validation). Reverse playback stays unsupported for video preview.

---

## 2. Cross-scene text

**Why it is missing.** Text lives on a scene and is split with it.

**Approach.** Add an optional project-level `globalText: TextLayer[]`. Times are
absolute project ticks. It renders above scene text and below elements in the
preview, stills and export, and gets its own compact timeline row.

- Model: validate like scene layers, cap at 40, unique ids, clamp to the
  project duration, keep v14 files valid with the field absent.
- Renderer: a shared `drawProjectText(ctx, layers, projectSeconds)` used by
  `drawScene`-adjacent paths (`drawProjectOverlays`, `drawOverlayStack`, baked
  export frames, thumbnails).
- Timeline/UI: add/select/edit/delete, plus a Text-panel section. Reuses the
  existing `TextLayerControls`.
- Export: photo segments already bake project overlays; video segment overlay
  frames include project text too.

**Tests.** Model validation and migration, layer timing at scene boundaries,
renderer smoke test, browser add → scrub → export-still check.

---

## 3. Speed ramps and reverse

**Why it is missing.** Only one playback rate exists (`playbackRate`,
`setpts`, `atempo`).

**Approach.**

- Add `speedStart` / `speedEnd` (0.25–4) and `reverse` to the scene.
- Keep a shared curve helper: speed(t) is linear in time for a ramp; the
  integral gives the source offset. Preview drives the video element from the
  same helper; export builds an FFmpeg `setpts` expression from it and chains
  `atempo` per ramp segment.
- Reverse: export uses `reverse` + `areverse` (documented memory cost, capped
  to 30 s clips); preview shows reverse by stepping the hidden video backwards
  on a frame timer instead of `playbackRate`, so what you see is what is
  encoded.

**Tests.** Curve/integral unit tests, `atempo_chain` range tests, an ignored
FFmpeg test for a 2× ramp and a reversed 1 s clip (frame order checked).

---

## 4. Audio EQ and voiceover

**Why it is missing.** Preview audio is a bare `<audio>.volume`; there is no
Web Audio graph.

**Approach.**

- Per music clip and per video clip: three-band EQ (low 120 Hz, mid 1 kHz,
  high 6 kHz, ±12 dB) stored in the model.
- Preview: one lazily created `AudioContext` per playing clip with three
  `BiquadFilterNode`s and a gain node; falls back to plain volume when Web Audio
  is unavailable.
- Export: matching `equalizer` filters in the FFmpeg audio chain.
- Voiceover: a Record button in the Audio panel uses `MediaRecorder` on the
  microphone, stores the take as a local audio asset, and inserts it at the
  playhead. Nothing leaves the machine; permission denial is an actionable
  message.

**Tests.** Model ranges, EQ filter chain strings, a fake-MediaRecorder unit
test, browser check of the EQ curve, and a manual voiceover smoke test.

---

## 5. QSV / AMF / VAAPI hardware encoders

**Why it is missing.** Only VideoToolbox and NVENC shipped, and there is no
Intel/AMD hardware here to verify the rest.

**Approach.** Add `h264_qsv`, `h264_amf` and `h264_vaapi` alongside the current
encoders, availability-gated by `ffmpeg -encoders` plus the platform. VAAPI
uses a `-vaapi_device` + `hwupload` filter graph and refuses with an actionable
message when no render node exists. The UI only offers encoders the probe
returns.

**Tests.** Pure mapping tests for codec/family/platform, probe parsing, and the
"no device" refusal path. Marked unverified on hardware in `VERIFICATION.md`.

---

## 6. Multi-track and picture-in-picture

**Why it is missing.** Rust enforces exactly one visual track, the timeline is
one row, and the exporter concatenates one track.

**Status.** A real picture-in-picture visual track ships: media tiles create clips on a second visual track, with a timeline row, drag/trim, placement controls (position, size, corner radius, shadow, fill), and a compositor shared by preview, stills, thumbnails and export. The base track stays contiguous and defines the timeline; PiP clips cannot overlap, cannot extend the timeline, and their own audio is muted. One overlay track is supported in this build; the multi-input FFmpeg graph described below is replaced by baking the PiP layer into the same canvas frames as text overlays, which keeps preview and export identical. Timed image/video overlay elements remain available for graphics and imported overlays.

1. Model: allow `visual` tracks with an optional `role` (`base` | `overlay`) and
   per-clip placement (`x`, `y`, `scale`, `radius`, `shadow`). Exactly one base
   track keeps the existing contiguous-timeline guarantees; overlay tracks may
   contain gaps and overlaps.
2. Validation: base track contiguous and non-empty, overlay clips inside the
   project duration, at most two visual tracks (one base, one overlay) in this
   build; total ticks is the base track's end (overlays cannot extend it).
3. Timeline: a second row under the base track for overlay clips, with the same
   drag/trim/select gestures and a track header (show/hide, mute).
4. Preview: draw the base scene, then each active overlay clip scaled into its
   placement rectangle with rounded corners and optional shadow.
5. Export: photo paths bake overlays into the segment frames (shared
   `drawScene` stack). Video overlay clips become extra FFmpeg inputs with
   `scale`, optional `crop`/rounded alpha, and `overlay=enable=between(t,…)`.
   Overlay audio is mixed like clip audio.
6. Inspector: placement controls (X, Y, size, corner radius, shadow) and a
   "Picture in picture" preset.

**Tests.** Model validation (one base track, gaps allowed only on overlay),
timeline hit-testing, compositor placement math, ignored FFmpeg PiP export, and
a browser drag/resize check.

**Boundary.** Two visual tracks in this build; unlimited tracks would need a
scrollable timeline and per-track compositing order.

---

## 7. i18n

**Why it is missing.** The language selector stores a preference but every
string is hard-coded.

**Approach.**

- Add a tiny typed dictionary (`src/i18n/`) with an `en` source of truth and a
  `t(key, params)` helper; no runtime dependency.
- Extract the shell first (menus, Home, Settings, export dialog, error
  boundaries, shortcut labels), then the inspector.
- Ship Polish and Ukrainian for the extracted keys; untranslated keys fall back
  to English rather than showing a blank.
- Locale affects number/time formatting only; documents and filenames stay
  unchanged.

**Tests.** Key parity, fallback behaviour, interpolation, and a snapshot test
that no extracted key is missing from the shipped locales.

---

## 8. One asset store and a SQLite index

**Status.** Not implemented. The native content-addressed store and the browser IndexedDB store share the `pixcut-asset:` reference format and `resolveMediaSource()`, but remain separate physical stores; the project library is still IndexedDB in both builds. The migration and `rusqlite` index below are the next step.

**Why it is missing.** IndexedDB serves the browser build and the native app;
Rust keeps a second content-addressed store for streaming and export, and the
library list is JSON files on disk.

**Approach.**

1. Define one behaviour spec: content-addressed ids, deduplication, usage
   accounting, safe prune, relink.
2. Native: make the Rust store authoritative for the desktop app; expose
   `asset_put_blob`/`asset_get` and have `resolveAssetUrl` use it. IndexedDB
   remains the browser implementation behind the same interface.
3. SQLite (`rusqlite`, bundled) index for the native library: project id, name,
   group, favourite, timestamps, thumbnail path, total ticks. JSON project
   bodies stay the source of truth; the index is rebuilt if missing.
4. Migrate existing JSON library metadata on first launch; keep the JSON writer
   as a fallback so a failed index never loses a project.

**Tests.** Round-trip and dedup for both stores, index rebuild, migration from
JSON, prune safety, and an ignored native test that saves/reopens through the
index.

---

## 9. Font subsetting

**Status.** Not implemented. Fonts are embedded whole with the 2 MB cap and the 9 MB project budget; large CJK faces still do not fit.

**Why it is missing.** A face is embedded whole with a 2 MB cap, so large CJK
faces do not fit.

**Approach.** Subset on import to the characters used by the project (+ Latin
fallback), using a small, offline-licensed WASM subsetter (`subset-font` or
`harfbuzzjs`) loaded lazily only when the user imports. Store the original for
re-subsetting when text changes, and bump the subset on export if new glyphs
appeared. Keep whole-font embedding as the fallback when subsetting fails.

**Tests.** Glyph coverage, re-subset on new characters, size reduction, and a
browser render check with a CJK face.

**Boundary.** Requires adding a bundled WASM dependency; no network at runtime.

---

## 10. Signing and notarisation — deferred

The user will not buy an Apple Developer certificate, so macOS releases stay
unsigned and the release workflow keeps its warning. Windows signing needs a
certificate and secrets; the pipeline is ready to accept them. No code change
is planned here.
