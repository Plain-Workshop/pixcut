/**
 * Tracks the user has downloaded from the Online tab. The audio itself lives in
 * the asset store (`pixcut-asset:` reference); this is a small index so those
 * tracks can be listed, played and added again without the internet.
 */
import type { OnlineTrack } from './online-music';

export type SavedKind = 'music' | 'sound_effect';
export type SavedTrack = {
  key: string; reference: string; name: string; title: string; artist: string;
  seconds: number; credit: string; license: string; landingUrl: string; kind: SavedKind; savedAt: number;
};

const STORAGE_KEY = 'pixcut-online-downloads-v1';
export const MAX_SAVED_TRACKS = 300;
const ASSET = /^pixcut-asset:[a-f0-9]{64}$/;

/** Anything with an id and, optionally, the catalogue it came from. */
type Keyed = { id: string; provider?: string };
export const savedTrackKey = (track: Keyed) => `${track.provider ?? 'openverse'}:${track.id}`;

const str = (value: unknown, max: number) => typeof value === 'string' ? value.slice(0, max) : '';

/** Drops anything malformed, so a damaged entry can never break the panel. */
export function parseSavedTracks(raw: unknown): SavedTrack[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SavedTrack[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const key = str(r.key, 200), reference = str(r.reference, 100);
    if (!key || seen.has(key) || !ASSET.test(reference)) continue;
    const seconds = typeof r.seconds === 'number' && Number.isFinite(r.seconds) && r.seconds > 0 ? r.seconds : 0;
    if (!seconds) continue;
    seen.add(key);
    out.push({
      key, reference, name: str(r.name, 120) || 'Downloaded track', title: str(r.title, 100) || 'Downloaded track', artist: str(r.artist, 80),
      seconds, credit: str(r.credit, 600), license: str(r.license, 40), landingUrl: /^https:\/\//.test(str(r.landingUrl, 500)) ? str(r.landingUrl, 500) : '',
      kind: r.kind === 'sound_effect' ? 'sound_effect' : 'music', savedAt: typeof r.savedAt === 'number' ? r.savedAt : 0,
    });
  }
  return out.slice(0, MAX_SAVED_TRACKS);
}

export function loadSavedTracks(storage: Pick<Storage, 'getItem'> = localStorage): SavedTrack[] {
  try { return parseSavedTracks(JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]')); } catch { return []; }
}

export function storeSavedTracks(tracks: SavedTrack[], storage: Pick<Storage, 'setItem'> = localStorage) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(tracks.slice(0, MAX_SAVED_TRACKS))); } catch { /* the index is optional; the files stay in the asset store */ }
}

/** Adds (or refreshes) a track, newest first. Browser-preview downloads are inline data and are not kept. */
export function withSavedTrack(list: SavedTrack[], track: OnlineTrack, downloaded: { reference: string; name: string }, kind: SavedKind, license: string, now = Date.now()): SavedTrack[] {
  if (!ASSET.test(downloaded.reference)) return list;
  const entry: SavedTrack = { key: savedTrackKey(track), reference: downloaded.reference, name: downloaded.name, title: track.title, artist: track.artist, seconds: track.seconds, credit: track.credit, license, landingUrl: track.landingUrl, kind, savedAt: now };
  return [entry, ...list.filter(item => item.key !== entry.key)].slice(0, MAX_SAVED_TRACKS);
}

export const withoutSavedTrack = (list: SavedTrack[], key: string) => list.filter(item => item.key !== key);
export const findSavedTrack = (list: SavedTrack[], track: Keyed) => list.find(item => item.key === savedTrackKey(track));
