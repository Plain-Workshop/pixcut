import type { LayerMask, MaskShape } from '../../stores/model';

export type MaskPoint = { x: number; y: number };

/**
 * Polygon used by the rectangle, triangle and star mask shapes. Coordinates are
 * pixels inside the mask's own box; the ellipse is drawn with the canvas arc
 * API because a 64-sided polygon would not be a real ellipse.
 */
export function maskPolygon(shape: MaskShape, width: number, height: number): MaskPoint[] {
  const w = Math.max(1, width), h = Math.max(1, height);
  if (shape === 'rectangle') return [
    { x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 },
    { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 },
  ];
  if (shape === 'triangle') return [
    { x: 0, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 },
  ];
  if (shape === 'star') {
    const points: MaskPoint[] = [];
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI / 2 + index * Math.PI / 5;
      const radius = index % 2 === 0 ? .5 : .21;
      points.push({ x: Math.cos(angle) * w * radius, y: Math.sin(angle) * h * radius });
    }
    return points;
  }
  return [];
}

/** Traces the mask path in the canvas's current coordinate space. */
export function traceMask(ctx: CanvasRenderingContext2D, mask: LayerMask, width: number, height: number) {
  const w = Math.max(1, width), h = Math.max(1, height);
  ctx.save();
  ctx.translate(mask.x * w, mask.y * h);
  ctx.rotate(mask.rotation * Math.PI / 180);
  ctx.beginPath();
  if (mask.shape === 'ellipse') {
    ctx.ellipse(0, 0, Math.max(.5, mask.width * w / 2), Math.max(.5, mask.height * h / 2), 0, 0, Math.PI * 2);
  } else {
    for (const [index, point] of maskPolygon(mask.shape, mask.width * w, mask.height * h).entries()) {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
  }
  ctx.restore();
}

/** Bakes the mask into a canvas's alpha channel. */
export function applyMaskAlpha(canvas: HTMLCanvasElement, mask: LayerMask) {
  const ctx = canvas.getContext('2d');
  if (!ctx || canvas.width < 1 || canvas.height < 1) return canvas;
  const matte = maskMatte(mask, canvas.width, canvas.height);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(matte, 0, 0);
  ctx.restore();
  return canvas;
}

// Video overlays reuse the same matte for every frame. The cache is keyed by
// geometry and pixel size so a resize or a mask edit produces a fresh matte.
const mattes = new Map<string, HTMLCanvasElement>();
const MATTE_CACHE_LIMIT = 8;
const MATTE_CACHE_MAX_PIXELS = 4_000_000;

function maskMatte(mask: LayerMask, width: number, height: number) {
  const key = `${mask.shape}:${mask.x}:${mask.y}:${mask.width}:${mask.height}:${mask.rotation}:${mask.feather}:${mask.invert}:${width}x${height}`;
  const cached = mattes.get(key);
  if (cached) return cached;
  const alpha = document.createElement('canvas');
  alpha.width = width;
  alpha.height = height;
  const maskCtx = alpha.getContext('2d');
  if (!maskCtx) return alpha;
  maskCtx.fillStyle = '#ffffff';
  if (mask.invert) {
    maskCtx.fillRect(0, 0, alpha.width, alpha.height);
    maskCtx.globalCompositeOperation = 'destination-out';
  }
  const feather = Math.min(alpha.width, alpha.height) * Math.max(0, Math.min(100, mask.feather)) / 400;
  if (maskCtx.filter !== undefined) maskCtx.filter = feather > .1 ? `blur(${feather.toFixed(2)}px)` : 'none';
  maskCtx.fillStyle = '#ffffff';
  traceMask(maskCtx, mask, alpha.width, alpha.height);
  maskCtx.fill();
  // Very large mattes are cheap enough to rebuild and would otherwise pin
  // hundreds of megabytes across a 4K export.
  if (alpha.width * alpha.height <= MATTE_CACHE_MAX_PIXELS) {
    mattes.set(key, alpha);
    while (mattes.size > MATTE_CACHE_LIMIT) {
      const oldest = mattes.keys().next().value;
      if (oldest === undefined) break;
      mattes.delete(oldest);
    }
  }
  return alpha;
}
