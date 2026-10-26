/**
 * Beat markers are manual timeline anchors. Overlay timing snaps to the nearest
 * marker so cuts, text and overlays land on the beat without pixel chasing.
 * All values are project ticks; `threshold` is the same unit.
 */
export type TimingSnap = { startTicks: number; durationTicks: number };

export function nearestBeat(value: number, beats: number[], threshold: number): number | null {
  let best: number | null = null;
  let distance = Math.max(0, threshold);
  for (const beat of beats) {
    if (!Number.isFinite(beat)) continue;
    const gap = Math.abs(value - beat);
    if (gap <= distance) { distance = gap; best = beat; }
  }
  return best;
}

/**
 * Snaps the edge being dragged. Moving snaps whichever edge is closer (and
 * shifts the clip); trimming snaps only the edge under the pointer.
 */
export function snapOverlayTiming(
  edge: 'move' | 'start' | 'end',
  startTicks: number,
  durationTicks: number,
  beats: number[],
  threshold: number,
): TimingSnap {
  const start = Math.max(0, Math.round(startTicks));
  const duration = Math.max(1, Math.round(durationTicks));
  if (!beats.length || threshold <= 0) return { startTicks: start, durationTicks: duration };
  if (edge === 'start') {
    const beat = nearestBeat(start, beats, threshold);
    if (beat === null) return { startTicks: start, durationTicks: duration };
    return { startTicks: beat, durationTicks: Math.max(1, start + duration - beat) };
  }
  if (edge === 'end') {
    const end = start + duration;
    const beat = nearestBeat(end, beats, threshold);
    if (beat === null) return { startTicks: start, durationTicks: duration };
    return { startTicks: start, durationTicks: Math.max(1, beat - start) };
  }
  const startBeat = nearestBeat(start, beats, threshold);
  const endBeat = nearestBeat(start + duration, beats, threshold);
  if (startBeat !== null && (endBeat === null || Math.abs(start - startBeat) <= Math.abs(start + duration - endBeat))) {
    return { startTicks: startBeat, durationTicks: duration };
  }
  if (endBeat !== null) return { startTicks: Math.max(0, endBeat - duration), durationTicks: duration };
  return { startTicks: start, durationTicks: duration };
}
