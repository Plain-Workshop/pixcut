import { Plus, Trash2 } from 'lucide-react';
import { MAX_KEYFRAMES, type Keyframe } from '../../stores/model';
import { keyframeAtPlayhead, removeKeyframe, upsertKeyframe } from './keyframes';

type Animatable = { x: number; y: number; rotation: number; opacity: number; keyframes?: Keyframe[] };

function describe(frame: Keyframe): string {
  const parts: string[] = [];
  if (frame.x !== undefined || frame.y !== undefined) parts.push(`${Math.round((frame.x ?? 0) * 100)}% · ${Math.round((frame.y ?? 0) * 100)}%`);
  if (frame.scale !== undefined && Math.abs(frame.scale - 1) > .001) parts.push(`×${frame.scale.toFixed(2)}`);
  if (frame.rotation !== undefined && Math.abs(frame.rotation) > .001) parts.push(`${Math.round(frame.rotation)}°`);
  if (frame.opacity !== undefined && frame.opacity < 99.999) parts.push(`${Math.round(frame.opacity)}% opacity`);
  return parts.join(' · ') || 'position';
}

/**
 * Keyframe editor shared by text layers and elements. Values are captured at the
 * playhead, so the workflow is: move/scale/rotate/fade the layer, add a key, move
 * the playhead, change it again.
 */
export function KeyframeControls({
  layer, playheadSeconds, durationSeconds, onChange, disabled,
}: {
  layer: Animatable;
  /** Seconds since this layer became visible. */
  playheadSeconds: number;
  durationSeconds: number;
  onChange: (keyframes: Keyframe[] | undefined) => void;
  disabled?: boolean;
}) {
  const keys = layer.keyframes ?? [];
  const atCap = keys.length >= MAX_KEYFRAMES;
  const add = () => {
    const { at, frame } = keyframeAtPlayhead(layer, playheadSeconds, durationSeconds);
    onChange(upsertKeyframe(keys, at, frame));
  };
  return <details className="advanced-disclosure keyframe-controls">
    <summary>Motion keyframes{keys.length ? ` · ${keys.length}` : ''}</summary>
    <p className="inspector-inline-status">Place the playhead, move, scale, rotate or fade the layer, then add a key. Values interpolate between keys.</p>
    <button type="button" className="button" disabled={disabled || atCap} onClick={add}><Plus size={13} /> Add keyframe at {Math.max(0, Math.min(playheadSeconds, durationSeconds)).toFixed(2)} s</button>
    {atCap && <p className="inspector-inline-status">{MAX_KEYFRAMES} keyframes is the limit for one layer.</p>}
    {keys.length > 0 && <>
      <div className="keyframe-list">{keys.map(key => <div className="keyframe-row" key={key.at}>
        <span className="keyframe-time">{key.at.toFixed(2)} s</span>
        <span className="keyframe-values">{describe(key)}</span>
        <button type="button" className="icon-button" aria-label={`Remove keyframe at ${key.at.toFixed(2)} seconds`} disabled={disabled} onClick={() => onChange(removeKeyframe(keys, key.at))}><Trash2 size={13} /></button>
      </div>)}</div>
      <button type="button" className="text-button" disabled={disabled} onClick={() => onChange(undefined)}>Clear keyframes</button>
    </>}
  </details>;
}
