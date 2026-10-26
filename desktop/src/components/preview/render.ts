import { textDirection } from '../text/language';
import { drawDesignerElement, prepareDesignerFonts } from '../elements/designer';
import { drawCardElement } from '../elements/cards';
import { waveformBars } from '../elements/dynamic';
import { drawModernElement } from '../elements/modern';
import { framingTravel } from './framing';
import { applyMaskAlpha } from './mask';
import { elementTransform } from '../elements/transform';
import { applyElementMotion, applyTextMotion, framingAt } from '../animation/keyframes';
import { resolveMediaSource } from './media-url';
import { overlayVideoFrame } from './overlay-video';
import { drawElementSymbol, ELEMENT_LABEL_DEFAULTS, elementForeground } from '../elements/symbols';
import { DEFAULT_TIMEBASE, sceneSeconds, secondsToTicks, ticksToSeconds, type AudioClip, type ElementLayer, type Project, type Scene, type TextAnimation, type TextLayer, type Timebase, type TransitionType } from '../../stores/model';
import { layerDurationSeconds, layerStartSeconds, layerVisibleAt } from '../text/layers';
import { sceneStack } from '../elements/stack';
import { clampWeight, fontFamily } from '../text/fonts';
import { applyColorGrade, clamp, hasColorGrade } from './filters';
import { WeightedLru } from './image-cache';

type CachedImage = { promise: Promise<HTMLImageElement> };
// Decoded photos are the largest thing the compositor holds. The budget keeps
// a long photo story from re-decoding the same files every frame while still
// letting large 4K projects release memory.
const IMAGE_CACHE_ENTRIES = 48;
const IMAGE_CACHE_BYTES = 256 * 1024 * 1024;
const MISSING_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const imageCache = new WeightedLru<CachedImage>(IMAGE_CACHE_ENTRIES, IMAGE_CACHE_BYTES);

export function dimensions(aspect: Project['aspect']): [number, number] { return aspect === '9:16' ? [1080, 1920] : aspect === '4:5' ? [1080, 1350] : aspect === '1:1' ? [1080, 1080] : [1920, 1080]; }

function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (typeof img.decode === 'function') img.decode().then(() => resolve(img), () => resolve(img));
      else resolve(img);
    };
    img.onerror = () => reject(new Error('An image could not be decoded. Try a PNG, JPEG, or WebP file.'));
    img.src = src;
  });
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  if (!src) throw new Error('An image is missing from this project. Replace the photo to continue.');
  const cached = imageCache.get(src);
  if (cached) return cached.promise;
  // Streamed media references resolve to the asset protocol on native; an
  // unresolved reference is drawn as an empty frame while relinking is offered.
  const resolved = src.startsWith('pixcut-asset:') ? await resolveMediaSource(src) : src;
  const entry: CachedImage = { promise: decodeImage(resolved ?? MISSING_IMAGE) };
  imageCache.set(src, entry, 0);
  entry.promise.then(img => {
    const width = img.naturalWidth || img.width || 0;
    const height = img.naturalHeight || img.height || 0;
    imageCache.weigh(src, width * height * 4);
  }, () => { imageCache.delete(src); });
  return entry.promise;
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
  // Keep the text block inside the canvas even when a template or an older
  // project stores a generous x/width pair.
  const boxLeft = Math.max(0, Math.min(width - 1, width * layer.x));
  const rawTop = height * layer.y;
  const boxWidth = Math.max(1, Math.min(width - boxLeft, width * layer.width));
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
  const boxTop = Math.max(0, Math.min(rawTop, height - blockHeight));
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
  small.width = Math.max(32, Math.round(w / 6));
  small.height = Math.max(32, Math.round(h / 6));
  const sctx = small.getContext('2d')!;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  const scale = Math.max(small.width / sourceWidth, small.height / sourceHeight) * 1.04;
  sctx.drawImage(img, (small.width - sourceWidth * scale) / 2, (small.height - sourceHeight * scale) / 2, sourceWidth * scale, sourceHeight * scale);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const soft = Math.max(2, Math.min(10, Math.min(w, h) * .004));
  try { ctx.filter = `blur(${soft}px)`; } catch { /* canvas filter is optional */ }
  ctx.drawImage(small, -soft, -soft, w + soft * 2, h + soft * 2);
  ctx.restore();
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

