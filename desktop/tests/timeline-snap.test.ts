import { describe, expect, it } from 'vitest';
import { landedOn, nearestSnap, snapEdges, snapThreshold, timelineSnapPoints, type SnapPoint } from '../src/components/timeline/timeline-snap';
import { edit, emptyProject, type AudioClip, type Scene } from '../src/stores/model';

const beats = (...ticks: number[]): SnapPoint[] => ticks.map(tick => ({ tick, kind: 'beat' }));
const scene = (id: string, durationTicks: number): Scene => ({ id, name: id, image: 'data:image/png;base64,AA==', startTicks: 0, sourceInTicks: 0, durationTicks, title: '', subtitle: '', color: '#FFFFFF', fit: 'cover' });

describe('nearestSnap', () => {
  it('returns the closest target inside the threshold', () => {
    expect(nearestSnap(31, beats(0, 30, 60), 5)?.tick).toBe(30);
    expect(nearestSnap(44, beats(0, 30, 60), 5)).toBeNull();
    expect(nearestSnap(58, beats(0, 30, 60), 5)?.tick).toBe(60);
    expect(nearestSnap(30, [], 5)).toBeNull();
    expect(nearestSnap(Number.NaN, beats(0, 30), 5)).toBeNull();
  });
  it('prefers the playhead when two targets are equally close', () => {
    expect(nearestSnap(32, [{ tick: 30, kind: 'cut' }, { tick: 34, kind: 'playhead' }], 5)?.kind).toBe('playhead');
    expect(nearestSnap(32, [{ tick: 34, kind: 'playhead' }, { tick: 30, kind: 'cut' }], 5)?.kind).toBe('playhead');
  });
});

describe('snapEdges', () => {
  const points = beats(0, 30, 60, 90);
  it('snaps a moved clip by its closer edge, keeps its length and names the target', () => {
    expect(snapEdges('move', 28, 20, points, 4)).toEqual({ startTicks: 30, durationTicks: 20, guide: { tick: 30, kind: 'beat' } });
    // Start at 13, end at 33: the end is closer to 30.
    expect(snapEdges('move', 13, 20, points, 4)).toMatchObject({ startTicks: 10, durationTicks: 20, guide: { tick: 30 } });
  });
  it('snaps the trimmed edge and keeps the opposite edge fixed', () => {
    expect(snapEdges('start', 27, 33, points, 4)).toMatchObject({ startTicks: 30, durationTicks: 30 });
    expect(snapEdges('end', 40, 22, points, 4)).toMatchObject({ startTicks: 40, durationTicks: 20 });
  });
  it('leaves the clip alone outside the threshold or without targets', () => {
    expect(snapEdges('move', 15, 10, points, 2)).toEqual({ startTicks: 15, durationTicks: 10, guide: null });
    expect(snapEdges('start', 15, 10, [], 8)).toEqual({ startTicks: 15, durationTicks: 10, guide: null });
  });
  it('never collapses or inverts a clip onto its own opposite edge', () => {
    expect(snapEdges('end', 30, 4, beats(30), 8)).toEqual({ startTicks: 30, durationTicks: 4, guide: null });
    expect(snapEdges('start', 26, 4, beats(30), 8).guide).toBeNull();
  });
  it('does not move a clip before the start of the story', () => {
    expect(snapEdges('move', 2, 20, beats(21), 4)).toMatchObject({ startTicks: 1, guide: { tick: 21 } });
    expect(snapEdges('move', 2, 20, beats(19), 4).guide).toBeNull();
  });
});

describe('snap targets', () => {
  it('collects the playhead, cuts, beats and other clips but not the dragged clip', () => {
    let project = edit(emptyProject('Snap'), { type: 'add', scenes: [scene('a', 60), scene('b', 90)] });
    project = edit(project, { type: 'beats', beatTicks: [45] });
    const music: AudioClip = { id: 'music', name: 'Music', data: 'data:audio/wav;base64,AA==', lane: 0, startTicks: 10, durationTicks: 50, sourceInSeconds: 0, sourceDurationSeconds: 10, volume: 1, fadeIn: 0, fadeOut: 0 };
    project = edit(project, { type: 'audio', audio: [music] });
    const ticks = (kind: string, points = timelineSnapPoints(project, 75)) => points.filter(point => point.kind === kind).map(point => point.tick);
    expect(ticks('playhead')).toEqual([75]);
    expect(ticks('cut')).toEqual([0, 60, 60, 150]);
    expect(ticks('beat')).toEqual([45]);
    expect(ticks('clip')).toEqual([10, 60]);
    expect(ticks('clip', timelineSnapPoints(project, null, 'music'))).toEqual([]);
    expect(ticks('playhead', timelineSnapPoints(project, null))).toEqual([]);
  });
  it('shows a guide only when an edge really landed on it after constraints', () => {
    const guide: SnapPoint = { tick: 30, kind: 'beat' };
    expect(landedOn(guide, 30, 10)).toBe(guide);
    expect(landedOn(guide, 20, 10)).toBe(guide);
    expect(landedOn(guide, 22, 10)).toBeNull();
    expect(landedOn(null, 30, 10)).toBeNull();
  });
  it('turns eight pixels into ticks for the current track width', () => {
    expect(snapThreshold(3000, 600)).toBe(40);
    expect(snapThreshold(3000, 0)).toBe(0);
    expect(snapThreshold(10, 10_000)).toBe(1);
  });
});
