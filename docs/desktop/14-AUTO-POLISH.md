# 14 — Auto Polish: Intelligent Scene, Text and Social Optimization

**Status:** implementation specification; no feature is implemented. **Scope:** six selected optimizations. **Platform:** Windows/macOS/Linux desktop via Tauri 2, React/TypeScript UI and Rust command/services layer. **Dependency:** core project model, preview renderer, rational timeline timebase, media index. **Goal:** generate inspectable *proposals* for edits, never silently mutate the project.

## 0. Product contract and constraints

- Six selectable checks: (A) text placement/readability; (B) scene duration optimization; (C) music-cut synchronization; (D) transition recommendations; (E) framing/social safe areas; (F) caption/overlay collision detection.
- Single entry point `Auto Polish` in editor top toolbar; contextual `Polish Scene` on timeline clips; Quick Create offers `Improve my edit` after import. Keeps main preview and timeline visible; right-side inspector becomes *Review Suggestions*.
- Analyze current social version, selected clips, or entire sequence. Read-only analysis snapshot; async non-blocking; no automatic cloud upload, AI credits or generative AI. Optional detection models are local downloadable capabilities.
- Each proposal must include: reason, affected object IDs, old/new values, preview sample time(s), estimated impact, confidence (calibrated when possible), prerequisite/collision dependencies, limitations, stage/version key and stable id. Never promise subjective “best” edits.
- Respect `manual_lock` and user override scopes. Ignore locked objects entirely. Respect pinned scene lengths, pinned cuts, words synchronized to speech, mask tracking, approved subtitles, nested compositions and a selected active platform variant.
- Suggest defaults suitable for beginners; `Minimal`, `Balanced`, `Energetic`, `Cinematic`, `Custom` pacing and `Subtle/Balanced/Creative` transition styles. Overrides revert to manual at any time.
- No content upload, model inference or payment without opt-in. Generated proposals do not require generative AI. No watermark in Free.

## 1. End-to-end interaction design

### Access and setup
1. Open a project. Top toolbar: `Auto Polish` wand. Dropdown options `Polish entire video`, `Selected scenes`, `Text & captions`, `Social version`; default entire active sequence/version.
2. Compact sheet (not modal takeover): target profile 9:16 TikTok/Reels/Shorts, 16:9 YouTube, 4:5, 1:1, custom; editing pace; intended target length optional; music selection (if any); six optimization toggles (all initially on). `Analyze` button; `Advanced` expandable constraints including max text movement, animation policy, fade max, preserve branding, cut flexibility, max runtime divergence and face/subject protection.
3. Existing layout remains: library left, player center, contextual inspector right, timeline below. After Analyze, right inspector displays proposal groups with total counts, confidence indications and `Apply selected` (not automatic).
4. Analysis shows cancellable progress by independent stage (`Frame samples`, `Text`, `Safe areas`, `Audio beats`, `Timing`, `Cuts`, `Final checks`), partial results appear as completed. Cancel preserves unmodified project.

### Review UI
- Inspector proposal rows: category icon + plain description e.g. `Scene 4: move “SUMMER” 6% left to avoid face; add subtle backdrop`, before/after values, reason, status `Suggested / Conflict / Unavailable / Dismissed / Accepted` and checkbox.
- On hover: affected clip(s) glow on timeline, show suggested duration handles/keyframe ghost and overlay bounding-box ghost. On click: seek player to worst/confident timestamp, enable *Before/After* compare with toggle and swipe; keyboard `[` previous and `]` next suggestion; Enter toggle acceptance, Shift+Enter preview, Esc exit compare.
- `Apply selected` shows a concise delta overview (e.g. 3 title moves, 2 length adjustments, 4 cut shifts, 1 crossfade); disabled while mutually inconsistent conflicts remain. Offer `Fix automatically` with explanation or select winner; no silent drop.
- `Accept all safe` checks proposals with no locks, severe warnings or conflicts; low-confidence and scene-altering suggestions remain opt-in. All applied changes form **one undoable transaction**. `Undo Auto Polish` restores exact pre-apply state; *redo* restores accepted changes and provenance. Partial apply is possible by category or selected item.
- After applying, proposals can be revisited through timeline history `Auto Polish session`; change log includes project revision, analysis mode and settings. Subsequent manual edits invalidate relevant cached proposals; UI displays stale badge and `Reanalyze`, not quietly reapply.
- The user can pin title placement, font color, caption track, crop, cut, scene duration, transition and entire scene to prevent future changes. Preserve per-user project defaults.

