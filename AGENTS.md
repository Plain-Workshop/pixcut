# AGENTS.md — working on PixCut

PixCut is an **offline-first, open-source photo-movie editor** for macOS, Windows and Linux, built with Tauri 2, React/TypeScript and Rust. There is no account, cloud service, watermark, paid tier, license key or telemetry. Keep it that way.

## Commands

```sh
# Desktop
cd desktop
npm ci
npm run desktop        # native Tauri app
npm run dev            # browser preview
npm test               # TypeScript tests (vitest)
npm run build          # tsc + Vite
cargo test -p pixcut-project
cargo test --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml -- --ignored   # needs FFmpeg

# Website and static checks
npm run build
node scripts/check-links.mjs

# Everything CI runs, locally
npm run ci
```

## Architecture

```text
desktop/
  src/                  React app, canvas compositor, project store, shortcuts
  src/components/       preview, inspector, timeline, text, dialogs
  src/stores/           project model, assets, library, formats, preferences
  src-tauri/            Tauri shell, native dialogs, assets, FFmpeg export
  crates/project/       authoritative Rust project model and commands
  crates/*              media, render, audio, templates (being filled in)
web/frontend/website/   static Astro site
scripts/                site checks and repository CI
```

The frontend sends validated commands to Rust; Rust returns the new project snapshot. The browser preview uses the same model through IndexedDB. Preview and export share the canvas compositor.

## Rules

1. **Never crash.** A malformed project, odd file, full disk or bad command returns an actionable error. Do not add `unwrap()`/`expect()`/`panic!()` in non-test Rust. Command dispatch and both export paths are wrapped in `guard()`.
2. **Stay offline.** No accounts, analytics, remote fonts, cloud sync or background network calls. Optional update checks run on launch and daily while Home is open; never check while editing or exporting. Downloads require a user action.
3. **No paid features.** Every feature is available to everyone. Do not add license checks, limits, watermarks or upgrade prompts.
4. **Schema changes are migrations.** Update `desktop/src/stores/model.ts` and `desktop/crates/project/src/lib.rs` together, accept the old version, and add tests for both paths.
5. **Preview and export must match.** If you change text layout, framing, transitions, timing or color, verify both the canvas preview and the FFmpeg output.
6. **Tests and visuals.** Add tests for behavior changes. For UI changes, take a screenshot and look at it; do not trust the DOM alone.
7. **Keep the app running.** After implementation, run the tests, rebuild, and leave the desktop app running.
8. **Release safety.** Tags create drafts. Never publish an unsigned release without the warning it generates. The updater key in `.secrets/` is irreplaceable; never commit it.

## Where things live

- Project schema: `desktop/src/stores/model.ts`, `desktop/crates/project/src/lib.rs`
- Canvas rendering: `desktop/src/components/preview/render.ts`
- Video playback and probing: `desktop/src/components/preview/video.ts`
- Export plans: `desktop/src/app/App.tsx` → `desktop/src-tauri/src/lib.rs` (`encode_plan`)
- Updates: `desktop/src/app/bridge.ts`, Settings → Updates
- Release pipeline: `.github/workflows/release.yml`, `desktop/RELEASING.md`
- Current verification state: `desktop/VERIFICATION.md`
