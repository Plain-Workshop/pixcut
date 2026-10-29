# PixCut improvement plan — 2026-10-29

What was fixed this round, what the audit found, and the ordered work to finish. This covers quality, polish and structure; the feature backlog stays in [PLAN.md](PLAN.md). Effort: **S** ≤ half a day, **M** 1–2 days, **L** 3+ days.

## Fixed in this round

### Audio lanes (spectrogram and waveform)

| Symptom | Cause | Fix |
|---|---|---|
| Spectrogram: flat stripes across the low end | 64 log bands on a 1024-point FFT: below ~300 Hz several bands read the *same* FFT bin (runs of up to 7 identical values) | 2048-point FFT, bit-reversal derived from the size, and bands narrower than a bin interpolate between neighbours |
| Spectrogram: thin band under a black void | Axis always ran to 11 kHz; bass-heavy tracks used the bottom third | Draw only the bands that hold sound, never less than 2 kHz |
| Spectrogram: smeared on short clips, heavy on long ones | Fixed 1024 columns per file | 32 columns per second (64–4096) |
| Spectrogram: rebuilt its texture on every trim move | No cache | Texture cached per analysis |
| Waveform: a flat line on quiet tracks | Linear height; a track peaking at 0.12 used 7 of 64 rows | Decibel height scale (48 dB): the same track fills about 60% of the lane, and louder still looks louder |
| Waveform: blocky and blurred | 320 buckets per file on a 512×64 canvas stretched to any width | ~100 buckets per second, canvas sized to the real pixel width and screen density, one min/max per pixel column |
| Video lanes: empty dark boxes | Template video has no audio track; decoding failed silently | "No sound" label |
| File name covered the graph | Name, icon and volume were drawn on top of the waveform or spectrogram, with dark pills to stay readable | A 16 px name strip at the top of every audio and video-audio clip; the graph is drawn only below it, and the lanes grew (54 / 66 / 44 px) so the graph keeps its height |
| Waveform mirrored around the middle | Drawn as a symmetric min/max wave, which halves the usable height and repeats itself | One-sided envelope rising from the bottom edge: the louder sample of either sign sets the height, like a level meter over time |
| Clips cut from one file decoded it twice | Cache keyed by clip id | Cache keyed by source |

Exported audio-reactive bars still use 4096 fixed buckets, so existing exports render identically.

### Online music and sound search

| Symptom | Cause | Fix |
|---|---|---|
| Typing "piano" returned 1 result | The starter search pre-selects **Lo-fi** and kept it, so the query became "piano lo-fi"; the Free Music Archive matches all words | A typed search only adds a genre the user clicked |
| Every search waited 6 s while Openverse was down | Auto mode retried Openverse each time even though it was marked down | Skip Openverse while it is marked down (10 min) |
| Auto fell back only to Wikimedia Commons | Commons music is mostly CC BY-SA, which PixCut excludes | Music falls back to the Free Music Archive first, then Commons; sounds use Commons |
| Commons needed many round trips | 20 results per request, most filtered out | 50 per request |
| Two "Interface" groups in Sounds | Recorded Kenney clicks share the synth category name | Recorded groups say "· recorded" |

Openverse's search API (audio and images) was not answering at the time of testing; its stats endpoint was. That is an outage on their side; the backups now cover it.

Verified in the browser preview: "piano" → 19 Free Music Archive results in about 1 s, Add downloads and places the clip, and its spectrogram renders.

## Audit: what is weak and needs work

### 1. Architecture — the largest risk

- **`App.tsx` is 2,278 lines with 124 `useState` calls.** Every edit re-renders the whole editor tree, and new features keep landing here.
- **Prop drilling:** `EditorBody` takes about 180 props and `TimelinePanel` about 93. Each new feature edits three signatures.
- **Dense code:** 44 lines in `App.tsx` and 24 in `EditorBody.tsx` exceed 400 characters, which makes review and merges painful.
- **`setLayout: Dispatch<any>`** and 12 other `any` uses sit in core paths.
- The `crates/*` media, render, audio and template crates named in `AGENTS.md` do not exist yet; only `crates/project` is real.

### 2. Internationalisation

- 445 `t()` keys; 86 (19%) have no translation in any language.
- About 290 hard-coded English strings bypass `t()` entirely, most in `EditorBody` (64), `SceneForm` (53), `TimelinePanel` (26) and `BehaviorControls` (16). Many are `aria-label`s, so screen readers stay English too.
- Plurals are hand-built (`${n} file${n === 1 ? '' : 's'}`) instead of the existing `count()` helper.

