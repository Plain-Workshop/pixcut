import { describe, expect, it } from 'vitest';
import { applyColorGrade, filterLook, hasColorGrade } from '../src/components/preview/filters';
import type { Scene } from '../src/stores/model';

const scene = (patch: Partial<Scene> = {}): Scene => ({
  id: 'a', name: 'Photo', image: 'data:image/png;base64,AA==', duration: 4,
  title: '', subtitle: '', color: '#ffffff', fit: 'cover', ...patch,
});

function grade(patch: Partial<Scene>, pixel: [number, number, number] = [180, 120, 60]) {
  const data = new Uint8ClampedArray([...pixel, 255]);
  applyColorGrade(data, scene(patch));
  return [data[0], data[1], data[2]];
}

describe('color grade pipeline', () => {
  it('detects whether a scene needs grading', () => {
    expect(hasColorGrade(scene())).toBe(false);
    expect(hasColorGrade(scene({ brightness: 1.2 }))).toBe(true);
    expect(hasColorGrade(scene({ filter: 'warm' }))).toBe(true);
    expect(hasColorGrade(scene({ filter: 'none', filterIntensity: 100 }))).toBe(false);
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
});
