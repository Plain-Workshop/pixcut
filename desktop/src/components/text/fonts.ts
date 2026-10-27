export type FontOption = {
  id: string;
  label: string;
  family: string;
  category: 'Sans' | 'Serif' | 'Display' | 'Handwritten' | 'Custom';
  weights: number[];
  italic: boolean;
};

export const FONTS: FontOption[] = [
  { id: 'inter', label: 'Inter', family: "'Inter Variable', Inter, system-ui, sans-serif", category: 'Sans', weights: [300, 400, 500, 600, 700, 800, 900], italic: true },
  { id: 'space-grotesk', label: 'Space Grotesk', family: "'Space Grotesk Variable', Inter, system-ui, sans-serif", category: 'Sans', weights: [300, 400, 500, 600, 700], italic: false },
  { id: 'dm-sans', label: 'DM Sans', family: "'DM Sans Variable', Inter, system-ui, sans-serif", category: 'Sans', weights: [300, 400, 500, 600, 700, 800, 900], italic: true },
  { id: 'playfair', label: 'Playfair Display', family: "'Playfair Display Variable', Georgia, serif", category: 'Serif', weights: [400, 500, 600, 700, 800, 900], italic: true },
  { id: 'libre-baskerville', label: 'Libre Baskerville', family: "'Libre Baskerville', Georgia, serif", category: 'Serif', weights: [400, 700], italic: true },
  { id: 'bebas-neue', label: 'Bebas Neue', family: "'Bebas Neue', 'Arial Narrow', sans-serif", category: 'Display', weights: [400], italic: false },
  { id: 'archivo-black', label: 'Archivo Black', family: "'Archivo Black', 'Arial Black', sans-serif", category: 'Display', weights: [400], italic: false },
  { id: 'caveat', label: 'Caveat', family: "'Caveat Variable', 'Segoe Script', cursive", category: 'Handwritten', weights: [400, 500, 600, 700], italic: false },
];

export const FONT_CATEGORIES = ['All', 'Sans', 'Serif', 'Display', 'Handwritten', 'Custom'] as const;

export const DEFAULT_FONT_ID = 'inter';
export const DEFAULT_TEXT_SIZE = 0.068;
export const DEFAULT_TEXT_X = 0.09;
export const DEFAULT_TEXT_Y = 0.78;
export const DEFAULT_TEXT_WIDTH = 0.82;
export const DEFAULT_TEXT_WEIGHT = 600;
export const DEFAULT_TEXT_LINE_HEIGHT = 1.2;
export const DEFAULT_TEXT_SUBTITLE_SCALE = 0.4;

import type { ProjectFont } from '../../stores/model';

const customFonts = new Map<string, FontOption>();
const customFaces = new Map<string, FontFace>();
const customFontData = new Map<string, string>();

/** Bundled faces plus any fonts imported by the open project. */
export function allFonts(): FontOption[] {
  return [...FONTS, ...customFonts.values()];
}

/**
 * Registers a project's imported fonts with the document so CSS, the canvas and
 * exported frames can use them. Fonts dropped from the project are unregistered
 * again; a font that fails to load silently keeps the fallback stack.
 */
export function registerCustomFonts(fonts: ProjectFont[] | undefined, onLoaded?: () => void): void {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return;
  const byId = new Map((fonts ?? []).map(font => [font.id, font]));
  for (const [id, face] of [...customFaces]) {
    // A refreshed subset keeps its id but changes its bytes, so re-register it
    // instead of silently rendering the old face.
    const current = byId.get(id);
    if (current && customFontData.get(id) === current.data) continue;
    try { document.fonts.delete(face); } catch { /* a detached face is harmless */ }
    customFaces.delete(id);
    customFonts.delete(id);
    customFontData.delete(id);
  }
  for (const font of fonts ?? []) {
    if (customFaces.has(font.id)) continue;
    try {
      const family = `PixCut ${font.id.replace(/[^a-zA-Z0-9-]/g, '')}`;
      const face = new FontFace(family, `url(${font.data})`);
      document.fonts.add(face);
      customFaces.set(font.id, face);
      customFontData.set(font.id, font.data);
      customFonts.set(font.id, {
        id: font.id,
        label: font.name,
        family: `'${family}', Inter, system-ui, sans-serif`,
        category: 'Custom',
        weights: [300, 400, 500, 600, 700, 800, 900],
        italic: false,
      });
      void face.load().then(() => onLoaded?.(), () => { /* keep the fallback */ });
    } catch { /* unsupported font data keeps the fallback */ }
  }
}

export function fontOption(id: string | undefined) {
  return (id ? customFonts.get(id) : undefined) ?? FONTS.find(font => font.id === id) ?? FONTS[0];
}

export function fontFamily(id: string | undefined) {
  return fontOption(id).family;
}

export function fontWeights(id: string | undefined) {
  return fontOption(id).weights;
}

export function clampWeight(weight: number | undefined, id: string | undefined) {
  const weights = fontWeights(id);
  const target = weight ?? DEFAULT_TEXT_WEIGHT;
  return weights.reduce((best, value) => Math.abs(value - target) < Math.abs(best - target) ? value : best, weights[0]);
}