### Important preview behavior
- *Before/after* previews must be rendered from the same actual composition pipeline as export. Do not approximate final text color, animation, crop or transitions with CSS-only overlays. Generate lightweight ephemeral candidate project graph(s) and request preview frames/short playback ranges from media engine. Show `Preview rendering` if not available; avoid claiming real-time compatibility.
- Live preview and timeline visible together at all times at normal editor window sizes; review panel collapsible. Resizable screen support at 1366x768. Timeline ghosts are not committed objects.

## 2. Shared analysis model

- `ProjectSnapshot` pinned by `(project_id, revision, sequence_id, active_version_id, media_hashes, render_profile, font_version, safe_zone_version)`. Proposals always refer to snapshot. Never analyze a changing mutable graph.
- Use rational timestamps/time ranges (`num`, `den`); reject NaN/floating second boundaries as authoritative. Convert to audio sample grid and frame grid only at boundaries; support VFR input and time-remapping.
- `SceneDescriptor`: scene ID, media ranges, subject tracks, saliency heatmaps, bounding boxes, sharpness, brightness, busy-ness, motion, semantic categories if optional detector available, linked annotations, captions, voice timestamps, transition handles, beats, visibility in active version.
- Cache scene measurements using hash of source asset + source in/out + transform/crop + effect/font graph + color profile + output aspect + source algorithm version. Do not cache rendered judgment indefinitely if text or crop changes.
- Video sampling: cover start, middle, end, scene cuts and moments near text appearance/disappearance; adaptive additional frames around significant motion/lighting changes. Never infer readability from only first frame. Analyze player-relevant output, not raw camera frame.
- Reliability: return status `analysis-incomplete` if sampling/model fails. Provide safe fallback recommendation (e.g. translucent backplate) instead of inventing subject tracks. Report hardware/model needs and reasons for skipped jobs.
- Score all candidate edits via multiobjective function with hard constraints (locks, crop containment, safe zones, reading floor, protected regions, valid handles, audio continuity), soft objectives (legibility, saliency avoidance, timing rhythm, minimal change). Avoid a single opaque quality number in user UI; show explainable factors.

## 3. A — Smart text placement and readability

### Detection and candidates
1. Collect text objects and caption cues + exact glyph bounds from the actual renderer (fonts, shaping, kerning, line breaks, outlines, transforms); sample scene within their visible interval.
2. Build candidate anchors on normalized 3x3 grid plus nearby continuous search; include stable existing position. In 9:16 avoid platform overlay safe zones, reserved subtitle band and already occupied overlays. Face/person/object boxes, detected content text, saliency map and brand/logo protected boxes become high-penalty regions.
3. For each candidate compute *local contrast behind glyphs* on all sampled frames, not overall frame mean. Use WCAG-style relative luminance contrast as an initial accessible proxy where applicable: aim >=4.5:1 normal text, >=3:1 large text, and evaluate local worst-percentile + temporal fraction. These are **guidelines for video**, not a claim that WCAG compliance automatically applies to moving content.
4. Score visual busyness (spatial gradient / edge density and local texture), overlapping masks, composition preference, motion stability, distance from original placement and platform safe-zone intrusion. Rank robust positions by lower-tail scores rather than average-only.
5. Try repairs in order: minimally move; wrap lines; choose among brand-allowed contrasting colors; add 1–2px-ish relative outline or subtle shadow (scale with output); subtle gradient/backplate; warn if nothing fits. Preserve exact requested brand colors unless explicitly unlocked. Never silently shorten user text.
6. Respect `manual_lock.position`, `.style`, `.duration`, `do_not_cover_subject`; guarantee fallback suggestion `Enable contrast backplate` when subject detection uncertain. Optional temporal position tracking only when warranted; smooth movement with bounded velocity and avoid jitter.

### Suggested scoring (tunable, not final empirical constants)
`score = 0.30*legibility + 0.20*subject_clearance + 0.15*safe_area + 0.10*motion_stability + 0.10*clean_background + 0.10*composition + 0.05*minimal_change`.
Use actual color contrast ratio and penalize frame-time fraction below contrast target as hard/high penalty where possible; derive final weights from labeled fixtures and usability testing. Different text roles (`main_title`, `captions`, `cta`, `lower_third`) have different anchors/policies. Evaluate on every social version independently.

