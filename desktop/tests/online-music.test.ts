import { describe, expect, it } from 'vitest';
import { buildOnlineQuery, onlineCredit, onlineLicenseLabel, parseOnlineSearch } from '../src/stores/online-music';
import { emptyProject, edit, validateProject, type AudioClip, type Scene } from '../src/stores/model';

const result = (over: Record<string, unknown> = {}) => ({
  id: 'abc', title: 'Sunny Day', creator: 'Some Band', url: 'https://cdn.test/a.mp3', foreign_landing_url: 'https://host.test/track/1',
  license: 'by', license_version: '4.0', license_url: 'https://creativecommons.org/licenses/by/4.0/', duration: 120_000, genres: ['pop'], source: 'jamendo', ...over,
});

describe('online music', () => {
  it('adds the genre to the search words once', () => {
    expect(buildOnlineQuery(' happy ', 'Pop')).toBe('happy pop');
    expect(buildOnlineQuery('', 'Lo-fi')).toBe('lo-fi');
    expect(buildOnlineQuery('pop', 'Pop')).toBe('pop');
    expect(buildOnlineQuery('rock', 'All')).toBe('rock');
  });
  it('keeps usable CC0 / CC BY / public-domain results and builds the credit', () => {
    const page = parseOnlineSearch({ result_count: 40, page_count: 2, results: [result(), result({ id: 'z', license: 'cc0', title: 'Free' })] }, 1);
    expect(page.tracks.map(t => t.id)).toEqual(['abc', 'z']);
    expect(page.tracks[0].seconds).toBe(120);
    expect(page.tracks[0].credit).toBe('“Sunny Day” by Some Band – licensed under CC BY 4.0 (https://host.test/track/1)');
    expect(page.tracks[1].credit).toContain('CC0');
    expect(page).toMatchObject({ total: 40, pages: 2, page: 1 });
  });
  it('drops anything that is not safe to use commercially or to download', () => {
    const bad = [
      result({ id: '1', license: 'by-nc' }), result({ id: '2', license: 'by-sa' }), result({ id: '3', license: 'by-nd' }),
      result({ id: '4', url: 'http://cdn.test/a.mp3' }), result({ id: '5', title: '' }), result({ id: '6', duration: 2000 }),
      result({ id: '7', duration: 4 * 3600_000 }), null, 'x', result({ id: undefined }),
    ];
    expect(parseOnlineSearch({ results: bad }, 1).tracks).toEqual([]);
    expect(parseOnlineSearch(null, 1).tracks).toEqual([]);
    expect(parseOnlineSearch({ results: 'nope' }, 1).tracks).toEqual([]);
  });
  it('accepts short sound effects only when searching for sound effects', () => {
    const short = result({ id: 'sfx', title: 'Clap', duration: 1500 });
    expect(parseOnlineSearch({ results: [short] }, 1, 'music').tracks).toEqual([]);
    const page = parseOnlineSearch({ results: [short, result({ id: 'long', duration: 5 * 60_000 }), result({ id: 'nc', license: 'by-nc', duration: 1500 })] }, 1, 'sound_effect');
    expect(page.tracks.map(t => t.id)).toEqual(['sfx']);
    expect(page.tracks[0].seconds).toBe(1.5);
  });
  it('labels licenses', () => {
    expect(onlineLicenseLabel({ license: 'by', licenseVersion: '3.0' })).toBe('CC BY 3.0');
    expect(onlineLicenseLabel({ license: 'pdm', licenseVersion: '1.0' })).toBe('Public domain');
    expect(onlineCredit({ title: 'T', artist: 'A', license: 'pdm', licenseVersion: '1.0', licenseUrl: '', landingUrl: 'https://x.test' })).toContain('public domain');
  });
  it('keeps the credit on an audio clip through validation, and old clips still load', () => {
    const scene: Scene = { id: 's1', startTicks: 0, sourceInTicks: 0, name: 'Photo', image: 'data:image/png;base64,AA==', durationTicks: 120, title: '', subtitle: '', color: '#ffffff', fit: 'cover' };
    const base = edit(emptyProject(), { type: 'add', scenes: [scene] });
    const clip: AudioClip = { id: 'a', lane: 0, name: 'Song', data: 'data:audio/mpeg;base64,AA==', startTicks: 0, durationTicks: 100, sourceInSeconds: 0, sourceDurationSeconds: 10, volume: .8, fadeIn: 0, fadeOut: 0 };
    const withCredit = validateProject({ ...base, audio: [{ ...clip, credit: '  “Song” by A – CC BY 4.0  ' }] });
    expect(withCredit.audio[0].credit).toBe('“Song” by A – CC BY 4.0');
    expect(validateProject({ ...base, audio: [clip] }).audio[0]).not.toHaveProperty('credit');
    expect(validateProject({ ...base, audio: [{ ...clip, credit: '   ' }] }).audio[0]).not.toHaveProperty('credit');
    expect(() => validateProject({ ...base, audio: [{ ...clip, credit: 'x'.repeat(601) }] })).toThrow();
  });
});
