/**
 * Online music search. The catalogue is Openverse, filtered to licenses that
 * allow commercial use and edits (CC0, CC BY, public domain). Requests happen
 * only when the user searches, previews or adds a track; the desktop app does
 * the network work in Rust, the browser preview uses `fetch`.
 */
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export type OnlineLicense = 'cc0' | 'by' | 'pdm';
/** Catalogues PixCut can search. `auto` tries Openverse and falls back to Wikimedia Commons. */
export type OnlineProvider = 'openverse' | 'commons' | 'archive';
export type OnlineSource = 'auto' | OnlineProvider;
export const ONLINE_PROVIDERS: { id: OnlineProvider; label: string; kinds: OnlineKind[] }[] = [
  { id: 'openverse', label: 'Openverse', kinds: ['music', 'sound_effect'] },
  { id: 'commons', label: 'Wikimedia Commons', kinds: ['music', 'sound_effect'] },
  { id: 'archive', label: 'Free Music Archive', kinds: ['music'] },
];
export type OnlineTrack = {
  id: string; title: string; artist: string; url: string; landingUrl: string;
  /** Catalogue this result came from; absent on older callers means Openverse. */
  provider?: OnlineProvider;
  /** Original file to use when `url` (a transcode) is missing. */
  fallbackUrl?: string;
  license: OnlineLicense; licenseVersion: string; licenseUrl: string;
  seconds: number; genres: string[]; source: string; credit: string;
};
export type OnlineSearchPage = { tracks: OnlineTrack[]; total: number; pages: number; page: number; provider?: OnlineProvider; /** Commons only: the offset the catalogue says continues this search. Absent means no more results. */ cursor?: number; /** Set when Openverse failed and this page came from another catalogue. */ fellBack?: boolean };

/** When a catalogue last failed. The chips show it so a dead catalogue is obvious, and forget it after ten minutes. */
const failedAt = new Map<OnlineProvider, number>();
const DOWN_FOR_MS = 10 * 60_000;
export const catalogueDown = (provider: OnlineProvider, now = Date.now()) => now - (failedAt.get(provider) ?? -Infinity) < DOWN_FOR_MS;
export const resetCatalogueHealth = () => failedAt.clear();
async function tracked<T>(provider: OnlineProvider, task: Promise<T>): Promise<T> {
  try { const value = await task; failedAt.delete(provider); return value; }
  catch (error) { failedAt.set(provider, Date.now()); throw error; }
}

export const ONLINE_GENRES = ['Pop', 'Rock', 'Indie', 'Electronic', 'Hip-hop', 'Funk', 'Lo-fi', 'Jazz', 'Acoustic', 'Cinematic'] as const;
const ALLOWED = new Set<string>(['cc0', 'by', 'pdm']);
const MAX_SECONDS = 15 * 60;

/** `sound_effect` searches short effects; both kinds share the same licence filter. */
export type OnlineKind = 'music' | 'sound_effect';
const LIMITS: Record<OnlineKind, { min: number; max: number }> = { music: { min: 5, max: MAX_SECONDS }, sound_effect: { min: .2, max: 60 } };
export const ONLINE_SOUND_TOPICS = ['Applause', 'Laughter', 'Cheering', 'Whoosh', 'Impact', 'Rain', 'Footsteps', 'Camera', 'Airhorn', 'Typing', 'Rimshot', 'Heartbeat', 'Drum roll', 'Record scratch', 'Explosion', 'Notification'] as const;

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
    if (!ALLOWED.has(license) || !url || !title || typeof r.id !== 'string' || !importableUrl(url)) continue;
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

const PAGE_SIZE = 20;
/** Commons pages are larger: its licence mix (mostly share-alike) filters out most hits, so fewer round trips matter. */
const COMMONS_PAGE_SIZE = 50;
/** How long Auto waits for Openverse before using the fallback; the panel mentions the switch after this. */
export const FALLBACK_AFTER_MS = 6_000;

