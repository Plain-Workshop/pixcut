import { describe, expect, it } from 'vitest';
import { videoGain } from '../src/components/preview/video-audio';

describe('videoGain', () => {
  it('plays imported video audio at full volume without fades', () => {
    expect(videoGain(0, 4)).toBe(1);
    expect(videoGain(2, 4)).toBe(1);
    expect(videoGain(4, 4)).toBe(1);
  });

  it('ramps in linearly and reaches unity at the end of the fade', () => {
    expect(videoGain(0, 4, 1)).toBe(0);
    expect(videoGain(.5, 4, 1)).toBe(.5);
    expect(videoGain(1, 4, 1)).toBe(1);
    expect(videoGain(1.0001, 4, 1)).toBe(1);
  });

  it('ramps out linearly towards the clip end', () => {
    expect(videoGain(3, 4, 0, 1)).toBe(1);
    expect(videoGain(3.5, 4, 0, 1)).toBe(.5);
    expect(videoGain(4, 4, 0, 1)).toBe(0);
  });

  it('multiplies overlapping fades, matching chained afade in the export', () => {
    expect(videoGain(2, 4, 3, 3)).toBeCloseTo(4 / 9);
    expect(videoGain(4, 4, 3, 3)).toBe(0);
    expect(videoGain(10, 4, 0, 1)).toBe(0);
    expect(videoGain(-2, 4, 3)).toBe(0);
  });

  it('ignores broken values instead of throwing during playback', () => {
    expect(videoGain(Number.NaN, 4, 1, 1)).toBe(1);
    expect(videoGain(1, Number.NaN, 1, 1)).toBe(1);
    expect(videoGain(1, 0, 1, 1)).toBe(1);
    expect(videoGain(1, 4, Number.POSITIVE_INFINITY, Number.NaN)).toBe(1);
    expect(videoGain(1, 4, -2, -1)).toBe(1);
  });

  it('scales by the clip sound level', () => {
    expect(videoGain(2, 4, 0, 0, 100)).toBe(1);
    expect(videoGain(2, 4, 0, 0, 40)).toBeCloseTo(.4);
    expect(videoGain(2, 4, 0, 0, 0)).toBe(0);
    expect(videoGain(1, 4, 2, 0, 50)).toBeCloseTo(.25);
    expect(videoGain(2, 4, 0, 0, 140)).toBe(1);
    expect(videoGain(2, 4, 0, 0, -20)).toBe(0);
    expect(videoGain(2, 4, 0, 0, Number.NaN)).toBe(1);
  });

  it('never returns a gain outside the audible range', () => {
    for (const value of [-1, 0, .25, 2, 3.99, 4, 8, Number.NaN]) {
      const gain = videoGain(value, 4, 1.5, 2.5);
      expect(gain).toBeGreaterThanOrEqual(0);
      expect(gain).toBeLessThanOrEqual(1);
    }
  });
});
