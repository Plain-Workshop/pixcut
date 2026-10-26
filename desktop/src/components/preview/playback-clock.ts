// UI renders may be delayed or skipped. Playback follows elapsed wall time,
// never the last React state update, so delayed commits cannot rewind audio.
export function playbackPosition(origin: number, startedAt: number, now: number, direction: 1 | -1) {
  return origin + Math.max(0, now - startedAt) / 1000 * direction;
}