function drawStar(ctx: CanvasRenderingContext2D, points: number, outer: number, inner: number) {
  ctx.beginPath();
  for (let index = 0; index < points * 2; index++) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + index * Math.PI / points;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function elementRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

function elementLabel(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxHeight: number, color = '#FFFFFF', x = 0) {
  let size = Math.max(5, maxHeight * .42);
  ctx.font = `700 ${size}px Inter, system-ui, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > 4) {
    size -= .5;
    ctx.font = `700 ${size}px Inter, system-ui, sans-serif`;
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, 0);
}

function drawElementShape(ctx: CanvasRenderingContext2D, element: ElementLayer, w: number, h: number, alpha: number, scale: number, offsetY: number, offsetX = 0, rotation = 0, localSeconds = 0, bars: number[] = []) {
  const bw = Math.max(2, element.width * w);
  const bh = Math.max(2, element.height * h);
  ctx.save();
  ctx.translate(element.x * w + offsetX, element.y * h + offsetY);
  ctx.rotate((element.rotation + rotation) * Math.PI / 180);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.direction = textDirection(element.label ?? '');
  ctx.fillStyle = element.color;
  if (drawDesignerElement(ctx, element, bw, bh, localSeconds, bars) || drawCardElement(ctx, element, bw, bh, localSeconds, bars) || drawModernElement(ctx, element, bw, bh)) { ctx.restore(); return; }
  switch (element.kind) {
    case 'burst':
      ctx.beginPath();
      for (let i = 0; i < 32; i++) {
        const angle = i * Math.PI / 16 - Math.PI / 2;
        const radius = i % 2 ? .32 : .5;
        const x = Math.cos(angle) * bw * radius, y = Math.sin(angle) * bh * radius;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
      break;
    case 'frame':
      ctx.strokeStyle = element.color; ctx.lineWidth = Math.min(bw, bh) * .035;
      ctx.beginPath();
      for (const [x, y, dx, dy] of [[-1, -1, 1, 1], [1, -1, -1, 1], [-1, 1, 1, -1], [1, 1, -1, -1]]) {
        ctx.moveTo(x * bw / 2 + dx * bw * .22, y * bh / 2);
        ctx.lineTo(x * bw / 2, y * bh / 2); ctx.lineTo(x * bw / 2, y * bh / 2 + dy * bh * .22);
      }
      ctx.stroke();
      break;
    case 'dots':
      for (let row = 0; row < 4; row++) for (let column = 0; column < 6; column++) {
        ctx.beginPath(); ctx.ellipse((column - 2.5) * bw / 6, (row - 1.5) * bh / 4, bw * .025, bh * .0375, 0, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'tape':
      ctx.beginPath(); ctx.moveTo(-bw / 2, -bh * .32);
      for (let i = 0; i <= 12; i++) ctx.lineTo(-bw / 2 + bw * i / 12, -bh * (i % 2 ? .42 : .32));
      for (let i = 12; i >= 0; i--) ctx.lineTo(-bw / 2 + bw * i / 12, bh * (i % 2 ? .42 : .32));
      ctx.closePath(); ctx.fill();
      break;
    case 'chevron':
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * bw * .31;
        ctx.beginPath(); ctx.moveTo(x - bw * .14, -bh * .4); ctx.lineTo(x + bw * .06, -bh * .4);
        ctx.lineTo(x + bw * .23, 0); ctx.lineTo(x + bw * .06, bh * .4); ctx.lineTo(x - bw * .14, bh * .4); ctx.lineTo(x + bw * .03, 0); ctx.closePath(); ctx.fill();
      }
      break;
    case 'subscribe':
    case 'like': {
      const label = element.label ?? ELEMENT_LABEL_DEFAULTS[element.kind] ?? '';
      const foreground = elementForeground(element.color);
      elementRoundRect(ctx, -bw / 2, -bh / 2, bw, bh, Math.min(bh * .23, bw * .12));
      const showIcon = !label || bw / bh >= 2.8;
      const iconSize = Math.min(bh * .58, bw * .22);
      if (showIcon) drawElementSymbol(ctx, element.kind, label ? -bw / 2 + bh * .5 : 0, 0, iconSize, foreground);
      if (label) {
        const labelLeft = showIcon ? -bw / 2 + bh * .95 : -bw * .42;
        const labelRight = showIcon ? bw / 2 - bh * .2 : bw * .42;
        elementLabel(ctx, label, Math.max(1, labelRight - labelLeft), bh * .85, foreground, (labelLeft + labelRight) / 2);
      }
      break;
    }
    case 'bell': case 'comment': case 'share': case 'play':
    case 'location': case 'music': case 'check': case 'cross': case 'cursor':
      drawElementSymbol(ctx, element.kind, 0, 0, Math.min(bw, bh) * .88, element.color);
      break;
    case 'progress':
      elementRoundRect(ctx, -bw / 2, -bh * .14, bw, bh * .28, bh * .14);
      ctx.globalAlpha = alpha * .35;
      ctx.fillStyle = '#FFFFFF';
      elementRoundRect(ctx, -bw / 2, -bh * .14, bw, bh * .28, bh * .14);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = element.color;
      elementRoundRect(ctx, -bw / 2, -bh * .14, bw * .66, bh * .28, bh * .14);
      ctx.beginPath();
      ctx.arc(bw * .16, 0, bh * .2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'ring':
      ctx.strokeStyle = element.color;
      ctx.lineWidth = Math.max(2, Math.min(bw, bh) * .1);
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(bw, bh) * .4, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'underline':
      elementRoundRect(ctx, -bw / 2, -bh * .12, bw, Math.max(3, bh * .24), bh * .12);
      break;
    case 'rectangle':
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(-bw / 2, -bh / 2, bw, bh, Math.min(bw, bh) * .08);
        ctx.fill();
      } else ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      break;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(0, 0, bw / 2, bh / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(0, -bh / 2);
      ctx.lineTo(bw / 2, bh / 2);
      ctx.lineTo(-bw / 2, bh / 2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'star':
      drawStar(ctx, 5, Math.min(bw, bh) / 2, Math.min(bw, bh) / 4.6);
      break;
    case 'sparkle':
      drawStar(ctx, 4, Math.min(bw, bh) / 2, Math.min(bw, bh) / 6);
      break;
    case 'line':
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(-bw / 2, -bh / 4, bw, Math.max(2, bh / 2), bh / 4);
        ctx.fill();
      } else ctx.fillRect(-bw / 2, -bh / 4, bw, Math.max(2, bh / 2));
      break;
    case 'arrow': {
      const thickness = Math.max(2, bh / 3);
      ctx.fillRect(-bw / 2, -thickness / 2, bw * .72, thickness);
      ctx.beginPath();
      ctx.moveTo(bw / 2, 0);
      ctx.lineTo(bw * .68, -bh / 2);
      ctx.lineTo(bw * .68, bh / 2);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'heart': {
      const top = -bh * .18;
      ctx.beginPath();
      ctx.moveTo(0, bh / 2);
      ctx.bezierCurveTo(-bw * .62, -bh * .05, -bw * .42, -bh * .55, 0, top);
      ctx.bezierCurveTo(bw * .42, -bh * .55, bw * .62, -bh * .05, 0, bh / 2);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

function elementVisibleAt(element: ElementLayer, localSeconds: number, timebase: Timebase) {
  const start = ticksToSeconds(element.startTicks, timebase);
  const duration = ticksToSeconds(element.durationTicks, timebase);
  return localSeconds >= start && localSeconds < start + duration;
}

async function drawMediaOrShape(ctx: CanvasRenderingContext2D, raw: ElementLayer, w: number, h: number, local: number, precise: boolean, timebase: Timebase = DEFAULT_TIMEBASE, audio: AudioClip[] = [], projectSeconds = local, sample = false) {
  // Keyframes replace the layer's geometry before the entrance/exit motion is
  // combined with it, so preview, still frames and exported overlay frames agree.
  if (raw.presetId) await prepareDesignerFonts(raw.label);
  const element = raw.keyframes?.length ? applyElementMotion(raw, local) : raw;
  const motion = elementTransform(element, local, timebase);
  if (element.kind !== 'image' && element.kind !== 'video') {
    const bars = element.kind === 'waveform' ? sample ? Array.from({ length: 32 }, (_, i) => .12 + .65 * Math.abs(Math.sin(i * .63 + local * 6)) * Math.abs(Math.cos(i * .19 - local * 3))) : await waveformBars(element, projectSeconds, audio, timebase) : [];
    drawElementShape(ctx, element, w, h, element.opacity / 100 * motion.alpha, motion.scale, motion.y * h, motion.x * w, motion.rotation, local, bars);
    return;
  }
  if (!element.source) throw new Error('This overlay is missing its local media. Import the file again.');
  if (element.source.startsWith('pixcut-asset:')) return;
  const source = element.kind === 'video' ? await overlayVideoFrame(element.source, (element.sourceInSeconds ?? 0) + local, precise) : await loadImage(element.source);
  const drawWidth = Math.max(1, Math.round(element.width * w));
  const drawHeight = Math.max(1, Math.round(element.height * h));
  let painted: CanvasImageSource = source;
  if (element.mask) {
    // The mask is baked into the overlay's own alpha so preview, still frames
    // and exported overlay PNGs all use exactly the same cutout.
    const layer = document.createElement('canvas');
    layer.width = drawWidth;
    layer.height = drawHeight;
    const layerContext = layer.getContext('2d');
    if (layerContext) {
      layerContext.drawImage(source, 0, 0, drawWidth, drawHeight);
      applyMaskAlpha(layer, element.mask);
      painted = layer;
    }
  }
  ctx.save(); ctx.translate((element.x + motion.x) * w, (element.y + motion.y) * h);
  ctx.rotate((element.rotation + motion.rotation) * Math.PI / 180); ctx.scale(motion.scale, motion.scale);
  ctx.globalAlpha = element.opacity / 100 * motion.alpha;
  ctx.drawImage(painted, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight); ctx.restore();
}

async function drawElements(ctx: CanvasRenderingContext2D, scene: Scene, w: number, h: number, localSeconds: number, timebase: Timebase, precise: boolean, audio: AudioClip[] = [], projectOffset = 0) {
  for (const element of scene.elements ?? []) {
    if (!elementVisibleAt(element, localSeconds, timebase)) continue;
    const local = localSeconds - ticksToSeconds(element.startTicks, timebase);
    await drawMediaOrShape(ctx, element, w, h, local, precise, timebase, audio, projectOffset + localSeconds);
  }
}

/**
 * Draws scene elements, text layers and project overlays together in stack
 * order, so a text layer can sit above a video overlay (and the other way
 * round). Layers without an explicit `z` keep the classic order.
 */
async function drawStack(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, scene: Scene, overlays: ElementLayer[], w: number, h: number, localSeconds: number, projectSeconds: number, timebase: Timebase, precise: boolean, audio: AudioClip[]) {
  const projectOffset = ticksToSeconds(scene.startTicks, timebase);
  for (const entry of sceneStack(scene, overlays)) {
    if (entry.kind === 'overlay') {
      if (!elementVisibleAt(entry.layer, projectSeconds, timebase)) continue;
      const local = projectSeconds - ticksToSeconds(entry.layer.startTicks, timebase);
      await drawMediaOrShape(ctx, entry.layer, w, h, local, precise, timebase, audio, projectSeconds);
    } else if (entry.kind === 'element') {
      if (!elementVisibleAt(entry.layer, localSeconds, timebase)) continue;
      const local = localSeconds - ticksToSeconds(entry.layer.startTicks, timebase);
      await drawMediaOrShape(ctx, entry.layer, w, h, local, precise, timebase, audio, projectOffset + localSeconds);
    } else {
      const stored = entry.layer;
      if (!layerVisibleAt(stored, localSeconds, timebase)) continue;
      const local = localSeconds - layerStartSeconds(stored, timebase);
      const layer = stored.keyframes?.length ? applyTextMotion(stored, local) : stored;
      const remaining = layerDurationSeconds(stored, timebase) - local;
      const animationDuration = Math.max(.05, layer.animationDuration ?? .5);
      await drawTextLayer(ctx, layer, w, h, canvas, {
        type: layer.animation ?? 'none',
        in: local / animationDuration,
        out: remaining / animationDuration,
      });
    }
  }
}

export async function drawScene(canvas: HTMLCanvasElement, scene: Scene, aspect: Project['aspect'], quality: 'preview' | 'thumb' | 'export' = 'export', localSeconds = 0, timebase: Timebase = DEFAULT_TIMEBASE, size?: { width: number; height: number }, videoFrame?: HTMLVideoElement | null, audio: AudioClip[] = [], overlays: ElementLayer[] = [], projectSeconds = ticksToSeconds(scene.startTicks, timebase) + localSeconds) {
  const [fullWidth, fullHeight] = size ? [size.width, size.height] : dimensions(aspect);
  const limit = quality === 'preview' ? 1280 : quality === 'thumb' ? 480 : Math.max(fullWidth, fullHeight);
  const scale = Math.min(1, limit / Math.max(fullWidth, fullHeight));
  const w = Math.max(1, Math.round(fullWidth * scale));
  const h = Math.max(1, Math.round(fullHeight * scale));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  // A photo mask is applied to the photo layer only, leaving the framing
  // background visible outside it. Video scenes use overlay masks instead.
  const photoMask = scene.mediaKind === 'video' ? undefined : scene.mask;
  const photoCanvas = photoMask ? document.createElement('canvas') : null;
  if (photoCanvas) {
    photoCanvas.width = w;
    photoCanvas.height = h;
  }
  const paint = photoCanvas ? photoCanvas.getContext('2d', { willReadFrequently: true })! : ctx;
  const usingVideo = Boolean(videoFrame && videoFrame.readyState >= 2 && videoFrame.videoWidth > 0);
  const img: CanvasImageSource = usingVideo
    ? videoFrame!
    : await loadImage(scene.mediaKind === 'video' ? (scene.videoPoster ?? scene.image) : scene.image);
  const sourceWidth = usingVideo ? videoFrame!.videoWidth : (img as HTMLImageElement).width;
  const sourceHeight = usingVideo ? videoFrame!.videoHeight : (img as HTMLImageElement).height;
  ctx.fillStyle = scene.framingBackground ?? '#000000';
  ctx.fillRect(0, 0, w, h);
  const motion = scene.mediaKind === 'video' ? 'none' : (scene.motion ?? 'none');
  const motionAmount = Math.max(0, Math.min(.6, scene.motionAmount ?? .2));
  const motionProgress = clamp(localSeconds / Math.max(.001, sceneSeconds(scene, timebase)), 0, 1);
  let motionZoom = 1, motionX = 0, motionY = 0;
  if (motion === 'zoom-in') motionZoom = 1 + motionAmount * motionProgress;
  else if (motion === 'zoom-out') motionZoom = 1 + motionAmount * (1 - motionProgress);
  else if (motion === 'pan-left') motionX = motionAmount * (.5 - motionProgress) * 2;
  else if (motion === 'pan-right') motionX = motionAmount * (motionProgress - .5) * 2;
  else if (motion === 'pan-up') motionY = motionAmount * (.5 - motionProgress) * 2;
  else if (motion === 'pan-down') motionY = motionAmount * (motionProgress - .5) * 2;
  else if (motion === 'ken-burns') {
    motionZoom = 1 + motionAmount * motionProgress;
    motionX = motionAmount * .6 * (motionProgress - .5) * 2;
  }
  // Photo framing can be keyframed; video clips keep their static framing
  // because FFmpeg encodes their scale/crop rather than this canvas path.
  const framing = scene.mediaKind === 'video' ? { x: scene.imageX ?? 0, y: scene.imageY ?? 0, zoom: scene.imageZoom ?? 1 } : framingAt(scene, localSeconds);
  const zoom = Math.max(1, Math.min(4, framing.zoom * motionZoom));
  const panX = Math.max(-1, Math.min(1, framing.x + motionX));
  const panY = Math.max(-1, Math.min(1, framing.y + motionY));
  let imageRect = { x: 0, y: 0, w, h };
  if (scene.fit === 'blur') {
    blurredCover(paint, img, sourceWidth, sourceHeight, w, h);
    const containScale = Math.min(w / sourceWidth, h / sourceHeight) * zoom;
    const dw = sourceWidth * containScale, dh = sourceHeight * containScale;
    const travel = framingTravel({ width: sourceWidth, height: sourceHeight }, { width: w, height: h }, scene.fit, zoom);
    const overflowX = travel.x, overflowY = travel.y;
    imageRect = { x: (w - dw) / 2 - panX * overflowX, y: (h - dh) / 2 - panY * overflowY, w: dw, h: dh };
    paint.drawImage(img, imageRect.x, imageRect.y, dw, dh);
  } else {
    const fitScale = (scene.fit === 'cover' ? Math.max : Math.min)(w / sourceWidth, h / sourceHeight) * zoom;
    const dw = sourceWidth * fitScale, dh = sourceHeight * fitScale;
    const travel = framingTravel({ width: sourceWidth, height: sourceHeight }, { width: w, height: h }, scene.fit, zoom);
    const overflowX = travel.x, overflowY = travel.y;
    imageRect = { x: (w - dw) / 2 - panX * overflowX, y: (h - dh) / 2 - panY * overflowY, w: dw, h: dh };
    paint.drawImage(img, imageRect.x, imageRect.y, dw, dh);
  }
  if (hasColorGrade(scene)) {
    const gradeRect = scene.fit === 'contain' ? imageRect : { x: 0, y: 0, w, h };
    const x = Math.max(0, Math.round(gradeRect.x));
    const y = Math.max(0, Math.round(gradeRect.y));
    const gradeW = Math.max(1, Math.min(w - x, Math.round(gradeRect.w)));
    const gradeH = Math.max(1, Math.min(h - y, Math.round(gradeRect.h)));
    const imageData = paint.getImageData(x, y, gradeW, gradeH);
    applyColorGrade(imageData.data, scene);
    paint.putImageData(imageData, x, y);
  }
  if (photoCanvas && photoMask) {
    applyMaskAlpha(photoCanvas, photoMask);
    ctx.drawImage(photoCanvas, 0, 0);
  }
  await drawStack(ctx, canvas, scene, overlays, w, h, localSeconds, projectSeconds, timebase, quality !== 'preview', audio);
}

export async function drawElementOverlay(canvas: HTMLCanvasElement, scene: Scene, elementId: string, localSeconds: number, aspect: Project['aspect'], timebase: Timebase = DEFAULT_TIMEBASE, size?: { width: number; height: number }, audio: AudioClip[] = [], sample = false) {
  const [w, h] = size ? [size.width, size.height] : dimensions(aspect);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  const element = (scene.elements ?? []).find(item => item.id === elementId);
  if (!element || !elementVisibleAt(element, localSeconds, timebase)) return;
  const local = localSeconds - ticksToSeconds(element.startTicks, timebase);
  await drawMediaOrShape(ctx, element, w, h, local, true, timebase, audio, ticksToSeconds(scene.startTicks, timebase) + localSeconds, sample);
}

export async function drawTextOverlay(canvas: HTMLCanvasElement, scene: Scene, layerId: string, localSeconds: number, aspect: Project['aspect'], timebase: Timebase = DEFAULT_TIMEBASE, size?: { width: number; height: number }) {
  const [w, h] = size ? [size.width, size.height] : dimensions(aspect);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  const stored = (scene.textLayers ?? []).find(item => item.id === layerId);
  if (!stored || !layerVisibleAt(stored, localSeconds, timebase)) return;
  const local = localSeconds - layerStartSeconds(stored, timebase);
  const layer = stored.keyframes?.length ? applyTextMotion(stored, local) : stored;
  const remaining = layerDurationSeconds(layer, timebase) - local;
  const animationDuration = Math.max(.05, layer.animationDuration ?? .5);
  await drawTextLayer(ctx, layer, w, h, canvas, {
    type: layer.animation ?? 'none',
    in: local / animationDuration,
    out: remaining / animationDuration,
  });
}

export async function drawTransition(canvas: HTMLCanvasElement, from: Scene, to: Scene, type: TransitionType, aspect: Project['aspect'], quality: 'preview' | 'thumb' | 'export', progress: number, fromLocalSeconds: number, toLocalSeconds: number, timebase: Timebase = DEFAULT_TIMEBASE, size?: { width: number; height: number }, audio: AudioClip[] = [], fromFrame?: HTMLVideoElement | null, toFrame?: HTMLVideoElement | null) {
  const fromCanvas = document.createElement('canvas');
  const toCanvas = document.createElement('canvas');
  await Promise.all([
    drawScene(fromCanvas, from, aspect, quality, fromLocalSeconds, timebase, size, fromFrame, audio),
    drawScene(toCanvas, to, aspect, quality, toLocalSeconds, timebase, size, toFrame, audio),
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

export async function drawProjectOverlays(canvas: HTMLCanvasElement, elements: ElementLayer[], seconds: number, timebase: Timebase, precise = false, audio: AudioClip[] = []) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  await drawElements(ctx, { elements } as Scene, canvas.width, canvas.height, seconds, timebase, precise, audio);
}

/**
 * Draws only the layers that sit on top of the footage — scene elements, text
 * and project overlays — in stack order. Exports of video clips bake these into
 * a transparent frame series, so the order has to match the preview.
 */
export async function drawOverlayStack(canvas: HTMLCanvasElement, scene: Scene, overlays: ElementLayer[], size: { width: number; height: number }, localSeconds: number, projectSeconds: number, timebase: Timebase = DEFAULT_TIMEBASE, precise = true, audio: AudioClip[] = []) {
  canvas.width = Math.max(1, size.width);
  canvas.height = Math.max(1, size.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create the export canvas. Try a smaller output size.');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  await drawStack(ctx, canvas, scene, overlays, canvas.width, canvas.height, localSeconds, projectSeconds, timebase, precise, audio);
}
