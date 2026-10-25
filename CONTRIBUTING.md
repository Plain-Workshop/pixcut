# Contributing to PixCut

Thanks for helping. PixCut is a volunteer, open-source project.

## Before you start

- Search existing issues and discussions.
- Open an issue before a large change so the approach can be agreed.
- Keep pull requests focused. One problem per PR is easier to review.

## Development

```sh
git clone https://github.com/Plain-Workshop/pixcut.git
cd pixcut
npm ci
npm run dev                 # static website
cd desktop
npm ci
npm run dev                 # browser preview
npm run desktop             # native Tauri app
```

Requirements: Node.js 22+, Rust stable, Tauri platform prerequisites, and
FFmpeg with H.264 support for MP4 export. See `desktop/README.md`.

## Checks

```sh
npm run build
node scripts/check-links.mjs

cd desktop
npm test
npm run build
```

## Pull requests

- Explain the problem and the change.
- Include before/after screenshots for UI changes.
- Add or update tests where practical.
- Keep documentation in sync.
- Sign off commits with the Developer Certificate of Origin:

```sh
git commit -s -m "fix: ..."
```

The sign-off certifies that you wrote the change or have the right to submit it
under the project license. There is no copyright assignment.

## Licensing

Code contributions are licensed under **MIT OR Apache-2.0**. Website content
contributions are licensed under **CC BY 4.0**. By opening a pull request you
agree to those terms.

## Conduct

All participation is covered by `CODE_OF_CONDUCT.md`. Be constructive and
assume good intent.
