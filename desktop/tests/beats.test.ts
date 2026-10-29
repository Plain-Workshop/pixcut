import { describe, expect, it } from 'vitest';
import { edit, emptyProject } from '../src/stores/model';

const clip = {
  id: 'one', name: 'One', image: 'data:image/png;base64,AA==',
  startTicks: 0, sourceInTicks: 0, durationTicks: 90,
  title: '', subtitle: '', color: '#FFFFFF', fit: 'cover' as const,
};

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