## 4. B — Optimize scene durations

### Requirements
- Inputs: proposed total project duration or free-running, scene importance, media playable ranges, amount of on-screen text, narration/audio, beat and phrase map, candidate transition overlap handles, pacing preset, pinned scene timing.
- For photo/slideshow scenes, initialize duration preferences *heuristically* (editable, not universal): Fast 1.2–2.5s, Balanced 2–4s, Cinematic 3.5–6.5s. Never truncate readable title merely to hit preset; detailed scenes may need longer.
- Readability minimum uses measured text length/word count and user reading-speed setting; include entry animation latency and exit cushion. Basic model `minimum_seconds = entrance + max(min_hold, words/(WPM/60)) + exit`, with long/multiline captions and complexity adjustments. Use word-level cue timestamps for speech rather than imposing image reading formula on spoken captions.
- Videos may have natural action boundaries, scene cut candidates, face changes, voice segments. Exclude regions that cut through required spoken sentence unless explicitly enabled. Photo scenes can generally change duration freely, but transitions require valid overlap and nonzero effective hold.
- Optimize total target length with constrained weighted least squares / dynamic programming over allowed cut positions; minimize deviation from readable duration, rhythm inconsistency, pinned cuts and speech boundaries. If impossible, explain conflict (`minimum readable length 37s exceeds 30s target`) and offer alternatives: longer video, fewer scenes, shorter manual copy, faster text animation where readable, or disable strict target.
- Each proposed timing change includes old/new start/duration, affected linked objects, transition overlap delta, audio effect; preserve attached objects via explicit `scene-local` timing anchors and media source mapping.

## 5. C — Music-synchronized cuts

1. Analyze selected soundtrack locally using onset-strength envelope + tempo candidates; derive beats, downbeats and phrase/boundary confidence with a suitable tested DSP library. No assumption that every beat is a good cut; strong downbeats/phrase boundaries preferred.
2. Detect drift to current clip cut times and candidate cut move windows; build candidate beat snapping grid. Keep narration audio continuous; do not shift a semantic cut across a spoken sentence or truncate source footage.
3. Find lowest-cost matching between sequence boundaries and nearby strong onsets/downbeats under constraints; penalties for excessive edits, beat overuse, min/max scene durations, locked cut positions and invalid transition handles.
4. Use default maximum snap distance roughly 200–350ms as a configurable prototype heuristic; for longer cinematic cuts permit phrase-level moves, show delta precisely. Never modify the soundtrack tempo/pitch without explicit separate user action.
5. No music? Stage is `skipped: no soundtrack` (not failure). Ambiguous tempo? Show suggestions with confidence and offer tap-tempo or manually inserted beats.

## 6. D — Recommended transitions

- Determine clip pair features: source motion/direction, visual similarity, scene semantics, luminance jump, music accents, pace, soundtrack continuity, existing transition, context (comparison/product reveal/talking head).
- Candidate pool **always includes hard cut** (zero transition). Rank by simplicity, pacing, intention and legal transition handle availability. In talking heads and quick-cut shorts, default hard cuts; do not add transition at every boundary.
- `Subtle`: hard cut, short dissolve, minimal fade. `Balanced`: above + directional slide / modest zoom when motion suggests. `Creative`: include custom presets (not assumed installed) subject to style/cost capabilities.
- Transition proposals specify `(left_clip,right_clip,type,duration,timebase,easing,alignment,source_handles)` and preview cut neighborhood. Apply by renderer-supported transitions only; if unsupported, present fallback, never serialize unsupported effect blindly.
- Bound duration by handles, voice cuts and image dwell. Example heuristic for quick content 0–250ms; relaxed content may allow 300–700ms if source handles permit. Avoid transition to black unless intentional.

## 7. E — Framing and social safe areas

