import type { ChromaKey } from '../../stores/model';

function hexRgb(value: string): [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : [0, 255, 0];
}

/** Normalised RGB distance from the key colour, 0–1. */
export function chromaDistance(r: number, g: number, b: number, color: string): number {
  const [kr, kg, kb] = hexRgb(color);
  return Math.min(1, Math.hypot(r - kr, g - kg, b - kb) / 441.6729559300637);
}

/** Alpha multiplier for one pixel; 0 is fully keyed, 255 is fully opaque. */
export function chromaAlpha(distance: number, similarity: number, softness: number): number {
  const center = Math.max(0, Math.min(1, similarity / 100));
  const width = Math.max(0, Math.min(1, softness / 100));
  const start = center - width / 2;
  const end = center + width / 2;
  if (distance <= start) return 0;
  if (distance >= end) return 255;
  const t = (distance - start) / Math.max(1e-6, end - start);
  return Math.round(t * t * (3 - 2 * t) * 255);
}

/** Bakes the colour key and spill suppression into a canvas's alpha/colour. */
export function applyChromaKey(canvas: HTMLCanvasElement, chroma: ChromaKey): HTMLCanvasElement {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context || canvas.width < 1 || canvas.height < 1) return canvas;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const [kr, kg, kb] = hexRgb(chroma.color);
  const keyChannel = kr >= kg && kr >= kb ? 0 : kg >= kb ? 1 : 2;
  const center = Math.max(0, Math.min(1, chroma.similarity / 100));
  const width = Math.max(0, Math.min(1, chroma.softness / 100));
  const spill = Math.max(0, Math.min(1, chroma.spill / 100));
  for (let index = 0; index < data.length; index += 4) {
    if (!data[index + 3]) continue;
    const r = data[index], g = data[index + 1], b = data[index + 2];
    const distance = Math.hypot(r - kr, g - kg, b - kb) / 441.6729559300637;
    const alpha = chromaAlpha(distance, chroma.similarity, chroma.softness);
    data[index + 3] = Math.round(data[index + 3] * alpha / 255);
    if (spill > 0 && distance < center + width / 2 + .08 && data[index + 3] > 0) {
      const channels = [r, g, b];
      const other = Math.max(channels[(keyChannel + 1) % 3], channels[(keyChannel + 2) % 3]);
      if (channels[keyChannel] > other) channels[keyChannel] = other + (channels[keyChannel] - other) * (1 - spill);
      data[index] = channels[0]; data[index + 1] = channels[1]; data[index + 2] = channels[2];
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}
