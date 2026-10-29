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

import { afterEach, beforeEach, vi } from 'vitest';
import { commonsLicense, commonsPlayableUrl, commonsSearchUrl, parseCommonsSearch, searchOnline } from '../src/stores/online-music';

const commonsPage = (over: Record<string, unknown> = {}, meta: Record<string, string> = {}) => ({
  pageid: 7, title: 'File:Clapping hurray.oga',
  imageinfo: [{ duration: 9.8, url: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Clapping_hurray.oga?utm_source=x', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Clapping_hurray.oga', extmetadata: {
    ObjectName: { value: 'Clapping hurray' }, Artist: { value: '<a href="//x">Zack &amp; friends</a>' }, LicenseShortName: { value: meta.license ?? 'CC BY 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0/' },
  } }], ...over,
});

describe('Wikimedia Commons catalogue', () => {
  it('accepts only CC0, plain CC BY and public domain', () => {
    expect(commonsLicense('CC0')).toEqual({ license: 'cc0', version: '1.0' });
    expect(commonsLicense('CC BY 4.0')).toEqual({ license: 'by', version: '4.0' });
    expect(commonsLicense('CC BY 3.0')).toEqual({ license: 'by', version: '3.0' });
    expect(commonsLicense('Public domain')).toEqual({ license: 'pdm', version: '1.0' });
    for (const bad of ['CC BY-SA 4.0', 'CC BY-NC 4.0', 'CC BY-ND 3.0', 'CC BY-NC-SA 2.0', 'GFDL', 'Fair use', '']) expect(commonsLicense(bad), bad).toBeNull();
  });

  it('turns Ogg files into an MP3 transcode with the original as the fallback', () => {
    const original = 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Clapping_hurray_%28cropped%29.oga';
    expect(commonsPlayableUrl(original)).toEqual({ url: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/1/1b/Clapping_hurray_%28cropped%29.oga/Clapping_hurray_%28cropped%29.oga.mp3', fallbackUrl: original });
    expect(commonsPlayableUrl('https://upload.wikimedia.org/wikipedia/commons/a/ab/Song.mp3')).toEqual({ url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Song.mp3' });
    // FLAC and Opus cannot be imported, so they have no original-file fallback.
    expect(commonsPlayableUrl('https://upload.wikimedia.org/wikipedia/commons/a/ab/Ring.flac')).toEqual({ url: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/a/ab/Ring.flac/Ring.flac.mp3' });
    expect(commonsPlayableUrl('https://upload.wikimedia.org/wikipedia/commons/a/ab/Ring.opus').fallbackUrl).toBeUndefined();
  });

  it('parses results, strips HTML from the author and builds the credit', () => {
    const page = parseCommonsSearch({ continue: { gsroffset: 20 }, query: { pages: [commonsPage()] } }, 1, 'sound_effect');
    expect(page.provider).toBe('commons');
    expect(page.pages).toBe(2);
    expect(page.tracks).toHaveLength(1);
    const [track] = page.tracks;
    expect(track).toMatchObject({ id: 'commons-7', title: 'Clapping hurray', artist: 'Zack & friends', license: 'by', seconds: 9.8, provider: 'commons' });
    expect(track.url).toContain('/transcoded/');
    expect(track.fallbackUrl).not.toContain('utm_source');
    expect(track.credit).toContain('Zack & friends');
    expect(track.credit).toContain('CC BY 4.0');
  });

  it('drops unusable results and survives garbage', () => {
    const bad = [commonsPage({ pageid: 1 }, { license: 'CC BY-SA 4.0' }), commonsPage({ pageid: 2 }, { license: 'CC BY-NC 4.0' }), { pageid: 3, imageinfo: [] }, null, 'x',
      { ...commonsPage({ pageid: 4 }), imageinfo: [{ ...commonsPage().imageinfo[0], url: 'http://insecure.test/a.oga' }] },
      { ...commonsPage({ pageid: 5 }), imageinfo: [{ ...commonsPage().imageinfo[0], duration: 0 }] }];
    expect(parseCommonsSearch({ query: { pages: bad } }, 1, 'sound_effect').tracks).toEqual([]);
    expect(parseCommonsSearch(null, 1).tracks).toEqual([]);
    expect(parseCommonsSearch({ query: { pages: commonsPage({ pageid: 9 }) } }, 1).tracks).toEqual([]);
    const short = commonsPage(); short.imageinfo[0].duration = 1.2;
    expect(parseCommonsSearch({ query: { pages: [short] } }, 1, 'music').tracks).toEqual([]);
    expect(parseCommonsSearch({ query: { pages: [short] } }, 1, 'sound_effect').tracks).toHaveLength(1);
  });

  it('pages with an offset and asks only for audio', () => {
    const url = commonsSearchUrl('rain & wind', 3);
    expect(url).toContain('gsroffset=40');
    expect(decodeURIComponent(url)).toContain('rain & wind filetype:audio');
    expect(url.startsWith('https://commons.wikimedia.org/')).toBe(true);
  });
});

describe('searching with a fallback', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  const openverseBody = { result_count: 1, page_count: 1, results: [result({ id: 'ov', title: 'From Openverse' })] };
  const commonsBody = { query: { pages: [commonsPage()] } };
  const respond = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

  it('uses Openverse when it answers', async () => {
    vi.stubGlobal('fetch', (url: string) => respond(url.includes('openverse') ? openverseBody : commonsBody));
    const page = await searchOnline('rain', 1, 'music');
    expect(page.provider).toBe('openverse');
    expect(page.fellBack).toBeUndefined();
  });

  it('falls back to Commons when Openverse errors', async () => {
    vi.stubGlobal('fetch', (url: string) => url.includes('openverse') ? respond({}, 500) : respond(commonsBody));
    const page = await searchOnline('applause', 1, 'sound_effect');
    expect(page.provider).toBe('commons');
    expect(page.fellBack).toBe(true);
    expect(page.tracks[0].id).toBe('commons-7');
  });

  it('falls back to Commons when Openverse hangs', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', (url: string) => url.includes('openverse') ? new Promise(() => {}) : respond(commonsBody));
    const pending = searchOnline('applause', 1, 'sound_effect');
    await vi.advanceTimersByTimeAsync(7000);
    expect((await pending).provider).toBe('commons');
  });

  it('honours an explicit catalogue and reports when everything is down', async () => {
    vi.stubGlobal('fetch', (url: string) => respond(url.includes('openverse') ? openverseBody : commonsBody));
    expect((await searchOnline('rain', 1, 'sound_effect', 'commons')).provider).toBe('commons');
    vi.stubGlobal('fetch', () => respond({}, 503));
    await expect(searchOnline('rain', 1, 'music')).rejects.toThrow(/error|down/);
    await expect(searchOnline('  ', 1, 'music')).rejects.toThrow(/Type a word/);
  });
});

import { archiveLicense, archiveSearchUrl, archiveTracks, archiveWords } from '../src/stores/online-music';

describe('Free Music Archive (Internet Archive mirror)', () => {
  const item = { identifier: 'album-1', title: 'Album', creator: 'Band', licenseurl: 'http://creativecommons.org/licenses/by/3.0/' };
  const files = [
    { name: 'a.mp3', format: 'VBR MP3', length: '279.04', title: 'Song A' },
    { name: 'b.mp3', format: 'VBR MP3', length: '04:10' },
    { name: 'short.mp3', format: 'VBR MP3', length: '2' },
    { name: 'cover.jpg', format: 'JPEG' },
    { name: 'a.ogg', format: 'Ogg Vorbis', length: '100' },
    { name: 'dir/x.mp3', format: 'VBR MP3', length: '100' },
  ];

  it('only searches the FMA collection with CC BY / CC0 licence URLs and strips query syntax', () => {
    const url = decodeURIComponent(archiveSearchUrl('jazz" OR collection:texts (x)', 2));
    expect(url).toContain('collection:freemusicarchive');
    expect(url).toContain('licenseurl:("http://creativecommons.org/licenses/by/4.0/"');
    expect(url).toContain('page=2');
    expect(url).not.toContain('collection:texts');
    expect(archiveWords('a:b "c" (d)*')).toBe('a b c d');
  });

  it('maps licence URLs and rejects share-alike, NC and ND', () => {
    expect(archiveLicense('http://creativecommons.org/licenses/by/4.0/')).toEqual({ license: 'by', version: '4.0' });
    expect(archiveLicense('http://creativecommons.org/publicdomain/zero/1.0/')).toEqual({ license: 'cc0', version: '1.0' });
    for (const bad of ['http://creativecommons.org/licenses/by-sa/3.0/', 'http://creativecommons.org/licenses/by-nc/3.0/', 'http://creativecommons.org/licenses/by-nd/3.0/', 'https://evil.test/licenses/by/4.0/', '']) expect(archiveLicense(bad), bad).toBeNull();
  });

  it('lists the usable MP3 files of an item with credits', () => {
    const tracks = archiveTracks(item, { files });
    expect(tracks.map(t => t.title)).toEqual(['Song A', 'b']);
    expect(tracks[0]).toMatchObject({ provider: 'archive', seconds: 279, artist: 'Band', license: 'by', url: 'https://archive.org/download/album-1/a.mp3' });
    expect(tracks[1].seconds).toBe(250);
    expect(tracks[0].credit).toContain('CC BY 3.0');
    expect(archiveTracks({ ...item, licenseurl: 'http://creativecommons.org/licenses/by-sa/3.0/' }, { files })).toEqual([]);
    expect(archiveTracks({ ...item, identifier: '../x' }, { files })).toEqual([]);
    expect(archiveTracks(item, null)).toEqual([]);
    expect(archiveTracks(item, { files }, 1)).toHaveLength(1);
  });

  it('is music only', async () => {
    await expect(searchOnline('rain', 1, 'sound_effect', 'archive')).rejects.toThrow(/only has music/);
  });
});

import { onlineHasMore, searchOnlineFill } from '../src/stores/online-music';

describe('loading more results', () => {
  afterEach(() => vi.unstubAllGlobals());
  const good = (n: number) => commonsPage({ pageid: n }, { license: 'CC BY 4.0' });
  const rejected = (n: number) => commonsPage({ pageid: n }, { license: 'CC BY-NC 4.0' });
  const reply = (pages: unknown[], next?: number) => Promise.resolve(new Response(JSON.stringify({ ...(next === undefined ? {} : { continue: { gsroffset: next } }), query: { pages } })));

  /** A fake Commons: offset → its page of hits. */
  function commons(pagesByOffset: Record<number, [unknown[], number?]>) {
    const offsets: number[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      const offset = Number(new URL(url).searchParams.get('gsroffset'));
      offsets.push(offset);
      const [pages, next] = pagesByOffset[offset] ?? [[], undefined];
      return reply(pages, next);
    });
    return offsets;
  }

  it('keeps fetching when a page filters down to nothing, following the catalogue cursor', async () => {
    const offsets = commons({ 20: [[rejected(1), rejected(2)], 37], 37: [[rejected(3)], 51], 51: [[good(10), good(11)], 70] });
    const page = await searchOnlineFill('rain', 'sound_effect', 'commons', { page: 2, cursor: 20 }, new Set(), 2);
    expect(offsets).toEqual([20, 37, 51]);
    expect(page.tracks.map(t => t.id)).toEqual(['commons-10', 'commons-11']);
    expect(page.cursor).toBe(70);
    expect(onlineHasMore(page)).toBe(true);
  });

  it('drops tracks already on screen and duplicates inside the fetch', async () => {
    commons({ 0: [[good(1), good(2), good(2)], undefined] });
    const page = await searchOnlineFill('rain', 'sound_effect', 'commons', { page: 1 }, new Set(['commons-1']));
    expect(page.tracks.map(t => t.id)).toEqual(['commons-2']);
  });

  it('stops cleanly when the catalogue runs out', async () => {
    const offsets = commons({ 20: [[rejected(1)], undefined] });
    const page = await searchOnlineFill('rain', 'sound_effect', 'commons', { page: 2, cursor: 20 });
    expect(offsets).toEqual([20]);
    expect(page.tracks).toEqual([]);
    expect(onlineHasMore(page)).toBe(false);
  });

  it('gives up after the fetch cap instead of looping forever', async () => {
    const offsets = commons(Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i * 10, [[rejected(i)], (i + 1) * 10] as [unknown[], number]])));
    const page = await searchOnlineFill('rain', 'sound_effect', 'commons', { page: 1, cursor: 0 }, new Set(), 10, 5);
    expect(offsets).toHaveLength(5);
    expect(page.tracks).toEqual([]);
    expect(onlineHasMore(page)).toBe(true);
  });

  it('stays on the catalogue that answered first when paging in auto mode', async () => {
    const seen: string[] = [];
    vi.stubGlobal('fetch', (url: string) => { seen.push(new URL(url).host); return url.includes('openverse') ? Promise.resolve(new Response('{}', { status: 500 })) : reply([good(1)], 20); });
    const first = await searchOnlineFill('applause', 'sound_effect', 'auto', { page: 1 }, new Set(), 1);
    expect(first.provider).toBe('commons');
    expect(first.fellBack).toBe(true);
    seen.length = 0;
    await searchOnlineFill('applause', 'sound_effect', first.provider!, { page: 2, cursor: first.cursor }, new Set(['commons-1']), 1, 1);
    expect(seen).toEqual(['commons.wikimedia.org']);
  });
});