- Compute a non-destructive crop/scale/position transform per target ratio and *per linked variant*, not global asset mutation. Source remains unchanged. Begin with Fit, Fill, Blur Background alternatives; intelligent crop recommended only when adequate content remains.
- Detect subject boxes/tracks (optional local model), faces, existing captions/logos and focal point; score candidate pan/scan windows across time with continuity penalties. Fit constraints consider text overlays and third-party UI occlusion.
- Store social-safe-area definitions in versioned local presets `(platform, placement, version, normalized polygons, user overrides)` because app interface placements change. Distinguish `hard` design-claimed crop from `soft` UI occlusion recommendation. Offer editable guides and custom safe regions rather than asserting a permanent guarantee.
- For 9:16 from 16:9, choose `fit+blur` when center crop would irreversibly cut critical subjects; AI outpainting is **not** silently invoked by Auto Polish. Show `Can extend with AI` as separately consented, optionally paid action.
- For shot motion, optimize smooth virtual camera path bounded by acceleration and source limits; if detection becomes uncertain, freeze crop / switch to safe fit.

## 8. F — Caption and overlay collision detection

- Build time-indexed occupancy masks (bounding polygons and temporal spans) for captions, text, images, stickers, branding, tracked objects, safe zones and fixed UI overlays. Use output-frame coordinates, applied transforms, tracking, motion tween positions.
- Sweep overlapping time windows and test transformed polygon intersection + padding; severity = overlap area × semantic priority × time-in-collision × visibility. Check also crowdedness and whether text/background contrast falls below thresholds.
- Priorities: protected subject and mandatory captions highest; secondary stickers lower. Propose minimal translation / scale / cue timing adjustment / line wrap / safe backplate. Preserve speaker cue timing unless user permits shift. For layered graphics, allow intentional overlaps tagged `intentional_overlap=true`.
- Timeline shows red collision markers at exact affected spans, with click-to-seek and before/after. `Resolve all safe` only operates when unambiguous; collisions involving locked assets or multiple high-priority captions require user choice.
- Acceptance fixture: a caption enters while a CTA button moves into its zone; detector flags actual overlapping frames, suggests moving CTA, does not move user-locked captions.

## 9. Global optimizer and conflict handling

Run analysis in phases rather than arbitrary simultaneous edits:
1. Gather snapshot, scene/media descriptors, target variant and audio features.
2. Construct hard constraints from locks, timing anchors, platform safe areas, audio and rendering capabilities.
3. Derive candidate pacing and beat alignment *together* (not two contradictory sequences); choose feasible cut schedules.
4. Propose transitions after timing proposals (with valid handles).
5. Recompute frame samples against proposed timing and transitions, propose framing changes.
6. Compute text positions/readability and collision solutions jointly against the candidate scene graph.
7. Verify all suggestions against actual render pipeline and final scene lengths; remove invalid candidates with explicit reason.

- Proposals form a dependency DAG with `requires_ids`, `conflicts_with_ids`, `supersedes_ids`; if accepting one invalidates another, recompute or request reanalysis. The checkbox list is not an unvalidated bag of commands.
- `acceptSelected` must validate project revision, schema compatibility, entitlements and dependencies; simulation produces canonical `EditCommandBatch`; write one journal transaction only after all succeed. No partial mutation on failure.
- Stable old/new schema includes copies of touched fields and parent/child anchor rules; on rejected items no state changes. User-created keyframes within a moved scene shift according to explicit anchor semantics (`absolute_project`, `scene_relative`, `source_relative`); never guess.
- Results are project-local, not transferred to other projects. Across linked social versions, use base graph + per-version overrides; changing one version must not silently rewrite all others.

## 10. Rust service boundaries and APIs

Suggested crates/modules, following `07-ARCHITECTURE.md`:

```
crates/analysis-core         SceneDescriptor, SamplingPolicy, masks, model capability checks
crates/audio-analysis        onset, beat, phrase and speech boundary estimates
crates/visual-analysis       saliency, local luminance, contrast, subject tracker adapters
crates/layout-optimizer      candidate text/crop positioning, temporal collisions
crates/pacing-optimizer      reading minima, cut scheduling, beat matching
crates/transition-ranker     candidates, handles, hard-cut baseline
crates/auto-polish           Orchestrator, graph merge, proposal store, validation
crates/edit-commands        atomic Preview/EditCommandBatch transaction
crates/render-jobs          ephemeral candidate preview (existing)
```

Sample strongly typed shape (design-level pseudo Rust):

