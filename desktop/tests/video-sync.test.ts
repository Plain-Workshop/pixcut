import { describe, expect, it } from 'vitest';
import { STEP_DRIFT_SECONDS, FORWARD_DRIFT_SECONDS, mediaClockPosition, videoSeekTarget } from '../src/components/preview/video-sync';

describe('videoSeekTarget', () => {
  it('lets forward playback run on its own small drift', () => {
    expect(videoSeekTarget(1, 1.2, true, true, false)).toBeNull();
    expect(videoSeekTarget(1, 1 + FORWARD_DRIFT_SECONDS - 0.01, true, true, false)).toBeNull();
  });

  it('corrects a large forward drift so picture and sound stay together', () => {
    expect(videoSeekTarget(1, 2, true, true, false)).toBe(2);
    expect(videoSeekTarget(2, 1, true, true, false)).toBe(1);
  });

  it('tracks the playhead tightly while paused, scrubbing or reversing', () => {
    expect(videoSeekTarget(1, 1.1, false, true, false)).toBe(1.1);
    expect(videoSeekTarget(1, 1 + STEP_DRIFT_SECONDS - 0.001, false, true, false)).toBeNull();
  });

  it('never fights an in-flight seek or an unloaded element', () => {
    expect(videoSeekTarget(0, 4, false, true, true)).toBeNull();
    expect(videoSeekTarget(0, 4, false, false, false)).toBeNull();
  });

  it('ignores broken clocks instead of throwing', () => {
    expect(videoSeekTarget(Number.NaN, 1, true, true, false)).toBeNull();
    expect(videoSeekTarget(1, Number.NaN, false, true, false)).toBeNull();
    expect(videoSeekTarget(1, Number.POSITIVE_INFINITY, false, true, false)).toBeNull();
  });
});

describe('mediaClockPosition', () => {
  it('maps source seconds onto the project through the in-point and speed', () => {
    expect(mediaClockPosition(3, 1, 1, 4, 10)).toBeCloseTo(12);
    expect(mediaClockPosition(3, 1, 2, 4, 10)).toBeCloseTo(11);
    expect(mediaClockPosition(0.5, 0.5, 1, 2, 0)).toBeCloseTo(0);
  });

  it('ignores media time outside the clip window', () => {
    expect(mediaClockPosition(0.2, 1, 1, 4, 10)).toBeNull();
    expect(mediaClockPosition(6, 1, 1, 4, 10)).toBeNull();
  });

  it('falls back for broken values', () => {
    expect(mediaClockPosition(Number.NaN, 1, 1, 4, 10)).toBeNull();
    expect(mediaClockPosition(3, 1, 1, 0, 10)).toBeNull();
    expect(mediaClockPosition(3, 1, 1, 4, Number.NaN)).toBeNull();
  });
});
