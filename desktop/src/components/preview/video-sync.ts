/**
 * The preview video element runs on its own clock. While a clip plays forward
 * that clock is authoritative: seeking it every timeline frame fights the
 * decoder, so playback stutters, drops frames and loses audio. Only a large
 * drift is corrected. Scrubbing, pausing and reverse playback need the picture
 * to follow the playhead exactly, so they keep a tight tolerance.
 *
 * Returns the time to seek to, or `null` when the frame on screen is close
 * enough (or when a seek is already running).
 */
export const FORWARD_DRIFT_SECONDS = 0.4;
export const STEP_DRIFT_SECONDS = 0.05;

/**
 * Maps a media element time onto the project timeline for a constant-speed,
 * forward-playing video. Returns null while the media is outside the clip's
 * source window, which lets the caller fall back to wall time.
 */
export function mediaClockPosition(sourceTime: number, sourceIn: number, speed: number, duration: number, activeStart: number): number | null {
  if (!Number.isFinite(sourceTime) || !Number.isFinite(sourceIn) || !Number.isFinite(activeStart) || !Number.isFinite(duration) || duration <= 0) return null;
  const rate = Number.isFinite(speed) && speed > 0 ? speed : 1;
  const local = (sourceTime - sourceIn) / rate;
  if (!Number.isFinite(local) || local < -0.1 || local > duration + 0.05) return null;
  return Math.max(0, activeStart + Math.max(0, local));
}

export function videoSeekTarget(currentTime: number, target: number, forward: boolean, ready: boolean, seeking: boolean): number | null {
  if (!ready || seeking) return null;
  if (!Number.isFinite(currentTime) || !Number.isFinite(target)) return null;
  const tolerance = forward ? FORWARD_DRIFT_SECONDS : STEP_DRIFT_SECONDS;
  return Math.abs(currentTime - target) > tolerance ? target : null;
}
