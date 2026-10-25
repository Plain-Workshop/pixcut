# AI generation, image outpainting and video regeneration

## UX entrypoints
`AI Studio` page and contextual `AI Adapt` inspector. Commands: Create image, Generate thumbnail, Extend image, Recompose for social, Remove/Replace selected region, Enhance image, Image-to-video, Extend video duration, Outpaint video canvas, Regenerate range. Always distinguish **spatial outpainting** from **temporal clip extension**.

## Image extension flow
1. Select photo and target 16:9 / 9:16 etc.
2. Preview fast Crop and Fit methods before AI.
3. Display masked expanded canvas; center/source region locked by default; brush editable regenerate mask.
4. Optional reference images, prompt, negative prompt if provider supports, style strength, seed, preserve-face/product boundary.
5. Show price/time/VRAM estimate where known and input privacy warning; require explicit Run.
6. Generate 1–4 versioned candidates; view A/B/swipe and compare to original; Select, Regenerate, Change Mask, Revert.
7. Accepted result is new asset referenced in variant; original stays unmodified, prompt/model/params/seed attached to generated asset.

## Video spatial outpainting (research-stage)
First ship background duplication/blur and smart crop; later segmented ranges with temporally consistent generators. Process cut-scene spans, not arbitrary entire long timelines. Preserve original video and audio, expand per-frame boundary region, enforce continuity at chunk overlap and shot changes, optional stabilization, face-preservation and camera tracking. Provide flicker score/preview, human approval for each generated range. Fail gracefully to fit/crop; experimental badge until reproducibility and QA pass. Never promise perfectly consistent outputs.

## AI model execution
`AiJob` includes task type, source hashes, provider, model revision, runtime settings, masks/reference ids, target geometry, entitlement/cost estimate, status, progress, candidate assets and errors. Durable queue statuses: queued, downloading, preparing, running, paused-if-supported, completed, failed, canceled. Jobs are idempotent where possible. Persist metadata in SQLite, binary assets in content-addressed files, avoid storing API keys in project file.

## Provider interface
`discover_capabilities`, `estimate`, `validate`, `submit`, `poll_or_stream`, `cancel`, `download_result`, `health`, `terms`; supports local ONNX/other runtime workers, locally hosted HTTP service, optional remote user server, and cloud API. Capability flags distinguish image-outpaint, inpaint, image-to-video, video-outpaint, ASR, TTS, enhance. Never imply every provider supports every feature. Use model cards with hardware requirements, commercial rights, usage price, privacy and revision.

## Reliability, privacy, abuse controls
Consent before uploading media externally, visible provider name and retention policy link, credit confirmation, prompt history opt-out, sensitive media local-processing choice, encrypted credentials in OS keychain, input-size validation, generated provenance. Do not fabricate model capability, pricing or IP rights. Reject unsafe or unsupported inputs and surface clear reason. User must be able to delete cached AI data.

## Quality assessment
Test subject preservation, boundary seam artifacts, composition, title-safe region, video temporal flicker, color/exposure match and reconstruction hallucinations. Keep sample gallery with expected failure cases (hands, hair, water, patterns, moving backgrounds) and compare provider models on a reproducible suite.
