import { AssetImage } from '../../components/preview/AssetImage';
import { ChevronLeft, ChevronRight, ImagePlus, Layers, Pause, Play, Plus, Volume2, VolumeX } from 'lucide-react';
import { type Scene } from '../../stores/model';
import { messageFor } from '../errors';
import { hasMedia, previewClock } from '../helpers';
import type { Dispatch, SetStateAction, RefObject } from 'react';

export function SourceModal({ sourcePreview, previewVideo, sourcePreviewUrl, previewMuted, setPreviewVideoDuration, setPreviewVideoTime, setPreviewVideoPlaying, previewList, switchPreview, previewIndex, previewVideoPlaying, togglePreviewPlayback, previewVideoTime, previewVideoDuration, seekPreview, togglePreviewMute, previewVolume, changePreviewVolume, appendMedia, selectedScene, addMediaPip, setError }: {
  sourcePreview: Scene;
  previewVideo: RefObject<HTMLVideoElement | null>;
  sourcePreviewUrl: string | undefined;
  previewMuted: boolean;
  setPreviewVideoDuration: Dispatch<SetStateAction<number>>;
  setPreviewVideoTime: Dispatch<SetStateAction<number>>;
  setPreviewVideoPlaying: Dispatch<SetStateAction<boolean>>;
  previewList: Scene[];
  switchPreview: (delta: number) => void;
  previewIndex: number;
  previewVideoPlaying: boolean;
  togglePreviewPlayback: () => void;
  previewVideoTime: number;
  previewVideoDuration: number;
  seekPreview: (seconds: number) => void;
  togglePreviewMute: () => void;
  previewVolume: number;
  changePreviewVolume: (value: number) => void;
  appendMedia: (scene: Scene) => Promise<void>;
  selectedScene: Scene | undefined;
  addMediaPip: (source: Scene) => Promise<void>;
  setError: Dispatch<SetStateAction<string>>;
}) {
  return (
    <>
      <h2 id="modal-title">{sourcePreview.name}</h2>
      <div className="source-preview">
        {sourcePreview.mediaKind === 'video' ? <video
          key={sourcePreview.id}
          ref={previewVideo}
          src={sourcePreviewUrl}
          controls={false}
          playsInline
          autoPlay
          muted={previewMuted}
          onLoadedMetadata={event => setPreviewVideoDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
          onTimeUpdate={event => setPreviewVideoTime(event.currentTarget.currentTime)}
          onPlay={() => setPreviewVideoPlaying(true)}
          onPause={() => setPreviewVideoPlaying(false)}
          onEnded={() => setPreviewVideoPlaying(false)}
        /> : <AssetImage source={sourcePreview.image} alt={sourcePreview.name} fallback={<div className="source-missing"><ImagePlus size={28} /><strong>This file is missing.</strong><span>Relink the project’s media before adding it again.</span></div>} />}
        {previewList.length > 1 && <>
          <button className="source-nav previous" aria-label="Previous media" title="Previous media (←)" onClick={() => switchPreview(-1)}><ChevronLeft size={22} /></button>
          <button className="source-nav next" aria-label="Next media" title="Next media (→)" onClick={() => switchPreview(1)}><ChevronRight size={22} /></button>
          <span className="source-counter" aria-live="polite">{Math.max(0, previewIndex) + 1} / {previewList.length}</span>
        </>}
      </div>
      {sourcePreview.mediaKind === 'video' && hasMedia(sourcePreview.image) && <div className="source-controls">
        <button className="source-play-button" aria-label={previewVideoPlaying ? 'Pause preview' : 'Play preview'} onClick={togglePreviewPlayback}>{previewVideoPlaying ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}</button>
        <span className="source-time">{previewClock(previewVideoTime)} / {previewClock(previewVideoDuration || sourcePreview.sourceDurationSeconds || 0)}</span>
        <input className="source-seek" aria-label="Preview position" type="range" min="0" max={Math.max(.01, previewVideoDuration || sourcePreview.sourceDurationSeconds || 0)} step=".01" value={Math.min(previewVideoTime, previewVideoDuration || sourcePreview.sourceDurationSeconds || 0)} onChange={event => seekPreview(Number(event.target.value))} />
        <button className="source-mute" aria-label={previewMuted ? 'Unmute preview' : 'Mute preview'} onClick={togglePreviewMute}>{previewMuted || previewVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
        <input className="source-volume" aria-label="Preview volume" type="range" min="0" max="1" step=".01" value={previewVolume} onChange={event => changePreviewVolume(Number(event.target.value))} />
        <span className="source-volume-label">{Math.round(previewVolume * 100)}%</span>
      </div>}
      <div className="source-preview-actions"><button className="button primary" disabled={!hasMedia(sourcePreview.image)} onClick={() => void appendMedia(sourcePreview)}><Plus size={15} /> Append to timeline</button><button className="button" disabled={!selectedScene || !hasMedia(sourcePreview.image)} onClick={() => void addMediaPip(sourcePreview).catch(error => setError(messageFor(error)))}><Layers size={15} /> Picture in picture</button><span className="source-keyboard-hint">{sourcePreview.mediaKind === 'video' ? '← → switch · Space play · ↑ ↓ volume' : '← → switch media'}</span></div>
    </>
  );
}
