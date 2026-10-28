import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, Pause, Play, Plus, Search } from 'lucide-react';
import { ONLINE_GENRES, ONLINE_SOUND_TOPICS, buildOnlineQuery, onlineLicenseLabel, searchOnlineMusic, type OnlineKind, type OnlineSearchPage, type OnlineTrack } from '../../stores/online-music';
import { messageFor } from '../../app/errors';

/**
 * Search openly licensed music (CC0 / CC BY) and add a track to the project.
 * Requests happen only when the user searches, listens or adds; the credit line
 * for CC BY tracks is saved with the clip.
 */
export function OnlineMusic({ canEdit, onAdd, onStopOther, kind = 'music' }: {
  kind?: OnlineKind;
  canEdit: boolean;
  onAdd: (track: OnlineTrack) => Promise<void>;
  onStopOther: () => void;
}) {
  const [query, setQuery] = useState('');
  const sounds = kind === 'sound_effect', topics = sounds ? ONLINE_SOUND_TOPICS : ONLINE_GENRES, noun = sounds ? 'sound' : 'track';
  const [genre, setGenre] = useState<string>('All');
  const [result, setResult] = useState<OnlineSearchPage | null>(null);
  const [tracks, setTracks] = useState<OnlineTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const searchToken = useRef(0);

  function stop() {
    player.current?.pause();
    player.current = null;
    setPlaying(null);
  }
  useEffect(() => () => { searchToken.current++; player.current?.pause(); }, []);

  async function search(nextGenre: string, page = 1, append = false) {
    const words = buildOnlineQuery(query, nextGenre);
    if (!words) { setError(sounds ? 'Type a word or pick a topic to search.' : 'Type a word or pick a genre to search.'); return; }
    const token = ++searchToken.current;
    stop(); setLoading(true); setError('');
    try {
      const found = await searchOnlineMusic(words, page, kind);
      if (token !== searchToken.current) return;
      setResult(found);
      setTracks(current => append ? [...current, ...found.tracks.filter(t => !current.some(c => c.id === t.id))] : found.tracks);
    } catch (e) {
      if (token === searchToken.current) setError(messageFor(e));
    } finally {
      if (token === searchToken.current) setLoading(false);
    }
  }

  function listen(track: OnlineTrack) {
    if (playing === track.id) { stop(); return; }
    stop(); onStopOther();
    const audio = new Audio(track.url);
    audio.volume = .6;
    player.current = audio;
    audio.onended = () => { if (player.current === audio) stop(); };
    audio.onerror = () => { if (player.current === audio) { stop(); setError(`This ${noun} could not be played from its host. Try another one.`); } };
    setPlaying(track.id);
    void audio.play().catch(() => { if (player.current === audio) { stop(); setError(`This ${noun} could not be played from its host. Try another one.`); } });
  }

  async function add(track: OnlineTrack) {
    stop(); setAdding(track.id);
    try { await onAdd(track); } finally { setAdding(null); }
  }

  const searched = result !== null;
  return <div className="online-music">
    <form className="online-music-search" role="search" onSubmit={event => { event.preventDefault(); void search(genre); }}>
      <label className="search-field"><Search size={14} /><input aria-label={sounds ? 'Search online sound effects' : 'Search online music'} placeholder={sounds ? 'Search applause, laughter, whoosh…' : 'Search songs, moods, artists…'} value={query} onChange={event => setQuery(event.target.value)} /></label>
      <button className="button primary" type="submit" disabled={loading}>{loading ? <Loader2 size={14} className="spin" /> : 'Search'}</button>
    </form>
    <div className="online-genres" role="group" aria-label={sounds ? 'Topic' : 'Genre'}>
      {['All', ...topics].map(item => <button key={item} type="button" className={genre === item ? 'active' : ''} aria-pressed={genre === item} onClick={() => { setGenre(item); if (query.trim() || item !== 'All') void search(item); }}>{item}</button>)}
    </div>
    {error && <p className="online-music-error" role="alert">{error}</p>}
    {!searched && !loading && !error && <div className="library-empty music-empty">
      <strong>{sounds ? 'Find free sound effects for your video.' : 'Find free music for your video.'}</strong>
      <p>{sounds ? 'Search by word or pick a topic. Results are CC0 or CC BY sounds that are free to use commercially.' : 'Search by word or pick a genre. Results are CC0 or CC BY tracks that are free to use commercially.'}</p>
    </div>}
    {searched && !tracks.length && !loading && !error && <div className="library-empty music-empty"><strong>{sounds ? 'No sounds found.' : 'No tracks found.'}</strong><p>Try another word{sounds ? '' : ' or genre'}.</p></div>}
    <div className="free-music-list online-music-list">
      {tracks.map(track => <div key={track.id} className={`free-music-track ${playing === track.id ? 'previewing' : ''}`}>
        <button className="music-listen" aria-label={`${playing === track.id ? 'Stop' : 'Listen to'} ${track.title}`} onClick={() => listen(track)}>{playing === track.id ? <Pause size={13} /> : <Play size={13} />}</button>
        <span><strong>{track.title}</strong><small>{track.artist} · {onlineLicenseLabel(track)} · {sounds ? `${track.seconds.toFixed(track.seconds < 10 ? 1 : 0)}s` : `${Math.floor(track.seconds / 60)}:${String(Math.round(track.seconds) % 60).padStart(2, '0')}`}</small></span>
        <a className="icon-button" href={track.landingUrl} target="_blank" rel="noreferrer noopener" aria-label={`Open ${track.title} on its source page`} title="Open the source page"><ExternalLink size={14} /></a>
        <button className="icon-button" aria-label={`Add ${track.title} to the project`} disabled={!canEdit || adding !== null} onClick={() => void add(track)}>{adding === track.id ? <Loader2 size={14} className="spin" /> : <Plus size={16} />}</button>
      </div>)}
    </div>
    {result && result.page < result.pages && tracks.length > 0 && <button className="button subtle online-more" disabled={loading} onClick={() => void search(genre, result.page + 1, true)}>{loading ? 'Loading…' : 'Load more'}</button>}
    <details className="library-disclosure music-license"><summary>Licenses · credit saved with the clip</summary>
      <p>Only CC0, CC BY and public-domain {noun}s are shown, so they are free for commercial videos. CC BY {noun}s need the artist credited where you publish; PixCut saves the credit line with the clip and adds it to the Audio panel and the export credits.</p>
      <p>{sounds ? 'Sounds' : 'Tracks'} play and download straight from their host when you press Listen or Add. Nothing is requested while you edit or export. Licenses come from the catalogue and are not verified by PixCut, so check the source page for anything important.</p>
    </details>
  </div>;
}