export const commonsSearchUrl = (query: string, page: number, offset = (Math.max(1, page) - 1) * COMMONS_PAGE_SIZE) =>
  `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`${query.trim()} filetype:audio`)}&gsrnamespace=6&gsrlimit=${COMMONS_PAGE_SIZE}&gsroffset=${Math.max(0, Math.floor(offset))}&prop=imageinfo&iiprop=url|size|extmetadata&format=json&formatversion=2&origin=*`;

const stripHtml = (value: unknown) => typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim() : '';

/** Commons names its licence in words. Only CC0, plain CC BY and public domain pass; share-alike, NC and ND do not. */
export function commonsLicense(shortName: string): { license: OnlineLicense; version: string } | null {
  const name = shortName.trim();
  if (/^CC0/i.test(name)) return { license: 'cc0', version: '1.0' };
  const by = /^CC[ -]BY[ -](\d\.\d)(?:[ -]\w+)?$/i.exec(name);
  if (by && !/SA|NC|ND/i.test(name.replace(/^CC[ -]BY/i, ''))) return { license: 'by', version: by[1] };
  if (/^(public domain|pd\b)/i.test(name)) return { license: 'pdm', version: '1.0' };
  return null;
}

/**
 * Wikimedia's audio is mostly Ogg. It also keeps an MP3 transcode, which plays everywhere, so try that first.
 * The original is only a usable fallback when PixCut can import its format; FLAC and Opus files are not,
 * so they rely on the transcode alone.
 */
const IMPORTABLE_ORIGINALS = new Set(['ogg', 'oga', 'wav']);

/** Formats PixCut uses as they are. */
const SUPPORTED_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'webm']);
/** Formats the desktop app converts to AAC with FFmpeg after downloading. MIDI is not one: it has no sound until a synthesizer renders it. */
const CONVERTIBLE_EXTENSIONS = new Set(['flac', 'opus', 'wma', 'aif', 'aiff', 'mka']);

let converter = false;
let converterTask: Promise<boolean> | null = null;
/** Whether FFmpeg is installed, so convertible files can be listed. Asked once; the browser preview has no FFmpeg. */
export function ensureConverterKnown(): Promise<boolean> {
  converterTask ??= isTauri() ? invoke<boolean>('exporter_available').then(found => (converter = Boolean(found)), () => false) : Promise.resolve(false);
  return converterTask;
}
export const setConverterAvailable = (available: boolean) => { converter = available; converterTask = Promise.resolve(available); };

