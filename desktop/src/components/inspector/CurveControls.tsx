import { t } from '../../i18n';
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { CURVE_CHANNELS, neutralCurve, type CurveChannel, type CurvePoint, type ToneCurves } from '../../stores/model';
import { evaluateCurve, hasToneCurves } from '../preview/curves';

const CHANNEL_LABEL: Record<CurveChannel, string> = { master: 'Master', red: 'Red', green: 'Green', blue: 'Blue' };
const CHANNEL_COLOR: Record<CurveChannel, string> = { master: '#EDEDF7', red: '#FF6B6B', green: '#4ADE80', blue: '#60A5FA' };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Draggable RGB tone curves; master runs before the per-channel curve. */
export function CurveControls({ curves, disabled, onStage, onCommit, onApply }: {
  curves?: ToneCurves;
  disabled?: boolean;
  onStage: (curves: ToneCurves) => void;
  onCommit: () => void;
  onApply: (curves: ToneCurves | undefined) => void;
}) {
  const [channel, setChannel] = useState<CurveChannel>('master');
  const surface = useRef<SVGSVGElement>(null);
  const drag = useRef<{ points: CurvePoint[]; index: number } | null>(null);
  const cleanup = useRef<() => void>(() => {});
  useEffect(() => () => cleanup.current(), []);

  const points = curves?.[channel] ?? neutralCurve();
  const active = hasToneCurves(curves);
  const colour = CHANNEL_COLOR[channel];

  function withChannel(next: ToneCurves | undefined, points: CurvePoint[] | undefined): ToneCurves {
    const copy = { ...next };
    if (points && points.length >= 2) copy[channel] = points;
    else delete copy[channel];
    return copy;
  }

  function position(event: PointerEvent | ReactPointerEvent) {
    const box = surface.current?.getBoundingClientRect();
    if (!box?.width || !box.height) return { x: 0, y: 0 };
    return {
      x: clamp((event.clientX - box.left) / box.width, 0, 1),
      y: clamp(1 - (event.clientY - box.top) / box.height, 0, 1),
    };
  }

  function startDrag(event: ReactPointerEvent, index: number, source?: CurvePoint[]) {
    if (disabled) return;
    event.preventDefault(); event.stopPropagation();
    const working = (source ?? points).map(point => [...point] as CurvePoint);
    drag.current = { points: working, index };
    const move = (moveEvent: PointerEvent) => {
      const current = drag.current;
      if (!current) return;
      const at = position(moveEvent);
      const list = current.points;
      const before = list[current.index - 1]?.[0] ?? -1;
      const after = list[current.index + 1]?.[0] ?? 2;
      const minX = Math.min(1, Math.max(0, before + .01));
      const maxX = Math.min(1, Math.max(0, after - .01));
      list[current.index] = [clamp(at.x, minX, Math.max(minX, maxX)), at.y];
      onStage(withChannel(curves, list));
    };
    const up = () => finish(true);
    cleanup.current = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); drag.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }

  function finish(commit: boolean) {
    cleanup.current();
    if (commit) onCommit();
  }

  function addPoint(event: ReactPointerEvent) {
    if (disabled || points.length >= 12) return;
    event.preventDefault();
    const at = position(event);
    if (points.some(([x]) => Math.abs(x - at.x) < .015)) return;
    const next: CurvePoint[] = [...points.map(point => [...point] as CurvePoint), [at.x, at.y]];
    next.sort((a, b) => a[0] - b[0]);
    const index = next.findIndex(point => point[0] === at.x && point[1] === at.y);
    onStage(withChannel(curves, next));
    startDrag(event, index, next);
  }

  function removePoint(event: ReactMouseEvent, index: number) {
    event.preventDefault(); event.stopPropagation();
    if (disabled || points.length <= 2) return;
    onApply(withChannel(curves, points.filter((_, at) => at !== index)));
  }

  function resetChannel() {
    if (disabled) return;
    onApply(withChannel(curves, undefined));
  }

  const path = Array.from({ length: 65 }, (_, index) => {
    const x = index / 64;
    const y = evaluateCurve(points, x);
    return `${index ? 'L' : 'M'}${(x * 100).toFixed(2)} ${((1 - y) * 100).toFixed(2)}`;
  }).join(' ');

  return <details className="advanced-disclosure curve-controls">
    <summary>Tone curves{active ? ' · custom' : ''}</summary>
    <p className="inspector-inline-status">Master shapes every channel first; Red, Green and Blue then adjust one channel each. Click the graph to add a point, drag to shape it, and double-click a point to remove it.</p>
    <div className="curve-tabs" role="group" aria-label={t('Curve channel')}>
      {CURVE_CHANNELS.map(name => <button key={name} type="button" className={`curve-tab ${channel === name ? 'active' : ''}`} aria-pressed={channel === name} disabled={disabled} onClick={() => setChannel(name)}><span style={{ background: CHANNEL_COLOR[name] }} />{CHANNEL_LABEL[name]}</button>)}
    </div>
    <svg ref={surface} className="curve-graph" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={t('{channel} tone curve', { channel: CHANNEL_LABEL[channel] })} onPointerDown={addPoint}>
      <rect x="0" y="0" width="100" height="100" className="curve-background" pointerEvents="none" />
      {[25, 50, 75].map(value => <g key={value} pointerEvents="none"><line x1={value} y1="0" x2={value} y2="100" className="curve-grid" /><line x1="0" y1={value} x2="100" y2={value} className="curve-grid" /></g>)}
      <line x1="0" y1="100" x2="100" y2="0" className="curve-identity" pointerEvents="none" />
      <path d={path} className="curve-line" style={{ stroke: colour }} pointerEvents="none" />
      {points.map(([x, y], index) => <circle key={index} className="curve-point" cx={x * 100} cy={(1 - y) * 100} r="2.6" style={{ stroke: colour }} onPointerDown={event => startDrag(event, index)} onDoubleClick={event => removePoint(event, index)} />)}
    </svg>
    <div className="curve-footer">
      <span>{CHANNEL_LABEL[channel]} · {points.length} points</span>
      <div>
        <button type="button" className="text-button" disabled={disabled || !curves?.[channel]} onClick={resetChannel}>Reset {CHANNEL_LABEL[channel].toLowerCase()}</button>
        {active && <button type="button" className="text-button danger" disabled={disabled} onClick={() => onApply(undefined)}>{t('Reset all')}</button>}
      </div>
    </div>
  </details>;
}
