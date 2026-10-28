import { ticksToSeconds, type AudioClip, type Timebase } from '../../stores/model';

/**
 * Splits an audio clip at a clip-local tick. The two halves keep the same
 * source, lane, level and EQ; the right half resumes the source where the left
 * one stops, and an outer fade stays on the outer edge.
 */
export function splitAudioClip(clip: AudioClip, atTicks: number, newId: string, timebase: Timebase): { left: AudioClip; right: AudioClip } | null {
  if (!Number.isInteger(atTicks) || atTicks <= 0 || atTicks >= clip.durationTicks) return null;
  const leftSeconds = ticksToSeconds(atTicks, timebase);
  const rightSeconds = ticksToSeconds(clip.durationTicks - atTicks, timebase);
  const left: AudioClip = {
    ...clip,
    durationTicks: atTicks,
    fadeIn: Math.min(clip.fadeIn ?? 0, leftSeconds),
    fadeOut: 0,
  };
  const right: AudioClip = {
    ...clip,
    id: newId,
    startTicks: clip.startTicks + atTicks,
    durationTicks: clip.durationTicks - atTicks,
    sourceInSeconds: Math.min(clip.sourceDurationSeconds, clip.sourceInSeconds + leftSeconds),
    fadeIn: 0,
    fadeOut: Math.min(clip.fadeOut ?? 0, rightSeconds),
  };
  return { left, right };
}
