import { Plus, Trash2 } from 'lucide-react';
import { MAX_KEYFRAMES, type FramingKeyframe, type Scene } from '../../stores/model';
import { framingKeyframeAt, removeFramingKeyframe, upsertFramingKeyframe } from './keyframes';
import { t } from '../../i18n';

function describe(frame: FramingKeyframe): string {
  const parts = [`${Math.round((frame.x ?? 0) * 100)}% · ${Math.round((frame.y ?? 0) * 100)}%`];
  if (frame.zoom !== undefined && Math.abs(frame.zoom - 1) > .001) parts.push(`${Math.round(frame.zoom * 100)}% zoom`);
  return parts.join(' · ');
}

/**
 * Pan/zoom keyframes for a photo. The playhead drives the capture, so the flow
 * is: reposition or zoom the photo, add a key, move the playhead, adjust again.
 */
export function FramingKeyframeControls({
  scene, playheadSeconds, durationSeconds, onChange, disabled,
}: {
  scene: Scene;
  playheadSeconds: number;
  durationSeconds: number;
  onChange: (keyframes: FramingKeyframe[] | undefined) => void;
  disabled?: boolean;
}) {
  const keys = scene.framingKeyframes ?? [];
  const atCap = keys.length >= MAX_KEYFRAMES;
  const add = () => {
    const { at, ...values } = framingKeyframeAt(scene, playheadSeconds, durationSeconds);
    onChange(upsertFramingKeyframe(keys, at, values));
  };
  return <details className="advanced-disclosure keyframe-controls">
    <summary>{t('Framing keyframes')}{keys.length ? ` · ${keys.length}` : ''}</summary>
    <p className="inspector-inline-status">Pan or zoom the photo, then add a key at the playhead. PixCut interpolates between keys and bakes them into preview, stills and export.</p>
    <button type="button" className="button" disabled={disabled || atCap} onClick={add}><Plus size={13} /> Add keyframe at {Math.max(0, Math.min(playheadSeconds, durationSeconds)).toFixed(2)} s</button>
    {atCap && <p className="inspector-inline-status">{MAX_KEYFRAMES} keyframes is the limit for one photo.</p>}
    {keys.length > 0 && <>
      <div className="keyframe-list">{keys.map(key => <div className="keyframe-row" key={key.at}>
        <span className="keyframe-time">{key.at.toFixed(2)} s</span>
        <span className="keyframe-values">{describe(key)}</span>
        <button type="button" className="icon-button" aria-label={t('Remove framing keyframe at {seconds} seconds', { seconds: key.at.toFixed(2) })} disabled={disabled} onClick={() => onChange(removeFramingKeyframe(keys, key.at))}><Trash2 size={13} /></button>
      </div>)}</div>
      <button type="button" className="text-button" disabled={disabled} onClick={() => onChange(undefined)}>{t('Clear framing keyframes')}</button>
    </>}
  </details>;
}