const urlExtension = (url: string) => /\.([a-z0-9]{1,5})$/i.exec(url.split(/[?#]/)[0])?.[1]?.toLowerCase() ?? '';
const usableExtension = (extension: string) => SUPPORTED_EXTENSIONS.has(extension) || (converter && CONVERTIBLE_EXTENSIONS.has(extension));
/** A file extension in the URL must be usable; a URL with none (a stream endpoint) is judged by the host's content type at download. */
export const importableUrl = (url: string) => { const extension = urlExtension(url); return !extension || /^\d+$/.test(extension) || usableExtension(extension); };

/** `url` is the MP3 transcode that previews everywhere; the original is the fallback whenever PixCut can use it (directly or by converting). */
export function commonsPlayableUrl(original: string): { url: string; fallbackUrl?: string } {
  const match = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/)([0-9a-f]\/[0-9a-f]{2}\/)([^/?#]+\.(ogg|oga|opus|flac|wav))(?:[?#].*)?$/i.exec(original);
  if (!match) return { url: original };
  const url = `${match[1]}transcoded/${match[2]}${match[3]}/${match[3]}.mp3`;
  const extension = match[4].toLowerCase();
  return IMPORTABLE_ORIGINALS.has(extension) || (converter && CONVERTIBLE_EXTENSIONS.has(extension)) ? { url, fallbackUrl: original } : { url };
}

/** The parts of a Wikimedia Commons search answer that are read; every field may be missing or the wrong type. */
type CommonsPage = { title?: unknown; pageid?: unknown; imageinfo?: { url?: unknown; descriptionurl?: unknown; duration?: unknown; extmetadata?: Record<string, { value?: unknown } | undefined> }[] };
type CommonsResponse = { query?: { pages?: unknown }; continue?: { gsroffset?: unknown } };

export function parseCommonsSearch(json: unknown, page: number, kind: OnlineKind = 'music'): OnlineSearchPage {
  const root = (json && typeof json === 'object' ? json : {}) as CommonsResponse;
  const pages: CommonsPage[] = Array.isArray(root.query?.pages) ? root.query.pages : [];
  const tracks: OnlineTrack[] = [];
  for (const item of pages) {
    const info = item?.imageinfo?.[0], meta = info?.extmetadata ?? {};
    const rawUrl = https(info?.url)?.replace(/[?#].*$/, '');
    const licence = commonsLicense(stripHtml(meta.LicenseShortName?.value));
    const exact = typeof info?.duration === 'number' && Number.isFinite(info.duration) ? info.duration : 0;
    const title = stripHtml(meta.ObjectName?.value).slice(0, 100) || String(item?.title ?? '').replace(/^File:/, '').replace(/\.\w+$/, '').replace(/_/g, ' ').slice(0, 100);
    if (!rawUrl || !licence || !title || typeof item?.pageid !== 'number') continue;
    if (!usableExtension(urlExtension(rawUrl))) continue; // MIDI, and FLAC/Opus without FFmpeg, cannot be added
    if (exact < LIMITS[kind].min || exact > LIMITS[kind].max) continue;
    const landingUrl = https(info?.descriptionurl) || rawUrl;
    const base = { title, artist: stripHtml(meta.Artist?.value).slice(0, 80) || 'Unknown author', license: licence.license, licenseVersion: licence.version, licenseUrl: https(meta.LicenseUrl?.value), landingUrl };
    tracks.push({ id: `commons-${item.pageid}`, ...base, provider: 'commons', ...commonsPlayableUrl(rawUrl), seconds: kind === 'music' ? Math.round(exact) : Math.max(.2, Math.round(exact * 10) / 10), genres: [], source: 'wikimedia commons', credit: onlineCredit(base) });
  }
  const next = root.continue?.gsroffset, cursor = typeof next === 'number' && Number.isFinite(next) && pages.length > 0 ? next : undefined;
  return { tracks, total: (page - 1) * COMMONS_PAGE_SIZE + pages.length + (cursor !== undefined ? 1 : 0), pages: cursor !== undefined ? page + 1 : page, page, provider: 'commons', ...(cursor !== undefined ? { cursor } : {}) };
}

const ARCHIVE_LICENSES = ['http://creativecommons.org/licenses/by/4.0/', 'http://creativecommons.org/licenses/by/3.0/', 'http://creativecommons.org/licenses/by/2.5/', 'http://creativecommons.org/licenses/by/2.0/', 'http://creativecommons.org/publicdomain/zero/1.0/'];

/** Lucene treats punctuation as syntax, so only letters, digits and spaces reach the query. */
export const archiveWords = (query: string) => query.replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

/**
 * Internet Archive, limited to its Free Music Archive mirror. Searching all of archive.org is
 * unsafe: its licence field is whatever the uploader typed, including covers and remixes.
 */
export const archiveSearchUrl = (query: string, page: number) => {
  const words = archiveWords(query);
  const q = `${words ? `(${words}) AND ` : ''}mediatype:audio AND collection:freemusicarchive AND licenseurl:(${ARCHIVE_LICENSES.map(url => `"${url}"`).join(' OR ')})`;
  return `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=licenseurl&rows=${PAGE_SIZE / 2}&page=${Math.max(1, page)}&output=json`;
};

export const archiveMetadataUrl = (identifier: string) => `https://archive.org/metadata/${encodeURIComponent(identifier)}`;

/** Maps the licence URL on an item. Only plain CC BY, CC0 and public domain pass. */
export function archiveLicense(url: string): { license: OnlineLicense; version: string } | null {
  const by = /^https?:\/\/creativecommons\.org\/licenses\/by\/(\d\.\d)\/?$/i.exec(url.trim());
  if (by) return { license: 'by', version: by[1] };
  if (/^https?:\/\/creativecommons\.org\/publicdomain\/zero\/1\.0\/?$/i.test(url.trim())) return { license: 'cc0', version: '1.0' };
  if (/^https?:\/\/creativecommons\.org\/publicdomain\/mark\/1\.0\/?$/i.test(url.trim())) return { license: 'pdm', version: '1.0' };
  return null;
}

const archiveSeconds = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  const parts = value.split(':').map(Number);
  return parts.every(Number.isFinite) && parts.length <= 3 ? parts.reduce((total, part) => total * 60 + part, 0) : 0;
};

/** The MP3 tracks of one archive item, credited from the item's licence. */
export function archiveTracks(item: { identifier: string; title?: string; creator?: string; licenseurl?: string }, metadata: unknown, limit = 4): OnlineTrack[] {
  const licence = archiveLicense(String(item.licenseurl ?? ''));
  const files = (metadata && typeof metadata === 'object' && Array.isArray((metadata as { files?: unknown }).files) ? (metadata as { files: Record<string, unknown>[] }).files : []);
  if (!licence || !/^[\w.-]+$/.test(item.identifier)) return [];
  const tracks: OnlineTrack[] = [];
  for (const file of files) {
    const name = typeof file?.name === 'string' ? file.name : '';
    if (!/mp3/i.test(String(file?.format)) || !/\.mp3$/i.test(name) || name.includes('/')) continue;
    const exact = archiveSeconds(file.length);
    if (exact < LIMITS.music.min || exact > LIMITS.music.max) continue;
    const title = text(file.title, 100) || name.replace(/\.mp3$/i, '').replace(/_/g, ' ').slice(0, 100);
    const base = { title, artist: text(file.creator, 80) || text(item.creator, 80) || 'Unknown artist', license: licence.license, licenseVersion: licence.version, licenseUrl: String(item.licenseurl), landingUrl: `https://archive.org/details/${item.identifier}` };
    tracks.push({ id: `archive-${item.identifier}/${name}`, ...base, provider: 'archive', url: `https://archive.org/download/${item.identifier}/${encodeURIComponent(name)}`, seconds: Math.round(exact), genres: [], source: 'free music archive', credit: onlineCredit(base) });
    if (tracks.length >= limit) break;
  }
  return tracks;
}

const searchArchive = (query: string, page: number) => tracked('archive', archiveSearch(query, page));
async function archiveSearch(query: string, page: number): Promise<OnlineSearchPage> {
  const body = await getJson(archiveSearchUrl(query, page), 'the Free Music Archive') as { response?: { numFound?: number; docs?: Record<string, unknown>[] } };
  const docs = Array.isArray(body?.response?.docs) ? body.response!.docs! : [];
  const found = await Promise.all(docs.map(async doc => {
    const identifier = typeof doc.identifier === 'string' ? doc.identifier : '';
    if (!identifier) return [];
    try { return archiveTracks({ identifier, title: text(doc.title, 100), creator: Array.isArray(doc.creator) ? String(doc.creator[0] ?? '') : text(doc.creator, 80), licenseurl: Array.isArray(doc.licenseurl) ? String(doc.licenseurl[0] ?? '') : String(doc.licenseurl ?? '') }, await getJson(archiveMetadataUrl(identifier), 'the Free Music Archive')); }
    catch { return []; }
  }));
  const total = typeof body?.response?.numFound === 'number' ? body.response.numFound : docs.length;
  return { tracks: found.flat(), total, pages: Math.max(1, Math.min(50, Math.ceil(total / (PAGE_SIZE / 2)))), page, provider: 'archive' };
}

const unreachable = (name: string) => new Error(`Could not reach ${name}. Check your internet connection; the service may also be down, so try again later.`);

/** One GET against an allow-listed catalogue. Desktop goes through Rust, the browser preview uses `fetch`. */
async function getJson(url: string, name: string): Promise<unknown> {
  if (isTauri()) return JSON.parse(await invoke<string>('online_audio_get', { url }));
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) }).catch(() => { throw unreachable(name); });
  if (!response.ok) throw new Error(response.status === 429 ? `${name} is busy right now. Wait a minute and try again.` : `${name} answered with an error (${response.status}). Try again later.`);
  return response.json();
}

const searchOpenverse = (query: string, page: number, kind: OnlineKind) => tracked('openverse', openverseSearch(query, page, kind));
async function openverseSearch(query: string, page: number, kind: OnlineKind): Promise<OnlineSearchPage> {
  let body: unknown;
  if (isTauri()) body = JSON.parse(await invoke<string>('online_music_search', { query, page, category: kind }));
  else body = await getJson(`https://api.openverse.org/v1/audio/?q=${encodeURIComponent(query.trim())}&license=cc0,by,pdm&category=${kind}&mature=false&page_size=${PAGE_SIZE}&page=${page}`, 'Openverse');
  return { ...parseOnlineSearch(body, page, kind), provider: 'openverse' };
}

const searchCommons = (query: string, page: number, kind: OnlineKind, cursor?: number) => tracked('commons', commonsSearch(query, page, kind, cursor));
async function commonsSearch(query: string, page: number, kind: OnlineKind, cursor?: number): Promise<OnlineSearchPage> {
  return parseCommonsSearch(await getJson(commonsSearchUrl(query, page, cursor), 'Wikimedia Commons'), page, kind);
}

const withTimeout = <T,>(task: Promise<T>, ms: number) => new Promise<T>((resolve, reject) => { const timer = setTimeout(() => reject(new Error('timeout')), ms); task.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); }); });

