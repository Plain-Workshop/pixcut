# CHANGED: Website — Vidit-Inspired Showcase, Original Execution

## Strategic direction
Website should LOOK like a polished product demonstration, with large authentic PixCut editor screenshots, rich sections exposing different features, and obvious `Download Free` CTA. The user particularly likes Vidit's approach of showing different parts of the application. Use as inspiration only: https://www.behance.net/gallery/178966769/Vidit-Landing-Page-for-Video-Editing-App — no copying assets or markup.

## Public pages / sections now specified
1. **Homepage**: dark premium hero, `Create amazing videos, easily`, prominent real editor on laptop/browser-independent desktop mockup, primary `Download Free`, secondary `See how it works`. Three badges: No watermark, Works offline, No required account. Windows/macOS/Linux availability shown only when installers shipped.
2. **Features**: alternating screenshot+copy sections: Timeline editing, Text/titles, Colors/filters, Speed/fades, Photo Movie, Templates, Export. Each showing a real app feature and real state.
3. **Templates**: curated cards for Travel, Family, Birthday, Product, Social; short playable previews with clear license/free status.
4. **Download**: OS-detected primary download, manual choice and signatures/checksums links, version and requirements; no signup wall.
5. **Pricing**: precise Free vs Pro matrix; Free watermark-free 1080p; Pro 4K/batch/premium; optional AI clearly separate. Do not invent prices beyond product plan.
6. **Docs**: beginner onboarding, printable shortcuts, advanced timeline guides, offline troubleshooting.
7. **Support**: FAQ, release notes, support/contact path, no mandatory user account to read docs.

## Layout behavior
- Desktop nav: Features / Templates / Pricing / Download / Help; right CTA Download Free.
- Big hero mockup, not a generic AI picture; use screenshots from real app.
- Smooth, low-cost interactions. Avoid autoplay hero video with sound; respect reduced motion.
- Responsive mobile: rearrange screenshots vertically, trim shadows, keep CTA above fold.
- Accessibility: contrast, keyboard navigation, alt labels, visible focus, lazy-load screenshots below fold, optimized WebP/AVIF with correct aspect ratios.

## Tauri app and website handoff
In CI, capture/curate real PixCut UI screenshots as versioned marketing assets after QA. Website must not promise features absent from app. Screenshots on site should agree with actual app version. Use an asset manifest carrying version, locale, aspect ratio, screen name, license.

## Existing architecture stays
Astro marketing site, React/Vite customer/admin, Axum licensing/updates backend and PostgreSQL; Cloudflare CDN, offline Free editing. Do not rebuild architecture because of design update.

## Web acceptance
Each feature section links to appropriate documentation. Website's shortcodes, naming and screenshots match app. From fresh browser homepage to native installer download in <=2 clicks. Pricing and watermark promises unambiguous.
