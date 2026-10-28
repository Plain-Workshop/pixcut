import { describe, expect, it } from 'vitest';
import { clampPipSource, pipFrameTarget } from '../src/components/preview/pip-playback';

const timebase = { numerator: 1, denominator: 30 };
const clip = { startTicks: 60, durationTicks: 90, sourceInTicks: 15 };

describe('pipFrameTarget', () => {
  it('stays inactive before the clip starts but reports the in-point', () => {
    const frame = pipFrameTarget(clip, 1.5, timebase);
    expect(frame.active).toBe(false);
    expect(frame.local).toBeCloseTo(-0.5);
    expect(frame.source).toBeCloseTo(0.5);
  });

  it('maps playhead seconds onto source seconds inside the clip', () => {
    const frame = pipFrameTarget(clip, 3.25, timebase);
    expect(frame.active).toBe(true);
    expect(frame.local).toBeCloseTo(1.25);
    expect(frame.source).toBeCloseTo(1.75);
  });

  it('starts at the clip boundary and ends just before it', () => {
    expect(pipFrameTarget(clip, 2, timebase).active).toBe(true);
    expect(pipFrameTarget(clip, 4.999, timebase).active).toBe(true);
    expect(pipFrameTarget(clip, 5, timebase).active).toBe(false);
  });

  it('does not go negative when the playhead is before the project start', () => {
    const frame = pipFrameTarget(clip, -3, timebase);
    expect(frame.source).toBeCloseTo(0.5);
    expect(frame.active).toBe(false);
  });

  it('never throws on a clip without an in-point', () => {
    const frame = pipFrameTarget({ startTicks: 0, durationTicks: 30 }, 0.5, timebase);
    expect(frame.active).toBe(true);
    expect(frame.source).toBeCloseTo(0.5);
  });
});

describe('clampPipSource', () => {
  it('keeps a frame of headroom at the end of the media', () => {
    expect(clampPipSource(4.5, 4.2)).toBeCloseTo(4.16);
    expect(clampPipSource(1, 4.2)).toBeCloseTo(1);
    expect(clampPipSource(-1, 4.2)).toBe(0);
  });

  it('survives unknown durations and broken times', () => {
    expect(clampPipSource(2, Number.NaN)).toBe(2);
    expect(clampPipSource(2, Number.POSITIVE_INFINITY)).toBe(2);
    expect(clampPipSource(Number.NaN, 4)).toBe(0);
  });
});
