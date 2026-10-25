# PixCut

PixCut is an **open-source, local-first video editor** for Windows, macOS and Linux. This repository contains the desktop app and its static project website.

- **Website:** https://plain-workshop.github.io/pixcut/
- **Source:** https://github.com/Plain-Workshop/pixcut
- **Issues:** https://github.com/Plain-Workshop/pixcut/issues
- **Discussions:** https://github.com/Plain-Workshop/pixcut/discussions

No account. No watermark. No hosted PixCut service. Every feature is included — there are no paid tiers, license keys, or device limits.

## What is here

```text
desktop/                  Tauri + React desktop editor
web/frontend/website/     Static Astro project site
scripts/                  Static-site link and base-path helpers
```

The project is English-only for now.

## Website

```sh
npm ci
npm run dev       # http://127.0.0.1:4321
npm run build
npm run preview
node scripts/check-links.mjs
```

The site links downloads to GitHub Releases, support to Issues/Discussions, and describes the desktop editor.

## Desktop app

```sh
cd desktop
npm ci
npm run dev       # browser preview
npm run desktop   # native Tauri app
npm test
npm run build
```

Requirements: Node.js 22+, Rust stable, Tauri platform prerequisites, and FFmpeg with H.264 support for MP4 export. See `desktop/README.md`.

## Contributing

See `CONTRIBUTING.md`. Small, focused pull requests are welcome. Sign off commits with `git commit -s` (DCO).

- Report bugs and request features: GitHub Issues
- Ask questions: GitHub Discussions
- Security reports: private vulnerability reporting, see `SECURITY.md`

## License

- **Code:** MIT OR Apache-2.0 (`LICENSE-MIT`, `LICENSE-APACHE`)
- **Website content and documentation:** CC BY 4.0 (`LICENSE-CONTENT`)
- **PixCut name and logo:** all rights reserved (`TRADEMARK.md`)
- **Third-party components:** see `THIRD_PARTY_NOTICES.md`

FFmpeg is not bundled. If you redistribute an FFmpeg build, review its license flags and any codec obligations.
