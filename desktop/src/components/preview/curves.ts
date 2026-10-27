import type { CurvePoint, ToneCurves } from '../../stores/model';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Monotone cubic Hermite interpolation (Fritsch–Carlson). The curve never
 * overshoots between control points, so dragging one point cannot ring a
 * neighbouring tone range.
 */
export function evaluateCurve(points: CurvePoint[], x: number): number {
  if (!points.length) return clamp01(x);
  if (points.length === 1) return points[0][1];
  if (x <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (x >= last[0]) return last[1];
  const secants: number[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    secants.push((points[index + 1][1] - points[index][1]) / (points[index + 1][0] - points[index][0]));
  }
  const tangents = new Array<number>(points.length);
  tangents[0] = secants[0];
  tangents[points.length - 1] = secants[secants.length - 1];
  for (let index = 1; index < points.length - 1; index += 1) tangents[index] = (secants[index - 1] + secants[index]) / 2;
  for (let index = 0; index < secants.length; index += 1) {
    if (secants[index] === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const a = tangents[index] / secants[index];
    const b = tangents[index + 1] / secants[index];
    if (Math.hypot(a, b) > 3) {
      const scale = 3 / Math.hypot(a, b);
      tangents[index] = scale * a * secants[index];
      tangents[index + 1] = scale * b * secants[index];
    }
  }
  let index = 0;
  while (index < points.length - 2 && x > points[index + 1][0]) index += 1;
  const [x0, y0] = points[index];
  const [x1, y1] = points[index + 1];
  const span = Math.max(1e-6, x1 - x0);
  const t = (x - x0) / span;
  const t2 = t * t, t3 = t2 * t;
  const value = (2 * t3 - 3 * t2 + 1) * y0
    + (t3 - 2 * t2 + t) * span * tangents[index]
    + (-2 * t3 + 3 * t2) * y1
    + (t3 - t2) * span * tangents[index + 1];
  return clamp01(value);
}

/** 256-entry lookup table for one channel. */
export function curveLut(points: CurvePoint[], size = 256): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(size);
  for (let index = 0; index < size; index += 1) {
    lut[index] = Math.round(evaluateCurve(points, index / Math.max(1, size - 1)) * 255);
  }
  return lut;
}

export type CurveLuts = { red: Uint8ClampedArray; green: Uint8ClampedArray; blue: Uint8ClampedArray };

/** Master is applied first, then the per-channel curve. */
export function buildCurveLuts(curves: ToneCurves | undefined): CurveLuts | null {
  if (!curves) return null;
  const master = curves.master ? curveLut(curves.master) : null;
  const combine = (points: CurvePoint[] | undefined): Uint8ClampedArray | null => {
    const own = points ? curveLut(points) : null;
    if (!master && !own) return null;
    const out = new Uint8ClampedArray(256);
    for (let value = 0; value < out.length; value += 1) {
      out[value] = own ? own[master ? master[value] : value] : master![value];
    }
    return out;
  };
  const red = combine(curves.red), green = combine(curves.green), blue = combine(curves.blue);
  if (!red && !green && !blue) return null;
  return {
    red: red ?? new Uint8ClampedArray(256).map((_, index) => index),
    green: green ?? new Uint8ClampedArray(256).map((_, index) => index),
    blue: blue ?? new Uint8ClampedArray(256).map((_, index) => index),
  };
}

export function hasToneCurves(curves: ToneCurves | undefined): boolean {
  if (!curves) return false;
  return Object.values(curves).some(points => points?.some(([x, y]) => Math.abs(x - y) > 1e-4) ?? false);
}

export function sampleCurve(lut: Uint8ClampedArray, value: number): number {
  return lut[Math.max(0, Math.min(255, Math.round(value)))];
}
