import { importableUrl, type OnlineKind, type OnlineTrack } from './online-music';

/**
 * Starred online tracks, kept in this browser profile or app profile only. A favourite is the
 * catalogue entry (links, licence and credit line), not the audio: playing or adding it still
 * contacts the host, and only when the user presses Listen or Add.
 */
export type OnlineFavorite = OnlineTrack & { kind: OnlineKind };

const KEY = 'pixcut.online.favorites';
const MAX = 100;
const LICENSES = new Set(['cc0', 'by', 'pdm']);
const secure = (value: unknown) => typeof value === 'string' && /^https:\/\//i.test(value);
const short = (value: unknown, max: number) => typeof value === 'string' && value.length > 0 && value.length <= max;

/** Keeps entries that are still safe to use; anything malformed or unlicensed is dropped. */
export function parseFavorites(value: unknown): OnlineFavorite[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: OnlineFavorite[] = [];
  for (const item of value) {
    const entry = item as Partial<OnlineFavorite> | null;
    if (!entry || typeof entry !== 'object') continue;
    if (!short(entry.id, 200) || !short(entry.title, 100) || !short(entry.artist, 80) || !short(entry.credit, 600)) continue;
    if (!secure(entry.url) || !importableUrl(String(entry.fallbackUrl ?? entry.url)) || !secure(entry.landingUrl) || !LICENSES.has(String(entry.license))) continue;
    if (typeof entry.seconds !== 'number' || !(entry.seconds > 0) || (entry.kind !== 'music' && entry.kind !== 'sound_effect')) continue;
    if (entry.fallbackUrl !== undefined && !secure(entry.fallbackUrl)) continue;
    if (seen.has(entry.id!)) continue;
    seen.add(entry.id!);
    result.push(entry as OnlineFavorite);
    if (result.length >= MAX) break;
  }
  return result;
}

export function loadFavorites(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): OnlineFavorite[] {
  try { return parseFavorites(JSON.parse(storage?.getItem(KEY) ?? '[]')); } catch { return []; }
}

export function saveFavorites(list: OnlineFavorite[], storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void {
  try { storage?.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch { /* storage full or blocked: favourites just are not remembered */ }
}

/** Adds the track at the top, or removes it when already starred. */
export function toggleFavorite(list: OnlineFavorite[], track: OnlineTrack, kind: OnlineKind): OnlineFavorite[] {
  return list.some(item => item.id === track.id) ? list.filter(item => item.id !== track.id) : [{ ...track, kind }, ...list].slice(0, MAX);
}
