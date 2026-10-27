import { describe, expect, it } from 'vitest';
import { audibleVideoWindows, duckGain } from '../src/components/preview/ducking';
import { DEFAULT_TIMEBASE, edit, emptyProject, secondsToTicks, type Scene } from '../src/stores/model';

const scene = (id: string, seconds: number, start: number, extra: Partial<Scene> = {}): Scene => ({
  id, name: id, image: 'data:image/png;base64,AA==', startTicks: secondsToTicks(start),
  sourceInTicks: 0, durationTicks: secondsToTicks(seconds), title: '', subtitle: '',
  color: '#FFFFFF', fit: 'cover', ...extra,
});

describe('audibleVideoWindows', () => {
  it('collects video clips that have sound and ignores photos and muted clips', () => {
    const windows = audibleVideoWindows([
      scene('video', 2, 0, { mediaKind: 'video', image: 'data:video/mp4;base64,AAAA' }),
      scene('photo', 2, 2),
      scene('muted', 2, 4, { mediaKind: 'video', image: 'data:video/mp4;base64,AAAA', videoVolume: 0 }),
    ], DEFAULT_TIMEBASE);
    expect(windows).toEqual([{ start: 0, end: 2 }]);
  });

  it('does not duck music when the video sound bus is silent', () => {
    const scenes = [scene('video', 2, 0, { mediaKind: 'video', image: 'data:video/mp4;base64,AAAA' })];
    expect(audibleVideoWindows(scenes, DEFAULT_TIMEBASE, 0)).toEqual([]);
    expect(audibleVideoWindows(scenes, DEFAULT_TIMEBASE, .5)).toEqual([{ start: 0, end: 2 }]);
  });
});

describe('duckGain', () => {
  const windows = [{ start: 2, end: 4 }];

  it('lowers music inside the window by the chosen amount', () => {
    expect(duckGain(3, windows, 60)).toBeCloseTo(.4);
    expect(duckGain(3, windows, 100)).toBe(0);
    expect(duckGain(3, windows, 0)).toBe(1);
  });

  it('ramps in and out so the dip does not click', () => {
    expect(duckGain(2, windows, 60)).toBe(1);
    expect(duckGain(2.075, windows, 60)).toBeCloseTo(.7);
    expect(duckGain(2.15, windows, 60)).toBeCloseTo(.4);
    expect(duckGain(3.925, windows, 60)).toBeCloseTo(.7);
    expect(duckGain(4, windows, 60)).toBe(1);
  });

  it('uses the deepest overlap and ignores broken input', () => {
    expect(duckGain(3, [{ start: 1, end: 3.5 }, { start: 2.5, end: 5 }], 80)).toBeCloseTo(.2);
    expect(duckGain(3, windows, 60, 0)).toBeCloseTo(.4);
    expect(duckGain(Number.NaN, windows, 60)).toBe(1);
    expect(duckGain(3, [{ start: 4, end: 2 }], 60)).toBe(1);
  });
});

describe('ducking project field', () => {
  it('stores a 0–100 amount and clears it at zero', () => {
    const project = edit(emptyProject('Ducking'), { type: 'ducking', amount: 60 });
    expect(project.ducking).toBe(60);
    expect(edit(project, { type: 'ducking', amount: 0 }).ducking).toBeUndefined();
    expect(() => edit(project, { type: 'ducking', amount: 120 })).toThrow(/ducking/i);
  });
});
