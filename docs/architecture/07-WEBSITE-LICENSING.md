# Website, licensing, pricing, releases

## Public and private surfaces
Marketing Astro static localized pages; React/Vite customer portal and restricted admin; Rust Axum backend on PostgreSQL; signed installer and content storage. Public site pages Home / Features / Download / Pricing / Templates / Tutorials / Changelog / Help / Legal. Marketing main copy: `No watermark. No account required. Works offline.` Avoid promising AI is available without models. Internal prior working site names replaced by PixCut in user-facing copy, pending brand checks.

## Accounts and licenses
No account to start Free, use bundled templates, create/save/1080p export, or receive security updates. Pro purchase can create account or redeem key. Server authoritative for purchase, license and activated devices, issued Ed25519-signed entitlements cached locally in Rust for disclosed offline interval. Pro loss never deletes project. Two-device proposal with self-service deactivation; device ID privacy-preserving, not invasive fingerprint. License server outage cannot block base editing. Cloud AI separately requires authentication and server-authoritative credits.

## Proposed pricing (not market-validated)
Free €0; Pro €3.99/month, €29.99/year, optionally €59 perpetual desktop feature-set with defined update entitlement; optional hosted AI pay-per-use/credits. Never sell watermark removal. Clear VAT/tax/merchant-of-record policy, refunds and customer portal. Free vs Pro feature flags centralized in Rust, not React-only.

## Update admin and security
Admin can upload/promote signed releases, rollout cohorts, revoke release, view update failures, manage product licenses/credit balances, and audit actions. Payment webhooks signed and idempotent. Passkeys/MFA for admin, least-privilege roles, encrypted backups, dependency scans, CSP, CSRF and rate limits; never hardcode secrets into the Tauri binary. Verify trademark and domain for PixCut before external launch; no assumption `pixcut.com` available.
