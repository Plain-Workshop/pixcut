import { describe, it, expect } from 'vitest';
import { HISTORY_LIMIT, HISTORY_MEDIA_BYTES, emptyProject, edit, projectMediaBytes, trimHistory, validateProject, type ElementLayer, type Scene, type TextLayer } from '../src/stores/model';
import { STACK_DEFAULT_Z, STACK_Z_MAX, layerZ, overlaysForScene, sceneStack, stackIndex, stackZ } from '../src/components/elements/stack';
import { createTextLayer } from '../src/components/text/layers';

const element = (id: string, z?: number): ElementLayer => ({ id, kind: 'star', x: .5, y: .5, width: .2, height: .2, color: '#FFCC66', rotation: 0, opacity: 100, startTicks: 0, durationTicks: 120, animation: 'none', ...(z === undefined ? {} : { z }) });
const text = (id: string, z?: number): TextLayer => ({ ...createTextLayer(120, { startTicks: 0 }), id, title: id, ...(z === undefined ? {} : { z }) });
const scene = (elements: ElementLayer[] = [], textLayers: TextLayer[] = []): Scene => ({ id: 's', name: 'Photo', image: 'data:image/png;base64,AA==', startTicks: 0, sourceInTicks: 0, durationTicks: 120, title: '', subtitle: '', color: '#FFFFFF', fit: 'cover', elements, textLayers });

