import type { FilterId, Scene } from '../../stores/model';

export type FilterPreset = {
  id: FilterId;
  label: string;
  description: string;
  brightness: number;
  contrast: number;
  saturate: number;
  sepia: number;
  grayscale: number;
  hue: number;
};

const NEUTRAL = { brightness: 1, contrast: 1, saturate: 1, sepia: 0, grayscale: 0, hue: 0 };

export const FILTERS: FilterPreset[] = [
  { id: 'none', label: 'Original', description: 'No look applied.', ...NEUTRAL },
  { id: 'vivid', label: 'Vivid', description: 'Punchier color and contrast.', ...NEUTRAL, brightness: 1.02, contrast: 1.08, saturate: 1.35 },
  { id: 'warm', label: 'Golden', description: 'Soft warmth for late-afternoon light.', ...NEUTRAL, brightness: 1.04, contrast: 1.02, saturate: 1.12, sepia: 0.16, hue: -4 },
  { id: 'cool', label: 'Coastal', description: 'Cool blues with calm contrast.', ...NEUTRAL, brightness: 0.99, contrast: 1.03, saturate: 0.92, hue: 8 },
  { id: 'mono', label: 'Mono', description: 'Neutral black and white.', ...NEUTRAL, contrast: 1.06, grayscale: 1 },
  { id: 'film', label: 'Film', description: 'Faded highlights and gentle grain-free contrast.', ...NEUTRAL, brightness: 1.03, contrast: 1.04, saturate: 0.86, sepia: 0.12 },
  { id: 'noir', label: 'Noir', description: 'Deep blacks and crisp highlights.', ...NEUTRAL, brightness: 0.92, contrast: 1.28, grayscale: 1 },
  { id: 'dream', label: 'Dream', description: 'Airy color with a soft pastel lift.', ...NEUTRAL, brightness: 1.08, contrast: 0.94, saturate: 1.16, sepia: 0.06, hue: 4 },
];

export const FILTER_BY_ID = new Map(FILTERS.map(filter => [filter.id, filter]));

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function filterLook(id: FilterId | undefined, intensity = 100) {
  const preset = FILTER_BY_ID.get(id ?? 'none') ?? FILTERS[0];
  const amount = clamp(intensity, 0, 100) / 100;
  return {
    brightness: 1 + (preset.brightness - 1) * amount,
    contrast: 1 + (preset.contrast - 1) * amount,
    saturate: 1 + (preset.saturate - 1) * amount,
    sepia: preset.sepia * amount,
    grayscale: preset.grayscale * amount,
    hue: preset.hue * amount,
  };
}

export function thumbnailFilterCss(id: FilterId, intensity = 100) {
  const look = filterLook(id, intensity);
  return `brightness(${look.brightness}) contrast(${look.contrast}) saturate(${look.saturate}) sepia(${look.sepia}) grayscale(${look.grayscale}) hue-rotate(${look.hue}deg)`;
}

type Matrix = [number, number, number, number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const SEPIA: Matrix = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131];
const GRAYSCALE: Matrix = [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722];

function multiply(a: Matrix, b: Matrix): Matrix {
  const out = new Array(9) as Matrix;
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      out[row * 3 + column] = a[row * 3] * b[column] + a[row * 3 + 1] * b[column + 3] + a[row * 3 + 2] * b[column + 6];
    }
  }
  return out;
}

function mix(base: Matrix, target: Matrix, amount: number): Matrix {
  const t = clamp(amount, 0, 1);
  return base.map((value, index) => value + (target[index] - value) * t) as Matrix;
}

function saturationMatrix(amount: number): Matrix {
  const lr = 0.2126, lg = 0.7152, lb = 0.0722;
  return [
    lr + (1 - lr) * amount, lg - lg * amount, lb - lb * amount,
    lr - lr * amount, lg + (1 - lg) * amount, lb - lb * amount,
    lr - lr * amount, lg - lg * amount, lb + (1 - lb) * amount,
  ];
}

function hueMatrix(degrees: number): Matrix {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  return [
    0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.140, 0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
  ];
}

export function hasColorGrade(scene: Scene) {
  return (scene.brightness ?? 1) !== 1
    || (scene.contrast ?? 1) !== 1
    || (scene.saturation ?? 1) !== 1
    || (scene.exposure ?? 0) !== 0
    || (scene.temperature ?? 0) !== 0
    || (scene.tint ?? 0) !== 0
    || (scene.highlights ?? 0) !== 0
    || (scene.shadows ?? 0) !== 0
    || ((scene.filter ?? 'none') !== 'none' && (scene.filterIntensity ?? 100) > 0);
}