### 3. Timeline and editing (from the earlier review)

- `clip.delete` and `clip.ripple_delete` run the same code.
- No editing shortcuts: trim start/end to the playhead, nudge by a frame, copy/paste clips.
- No marquee selection and no "select everything after the playhead".
- No lock, hide or mute on overlay, element and text lanes.
- The selected clip is hard to tell apart from the others in the dark theme.
- The Spectrogram / Waveform choice resets every session; it should be saved with the panel layout.
- Audio lane heights are fixed. A per-lane height (drag the lane's bottom edge) would let users enlarge the one lane they are cutting to.
- The audio clip name strip has no context menu or rename; audio clips can only be renamed by re-importing.

### 4. Inspector

- Zoom has a slider but no number field; other numeric controls are inconsistent too.
- Camera movement, the key photo-movie effect, is in a collapsed section.
- The colour and speed tabs mix inline styles and `.note` boxes; spacing differs from the new tab header.

### 5. Performance

- One 1.35 MB JavaScript bundle; the element catalogue (2,668 lines) and templates load before Home paints.
- The Bundled music tab reads all 15 tracks (~26 MB of blobs) on open just to make Listen instant.
- Spectrogram decoding runs on the main thread (`decodeAudioData`) before the worker FFT.

### 6. Reliability and process

- `VERIFICATION.md` is kept current, but it is 1,500+ lines of dated sections with no summary at the top; its first line still reads 2026-10-25.
- The online catalogues have no "last known good" cache: when all are down, the panel is empty.
- The browser preview cannot exercise native downloads, updates or pinch zoom, and there is no end-to-end test of the Tauri window.
- The `chore/update-deps` branch holds feature work unrelated to its name.

## Plan

Each phase ends with `npm test`, `npm run build`, the Rust tests, a screenshot check, and the desktop app left running.

### Phase 0 — housekeeping (S)

1. Open a PR from `chore/update-deps` (26 commits ahead of `main`, already pushed, so renaming it is the owner's call) and run CI.
2. ~~Update `VERIFICATION.md`~~ Done: dated section added. Still to do: a short current-state summary at the top.
3. ~~Replace the startup `.expect`~~ Done: error dialog and exit code 1.

**Done when:** CI is green on the PR and `VERIFICATION.md` matches reality.

### Phase 1 — finish the editing basics (M) — done 2026-10-29

1. **Delete vs ripple delete.** Delete leaves the gap; Ripple delete (Shift+Delete) moves later clips on the same lane earlier. Applies to audio (per lane), project elements (per media/shape group) and picture-in-picture. The visual track is magnetic, so both close the gap there by design.
2. **Trim to playhead** `Q` / `W`, **nudge** `Alt+←/→` (1 frame) and `Alt+Shift+←/→` (10 frames), **copy / paste** `Mod+C` / `Mod+V`. Audio, elements and picture-in-picture paste at the playhead (audio takes the next free lane); visual clips paste as a copy after the original. Nudge on a visual clip explains that visual clips follow each other. The plan said `,` and `.` for nudge; Shift+comma is a different key on most layouts, so Alt+arrows are used.
3. **Marquee selection** (drag on empty lane space selects the visual clips in that stretch of time; Shift/Cmd adds) and **Select clips after playhead** (`Mod+Shift+→`).
4. **Lane lock** on every lane: a locked lane refuses drags and every keyboard edit, with a notice, and is remembered in the layout.
5. **Selected clip:** a white ring with a purple edge on every clip type in both themes; the primary clip of a multi-selection glows, the others are dashed.

Not done, on purpose:
- **Lane hide and mute for non-audio lanes.** Hiding a lane from the output changes how projects render and export, so it needs a schema migration (rule 4: `model.ts` and `lib.rs` together, old versions still loading, tests both ways). A view-only hide would duplicate Collapse. Specify the schema first.
- **Marquee across other lanes** selects visual clips only, because multi-select exists only for visual clips.
- **Paste of visual clips at the playhead:** the track is magnetic, so a paste is a copy placed after the original (one undo step).

### Phase 2 — inspector polish (S–M) — done 2026-10-29

1. **One number control.** `RangeField` and `NumericField` live in `components/inspector/NumberField.tsx`. A typed value sits beside every slider; Enter or blur commits, arrows step, Shift+arrow steps ten times as far, Alt+arrow a tenth, and typed values clamp to the range. The 38 controls that already used it are unchanged; about 24 raw sliders now use it too (Zoom, the whole audio panel, element opacity/rotation/size, picture-in-picture timing and layout, chroma key, mask). Each keeps its previous slider accessible name. Not converted, on purpose: the timeline's inline volume sliders and the preview/scrub bars, which are controls, not form fields.
2. **Camera movement** is open by default for photos, placed right under Zoom and Reposition (it was below Position, keyframes and the mask). The dropdown became eight cards that show the clip's own image and animate the move while hovered or chosen; the animation follows the Amount slider and stops when reduced motion is on.
3. **Colour tab:** Light and Colour groups, split toning collapsed unless it is in use, copy/paste labelled "Copy colour" / "Paste colour", and the duplicate Reset button removed (the tab header resets). **Speed tab:** Speed, Direction and Sound groups, with the status line merged into one caption. New strings translated in all ten languages.

Not done: other tabs (Fades, Looks, Text) still use their older layout; the group component is ready for them.

### Phase 3 — internationalisation sweep (M) — done 2026-10-29

1. **Coverage test** (`tests/i18n-coverage.test.ts`): every literal `t('…')` key, plus `tip('id', '…')`, `<IconButton|RangeField label="…">` and disabled reasons, must exist in all ten languages, keep the same `{placeholders}`, and be non-empty. The allow-list is empty. It also rejects hand-built plurals (`? '' : 's'`) and `t(cond ? 'a' : 'b')`, which would hide keys from the check.
2. **Plurals:** 20 sentence-with-glued-"s" sites now use `count()` nouns. Eight nouns were added (clip, caption, beat marker, cut, font, shortcut conflict, long cue, media file) with Polish and Ukrainian few/many forms; a test checks every noun in every language.
3. **Wrapped:** 136 notices and errors in the hooks (they had no translation at all), 285 JSX labels, 49 template-literal screen-reader labels, 31 disabled reasons, and `IconButton`/`tip()` now translate their labels.
4. **Translated:** about 780 new keys in all ten languages, including 92 gaps from this session's own earlier work and about 30 slider labels (`Shadow blur`, `Letter spacing`) that had silently been English.

Still English, on purpose or not yet reached:
- Names from data tables: look/filter names, transition and element catalogue names, template titles.
- Error text thrown by the project model (`model.ts`, `lib.rs`) and `messageFor`.
- Multi-line JSX text and `label=` props on components other than `IconButton` and `RangeField`.
- The native menu already has its own translations in Rust; not re-checked.

### Phase 4 — split the editor state (L, incremental)

1. Move editor state out of `App.tsx` into focused stores (selection, playback, layout, project/commands) behind a small context or `useSyncExternalStore`, as `timeline-snap.ts` already does for the snap guide.
2. Let `TimelinePanel`, `EditorBody` and the inspector read from those stores instead of taking 90–180 props.
3. Wrap the formatter-hostile one-liners while touching each file.
4. Replace `Dispatch<any>` and the remaining `any`s with real types.

**Done when:** no component takes more than ~25 props and `App.tsx` is under 800 lines. Do one store per PR; behaviour must not change and the tests must still pass.

### Phase 5 — performance (M)

1. Code-split the element catalogue, templates, music panel and export studio with `import()`; target under 500 KB for the first chunk.
2. Bundled music: stream Listen from the file URL instead of preloading 26 MB; keep one preloaded track at most.
3. Move audio decoding for analysis into the worker where the platform allows it, or decode at 8 kHz once and share it between the waveform and the spectrogram.

### Phase 6 — online catalogue resilience (S–M)

1. Cache the last successful results per query locally (titles, URLs, licences; no audio) so a full outage still shows something, clearly marked as cached.
2. Show which catalogue each result came from (Free Music Archive rows currently show nothing).
3. Add a native end-to-end check (ignored by default, like the FFmpeg tests) that searches and downloads one CC0 file through the Rust path.

### Phase 7 — native verification (S)

On the desktop app, check:

- pinch zoom on the timeline
- an update from a test feed (download, install, restart)
- an online download through Rust
- the Settings theme "System" following the OS

Record the results in `VERIFICATION.md`.

## Order and size

| Phase | Size | Why this order |
|---|---|---|
| 0 Housekeeping | S | Unblocks review of everything already built |
| 1 Editing basics | M | Biggest user-facing gap |
| 2 Inspector polish | S–M | Small, visible wins |
| 3 i18n sweep | M | Mechanical; easier before the state refactor moves code |
| 4 State split | L | Largest risk reduction; do it incrementally |
| 5 Performance | M | Easier once state is split |
| 6 Catalogue resilience | S–M | Independent; can run in parallel |
| 7 Native verification | S | Before the next release |
