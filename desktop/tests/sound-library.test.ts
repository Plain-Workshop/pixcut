import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALLOWED_LICENSES, CATEGORIES, specProblem } from '../scripts/import-sounds.mjs';
import { soundNeedsCredit, RECORDED_SOUND_CATEGORIES, SOUND_LICENSES, createRecordedSoundClip, creditForRecordedClip, parseSoundManifest, recordedSoundClipName, recordedSoundCredit, searchRecordedSounds, soundEntryProblem, type RecordedSound } from '../src/stores/sound-library';
import { SOUND_CATALOG } from '../src/components/elements/sound-catalog';
import { emptyProject, edit, type Scene } from '../src/stores/model';

const publicDir = path.resolve(__dirname, '..', 'public');
const bundled = JSON.parse(readFileSync(path.join(publicDir, 'sounds', 'manifest.json'), 'utf8')) as unknown[];

const sound = (patch: Partial<RecordedSound> = {}): RecordedSound => ({ id: 'applause-small', label: 'Small applause', category: 'Crowd & voices', seconds: 4, file: 'sounds/applause-small.m4a', license: 'CC0 1.0', author: 'Someone', source: 'https://freesound.org/s/1/', tags: ['clap', 'crowd'], ...patch });
const scene: Scene = { id: 's', name: 'Scene', image: 'data:image/png;base64,AA==', startTicks: 0, sourceInSeconds: 0, sourceInTicks: 0, durationTicks: 120, title: '', subtitle: '', color: '#FFFFFF', fit: 'cover' } as Scene;

describe('bundled recorded sounds', () => {
  it('lists only redistributable licences and complete credits', () => {
    for (const entry of bundled) expect(soundEntryProblem(entry), JSON.stringify(entry)).toBeNull();
    const ids = (bundled as RecordedSound[]).map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ships every listed file at a sane size and never collides with a synthesized id', () => {
    const synthesized = new Set(SOUND_CATALOG.map(item => item.id));
    for (const entry of bundled as RecordedSound[]) {
      const file = path.join(publicDir, entry.file);
      expect(existsSync(file), entry.id).toBe(true);
      expect(statSync(file).size, entry.id).toBeLessThan(400_000);
      expect(synthesized.has(entry.id), entry.id).toBe(false);
    }
  });

  it('keeps the import script and the app in agreement', () => {
    expect([...ALLOWED_LICENSES]).toEqual([...SOUND_LICENSES]);
    expect([...CATEGORIES]).toEqual([...RECORDED_SOUND_CATEGORIES]);
  });
});

describe('sound manifest validation', () => {
  it('accepts CC0 and CC BY entries', () => {
    expect(soundEntryProblem(sound())).toBeNull();
    expect(soundEntryProblem(sound({ license: 'CC BY 4.0' }))).toBeNull();
  });

  it.each(['CC BY-NC 4.0', 'CC BY-ND 4.0', 'Pixabay Content License', 'Mixkit', 'Unknown', ''])('rejects licence %s', license => {
    expect(soundEntryProblem(sound({ license: license as never }))).toMatch(/licence|required/);
  });

  it('rejects malformed entries instead of throwing', () => {
    for (const bad of [null, 4, {}, sound({ id: 'Bad Id' }), sound({ seconds: 0 }), sound({ seconds: 99 }), sound({ file: '../x.m4a' }), sound({ file: 'sounds/x.wav' }), sound({ source: 'http://example.com' }), sound({ category: 'Nope' }), sound({ author: ' ' })]) {
      expect(soundEntryProblem(bad), JSON.stringify(bad)).not.toBeNull();
    }
  });

  it('parses a manifest by dropping invalid and duplicate entries', () => {
    const parsed = parseSoundManifest([sound(), sound(), sound({ id: 'nc', license: 'CC BY-NC 4.0' as never }), 'junk']);
    expect(parsed.map(item => item.id)).toEqual(['applause-small']);
    expect(parseSoundManifest({ not: 'an array' })).toEqual([]);
  });
});

