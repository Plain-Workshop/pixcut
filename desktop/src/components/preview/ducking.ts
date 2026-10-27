import { ticksToSeconds, type Scene, type Timebase } from '../../stores/model';

/** Timeline windows where an audible video clip plays, in project seconds. */
export type DuckWindow = { start: number; end: number };

export function audibleVideoWindows(scenes: Scene[], timebase: Timebase, busGain = 1): DuckWindow[] {
  if (!(busGain > 0)) return [];
  return scenes
    .filter(scene => scene.mediaKind === 'video' && (scene.videoVolume ?? 100) > 0)
    .map(scene => ({ start: ticksToSeconds(scene.startTicks, timebase), end: ticksToSeconds(scene.startTicks + scene.durationTicks, timebase) }))
    .sort((a, b) => a.start - b.start);
}

/**
 * Music gain while a video is talking. `amount` is the depth in percent;
 * 0 disables ducking. The 150 ms ramps keep the step from clicking, and the
 * export builds the same envelope with an FFmpeg `volume` expression.
 */
export function duckGain(position: number, windows: DuckWindow[], amount: number, ramp = .15): number {
  if (!Number.isFinite(position) || !Number.isFinite(amount) || amount <= 0) return 1;
  const depth = Math.min(100, Math.max(0, amount)) / 100;
  const span = Math.max(.001, Number.isFinite(ramp) ? ramp : .15);
  let weight = 0;
  for (const window of windows) {
    if (!Number.isFinite(window.start) || !Number.isFinite(window.end) || window.end <= window.start) continue;
    if (position <= window.start || position >= window.end) continue;
    const enter = Math.min(1, (position - window.start) / span);
    const exit = Math.min(1, (window.end - position) / span);
    weight = Math.max(weight, Math.min(enter, exit));
  }
  return 1 - depth * weight;
}