/**
 * Applies the full grade to raw RGBA pixels. Kept independent of Canvas filters so
 * preview (Chromium/WebKit) and native still-frame export render identically.
 */
export function applyColorGrade(data: Uint8ClampedArray, scene: Scene) {
  if (!hasColorGrade(scene)) return;
  const look = filterLook(scene.filter, scene.filterIntensity ?? 100);
  const brightness = clamp((scene.brightness ?? 1) * 2 ** (scene.exposure ?? 0) * look.brightness, 0.05, 4);
  const contrast = clamp((scene.contrast ?? 1) * look.contrast, 0.05, 4);
  const saturation = clamp((scene.saturation ?? 1) * look.saturate, 0, 4);
  const lut = new Uint8ClampedArray(256);
  for (let value = 0; value < 256; value += 1) {
    let channel = value / 255;
    channel *= brightness;
    channel = (channel - 0.5) * contrast + 0.5;
    lut[value] = channel * 255;
  }
  let matrix = saturationMatrix(saturation);
  if (look.hue) matrix = multiply(hueMatrix(look.hue), matrix);
  if (look.sepia) matrix = multiply(mix(IDENTITY, SEPIA, look.sepia), matrix);
  if (look.grayscale) matrix = multiply(mix(IDENTITY, GRAYSCALE, look.grayscale), matrix);
  const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = matrix;
  const temperature = scene.temperature ?? 0;
  const tint = scene.tint ?? 0;
  const offsetR = (temperature * 0.12 + tint * 0.10) * 255;
  const offsetG = (temperature * 0.03 - tint * 0.08) * 255;
  const offsetB = (-temperature * 0.12 + tint * 0.10) * 255;
  const highlights = scene.highlights ?? 0;
  const shadows = scene.shadows ?? 0;
  const tone = highlights !== 0 || shadows !== 0;
  for (let index = 0; index < data.length; index += 4) {
    const r = lut[data[index]], g = lut[data[index + 1]], b = lut[data[index + 2]];
    let nr = m0 * r + m1 * g + m2 * b + offsetR;
    let ng = m3 * r + m4 * g + m5 * b + offsetG;
    let nb = m6 * r + m7 * g + m8 * b + offsetB;
    if (tone) {
      const luma = (nr * 0.2126 + ng * 0.7152 + nb * 0.0722) / 255;
      const highlightWeight = Math.max(0, luma - 0.5) * 2;
      const shadowWeight = Math.max(0, 0.5 - luma) * 2;
      const lift = (highlights * highlightWeight * 0.25 + shadows * shadowWeight * 0.25) * 255;
      nr += lift; ng += lift; nb += lift;
    }
    data[index] = nr;
    data[index + 1] = ng;
    data[index + 2] = nb;
  }
}

/**
 * Bakes the exact preview grade into a 3D lookup table for FFmpeg.
 * The lattice is graded by the same pipeline as the canvas compositor, so a
 * graded video exports with the same colours it shows in the viewer.
 * Returns null when the scene has no grade, so neutral clips skip the filter.
 */
export function gradeLutCube(scene: Scene, size = 33): string | null {
  if (!hasColorGrade(scene)) return null;
  const points = size * size * size;
  if (!Number.isInteger(size) || size < 2 || size > 65 || points > 274_625) throw new Error('Invalid grade LUT size.');
  const grid = new Uint8ClampedArray(points * 4);
  let cursor = 0;
  for (let b = 0; b < size; b += 1) {
    for (let g = 0; g < size; g += 1) {
      for (let r = 0; r < size; r += 1) {
        grid[cursor] = Math.round((r / (size - 1)) * 255);
        grid[cursor + 1] = Math.round((g / (size - 1)) * 255);
        grid[cursor + 2] = Math.round((b / (size - 1)) * 255);
        grid[cursor + 3] = 255;
        cursor += 4;
      }
    }
  }
  applyColorGrade(grid, scene);
  const lines = ['# PixCut grade LUT', `LUT_3D_SIZE ${size}`, 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1'];
  for (let index = 0; index < grid.length; index += 4) {
    lines.push(`${(grid[index] / 255).toFixed(6)} ${(grid[index + 1] / 255).toFixed(6)} ${(grid[index + 2] / 255).toFixed(6)}`);
  }
  return `${lines.join('\n')}\n`;
}