/**
 * Backups for `auto` when Openverse fails, best first. Music tries the Free
 * Music Archive (a deep CC BY catalogue) before Commons, whose music is mostly
 * share-alike and filtered out; sound effects only exist on Commons.
 */
export const fallbackOrder = (kind: OnlineKind): OnlineProvider[] => kind === 'music' ? ['archive', 'commons'] : ['commons'];

function searchProvider(provider: OnlineProvider, query: string, page: number, kind: OnlineKind, cursor?: number): Promise<OnlineSearchPage> {
  if (provider === 'openverse') return searchOpenverse(query, page, kind);
  if (provider === 'commons') return searchCommons(query, page, kind, cursor);
  if (kind !== 'music') return Promise.reject(new Error('The Free Music Archive only has music.'));
  return searchArchive(query, page);
}

/**
 * Searches one catalogue, or in `auto` mode Openverse with backups. The first
 * backup starts alongside Openverse so a hung Openverse costs a few seconds,
 * not a full timeout, and while Openverse is marked down it is skipped
 * entirely. A backup that answers with nothing hands over to the next one.
 */
export async function searchOnline(query: string, page = 1, kind: OnlineKind = 'music', source: OnlineSource = 'auto', cursor?: number): Promise<OnlineSearchPage> {
  if (!query.trim()) throw new Error(kind === 'music' ? 'Type a word or pick a genre to search.' : 'Type a word or pick a topic to search.');
  await ensureConverterKnown();
  if (source !== 'auto') return searchProvider(source, query, page, kind, cursor);
  const [first, ...rest] = fallbackOrder(kind);
  const backup = searchProvider(first, query, page, kind);
  backup.catch(() => {});
  let openverseError: unknown = null, empty: OnlineSearchPage | null = null;
  if (!catalogueDown('openverse')) {
    const openverse = searchOpenverse(query, page, kind);
    openverse.catch(() => {});
    try {
      const found = await withTimeout(openverse, FALLBACK_AFTER_MS);
      if (found.tracks.length) return found;
      empty = found;
    } catch (error) {
      failedAt.set('openverse', Date.now());
      openverseError = error;
    }
  }
  let lastError: unknown = openverseError;
  for (const [index, provider] of [first, ...rest].entries()) {
    try {
      const found = await (index === 0 ? backup : searchProvider(provider, query, page, kind));
      if (found.tracks.length) return { ...found, fellBack: true };
      empty ??= { ...found, fellBack: true };
    } catch (error) { lastError = error; }
  }
  if (empty) return empty;
  throw lastError instanceof Error && lastError.message !== 'timeout' ? lastError : unreachable('the catalogues');
}

