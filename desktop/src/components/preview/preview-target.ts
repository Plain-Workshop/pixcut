/**
 * What the preview should draw. A pinned scene keeps a text drag or a trim
 * preview visible while the playhead stays put, but playback must always follow
 * the timeline: a pinned clip would otherwise be seeked back to its in-point
 * every few frames, which looked like a half-second video looping forever.
 */
export function resolvePreviewTarget<T extends { id: string }>(playing: boolean, active: T | undefined, pinned: T | null): T | undefined {
  if (playing) return active;
  return pinned ?? active;
}
