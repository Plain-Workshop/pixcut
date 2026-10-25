# Shorts, thumbnails, motion templates and bulk creation

## Long-form video -> Shorts
Import/interview -> transcribe -> detect speech segments and scene cuts -> rank short candidate excerpts using explainable heuristics (topic continuity, hook strength, silence, composition, min/max duration) -> show 3–10 suggestions with timestamps and transcript excerpts -> creator approves -> generate linked 9:16 variants -> auto-reframe/safe captions, title card, end CTA -> editable normal timeline -> export. Never promise 'viral score'. No automated uploading without explicit separate permissions.

## Thumbnail Studio
Choose timeline frame or import image -> social profile -> crop/expand/background regenerate -> face/product safe preserve -> title overlay with direct editing and templates -> generate 3–6 *layout* variations with optional AI background variants -> compare at thumbnail size -> export image PNG/JPEG/WebP and optionally save selected design in project. Never bake essential text into image unless explicitly requested; keep typed title as vector text.

## Quick Create and template schema
Import sources + choose theme -> automatic storyboard arrangement + duration calculation + optional music beat matching -> live preview -> customize -> open full editor. Templates are parameterized scene graphs with slots `media`, `text`, `logo`, `color`, `duration`, `audio`; pack manifest includes publisher, license, revision, compatibility, preview assets, dependent fonts/effects and prohibited executable code by default. Installed templates versioned and cached offline.

## Motion graphics studio
Parameterized title animations, lower thirds, animated icons and captions; advanced graph editor; save as reusable package exposing user-friendly properties. Plugin-generated shapes can be raster fallback and need deterministic render path. Content pack browser shows hover-preview, tags, downloaded/offline, Free/Pro lock, favorites/recent and installed version.

## Bulk video creation
CSV/JSON input columns mapped to template slots, plus optional media folder mapping. Preview first three sample rows, input validation, missing asset substitution rules, output naming template, collision detection, job/concurrency budget, render queue and export folder. Per-row status and logs; skip/retry failed rows; reproducible manifest. Pro gate on batch job count/concurrency not on ordinary one-off exports. Prevent spreadsheet formula injection in exported CSV summaries where applicable.

## Audio/social finishing
Music selection (rights metadata), fade/auto-duck, beat markers, voice cleanup, loudness check, captions, platform-safe overlays, static/dynamic CTA, end card, thumbnail. Asset licensing and commercial-use status visible before use.

## Acceptance
A creator can produce 5 candidate Shorts from one long video, edit one as a regular project, override subtitles on one variant, and batch export without duplicate project sources. Bulk run 100 rows with synthetic assets and interruption/retry; output assets and job statuses reconcile after restart.
