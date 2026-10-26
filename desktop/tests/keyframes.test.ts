import { describe, expect, it } from 'vitest';
import {
  applyElementMotion,
  applyTextMotion,
  keyframeAtPlayhead,
  motionAt,
  removeKeyframe,
  upsertKeyframe,
} from '../src/components/animation/keyframes';
import { edit, emptyProject, type ElementLayer, type Keyframe, type TextLayer } from '../src/stores/model';

const text = (keyframes?: Keyframe[]): TextLayer => ({
  id: 'text-1', title: 'Hello', subtitle: '', startTicks: 0, durationTicks: 90,
  color: '#FFFFFF', x: .2, y: .3, width: .7, align: 'center', font: 'inter',
  fontWeight: 600, fontStyle: 'normal', size: .06, lineHeight: 1.2, letterSpacing: 0,
  rotation: 0, opacity: 100, subtitleScale: .4, backdropEnabled: false, backdropColor: '#000000',
  backdropOpacity: 45, backdropBlur: 18, backdropPadding: 24, backdropRadius: 16, backdropNoise: 8,
  outlineEnabled: false, strokeColor: '#000000', strokeWidth: 0, shadowEnabled: false,
  shadowColor: '#000000', shadowIntensity: 60, shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
  glowEnabled: false, glowColor: '#ffffff', glowBlur: 24, glowIntensity: 55,
  animation: 'none', animationDuration: .5, keyframes,
});

const element = (keyframes?: Keyframe[]): ElementLayer => ({
  id: 'el-1', kind: 'label', label: 'Badge', x: .5, y: .5, width: .3, height: .1,
  rotation: 0, color: '#FFFFFF', opacity: 100, startTicks: 0, durationTicks: 90,
  animation: 'none', keyframes,
});

describe('motionAt', () => {
  it('uses the static values when a layer has no keyframes', () => {
    expect(motionAt(text(), 2)).toEqual({ x: .2, y: .3, rotation: 0, opacity: 100, scale: 1 });
  });

  it('interpolates between keys and holds the first and last values', () => {
    const layer = text([{ at: 2, x: .2 }, { at: 4, x: .6 }]);
    expect(motionAt(layer, 0).x).toBe(.2);
    expect(motionAt(layer, 2).x).toBe(.2);
    expect(motionAt(layer, 3).x).toBeCloseTo(.4);
    expect(motionAt(layer, 4).x).toBe(.6);
    expect(motionAt(layer, 9).x).toBe(.6);
  });

  it('animates each property independently', () => {
    const layer = text([{ at: 0, x: .1, scale: 1 }, { at: 1, rotation: 45 }, { at: 2, x: .5, opacity: 20, scale: 2 }]);
    const atOne = motionAt(layer, 1);
    expect(atOne.rotation).toBe(45);
    expect(atOne.x).toBeCloseTo(.3);
    // A property with only one key holds that value everywhere.
    expect(atOne.opacity).toBe(20);
    expect(atOne.scale).toBeCloseTo(1.5);
  });

  it('falls back to the static value for a property no key sets', () => {
    expect(motionAt(text([{ at: 0, x: .5 }, { at: 3, x: .9 }]), 1).rotation).toBe(0);
    expect(motionAt(text([{ at: 0, x: .5 }, { at: 3, x: .9 }]), 1).opacity).toBe(100);
  });

  it('ignores broken times and handles a single key', () => {
    expect(motionAt(text([{ at: Number.NaN, x: .9 }]), 1).x).toBe(.2);
    expect(motionAt(text([{ at: 5, x: .9 }]), 1).x).toBe(.9);
    expect(motionAt(text([{ at: 0, x: .4 }]), Number.NaN).x).toBe(.2);
  });
});

