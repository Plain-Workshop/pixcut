/**
 * Alignment guides for canvas dragging. Positions are normalized 0–1, so the
 * same maths works for any format, preview scale, or output size.
 */
export type SnapTarget = {
  /** Where the edge/centre being dragged would sit. */
  at: number;
  /** Where to draw the guide line. */
  guide: number;
};

export type AxisSnap = {
  value: number;
  guide: number | null;
};

/**
 * Snaps a position to the nearest target within `threshold`. Ties go to the
 * target encountered first, and non-finite values are ignored so a broken
 * project cannot throw during a drag.
 */
export function snapToTargets(value: number, targets: SnapTarget[], threshold = 0.012): AxisSnap {
  let best = value, guide: number | null = null;
  if (!Number.isFinite(value)) return { value, guide: null };
  // A small tolerance keeps an exactly-on-threshold drag snapping even though
  // normalized positions cannot represent it precisely (0.5 - 0.47 > 0.03).
  let distance = Math.max(0, threshold) + 1e-9;
  for (const target of targets) {
    if (!Number.isFinite(target.at) || !Number.isFinite(target.guide)) continue;
    const gap = Math.abs(value - target.at);
    if (gap <= distance) { distance = gap; best = target.at; guide = target.guide; }
  }
  return { value: best, guide };
}

/** Centre guides for a centred element: canvas middle plus other layer centres. */
export function centreGuides(points: number[] = []): SnapTarget[] {
  const targets: SnapTarget[] = [{ at: .5, guide: .5 }];
  for (const value of points) if (Number.isFinite(value) && value >= 0 && value <= 1) targets.push({ at: value, guide: value });
  return targets;
}

/**
 * Guides for a box aligned by its leading edge (x by width, y by height):
 * start, centre, end. The guide line is drawn at the matching canvas
 * edge/centre, not at the box offset.
 */
export function edgeGuides(size: number): SnapTarget[] {
  const safeSize = Number.isFinite(size) ? Math.min(1, Math.max(0, size)) : 0;
  const centre = (1 - safeSize) / 2;
  return [
    { at: 0, guide: 0 },
    { at: centre, guide: .5 },
    { at: 1 - safeSize, guide: 1 },
  ];
}
