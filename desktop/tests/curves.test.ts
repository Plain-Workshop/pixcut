import { describe, expect, it } from 'vitest';
import { edit, emptyProject, scenePatch, validateProject, type CurvePoint, type Scene, type ToneCurves } from '../src/stores/model';
import { buildCurveLuts, curveLut, evaluateCurve, hasToneCurves, sampleCurve } from '../src/components/preview/curves';
import { applyColorGrade, gradeLutCube } from '../src/components/preview/filters';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const scene = (patch: Partial<Scene> = {}): Scene => ({
  id: 'scene', name: 'Scene', image: PNG, startTicks: 0, sourceInTicks: 0, durationTicks: 120,
  title: '', subtitle: '', color: '#000000', fit: 'cover', ...patch,
});
const shoulder: CurvePoint[] = [[0, 0], [.5, .8], [1, 1]];

describe('RGB tone curves', () => {
  it('interpolates an identity curve exactly and clamps outside its ends', () => {
    const identity: CurvePoint[] = [[0, 0], [1, 1]];
    for (const x of [0, .1, .25, .5, .75, .9, 1]) expect(evaluateCurve(identity, x)).toBeCloseTo(x, 6);
    expect(evaluateCurve(shoulder, -.4)).toBe(0);
    expect(evaluateCurve(shoulder, 1.4)).toBe(1);
    expect(evaluateCurve(shoulder, .5)).toBeCloseTo(.8, 6);
  });

  it('stays monotone and inside 0–1 between control points', () => {
    let previous = -1;
    for (let index = 0; index <= 200; index += 1) {
      const value = evaluateCurve(shoulder, index / 200);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = value;
    }
  });

  it('builds 8-bit lookup tables and composes master before a channel', () => {
    const identity = curveLut([[0, 0], [1, 1]]);
    expect(identity[0]).toBe(0);
    expect(identity[255]).toBe(255);
    expect(Math.abs(identity[128] - 128)).toBeLessThanOrEqual(1);
    const luts = buildCurveLuts({ master: [[0, 0], [1, .5]], red: [[0, 0], [1, 1]] });
    expect(luts).not.toBeNull();
    expect(sampleCurve(luts!.red, 200)).toBe(sampleCurve(curveLut([[0, 0], [1, .5]]), 200));
    expect(sampleCurve(luts!.green, 200)).toBe(sampleCurve(curveLut([[0, 0], [1, .5]]), 200));
    expect(hasToneCurves({ master: [[0, 0], [.5, .5], [1, 1]] })).toBe(false);
    expect(hasToneCurves({ master: shoulder })).toBe(true);
    expect(buildCurveLuts(undefined)).toBeNull();
  });

  it('grades only the selected channel and bakes the same result into the export LUT', () => {
    const pixels = new Uint8ClampedArray([64, 64, 64, 255]);
    applyColorGrade(pixels, scene({ curves: { red: [[0, 0], [.5, 1], [1, 1]] } }));
    expect(pixels[0]).toBeGreaterThan(pixels[1]);
    expect(pixels[1]).toBe(pixels[2]);
    expect(pixels[3]).toBe(255);

    const cube = gradeLutCube(scene({ curves: { master: [[0, 0], [1, .5]] } }), 2)!;
    const lines = cube.trim().split('\n');
    expect(lines[0]).toBe('# PixCut grade LUT');
    const [red, green, blue] = lines[5].split(' ').map(Number);
    expect(red).toBeCloseTo(.5, 2);
    expect(green).toBe(0);
    expect(blue).toBe(0);
  });

  it('round-trips curves through project validation and copy/paste patches', () => {
    const curves: ToneCurves = { master: shoulder, red: [[0, .02], [1, .98]] };
    const project = (value: unknown) => validateProject(JSON.parse(JSON.stringify(edit(emptyProject('Curves'), { type: 'add', scenes: [scene({ curves: value as ToneCurves })] }))));
    expect(project(curves).tracks[0].clips[0].curves).toEqual(curves);
    expect(scenePatch(scene(), scene({ curves })).curves).toEqual(curves);
    for (const invalid of [
      { master: [[0, 0]] },
      { master: [[0, 0], [.4, .2], [.3, .8]] },
      { master: [[0, 0], [1, 1.2]] },
      { master: [[0, 0], [1, 1]], sepia: [[0, 0], [1, 1]] },
      { master: Array.from({ length: 13 }, (_, index) => [index / 12, index / 12]) },
    ]) expect(() => project(invalid)).toThrow(/curve/i);
  });
});
