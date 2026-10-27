export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

export type BoxPixels = { cx: number; cy: number; w: number; h: number; rotation: number };
export type ResizeBounds = { cx: number; cy: number; w: number; h: number };
export type ResizeLimits = { minWidth: number; minHeight: number; maxWidth: number; maxHeight: number };

const CORNER_SIGN: Record<ResizeCorner, { x: number; y: number }> = {
  nw: { x: -1, y: -1 },
  ne: { x: 1, y: -1 },
  sw: { x: -1, y: 1 },
  se: { x: 1, y: 1 },
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Resizes a rotated box in screen pixels from one corner while keeping the
 * opposite corner fixed. The preview rotation is applied in screen space, so
 * the pointer delta is projected onto the box's own axes first.
 */
export function resizeRotatedBox(base: BoxPixels, corner: ResizeCorner, dx: number, dy: number, limits: ResizeLimits, keepAspect = false): ResizeBounds {
  const sign = CORNER_SIGN[corner];
  const radians = base.rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;

  let w = clamp(base.w + sign.x * localX, limits.minWidth, limits.maxWidth);
  let h = clamp(base.h + sign.y * localY, limits.minHeight, limits.maxHeight);
  if (keepAspect && base.w > 0 && base.h > 0) {
    const ratio = base.h / base.w;
    if (Math.abs(localX) >= Math.abs(localY)) h = clamp(w * ratio, limits.minHeight, limits.maxHeight);
    else w = clamp(h / ratio, limits.minWidth, limits.maxWidth);
  }

  const shiftX = sign.x * (w - base.w) / 2;
  const shiftY = sign.y * (h - base.h) / 2;
  return {
    cx: base.cx + shiftX * cos - shiftY * sin,
    cy: base.cy + shiftX * sin + shiftY * cos,
    w,
    h,
  };
}

/** Wraps an angle into (-180, 180], matching the model's rotation range. */
export function normaliseRotation(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const wrapped = ((value + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
}

/** Rotation for the round handle: the pointer angle is added to the start angle. */
export function rotationFromPointer(startRotation: number, startAngle: number, pointerAngle: number, snap = false): number {
  const next = startRotation + (pointerAngle - startAngle);
  return normaliseRotation(snap ? Math.round(next / 15) * 15 : next);
}
