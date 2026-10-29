import { describe, expect, it } from 'vitest';
import { findSavedTrack, loadSavedTracks, parseSavedTracks, savedTrackKey, storeSavedTracks, withSavedTrack, withoutSavedTrack, MAX_SAVED_TRACKS } from '../src/stores/online-downloads';
import type { OnlineTrack } from '../src/stores/online-music';

const ref = (c: string) => `pixcut-asset:${c.repeat(64)}`;
const track = (id: string, over: Partial<OnlineTrack> = {}): OnlineTrack => ({
  id, title: `Song ${id}`, artist: 'Band', url: 'https://x.test/a.mp3', landingUrl: 'https://x.test/t', license: 'by', licenseVersion: '4.0', licenseUrl: '',
  seconds: 120, genres: [], source: 'jamendo', credit: `“Song ${id}” by Band – CC BY 4.0`, ...over,
});

describe('downloaded online tracks', () => {
  it('keys tracks by catalogue and id', () => {
    expect(savedTrackKey({ id: '1' })).toBe('openverse:1');
    expect(savedTrackKey({ id: '1', provider: 'commons' })).toBe('commons:1');
  });
  it('adds newest first, replaces the same track and ignores non-stored downloads', () => {
    let list = withSavedTrack([], track('a'), { reference: ref('a'), name: 'A · Band' }, 'music', 'CC BY 4.0', 1);
    list = withSavedTrack(list, track('b'), { reference: ref('b'), name: 'B · Band' }, 'music', 'CC BY 4.0', 2);
    list = withSavedTrack(list, track('a'), { reference: ref('c'), name: 'A · Band' }, 'music', 'CC BY 4.0', 3);
    expect(list.map(t => t.key)).toEqual(['openverse:a', 'openverse:b']);
    expect(list[0].reference).toBe(ref('c'));
    expect(withSavedTrack(list, track('z'), { reference: 'data:audio/mpeg;base64,AA==', name: 'Z' }, 'music', 'CC0')).toBe(list);
    expect(findSavedTrack(list, { id: 'b' })?.title).toBe('Song b');
    expect(withoutSavedTrack(list, 'openverse:a').map(t => t.key)).toEqual(['openverse:b']);
  });
  it('survives damaged storage', () => {
    expect(parseSavedTracks('nope')).toEqual([]);
    expect(parseSavedTracks([null, 3, { key: 'k', reference: 'http://evil', seconds: 5 }, { key: '', reference: ref('a'), seconds: 5 }, { key: 'k', reference: ref('a'), seconds: 0 }])).toEqual([]);
    const ok = parseSavedTracks([{ key: 'k', reference: ref('a'), seconds: 9, landingUrl: 'javascript:alert(1)' }, { key: 'k', reference: ref('b'), seconds: 9 }]);
    expect(ok).toHaveLength(1);
    expect(ok[0].landingUrl).toBe('');
    expect(loadSavedTracks({ getItem: () => '{bad json' })).toEqual([]);
  });
  it('round-trips through storage and caps the list', () => {
    let saved = '';
    const list = Array.from({ length: MAX_SAVED_TRACKS + 5 }, (_, i) => ({ key: `k${i}`, reference: ref('a'), name: 'n', title: 't', artist: 'a', seconds: 5, credit: '', license: 'CC0', landingUrl: '', kind: 'music' as const, savedAt: i }));
    storeSavedTracks(list, { setItem: (_k, v) => { saved = v; } });
    expect(loadSavedTracks({ getItem: () => saved })).toHaveLength(MAX_SAVED_TRACKS);
  });
});
