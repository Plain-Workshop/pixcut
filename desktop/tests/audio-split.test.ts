import { describe, expect, it } from 'vitest';
import { splitAudioClip } from '../src/components/timeline/audio-split';
import type { AudioClip } from '../src/stores/model';

const timebase = { numerator: 1, denominator: 30 };
const clip: AudioClip = {
  id: 'audio-1', name: 'Night drive', data: 'data:audio/wav;base64,AAAA', lane: 2,
  startTicks: 90, durationTicks: 300, sourceInSeconds: 4, sourceDurationSeconds: 30,
  volume: 0.6, fadeIn: 1.5, fadeOut: 2, low: 2, mid: -1, high: 3,
};

describe('splitAudioClip', () => {
  it('keeps the left half in place and starts the right half at the cut', () => {
    const split = splitAudioClip(clip, 120, 'audio-2', timebase)!;
    expect(split.left).toMatchObject({ id: 'audio-1', startTicks: 90, durationTicks: 120, sourceInSeconds: 4, fadeOut: 0 });
    expect(split.right).toMatchObject({ id: 'audio-2', startTicks: 210, durationTicks: 180, sourceInSeconds: 8, fadeIn: 0 });
  });

  it('keeps the lane, level, EQ and outer fades', () => {
    const split = splitAudioClip(clip, 120, 'audio-2', timebase)!;
    for (const half of [split.left, split.right]) expect(half).toMatchObject({ lane: 2, volume: 0.6, low: 2, mid: -1, high: 3 });
    expect(split.left.fadeIn).toBeCloseTo(1.5);
    expect(split.right.fadeOut).toBeCloseTo(2);
  });

  it('clamps outer fades to the new half lengths', () => {
    const split = splitAudioClip(clip, 30, 'audio-2', timebase)!;
    expect(split.left.fadeIn).toBeCloseTo(1);
    expect(split.left.fadeOut).toBe(0);
    expect(split.right.fadeIn).toBe(0);
    expect(split.right.fadeOut).toBeCloseTo(2);
  });

  it('never moves the source past the media length', () => {
    const nearEnd = { ...clip, sourceInSeconds: 29.5, sourceDurationSeconds: 30, durationTicks: 60 };
    const split = splitAudioClip(nearEnd, 30, 'audio-2', timebase)!;
    expect(split.right.sourceInSeconds).toBeLessThanOrEqual(30);
  });

  it('rejects a cut on either edge', () => {
    expect(splitAudioClip(clip, 0, 'audio-2', timebase)).toBeNull();
    expect(splitAudioClip(clip, clip.durationTicks, 'audio-2', timebase)).toBeNull();
    expect(splitAudioClip(clip, 1.5, 'audio-2', timebase)).toBeNull();
  });
});