```rust
struct AutoPolishRequest {
    project_id: ProjectId,
    revision: Revision,
    sequence_id: SequenceId,
    version_id: VersionId,
    scope: PolishScope,            // All | SceneIds | Selection | TextOnly
    enabled_checks: CheckSet,    // text, duration, beats, transitions, framing, collisions
    pacing: PacePreset,
    target_duration: Option<Timecode>,
    constraints: PolishConstraints,
}
struct EditProposal {
    id: ProposalId,
    base_revision: Revision,
    check: PolishCheck,
    target_ids: Vec<ObjectId>,
    change: ProposedEdit,         // typed, reversible transform
    rationale: Vec<ReasonCode>,
    confidence: Option<f32>,
    preview_ranges: Vec<TimeRange>,
    requires: Vec<ProposalId>,
    conflicts: Vec<ProposalId>,
    warnings: Vec<WarningCode>,
}
```

Tauri commands via typed TS bindings:

```
start_auto_polish(request) -> JobId
get_auto_polish_progress(job_id) -> stage/progress/partial results
cancel_auto_polish(job_id) -> ack
list_auto_polish_proposals(job_id) -> paginated proposals
preview_auto_polish(job_id, proposal_ids, time_range) -> preview session handle
validate_auto_polish(job_id, selected_proposal_ids) -> conflict report / effective diff
apply_auto_polish(job_id, selected_proposal_ids, expected_revision) -> transaction id
undo_transaction(transaction_id) -> new revision
```

- Work runs in bounded worker pools; cancellation tokens checked during frame/audio sampling and ranking; throttle preview, prioritize interactive user seek over background analysis. Do not push raw frames through Tauri IPC; only feature summaries/metadata.
- Persist jobs and proposal metadata to SQLite as transient local application state; media caches filesystem; strip paths/metadata from diagnostic export by default. `base_revision` conflict checks required on every apply.
- Optionally use OpenCV/ONNX Runtime or equivalent local inference adapters after commercial licensing/platform-build audit; all detectors capability-gated with deterministic lightweight fallback.

## 11. Free / Pro / credits

| Capability | Free | Pro | Notes |
|---|---|---|---|
| Check current scene text contrast and platform safe area | Yes | Yes | Core quality feature, fully offline |
| Suggest per-scene readable positions and optional backplate | Yes | Yes | Basic subject-avoidance detector where available |
| Detect caption/overlay collisions and suggest corrections | Yes | Yes | Always inspectable, no auto mutation |
| Basic photo duration suggestions, beat markers/snapping | Yes | Yes | Local DSP and timing constraints |
| Basic transition suggestions including hard cuts | Yes | Yes | Presets themselves separately entitled |
| Auto Polish one scene / current selection | Yes | Yes | Proposal-based |
| Entire project optimized in one batch | Optional limited demonstration | Yes | Pro convenience, not required for basic quality checks |
| Multi-version global variants and comparative A/B edit sets | No | Yes | Linked versions as specified elsewhere |
| Advanced subject tracking / temporal crop paths | No | Yes | If models installed and capabilities available |
| Custom branded policies and bulk Auto Polish | No | Yes | No trapping user data |
| Generative backdrop/outpainting triggered from suggestion | Provider/credits separately | Provider/credits separately | Never silently invoked |

Avoid gating basic legibility or preventing users from manually correcting issues. If Pro expires, preserve all edits and project file; explain any export restrictions without surprise watermark.

## 12. Acceptance criteria and test matrix

### Deterministic unit fixtures
- Pure-color and gradient backgrounds: white-on-white fails target; chosen black/backplate meets contrast targets. Text glyph bounds include actual font metrics.
- Moving white foreground behind white text: low-contrast period flagged; correction stable across timeline.
- Faces in left and center thirds: title does not intersect protected boxes if feasible; fallback explicit if no good region.
- Caption + CTA appears on overlapping intervals: correct exact collision range; intentional overlap ignored only if user explicitly marked it.
- Text title of 12 words is not reduced to an unreadable sub-second scene. Pinned scene length remains unchanged.
- Synthetic 120 BPM soundtrack (beats every 500ms) and 4 clips: cut candidates match beat/downbeat within configured tolerance; no forced cut through spoken dialogue.
- No music: skip beats only. Music tempo ambiguous: low-confidence rationale, no fabricated BPM certainty.
- Transition handles absent: recommend hard cut, no invalid overlap duration.
- 16:9 to 9:16 crop with subject at far edge: protects subject or proposes Fit+Blur; never crop locked subject.
- 30 scenes with target shorter than reading minima: infeasibility shown and no destructive shortening.
- Multiple linked aspect versions: per-version output and safe-zone constraints independent, unaffected base version remains unchanged.
- Tests use rational frame/sampling timestamps; variable frame rate media and 23.976/29.97 FPS have no accumulating drift or off-by-one cuts.

