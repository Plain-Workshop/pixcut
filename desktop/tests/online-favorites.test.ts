import { describe, expect, it } from 'vitest';
import { loadFavorites, parseFavorites, saveFavorites, toggleFavorite, type OnlineFavorite } from '../src/stores/online-favorites';
import type { OnlineTrack } from '../src/stores/online-music';

const track = (over: Partial<OnlineTrack> = {}): OnlineTrack => ({
  id: 't1', title: 'Applause', artist: 'Someone', url: 'https://cdn.test/a.mp3', landingUrl: 'https://host.test/a', license: 'by', licenseVersion: '4.0', licenseUrl: '',
  seconds: 5, genres: [], source: 'x', credit: '“Applause” by Someone – CC BY 4.0', ...over,
});
const memory = (initial?: string) => { let value = initial ?? null; return { getItem: () => value, setItem: (_: string, next: string) => { value = next; } }; };

describe('online favorites', () => {
  it('stars a track at the top and unstars it again', () => {
    const first = toggleFavorite([], track(), 'sound_effect');
    expect(first).toHaveLength(1);
    expect(first[0].kind).toBe('sound_effect');
    const second = toggleFavorite(first, track({ id: 't2' }), 'music');
    expect(second.map(item => item.id)).toEqual(['t2', 't1']);
    expect(toggleFavorite(second, track(), 'sound_effect').map(item => item.id)).toEqual(['t2']);
  });

  it('caps the list at 100', () => {
    let list: OnlineFavorite[] = [];
    for (let i = 0; i < 120; i++) list = toggleFavorite(list, track({ id: `t${i}` }), 'music');
    expect(list).toHaveLength(100);
    expect(list[0].id).toBe('t119');
  });

  it('round-trips through storage', () => {
    const storage = memory();
    saveFavorites(toggleFavorite([], track({ fallbackUrl: 'https://cdn.test/a.ogg' }), 'music'), storage);
    expect(loadFavorites(storage)).toMatchObject([{ id: 't1', kind: 'music', fallbackUrl: 'https://cdn.test/a.ogg' }]);
  });

  it('drops entries that are malformed, unlicensed, duplicated or not https', () => {
    const good = { ...track(), kind: 'music' };
    const bad = [
      { ...good, id: 'a', license: 'by-nc' }, { ...good, id: 'b', url: 'http://cdn.test/a.mp3' }, { ...good, id: 'c', landingUrl: 'javascript:alert(1)' },
      { ...good, id: 'd', kind: 'podcast' }, { ...good, id: 'e', seconds: 0 }, { ...good, id: 'f', credit: '' }, { ...good, id: 'g', fallbackUrl: 'http://x.test/a.ogg' },
      { ...good, id: 'h', title: 'x'.repeat(101) }, null, 'x', 4, good, good,
    ];
    expect(parseFavorites(bad).map(item => item.id)).toEqual(['t1']);
    expect(parseFavorites({ not: 'a list' })).toEqual([]);
  });

  it('survives broken or missing storage', () => {
    expect(loadFavorites(memory('{not json'))).toEqual([]);
    expect(loadFavorites({ getItem: () => { throw new Error('blocked'); } })).toEqual([]);
    expect(() => saveFavorites([], { setItem: () => { throw new Error('full'); } })).not.toThrow();
    expect(loadFavorites(undefined)).toEqual([]);
  });
});
