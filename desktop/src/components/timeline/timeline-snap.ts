import { useSyncExternalStore } from 'react';
import { overlayScenes, projectScenes, totalTicks, type Project } from '../../stores/model';
import { timelineOverlays } from '../elements/overlays';

export type SnapKind = 'playhead' | 'cut' | 'clip' | 'beat' | 'start' | 'end';
export type SnapPoint = { tick: number; kind: SnapKind };
export type EdgeSnap = { startTicks: number; durationTicks: number; guide: SnapPoint | null };

export const SNAP_LABELS: Record<SnapKind, string> = {
  playhead: 'Playhead', cut: 'Scene cut', clip: 'Clip edge', beat: 'Beat', start: 'Start', end: 'End',
};
/** Pointer distance that pulls an edge onto a target. */
export const SNAP_PIXELS = 8;

/**
 * Everything a dragged edge can land on: the playhead, scene cuts, beat
 * markers and the edges of other clips. `excludeId` skips the clip being
 * dragged so it does not snap to itself.
 */
export function timelineSnapPoints(project: Project, playheadTick: number | null, excludeId?: string): SnapPoint[] {
  const points: SnapPoint[] = [];
  if (playheadTick !== null && Number.isFinite(playheadTick)) points.push({ tick: Math.round(playheadTick), kind: 'playhead' });
  const end = totalTicks(project);
  points.push({ tick: 0, kind: 'start' }, { tick: end, kind: 'end' });
  for (const scene of projectScenes(project)) {
    if (scene.id === excludeId) continue;
    points.push({ tick: scene.startTicks, kind: 'cut' }, { tick: scene.startTicks + scene.durationTicks, kind: 'cut' });
  }
  for (const tick of project.beatTicks ?? []) points.push({ tick, kind: 'beat' });
  const clip = (id: string, start: number, duration: number) => { if (id !== excludeId) points.push({ tick: start, kind: 'clip' }, { tick: start + duration, kind: 'clip' }); };
  for (const item of overlayScenes(project)) clip(item.id, item.startTicks, item.durationTicks);
  for (const item of project.audio) clip(item.id, item.startTicks, item.durationTicks);
  for (const item of timelineOverlays(project)) clip(item.id, item.startTicks, item.durationTicks);
  return points.filter(point => Number.isFinite(point.tick));
}

/** Closest target within `threshold`; the playhead wins ties because it is what the user is looking at. */
export function nearestSnap(value: number, points: SnapPoint[], threshold: number): SnapPoint | null {
  let best: SnapPoint | null = null, bestGap = Infinity;
  for (const point of points) {
    const gap = Math.abs(value - point.tick);
    if (gap > threshold) continue;
    if (gap < bestGap || (gap === bestGap && point.kind === 'playhead')) { best = point; bestGap = gap; }
  }
  return best;
}

/**
 * Snaps the edge being dragged. Moving snaps whichever edge lands closer and
 * keeps the length; trimming snaps only the edge under the pointer.
 */
export function snapEdges(edge: 'move' | 'start' | 'end', startTicks: number, durationTicks: number, points: SnapPoint[], threshold: number): EdgeSnap {
  const start = Math.max(0, Math.round(startTicks)), duration = Math.max(1, Math.round(durationTicks));
  const none = { startTicks: start, durationTicks: duration, guide: null };
  if (!points.length || threshold <= 0) return none;
  if (edge === 'start') {
    const hit = nearestSnap(start, points, threshold);
    if (!hit || hit.tick >= start + duration) return none;
    return { startTicks: hit.tick, durationTicks: start + duration - hit.tick, guide: hit };
  }
  if (edge === 'end') {
    const hit = nearestSnap(start + duration, points, threshold);
    if (!hit || hit.tick <= start) return none;
    return { startTicks: start, durationTicks: hit.tick - start, guide: hit };
  }
  const head = nearestSnap(start, points, threshold), tail = nearestSnap(start + duration, points, threshold);
  if (head && (!tail || Math.abs(start - head.tick) <= Math.abs(start + duration - tail.tick))) return { startTicks: Math.max(0, head.tick), durationTicks: duration, guide: head };
  if (tail && tail.tick - duration >= 0) return { startTicks: tail.tick - duration, durationTicks: duration, guide: tail };
  return none;
}

/** The guide to show once constraints have had their say: only if an edge really sits on it. */
export function landedOn(guide: SnapPoint | null, startTicks: number, durationTicks: number): SnapPoint | null {
  return guide && (guide.tick === startTicks || guide.tick === startTicks + durationTicks) ? guide : null;
}

/** Ticks per SNAP_PIXELS for a track of `trackPx` showing `projectTicks`. */
export function snapThreshold(projectTicks: number, trackPx: number) {
  return trackPx > 0 ? Math.max(1, Math.round(projectTicks / trackPx * SNAP_PIXELS)) : 0;
}

// The active guide lives outside React state so every drag hook can publish
// it without threading setters through the editor.
let activeGuide: SnapPoint | null = null;
const listeners = new Set<() => void>();
export function setSnapGuide(guide: SnapPoint | null) {
  if (guide?.tick === activeGuide?.tick && guide?.kind === activeGuide?.kind) return;
  activeGuide = guide;
  for (const listener of listeners) listener();
}
export function useSnapGuide() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => activeGuide, () => null);
}
