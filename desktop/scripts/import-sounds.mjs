#!/usr/bin/env node
// Imports recorded sound effects into public/sounds/ and updates manifest.json.
//
//   node scripts/import-sounds.mjs <source-dir> <spec.json> [--dry-run]
//
// spec.json is an array of entries:
//   { "input": "applause/clap-01.wav", "id": "applause-small", "label": "Small applause",
//     "category": "Crowd & voices", "license": "CC0 1.0", "author": "Name",
//     "source": "https://freesound.org/s/12345/", "tags": ["clap", "crowd"],
//     "start": 0, "maxSeconds": 8 }
//
// Only licences PixCut can redistribute are accepted (CC0 1.0, CC BY 4.0). Each file is
// trimmed, loudness-normalised and re-encoded to mono AAC so the bundle stays small.
// Needs ffmpeg and ffprobe on PATH. Source files are read, never modified.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ALLOWED_LICENSES = ['CC0 1.0', 'CC BY 4.0'];
export const CATEGORIES = ['Crowd & voices', 'Comedy & memes', 'Cinematic', 'Foley', 'Ambience', 'Interface', 'Transitions'];
export const MAX_SECONDS = 12;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const soundsDir = path.join(root, 'public', 'sounds');
const manifestPath = path.join(soundsDir, 'manifest.json');

/** Returns a problem description for a spec entry, or null. */
export function specProblem(entry) {
  if (!entry || typeof entry !== 'object') return 'entry is not an object';
  for (const key of ['input', 'id', 'label', 'category', 'license', 'author', 'source']) {
    if (typeof entry[key] !== 'string' || !entry[key].trim()) return `“${key}” is required`;
  }
  if (!ALLOWED_LICENSES.includes(entry.license)) return `licence “${entry.license}” is not redistributable (allowed: ${ALLOWED_LICENSES.join(', ')})`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.id)) return `id “${entry.id}” must be kebab-case`;
  if (!CATEGORIES.includes(entry.category)) return `unknown category “${entry.category}”`;
  if (!/^https:\/\//.test(entry.source)) return 'source must be an https URL to the original page';
  if (entry.maxSeconds !== undefined && !(entry.maxSeconds > 0 && entry.maxSeconds <= MAX_SECONDS)) return `maxSeconds must be within 0–${MAX_SECONDS}`;
  if (entry.start !== undefined && !(entry.start >= 0)) return 'start must be ≥ 0';
  if (entry.tags !== undefined && (!Array.isArray(entry.tags) || entry.tags.some(tag => typeof tag !== 'string'))) return 'tags must be strings';
  return null;
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) throw new Error(`${command} is not available: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr.trim().split('\n').slice(-3).join(' ')}`);
  return result.stdout;
}

function importOne(entry, sourceDir, dryRun) {
  const input = path.resolve(sourceDir, entry.input);
  if (!input.startsWith(path.resolve(sourceDir) + path.sep)) throw new Error('input must stay inside the source directory');
  if (!existsSync(input)) throw new Error(`input file not found: ${entry.input}`);
  const start = entry.start ?? 0, limit = Math.min(entry.maxSeconds ?? MAX_SECONDS, MAX_SECONDS);
  const probed = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', input]).trim());
  if (!(probed > start)) throw new Error('input has no audio after the start offset');
  const seconds = Math.round(Math.min(limit, probed - start) * 100) / 100;
  const file = `sounds/${entry.id}.m4a`;
  if (!dryRun) {
    mkdirSync(soundsDir, { recursive: true });
    const fade = Math.min(.03, seconds / 4);
    run('ffmpeg', ['-y', '-v', 'error', '-ss', String(start), '-t', String(seconds), '-i', input, '-vn', '-ac', '1', '-ar', '44100',
      '-af', `loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=${Math.max(0, seconds - fade)}:d=${fade}`,
      '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', path.join(root, 'public', file)]);
  }
  const { id, label, category, license, author, source, tags } = entry;
  return { id, label, category, seconds, file, license, author, source, ...(tags?.length ? { tags } : {}) };
}

function main() {
  const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const dryRun = process.argv.includes('--dry-run');
  if (args.length !== 2) { console.error('Usage: node scripts/import-sounds.mjs <source-dir> <spec.json> [--dry-run]'); process.exit(2); }
  const [sourceDir, specFile] = args;
  const spec = JSON.parse(readFileSync(specFile, 'utf8'));
  if (!Array.isArray(spec)) { console.error('The spec must be a JSON array.'); process.exit(2); }

  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [];
  const byId = new Map(manifest.map(entry => [entry.id, entry]));
  const failures = [];
  for (const entry of spec) {
    const problem = specProblem(entry);
    if (problem) { failures.push(`${entry?.id ?? '?'}: ${problem}`); continue; }
    try { byId.set(entry.id, importOne(entry, sourceDir, dryRun)); console.log(`${dryRun ? 'checked' : 'imported'} ${entry.id}`); }
    catch (error) { failures.push(`${entry.id}: ${error.message}`); }
  }
  if (!dryRun) {
    mkdirSync(soundsDir, { recursive: true });
    const sorted = [...byId.values()].sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.label.localeCompare(b.label));
    writeFileSync(manifestPath, `${JSON.stringify(sorted, null, 2)}\n`);
  }
  if (failures.length) { console.error(`\n${failures.length} entr${failures.length === 1 ? 'y' : 'ies'} skipped:\n- ${failures.join('\n- ')}`); process.exit(1); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