describe('credits, search and clips', () => {
  const library = [sound(), sound({ id: 'laugh-crowd', label: 'Crowd laugh', license: 'CC BY 4.0', author: 'Ada', tags: ['laughter'] })];

  it('credits only CC BY sounds', () => {
    expect(soundNeedsCredit(library[0])).toBe(false);
    expect(soundNeedsCredit(library[1])).toBe(true);
    expect(recordedSoundClipName(library[0])).toBe('Small applause');
    expect(creditForRecordedClip('Small applause', library)).toBeNull();
    expect(creditForRecordedClip('Crowd laugh · Ada', library)).toBe(recordedSoundCredit(library[1]));
    expect(recordedSoundCredit(library[1])).toContain('CC BY 4.0');
  });

  it('searches labels and tags by category', () => {
    expect(searchRecordedSounds(library, '')[0].sounds).toHaveLength(2);
    expect(searchRecordedSounds(library, 'LAUGHTER')[0].sounds.map(item => item.id)).toEqual(['laugh-crowd']);
    expect(searchRecordedSounds(library, 'zzz')).toEqual([]);
  });

  it('places a clip on the first free lane and clamps it to the project', () => {
    const project = edit(emptyProject(), { type: 'add', scenes: [scene] });
    const first = createRecordedSoundClip(project, library[0], 'data:audio/mp4;base64,AA==', 10)!;
    expect(first.name).toBe('Small applause');
    expect(first.lane).toBe(0);
    expect(first.startTicks).toBe(10);
    expect(first.startTicks + first.durationTicks).toBeLessThanOrEqual(120);
    const second = createRecordedSoundClip({ ...project, audio: [first] }, library[1], 'data:audio/mp4;base64,AA==', 10)!;
    expect(second.lane).toBe(1);
    expect(createRecordedSoundClip(emptyProject(), library[0], 'x', 0)).toBeNull();
  });
});

const ffmpegAvailable = spawnSync('ffmpeg', ['-version']).status === 0 && spawnSync('ffprobe', ['-version']).status === 0;
describe('import script', () => {
  it('rejects non-redistributable licences and bad metadata before touching any file', () => {
    const base = { input: 'a.wav', id: 'a-sound', label: 'A', category: 'Foley', license: 'CC0 1.0', author: 'x', source: 'https://example.com/a' };
    expect(specProblem(base)).toBeNull();
    expect(specProblem({ ...base, license: 'CC BY-NC 4.0' })).toMatch(/not redistributable/);
    expect(specProblem({ ...base, license: 'Pixabay Content License' })).toMatch(/not redistributable/);
    expect(specProblem({ ...base, source: 'file:///x' })).toMatch(/https/);
    expect(specProblem({ ...base, maxSeconds: 60 })).toMatch(/maxSeconds/);
    expect(specProblem({ ...base, input: '' })).toMatch(/input/);
  });

  it.skipIf(!ffmpegAvailable)('converts a file to a short mono AAC and refuses a rejected licence', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pixcut-sounds-'));
    try {
      const generate = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=20', path.join(dir, 'tone.wav')]);
      expect(generate.status).toBe(0);
      const specFile = path.join(dir, 'spec.json');
      const script = path.resolve(__dirname, '..', 'scripts', 'import-sounds.mjs');
      const spec = (license: string) => JSON.stringify([{ input: 'tone.wav', id: 'test-tone', label: 'Test tone', category: 'Interface', license, author: 'Test', source: 'https://example.com/tone', maxSeconds: 3 }]);

      writeFileSync(specFile, spec('CC BY-NC 4.0'));
      const rejected = spawnSync('node', [script, dir, specFile, '--dry-run'], { encoding: 'utf8' });
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toContain('not redistributable');

      writeFileSync(specFile, spec('CC0 1.0'));
      const checked = spawnSync('node', [script, dir, specFile, '--dry-run'], { encoding: 'utf8' });
      expect(checked.status).toBe(0);
      expect(checked.stdout).toContain('checked test-tone');
      expect(existsSync(path.join(publicDir, 'sounds', 'test-tone.m4a'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
