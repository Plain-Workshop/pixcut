import { describe, expect, it, vi } from 'vitest';
import { buildDiagnostics, classifyDrop, countMissingAssets, type MissingCountDeps } from '../src/app/home-support';
import { emptyProject, type Project } from '../src/stores/model';

describe('diagnostics', () => {
  const input = { appVersion: '1.2.3', buildSha: 'abcdef0123456', buildDate: '2026-10-30', native: false, platform: 'macos', project: emptyProject(), exporter: false, preferences: { compact: true, reduceMotion: false, autosaveMs: 800 } };

  it('lists versions, runtime, project shape and preferences', () => {
    const lines = buildDiagnostics(input).split('\n');
    expect(lines[0]).toBe('PixCut Desktop 1.2.3');
    expect(lines[1]).toBe('Build: abcdef0 · 2026-10-30');
    expect(lines).toContain('Runtime: browser preview');
    expect(lines).toContain('FFmpeg: not found');
    expect(lines.at(-1)).toBe('Preferences: compact · full motion · autosave 800 ms');
    expect(lines.find(line => line.startsWith('Project: '))).toMatch(/^Project: \S+ · \d+ fps · 0\.0 s$/);
  });

  it('reports the native runtime and FFmpeg when present', () => {
    const text = buildDiagnostics({ ...input, native: true, exporter: true });
    expect(text).toContain('Runtime: native Tauri');
    expect(text).toContain('FFmpeg: available');
  });

  it('never includes the project name or any media', () => {
    expect(buildDiagnostics({ ...input, project: { ...emptyProject(), name: 'Secret holiday' } })).not.toContain('Secret holiday');
  });
});

describe('classifyDrop', () => {
  const file = (name: string, type = '') => ({ name, type });

  it('prefers a .pixcut project over everything', () => {
    const project = file('Trip.PIXCUT');
    expect(classifyDrop([file('a.jpg', 'image/jpeg'), project])).toEqual({ kind: 'project', file: project });
  });
  it('takes photos, ignoring other files in the drop', () => {
    const jpg = file('a.jpg', 'image/jpeg');
    expect(classifyDrop([jpg, file('b.mp4', 'video/mp4'), file('notes.txt', 'text/plain')])).toEqual({ kind: 'images', files: [jpg] });
  });
  it('takes videos when there are no photos', () => {
    const mp4 = file('b.mp4', 'video/mp4');
    expect(classifyDrop([mp4, file('c.txt')])).toEqual({ kind: 'videos', files: [mp4] });
  });
  it('refuses anything else, including an empty drop', () => {
    expect(classifyDrop([file('doc.pdf', 'application/pdf')])).toEqual({ kind: 'unsupported' });
    expect(classifyDrop([])).toEqual({ kind: 'unsupported' });
  });
});

describe('countMissingAssets', () => {
  const projectFor = (id: string) => ({ ...emptyProject(), id }) as Project;
  const refsById: Record<string, string[]> = { a: ['pixcut-asset:1', 'pixcut-asset:2'], b: [], c: ['pixcut-asset:3'] };
  const deps = (patch: Partial<MissingCountDeps> = {}): MissingCountDeps => ({
    load: async id => projectFor(id), refsOf: project => refsById[project.id] ?? [], nativeMissing: null,
    exists: async id => id === '1', isCancelled: () => false, ...patch,
  });

  it('counts missing browser assets per project and leaves out projects with none missing', async () => {
    expect(await countMissingAssets([{ id: 'a' }, { id: 'b' }, { id: 'c' }], deps())).toEqual({ a: 1, c: 1 });
  });
  it('asks the native shell when there is one', async () => {
    const nativeMissing = vi.fn(async (refs: string[]) => refs);
    expect(await countMissingAssets([{ id: 'a' }], deps({ nativeMissing }))).toEqual({ a: 2 });
    expect(nativeMissing).toHaveBeenCalledWith(['pixcut-asset:1', 'pixcut-asset:2']);
  });
  it('skips a project it cannot read and keeps going', async () => {
    const load = async (id: string) => { if (id === 'a') throw new Error('corrupt'); return projectFor(id); };
    expect(await countMissingAssets([{ id: 'a' }, { id: 'c' }], deps({ load }))).toEqual({ c: 1 });
    expect(await countMissingAssets([{ id: 'gone' }], deps({ load: async () => null }))).toEqual({});
  });
  it('looks at the first twelve projects only', async () => {
    const load = vi.fn(async (id: string) => projectFor(id));
    await countMissingAssets(Array.from({ length: 30 }, (_, index) => ({ id: `p${index}` })), deps({ load }));
    expect(load).toHaveBeenCalledTimes(12);
  });
  it('returns null once cancelled, so a stale answer is never shown', async () => {
    let cancelled = false;
    const load = async (id: string) => { cancelled = true; return projectFor(id); };
    expect(await countMissingAssets([{ id: 'a' }, { id: 'c' }], deps({ load, isCancelled: () => cancelled }))).toBeNull();
  });
});
