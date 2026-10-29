import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Pause, Play, Plus, Trash2, WifiOff } from 'lucide-react';
import { resolveAssetUrl } from '../preview/media-url';
import { messageFor } from '../../app/errors';
import type { SavedTrack } from '../../stores/online-downloads';

/**
 * Tracks downloaded from the Online tab. They sit in the local asset store, so
 * they play and can be added to a project with no internet connection.
 */
export function DownloadedMusic({ tracks, canEdit, onAdd, onRemove, onStopOther, kind = 'music' }: {
  kind?: SavedTrack['kind'];
  tracks: SavedTrack[];
  canEdit: boolean;
  onAdd: (track: SavedTrack) => Promise<void>;
  onRemove: (key: string) => void;
  onStopOther: () => void;
}) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState('');
  const player = useRef<HTMLAudioElement | null>(null);

  function stop() { player.current?.pause(); player.current = null; setPlaying(null); }
  useEffect(() => () => { player.current?.pause(); }, []);

  async function listen(track: SavedTrack) {
    if (playing === track.key) { stop(); return; }
    stop(); onStopOther(); setError('');
    try {
      const audio = new Audio(await resolveAssetUrl(track.reference));
      audio.volume = .6;
      player.current = audio;
      audio.onended = () => { if (player.current === audio) stop(); };
      audio.onerror = () => { if (player.current === audio) { stop(); setError('This file is no longer in PixCut storage. Remove it and download it again.'); } };
      setPlaying(track.key);
      await audio.play();
    } catch (e) { stop(); setError(messageFor(e)); }
  }

  async function add(track: SavedTrack) {
    stop(); setAdding(track.key);
    try { await onAdd(track); } finally { setAdding(null); }
  }

  if (!tracks.length) return <div className="library-empty music-empty">
    <WifiOff size={30} />
    <strong>{kind === 'sound_effect' ? 'No downloaded sounds yet.' : 'No downloaded tracks yet.'}</strong>
    <p>{kind === 'sound_effect' ? 'Sounds' : 'Tracks'} you add from the Online tab are kept on this device. They show up here and work without internet.</p>
  </div>;

  return <div className="downloaded-music">
    <p className="downloaded-note"><WifiOff size={13} /> Saved on this device · works offline</p>
    {error && <p className="online-music-error" role="alert">{error}</p>}
    <div className="free-music-list online-music-list">
      {tracks.map(track => <div key={track.key} className={`free-music-track ${playing === track.key ? 'previewing' : ''}`}>
        <button className="music-listen" aria-label={`${playing === track.key ? 'Pause' : 'Play'} ${track.title}`} aria-pressed={playing === track.key} onClick={() => void listen(track)}>{playing === track.key ? <Pause size={13} /> : <Play size={13} />}</button>
        <span><strong>{track.title}</strong><small>{[track.artist, track.license, (kind === 'sound_effect' ? `${track.seconds.toFixed(track.seconds < 10 ? 1 : 0)}s` : `${Math.floor(track.seconds / 60)}:${String(Math.round(track.seconds % 60)).padStart(2, '0')}`)].filter(Boolean).join(' · ')}</small></span>
        {track.landingUrl && <a className="icon-button" href={track.landingUrl} target="_blank" rel="noreferrer noopener" aria-label={`Open ${track.title} on its source page`} title="Open the source page"><ExternalLink size={14} /></a>}
        <button className="icon-button" aria-label={`Remove ${track.title} from downloads`} title="Remove from this list. Run Clean storage in Settings to free the space." onClick={() => { if (playing === track.key) stop(); onRemove(track.key); }}><Trash2 size={14} /></button>
        <button className="icon-button" aria-label={`Add ${track.title} to the project`} disabled={!canEdit || adding !== null} onClick={() => void add(track)}><Plus size={16} /></button>
      </div>)}
    </div>
  </div>;
}
