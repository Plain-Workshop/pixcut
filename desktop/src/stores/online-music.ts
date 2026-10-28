/**
 * Online music search. The catalogue is Openverse, filtered to licenses that
 * allow commercial use and edits (CC0, CC BY, public domain). Requests happen
 * only when the user searches, previews or adds a track; the desktop app does
 * the network work in Rust, the browser preview uses `fetch`.
 */
import { invoke, isTauri } from '@tauri-apps/api/core';

export type OnlineLicense = 'cc0' | 'by' | 'pdm';
export type OnlineTrack = {
  id: string; title: string; artist: string; url: string; landingUrl: string;
  license: OnlineLicense; licenseVersion: string; licenseUrl: string;
  seconds: number; genres: string[]; source: string; credit: string;
};
export type OnlineSearchPage = { tracks: OnlineTrack[]; total: number; pages: number; page: number };

export const ONLINE_GENRES = ['Pop', 'Rock', 'Indie', 'Electronic', 'Hip-hop', 'Funk', 'Lo-fi', 'Jazz', 'Acoustic', 'Cinematic'] as const;
const ALLOWED = new Set<string>(['cc0', 'by', 'pdm']);
const MAX_SECONDS = 15 * 60;

/** `sound_effect` searches short effects; both kinds share the same licence filter. */
export type OnlineKind = 'music' | 'sound_effect';
const LIMITS: Record<OnlineKind, { min: number; max: number }> = { music: { min: 5, max: MAX_SECONDS }, sound_effect: { min: .2, max: 60 } };
export const ONLINE_SOUND_TOPICS = ['Applause', 'Laughter', 'Cheering', 'Whoosh', 'Impact', 'Rain', 'Footsteps', 'Camera', 'Airhorn', 'Typing'] as const;

/** Genre is a word in the search, since the catalogue has no genre filter. */
export function buildOnlineQuery(query: string, genre: string): string {
  const parts = [query.trim(), genre === 'All' ? '' : genre.toLowerCase()].filter(Boolean);
  return [...new Set(parts)].join(' ');
}

export function onlineCredit(track: Pick<OnlineTrack, 'title' | 'artist' | 'license' | 'licenseVersion' | 'licenseUrl' | 'landingUrl'>): string {
  if (track.license === 'cc0') return `“${track.title}” by ${track.artist} – CC0, public domain (${track.landingUrl})`;
  if (track.license === 'pdm') return `“${track.title}” by ${track.artist} – public domain (${track.landingUrl})`;
  return `“${track.title}” by ${track.artist} – licensed under CC BY ${track.licenseVersion} (${track.landingUrl})`;
}

export const onlineLicenseLabel = (track: Pick<OnlineTrack, 'license' | 'licenseVersion'>) =>
  track.license === 'by' ? `CC BY ${track.licenseVersion}` : track.license === 'cc0' ? 'CC0' : 'Public domain';

const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const https = (value: unknown) => typeof value === 'string' && /^https:\/\//i.test(value) ? value : '';

/** Keeps only results PixCut can use and credit. Anything odd is dropped, not guessed. */
export function parseOnlineSearch(json: unknown, page: number, kind: OnlineKind = 'music'): OnlineSearchPage {
  const root = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const results = Array.isArray(root.results) ? root.results : [];
  const tracks: OnlineTrack[] = [];
  for (const item of results) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const license = text(r.license, 8).toLowerCase();
    const url = https(r.url);
    const title = text(r.title, 100);
    if (!ALLOWED.has(license) || !url || !title || typeof r.id !== 'string') continue;
    const exact = typeof r.duration === 'number' && Number.isFinite(r.duration) ? r.duration / 1000 : 0;
    if (exact < LIMITS[kind].min || exact > LIMITS[kind].max) continue;
    const seconds = kind === 'music' ? Math.round(exact) : Math.max(.2, Math.round(exact * 10) / 10);
    const artist = text(r.creator, 80) || 'Unknown artist';
    const landingUrl = https(r.foreign_landing_url) || url;
    const base = { title, artist, license: license as OnlineLicense, licenseVersion: text(r.license_version, 8) || '4.0', licenseUrl: https(r.license_url), landingUrl };
    tracks.push({
      id: r.id, ...base, url, seconds,
      genres: Array.isArray(r.genres) ? r.genres.filter((g): g is string => typeof g === 'string').slice(0, 4) : [],
      source: text(r.source ?? r.provider, 40),
      credit: onlineCredit(base),
    });
  }
  const total = typeof root.result_count === 'number' ? root.result_count : tracks.length;
  const pages = typeof root.page_count === 'number' ? Math.max(1, Math.min(root.page_count, 50)) : 1;
  return { tracks, total, pages, page };
}

export async function searchOnlineMusic(query: string, page = 1, kind: OnlineKind = 'music'): Promise<OnlineSearchPage> {
  if (!query.trim()) throw new Error('Type a word or pick a genre to search.');
  let body: unknown;
  if (isTauri()) {
    body = JSON.parse(await invoke<string>('online_music_search', { query, page, category: kind }));
  } else {
    const url = `https://api.openverse.org/v1/audio/?q=${encodeURIComponent(query.trim())}&license=cc0,by,pdm&category=${kind}&mature=false&page_size=20&page=${page}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(25_000) }).catch(() => { throw new Error(`Could not reach the ${kind === 'music' ? 'music' : 'sound'} catalogue. Check your internet connection and try again.`); });
    if (!response.ok) throw new Error(response.status === 429 ? 'The music catalogue is busy right now. Wait a minute and try again.' : `The music catalogue answered with an error (${response.status}). Try again later.`);
    body = await response.json();
  }
  return parseOnlineSearch(body, page, kind);
}

export type DownloadedTrack = { reference: string; name: string; bytes: number };

/** Desktop: stream into the asset store. Browser preview: a data URL, so adding works without Rust. */
export async function downloadOnlineTrack(track: OnlineTrack): Promise<DownloadedTrack> {
  if (isTauri()) return invoke<DownloadedTrack>('online_music_download', { url: track.url, title: `${track.title} · ${track.artist}`.slice(0, 100) });
  const response = await fetch(track.url, { signal: AbortSignal.timeout(120_000) }).catch(() => { throw new Error('This host does not allow downloads from the browser preview. Use the desktop app to add online tracks.'); });
  if (!response.ok) throw new Error(`The music host answered with an error (${response.status}).`);
  const blob = await response.blob();
  if (blob.size > 50 * 1024 * 1024) throw new Error('That track is larger than 50 MB. Pick a shorter one.');
  const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('The music file could not be read.')); reader.readAsDataURL(blob); });
  return { reference: data, name: `${track.title} · ${track.artist}`.slice(0, 100), bytes: blob.size };
}
