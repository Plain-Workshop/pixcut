import { describe, expect, it } from 'vitest';
import { constrainPipTiming, freePipStart, pipSourceRoom } from '../src/components/timeline/pip';
import { DEFAULT_TIMEBASE, type Scene } from '../src/stores/model';

const clip = (id: string, startTicks: number, durationTicks: number, overrides: Partial<Scene> = {}): Scene => ({
  id, startTicks, sourceInTicks: 0, durationTicks, name: id, image: '', title: '', subtitle: '',
  color: '#FFFFFF', fit: 'cover', pip: { x: .8, y: .78, width: .32, height: .32, radius: .06, shadow: 60 }, ...overrides,
});

describe('picture-in-picture timing', () => {
  it('finds the first free start and rejects a full track', () => {
    const siblings = [clip('a', 10, 20), clip('b', 40, 20)];
    expect(freePipStart(siblings, 0, 10, 60)).toBe(0);
    expect(freePipStart(siblings, 15, 10, 60)).toBe(30);
    expect(freePipStart(siblings, 30, 10, 60)).toBe(30);
    expect(freePipStart(siblings, 0, 25, 60)).toBe(null);
    expect(freePipStart([], 5, 20, 60)).toBe(5);
  });

  it('moves a clip only into a gap that fits', () => {
    const moving = clip('move', 10, 10);
    const siblings = [clip('a', 0, 10), clip('b', 30, 10), moving];
    expect(constrainPipTiming(moving, 'move', 20, siblings, 60, DEFAULT_TIMEBASE)).toEqual({ startTicks: 40, durationTicks: 10 });
    expect(constrainPipTiming(moving, 'move', -20, siblings, 60, DEFAULT_TIMEBASE)).toEqual({ startTicks: 10, durationTicks: 10 });
  });

  it('trims within neighbours and the source footage', () => {
    const trimming = clip('trim', 20, 10);
    const siblings = [clip('before', 0, 10), clip('after', 40, 10), trimming];
    expect(constrainPipTiming(trimming, 'end', 20, siblings, 60, DEFAULT_TIMEBASE).durationTicks).toBe(20);
    expect(constrainPipTiming(trimming, 'end', -20, siblings, 60, DEFAULT_TIMEBASE).durationTicks).toBe(1);
    expect(constrainPipTiming(trimming, 'start', -10, siblings, 60, DEFAULT_TIMEBASE)).toEqual({ startTicks: 10, durationTicks: 20 });
    const video = clip('video', 20, 10, { mediaKind: 'video', sourceDurationSeconds: 0.5 });
    expect(pipSourceRoom(video, DEFAULT_TIMEBASE)).toBe(15);
    expect(constrainPipTiming(video, 'end', 100, [video], 60, DEFAULT_TIMEBASE).durationTicks).toBe(15);
  });
});