import { catalogueDown, resetCatalogueHealth } from '../src/stores/online-music';

describe('catalogue health', () => {
  afterEach(() => { vi.unstubAllGlobals(); resetCatalogueHealth(); });
  it('remembers a failed catalogue for ten minutes and forgets it after a success', async () => {
    resetCatalogueHealth();
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('{}', { status: 500 })));
    await searchOnline('rain', 1, 'music', 'openverse').catch(() => {});
    expect(catalogueDown('openverse')).toBe(true);
    expect(catalogueDown('commons')).toBe(false);
    expect(catalogueDown('openverse', Date.now() + 11 * 60_000)).toBe(false);
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(JSON.stringify({ result_count: 0, page_count: 1, results: [] }))));
    await searchOnline('rain', 1, 'music', 'openverse');
    expect(catalogueDown('openverse')).toBe(false);
  });
});

import { withAudioMime } from '../src/stores/online-music';
describe('downloaded audio type', () => {
  it('names the data URL by file extension so export accepts it', () => {
    expect(withAudioMime('data:application/ogg;base64,AA==', 'https://x.test/a.oga?x=1')).toBe('data:audio/ogg;base64,AA==');
    expect(withAudioMime('data:;base64,AA==', 'https://x.test/a.MP3')).toBe('data:audio/mpeg;base64,AA==');
    expect(withAudioMime('data:audio/x-foo;base64,AA==', 'https://x.test/stream')).toBe('data:audio/x-foo;base64,AA==');
  });
});

