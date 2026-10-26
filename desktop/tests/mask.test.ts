import { describe, expect, it } from 'vitest';
import { defaultLayerMask, edit, emptyProject, validateProject, type ElementLayer, type Scene } from '../src/stores/model';
import { maskPolygon } from '../src/components/preview/mask';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const scene = (): Scene => ({ id: 'scene', name: 'Scene', image: PNG, startTicks: 0, sourceInTicks: 0, durationTicks: 120, title: '', subtitle: '', color: '#000000', fit: 'cover' });
const overlay = (patch: Partial<ElementLayer> = {}): ElementLayer => ({
  id: 'overlay', kind: 'image', source: PNG, x: .5, y: .5, width: .5, height: .5, rotation: 0,
  color: '#FFFFFF', opacity: 100, startTicks: 0, durationTicks: 120, animation: 'none', ...patch,
});
const projectWith = () => edit(emptyProject('Masks'), { type: 'add', scenes: [scene()] });

describe('shape masks', () => {
  it('defaults to a centered rectangle that follows the overlay box', () => {
    expect(defaultLayerMask()).toEqual({ shape: 'rectangle', x: .5, y: .5, width: .82, height: .82, rotation: 0, feather: 0, invert: false });
    expect(defaultLayerMask('star').shape).toBe('star');
  });

  it('builds the polygon shapes used by the canvas mask', () => {
    expect(maskPolygon('rectangle', 100, 50)).toEqual([{ x: -50, y: -25 }, { x: 50, y: -25 }, { x: 50, y: 25 }, { x: -50, y: 25 }]);
    expect(maskPolygon('triangle', 100, 50)).toHaveLength(3);
    const star = maskPolygon('star', 100, 50);
    expect(star).toHaveLength(10);
    const maxX = Math.max(...star.map(point => point.x)), minY = Math.min(...star.map(point => point.y));
    expect(maxX).toBeGreaterThan(45);
    expect(maxX).toBeLessThanOrEqual(50);
    expect(minY).toBeCloseTo(-25);
    expect(maskPolygon('ellipse', 100, 50)).toEqual([]);
  });

  it('round-trips a mask through project validation', () => {
    const mask = { ...defaultLayerMask('ellipse'), x: .4, y: .6, feather: 18, rotation: 22, invert: true };
    const project = edit(projectWith(), { type: 'overlays', overlays: [overlay({ mask })] });
    const restored = validateProject(JSON.parse(JSON.stringify(project)));
    expect(restored.overlays[0].mask).toEqual(mask);
  });

  it('rejects unknown shapes, out-of-range geometry, and masks on non-media layers', () => {
    const project = projectWith();
    const withMask = (mask: Partial<ElementLayer['mask']>) => ({ type: 'overlays' as const, overlays: [overlay({ mask: { ...defaultLayerMask(), ...mask } as ElementLayer['mask'] })] });
    expect(() => edit(project, withMask({ shape: 'hexagon' as never }))).toThrow(/shape/i);
    expect(() => edit(project, withMask({ x: 2 }))).toThrow(/mask/i);
    expect(() => edit(project, withMask({ feather: 101 }))).toThrow(/mask/i);
    expect(() => edit(project, { type: 'overlays', overlays: [overlay({ kind: 'star', source: undefined, mask: defaultLayerMask('star') })] })).toThrow(/mask/i);
  });
});
