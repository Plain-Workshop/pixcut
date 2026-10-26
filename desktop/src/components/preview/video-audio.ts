/**
 * Imported video clips keep their own audio track. Preview and export both
 * attenuate it with the clip's visual fades, so a clip that fades to black
 * does not keep talking at full volume. Each fade is linear and they multiply,
 * which is exactly what a chained FFmpeg `afade` does in the export graph.
 */
export function videoGain(localSeconds: number, durationSeconds: number, fadeIn = 0, fadeOut = 0): number {
  if (!Number.isFinite(localSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return 1;
  const at = Math.min(Math.max(0, localSeconds), durationSeconds);
  const fadeInLength = Number.isFinite(fadeIn) && fadeIn > 0 ? Math.min(fadeIn, durationSeconds) : 0;
  const fadeOutLength = Number.isFinite(fadeOut) && fadeOut > 0 ? Math.min(fadeOut, durationSeconds) : 0;
  let gain = 1;
  if (fadeInLength > 0 && at < fadeInLength) gain *= at / fadeInLength;
  if (fadeOutLength > 0 && at > durationSeconds - fadeOutLength) gain *= (durationSeconds - at) / fadeOutLength;
  return Math.min(1, Math.max(0, gain));
}
