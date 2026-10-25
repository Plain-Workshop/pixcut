import { describe, expect, it } from 'vitest';
import { edit, emptyProject, sceneAt, scenePatch, totalDuration, validateProject, type Scene } from '../src/stores/model';
const scene = (id: string, duration = 4): Scene => ({ id, name: 'Photo', image: 'data:image/png;base64,AA==', duration, title: '', subtitle: '', color: '#ffffff', fit: 'cover' });
describe('project commands and playback', () => {
  it('keeps original snapshots intact and selects the right scene at a cut', () => { const original = emptyProject(); const p = edit(original, { type: 'add', scenes: [scene('a'), scene('b', 2)] }); expect(original.scenes).toHaveLength(0); expect(totalDuration(p)).toBe(6); expect(sceneAt(p, 3.999)?.scene.id).toBe('a'); expect(sceneAt(p, 4)?.scene.id).toBe('b'); });
  it('moves a scene without dropping or duplicating it', () => { const p = edit(emptyProject(), { type: 'add', scenes: [scene('a'), scene('b'), scene('c')] }); expect(edit(p, { type: 'move', id: 'b', offset: -1 }).scenes.map(s => s.id)).toEqual(['b', 'a', 'c']); expect(edit(p, { type: 'move', id: 'a', offset: -1 })).toEqual(p); });
  it('rejects malformed scenes and unsupported schemas', () => { expect(() => edit(emptyProject(), { type: 'add', scenes: [scene('a', NaN)] })).toThrow(); expect(() => edit(emptyProject(), { type: 'add', scenes: [scene('a'), scene('a')] })).toThrow(); expect(() => validateProject({ ...emptyProject(), schema_version: 2 })).toThrow('Unsupported'); });
  it('forces imported projects to remain watermark-free and local', () => { expect(validateProject({ ...emptyProject(), policy: { watermark: true, pixcut_outro: true, privacy: 'cloud' } }).policy).toEqual({ watermark: false, pixcut_outro: false, privacy: 'local' }); });
  it('does not accept remote image references inside project files', () => { expect(() => edit(emptyProject(), { type: 'add', scenes: [{ ...scene('a'), image: 'https://example.com/private.jpg' }] })).toThrow(); });
  it('splits a scene into two undoable halves at the playhead', () => {
    const p = edit(emptyProject(), { type: 'add', scenes: [scene('a', 4)] });
    const split = edit(p, { type: 'split', id: 'a', at: 1.5, newId: 'b' });
    expect(split.scenes.map(s => [s.id, s.duration])).toEqual([['a', 1.5], ['b', 2.5]]);
    expect(totalDuration(split)).toBe(4);
    expect(split.scenes[0].fadeOut).toBe(0);
    expect(split.scenes[1].fadeIn).toBe(0);
    expect(() => edit(p, { type: 'split', id: 'a', at: 0.2, newId: 'b' })).toThrow(/half a second/);
    expect(() => edit(p, { type: 'split', id: 'a', at: 3.8, newId: 'b' })).toThrow(/half a second/);
    expect(() => edit(p, { type: 'split', id: 'missing', at: 1, newId: 'b' })).toThrow(/Select a scene/);
    expect(() => edit(p, { type: 'split', id: 'a', at: 1, newId: 'a' })).toThrow(/already exists/);
  });
  it('duplicates a scene immediately after the original', () => {
    const p = edit(emptyProject(), { type: 'add', scenes: [scene('a'), scene('b')] });
    const copy = edit(p, { type: 'duplicate', id: 'a', newId: 'a-copy' });
    expect(copy.scenes.map(s => s.id)).toEqual(['a', 'a-copy', 'b']);
    expect(copy.scenes[1].name).toBe('Photo copy');
    expect(() => edit(p, { type: 'duplicate', id: 'a', newId: 'b' })).toThrow(/already exists/);
  });
  it('validates color, filter, speed, and fade controls', () => {
    const tuned = { ...scene('a'), brightness: 1.1, contrast: 1.05, saturation: 1.2, exposure: 0.5, highlights: 0.2, shadows: -0.2, temperature: 0.3, tint: -0.1, filter: 'warm' as const, filterIntensity: 60, speed: 2, pitch: true, fadeIn: 1, fadeOut: 1 };
    expect(edit(emptyProject(), { type: 'add', scenes: [tuned] }).scenes[0]).toMatchObject({ filter: 'warm', speed: 2, fadeIn: 1 });
    const invalid: Record<string, unknown>[] = [{ filter: 'vintage' }, { filterIntensity: 101 }, { exposure: 4 }, { speed: 0.1 }, { fadeIn: 5 }, { highlights: 2 }];
    for (const patch of invalid) expect(() => edit(emptyProject(), { type: 'add', scenes: [{ ...scene('a'), ...patch } as unknown as Scene] })).toThrow();
  });
  it('clamps fades when splitting a clip', () => {
    const p = edit(emptyProject(), { type: 'add', scenes: [{ ...scene('a', 4), fadeIn: 3, fadeOut: 3.5 }] });
    const split = edit(p, { type: 'split', id: 'a', at: 2, newId: 'b' });
    expect(split.scenes[0]).toMatchObject({ duration: 2, fadeIn: 2, fadeOut: 0 });
    expect(split.scenes[1]).toMatchObject({ duration: 2, fadeIn: 0, fadeOut: 2 });
  });
  it('applies batch updates, removals, and duplicates atomically', () => {
    const p = edit(emptyProject(), { type: 'add', scenes: [scene('a'), scene('b'), scene('c')] });
    const updated = edit(p, { type: 'updateMany', scenes: [{ ...p.scenes[0], title: 'A' }, { ...p.scenes[2], title: 'C' }] });
    expect(updated.scenes.map(scene => scene.title)).toEqual(['A', '', 'C']);
    const removed = edit(updated, { type: 'removeMany', ids: ['a', 'c'] });
    expect(removed.scenes.map(scene => scene.id)).toEqual(['b']);
    const duplicated = edit(p, { type: 'duplicateMany', items: [{ id: 'a', newId: 'a2' }, { id: 'c', newId: 'c2' }] });
    expect(duplicated.scenes.map(scene => scene.id)).toEqual(['a', 'a2', 'b', 'c', 'c2']);
    expect(duplicated.scenes.filter(scene => scene.name.endsWith('copy'))).toHaveLength(2);
  });
  it('derives minimal scene patches and treats defaults as equal', () => {
    const base = scene('a');
    expect(scenePatch(base, { ...base })).toEqual({});
    expect(scenePatch(base, { ...base, brightness: 1, filterIntensity: 100, pitch: true })).toEqual({});
    expect(scenePatch(base, { ...base, title: 'New', filter: 'warm', speed: 2 })).toEqual({ title: 'New', filter: 'warm', speed: 2 });
  });
});
