import { describe, expect, it } from 'vitest';
import { consumedSeconds, isRamped, sourceSecondsAt, sourceSpan, speedAt, speedCurve } from '../src/components/preview/speed';
import { DEFAULT_TIMEBASE, type Scene } from '../src/stores/model';

const clip = (overrides: Partial<Scene> = {}): Scene => ({
  id: 'clip', startTicks: 0, sourceInTicks: 0, durationTicks: 30, name: 'Clip', image: '',
  title: '', subtitle: '', color: '#FFFFFF', fit: 'cover', speed: 1, ...overrides,
});

describe('speed curves', () => {
  it('keeps a constant speed when no ramp is set', () => {
    const scene = clip({ speed: 2 });
    expect(speedCurve(scene)).toEqual({ start: 2, end: 2 });
    expect(isRamped(scene)).toBe(false);
    expect(consumedSeconds(scene, 0.5, 1)).toBe(1);
    expect(sourceSpan(scene, 1)).toBe(2);
    expect(speedAt(scene, 0.5, 1)).toBe(2);
  });

  it('integrates a linear ramp', () => {
    const scene = clip({ speed: 1, speedEnd: 2 });
    expect(isRamped(scene)).toBe(true);
    expect(speedAt(scene, 0, 1)).toBe(1);
    expect(speedAt(scene, 0.5, 1)).toBe(1.5);
    expect(speedAt(scene, 1, 1)).toBe(2);
    // v0·t + (v1−v0)·t²/(2D) = 0.5 + 0.5·0.25 = 0.625 at the midpoint.
    expect(consumedSeconds(scene, 0.5, 1)).toBeCloseTo(0.625, 6);
    expect(sourceSpan(scene, 1)).toBeCloseTo(1.5, 6);
  });

  it('walks the source backwards when reversed', () => {
    const scene = clip({ sourceInTicks: 30, speed: 1, reverse: true });
    // One second in the source; reversed starts at its end.
    expect(sourceSecondsAt(scene, 0, DEFAULT_TIMEBASE)).toBeCloseTo(2, 6);
    expect(sourceSecondsAt(scene, 0.5, DEFAULT_TIMEBASE)).toBeCloseTo(1.5, 6);
    expect(sourceSecondsAt(scene, 1, DEFAULT_TIMEBASE)).toBeCloseTo(1, 6);
  });

  it('combines a ramp with a reversed source range', () => {
    const scene = clip({ sourceInTicks: 0, speed: 1, speedEnd: 3, reverse: true });
    expect(sourceSecondsAt(scene, 0, DEFAULT_TIMEBASE)).toBeCloseTo(2, 6);
    expect(sourceSecondsAt(scene, 1, DEFAULT_TIMEBASE)).toBeCloseTo(0, 6);
  });

  it('clamps out-of-range values and empty durations', () => {
    expect(speedCurve({ speed: 9, speedEnd: 0.1 })).toEqual({ start: 4, end: 0.25 });
    expect(consumedSeconds(clip(), 1, 0)).toBe(0);
    expect(speedAt(clip({ speed: 2 }), 4, 0)).toBe(2);
  });
});
