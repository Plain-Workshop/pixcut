# Free/Pro commercial model and compliance

## Proposal (prices to validate by regional pricing research)
Free: €0, no watermark, unlimited projects, editing tracks, text/overlays, basic transition/animation/keyframes, 1080p standard export, crop/fit, baseline caption edit, third-party/local AI access where supported. No mandatory account for local editor.
Pro: €3.99 monthly or €29.99 yearly proposed, optional €59 perpetual license for explicitly versioned features plus e.g. 12 months updates; determine final upgrade policy clearly. Adds high-res/custom advanced export, advanced motion/effects, premium templates, bulk exports, brand libraries, linked-variant power features, advanced motion tracking. Consider whether 4K export is better Free long-term; A/B test transparently.
AI cloud: credits independent of subscription, with cost estimate and explicit approval. Pro may offer small included credits only if unit economics allow. Local AI optional model download; do not restrict user's own compute arbitrarily.

## Rights upon downgrade
User can open/save projects, render free-compatible edits without watermark, retain media and export project file, inspect Pro effects already used. Editing/render restrictions must be explicit and never trap user content. Avoid aggressive nags, dark patterns, surprise auto-renewals.

## License system
One executable, feature flags validated in Rust and worker processes. Signed, short-lived entitlements with offline grace; no 'always-online' requirement for local editing. Separate `features` from cloud-credit balance. Payment provider hosted checkout, tax/VAT handling, receipt/invoice fulfillment, refund and chargeback handling, plan changes, secure entitlement refresh. No secret payment keys in desktop bundle.

## External code/media legal checks
Tauri licensing permissive, but every dependency has independent license. MLT core LGPLv2.1; installed plugins can differ. GStreamer/GES LGPL and codecs/plugins vary. FFmpeg can be LGPL or GPL depending build flags and optional libraries; do not use `--enable-gpl` in proprietary distribution without counsel-approved obligations. H.264/H.265/AAC codec patents, hardware SDK redistributability, font/music/template licenses, AI model weights and provider generated-content terms all require separate analysis. Do not treat LGPL as blanket permission to statically link proprietary distribution without compliance. Obtain professional legal advice for shipped closed-source desktop binaries.

## Product fairness
Pro badges only on premium assets/features; preview before purchase and explain export gating before user invests time; Free never places a watermark. Local projects not monetized via data sale. Telemetry opt-in and privacy policy concise.


## Auto Polish entitlement clarification
Free includes per-scene text readability, caption/overlay collision checks, safe-area and basic photo timing/beat/transition recommendations; Pro adds whole-project batching, custom branded policies, rich A/B variants and advanced temporal tracking (subject to installed models). See `14-AUTO-POLISH.md`. No paid AI inference is triggered automatically.
