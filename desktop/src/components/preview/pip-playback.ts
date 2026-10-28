import { ticksToSeconds, type Scene, type Timebase } from '../../stores/model';

export type PipFrameTarget = {
  /** Whether the playhead sits inside the clip. */
  active: boolean;
  /** Seconds since the clip's start; negative before it begins. */
  local: number;
  /** Source time to show, before clamping to the media duration. */
  source: number;
};

/**
 * Where a picture-in-picture clip is in its source at a given playhead. PiP
 * clips ignore speed and reverse in the export path — their frames are supplied
 * by the caller — so this stays deliberately simple and matches `overlayVideoFrame`.
 */
export function pipFrameTarget(clip: Pick<Scene, 'startTicks' | 'durationTicks'> & { sourceInTicks?: number }, projectSeconds: number, timebase: Timebase): PipFrameTarget {
  const local = projectSeconds - ticksToSeconds(clip.startTicks, timebase);
  const length = ticksToSeconds(clip.durationTicks, timebase);
  return {
    active: local >= 0 && local < length,
    local,
    source: ticksToSeconds(clip.sourceInTicks ?? 0, timebase) + Math.max(0, local),
  };
}

/** Keeps a source time inside the decoded media, leaving a frame of headroom. */
export function clampPipSource(source: number, duration: number): number {
  if (!Number.isFinite(source)) return 0;
  const end = Number.isFinite(duration) && duration > 0 ? duration - 0.04 : source;
  return Math.max(0, Math.min(source, Math.max(0, end)));
}
