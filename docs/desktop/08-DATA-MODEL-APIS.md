# Data schema and typed operations

## Project model skeleton (conceptual, not final wire format)
```json
{
  "schema_version": 1,
  "project_id": "uuid",
  "name": "Travel Reel",
  "timebase": {"numerator": 1,"denominator": 30000},
  "assets": [{"id":"asset-1","uri":"relative-or-relocatable","sha256":"...","media_info":{"width":1920,"height":1080,"fps_num":30000,"fps_den":1001}}],
  "scenes": [{"id":"scene-1","duration_ticks":150000,"tracks":[{"id":"video-1","kind":"video","clips":[{"id":"clip-1","asset_id":"asset-1","start_ticks":0,"source_in_ticks":0,"duration_ticks":90000,"effects":[],"keyframes":[]}]}]}],
  "variants": [{"id":"youtube","profile":"youtube-16x9","overrides":{}},{"id":"reels","profile":"vertical-9x16","overrides":{"clip-1":{"crop":{"mode":"tracked"}}}}],
  "generation_refs": [],
  "template_refs": []
}
```
This illustrates only top-level relationships. Do not assume source timestamps share project timebase; define source timebase metadata and exact conversion. Asset URLs must not permit traversal outside authorized roots.

## Edit command envelope
`EditCommand { id, project_id, base_revision, actor_id, timestamp, operation, payload }` Rust validates IDs, permissions, time boundaries, effect availability and entitlement. Reply `{ new_revision, diff, inverse_command_id }`; UI treats failed revisions as conflicts and reconciles.

## Commands
- Asset: import, relink, duplicate, remove_ref, create_proxy, regenerate_thumbnail.
- Timeline: add_clip, move_clip, trim_clip, split, ripple_delete, set_track, set_keyframes, add_transition, edit_transition, group, ungroup, set_crop.
- Text: add_text, update_content, update_style, set_caption_segments, import_subtitles.
- Social: create_variant, set_profile, override_layout, reset_override, export_variant.
- AI: submit_job, cancel_job, choose_candidate, apply_generated_asset, revert_generation.
- Template: install_pack, instantiate, change_slot, save_user_template.
- Bulk: import_dataset, map_columns, preview_row, enqueue_batch, retry_failed.

## API/event conventions
Use typed Tauri commands for low-frequency changes; channels/events for job progress, not frame delivery. Events contain event_id, project_id, revision, type, payload. Enforce bounded queue/backpressure; debounce transient scrubs and settings changes without losing final committed edits.

## Entitlements
`Entitlements { tier, expires_at?, features, offline_grace_until?, provider_credits? }`; Rust validates requested operation and export profile, not just React button disabled state. Keep project data accessible after subscription lapse; advanced effect instances remain viewable and editable where possible, with transparent export restrictions.

## Media/render determinism
Stable asset IDs and per-clip effect stack revisions. Export job references immutable project snapshot hash plus variant/profile; ensure same snapshot can regenerate same non-AI frames assuming same engine/codecs/fonts and environment. AI generated media is fixed asset once accepted; rerun is not assumed deterministic unless model/seed permits.


## Auto Polish API extension
See `14-AUTO-POLISH.md` for `AutoPolishRequest`, `EditProposal`, capability checks, async job/result contracts, `base_revision` checks, typed dependency/conflict relationships, and transactional apply/undo. Timings use rational timebase; proposals are ephemeral revision-scoped state.
