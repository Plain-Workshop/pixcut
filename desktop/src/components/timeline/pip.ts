import { secondsToTicks, ticksToSeconds, type Scene, type Timebase } from '../../stores/model';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The first free start at or after `desired` that fits `duration` around siblings. */
export function freePipStart(siblings: Pick<Scene, 'startTicks' | 'durationTicks'>[], desired: number, duration: number, totalTicks: number): number | null {
  if (duration < 1 || duration > totalTicks) return null;
  const ordered = [...siblings].sort((a, b) => a.startTicks - b.startTicks);
  let start = clamp(desired, 0, Math.max(0, totalTicks - duration));
  for (const sibling of ordered) {
    const end = start + duration;
    if (end <= sibling.startTicks) break;
    if (start < sibling.startTicks + sibling.durationTicks && end > sibling.startTicks) {
      start = sibling.startTicks + sibling.durationTicks;
    }
  }
  return start + duration <= totalTicks ? start : null;
}

/** Longest duration a PiP clip can use, honouring its own source footage. */
export function pipSourceRoom(clip: Scene, timebase: Timebase): number {
  if (clip.mediaKind !== 'video' || !clip.sourceDurationSeconds) return Number.POSITIVE_INFINITY;
  return Math.max(1, secondsToTicks(clip.sourceDurationSeconds - ticksToSeconds(clip.sourceInTicks ?? 0, timebase), timebase));
}

/**
 * Moves or trims a PiP clip inside the gaps left by its neighbours. The right
 * edge stops at the next clip and at the source footage's end.
 */
export function constrainPipTiming(
  clip: Scene,
  edge: 'move' | 'start' | 'end',
  deltaTicks: number,
  siblings: Scene[],
  totalTicks: number,
  timebase: Timebase,
  minimumTicks = 1,
): { startTicks: number; durationTicks: number } {
  const others = siblings.filter(item => item.id !== clip.id).sort((a, b) => a.startTicks - b.startTicks);
  const end = clip.startTicks + clip.durationTicks;
  if (edge === 'move') {
    const start = freePipStart(others, clip.startTicks + deltaTicks, clip.durationTicks, totalTicks) ?? clip.startTicks;
    return { startTicks: start, durationTicks: clip.durationTicks };
  }
  if (edge === 'start') {
    const previousEnd = others.filter(item => item.startTicks + item.durationTicks <= clip.startTicks).reduce((max, item) => Math.max(max, item.startTicks + item.durationTicks), 0);
    const start = clamp(clip.startTicks + deltaTicks, previousEnd, end - minimumTicks);
    return { startTicks: start, durationTicks: end - start };
  }
  const nextStart = others.filter(item => item.startTicks >= end).reduce((min, item) => Math.min(min, item.startTicks), totalTicks);
  const room = pipSourceRoom(clip, timebase);
  const duration = clamp(clip.durationTicks + deltaTicks, minimumTicks, Math.min(nextStart - clip.startTicks, totalTicks - clip.startTicks, room));
  return { startTicks: clip.startTicks, durationTicks: duration };
}
