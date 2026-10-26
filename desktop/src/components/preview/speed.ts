import { ticksToSeconds, type Scene, type Timebase } from '../../stores/model';

const clampSpeed = (value: number) => Math.min(4, Math.max(.25, Number.isFinite(value) ? value : 1));

/** Start and end playback rates. Equal values mean constant speed. */
export function speedCurve(scene: Pick<Scene, 'speed' | 'speedEnd'>): { start: number; end: number } {
  const start = clampSpeed(scene.speed ?? 1);
  const end = clampSpeed(scene.speedEnd ?? start);
  return { start, end };
}

export function isRamped(scene: Pick<Scene, 'speed' | 'speedEnd'>): boolean {
  const { start, end } = speedCurve(scene);
  return Math.abs(end - start) > 1e-6;
}

/** Playback rate at a clip-local time. */
export function speedAt(scene: Pick<Scene, 'speed' | 'speedEnd'>, localSeconds: number, durationSeconds: number): number {
  const { start, end } = speedCurve(scene);
  if (durationSeconds <= 0 || Math.abs(end - start) <= 1e-6) return start;
  const t = Math.min(durationSeconds, Math.max(0, localSeconds));
  return start + (end - start) * (t / durationSeconds);
}

/**
 * Source seconds consumed after `localSeconds` of output. A linear speed ramp
 * integrates to `v0·t + (v1−v0)·t²/(2D)`.
 */
export function consumedSeconds(scene: Pick<Scene, 'speed' | 'speedEnd'>, localSeconds: number, durationSeconds: number): number {
  const { start, end } = speedCurve(scene);
  if (durationSeconds <= 0) return 0;
  const t = Math.min(durationSeconds, Math.max(0, localSeconds));
  if (Math.abs(end - start) <= 1e-6) return start * t;
  return start * t + (end - start) * t * t / (2 * durationSeconds);
}

/** How much source the clip uses over its full duration. */
export function sourceSpan(scene: Pick<Scene, 'speed' | 'speedEnd'>, durationSeconds: number): number {
  const { start, end } = speedCurve(scene);
  return durationSeconds * (start + end) / 2;
}

/**
 * Absolute source time for a clip-local time, including the in-point and
 * reverse playback. Reversed clips play the used range from its end back to
 * its in-point.
 */
export function sourceSecondsAt(scene: Scene, localSeconds: number, timebase: Timebase): number {
  const duration = ticksToSeconds(scene.durationTicks, timebase);
  const inPoint = ticksToSeconds(scene.sourceInTicks ?? 0, timebase);
  const consumed = consumedSeconds(scene, localSeconds, duration);
  return scene.reverse ? inPoint + sourceSpan(scene, duration) - consumed : inPoint + consumed;
}
