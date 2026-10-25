import { DEFAULT_TIMEBASE, sceneSeconds, secondsToTicks, type Project, type Scene, type TextAnimation, type TextLayer, type Timebase, type TransitionType } from '../../stores/model';
import { layerDurationSeconds, layerStartSeconds, layerVisibleAt } from '../text/layers';
import { clampWeight, fontFamily } from '../text/fonts';
import { applyColorGrade, clamp, hasColorGrade } from './filters';

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function dimensions(aspect: Project['aspect']): [number, number] { return aspect === '9:16' ? [1080, 1920] : aspect === '4:5' ? [1080, 1350] : aspect === '1:1' ? [1080, 1080] : [1920, 1080]; }

export async function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('An image could not be decoded. Try a PNG, JPEG, or WebP file.'));
    img.src = src;
  });
  imageCache.set(src, promise);
  if (imageCache.size > 12) {
    const oldest = imageCache.keys().next().value;
    if (oldest) imageCache.delete(oldest);
  }
  promise.catch(() => imageCache.delete(src));
  return promise;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] { const lines: string[] = []; let line = ''; for (const word of text.split(/\s+/)) { const test = line ? `${line} ${word}` : word; if (ctx.measureText(test).width > width && line) { lines.push(line); line = word; } else line = test; } if (line) lines.push(line); return lines; }

