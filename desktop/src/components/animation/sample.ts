/** Linear interpolation over the frames of one numeric property, sorted by time. */
export function sampleTrack<T extends { at: number }>(frames: T[], property: keyof T, at: number, fallback: number): number {
  const points = frames.filter(frame => typeof frame[property] === 'number');
  if (!points.length) return fallback;
  const first = points[0];
  if (at <= first.at) return Number(first[property]);
  const last = points[points.length - 1];
  if (at >= last.at) return Number(last[property]);
  for (let index = 1; index < points.length; index += 1) {
    const right = points[index];
    if (at > right.at) continue;
    const left = points[index - 1];
    const span = right.at - left.at;
    const progress = span <= 0 ? 1 : (at - left.at) / span;
    const from = Number(left[property]), to = Number(right[property]);
    return from + (to - from) * progress;
  }
  return Number(last[property]);
}
