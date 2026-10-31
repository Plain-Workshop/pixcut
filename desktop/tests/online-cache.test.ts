import { afterEach, describe, expect, it, vi } from 'vitest';
import { CACHE_MAX_AGE_MS, MAX_CACHED_SEARCHES, cacheKey, cachedSearch, clearOnlineCache, rememberSearch, searchOnlineCached, type SearchRequest } from '../src/stores/online-cache';
import { catalogueLabel, onlineHasMore, resetCatalogueHealth, type OnlineSearchPage, type OnlineTrack } from '../src/stores/online-music';

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { data, getItem: (key: string) => data[key] ?? null, setItem: (key: string, value: string) => { data[key] = value; }, removeItem: (key: string) => { delete data[key]; } };
}

const track = (id: string, patch: Partial<OnlineTrack> = {}): OnlineTrack => ({
  id, title: `Song ${id}`, artist: 'Someone', url: `https://example.org/${id}.mp3`, landingUrl: `https://example.org/${id}`,
  license: 'cc0', licenseVersion: '', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', seconds: 120, genres: [], source: 'example', credit: 'Song by Someone (CC0)', ...patch,
});
const page = (...tracks: OnlineTrack[]): OnlineSearchPage => ({ tracks, total: tracks.length, pages: 1, page: 1, provider: 'openverse' });
const request = (query = 'Lo-fi', patch: Partial<SearchRequest> = {}): SearchRequest => ({ query, page: 1, kind: 'music', source: 'auto', ...patch });

afterEach(() => { vi.unstubAllGlobals(); resetCatalogueHealth(); });

describe('online search cache', () => {
  it('keys a search by kind, catalogue, page and normalised words', () => {
    expect(cacheKey(request('  Lo-Fi  Beats '))).toBe(cacheKey(request('lo-fi beats')));
    expect(cacheKey(request('rain'))).not.toBe(cacheKey(request('rain', { kind: 'sound_effect' })));
    expect(cacheKey(request('rain'))).not.toBe(cacheKey(request('rain', { page: 2 })));
    expect(cacheKey(request('rain'))).not.toBe(cacheKey(request('rain', { source: 'commons' })));
  });

  it('returns what was saved, marked with when', () => {
    const storage = memory();
    rememberSearch(request(), page(track('a'), track('b')), storage, 1000);
    const saved = cachedSearch(request(), storage, 5000);
    expect(saved?.tracks.map(item => item.id)).toEqual(['a', 'b']);
    expect(saved).toMatchObject({ cachedAt: 1000, provider: 'openverse', total: 2 });
    expect(saved?.tracks[0]).not.toHaveProperty('kind');
  });

  it('does not save an empty answer', () => {
    const storage = memory();
    rememberSearch(request(), page(), storage);
    expect(storage.data).toEqual({});
  });

  it('forgets entries after a month and ignores impossible dates', () => {
    const storage = memory();
    rememberSearch(request(), page(track('a')), storage, 1000);
    expect(cachedSearch(request(), storage, 1000 + CACHE_MAX_AGE_MS)).not.toBeNull();
    expect(cachedSearch(request(), storage, 1001 + CACHE_MAX_AGE_MS)).toBeNull();
    const future = memory();
    rememberSearch(request(), page(track('a')), future, 10 * 60_000);
    expect(cachedSearch(request(), future, 1000)).toBeNull();
  });

  it('keeps only the newest searches', () => {
    const storage = memory();
    for (let index = 0; index < MAX_CACHED_SEARCHES + 5; index++) rememberSearch(request(`word${index}`), page(track(`t${index}`)), storage, 1000 + index);
    expect(Object.keys(JSON.parse(storage.data['pixcut.online.cache']))).toHaveLength(MAX_CACHED_SEARCHES);
    expect(cachedSearch(request('word0'), storage, 2000)).toBeNull();
    expect(cachedSearch(request(`word${MAX_CACHED_SEARCHES + 4}`), storage, 2000)).not.toBeNull();
  });

  it('drops anything that fails the favourites rules when reading back', () => {
    const storage = memory();
    rememberSearch(request(), page(track('a')), storage, 1000);
    const raw = JSON.parse(storage.data['pixcut.online.cache']);
    raw[cacheKey(request())].tracks[0].url = 'http://insecure.example/a.mp3';
    storage.data['pixcut.online.cache'] = JSON.stringify(raw);
    expect(cachedSearch(request(), storage, 2000)).toBeNull();
  });

  it('survives corrupt storage', () => {
    for (const bad of ['{not json', '[]', 'null', '"x"', '{"a":1}']) expect(cachedSearch(request(), memory({ 'pixcut.online.cache': bad }))).toBeNull();
    expect(() => rememberSearch(request(), page(track('a')), { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } })).not.toThrow();
  });

  it('can be cleared', () => {
    const storage = memory();
    rememberSearch(request(), page(track('a')), storage);
    clearOnlineCache(storage);
    expect(storage.data).toEqual({});
  });
});

describe('searchOnlineCached', () => {
  const openverseBody = (id: string) => ({ results: [{ id, title: `Song ${id}`, creator: 'Someone', url: `https://example.org/${id}.mp3`, foreign_landing_url: `https://example.org/${id}`, license: 'cc0', license_version: '1.0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/', duration: 120000, genres: [], source: 'jamendo', attribution: 'x' }], result_count: 1, page_count: 1 });

  it('saves a live answer and serves it when every catalogue then fails', async () => {
    const storage = memory();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(openverseBody('live')), { status: 200 })));
    const live = await searchOnlineCached('lo-fi', 1, 'music', 'openverse');
    expect(live.tracks.length).toBeGreaterThan(0);
    expect(live.cachedAt).toBeUndefined();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    const offline = await searchOnlineCached('lo-fi', 1, 'music', 'openverse');
    expect(offline.cachedAt).toBeTypeOf('number');
    expect(offline.tracks.map(item => item.id)).toEqual(live.tracks.map(item => item.id));
  });

  it('still fails when nothing was saved for that search', async () => {
    vi.stubGlobal('localStorage', memory());
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    await expect(searchOnlineCached('never searched', 1, 'music', 'openverse')).rejects.toThrow();
  });

  it('asks for a word before searching, even with a saved answer', async () => {
    await expect(searchOnlineCached('  ', 1, 'music')).rejects.toThrow('Type a word');
  });
});

describe('catalogueLabel', () => {
  it('names the catalogue of every result, treating a missing provider as Openverse', () => {
    expect(catalogueLabel({})).toBe('Openverse');
    expect(catalogueLabel({ provider: 'commons' })).toBe('Wikimedia');
    expect(catalogueLabel({ provider: 'archive' })).toBe('Free Music Archive');
  });
});

describe('saved pages and paging', () => {
  it('never offers more results from a saved page, whatever the catalogue', () => {
    expect(onlineHasMore({ ...page(track('a')), pages: 5 })).toBe(true);
    expect(onlineHasMore({ ...page(track('a')), pages: 5, cachedAt: 1 })).toBe(false);
    expect(onlineHasMore({ ...page(track('a')), provider: 'commons', cursor: 30 })).toBe(true);
    expect(onlineHasMore({ ...page(track('a')), provider: 'commons', cursor: 30, cachedAt: 1 })).toBe(false);
  });
});
