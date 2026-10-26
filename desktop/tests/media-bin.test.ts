import { expect, it } from 'vitest';
import { uniqueMediaSources } from '../src/stores/media-bin';
import type { Scene } from '../src/stores/model';
const source: Scene = { id: 'source', startTicks: 0, sourceInTicks: 0, name: 'Photo', image: 'data:image/png;base64,AA==', durationTicks: 300, title: '', subtitle: '', color: '#FFFFFF', fit: 'cover' };
it('lists repeated media once and keeps the imported source rather than a trimmed clip', () => {
  const clips = [{ ...source, id: 'clip-1', durationTicks: 90 }, { ...source, id: 'clip-2' }];
  expect(uniqueMediaSources([source], clips)).toEqual([source]);
  expect(uniqueMediaSources([], clips)).toEqual([clips[0]]);
});
