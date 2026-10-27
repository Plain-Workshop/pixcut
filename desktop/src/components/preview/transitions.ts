import type { TransitionType } from '../../stores/model';

/** Shared compositing for scene playback, export, and live transition examples. */
export function drawTransitionFrames(canvas: HTMLCanvasElement, fromCanvas: HTMLCanvasElement, toCanvas: HTMLCanvasElement, type: TransitionType, progress: number) {
  canvas.width = fromCanvas.width;
  canvas.height = fromCanvas.height;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  const p = Math.min(1, Math.max(0, progress));
  ctx.fillStyle = '#101214';
  ctx.fillRect(0, 0, w, h);
  if (type === 'slide') {
    ctx.drawImage(fromCanvas, -p * w, 0);
    ctx.drawImage(toCanvas, (1 - p) * w, 0);
  } else if (type === 'wipe') {
    ctx.drawImage(fromCanvas, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w * p, h);
    ctx.clip();
    ctx.drawImage(toCanvas, 0, 0);
    ctx.restore();
  } else if (type === 'zoom') {
    const fromScale = 1 + p * .12;
    const toScale = 1.12 - p * .12;
    const drawScaled = (source: HTMLCanvasElement, scale: number, alpha: number) => {
      const dw = w * scale, dh = h * scale;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh);
      ctx.restore();
    };
    drawScaled(fromCanvas, fromScale, 1 - p * .2);
    drawScaled(toCanvas, toScale, p);
  } else if (type === 'blur') {
    const soft = (source: HTMLCanvasElement, alpha: number) => {
      const small = document.createElement('canvas');
      small.width = Math.max(2, Math.round(w / 14));
      small.height = Math.max(2, Math.round(h / 14));
      small.getContext('2d')!.drawImage(source, 0, 0, small.width, small.height);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(small, 0, 0, w, h);
      ctx.restore();
    };
    soft(fromCanvas, 1 - p);
    soft(toCanvas, p);
  } else if (type === 'circle') {
    ctx.drawImage(fromCanvas, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.hypot(w, h) * .55 * p, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(toCanvas, 0, 0);
    ctx.restore();
  } else if (type === 'slide-up') {
    ctx.drawImage(fromCanvas, 0, -p * h);
    ctx.drawImage(toCanvas, 0, (1 - p) * h);
  } else if (type === 'spin') {
    const drawSpin = (source: HTMLCanvasElement, angle: number, scale: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(angle);
      ctx.scale(scale, scale);
      ctx.drawImage(source, -w / 2, -h / 2);
      ctx.restore();
    };
    drawSpin(fromCanvas, -p * .18, 1 - p * .08, 1 - p);
    drawSpin(toCanvas, (1 - p) * .18, .92 + p * .08, p);
  } else {
    ctx.drawImage(fromCanvas, 0, 0);
    ctx.save();
    ctx.globalAlpha = p;
    ctx.drawImage(toCanvas, 0, 0);
    ctx.restore();
  }
}