let measureCanvas: HTMLCanvasElement | null = null;
function measureContext() {
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  return measureCanvas.getContext('2d')!;
}
function applyLetterSpacing(ctx: CanvasRenderingContext2D, pixels: number) {
  try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${pixels}px`; } catch { /* older engines ignore tracking */ }
}
function textFont(layer: TextLayer, size: number, subtitle = false) {
  const weight = subtitle ? 400 : clampWeight(layer.fontWeight, layer.font);
  const style = layer.fontStyle === 'italic' ? 'italic ' : '';
  return `${style}${weight} ${Math.max(1, Math.round(size))}px ${fontFamily(layer.font)}`;
}
export type TextBlockLayout = {
  hasText: boolean;
  boxLeft: number;
  boxTop: number;
  boxWidth: number;
  blockLeft: number;
  blockWidth: number;
  blockHeight: number;
  title: { text: string; width: number }[];
  subtitle: { text: string; width: number }[];
  titleFont: string;
  subtitleFont: string;
  titleSize: number;
  subtitleSize: number;
  titleLineHeight: number;
  subtitleLineHeight: number;
  subtitleGap: number;
  align: 'left' | 'center' | 'right';
  rotation: number;
  opacity: number;
};
export function layoutTextBlock(layer: TextLayer, width: number, height: number): TextBlockLayout {
  const unit = Math.min(width, height);
  const titleSize = Math.round(unit * layer.size);
  const subtitleSize = Math.round(titleSize * layer.subtitleScale);
  const boxLeft = width * layer.x;
  const boxTop = height * layer.y;
  const boxWidth = width * layer.width;
  const titleFont = textFont(layer, titleSize);
  const subtitleFont = textFont(layer, subtitleSize, true);
  const letterSpacing = layer.letterSpacing * unit;
  const ctx = measureContext();
  ctx.font = titleFont;
  applyLetterSpacing(ctx, letterSpacing);
  const title = layer.title ? wrap(ctx, layer.title, boxWidth).slice(0, 5).map(text => ({ text, width: Math.min(boxWidth, ctx.measureText(text).width) })) : [];
  ctx.font = subtitleFont;
  applyLetterSpacing(ctx, letterSpacing);
  const subtitle = layer.subtitle ? wrap(ctx, layer.subtitle, boxWidth).slice(0, 3).map(text => ({ text, width: Math.min(boxWidth, ctx.measureText(text).width) })) : [];
  const titleLineHeight = titleSize * layer.lineHeight;
  const subtitleLineHeight = subtitleSize * layer.lineHeight;
  const subtitleGap = subtitle.length ? titleSize * .12 : 0;
  const blockHeight = title.length * titleLineHeight + subtitleGap + subtitle.length * subtitleLineHeight;
  const blockWidth = Math.max(1, ...title.map(line => line.width), ...subtitle.map(line => line.width));
  const align = layer.align;
  const blockLeft = align === 'center' ? boxLeft + (boxWidth - blockWidth) / 2 : align === 'right' ? boxLeft + boxWidth - blockWidth : boxLeft;
  return { hasText: Boolean(title.length || subtitle.length), boxLeft, boxTop, boxWidth, blockLeft, blockWidth, blockHeight, title, subtitle, titleFont, subtitleFont, titleSize, subtitleSize, titleLineHeight, subtitleLineHeight, subtitleGap, align, rotation: layer.rotation, opacity: clamp(layer.opacity, 0, 100) / 100 };
}
export function textBoxLayout(layer: TextLayer, aspect: Project['aspect'], size?: { width: number; height: number }) {
  const [width, height] = size ? [size.width, size.height] : dimensions(aspect);
  const layout = layoutTextBlock(layer, width, height);
  return {
    hasText: layout.hasText,
    leftPct: (layout.boxLeft / width) * 100,
    topPct: (layout.boxTop / height) * 100,
    widthPct: (layout.boxWidth / width) * 100,
    heightPct: (layout.blockHeight / height) * 100,
    rotation: layout.rotation,
  };
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

let noiseTileCache: HTMLCanvasElement | null = null;
function noiseTile() {
  if (noiseTileCache) return noiseTileCache;
  const tile = document.createElement('canvas');
  tile.width = 64;
  tile.height = 64;
  const ctx = tile.getContext('2d')!;
  const image = ctx.createImageData(64, 64);
  for (let index = 0; index < image.data.length; index += 4) {
    const value = Math.floor(Math.random() * 256);
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    image.data[index + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  noiseTileCache = tile;
  return tile;
}

function blurredCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, sourceWidth: number, sourceHeight: number, w: number, h: number) {
  const small = document.createElement('canvas');
  small.width = Math.max(16, Math.round(w / 18));
  small.height = Math.max(16, Math.round(h / 18));
  const sctx = small.getContext('2d')!;
  const scale = Math.max(small.width / sourceWidth, small.height / sourceHeight);
  sctx.drawImage(img, (small.width - sourceWidth * scale) / 2, (small.height - sourceHeight * scale) / 2, sourceWidth * scale, sourceHeight * scale);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, small.width, small.height, 0, 0, w, h);
  ctx.fillStyle = 'rgba(8, 10, 16, .42)';
  ctx.fillRect(0, 0, w, h);
}

async function drawTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer, w: number, h: number, canvas: HTMLCanvasElement, animation: { type: TextAnimation; in: number; out: number }) {
  const animIn = animation.type === 'none' ? 1 : clamp(animation.in, 0, 1);
  const animOut = animation.type === 'none' ? 1 : clamp(animation.out, 0, 1);
  const animAlpha = Math.min(animIn, animOut);
  const unitForAnimation = Math.min(w, h);
  let text = layoutTextBlock(layer, w, h);
  if (!text.hasText) return;
  await document.fonts.load(text.titleFont, layer.title.slice(0, 40) || 'Aa').catch(() => {});
  await document.fonts.load(text.subtitleFont, layer.subtitle.slice(0, 40) || 'Aa').catch(() => {});
  text = layoutTextBlock(layer, w, h);
  const unit = Math.min(w, h);
  const effectScale = unit / 1080;
  const opacity = text.opacity * animAlpha;
  const letterSpacing = layer.letterSpacing * unit;
  const lineX = (lineWidth: number) => text.align === 'center'
    ? text.boxLeft + (text.boxWidth - lineWidth) / 2
    : text.align === 'right'
      ? text.boxLeft + text.boxWidth - lineWidth
      : text.boxLeft;
  ctx.save();
  ctx.globalAlpha = animAlpha;
  const centerX = text.boxLeft + text.boxWidth / 2;
  const centerY = text.boxTop + text.blockHeight / 2;
  let offsetX = 0, offsetY = 0, animScale = 1;
  if (animation.type === 'slide-up') offsetY = (1 - animIn) * unitForAnimation * .055 - (1 - animOut) * unitForAnimation * .055;
  if (animation.type === 'slide-left') offsetX = (1 - animIn) * unitForAnimation * .055 - (1 - animOut) * unitForAnimation * .055;
  if (animation.type === 'pop') animScale = (.9 + .1 * animIn) * (.97 + .03 * animOut);
  ctx.translate(centerX + offsetX, centerY + offsetY);
  ctx.rotate((text.rotation * Math.PI) / 180);
  ctx.scale(animScale, animScale);
  ctx.translate(-centerX, -centerY);

  if (layer.backdropEnabled && text.blockWidth > 0 && text.blockHeight > 0) {
    const padding = Math.max(0, layer.backdropPadding * effectScale);
    const radius = Math.max(0, layer.backdropRadius * effectScale);
    const blur = Math.max(0, layer.backdropBlur);
    const backdropOpacity = clamp(layer.backdropOpacity, 0, 100) / 100;
    const noise = clamp(layer.backdropNoise, 0, 100) / 100;
    const bx = Math.max(0, text.blockLeft - padding);
    const by = Math.max(0, text.boxTop - padding);
    const bw = Math.max(1, Math.min(w - bx, text.blockWidth + padding * 2));
    const bh = Math.max(1, Math.min(h - by, text.blockHeight + padding * 2));
    ctx.save();
    roundedRectPath(ctx, bx, by, bw, bh, radius);
    ctx.clip();
    if (blur > 0 && text.rotation === 0) {
      const factor = Math.max(0.08, Math.min(1, 1 / (1 + blur / 10)));
      const small = document.createElement('canvas');
      small.width = Math.max(1, Math.round(bw * factor));
      small.height = Math.max(1, Math.round(bh * factor));
      const smallCtx = small.getContext('2d')!;
      smallCtx.drawImage(canvas, bx, by, bw, bh, 0, 0, small.width, small.height);
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = animAlpha;
      ctx.drawImage(small, 0, 0, small.width, small.height, bx, by, bw, bh);
    }
    if (backdropOpacity > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'color';
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = layer.backdropColor;
      ctx.fillRect(bx, by, bw, bh);
      ctx.restore();
      ctx.globalAlpha = backdropOpacity * animAlpha;
      ctx.fillStyle = layer.backdropColor;
      ctx.fillRect(bx, by, bw, bh);
      ctx.globalAlpha = 1;
    }
    if (noise > 0) {
      const pattern = ctx.createPattern(noiseTile(), 'repeat');
      if (pattern) {
        ctx.globalAlpha = noise * 0.22;
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = pattern;
        ctx.fillRect(bx, by, bw, bh);
      }
    }
    ctx.restore();
  }

  const strokeWidth = Math.max(0, layer.strokeWidth) * effectScale;
  const shadowIntensity = clamp(layer.shadowIntensity, 0, 100) / 100;
  const shadowBlur = Math.max(0, layer.shadowBlur) * effectScale;
  const shadowX = layer.shadowOffsetX * effectScale;
  const shadowY = layer.shadowOffsetY * effectScale;
  const glowBlur = Math.max(0, layer.glowBlur) * effectScale;
  const glowIntensity = clamp(layer.glowIntensity, 0, 100) / 100;
  const paintText = (line: { text: string; width: number }, y: number, font: string, size: number) => {
    if (!line.text) return;
    const x = lineX(line.width);
    const fontScale = size / Math.max(1, text.titleSize);
    ctx.font = font;
    applyLetterSpacing(ctx, letterSpacing);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = layer.color;
    const fontGlowBlur = glowBlur * fontScale;
    if (layer.shadowEnabled && (shadowBlur > 0 || shadowX !== 0 || shadowY !== 0)) {
      ctx.save();
      ctx.shadowColor = layer.shadowColor;
      ctx.shadowBlur = shadowBlur * fontScale;
      ctx.shadowOffsetX = shadowX * fontScale;
      ctx.shadowOffsetY = shadowY * fontScale;
      ctx.globalAlpha = opacity * shadowIntensity;
      ctx.fillText(line.text, x, y);
      ctx.restore();
    }
    if (layer.glowEnabled && fontGlowBlur > 0 && glowIntensity > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = layer.glowColor;
      ctx.fillStyle = layer.glowColor;
      ctx.shadowBlur = fontGlowBlur * 1.6;
      ctx.globalAlpha = opacity * glowIntensity * 0.6;
      ctx.fillText(line.text, x, y);
      ctx.shadowBlur = fontGlowBlur;
      ctx.globalAlpha = opacity * glowIntensity * 0.65;
      ctx.fillText(line.text, x, y);
      ctx.shadowBlur = fontGlowBlur * 0.5;
      ctx.globalAlpha = opacity * glowIntensity * 0.45;
      ctx.fillText(line.text, x, y);
      ctx.restore();
    }
    if (layer.outlineEnabled && strokeWidth > 0) {
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.lineWidth = strokeWidth * fontScale;
      ctx.strokeStyle = layer.strokeColor;
      ctx.lineJoin = 'round';
      ctx.globalAlpha = opacity;
      ctx.strokeText(line.text, x, y);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = layer.color;
    ctx.fillText(line.text, x, y);
    ctx.restore();
  };
  let cursor = text.boxTop;
  for (const line of text.title) {
    paintText(line, cursor, text.titleFont, text.titleSize);
    cursor += text.titleLineHeight;
  }
  cursor += text.subtitleGap;
  for (const line of text.subtitle) {
    paintText(line, cursor, text.subtitleFont, text.subtitleSize);
    cursor += text.subtitleLineHeight;
  }
  ctx.restore();
}

export async function drawScene(canvas: HTMLCanvasElement, scene: Scene, aspect: Project['aspect'], quality: 'preview' | 'thumb' | 'export' = 'export', localSeconds = 0, timebase: Timebase = DEFAULT_TIMEBASE, size?: { width: number; height: number }, videoFrame?: HTMLVideoElement | null) {
  const [fullWidth, fullHeight] = size ? [size.width, size.height] : dimensions(aspect);
  const limit = quality === 'preview' ? 1280 : quality === 'thumb' ? 480 : Math.max(fullWidth, fullHeight);
  const scale = Math.min(1, limit / Math.max(fullWidth, fullHeight));
  const w = Math.max(1, Math.round(fullWidth * scale));
  const h = Math.max(1, Math.round(fullHeight * scale));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const usingVideo = Boolean(videoFrame && videoFrame.readyState >= 2 && videoFrame.videoWidth > 0);
  const img: CanvasImageSource = usingVideo
    ? videoFrame!
    : await loadImage(scene.mediaKind === 'video' ? (scene.videoPoster ?? scene.image) : scene.image);
  const sourceWidth = usingVideo ? videoFrame!.videoWidth : (img as HTMLImageElement).width;
  const sourceHeight = usingVideo ? videoFrame!.videoHeight : (img as HTMLImageElement).height;
  ctx.fillStyle = scene.framingBackground ?? '#000000';
  ctx.fillRect(0, 0, w, h);
  const zoom = Math.max(1, Math.min(4, scene.imageZoom ?? 1));
  const panX = Math.max(-1, Math.min(1, scene.imageX ?? 0));
  const panY = Math.max(-1, Math.min(1, scene.imageY ?? 0));
  let imageRect = { x: 0, y: 0, w, h };
  if (scene.fit === 'blur') {
    blurredCover(ctx, img, sourceWidth, sourceHeight, w, h);
    const containScale = Math.min(w / sourceWidth, h / sourceHeight) * zoom;
    const dw = sourceWidth * containScale, dh = sourceHeight * containScale;
    const overflowX = Math.max(0, dw - w) / 2, overflowY = Math.max(0, dh - h) / 2;
    imageRect = { x: (w - dw) / 2 - panX * overflowX, y: (h - dh) / 2 - panY * overflowY, w: dw, h: dh };
    ctx.drawImage(img, imageRect.x, imageRect.y, dw, dh);
  } else {
    const fitScale = (scene.fit === 'cover' ? Math.max : Math.min)(w / sourceWidth, h / sourceHeight) * zoom;
    const dw = sourceWidth * fitScale, dh = sourceHeight * fitScale;
    const overflowX = Math.max(0, dw - w) / 2, overflowY = Math.max(0, dh - h) / 2;
    imageRect = { x: (w - dw) / 2 - panX * overflowX, y: (h - dh) / 2 - panY * overflowY, w: dw, h: dh };
    ctx.drawImage(img, imageRect.x, imageRect.y, dw, dh);
  }
  if (hasColorGrade(scene)) {
    const gradeRect = scene.fit === 'contain' ? imageRect : { x: 0, y: 0, w, h };
    const x = Math.max(0, Math.round(gradeRect.x));
    const y = Math.max(0, Math.round(gradeRect.y));
    const gradeW = Math.max(1, Math.min(w - x, Math.round(gradeRect.w)));
    const gradeH = Math.max(1, Math.min(h - y, Math.round(gradeRect.h)));
    const imageData = ctx.getImageData(x, y, gradeW, gradeH);
    applyColorGrade(imageData.data, scene);
    ctx.putImageData(imageData, x, y);
  }
  for (const layer of scene.textLayers ?? []) {
    if (!layerVisibleAt(layer, localSeconds, timebase)) continue;
    const local = localSeconds - layerStartSeconds(layer, timebase);
    const remaining = layerDurationSeconds(layer, timebase) - local;
    const animationDuration = Math.max(.05, layer.animationDuration ?? .5);
    await drawTextLayer(ctx, layer, w, h, canvas, {
      type: layer.animation ?? 'none',
      in: local / animationDuration,
      out: remaining / animationDuration,
    });
  }
}

export async function drawTextOverlay(canvas: HTMLCanvasElement, scene: Scene, layerId: string, localSeconds: number, aspect: Project['aspect'], timebase: Timebase = DEFAULT_TIMEBASE, size?: { width: number; height: number }) {
  const [w, h] = size ? [size.width, size.height] : dimensions(aspect);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  const layer = (scene.textLayers ?? []).find(item => item.id === layerId);
  if (!layer || !layerVisibleAt(layer, localSeconds, timebase)) return;
  const local = localSeconds - layerStartSeconds(layer, timebase);
  const remaining = layerDurationSeconds(layer, timebase) - local;
  const animationDuration = Math.max(.05, layer.animationDuration ?? .5);
  await drawTextLayer(ctx, layer, w, h, canvas, {
    type: layer.animation ?? 'none',
    in: local / animationDuration,
    out: remaining / animationDuration,
  });
}

export async function drawTransition(canvas: HTMLCanvasElement, from: Scene, to: Scene, type: TransitionType, aspect: Project['aspect'], quality: 'preview' | 'thumb' | 'export', progress: number, fromLocalSeconds: number, toLocalSeconds: number, timebase: Timebase = DEFAULT_TIMEBASE, size?: { width: number; height: number }) {
  const fromCanvas = document.createElement('canvas');
  const toCanvas = document.createElement('canvas');
  await Promise.all([
    drawScene(fromCanvas, from, aspect, quality, fromLocalSeconds, timebase, size),
    drawScene(toCanvas, to, aspect, quality, toLocalSeconds, timebase, size),
  ]);
  canvas.width = fromCanvas.width;
  canvas.height = fromCanvas.height;
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  const p = clamp(progress, 0, 1);
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
  } else {
    ctx.drawImage(fromCanvas, 0, 0);
    ctx.save();
    ctx.globalAlpha = p;
    ctx.drawImage(toCanvas, 0, 0);
    ctx.restore();
  }
}

export function fadeOpacity(scene: Scene, time: number, timebase: Timebase = DEFAULT_TIMEBASE) {
  const fadeIn = Math.max(0, scene.fadeIn ?? 0);
  const fadeOut = Math.max(0, scene.fadeOut ?? 0);
  const duration = sceneSeconds(scene, timebase);
  const inAlpha = fadeIn > 0 ? clamp(time / fadeIn, 0, 1) : 1;
  const outAlpha = fadeOut > 0 ? clamp((duration - time) / fadeOut, 0, 1) : 1;
  return Math.min(inAlpha, outAlpha);
}

export function demoImage(index: number): string {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 1000; const ctx = c.getContext('2d')!;
  const palettes = [['#8eafaa', '#d3c4a7', '#546f68', '#203e39'], ['#94a8b9', '#f3cba5', '#788a8f', '#344d59'], ['#a7b4a2', '#e5d8b2', '#687956', '#344b38']];
  const p = palettes[index % palettes.length]; const g = ctx.createLinearGradient(0, 0, 0, 1000); g.addColorStop(0, p[0]); g.addColorStop(.6, p[1]); g.addColorStop(1, p[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, 1600, 1000);
  ctx.fillStyle = '#fff5d0'; ctx.beginPath(); ctx.arc(1140 - index * 240, 230, 76, 0, Math.PI * 2); ctx.fill();
  for (let layer = 0; layer < 4; layer++) { ctx.beginPath(); ctx.moveTo(0, 1000); for (let x = 0; x <= 1600; x += 10) { const y = 500 + layer * 125 - Math.sin(x / (180 + layer * 40) + index + layer * .8) * (110 - layer * 12) - Math.cos(x / 90 + layer) * 24; ctx.lineTo(x, y); } ctx.lineTo(1600, 1000); ctx.closePath(); ctx.fillStyle = layer < 2 ? p[2] : p[3]; ctx.globalAlpha = .5 + layer * .16; ctx.fill(); }
  ctx.globalAlpha = 1; return c.toDataURL('image/jpeg', .88);
}
export function demoScenes(): Scene[] { return ['A little further', 'Find your own pace', 'Stay for the view'].map((title, i) => ({ id: crypto.randomUUID(), startTicks: i * secondsToTicks(4), sourceInTicks: 0, name: ['Morning in the mountains', 'The scenic route', 'A quieter place'][i], image: demoImage(i), durationTicks: secondsToTicks(4), title, subtitle: i === 0 ? 'Small moments. Bigger stories.' : '', color: '#ffffff', fit: 'cover', speed: 1, pitch: true, filter: 'none', filterIntensity: 100 })); }