### Integration and E2E
1. Import 30 photos, add 12 text titles and soundtrack; enable all six checks; review proposals in panel without hiding preview/timeline; save/reopen and export accepted results.
2. Scrub before/after proposal sample points and compare against real render; no visible preview/export mismatch above agreed tolerance. Generate golden frames for typography, crop and transitions.
3. Reject all -> project byte-equivalent semantically, journal unchanged. Accept subset -> only corresponding fields touched; undo once -> exact original; redo once -> same accepted result.
4. Lock title/scene/crop/transition. Analyze -> no proposals mutating locked values. Conflict selection -> commit disabled with actionable resolution.
5. Reanalyze after manual edit -> stale proposals cannot apply; clear rebase prompt. Crash while analyzing -> source project intact; cancel promptly with no journal mutation.
6. Frame playback during background analysis should remain responsive on reference low-end machine; measure p50/p95 seek latency, dropped frames, RAM/CPU and job completion for different scene counts.
7. Localization: non-Latin/CJK/RTL and mixed emoji fonts, outlined titles, multiline captions, translated subtitle layouts, color-managed SDR/HDR samples; no clipped/reordered glyphs.
8. Accessibility: keyboard tab order, screen reader labels, focus indication, high-contrast controls, reduced-motion option and reliable manual alternative.
9. Privacy: no network calls for all-default local analysis; external models are opt-in; test with network disabled.
10. License: Free checks remain available without login; Pro-only apply gives pre-action upgrade explanation; downgrade preserves work and undo functionality.

### Benchmarks / quality gates
- Define reference machine tiers; record scene-analysis latency per minute of media, sampled frames, memory peak and effect of optional detectors; no universal stopwatch promise.
- Publish recall/precision on curated scenes: unreadable text detection, subtitle collisions, protected face interference, safe-zone incursions, beat snap quality and chosen transition preference. Tune thresholds on user-reviewed samples; never describe subjective optimality as guaranteed.
- Frame-preview UI drag/seeking priority must hold under worker load; budget/defer analysis based on background load. First prototype targets no lost edits and no freezes over 200ms caused by optimizer worker contention; profile and revise as necessary.

## 13. Agent delivery checklist and phased rollout

**AP-00 Research:** dataset/fixtures for six checks, output pipeline sample frames, local licensing feasibility for detectors.
**AP-01 Analysis metadata:** typed Rust structs, canonical snapshot revision, caching and cancellation, fake progress service.
**AP-02 Text+collisions:** glyph metrics, local contrast sampling, time-expanded layout, safe alternatives. Free beta.
**AP-03 Timing+beats:** audio onset/phrase map, reading minima, feasible constrained timings. Free beta.
**AP-04 Transitions+framing:** handle-aware transition ranking, per-version safe zones, subject tracking with fallbacks. Free baseline.
**AP-05 Proposals UX:** inspector list, ghost timeline edits, original/candidate previews, conflict resolutions, atomic apply/undo.
**AP-06 Pro batch:** project-level optimization orchestrator, policy sets, multiple A/B variants, brand rules.
**AP-07 Hardening:** cross-platform CI, fuzz scene inputs, profiling, render parity, local-only privacy validation, localization, release instrumentation opt-in.

**Definition of Done:** documented public UX, verified preview/export parity, reproducible typed tests, sample project assets and examples, no unauthorized project mutation, no silent cloud or credits, Free/Pro behaviors tested, accessible UI, compatibility notes and benchmark reports.

## 14. Security and privacy

Treat images, audio, fonts and project metadata as potentially hostile input. Use existing sandboxed decoder workers and resource-limited analysis workers; never execute uploaded titles/scripts. Keep local content offline. If optional plugin/model provider offers external processing, show exact media selection and require explicit consent. No server telemetry by default. Preserve reproducible diagnosis logs without private media/content unless user explicitly exports it.