/** Kept for existing callers: Openverse only. */
export const searchOnlineMusic = (query: string, page = 1, kind: OnlineKind = 'music') => searchOnline(query, page, kind, 'openverse');

const MIME_BY_EXTENSION: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg' };
/** Hosts label Ogg as `application/ogg` or send nothing; export only accepts audio/* types, so name it by extension. */
export function withAudioMime(dataUrl: string, url: string): string {
  const extension = /\.(\w+)(?:[?#].*)?$/.exec(url)?.[1]?.toLowerCase() ?? '';
  const mime = MIME_BY_EXTENSION[extension];
  return mime ? dataUrl.replace(/^data:[^;,]*/, `data:${mime}`) : dataUrl;
}

export type DownloadedTrack = { reference: string; name: string; bytes: number };

const hostOf = (url: string) => { try { return new URL(url).host; } catch { return 'the host'; } };
const errorText = (error: unknown) => typeof error === 'string' ? error : error instanceof Error ? error.message : 'The download failed.';
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
export const DOWNLOAD_CANCELLED = 'Download cancelled.';
const isCancelled = (error: unknown) => errorText(error) === DOWNLOAD_CANCELLED;

/** Progress of one download. `total` is 0 when the host does not say; `retryIn` counts seconds while a throttled request waits. */
export type DownloadProgress = { received: number; total: number; retryIn: number };

const MB = 1024 * 1024;
const megabytes = (bytes: number) => (bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0);
export function formatDownloadProgress(progress: DownloadProgress): string {
  if (progress.retryIn > 0) return `Busy host, retrying in ${progress.retryIn} s…`;
  if (progress.received <= 0) return 'Starting download…';
  return progress.total > 0 ? `Downloading ${megabytes(progress.received)} / ${megabytes(Math.max(progress.total, progress.received))} MB` : `Downloading ${megabytes(progress.received)} MB`;
}
/** 0–100, or null when the size is unknown (an indeterminate bar). */
export const downloadPercent = (progress: DownloadProgress) => progress.total > 0 && progress.retryIn === 0 ? Math.min(100, Math.round(progress.received / progress.total * 100)) : null;

type ProgressListener = (progress: DownloadProgress & { url: string }) => void;
const progressListeners = new Set<ProgressListener>();
const emitProgress: ProgressListener = progress => progressListeners.forEach(listener => listener(progress));
let nativeProgress = false;

/** Calls `callback` for downloads of any of `urls` until the returned function is called. */
export function subscribeDownloadProgress(urls: string[], callback: (progress: DownloadProgress) => void): () => void {
  if (isTauri() && !nativeProgress) { nativeProgress = true; void listen<DownloadProgress & { url: string }>('online-download-progress', event => emitProgress(event.payload)).catch(() => { nativeProgress = false; }); }
  const listener: ProgressListener = ({ url, ...progress }) => { if (urls.includes(url)) callback(progress); };
  progressListeners.add(listener);
  return () => { progressListeners.delete(listener); };
}

let browserDownload: AbortController | null = null;
/** Stops the download in flight: Rust sets its cancel flag, the browser preview aborts its request. */
export async function cancelOnlineDownload(): Promise<void> {
  if (isTauri()) await invoke('online_download_cancel').catch(() => {});
  else browserDownload?.abort();
}

/** One retry after 2 s on a throttled or overloaded answer, matching the desktop backoff. */
async function fetchRetrying(url: string, controller: AbortController, retryAfterMs = 2_000): Promise<Response> {
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 120_000);
  const attempt = () => fetch(url, { signal: controller.signal }).catch(() => {
    throw new Error(timedOut ? `${hostOf(url)} took too long to answer.` : controller.signal.aborted ? DOWNLOAD_CANCELLED : `Could not download from ${hostOf(url)} in the browser preview. Use the desktop app to add online tracks.`);
  });
  try {
    const first = await attempt();
    if (!RETRY_STATUSES.has(first.status)) return first;
    emitProgress({ url, received: 0, total: 0, retryIn: Math.round(retryAfterMs / 1000) });
    await new Promise(resolve => setTimeout(resolve, retryAfterMs));
    if (controller.signal.aborted) throw new Error(DOWNLOAD_CANCELLED);
    return await attempt();
  } finally { clearTimeout(timer); }
}

/**
 * Desktop: stream into the asset store. Browser preview: a data URL, so adding works without Rust.
 * If the preferred file (a Commons MP3 transcode) fails for any reason, the original file is tried;
 * the final error names the host and status and suggests another track or catalogue. A cancelled
 * download stops at once, with no fallback and no hint.
 */
export async function downloadOnlineTrack(track: OnlineTrack): Promise<DownloadedTrack> {
  try { return await downloadFrom(track, track.url); }
  catch (first) {
    if (isCancelled(first)) throw new Error(DOWNLOAD_CANCELLED);
    if (!track.fallbackUrl) throw hinted(first);
    try { return await downloadFrom(track, track.fallbackUrl); }
    catch (second) { throw isCancelled(second) ? new Error(DOWNLOAD_CANCELLED) : hinted(second); }
  }
}

const hinted = (error: unknown) => { const message = errorText(error); return new Error(/another (track|catalogue)/i.test(message) ? message : `${message} Try another track or catalogue.`); };

async function downloadFrom(track: OnlineTrack, url: string): Promise<DownloadedTrack> {
  if (isTauri()) return invoke<DownloadedTrack>('online_music_download', { url, title: `${track.title} · ${track.artist}`.slice(0, 100) });
  const controller = new AbortController();
  browserDownload = controller;
  try {
    const response = await fetchRetrying(url, controller);
    if (!response.ok) throw new Error(`${hostOf(url)} answered with HTTP ${response.status}.`);
    const total = Number(response.headers.get('content-length')) || 0;
    if (total > 50 * MB) throw new Error('That track is larger than 50 MB. Pick a shorter one.');
    const chunks: Uint8Array[] = [];
    let received = 0;
    if (response.body) {
      const reader = response.body.getReader();
      // Aborting must end a read that is waiting for the next chunk, not only the request.
      controller.signal.addEventListener('abort', () => { void reader.cancel().catch(() => {}); });
      for (;;) {
        const { done, value } = await reader.read().catch(() => { throw new Error(controller.signal.aborted ? DOWNLOAD_CANCELLED : 'The download was interrupted. Check your connection and try again.'); });
        if (done) break;
        chunks.push(value); received += value.length;
        if (received > 50 * MB) { void reader.cancel(); throw new Error('That track is larger than 50 MB. Pick a shorter one.'); }
        emitProgress({ url, received, total, retryIn: 0 });
      }
      if (controller.signal.aborted) throw new Error(DOWNLOAD_CANCELLED);
    } else { const buffer = new Uint8Array(await response.arrayBuffer()); chunks.push(buffer); received = buffer.length; }
    const blob = new Blob(chunks as BlobPart[], { type: response.headers.get('content-type') ?? '' });
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(withAudioMime(String(reader.result), url)); reader.onerror = () => reject(new Error('The music file could not be read.')); reader.readAsDataURL(blob); });
    return { reference: data, name: `${track.title} · ${track.artist}`.slice(0, 100), bytes: blob.size };
  } finally { if (browserDownload === controller) browserDownload = null; }
}

