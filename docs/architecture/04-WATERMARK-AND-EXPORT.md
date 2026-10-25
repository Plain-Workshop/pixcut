# Watermark-free exporting and voluntary branding policy

## Hard rules
- Free and Pro exports have **zero automatic PixCut visual watermarks, logos, borders or end slates**, at every permitted resolution, template, aspect ratio and platform export preset.
- No hidden metadata or audio advertisements masquerading as export content. Normal technical metadata is acceptable.
- The editable `Made with PixCut` outro is a standalone optional asset/scene OFF by default for new projects, imported projects and batch recipes. ON only via explicit opt-in; show its duration, thumbnail and sound behavior in main preview and timeline; user can delete it.
- Never add branding as a silent fallback when entitlement validation is unavailable. Free export proceeds offline.

## UX
Export dialog shows MP4/H.264 default, scale/FPS/preset/path/estimated output size; `No watermark` informational label. `Add optional PixCut outro` in secondary panel, disabled by default. If enabled, insert user-visible ending clip, adjustable duration 1–2s, safe background, optional sound OFF by default. Re-export retains per-project choice but does not force it onto new projects. Check no final-frame flash or unintended music cut.

## Pro restrictions
If 4K/advanced codec/Pro template chosen by Free user, explain restriction before render, with options `Use Free alternative`, `Change to 1080p`, `Learn about Pro`, or Cancel. Never render then add surprise watermark; never lock original project access. Maintain entitlement checks in Rust export worker, but independent of base Free export.

## Export QA
Golden-frame detection for absence of logo and branded overlays when switch OFF; both landscape and portrait; desktop fresh installation signed-out/offline; crash retry; re-export; mixed template media. Test optional outro true→false removes from render and timeline consistently. Render proprietary third-party supplied watermarks untouched unless editing user content is authorized.