import { downloadOnlineTrack, type OnlineTrack } from '../src/stores/online-music';
describe('downloading a track', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  const base: OnlineTrack = { id: 'c', title: 'Clap', artist: 'A', url: 'https://upload.wikimedia.org/t.mp3', fallbackUrl: 'https://upload.wikimedia.org/o.oga', landingUrl: 'https://x.test', license: 'cc0', licenseVersion: '1.0', licenseUrl: '', seconds: 3, genres: [], source: 'x', credit: 'c' };
  const audio = () => new Response(new Blob(['abc'], { type: 'application/ogg' }));
  // Vitest runs in Node, which has no FileReader; a tiny stand-in is enough for the data-URL step.
  beforeEach(() => {
    vi.stubGlobal('FileReader', class { result = ''; onload: (() => void) | null = null; onerror: (() => void) | null = null; readAsDataURL(blob: Blob) { void blob.arrayBuffer().then(buffer => { this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buffer).toString('base64')}`; this.onload?.(); }); } });
  });

  it('retries a 429 once, then succeeds', async () => {
    vi.useFakeTimers();
    let calls = 0;
    vi.stubGlobal('fetch', () => Promise.resolve(++calls === 1 ? new Response('', { status: 429 }) : audio()));
    const pending = downloadOnlineTrack({ ...base, fallbackUrl: undefined });
    await vi.advanceTimersByTimeAsync(2100);
    expect((await pending).reference.startsWith('data:audio/mpeg')).toBe(true);
    expect(calls).toBe(2);
  });

  it('falls back to the original file when the transcode is missing, and labels Ogg as audio/ogg', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', (url: string) => { urls.push(url); return Promise.resolve(url.endsWith('.mp3') ? new Response('', { status: 404 }) : audio()); });
    const result = await downloadOnlineTrack(base);
    expect(urls).toEqual(['https://upload.wikimedia.org/t.mp3', 'https://upload.wikimedia.org/o.oga']);
    expect(result.reference.startsWith('data:audio/ogg')).toBe(true);
  });

  it('names the host and status and suggests another track when every attempt fails', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('', { status: 429 })));
    const pending = downloadOnlineTrack(base).then(() => new Error('unexpected success'), (error: Error) => error);
    await vi.advanceTimersByTimeAsync(10_000);
    const error = await pending;
    expect(error.message).toContain('upload.wikimedia.org');
    expect(error.message).toContain('429');
    expect(error.message).toMatch(/another track or catalogue/);
  });
});

import { DOWNLOAD_CANCELLED, cancelOnlineDownload, downloadPercent, formatDownloadProgress, subscribeDownloadProgress, type DownloadProgress } from '../src/stores/online-music';

describe('download progress', () => {
  const p = (over: Partial<DownloadProgress> = {}): DownloadProgress => ({ received: 0, total: 0, retryIn: 0, ...over });
  it('formats progress, unknown totals and retries', () => {
    expect(formatDownloadProgress(p())).toBe('Starting download…');
    expect(formatDownloadProgress(p({ received: 1.2 * 1024 * 1024, total: 4.8 * 1024 * 1024 }))).toBe('Downloading 1.2 / 4.8 MB');
    expect(formatDownloadProgress(p({ received: 12 * 1024 * 1024, total: 30 * 1024 * 1024 }))).toBe('Downloading 12 / 30 MB');
    expect(formatDownloadProgress(p({ received: 2 * 1024 * 1024 }))).toBe('Downloading 2.0 MB');
    expect(formatDownloadProgress(p({ retryIn: 2 }))).toBe('Busy host, retrying in 2 s…');
    expect(formatDownloadProgress(p({ received: 6 * 1024 * 1024, total: 5 * 1024 * 1024 }))).toBe('Downloading 6.0 / 6.0 MB');
  });
  it('computes a percentage only when the size is known', () => {
    expect(downloadPercent(p({ received: 50, total: 200 }))).toBe(25);
    expect(downloadPercent(p({ received: 500, total: 200 }))).toBe(100);
    expect(downloadPercent(p({ received: 50 }))).toBeNull();
    expect(downloadPercent(p({ received: 50, total: 200, retryIn: 2 }))).toBeNull();
  });

  afterEach(() => vi.unstubAllGlobals());
  const track = { id: 'p', title: 'Clap', artist: 'A', url: 'https://cdn.test/a.mp3', landingUrl: 'https://x.test', license: 'cc0', licenseVersion: '1.0', licenseUrl: '', seconds: 3, genres: [], source: 'x', credit: 'c', fallbackUrl: 'https://cdn.test/a.oga' } as OnlineTrack;
  const stubReader = () => vi.stubGlobal('FileReader', class { result = ''; onload: (() => void) | null = null; onerror: (() => void) | null = null; readAsDataURL(blob: Blob) { void blob.arrayBuffer().then(buffer => { this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`; this.onload?.(); }); } });

  it('reports received bytes against Content-Length while streaming', async () => {
    stubReader();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(40)); controller.enqueue(new Uint8Array(60)); controller.close(); } });
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(body, { headers: { 'content-length': '100', 'content-type': 'audio/mpeg' } })));
    const seen: DownloadProgress[] = [];
    const stop = subscribeDownloadProgress([track.url], progress => seen.push(progress));
    const result = await downloadOnlineTrack(track);
    stop();
    expect(seen.map(item => item.received)).toEqual([40, 100]);
    expect(seen.every(item => item.total === 100)).toBe(true);
    expect(result.bytes).toBe(100);
  });

  it('ignores progress for other URLs and stops after unsubscribing', async () => {
    stubReader();
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(new Uint8Array(10), { headers: { 'content-type': 'audio/mpeg' } })));
    const seen: DownloadProgress[] = [];
    subscribeDownloadProgress(['https://other.test/x.mp3'], progress => seen.push(progress));
    const stop = subscribeDownloadProgress([track.url], progress => seen.push(progress));
    stop();
    await downloadOnlineTrack({ ...track, fallbackUrl: undefined });
    expect(seen).toEqual([]);
  });

  it('cancels at once without trying the fallback file or adding a hint', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', () => {
      calls++;
      const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(10)); } });
      return Promise.resolve(new Response(body, { headers: { 'content-length': '1000' } }));
    });
    const stop = subscribeDownloadProgress([track.url], () => { void cancelOnlineDownload(); });
    const error = await downloadOnlineTrack(track).then(() => new Error('unexpected success'), (caught: Error) => caught);
    stop();
    expect(error.message).toBe(DOWNLOAD_CANCELLED);
    expect(calls).toBe(1);
  });
});

