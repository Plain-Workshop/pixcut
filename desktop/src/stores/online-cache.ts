import { searchOnline, type OnlineKind, type OnlineSearchPage, type OnlineSource, type OnlineTrack } from './online-music';
import { parseFavorites } from './online-favorites';

/**
 * The last good answer to each search, kept on this device so a full outage of
 * the catalogues still shows something. Only catalogue entries are stored
 * (titles, links, licences, credit lines), never audio, and only for searches
 * the user ran. Entries are checked with the same rules as favourites on the
 * way back in, and expire after a month.
 */
const KEY = 'pixcut.online.cache';
export const MAX_CACHED_SEARCHES = 40;
export const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60_000;

type Entry = { savedAt: number; page: Omit<OnlineSearchPage, 'tracks' | 'cachedAt' | 'fellBack'>; tracks: (OnlineTrack & { kind: OnlineKind })[] };
type Store = Record<string, Entry>;
type Reader = Pick<Storage, 'getItem'> | undefined;
type Writer = Pick<Storage, 'getItem' | 'setItem'> | undefined;

export type SearchRequest = { query: string; page: number; kind: OnlineKind; source: OnlineSource; cursor?: number };

export const cacheKey = ({ query, page, kind, source, cursor }: SearchRequest) =>
  [kind, source, page, cursor ?? '', query.trim().toLowerCase().replace(/\s+/g, ' ')].join('|');

function readStore(storage: Reader, now: number): Store {
  try {
    const raw = JSON.parse(storage?.getItem(KEY) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const result: Store = {};
    for (const [key, value] of Object.entries(raw as Record<string, Partial<Entry> | null>)) {
      if (!value || typeof value.savedAt !== 'number' || now - value.savedAt > CACHE_MAX_AGE_MS || value.savedAt > now + 60_000) continue;
      const tracks = parseFavorites(value.tracks);
      const page = value.page;
      if (!tracks.length || !page || typeof page !== 'object' || typeof page.page !== 'number' || typeof page.pages !== 'number' || typeof page.total !== 'number') continue;
      result[key] = { savedAt: value.savedAt, page, tracks };
    }
    return result;
  } catch { return {}; }
}

/** Remembers a search that returned results, keeping the newest `MAX_CACHED_SEARCHES`. */
export function rememberSearch(request: SearchRequest, found: OnlineSearchPage, storage: Writer = globalThis.localStorage, now = Date.now()): void {
  if (!found.tracks.length) return;
  try {
    const store = readStore(storage, now);
    const { tracks, cachedAt: _cachedAt, fellBack: _fellBack, ...page } = found;
    store[cacheKey(request)] = { savedAt: now, page, tracks: tracks.map(track => ({ ...track, kind: request.kind })) };
    const newest = Object.entries(store).sort((a, b) => b[1].savedAt - a[1].savedAt).slice(0, MAX_CACHED_SEARCHES);
    storage?.setItem(KEY, JSON.stringify(Object.fromEntries(newest)));
  } catch { /* a full or blocked disk only means no cache */ }
}

/** The saved answer to a search, marked with when it was saved, or null. */
export function cachedSearch(request: SearchRequest, storage: Reader = globalThis.localStorage, now = Date.now()): OnlineSearchPage | null {
  const entry = readStore(storage, now)[cacheKey(request)];
  if (!entry) return null;
  return { ...entry.page, tracks: entry.tracks.map(({ kind: _kind, ...track }) => track), cachedAt: entry.savedAt };
}

export function clearOnlineCache(storage: Pick<Storage, 'removeItem'> | undefined = globalThis.localStorage): void {
  try { storage?.removeItem(KEY); } catch { /* nothing to clear */ }
}

/**
 * A live search that falls back to the saved answer when every catalogue fails.
 * A live answer replaces the saved one; an empty live answer is shown as is,
 * because "nothing found" is a real result, not an outage.
 */
export async function searchOnlineCached(query: string, page = 1, kind: OnlineKind = 'music', source: OnlineSource = 'auto', cursor?: number): Promise<OnlineSearchPage> {
  const request: SearchRequest = { query, page, kind, source, cursor };
  if (!query.trim()) return searchOnline(query, page, kind, source, cursor);
  try {
    const found = await searchOnline(query, page, kind, source, cursor);
    rememberSearch(request, found);
    return found;
  } catch (error) {
    const saved = cachedSearch(request);
    if (saved) return saved;
    throw error;
  }
}
