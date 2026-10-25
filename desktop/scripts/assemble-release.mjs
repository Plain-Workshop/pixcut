#!/usr/bin/env node
// Assemble the updater feed and checksums for a release.
//
//   node scripts/assemble-release.mjs \
//     --version 0.1.0 \
//     --asset darwin-aarch64=dist/macos-aarch64/PixCut-0.1.0-macos-aarch64.app.tar.gz \
//     --asset windows-x86_64=dist/windows-x64/PixCut-0.1.0-windows-x64-setup.exe \
//     dist/macos-aarch64/PixCut-0.1.0-macos-aarch64.dmg \
//     --out dist/release
//
// Every --asset needs a sibling "<file>.sig" produced by Tauri's updater
// signing key. The script refuses to write a feed that points at a missing
// signature or an empty file.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const args = process.argv.slice(2);
function take(name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value) throw new Error(`${name} needs a value`);
  args.splice(index, 2);
  return value;
}
function takeAll(name) {
  const values = [];
  for (;;) {
    const value = take(name);
    if (value === undefined) return values;
    values.push(value);
  }
}

const version = take('--version');
const repo = take('--repo') ?? 'Plain-Workshop/pixcut';
const tag = take('--tag') ?? `v${version}`;
const out = resolve(take('--out') ?? 'dist/release');
const notesFile = take('--notes-file');
const notes = notesFile ? readFileSync(notesFile, 'utf8').trim() : (take('--notes') ?? '');
const assets = takeAll('--asset').map(entry => {
  const split = entry.indexOf('=');
  if (split < 1) throw new Error(`--asset must be target=path, got "${entry}"`);
  return { target: entry.slice(0, split), path: resolve(entry.slice(split + 1)) };
});
// Anything left after the flags is a plain artifact to checksum (dmg, msi, deb).
const checksums = args.map(path => resolve(path));
args.length = 0;

if (!version) throw new Error('--version is required');
if (!assets.length) throw new Error('at least one --asset is required');

mkdirSync(out, { recursive: true });

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function size(path) {
  return (statSync(path).size / 1024 / 1024).toFixed(1);
}

const copied = new Set();
function stage(path) {
  if (!existsSync(path)) throw new Error(`missing release file: ${path}`);
  if (statSync(path).size === 0) throw new Error(`empty release file: ${path}`);
  const destination = join(out, basename(path));
  if (!copied.has(destination)) {
    copyFileSync(path, destination);
    copied.add(destination);
  }
  return destination;
}

const platforms = {};
for (const asset of assets) {
  const file = stage(asset.path);
  const sigPath = `${asset.path}.sig`;
  if (!existsSync(sigPath)) throw new Error(`missing signature for ${asset.target}: ${sigPath}`);
  const signature = readFileSync(sigPath, 'utf8').trim();
  if (!signature) throw new Error(`empty signature for ${asset.target}`);
  platforms[asset.target] = {
    signature,
    url: `https://github.com/${repo}/releases/download/${tag}/${basename(file)}`,
  };
  console.log(`${asset.target.padEnd(18)} ${basename(file)} (${size(file)} MiB)`);
}

for (const path of checksums) stage(path);

const feed = {
  version,
  notes: notes || `PixCut ${version}`,
  pub_date: new Date().toISOString(),
  platforms,
};
if (Object.keys(platforms).length !== assets.length) throw new Error('platform map is incomplete');
writeFileSync(join(out, 'latest.json'), `${JSON.stringify(feed, null, 2)}\n`);

const sums = [...copied]
  .sort()
  .map(path => `${sha256(path)}  ${basename(path)}`)
  .join('\n');
writeFileSync(join(out, 'SHA256SUMS.txt'), `${sums}\n`);

console.log(`\nWrote ${basename(out)}/latest.json with ${Object.keys(platforms).length} platform(s) and SHA256SUMS.txt.`);
