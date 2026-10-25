# PixCut

PixCut is an **open-source, local-first video editor** for Windows, macOS and Linux. This repository contains the desktop app and its static project website.

No account. No watermark. No hosted PixCut service.

## What is here

```text
desktop/                  Tauri + React desktop editor
web/frontend/website/     Static Astro project site
docs/desktop/             Desktop architecture and plans
design/                   UI boards and brand assets
scripts/                  Static-site link and GitHub Pages helpers
```

The website is deployed to **GitHub Pages** and has no server runtime, database, API, customer portal or admin console.

## Website

```sh
npm ci
npm run dev       # http://127.0.0.1:4321
npm run build
npm run preview
node scripts/check-links.mjs
```

Environment:

```sh
PUBLIC_GITHUB_URL=https://github.com/pixcut/pixcut
PUBLIC_SPONSOR_URL=https://github.com/sponsors/pixcut
```

The site links downloads to GitHub Releases, support to Issues/Discussions, and describes the desktop editor. It is English-only for now.

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

## GitHub Pages

`.github/workflows/deploy.yml` builds the site and deploys it on pushes to `main`.

- Project site: `BASE_PATH=/<repository>` is set automatically.
- Custom domain or user site: set repository variables `SITE_URL` and `BASE_PATH=/`.
- `scripts/apply-base.mjs` prefixes hand-written absolute links when a base path is used.

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