import { importableUrl } from '../src/stores/online-music';
describe('unsupported audio formats are not listed', () => {
  it('judges a URL by its file extension', () => {
    for (const ok of ['https://x.test/a.mp3', 'https://x.test/a.OGA?x=1', 'https://x.test/a.wav', 'https://x.test/stream', 'https://x.test/get/12345', 'https://x.test/a.webm']) expect(importableUrl(ok), ok).toBe(true);
    for (const bad of ['https://x.test/a.flac', 'https://x.test/a.opus', 'https://x.test/a.mid', 'https://x.test/a.wma', 'https://x.test/a.aiff']) expect(importableUrl(bad), bad).toBe(false);
  });
  it('drops FLAC and Opus results from Commons and Openverse', () => {
    const flac = commonsPage({ pageid: 21 }); flac.imageinfo[0].url = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Ring.flac';
    const midi = commonsPage({ pageid: 22 }); midi.imageinfo[0].url = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Ring.mid';
    expect(parseCommonsSearch({ query: { pages: [flac, midi, commonsPage({ pageid: 23 })] } }, 1, 'sound_effect').tracks.map(t => t.id)).toEqual(['commons-23']);
    expect(parseOnlineSearch({ results: [result({ id: 'f', url: 'https://cdn.test/a.flac' }), result({ id: 'o', url: 'https://cdn.test/a.ogg' })] }, 1).tracks.map(t => t.id)).toEqual(['o']);
  });
});

