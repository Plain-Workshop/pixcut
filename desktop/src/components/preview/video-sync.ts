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

export function videoSeekTarget(currentTime: number, target: number, forward: boolean, ready: boolean, seeking: boolean): number | null {
  if (!ready || seeking) return null;
  if (!Number.isFinite(currentTime) || !Number.isFinite(target)) return null;
  const tolerance = forward ? FORWARD_DRIFT_SECONDS : STEP_DRIFT_SECONDS;
  return Math.abs(currentTime - target) > tolerance ? target : null;
}
