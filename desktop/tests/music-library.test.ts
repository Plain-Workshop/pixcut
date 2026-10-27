import { describe,it,expect } from 'vitest';
import { MUSIC_TRACKS,MUSIC_LICENSE,musicTrackUrl } from '../src/stores/music-library';
import { readFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
describe('offline music library',()=>{
 it('bundles eight original tracks with local sources and reuse permissions',()=>{
  expect(MUSIC_TRACKS).toHaveLength(8);expect(new Set(MUSIC_TRACKS.map(t=>t.id)).size).toBe(8);
  for(const track of MUSIC_TRACKS){expect(track.license).toBe('CC0 1.0');expect(track.author).toBe('PixCut');expect(track.seconds).toBeGreaterThanOrEqual(20);expect(musicTrackUrl(track)).not.toMatch(/^https?:/);expect(existsSync(resolve('public',track.file)),track.id).toBe(true);}
  expect(MUSIC_LICENSE).toContain('commercial');expect(MUSIC_LICENSE).toContain('without attribution');expect(MUSIC_LICENSE).toContain('Automated copyright claims');
  expect(readFileSync('public/music/LICENSE.txt','utf8')).toContain('CC0 1.0 Universal');
 });
});
