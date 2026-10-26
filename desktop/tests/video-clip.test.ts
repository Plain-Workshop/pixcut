import { describe, expect, it } from 'vitest';
import { edit, emptyProject, maxSceneTicks, scenePatch, setSceneSeconds, secondsToTicks, DEFAULT_TIMEBASE } from '../src/stores/model';

const video = (durationTicks: number, extra: Record<string, unknown> = {}) => ({
  id: 'clip-1', name: 'Talking head', mediaKind: 'video' as const,
  image: 'data:video/mp4;base64,AAAA', videoPoster: 'data:image/png;base64,AAAA',
  sourceDurationSeconds: 900, startTicks: 0, sourceInTicks: 0, durationTicks,
  title: '', subtitle: '', color: '#FFFFFF', fit: 'cover' as const, ...extra,
});

const photo = (durationTicks: number) => ({
  id: 'photo-1', name: 'Photo', image: 'data:image/png;base64,AAAA',
  startTicks: 0, sourceInTicks: 0, durationTicks,
  title: '', subtitle: '', color: '#FFFFFF', fit: 'cover' as const,
});

describe('video clip length', () => {
  it('accepts video scenes up to ten minutes but keeps photos at thirty seconds', () => {
    const project = emptyProject('Long clips');
    expect(() => edit(project, { type: 'add', scenes: [video(secondsToTicks(180, DEFAULT_TIMEBASE))] })).not.toThrow();
    expect(() => edit(project, { type: 'add', scenes: [video(secondsToTicks(600, DEFAULT_TIMEBASE))] })).not.toThrow();
    expect(() => edit(project, { type: 'add', scenes: [photo(secondsToTicks(31, DEFAULT_TIMEBASE))] })).toThrow(/timing/i);
  });

  it('caps each kind with setSceneSeconds', () => {
    const clip = video(secondsToTicks(30, DEFAULT_TIMEBASE));
    expect(setSceneSeconds(clip, 240).durationTicks).toBe(secondsToTicks(240, DEFAULT_TIMEBASE));
    expect(setSceneSeconds(clip, 900).durationTicks).toBe(maxSceneTicks(clip));
    expect(setSceneSeconds(clip, 900).durationTicks).toBe(secondsToTicks(600, DEFAULT_TIMEBASE));
    expect(setSceneSeconds(photo(30) as never, 900).durationTicks).toBe(secondsToTicks(30, DEFAULT_TIMEBASE));
  });

  it('clamps fades when a long clip is shortened', () => {
    const clip = video(secondsToTicks(120, DEFAULT_TIMEBASE), { fadeIn: 5, fadeOut: 5 });
    const shortened = setSceneSeconds(clip, 2);
    expect(shortened.fadeIn).toBe(2);
    expect(shortened.fadeOut).toBe(2);
  });
});

describe('video clip sound', () => {
  it('accepts a level from 0 to 100 and defaults to full volume', () => {
    const project = emptyProject('Sound');
    expect(() => edit(project, { type: 'add', scenes: [video(30, { videoVolume: 0 })] })).not.toThrow();
    expect(() => edit(project, { type: 'add', scenes: [video(30, { videoVolume: 65 })] })).not.toThrow();
    expect(() => edit(project, { type: 'add', scenes: [video(30, { videoVolume: 101 })] })).toThrow(/invalid/i);
    expect(() => edit(project, { type: 'add', scenes: [video(30, { videoVolume: -1 })] })).toThrow(/invalid/i);
    expect(() => edit(project, { type: 'add', scenes: [video(30, { videoVolume: Number.NaN })] })).toThrow(/invalid/i);
  });

  it('round-trips through scene patches so undo and copy/paste keep it', () => {
    const before = video(30, { videoVolume: 100 });
    const after = video(30, { videoVolume: 25 });
    expect(scenePatch(before as never, after as never)).toMatchObject({ videoVolume: 25 });
  });
});
