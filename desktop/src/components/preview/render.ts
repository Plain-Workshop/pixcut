import type { Project, Scene } from '../../stores/model';
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

function blurredCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const small = document.createElement('canvas');
  small.width = Math.max(16, Math.round(w / 18));
  small.height = Math.max(16, Math.round(h / 18));
  const sctx = small.getContext('2d')!;
  const scale = Math.max(small.width / img.width, small.height / img.height);
  sctx.drawImage(img, (small.width - img.width * scale) / 2, (small.height - img.height * scale) / 2, img.width * scale, img.height * scale);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, small.width, small.height, 0, 0, w, h);
  ctx.fillStyle = 'rgba(8, 10, 16, .42)';
  ctx.fillRect(0, 0, w, h);
}

export async function drawScene(canvas: HTMLCanvasElement, scene: Scene, aspect: Project['aspect'], quality: 'preview' | 'export' = 'export') {
  const [fullWidth, fullHeight] = dimensions(aspect);
  const scale = quality === 'preview' ? Math.min(1, 1280 / Math.max(fullWidth, fullHeight)) : 1;
  const w = Math.max(1, Math.round(fullWidth * scale));
  const h = Math.max(1, Math.round(fullHeight * scale));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = await loadImage(scene.image);
  ctx.fillStyle = '#101214'; ctx.fillRect(0, 0, w, h);
  let imageRect = { x: 0, y: 0, w, h };
  if (scene.fit === 'blur') {
    blurredCover(ctx, img, w, h);
    const containScale = Math.min(w / img.width, h / img.height);
    const dw = img.width * containScale, dh = img.height * containScale;
    imageRect = { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh };
    ctx.drawImage(img, imageRect.x, imageRect.y, dw, dh);
  } else {
    const fitScale = (scene.fit === 'cover' ? Math.max : Math.min)(w / img.width, h / img.height);
    const dw = img.width * fitScale, dh = img.height * fitScale;
    imageRect = { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh };
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
  if (scene.title || scene.subtitle) {
    const gradient = ctx.createLinearGradient(0, h * .35, 0, h); gradient.addColorStop(0, 'transparent'); gradient.addColorStop(1, '#000b'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    const unit = Math.min(w, h); const maxWidth = w * .82;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = scene.color;
    ctx.font = `600 ${Math.round(unit * .068)}px system-ui, sans-serif`;
    const lines = wrap(ctx, scene.title, maxWidth).slice(0, 5);
    const lineHeight = unit * .083; const subHeight = scene.subtitle ? unit * .05 : 0;
    let y = h - unit * .11 - lines.length * lineHeight - subHeight;
    lines.forEach(line => { ctx.fillText(line, w * .09, y, maxWidth); y += lineHeight; });
    ctx.font = `400 ${Math.round(unit * .027)}px system-ui, sans-serif`; ctx.fillText(scene.subtitle, w * .09, y + unit * .012, maxWidth);
  }
}

export function fadeOpacity(scene: Scene, time: number) {
  const fadeIn = Math.max(0, scene.fadeIn ?? 0);
  const fadeOut = Math.max(0, scene.fadeOut ?? 0);
  const inAlpha = fadeIn > 0 ? clamp(time / fadeIn, 0, 1) : 1;
  const outAlpha = fadeOut > 0 ? clamp((scene.duration - time) / fadeOut, 0, 1) : 1;
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
export function demoScenes(): Scene[] { return ['A little further', 'Find your own pace', 'Stay for the view'].map((title, i) => ({ id: crypto.randomUUID(), name: ['Morning in the mountains', 'The scenic route', 'A quieter place'][i], image: demoImage(i), duration: 4, title, subtitle: i === 0 ? 'Small moments. Bigger stories.' : '', color: '#ffffff', fit: 'cover', speed: 1, pitch: true, filter: 'none', filterIntensity: 100 })); }
