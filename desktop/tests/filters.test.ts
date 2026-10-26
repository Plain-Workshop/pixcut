import { describe, expect, it } from 'vitest';
import { applyColorGrade, filterLook, gradeLutCube, hasColorGrade } from '../src/components/preview/filters';
import { edit, emptyProject, validateProject, type Scene } from '../src/stores/model';

const scene = (patch: Partial<Scene> = {}): Scene => ({
  id: 'a', startTicks: 0, sourceInTicks: 0, name: 'Photo', image: 'data:image/png;base64,AA==', durationTicks: 120,
  title: '', subtitle: '', color: '#ffffff', fit: 'cover', ...patch,
});

function grade(patch: Partial<Scene>, pixel: [number, number, number] = [180, 120, 60]) {
  const data = new Uint8ClampedArray([...pixel, 255]);
  applyColorGrade(data, scene(patch));
  return [data[0], data[1], data[2]];
}

describe('color grade pipeline', () => {
  it('round-trips colour balance fields and rejects out-of-range values', () => {
    const project = edit(emptyProject('Colour'), { type: 'add', scenes: [scene({ hue: 24, vibrance: 18, shadowTintColor: '#203050', shadowTintAmount: 30, highlightTintColor: '#f0d0a0', highlightTintAmount: 45 })] });
    const restored = validateProject(JSON.parse(JSON.stringify(project)));
    expect(restored.tracks[0].clips[0]).toMatchObject({ hue: 24, vibrance: 18, shadowTintColor: '#203050', shadowTintAmount: 30, highlightTintColor: '#f0d0a0', highlightTintAmount: 45 });
    expect(() => edit(emptyProject('Bad'), { type: 'add', scenes: [scene({ hue: 200 })] })).toThrow();
    expect(() => edit(emptyProject('Bad'), { type: 'add', scenes: [scene({ shadowTintAmount: 101 })] })).toThrow();
  });
  it('detects whether a scene needs grading', () => {
    expect(hasColorGrade(scene())).toBe(false);
    expect(hasColorGrade(scene({ brightness: 1.2 }))).toBe(true);
    expect(hasColorGrade(scene({ filter: 'warm' }))).toBe(true);
    expect(hasColorGrade(scene({ filter: 'none', filterIntensity: 100 }))).toBe(false);
    expect(hasColorGrade(scene({ hue: 20 }))).toBe(true);
    expect(hasColorGrade(scene({ vibrance: 30 }))).toBe(true);
    expect(hasColorGrade(scene({ shadowTintAmount: 30 }))).toBe(true);
  });

  it('brightens non-destructively in place and leaves neutral pixels alone', () => {
    expect(grade({ brightness: 1.5 })[0]).toBeGreaterThan(180);
    expect(grade({ exposure: 1 })[0]).toBeGreaterThan(180);
    const neutral = new Uint8ClampedArray([180, 120, 60, 255]);
    applyColorGrade(neutral, scene());
    expect([...neutral]).toEqual([180, 120, 60, 255]);
  });

  it('applies monochrome and intensity-aware looks', () => {
    const [r, g, b] = grade({ filter: 'mono', filterIntensity: 100 });
    expect(Math.abs(r - g)).toBeLessThanOrEqual(1);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(1);
    expect(filterLook('mono', 0)).toEqual({ brightness: 1, contrast: 1, saturate: 1, sepia: 0, grayscale: 0, hue: 0 });
  });

  it('warms and cools the image in the expected direction', () => {
    const warm = grade({ temperature: 0.6 });
    const cool = grade({ temperature: -0.6 });
    expect(warm[0]).toBeGreaterThan(cool[0]);
    expect(cool[2]).toBeGreaterThan(warm[2]);
  });

  it('lifts shadows and highlights with signed controls', () => {
    const darkLift = grade({ shadows: 0.8 }, [20, 20, 20]);
    expect(darkLift[0]).toBeGreaterThan(20);
    const brightLift = grade({ highlights: 0.8 }, [220, 220, 220]);
    expect(brightLift[0]).toBeGreaterThan(220);
  });

  it('rotates hue, adds vibrance and tints shadows and highlights', () => {
    const rotated = grade({ hue: 90 }, [200, 40, 40]);
    expect(rotated).not.toEqual([200, 40, 40]);
    const flat = grade({ vibrance: 100 }, [120, 110, 100]);
    expect(Math.max(...flat) - Math.min(...flat)).toBeGreaterThan(10);
    const shadow = grade({ shadowTintColor: '#ff0000', shadowTintAmount: 100 }, [20, 20, 20]);
    expect(shadow[0]).toBeGreaterThan(shadow[1]);
    const highlight = grade({ highlightTintColor: '#0000ff', highlightTintAmount: 100 }, [230, 230, 230]);
    expect(highlight[2]).toBeGreaterThan(highlight[0]);
  });
});

function lutEntries(cube: string) {
  return cube.split('\n').filter(line => line && !line.startsWith('#') && !line.startsWith('LUT_3D_SIZE') && !line.startsWith('DOMAIN_'));
}

describe('grade LUT for video export', () => {
  it('skips neutral clips and emits a standard 3D cube', () => {
    expect(gradeLutCube(scene())).toBeNull();
    const cube = gradeLutCube(scene({ brightness: 1.4 }), 9)!;
    expect(cube).toContain('LUT_3D_SIZE 9');
    expect(lutEntries(cube)).toHaveLength(729);
  });

  it('matches the canvas grade pipeline at the sampled lattice points', () => {
    const graded = scene({ filter: 'warm', filterIntensity: 70, contrast: 1.2, temperature: 0.3, shadows: 0.4, hue: 15, vibrance: 25, shadowTintColor: '#203050', shadowTintAmount: 20, highlightTintColor: '#f0d0a0', highlightTintAmount: 25 });
    const size = 5;
    const cube = gradeLutCube(graded, size)!;
    const entries = lutEntries(cube);
    const lattice = [3, 1, 4];
    const index = ((lattice[2] * size) + lattice[1]) * size + lattice[0];
    const lut = entries[index].split(' ').map(Number);
    const expected = new Uint8ClampedArray([
      Math.round((lattice[0] / (size - 1)) * 255),
      Math.round((lattice[1] / (size - 1)) * 255),
      Math.round((lattice[2] / (size - 1)) * 255),
      255,
    ]);
    applyColorGrade(expected, graded);
    for (let channel = 0; channel < 3; channel += 1) {
      expect(Math.abs(lut[channel] - expected[channel] / 255)).toBeLessThanOrEqual(1 / 255);
    }
  });

  it('keeps every channel identical for a monochrome grade', () => {
    const entries = lutEntries(gradeLutCube(scene({ filter: 'mono' }), 5)!);
    for (const entry of entries) {
      const [r, g, b] = entry.split(' ').map(Number);
      expect(Math.abs(r - g)).toBeLessThanOrEqual(1 / 255);
      expect(Math.abs(g - b)).toBeLessThanOrEqual(1 / 255);
    }
  });

  it('rejects an unsafe LUT size', () => {
    expect(() => gradeLutCube(scene({ brightness: 1.2 }), 0)).toThrow('Invalid grade LUT size.');
    expect(() => gradeLutCube(scene({ brightness: 1.2 }), 100)).toThrow('Invalid grade LUT size.');
  });
});