describe('layer stack order', () => {
  it('keeps the classic order when no layer sets a z value', () => {
    const stack = sceneStack(scene([element('shape')], [text('title')]), [element('overlay')]);
    expect(stack.map(entry => `${entry.kind}:${entry.id}`)).toEqual(['element:shape', 'text:title', 'overlay:overlay']);
    expect(layerZ({}, 'element', 3)).toBe(STACK_DEFAULT_Z.element + 3);
    expect(layerZ({ z: 42 }, 'overlay', 0)).toBe(42);
  });

  it('puts a text layer above a video overlay, and an overlay above text, by z alone', () => {
    const above = sceneStack(scene([], [{ ...text('caption'), z: 5_000 }]), [{ ...element('clip'), z: 4_000 }]);
    expect(above.at(-1)).toMatchObject({ kind: 'text', id: 'caption' });
    const below = sceneStack(scene([], [{ ...text('caption'), z: 3_500 }]), [{ ...element('clip'), z: 4_000 }]);
    expect(below.at(-1)).toMatchObject({ kind: 'overlay', id: 'clip' });
  });

  it('moves one place at a time without renumbering the other layers', () => {
    const stack = sceneStack(scene([element('a'), element('b')], [text('title')]), [element('overlay')]);
    expect(stack.map(entry => entry.id)).toEqual(['a', 'b', 'title', 'overlay']);
    const forward = stackZ(stack, 'element', 'a', 'forward');
    expect(forward).toBeGreaterThan(STACK_DEFAULT_Z.element + 1);
    expect(forward).toBeLessThan(STACK_DEFAULT_Z.text);
    const withMove = sceneStack(scene([element('a', forward!), element('b')], [text('title')]), [element('overlay')]);
    expect(withMove.map(entry => entry.id)).toEqual(['b', 'a', 'title', 'overlay']);
    expect(stackZ(withMove, 'element', 'a', 'forward')!).toBeGreaterThan(STACK_DEFAULT_Z.text);
    expect(stackZ(withMove, 'element', 'a', 'forward')!).toBeLessThan(STACK_DEFAULT_Z.overlay);
  });

  it('sends layers all the way to the front or back and stops at the ends', () => {
    const stack = sceneStack(scene([element('shape')], [text('title')]), [element('overlay')]);
    const front = stackZ(stack, 'text', 'title', 'front')!;
    expect(front).toBeGreaterThan(STACK_DEFAULT_Z.overlay);
    const moved = sceneStack(scene([element('shape')], [{ ...text('title'), z: front }]), [element('overlay')]);
    expect(moved.at(-1)).toMatchObject({ kind: 'text', id: 'title' });
    expect(stackZ(moved, 'text', 'title', 'front')).toBeNull();
    const back = stackZ(moved, 'text', 'title', 'back')!;
    expect(back).toBeLessThan(STACK_DEFAULT_Z.element);
    const sunk = sceneStack(scene([element('shape')], [{ ...text('title'), z: back }]), [element('overlay')]);
    expect(sunk[0]).toMatchObject({ kind: 'text', id: 'title' });
    expect(stackZ(sunk, 'text', 'title', 'back')).toBeNull();
    expect(stackZ(sunk, 'text', 'missing', 'front')).toBeNull();
    expect(stackIndex(sunk, 'overlay', 'overlay')).toBe(sunk.length - 1);
  });

  it('only counts overlays that share the scene when reporting the order', () => {
    const first = scene();
    const second = { ...scene([], []), id: 's2', startTicks: 120 };
    const here = element('here');
    const later = { ...element('later'), startTicks: 200, durationTicks: 60 };
    const early = { ...element('early'), startTicks: 0, durationTicks: 60 };
    expect(overlaysForScene(first, [here, later, early]).map(item => item.id)).toEqual(['here', 'early']);
    expect(overlaysForScene(second, [here, later, early]).map(item => item.id)).toEqual(['later']);
    expect(sceneStack(first, overlaysForScene(first, [here, later, early])).map(entry => entry.id)).toEqual(['here', 'early']);
  });

  it('round-trips an explicit order through save and validation', () => {
    const p = edit(emptyProject(), { type: 'add', scenes: [scene([{ ...element('shape'), z: 9_000 }], [{ ...text('title'), z: 1 }])] });
    const saved = edit(p, { type: 'overlays', overlays: [{ ...element('overlay'), z: 500, startTicks: 0, durationTicks: 120 }] });
    const restored = validateProject(JSON.parse(JSON.stringify(saved)));
    expect(restored.tracks[0].clips[0].elements?.[0].z).toBe(9_000);
    expect(restored.tracks[0].clips[0].textLayers?.[0].z).toBe(1);
    expect(restored.overlays[0].z).toBe(500);
    expect(sceneStack(restored.tracks[0].clips[0], restored.overlays).map(entry => entry.id)).toEqual(['title', 'overlay', 'shape']);
  });

  it('keeps every suggested value inside the supported range', () => {
    const atTop = sceneStack(scene([element('low')], [text('high', STACK_Z_MAX)]), []);
    expect(stackZ(atTop, 'element', 'low', 'forward')).toBeLessThanOrEqual(STACK_Z_MAX);
    expect(stackZ(atTop, 'element', 'low', 'front')).toBeLessThanOrEqual(STACK_Z_MAX);
    const atBottom = sceneStack(scene([element('low', 0)], [text('high')]), []);
    expect(stackZ(atBottom, 'text', 'high', 'backward')).toBeGreaterThanOrEqual(0);
    expect(stackZ(atBottom, 'text', 'high', 'back')).toBeGreaterThanOrEqual(0);
  });

  it('applies a layer-order command without touching media', () => {
    const p = edit(emptyProject(), { type: 'add', scenes: [scene([element('shape')], [text('title')])] });
    const image = p.tracks[0].clips[0].image;
    const sceneId = p.tracks[0].clips[0].id;
    const ordered = edit(p, { type: 'order', kind: 'text', sceneId, id: 'title', z: 7_500 });
    expect(ordered.tracks[0].clips[0].textLayers?.[0].z).toBe(7_500);
    expect(ordered.tracks[0].clips[0].image).toBe(image);
    expect(ordered.tracks[0].clips[0].elements?.[0].z).toBeUndefined();
    expect(edit(ordered, { type: 'order', kind: 'text', sceneId, id: 'title', z: 7_500 })).toEqual(ordered);

    const withOverlay = edit(ordered, { type: 'overlays', overlays: [element('clip')] });
    const movedOverlay = edit(withOverlay, { type: 'order', kind: 'overlay', id: 'clip', z: 30 });
    expect(movedOverlay.overlays[0].z).toBe(30);
    const movedElement = edit(movedOverlay, { type: 'order', kind: 'element', sceneId, id: 'shape', z: 40 });
    expect(movedElement.tracks[0].clips[0].elements?.[0].z).toBe(40);

    // Only the position travels: the command stays tiny even with media around.
    expect(JSON.stringify({ type: 'order', kind: 'text', sceneId, id: 'title', z: 7_500 }).length).toBeLessThan(120);
    expect(() => edit(p, { type: 'order', kind: 'text', sceneId, id: 'missing', z: 10 })).toThrow();
    expect(() => edit(p, { type: 'order', kind: 'text', id: 'title', z: 10 })).toThrow();
    expect(() => edit(p, { type: 'order', kind: 'overlay', id: 'shape', z: 10 })).toThrow();
    expect(() => edit(p, { type: 'order', kind: 'text', sceneId, id: 'title', z: -1 })).toThrow();
    expect(() => edit(p, { type: 'order', kind: 'text', sceneId, id: 'title', z: STACK_Z_MAX + 1 })).toThrow();
  });

  it('caps undo history by count and by held media', () => {
    const heavy = (index: number) => ({ ...emptyProject(), id: `p-${index}`, tracks: [{ id: 'v', kind: 'visual' as const, name: 'Visuals', clips: [{ ...scene(), image: `data:image/png;base64,${'A'.repeat(8_000_000)}-${index}` }] }] });
    const many = Array.from({ length: 40 }, (_, index) => heavy(index));
    const kept = trimHistory(many);
    expect(kept.length).toBeLessThanOrEqual(HISTORY_LIMIT);
    expect(kept.reduce((sum, project) => sum + projectMediaBytes(project), 0)).toBeLessThanOrEqual(HISTORY_MEDIA_BYTES);
    // The newest snapshots are the ones that survive.
    expect(kept.at(-1)).toBe(many.at(-1));
    // Light projects are capped by count alone.
    const light = Array.from({ length: 40 }, (_, index) => ({ ...emptyProject(), id: `l-${index}` }));
    expect(trimHistory(light)).toHaveLength(HISTORY_LIMIT);
    expect(trimHistory([])).toHaveLength(0);
    expect(trimHistory([many[0]])).toHaveLength(1);
    // A single snapshot is always kept, even if it is larger than the budget.
    const huge = [{ ...many[0], tracks: [{ ...many[0].tracks[0], clips: [{ ...many[0].tracks[0].clips[0], image: `data:image/png;base64,${'B'.repeat(HISTORY_MEDIA_BYTES + 1)}` }] }] }];
    expect(trimHistory(huge)).toHaveLength(1);
  });

  it('rejects layer order values outside the supported range', () => {
    const base = { ...scene(), mediaKind: undefined, startTicks: 0 };
    expect(() => validateProject({ ...emptyProject(), schema_version: 13, tracks: [{ id: 'v', kind: 'visual', name: 'Visuals', clips: [{ ...base, elements: [element('shape', STACK_Z_MAX + 1)] }] }] })).toThrow();
    expect(() => validateProject({ ...emptyProject(), schema_version: 13, tracks: [{ id: 'v', kind: 'visual', name: 'Visuals', clips: [{ ...base, textLayers: [{ ...text('title'), z: -1 }] }] }] })).toThrow();
  });
});
