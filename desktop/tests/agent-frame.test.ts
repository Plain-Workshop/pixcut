import { describe, expect, it } from 'vitest';
import { frameSize, resolveFrameTarget } from '../src/app/agent-frame';
import { emptyProject, type Scene } from '../src/stores/model';

function story() {
  const project = emptyProject('Test', '16:9', 30);
  const make = (id: string, startTicks: number): Scene => ({
    id, name: id, image: 'data:image/png;base64,AA==', startTicks, sourceInTicks: 0, durationTicks: 90,
    title: '', subtitle: '', color: '#000000', fit: 'cover',
  }) as Scene;
  project.tracks[0].clips = [make('one', 0), make('two', 90)];
  return project;
}

describe('agent preview frames', () => {
  it('uses project time without a scene id', () => {
    const project = story();
    const first = resolveFrameTarget(project, { atSeconds: 1 });
    expect(first.scene.id).toBe('one');
    const second = resolveFrameTarget(project, { atSeconds: 4 });
    expect(second.scene.id).toBe('two');
    expect(second.localSeconds).toBeCloseTo(1, 1);
  });

  it('measures from the clip start with a scene id and clamps', () => {
    const project = story();
    const target = resolveFrameTarget(project, { sceneId: 'two', atSeconds: 99 });
    expect(target.scene.id).toBe('two');
    expect(target.localSeconds).toBeLessThan(3);
    expect(() => resolveFrameTarget(project, { sceneId: 'nope' })).toThrow(/No scene/);
  });

  it('refuses an empty project', () => {
    expect(() => resolveFrameTarget(emptyProject(), {})).toThrow(/Add a clip/);
  });

  it('keeps the format shape and caps the width', () => {
    const project = story();
    expect(frameSize(project, null)).toEqual({ width: 960, height: 540 });
    expect(frameSize(project, 100000).width).toBe(1920);
    expect(frameSize(project, 10).width).toBe(160);
  });
});
