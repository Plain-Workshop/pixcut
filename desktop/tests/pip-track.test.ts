import { describe, expect, it } from 'vitest';
import { edit, emptyProject, overlayScenes, totalTicks, validateProject, visualTrack, type Scene } from '../src/stores/model';

const scene = (id: string, startTicks: number, durationTicks = 30): Scene => ({
  id, startTicks, sourceInTicks: 0, durationTicks, name: id,
  image: 'data:image/png;base64,AA==', title: '', subtitle: '', color: '#FFFFFF', fit: 'cover',
});
const placement = { x: 0.8, y: 0.78, width: 0.32, height: 0.32, radius: 0.06, shadow: 60 };
const pip = (id: string, startTicks: number, durationTicks = 20): Scene => ({ ...scene(id, startTicks, durationTicks), pip: placement });
const base = () => edit(emptyProject('PiP'), { type: 'add', scenes: [scene('a', 0), scene('b', 30)] });

describe('picture-in-picture track', () => {
  it('adds a second visual track without changing the timeline length', () => {
    const project = edit(base(), { type: 'pip', scenes: [pip('pip', 10)] });
    expect(totalTicks(project)).toBe(60);
    expect(overlayScenes(project)).toHaveLength(1);
    expect(visualTrack(project)?.clips.map(clip => clip.id)).toEqual(['a', 'b']);
    expect(visualTrack(project)?.role).toBeUndefined();
  });

  it('allows gaps but not overlaps or clips beyond the timeline', () => {
    const project = edit(base(), { type: 'pip', scenes: [pip('one', 0, 20), pip('two', 20, 20)] });
    expect(overlayScenes(project).map(clip => clip.startTicks)).toEqual([0, 20]);
    expect(() => edit(base(), { type: 'pip', scenes: [pip('one', 0, 30), pip('two', 15, 20)] })).toThrow(/overlap/i);
    expect(() => edit(base(), { type: 'pip', scenes: [pip('one', 50, 20)] })).toThrow(/timeline/i);
  });

  it('requires placement and rejects a second overlay track', () => {
    const unplaced = { ...pip('unplaced', 0), pip: undefined };
    expect(() => edit(base(), { type: 'pip', scenes: [unplaced] })).toThrow(/placement/i);
    const project = edit(base(), { type: 'pip', scenes: [pip('pip', 0)] });
    const duplicated = {
      ...project,
      tracks: [...project.tracks, { ...project.tracks.find(track => track.role === 'overlay')!, id: 'second', role: 'overlay' as const, clips: [] }],
    };
    expect(() => validateProject(duplicated)).toThrow(/picture-in-picture/i);
  });

  it('removes the overlay track when the list is emptied', () => {
    const project = edit(base(), { type: 'pip', scenes: [pip('pip', 0)] });
    const cleared = edit(project, { type: 'pip', scenes: [] });
    expect(overlayScenes(cleared)).toHaveLength(0);
    expect(cleared.tracks).toHaveLength(1);
  });

  it('normalizes base starts but keeps overlay starts', () => {
    const project = edit(base(), { type: 'pip', scenes: [pip('pip', 40)] });
    expect(visualTrack(project)?.clips[1].startTicks).toBe(30);
    expect(overlayScenes(project)[0].startTicks).toBe(40);
  });
});
