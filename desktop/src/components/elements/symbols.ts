import type { ElementKind } from '../../stores/model';

// One set of vector paths for the library, canvas, and exported video.
const PATHS: Partial<Record<ElementKind, string[]>> = {
  like: ['M7 10v12H3V10z', 'M7 10l5-8a3 3 0 0 1 2 4l-1 4h7a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4'],
  comment: ['M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a9 9 0 1 1 17-5Z', 'M8 10h8M8 14h5'],
  share: ['M8 12l8-5M8 12l8 5', 'M8 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M22 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M22 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  location: ['M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z', 'M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  music: ['M9 18V5l12-3v14M9 8l12-3', 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0', 'M21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  check: ['M4 12l5 5L20 6'], cross: ['M6 6l12 12M18 6 6 18'],
  cursor: ['M4 3l7 18 3-7 7-3L4 3Z'],
  heart: ['M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z'],
  play: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', 'M10 8l6 4-6 4V8Z'],
  subscribe: ['M21 7c0-2-2-3-9-3S3 5 3 7v10c0 2 2 3 9 3s9-1 9-3V7Z', 'M10 8l6 4-6 4V8Z'],
};

export function drawElementSymbol(ctx: CanvasRenderingContext2D, kind: ElementKind, x: number, y: number, size: number, color: string): boolean {
  const paths = PATHS[kind];
  if (!paths) return false;
  ctx.save(); ctx.translate(x - size / 2, y - size / 2); ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const path of paths) ctx.stroke(new Path2D(path));
  ctx.restore(); return true;
}

export const ELEMENT_LABEL_DEFAULTS: Partial<Record<ElementKind, string>> = { caption: 'Make every moment count', chapter: '01\nGetting started', callout: 'Look closer', keycaps: '⌘ + K', device: 'Your content', comparison: 'Before\nAfter', checklist: 'Plan your story\nMake it yours\nShare the result', rating: 'Your review', countdown: 'READY?', waveform: 'AUDIO', message: 'Hello there!', qr: 'https://example.com', 'end-screen': 'Thanks for watching\nYour next story starts here', subscribe: 'Subscribe', like: 'Like', label: 'Behind the scenes', 'name-tag': 'Your name\nYour role', link: 'yourwebsite.com', quote: 'A moment worth keeping.', counter: '01', status: 'NEW' };
export function elementForeground(color: string): string {
  const parts = color.slice(1).match(/../g)?.map(value => parseInt(value, 16)) ?? [0, 0, 0];
  return parts[0] * .299 + parts[1] * .587 + parts[2] * .114 > 165 ? '#17171B' : '#FFFFFF';
}
