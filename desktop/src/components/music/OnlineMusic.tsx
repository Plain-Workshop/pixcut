import { t } from '../../i18n';
import { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Loader2, Pause, Play, Plus, Search, Star, X } from 'lucide-react';
import { FALLBACK_AFTER_MS, catalogueLabel, cancelOnlineDownload, catalogueDown, fallbackOrder, downloadPercent, formatDownloadProgress, subscribeDownloadProgress, type DownloadProgress, ONLINE_GENRES, ONLINE_SOUND_TOPICS, ONLINE_PROVIDERS, buildOnlineQuery, onlineHasMore, onlineLicenseLabel, searchOnlineFill, type OnlineKind, type OnlineSearchPage, type OnlineSource, type OnlineTrack } from '../../stores/online-music';
import { messageFor } from '../../app/errors';
import { searchOnlineCached } from '../../stores/online-cache';
import { loadFavorites, saveFavorites, toggleFavorite, type OnlineFavorite } from '../../stores/online-favorites';

/**
 * Search openly licensed music (CC0 / CC BY) and add a track to the project.
 * Requests happen only when the user searches, listens or adds; the credit line
 * for CC BY tracks is saved with the clip.
 */
/** What opening the tab shows before the user types anything. Remembered per kind so switching tabs does not refetch. */
const STARTER: Record<OnlineKind, string> = { music: 'Lo-fi', sound_effect: 'Whoosh' };
const opened: Partial<Record<OnlineKind, { genre: string; result: OnlineSearchPage; tracks: OnlineTrack[] }>> = {};

