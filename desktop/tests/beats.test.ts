import { describe, expect, it } from 'vitest';
import { nearestBeat, snapOverlayTiming } from '../src/components/timeline/beats';
import { edit, emptyProject } from '../src/stores/model';

const clip = {
  id: 'one', name: 'One', image: 'data:image/png;base64,AA==',
  startTicks: 0, sourceInTicks: 0, durationTicks: 90,
  title: '', subtitle: '', color: '#FFFFFF', fit: 'cover' as const,
};

describe('nearestBeat', () => {
  it('returns the closest beat inside the threshold', () => {
    expect(nearestBeat(31, [0, 30, 60], 5)).toBe(30);
    expect(nearestBeat(44, [0, 30, 60], 5)).toBeNull();
    expect(nearestBeat(58, [0, 30, 60], 5)).toBe(60);
    expect(nearestBeat(30, [], 5)).toBeNull();
    expect(nearestBeat(Number.NaN, [0, 30], 5)).toBeNull();
  });
});

describe('snapOverlayTiming', () => {
  const beats = [0, 30, 60, 90];

  it('snaps a moved clip by its closer edge and keeps its length', () => {
    expect(snapOverlayTiming('move', 28, 20, beats, 4)).toEqual({ startTicks: 30, durationTicks: 20 });
    // Start at 13, end at 33: the end is closer to 30.
    expect(snapOverlayTiming('move', 13, 20, beats, 4)).toEqual({ startTicks: 10, durationTicks: 20 });
  });

  it('snaps the trimmed edge and keeps the opposite edge fixed', () => {
    expect(snapOverlayTiming('start', 27, 33, beats, 4)).toEqual({ startTicks: 30, durationTicks: 30 });
    expect(snapOverlayTiming('end', 40, 22, beats, 4)).toEqual({ startTicks: 40, durationTicks: 20 });
  });

  it('leaves the clip alone outside the threshold', () => {
    expect(snapOverlayTiming('move', 15, 10, beats, 2)).toEqual({ startTicks: 15, durationTicks: 10 });
    expect(snapOverlayTiming('start', 15, 10, [], 8)).toEqual({ startTicks: 15, durationTicks: 10 });
  });

  it('never produces a clip shorter than one tick', () => {
    expect(snapOverlayTiming('end', 30, 4, [30], 8)).toEqual({ startTicks: 30, durationTicks: 1 });
  });
});

describe('beat markers in the project model', () => {
  it('stores markers sorted, deduplicated and inside the timeline', () => {
    const project = edit(emptyProject('Beats'), { type: 'add', scenes: [clip] });
    const withBeats = edit(project, { type: 'beats', beatTicks: [60, 0, 30, 30] });
    expect(withBeats.beatTicks).toEqual([0, 30, 60]);
    expect(edit(project, { type: 'beats', beatTicks: [] }).beatTicks).toBeUndefined();
  });

  it('rejects markers outside the story or too many of them', () => {
    const project = edit(emptyProject('Beats'), { type: 'add', scenes: [clip] });
    expect(() => edit(project, { type: 'beats', beatTicks: [200] })).toThrow(/timeline/i);
    expect(() => edit(project, { type: 'beats', beatTicks: [-1] })).toThrow(/timeline/i);
    const long = edit(emptyProject('Long'), { type: 'add', scenes: [{ ...clip, mediaKind: 'video' as const, image: 'data:video/mp4;base64,AAAA', durationTicks: 3000 }] });
    expect(() => edit(long, { type: 'beats', beatTicks: Array.from({ length: 501 }, (_, index) => index) })).toThrow(/500/);
    // Duplicates collapse before the cap, so 501 copies of a few beats are fine.
    expect(edit(long, { type: 'beats', beatTicks: Array.from({ length: 501 }, (_, index) => index % 10) }).beatTicks).toHaveLength(10);
  });
});