import { setConverterAvailable } from '../src/stores/online-music';
describe('FLAC and Opus when FFmpeg can convert them', () => {
  afterEach(() => setConverterAvailable(false));
  it('lists them, with the MP3 transcode for preview and the original to convert', () => {
    const flac = commonsPage({ pageid: 31 }); flac.imageinfo[0].url = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Ring.flac';
    const midi = commonsPage({ pageid: 32 }); midi.imageinfo[0].url = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Ring.mid';
    expect(parseCommonsSearch({ query: { pages: [flac] } }, 1, 'sound_effect').tracks).toEqual([]);
    setConverterAvailable(true);
    const [track] = parseCommonsSearch({ query: { pages: [flac, midi] } }, 1, 'sound_effect').tracks;
    expect(track.id).toBe('commons-31');
    expect(track.url).toBe('https://upload.wikimedia.org/wikipedia/commons/transcoded/a/ab/Ring.flac/Ring.flac.mp3');
    expect(track.fallbackUrl).toBe('https://upload.wikimedia.org/wikipedia/commons/a/ab/Ring.flac');
    expect(parseCommonsSearch({ query: { pages: [midi] } }, 1, 'sound_effect').tracks).toEqual([]);
    expect(importableUrl('https://x.test/a.opus')).toBe(true);
    expect(importableUrl('https://x.test/a.mid')).toBe(false);
  });
});
