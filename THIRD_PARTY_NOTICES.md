# Third-party notices

PixCut is built with open-source software. Each dependency remains under its
own license. This file is a summary, not a replacement for the license files
shipped by those projects.

- **Rust / Tauri / React / Astro**: see the lockfiles and upstream projects.
- **FFmpeg**: the desktop app expects FFmpeg on the user's PATH. FFmpeg can be
  built under LGPL-2.1+ or GPL-2.0+ depending on configure flags. If you
  redistribute FFmpeg, review the exact build and comply with its license.
- **x264 and other codec libraries**: GPL or commercial licensing may apply.
  Do not bundle them without a license review.
- **Images and templates**: see the metadata and license fields in
  `web/frontend/website/src/data/templates.ts`.

The PixCut source code is MIT OR Apache-2.0. Website prose is CC BY 4.0. The
PixCut name and logo are covered by `TRADEMARK.md`, not the code licenses.