describe('applyTextMotion', () => {
  it('returns the layer untouched without keyframes', () => {
    const layer = text();
    expect(applyTextMotion(layer, 2)).toBe(layer);
  });

  it('scales the text size and moves the box', () => {
    const layer = text([{ at: 0, x: .2, y: .3 }, { at: 6, x: .6, y: .7, scale: 1.5, opacity: 50 }]);
    const painted = applyTextMotion(layer, 6);
    expect(painted.x).toBe(.6);
    expect(painted.size).toBeCloseTo(.09);
    expect(painted.opacity).toBe(50);
    expect(layer.x).toBe(.2);
  });
});

describe('applyElementMotion', () => {
  it('scales around the element centre and rotates it', () => {
    const painted = applyElementMotion(element([{ at: 0, scale: 1 }, { at: 4, scale: 2, rotation: 30 }]), 4);
    expect(painted.width).toBeCloseTo(.6);
    expect(painted.height).toBeCloseTo(.2);
    expect(painted.rotation).toBe(30);
  });
});

describe('keyframe editing', () => {
  it('adds, replaces and removes frames without losing order', () => {
    let keys = upsertKeyframe(undefined, 4, { x: .6 });
    keys = upsertKeyframe(keys, 1, { x: .2 });
    expect(keys.map(key => key.at)).toEqual([1, 4]);
    keys = upsertKeyframe(keys, 1.004, { x: .25 });
    expect(keys).toHaveLength(2);
    expect(keys[0].x).toBe(.25);
    keys = removeKeyframe(keys, 4)!;
    expect(keys).toHaveLength(1);
    expect(removeKeyframe(keys, 1.004)).toBeUndefined();
  });

  it('snaps times to hundredths and caps the list', () => {
    const keys = upsertKeyframe(undefined, 1.239, { x: .3 });
    expect(keys[0].at).toBe(1.24);
    let many: Keyframe[] | undefined;
    for (let index = 0; index < 30; index += 1) many = upsertKeyframe(many, index, { x: index / 40 });
    expect(many).toHaveLength(24);
    expect(many![0].at).toBe(0);
    expect(many!.at(-1)!.at).toBe(23);
  });

  it('captures the current frame at the playhead, clamped to the layer', () => {
    const layer = text([{ at: 2, x: .2 }, { at: 6, x: .6 }]);
    const frame = keyframeAtPlayhead(layer, 4, 3);
    expect(frame.at).toBe(3);
    expect(frame.frame.x).toBeCloseTo(.3);
    expect(keyframeAtPlayhead(layer, -2, 3).at).toBe(0);
  });
});

describe('keyframe validation', () => {
  const clip = (textLayers: TextLayer[], elements?: ElementLayer[]) => ({
    id: 'one', name: 'One', image: 'data:image/png;base64,AA==', startTicks: 0, sourceInTicks: 0,
    durationTicks: 90, title: '', subtitle: '', color: '#FFFFFF', fit: 'cover' as const, textLayers, elements,
  });

  it('accepts text and element keyframes inside the layer duration', () => {
    const project = emptyProject('Keys');
    expect(() => edit(project, { type: 'add', scenes: [clip([text([{ at: 1, x: .4, scale: 1.2 }])], [element([{ at: .5, opacity: 40 }])])] })).not.toThrow();
  });

  it('rejects keyframes outside the layer, bad values and too many keys', () => {
    const project = emptyProject('Keys');
    expect(() => edit(project, { type: 'add', scenes: [clip([text([{ at: 99, x: .4 }])])] })).toThrow(/keyframe/i);
    expect(() => edit(project, { type: 'add', scenes: [clip([text([{ at: 1, scale: 9 }])])] })).toThrow(/keyframe/i);
    expect(() => edit(project, { type: 'add', scenes: [clip([text([{ at: 1, x: .4 }, { at: 2, x: 2 }])])] })).toThrow(/keyframe/i);
    const many = Array.from({ length: 25 }, (_, index) => ({ at: index / 10, x: .5 }));
    expect(() => edit(project, { type: 'add', scenes: [clip([text(many)])] })).toThrow(/keyframes/i);
  });
});
