/** Anything placed on the timeline by start and length: audio, overlays, elements, picture-in-picture. */
export type Timed = { id: string; startTicks: number; durationTicks: number };

/**
 * Removes a clip and closes the gap it leaves: every clip in `peers` that
 * starts at or after the removed clip's end moves earlier by its length.
 * Clips that overlap the removed one, or sit before it, are not touched, so a
 * ripple never reorders or collides clips.
 */
export function rippleRemove<T extends Timed>(clips: T[], id: string, peers: (clip: T, removed: T) => boolean = () => true): T[] {
  const removed = clips.find(clip => clip.id === id);
  if (!removed) return clips;
  const end = removed.startTicks + removed.durationTicks;
  return clips.filter(clip => clip.id !== id).map(clip => peers(clip, removed) && clip.startTicks >= end
    ? { ...clip, startTicks: Math.max(0, clip.startTicks - removed.durationTicks) }
    : clip);
}

/** Plain removal: later clips stay where they are and the gap remains. */
export function gapRemove<T extends Timed>(clips: T[], id: string): T[] {
  return clips.filter(clip => clip.id !== id);
}

export type TrimResult = { startTicks: number; durationTicks: number; /** Ticks the start moved; sources advance by this much. */ shiftTicks: number };

/**
 * Trims one edge of a clip to the playhead. Returns null when the playhead is
 * outside the clip or would leave less than `minimum` ticks, so callers can
 * explain instead of producing a sliver.
 */
export function trimToPlayhead(clip: Timed, edge: 'start' | 'end', playheadTick: number, minimum: number): TrimResult | null {
  const end = clip.startTicks + clip.durationTicks;
  if (!Number.isFinite(playheadTick) || playheadTick <= clip.startTicks || playheadTick >= end) return null;
  if (edge === 'start') {
    const durationTicks = end - playheadTick;
    return durationTicks < minimum ? null : { startTicks: playheadTick, durationTicks, shiftTicks: playheadTick - clip.startTicks };
  }
  const durationTicks = playheadTick - clip.startTicks;
  return durationTicks < minimum ? null : { startTicks: clip.startTicks, durationTicks, shiftTicks: 0 };
}

/** Moves a clip by whole ticks (one tick is one frame), keeping it inside 0…projectTicks. */
export function nudgeStart(clip: Timed, deltaTicks: number, projectTicks: number): number {
  const latest = Math.max(0, projectTicks - clip.durationTicks);
  return Math.min(latest, Math.max(0, Math.round(clip.startTicks + deltaTicks)));
}

/**
 * Where a pasted clip starts: at the playhead, pulled back so it still fits.
 * Returns null when the clip is longer than the whole story.
 */
export function pasteStart(durationTicks: number, playheadTick: number, projectTicks: number): number | null {
  if (!(projectTicks > 0) || durationTicks > projectTicks) return null;
  return Math.min(Math.max(0, Math.round(playheadTick)), projectTicks - durationTicks);
}

/** Visual-track clips whose start is at or after the playhead, for "select everything after the playhead". */
export function startingAtOrAfter<T extends { id: string; startTicks: number }>(clips: T[], playheadTick: number): string[] {
  return clips.filter(clip => clip.startTicks >= playheadTick).map(clip => clip.id);
}

/** Clips whose horizontal extent overlaps a marquee, as fractions of the story. */
export function inRange<T extends { id: string; startTicks: number; durationTicks: number }>(clips: T[], fromTick: number, toTick: number): string[] {
  const low = Math.min(fromTick, toTick), high = Math.max(fromTick, toTick);
  return clips.filter(clip => clip.startTicks < high && clip.startTicks + clip.durationTicks > low).map(clip => clip.id);
}
