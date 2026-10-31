import { overlayScenes, projectScenes, totalTicks, type Project } from '../../stores/model';
import { timelineOverlays } from '../elements/overlays';

/** Track labels sit left of the clips; the add buttons sit right of them. */
export const TRACK_LABEL_PX = 148;
export const TRACK_TAIL_PX = 50;
export const TRACK_CHROME_PX = TRACK_LABEL_PX + TRACK_TAIL_PX;
export const MIN_TIMELINE_ZOOM = 0.5;
/** Deep zoom shows one frame across this many pixels. */
const FRAME_PIXELS = 16;
/** Browsers lay out elements up to ~33M px; stay far below that. */
const MAX_INNER_PX = 2_000_000;

const FRAME_STEPS = [1, 2, 5, 10, 15];
const SECOND_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];

export type RulerTick = { seconds: number; label: string };
export type Ruler = { step: number; major: RulerTick[]; minor: number[] };

/** `m:ss`, `h:mm:ss`, or with `:ff` frames when the ruler is finer than a second. */
export function formatRulerTime(seconds: number, fps: number, frames: boolean) {
  const rate = Math.max(1, Math.round(fps));
  const total = Math.max(0, Math.round(seconds * rate));
  const whole = Math.floor(total / rate);
  const h = Math.floor(whole / 3600), m = Math.floor(whole / 60) % 60, s = whole % 60;
  const clock = h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  return frames ? `${clock}:${String(total % rate).padStart(2, '0')}` : clock;
}

/**
 * Ruler ticks for the visible part of the timeline. Labels are at least
 * `minLabelPx` apart; finer steps switch to frame labels.
 */
export function rulerTicks(durationSeconds: number, contentPx: number, fps: number, view: { from: number; to: number }, minLabelPx = 76): Ruler {
  if (!(durationSeconds > 0) || !(contentPx > 0) || !(fps > 0)) return { step: 0, major: [], minor: [] };
  const pxPerSecond = contentPx / durationSeconds;
  const steps = [...FRAME_STEPS.map(frames => frames / fps).filter(step => step < 1), ...SECOND_STEPS];
  const step = steps.find(candidate => candidate * pxPerSecond >= minLabelPx) ?? steps[steps.length - 1];
  const frames = step < 1;
  const stepFrames = Math.round(step * fps);
  const division = [5, 4, 2].find(parts => step * pxPerSecond / parts >= 8 && (!frames || stepFrames % parts === 0)) ?? 1;
  const from = Math.max(0, view.from), to = Math.min(durationSeconds, view.to);
  const major: RulerTick[] = [], minor: number[] = [];
  const first = Math.max(0, Math.floor(from / step));
  for (let index = first; index * step <= to + 1e-9 && major.length < 400; index++) {
    const seconds = index * step;
    major.push({ seconds, label: formatRulerTime(seconds, fps, frames) });
    for (let part = 1; part < division; part++) {
      const tick = seconds + step * part / division;
      if (tick <= durationSeconds) minor.push(tick);
    }
  }
  return { step, major, minor };
}

/** Deepest zoom: one frame spans FRAME_PIXELS, never less than the classic 6×. */
export function timelineMaxZoom(durationSeconds: number, fps: number, viewportPx: number) {
  if (!(viewportPx > 0) || !(durationSeconds > 0)) return 6;
  const deep = (durationSeconds * fps * FRAME_PIXELS + TRACK_CHROME_PX) / viewportPx;
  return Math.max(6, Math.min(deep, MAX_INNER_PX / viewportPx));
}

export function clampZoom(value: number, max: number) {
  if (!Number.isFinite(value)) return 1;
  const clamped = Math.min(Math.max(MIN_TIMELINE_ZOOM, value), Math.max(MIN_TIMELINE_ZOOM, max));
  return Math.round(clamped * 1000) / 1000;
}

/** Keeps `anchorSeconds` under the same screen x after the inner width changes. */
export function anchoredScroll(anchorSeconds: number, anchorX: number, durationSeconds: number, innerPx: number) {
  if (!(durationSeconds > 0)) return 0;
  return Math.max(0, TRACK_LABEL_PX + (anchorSeconds / durationSeconds) * (innerPx - TRACK_CHROME_PX) - anchorX);
}

/** Seconds under an x inside the scrolled timeline. */
export function secondsAt(x: number, scrollLeft: number, durationSeconds: number, innerPx: number) {
  const content = innerPx - TRACK_CHROME_PX;
  if (content <= 0) return 0;
  return Math.min(durationSeconds, Math.max(0, (scrollLeft + x - TRACK_LABEL_PX) / content * durationSeconds));
}

/** Every clip boundary on every track, sorted, for jump-to-edit navigation. */
export function editPoints(project: Project): number[] {
  const points = new Set<number>([0, totalTicks(project)]);
  const add = (start: number, duration: number) => { points.add(start); points.add(start + duration); };
  for (const scene of projectScenes(project)) add(scene.startTicks, scene.durationTicks);
  for (const clip of overlayScenes(project)) add(clip.startTicks, clip.durationTicks);
  for (const clip of project.audio) add(clip.startTicks, clip.durationTicks);
  for (const element of timelineOverlays(project)) add(element.startTicks, element.durationTicks);
  const end = totalTicks(project);
  return [...points].filter(tick => Number.isFinite(tick) && tick >= 0 && tick <= end).sort((a, b) => a - b);
}

/** The next boundary strictly after (or before) `tick`; stays put at either end. */
export function nextEditPoint(points: number[], tick: number, direction: 1 | -1): number {
  if (direction > 0) return points.find(point => point > tick) ?? tick;
  for (let index = points.length - 1; index >= 0; index--) if (points[index] < tick) return points[index];
  return tick;
}
