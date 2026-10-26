import { describe, expect, it } from 'vitest';
import { splitTransition, transitionTicksFor } from '../src/components/preview/transition-timing';
import { DEFAULT_TIMEBASE } from '../src/stores/model';

const fade = { type: 'fade' as const, duration: 0.6 };

describe('video transition timing', () => {
  it('reserves the transition window and keeps the project duration', () => {
    const split = splitTransition(30, fade, DEFAULT_TIMEBASE);
    expect(split.transitionTicks).toBe(18);
    expect(split.mainTicks).toBe(12);
    expect(split.mainTicks + split.transitionTicks).toBe(30);
    expect(split.audioTicks).toBe(30);
  });

  it('leaves one tick of moving picture when the clip is very short', () => {
    const split = splitTransition(2, { type: 'fade', duration: 2 }, DEFAULT_TIMEBASE);
    expect(split.transitionTicks).toBe(1);
    expect(split.mainTicks).toBe(1);
    expect(transitionTicksFor(1, fade, DEFAULT_TIMEBASE)).toBe(0);
  });

  it('costs nothing when there is no transition', () => {
    expect(splitTransition(30, null, DEFAULT_TIMEBASE)).toEqual({ transitionTicks: 0, mainTicks: 30, audioTicks: 0 });
    expect(splitTransition(30, { type: 'none', duration: 0.6 }, DEFAULT_TIMEBASE).transitionTicks).toBe(0);
  });

  it('rounds to the project timebase', () => {
    const timebase24 = { numerator: 1, denominator: 24 };
    expect(transitionTicksFor(48, { type: 'fade', duration: 0.5 }, timebase24)).toBe(12);
    expect(splitTransition(48, { type: 'fade', duration: 0.5 }, timebase24).mainTicks).toBe(36);
  });
});
