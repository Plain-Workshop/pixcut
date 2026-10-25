# Optional local and remote AI (no AI-first UX)

## Default behavior
No AI downloads, background model executions, inference connections, outgoing source-media uploads, AI accounts, or paid job submissions until user deliberately enables relevant tools. Base app fully functional offline, without GPU model dependencies.

## Contextual AI entry points
Crop inspector: `Extend background (AI)` behind `More`; caption editor: `Transcribe automatically`; selected scene: `Generate variation`; thumbnail studio: `Create background`; scripts: optional `Draft with AI`. Always include manual crop/blur fill, typed captions, static templates and normal effects alternatives. Before any remote execution show destination provider, exact media region/file payload, cost estimate when known, expected outputs and permissions; offer cancel. Never auto-upload source content.

## Provider architecture
Rust `InferenceTask` typed contract with capabilities `text`, `image`, `video`, `speech`, `mask`, `outpaint`, `embed`, model version, pixel/duration limits, pricing estimate, cancel/resume. Adapters: locally installed workers; remote user-managed OpenAI-compatible endpoints if capability supports it; ComfyUI-compatible job adapter; hosted backends via PixCut proxy. Unsupported provider methods must have explicit adapter, not assumed interchangeable. Credentials in OS keychain (not project JSON); redact logs. For hosted credits server enforces payment and metering; BYO providers billed by provider.

## Non-destructive outputs
Generation version tree (source, mask, prompt, seed when present, provider, model id, create time); regenerate only selected region or timeline range; locked subject protection; preserve source; allow reject/revert. Video outpainting is later experimental because temporal coherence is hard; use simple blurred/duplicated fill as offline default. Budget ceiling, queue limits, warnings and opt-in network consent.

## Threat model
Plugins/model workers run with least privileges, signed packages/manifests, permission-gated filesystem/network, SSRF-restricted hosted endpoints, bounded downloads and decode limits; no untrusted code auto-run. External providers receive explicit privacy labeling; uninstall models without touching projects.