export function OnlineMusic({ canEdit, onAdd, onStopOther, kind = 'music', isDownloaded }: {
  kind?: OnlineKind;
  /** True when the track's file is already stored on this device, so adding it needs no download. */
  isDownloaded?: (track: OnlineTrack) => boolean;
  canEdit: boolean;
  onAdd: (track: OnlineTrack) => Promise<void>;
  onStopOther: () => void;
}) {
  const [query, setQuery] = useState('');
  const sounds = kind === 'sound_effect', topics = sounds ? ONLINE_SOUND_TOPICS : ONLINE_GENRES, noun = sounds ? 'sound' : 'track';
  const [genre, setGenre] = useState<string>(opened[kind]?.genre ?? 'All');
  // The starter search picks a genre to show something on open; only a chip the user clicked narrows typed searches.
  const [genreChosen, setGenreChosen] = useState(false);
  const [source, setSource] = useState<OnlineSource>('auto');
  const [result, setResult] = useState<OnlineSearchPage | null>(opened[kind]?.result ?? null);
  const [tracks, setTracks] = useState<OnlineTrack[]>(opened[kind]?.tracks ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [noMore, setNoMore] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [favorites, setFavorites] = useState<OnlineFavorite[]>(() => loadFavorites());
  const [showSaved, setShowSaved] = useState(false);
  const saved = favorites.filter(item => item.kind === kind);
  function star(track: OnlineTrack) {
    setFavorites(current => { const next = toggleFavorite(current, track, kind); saveFavorites(next); return next; });
  }
  const [pending, setPending] = useState<{ source: OnlineSource; append: boolean } | null>(null);
  const [slow, setSlow] = useState(false);
  // Openverse can hang before Auto falls back, so say what is happening once it is taking a while.
  useEffect(() => {
    setSlow(false);
    if (!pending) return;
    const timer = setTimeout(() => setSlow(true), FALLBACK_AFTER_MS);
    return () => clearTimeout(timer);
  }, [pending]);
  const player = useRef<HTMLAudioElement | null>(null);
  const searchToken = useRef(0);

  function stop() {
    player.current?.pause();
    player.current = null;
    setPlaying(null);
  }
  useEffect(() => () => { searchToken.current++; player.current?.pause(); }, []);
  // Opening the tab is the user's request to browse: show a popular search right away.
  useEffect(() => {
    if (!opened[kind]) { setGenre(STARTER[kind]); void search(STARTER[kind]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (result && !query.trim()) opened[kind] = { genre, result, tracks }; }, [kind, genre, result, tracks, query]);

  async function search(nextGenre: string, append = false, nextSource: OnlineSource = source) {
    // "All" with nothing typed browses everything instead of asking for a word.
    const words = buildOnlineQuery(query, nextGenre) || (sounds ? 'sound' : 'music');
    const token = ++searchToken.current;
    // Paging must not interrupt a preview that is playing; a new search replaces the list, so it does.
    if (!append) stop();
    const searching: OnlineSource = (append ? result?.provider : undefined) ?? nextSource;
    setLoading(true); setError(t('')); setNoMore(false); setPending({ source: searching, append });
    try {
      const previous = append ? result : null;
      const seen = new Set(append ? tracks.map(track => track.id) : []);
      const found = await searchOnlineFill(words, kind, previous?.provider ?? nextSource, previous ? { page: previous.page + 1, cursor: previous.cursor } : { page: 1 }, seen, 10, 5, searchOnlineCached);
      if (token !== searchToken.current) return;
      setResult(found);
      setTracks(current => append ? [...current, ...found.tracks.filter(track => !current.some(item => item.id === track.id))] : found.tracks);
      setNoMore(append && !found.tracks.length && !onlineHasMore(found));
    } catch (e) {
      if (token === searchToken.current) setError(messageFor(e));
    } finally {
      if (token === searchToken.current) { setLoading(false); setPending(null); }
    }
  }

  function listen(track: OnlineTrack) {
    if (playing === track.id) { stop(); return; }
    stop(); onStopOther();
    let triedFallback = false;
    const audio = new Audio(track.url);
    audio.volume = .6;
    player.current = audio;
    audio.onended = () => { if (player.current === audio) stop(); };
    audio.onerror = () => {
      if (player.current !== audio) return;
      if (track.fallbackUrl && !triedFallback) { triedFallback = true; audio.src = track.fallbackUrl; void audio.play().catch(() => {}); return; }
      stop(); setError(sounds ? t('This sound could not be played from its host. Try another one.') : t('This track could not be played from its host. Try another one.'));
    };
    setPlaying(track.id);
    void audio.play().catch(() => { if (player.current === audio) { stop(); setError(sounds ? t('This sound could not be played from its host. Try another one.') : t('This track could not be played from its host. Try another one.')); } });
  }

  async function add(track: OnlineTrack) {
    stop(); setAdding(track.id); setProgress(null);
    const unsubscribe = subscribeDownloadProgress([track.url, ...(track.fallbackUrl ? [track.fallbackUrl] : [])], setProgress);
    try { await onAdd(track); } finally { unsubscribe(); setAdding(null); setProgress(null); }
  }

  const searched = result !== null;
  const nameOf = (id: OnlineSource) => id === 'auto' ? 'Openverse' : ONLINE_PROVIDERS.find(item => item.id === id)?.label ?? 'the catalogue';
  const backupName = nameOf(fallbackOrder(kind)[0]);
  const fresh = pending && !pending.append ? pending : null;
  const statusText = !fresh ? '' : fresh.source === 'auto'
    ? (catalogueDown('openverse') ? `Openverse is down. Searching ${backupName}…` : slow ? `Openverse is slow to answer. Using ${backupName}…` : `Searching ${nameOf('auto')}…`)
    : (slow ? `Still waiting for ${nameOf(fresh.source)}…` : `Searching ${nameOf(fresh.source)}…`);
  return <div className="online-music">
    <form className="online-music-search" role="search" onSubmit={event => { event.preventDefault(); const narrowed = genreChosen || !query.trim() ? genre : 'All'; if (narrowed !== genre) setGenre(narrowed); void search(narrowed); }}>
      <label className="search-field"><Search size={14} /><input aria-label={sounds ? 'Search online sound effects' : 'Search online music'} placeholder={sounds ? 'Search applause, laughter, whoosh…' : 'Search songs, moods, artists…'} value={query} onChange={event => setQuery(event.target.value)} /></label>
      <button className="button primary" type="submit" disabled={loading}>{loading ? <Loader2 size={14} className="spin" /> : 'Search'}</button>
    </form>
    <div className="online-genres online-views" role="group" aria-label={t('View')}>
      <button type="button" className={!showSaved ? 'active' : ''} aria-pressed={!showSaved} onClick={() => setShowSaved(false)}>{t('Search')}</button>
      <button type="button" className={showSaved ? 'active' : ''} aria-pressed={showSaved} onClick={() => { stop(); setShowSaved(true); }}><Star size={10} /> Saved ({saved.length})</button>
    </div>
    <div className="online-genres" role="group" aria-label={sounds ? 'Topic' : 'Genre'}>
      {['All', ...topics].map(item => <button key={item} type="button" className={genre === item ? 'active' : ''} aria-pressed={genre === item} onClick={() => { setGenre(item); setGenreChosen(item !== 'All'); void search(item); }}>{item}</button>)}
    </div>
    <div className="online-genres online-sources" role="group" aria-label={t('Catalogue')}>
      {([{ id: 'auto', label: 'Auto' }, ...ONLINE_PROVIDERS.filter(provider => provider.kinds.includes(kind))] as { id: OnlineSource; label: string }[]).map(item => <button key={item.id} type="button" className={source === item.id ? 'active' : ''} aria-pressed={source === item.id} title={item.id !== 'auto' && catalogueDown(item.id as never) ? `${item.label} did not answer recently` : undefined} onClick={() => { setSource(item.id); void search(genre, false, item.id); }}>{item.label}{item.id !== 'auto' && catalogueDown(item.id as never) && <span className="online-down" aria-label={t('not answering')}> ·&nbsp;down</span>}</button>)}
    </div>
    <p className={`online-status ${statusText ? 'busy' : ''}`} role="status" aria-live="polite">{statusText && <><Loader2 size={12} className="spin" /> {statusText}</>}</p>
    {error && <p className="online-music-error" role="alert">{error}</p>}
    {!showSaved && result?.cachedAt !== undefined && !error && <p className="note online-fallback" role="status">{t('The catalogues are not answering. Showing the results saved on {date}.', { date: new Date(result.cachedAt).toLocaleString() })}</p>}
    {!showSaved && result?.fellBack && result.cachedAt === undefined && !error && <p className="note online-fallback">Openverse is not answering, so these results come from {ONLINE_PROVIDERS.find(item => item.id === result.provider)?.label ?? 'another catalogue'}.</p>}
    {!showSaved && !searched && !loading && !error && <div className="library-empty music-empty">
      <strong>{sounds ? 'Find free sound effects for your video.' : 'Find free music for your video.'}</strong>
      <p>{sounds ? 'Search by word or pick a topic. Results are CC0 or CC BY sounds that are free to use commercially.' : 'Search by word or pick a genre. Results are CC0 or CC BY tracks that are free to use commercially.'}</p>
    </div>}
    {!showSaved && searched && !tracks.length && !loading && !error && <div className="library-empty music-empty"><strong>{sounds ? 'No sounds found.' : 'No tracks found.'}</strong><p>Try another word{sounds ? '' : ' or genre'}.</p></div>}
    {fresh && !showSaved && <div className="free-music-list online-music-list online-skeleton" aria-hidden="true">{[0, 1, 2, 3].map(row => <div key={row} className="free-music-track"><i className="skeleton-dot" /><span><i className="skeleton-line" style={{ width: `${70 - row * 8}%` }} /><i className="skeleton-line short" /></span></div>)}</div>}
    {showSaved && !saved.length && <div className="library-empty music-empty"><strong>{t('Nothing saved yet.')}</strong><p>Press the star on a {noun} to keep it here. Playing or adding it still contacts its host.</p></div>}
    {(showSaved || !fresh) && <div className="free-music-list online-music-list">
      {(showSaved ? saved : tracks).map(track => <div key={track.id} className={`free-music-track ${playing === track.id ? 'previewing' : ''}`}>
        <button className="music-listen" aria-label={playing === track.id ? t('Stop {name}', { name: track.title }) : t('Listen to {name}', { name: track.title })} onClick={() => listen(track)}>{playing === track.id ? <Pause size={13} /> : <Play size={13} />}</button>
        <span><strong>{track.title}</strong>{isDownloaded?.(track) && <em className="online-downloaded" title={t('Saved on this device, works offline')}><Check size={10} /> Downloaded</em>}<small>{track.artist} · {onlineLicenseLabel(track)}{source === 'auto' || showSaved ? ` · ${catalogueLabel(track)}` : ''} · {sounds ? `${track.seconds.toFixed(track.seconds < 10 ? 1 : 0)}s` : `${Math.floor(track.seconds / 60)}:${String(Math.round(track.seconds) % 60).padStart(2, '0')}`}</small>{adding === track.id && <span className="online-progress" role="status" aria-live="polite"><em>{progress ? formatDownloadProgress(progress) : 'Starting download…'}</em><progress max={100} value={progress ? downloadPercent(progress) ?? undefined : undefined} aria-label={t('Download progress for {title}', { title: track.title })} /></span>}</span>
        <button className={`icon-button star ${favorites.some(item => item.id === track.id) ? 'on' : ''}`} aria-pressed={favorites.some(item => item.id === track.id)} aria-label={favorites.some(item => item.id === track.id) ? t('Remove {name}', { name: track.title }) : t('Save {name}', { name: track.title })} title={t('Save to favorites')} onClick={() => star(track)}><Star size={14} fill={favorites.some(item => item.id === track.id) ? 'currentColor' : 'none'} /></button>
        <a className="icon-button" href={track.landingUrl} target="_blank" rel="noreferrer noopener" aria-label={t('Open {title} on its source page', { title: track.title })} title={t('Open the source page')}><ExternalLink size={14} /></a>
        {adding === track.id
          ? <button className="icon-button" aria-label={t('Cancel download of {title}', { title: track.title })} title={t('Cancel download')} onClick={() => void cancelOnlineDownload()}><X size={15} /></button>
          : <button className="icon-button" aria-label={t('Add {title} to the project', { title: track.title })} disabled={!canEdit || adding !== null} onClick={() => void add(track)}><Plus size={16} /></button>}
      </div>)}
    </div>}
    {!showSaved && result && onlineHasMore(result) && tracks.length > 0 && <button className="button subtle online-more" disabled={loading} onClick={() => void search(genre, true)}>{t('Load more')}</button>}
    <p className="online-status" role="status" aria-live="polite">{pending?.append && <><Loader2 size={12} className="spin" /> Loading more…</>}</p>
    {!showSaved && tracks.length > 0 && (noMore || (result && !onlineHasMore(result))) && !loading && <p className="note online-fallback">{t('No more results for this search.')}</p>}
    <details className="library-disclosure music-license"><summary>{t('Licenses · credit saved with the clip')}</summary>
      <p>Only CC0, CC BY and public-domain {noun}s are shown, so they are free for commercial videos. CC BY {noun}s need the artist credited where you publish; PixCut saves the credit line with the clip and adds it to the Audio panel and the export credits.</p>
      <p>{sounds ? 'Sounds' : 'Tracks'} play and download straight from their host when you press Listen or Add. Opening this tab loads a popular search; nothing is requested while you edit or export. Search covers Openverse and Wikimedia Commons, and falls back to Commons when Openverse is down. Licenses come from the catalogue and are not verified by PixCut, so check the source page for anything important.</p>
    </details>
  </div>;
}