export const onlineHasMore = (page: OnlineSearchPage) => page.provider === 'commons' ? page.cursor !== undefined : page.page < page.pages;

/**
 * Fetches pages until `want` new tracks are found, the catalogue runs out, or `maxFetches` is reached.
 * Licence and length filters can empty a whole page of hits, so one request often adds nothing.
 * `seen` holds the ids already on screen; the returned page lists only new tracks.
 */
export async function searchOnlineFill(query: string, kind: OnlineKind, source: OnlineSource, start: { page: number; cursor?: number }, seen: ReadonlySet<string> = new Set(), want = 10, maxFetches = 5): Promise<OnlineSearchPage> {
  const known = new Set(seen), fresh: OnlineTrack[] = [];
  let page = start.page, cursor = start.cursor, pinned = source, last = null as OnlineSearchPage | null;
  for (let fetches = 0; fetches < maxFetches; fetches++) {
    const found = await searchOnline(query, page, kind, pinned, cursor);
    last = { ...found, fellBack: found.fellBack || last?.fellBack };
    if (found.provider) pinned = found.provider;
    for (const track of found.tracks) if (!known.has(track.id)) { known.add(track.id); fresh.push(track); }
    if (fresh.length >= want || !onlineHasMore(found)) break;
    page = found.page + 1; cursor = found.cursor;
  }
  return { ...last!, tracks: fresh };
}
