# Releasing PixCut Desktop

PixCut ships through GitHub Releases and updates itself with Tauri's updater. Every release is built on GitHub's macOS, Windows, and Linux runners, then published as a **draft** for review.

## One-time setup

### Updater signing key

The updater key is already generated. It lives outside git:

- `../.secrets/pixcut-updater.key` — private key, password protected
- `../.secrets/updater-key-password.txt` — password
- `../.secrets/pixcut-updater.key.pub` — public key, also embedded in `src-tauri/tauri.conf.json`

GitHub Actions secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` are set.

> Back up `.secrets/` somewhere safe. If the private key is lost, installed copies can never be updated again — they would need a manual reinstall of a build signed with the new key.

To rotate the key, generate a new pair with `npm run tauri -- signer generate`, replace `plugins.updater.pubkey`, update both secrets, and publish a manual download. Older installs will reject updates signed with the new key.

### Code signing (required for a public release)

macOS:

| Secret | Value |
| --- | --- |
| `APPLE_CERTIFICATE` | base64 of the Developer ID Application `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | password for that `.p12` |
| `APPLE_SIGNING_IDENTITY` | optional, e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | Apple account email |
| `APPLE_PASSWORD` | app-specific password |
| `APPLE_TEAM_ID` | 10-character team ID |

Alternatively set `APPLE_API_KEY`, `APPLE_API_ISSUER`, and `APPLE_API_KEY_PATH` for App Store Connect key notarization.

Windows:

| Secret | Value |
| --- | --- |
| `WINDOWS_CERTIFICATE` | base64 of the code-signing `.pfx` |
| `WINDOWS_CERTIFICATE_PASSWORD` | password for that `.pfx` |

Tag builds fail fast when these are missing, so an unsigned build can never reach users through a tag. Manual runs are allowed to be unsigned.

## Cut a release

1. Bump the version in every manifest:

   ```sh
   cd desktop
   npm run version:set 0.2.0
   ```

2. Commit the bump, then tag and push:

   ```sh
   git add -A
   git commit -m "release: 0.2.0"
   git tag v0.2.0
   git push origin main --tags
   ```

3. The `Release` workflow builds:

   | Platform | Assets |
   | --- | --- |
   | macOS Apple Silicon | `.dmg`, `.app.tar.gz`, signature |
   | macOS Intel | `.dmg`, `.app.tar.gz`, signature |
   | Windows x64 | NSIS `-setup.exe`, `.msi`, portable `.zip`, signature |
   | Linux x86_64 | `.AppImage`, `.deb`, signature |

   plus `latest.json` and `SHA256SUMS.txt`.

4. Review the **draft** release. Install the DMG or setup file on a real machine, confirm the app opens, then publish. Drafts are not visible to the updater; publishing is what makes `releases/latest/download/latest.json` resolve.

### Dry run

Run **Actions → Release → Run workflow** with `release` unchecked. The workflow builds and uploads workflow artifacts without creating a release, and signing secrets are optional.

## How updates reach users

- Settings → Updates → **Check for updates**.
- The app reads `https://github.com/Plain-Workshop/pixcut/releases/latest/download/latest.json`.
- It verifies the Tauri signature before installing and shows the version notes.
- Installation is followed by an explicit **Restart to update**.
- Checks happen only when the user asks; nothing is fetched while editing or exporting.

The feed uses these platform keys:

| Key | Artifact |
| --- | --- |
| `darwin-aarch64` | `PixCut-<version>-macos-aarch64.app.tar.gz` |
| `darwin-x86_64` | `PixCut-<version>-macos-x64.app.tar.gz` |
| `windows-x86_64` | `PixCut-<version>-windows-x64-setup.exe` |
| `linux-x86_64` | `PixCut-<version>-linux-x86_64.AppImage` |

Windows updates need the **NSIS** installer; the MSI cannot self-update. macOS updates require the app to stay signed with the same Developer ID across versions.

## Verification in the pipeline

Each build job checks its own output before upload:

- macOS: `codesign --verify`, `spctl --assess`, `stapler validate` on the DMG, and the DMG mounts with `PixCut.app` inside.
- Windows: Authenticode status is `Valid` for both installers, and the portable zip is produced.
- Linux: `dpkg-deb` lists the binary, and the AppImage extracts to a runnable `AppRun`.

`scripts/assemble-release.mjs` refuses to write `latest.json` if an updater artifact, its `.sig`, or its signature body is missing.

## FFmpeg

MP4 export shells out to a system FFmpeg. The macOS and Windows installers do not bundle it; the `.deb` declares `ffmpeg` as a dependency. Release notes should keep saying that export needs FFmpeg installed.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `A public key has been found, but no private key` | `TAURI_SIGNING_PRIVATE_KEY` is not set. Export it locally before `tauri build`. |
| Release job fails at "Require signing secrets" | A tag build has no Apple or Windows certificate. Use a dry run, or add the secrets. |
| Updater says it is up to date right after publishing | The release is still a draft, or `latest.json` is missing a platform entry. |
| DMG build fails with `Resource busy` | Run locally with `CI=true` so the bundler skips Finder styling. GitHub Actions sets this automatically. |
