#!/usr/bin/env node
// Single source of truth for the desktop app version.
//
//   node scripts/version.mjs            print the current version
//   node scripts/version.mjs set 0.2.0  update every manifest that carries it
//
// Tauri reads the version from tauri.conf.json; Cargo, npm and the release
// workflow read the same value from the files this script keeps in sync.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const files = {
  tauri: join(root, 'src-tauri', 'tauri.conf.json'),
  package: join(root, 'package.json'),
  lock: join(root, 'package-lock.json'),
  cargo: join(root, 'src-tauri', 'Cargo.toml'),
  cargoLock: join(root, 'Cargo.lock'),
};

function read(path) {
  return readFileSync(path, 'utf8');
}

function currentVersion() {
  return JSON.parse(read(files.tauri)).version;
}

function setVersion(version) {
  if (!SEMVER.test(version)) {
    throw new Error(`"${version}" is not a version like 0.2.0 or 0.2.0-rc.1`);
  }

  const tauri = JSON.parse(read(files.tauri));
  tauri.version = version;
  writeFileSync(files.tauri, `${JSON.stringify(tauri, null, 2)}\n`);

  const pkg = JSON.parse(read(files.package));
  pkg.version = version;
  writeFileSync(files.package, `${JSON.stringify(pkg, null, 2)}\n`);

  const lock = JSON.parse(read(files.lock));
  lock.version = version;
  if (lock.packages?.['']) lock.packages[''].version = version;
  writeFileSync(files.lock, `${JSON.stringify(lock, null, 2)}\n`);

  const cargo = read(files.cargo).replace(/^version = "[^"]*"/m, `version = "${version}"`);
  writeFileSync(files.cargo, cargo);

  const cargoLock = read(files.cargoLock).replace(
    /(name = "pixcut"\nversion = ")[^"]*(")/,
    `$1${version}$2`,
  );
  writeFileSync(files.cargoLock, cargoLock);
}

const [command, value] = process.argv.slice(2);
if (!command) {
  console.log(currentVersion());
} else if (command === 'set' && value) {
  setVersion(value);
  console.log(`PixCut ${value}`);
} else if (command === 'check') {
  const version = currentVersion();
  const cargo = read(files.cargo).match(/^version = "([^"]*)"/m)?.[1];
  const pkg = JSON.parse(read(files.package)).version;
  const mismatch = [
    cargo !== version && `Cargo.toml is ${cargo}`,
    pkg !== version && `package.json is ${pkg}`,
  ].filter(Boolean);
  if (mismatch.length) {
    console.error(`Version mismatch: tauri.conf.json is ${version}; ${mismatch.join('; ')}`);
    process.exit(1);
  }
  console.log(version);
} else {
  console.error('Usage: node scripts/version.mjs [check | set <version>]');
  process.exit(2);
}
