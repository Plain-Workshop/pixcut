import { describe, expect, it } from 'vitest';
import { hasEq } from '../src/components/preview/eq';
import { edit, emptyProject, type AudioClip } from '../src/stores/model';

const audio = (overrides: Partial<AudioClip> = {}): AudioClip => ({
  id: 'music', name: 'Bed.wav', data: 'data:audio/wav;base64,AA==', lane: 0,
  startTicks: 0, durationTicks: 15, sourceInSeconds: 0, sourceDurationSeconds: 1,
  volume: 0.8, fadeIn: 0, fadeOut: 0, low: 0, mid: 0, high: 0, ...overrides,
});

const projectWith = (clip: AudioClip) => {
  const base = edit(emptyProject('EQ'), {
    type: 'add',
    scenes: [{
      id: 'scene', startTicks: 0, sourceInTicks: 0, durationTicks: 60, name: 'Scene',
      image: 'data:image/png;base64,AA==', title: '', subtitle: '', color: '#FFFFFF', fit: 'cover',
    }],
  });
  return edit(base, { type: 'audio', audio: [clip] });
};

describe('audio EQ', () => {
  it('treats missing and zero bands as flat', () => {
    expect(hasEq({})).toBe(false);
    expect(hasEq({ low: 0, mid: 0, high: 0 })).toBe(false);
    expect(hasEq({ low: 0, mid: 0.5, high: 0 })).toBe(true);
    expect(hasEq({ low: -3 })).toBe(true);
  });

  it('validates the three bands and keeps them on the clip', () => {
    const clip = audio({ low: 6, mid: -3, high: 12 });
    const project = projectWith(clip);
    expect(project.audio[0]).toMatchObject({ low: 6, mid: -3, high: 12 });
    expect(() => projectWith(audio({ low: 13 }))).toThrow(/bass/i);
    expect(() => projectWith(audio({ mid: -13 }))).toThrow(/mid/i);
    expect(() => projectWith(audio({ high: Number.NaN }))).toThrow(/treble/i);
  });

  it('omits flat bands so old projects keep their shape', () => {
    const project = projectWith(audio({ low: undefined, mid: undefined, high: undefined }));
    expect(project.audio[0]).not.toHaveProperty('low');
    expect(project.audio[0]).not.toHaveProperty('mid');
    expect(project.audio[0]).not.toHaveProperty('high');
  });
});
