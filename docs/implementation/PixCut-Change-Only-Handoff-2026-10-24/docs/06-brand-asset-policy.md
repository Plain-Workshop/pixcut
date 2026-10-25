# NEW: PixCut Branding Lock and Agent Guardrails

## Problem to solve
Coding agent created unrelated, unattractive or inconsistent PixCut app icon/logo. AI visual generation is NOT a reliable way to reproduce one approved mark precisely. We must provide a reusable vector source and prohibit automatic replacement.

## Immediate policy
- Treat `brand/pixcut-symbol.svg` and `brand/pixcut-wordmark.svg` as **canonical provisional source assets** in this change package. Generated as explicit editable vectors; user may request replacement later.
- `brand/pixcut-app-icon-1024.png` and PNG sizes are **derived from that SVG**, not new independently designed logos.
- Do not generate, redraw, recolor, stretch, rotate or swap the brand mark without explicit approval.
- Use the same symbol in app icons, website header, installer, splash/about, help and update dialog.
- `PixCut` wordmark capitalization is fixed. Do not call the product Pixcut or Pix Cut.
- Keep an `assets/brand` directory in repository, checksum source files, remove stray generated logos, centralize component references (`<BrandLogo/>`).

## Production constraints
- Dark/light background variants; safe margin 12% inside square icon.
- Icon must still be recognizable at 16–32px. Do not put full text inside the app icon.
- Use SVG for website and UI, raster OS-specific icons generated from source for installers and taskbars. macOS `.icns`, Windows `.ico`, Linux PNGs produced by build pipeline.
- Do not use unlicensed inspiration images as production website assets. Generated reference boards are illustrative.
- Before public launch, user approves final mark and legal brand clearance is performed separately. Do not claim this prototype is trademark-safe.

## Exact coding agent instruction (paste into ticket)
`Replace all project logos/icons with the exact files under brand/. No new AI-generated logo, no substitution with Lucide play icon, no improvised typography. Build a BrandLogo component using the SVG and a deterministic icon build script. Provide screenshots at 16, 32, 64, 256px on light/dark backgrounds. Confirm all app + website entry points use the same asset. Keep current design until the user approves replacement.`

## If user doesn't like delivered provisional mark
Commission or iterate one separate brand task: offer 2–3 static directions, user explicitly selects ONE, deliver approved master SVG + color variants + favicon/app-icon set. Only then update references. Avoid visual drift by no brand recreation during app work.
