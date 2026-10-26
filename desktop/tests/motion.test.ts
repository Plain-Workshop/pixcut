import { elementAnimationTime } from '../src/components/elements/animation-time';
import { defaultElementSize } from '../src/components/elements/geometry';
import { describe, expect, it } from 'vitest';
import { ELEMENT_ANIMATIONS, elementMotion } from '../src/components/elements/motion';
import { exportBoundaries } from '../src/components/preview/export-timing';
import { DEFAULT_TIMEBASE, edit, emptyProject, projectScenes, validateProject, type Scene, type ElementLayer } from '../src/stores/model';
const element: ElementLayer = { id: 'e', kind: 'star', x: .5, y: .5, width: .2, height: .2, color: '#FFFFFF', opacity: 100, rotation: 0, startTicks: 0, durationTicks: 30, animation: 'none' };
const scene: Scene = { id: 's', startTicks: 0, sourceInTicks: 0, name: 'Photo', image: 'data:image/png;base64,AA==', durationTicks: 30, title: '', subtitle: '', color: '#FFFFFF', fit: 'cover', elements: [element] };
describe('element animation and export timing', () => {
  it('migrates v7 and round-trips every motion without dropping its timing', () => {
    for (const [animation] of ELEMENT_ANIMATIONS) {
      const project = edit(emptyProject(), { type: 'add', scenes: [{ ...scene, elements: [{ ...element, animation }] }] });
      const migrated = validateProject({ ...project, schema_version: 7 });
      expect(migrated.schema_version).toBe(14);
      expect(projectScenes(migrated)[0].elements?.[0]).toMatchObject({ animation, durationTicks: 30 });
      expect(validateProject(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
    }
  });
  it('migrates v8 elements and preserves multilingual editable labels, including blank text', () => {
    for (const label of ['Subskrybuj', '登録する', 'اشترك', '', '❤️']) {
      const project = edit(emptyProject(), { type: 'add', scenes: [{ ...scene, elements: [{ ...element, kind: 'subscribe', label }] }] });
      const migrated = validateProject({ ...project, schema_version: 8 });
      expect(migrated.schema_version).toBe(14);
      expect(projectScenes(migrated)[0].elements?.[0].label).toBe(label);
      expect(validateProject(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
    }
    const legacy = edit(emptyProject(), { type: 'add', scenes: [scene] });
    expect(projectScenes(validateProject({ ...legacy, schema_version: 8 }))[0].elements?.[0].label).toBeUndefined();
    expect(() => edit(emptyProject(), { type: 'add', scenes: [{ ...scene, elements: [{ ...element, label: 'x'.repeat(81) }] }] })).toThrow('80');
  });
  it('preserves the five new graphic kinds through validation', () => {
    for (const kind of ['burst', 'frame', 'dots', 'tape', 'chevron'] as const) {
      const project = edit(emptyProject(), { type: 'add', scenes: [{ ...scene, elements: [{ ...element, kind }] }] });
      expect(projectScenes(validateProject(project))[0].elements?.[0].kind).toBe(kind);
    }
  });
  it('keeps badges and icons proportional on landscape and portrait canvases', () => {
    for (const canvas of [{ width: 1920, height: 1080 }, { width: 1080, height: 1920 }, { width: 1080, height: 1350 }]) {
      const badge = defaultElementSize('subscribe', canvas);
      expect(badge.width * canvas.width / (badge.height * canvas.height)).toBeCloseTo(3.8);
      const icon = defaultElementSize('bell', canvas);
      expect(icon.width * canvas.width / (icon.height * canvas.height)).toBeCloseTo(1);
    }
  });
  it('settles entry motion, keeps looping motion alive, and gives finite transforms', () => {
    for (const [animation] of ELEMENT_ANIMATIONS) {
      for (const time of [-1, 0, .2, .6, 3]) expect(Object.values(elementMotion(animation, time)).every(Number.isFinite)).toBe(true);
    }
    for (const animation of ['spin', 'slide-left', 'slide-right', 'slide-down', 'zoom-out', 'bounce'] as const) {
      expect(elementMotion(animation, 1)).toEqual({ alpha: 1, scale: 1, x: 0, y: 0, rotation: 0 });
    }
    expect(elementMotion('float', .2).y).not.toBe(elementMotion('float', .8).y);
    expect(elementMotion('swing', .2).rotation).not.toBe(0);
    expect(elementMotion('slide-right', 0).x).toBeLessThan(0);
    expect(elementMotion('slide-left', 0).x).toBeGreaterThan(0);
  });
  it('renders each animated frame and retains static element visibility boundaries', () => {
    expect(exportBoundaries({ ...scene, elements: [{ ...element, animation: 'spin' }] }, DEFAULT_TIMEBASE, false)).toEqual(Array.from({ length: 31 }, (_, i) => i));
    expect(exportBoundaries({ ...scene, elements: [{ ...element, startTicks: 7, durationTicks: 12 }] }, DEFAULT_TIMEBASE, false)).toEqual([0, 7, 19, 30]);
    expect(exportBoundaries({ ...scene, elements: [], transition: { type: 'fade', duration: .5 } }, DEFAULT_TIMEBASE, true)).toHaveLength(31);
  });
});

describe('custom overlays and repeat settings', () => {
  it('accepts local image/video overlays, preserves repeat speed and rejects remote media', () => {
    for (const kind of ['image', 'video'] as const) {
      const source = kind === 'image' ? 'data:image/png;base64,AA==' : 'data:video/mp4;base64,AA==';
      const project = edit(emptyProject(), { type: 'add', scenes: [{ ...scene, elements: [{ ...element, kind, source, loop: true, animationDuration: 1.2 }] }] });
      expect(projectScenes(validateProject(JSON.parse(JSON.stringify(project))))[0].elements?.[0]).toMatchObject({ source, loop: true, animationDuration: 1.2 });
      expect(() => validateProject({ ...project, tracks: [{ ...project.tracks[0], clips: [{ ...scene, elements: [{ ...element, kind, source: 'https://example.com/video.mp4' }] }] }] })).toThrow();
    }
  });
  it('renders video overlays on every export frame even when their transform is still', () => {
    expect(exportBoundaries({ ...scene, elements: [{ ...element, kind: 'video', source: 'data:video/mp4;base64,AA==' }] }, DEFAULT_TIMEBASE, false)).toHaveLength(31);
  });
});

it('repeats entry motions continuously without a hold between cycles', () => {
  const layer = { ...element, animation: 'slide-up' as const, loop: true, animationDuration: .6 };
  expect(elementAnimationTime(layer, .3)).toBeCloseTo(.3);
  expect(elementAnimationTime(layer, .9)).toBeCloseTo(.3);
  expect(elementAnimationTime(layer, 2.7)).toBeCloseTo(.3);
  expect(elementAnimationTime({ ...layer, loop: false }, 2.7)).toBe(2.7);
});

it('applies cycle speed to looping motions and lets a single cycle settle', () => {
  const layer = { ...element, animation: 'pulse' as const, loop: true, animationDuration: 2 };
  expect(elementAnimationTime(layer, 1)).toBeCloseTo(Math.PI / 6);
  expect(elementMotion('pulse', elementAnimationTime({ ...layer, loop: false }, 10)).scale).toBeCloseTo(1);
  expect(elementAnimationTime({ ...element, animation: 'fade', animationDuration: 2 }, 1)).toBeCloseTo(.3);
});
