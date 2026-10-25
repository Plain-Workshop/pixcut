#!/usr/bin/env node
// One command for everything CI checks. Run from the repository root:
//   npm run ci
// Use --fast to skip the site build and the slower native suite.
import { spawnSync } from 'node:child_process';

const fast = process.argv.includes('--fast');
let failed = 0;

function run(label, command, args, cwd = '.') {
  process.stdout.write(`\n\x1b[1m▸ ${label}\x1b[0m\n`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    failed += 1;
    process.stderr.write(`\x1b[31m✗ ${label}\x1b[0m\n`);
    return false;
  }
  return true;
}

function which(command) {
  const probe = spawnSync('sh', ['-c', `command -v ${command}`], { stdio: 'ignore' });
  return probe.status === 0;
}

function optional(label, command, args) {
  if (!which(command)) {
    process.stdout.write(`\n\x1b[2m▸ ${label}: skipped (not installed)\x1b[0m\n`);
    return true;
  }
  return run(label, command, args);
}

if (!fast && !run('Website build', 'npm', ['run', 'build'])) process.exit(1);
if (!fast && !run('Website links', 'node', ['scripts/check-links.mjs'])) process.exit(1);
if (!run('Desktop tests', 'npm', ['test'], 'desktop')) process.exit(1);
if (!run('Desktop build', 'npm', ['run', 'build'], 'desktop')) process.exit(1);
if (!run('Version consistency', 'node', ['scripts/version.mjs', 'check'], 'desktop')) process.exit(1);
if (!run('Project model tests', 'cargo', ['test', '-p', 'pixcut-project'], 'desktop')) process.exit(1);
if (!fast && !run('Native tests', 'cargo', ['test', '--manifest-path', 'src-tauri/Cargo.toml'], 'desktop')) process.exit(1);
optional('Workflow lint', 'actionlint', ['.github/workflows/release.yml', '.github/workflows/ci.yml', '.github/workflows/packaging-lint.yml', '.github/workflows/scorecard.yml']);
optional('Rust advisories', 'cargo', ['audit', '--ignore', 'RUSTSEC-2026-0367', '--ignore', 'RUSTSEC-2026-0368', '--ignore', 'RUSTSEC-2026-0369', '--file', 'desktop/Cargo.lock']);

if (failed) {
  process.stderr.write(`\n\x1b[31m${failed} step(s) failed\x1b[0m\n`);
  process.exit(1);
}
process.stdout.write('\n\x1b[32mAll checks passed.\x1b[0m\n');
