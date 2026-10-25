import type { Scene, TextLayer, Timebase } from '../../stores/model';
import { DEFAULT_FONT_ID, DEFAULT_TEXT_LINE_HEIGHT, DEFAULT_TEXT_SIZE, DEFAULT_TEXT_SUBTITLE_SCALE, DEFAULT_TEXT_WEIGHT, DEFAULT_TEXT_WIDTH, DEFAULT_TEXT_X, DEFAULT_TEXT_Y } from './fonts';

export const MAX_TEXT_LAYERS = 8;

export const TEXT_LAYER_STYLE_DEFAULTS: Omit<TextLayer, 'id' | 'title' | 'subtitle' | 'startTicks' | 'durationTicks'> = {
  color: '#FFFFFF',
  x: DEFAULT_TEXT_X,
  y: DEFAULT_TEXT_Y,
  width: DEFAULT_TEXT_WIDTH,
  align: 'left',
  font: DEFAULT_FONT_ID,
  fontWeight: DEFAULT_TEXT_WEIGHT,
  fontStyle: 'normal',
  size: DEFAULT_TEXT_SIZE,
  lineHeight: DEFAULT_TEXT_LINE_HEIGHT,
  letterSpacing: 0,
  rotation: 0,
  opacity: 100,
  subtitleScale: DEFAULT_TEXT_SUBTITLE_SCALE,
  backdropEnabled: false,
  backdropColor: '#000000',
  backdropOpacity: 45,
  backdropBlur: 18,
  backdropPadding: 24,
  backdropRadius: 16,
  backdropNoise: 8,
  outlineEnabled: false,
  strokeColor: '#000000',
  strokeWidth: 0,
  shadowEnabled: false,
  shadowColor: '#000000',
  shadowIntensity: 60,
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  glowEnabled: false,
  glowColor: '#FFFFFF',
  glowBlur: 24,
  glowIntensity: 55,
  animation: 'none',
  animationDuration: .5,
};

export function createTextLayer(durationTicks: number, overrides: Partial<TextLayer> = {}): TextLayer {
  return {
    id: crypto.randomUUID(),
    title: 'Your text here',
    subtitle: '',
    startTicks: 0,
    durationTicks: Math.max(1, durationTicks),
    ...TEXT_LAYER_STYLE_DEFAULTS,
    ...overrides,
  };
}

export function legacyTextLayer(scene: Scene): TextLayer | null {
  if (!scene.title && !scene.subtitle) return null;
  const id = scene.id ? `${scene.id}-text` : 'text-1';
  return {
    id,
    title: scene.title ?? '',
    subtitle: scene.subtitle ?? '',
    startTicks: 0,
    durationTicks: Math.max(1, scene.durationTicks),
    color: scene.color || '#FFFFFF',
    x: scene.textX ?? DEFAULT_TEXT_X,
    y: scene.textY ?? DEFAULT_TEXT_Y,
    width: scene.textWidth ?? DEFAULT_TEXT_WIDTH,
    align: scene.textAlign ?? 'left',
    font: scene.textFont ?? DEFAULT_FONT_ID,
    fontWeight: scene.textFontWeight ?? DEFAULT_TEXT_WEIGHT,
    fontStyle: scene.textFontStyle ?? 'normal',
    size: scene.textSize ?? DEFAULT_TEXT_SIZE,
    lineHeight: scene.textLineHeight ?? DEFAULT_TEXT_LINE_HEIGHT,
    letterSpacing: scene.textLetterSpacing ?? 0,
    rotation: scene.textRotation ?? 0,
    opacity: scene.textOpacity ?? 100,
    subtitleScale: scene.textSubtitleScale ?? DEFAULT_TEXT_SUBTITLE_SCALE,
    backdropEnabled: scene.textBackdropEnabled ?? false,
    backdropColor: scene.textBackdropColor ?? '#000000',
    backdropOpacity: scene.textBackdropOpacity ?? 45,
    backdropBlur: scene.textBackdropBlur ?? 18,
    backdropPadding: scene.textBackdropPadding ?? 24,
    backdropRadius: scene.textBackdropRadius ?? 16,
    backdropNoise: scene.textBackdropNoise ?? 8,
    outlineEnabled: scene.textOutlineEnabled ?? false,
    strokeColor: scene.textStrokeColor ?? '#000000',
    strokeWidth: scene.textStrokeWidth ?? 0,
    shadowEnabled: scene.textShadowEnabled ?? false,
    shadowColor: scene.textShadowColor ?? '#000000',
    shadowIntensity: scene.textShadowIntensity ?? 60,
    shadowBlur: scene.textShadowBlur ?? 0,
    shadowOffsetX: scene.textShadowOffsetX ?? 0,
    shadowOffsetY: scene.textShadowOffsetY ?? 0,
    glowEnabled: scene.textGlowEnabled ?? false,
    glowColor: scene.textGlowColor ?? '#FFFFFF',
    glowBlur: scene.textGlowBlur ?? 24,
    glowIntensity: scene.textGlowIntensity ?? 55,
    animation: 'none',
    animationDuration: .5,
  };
}

export function sceneTextLayers(scene: Scene): TextLayer[] {
  return scene.textLayers ?? [];
}

export function sceneTextTitle(scene: Scene) {
  return sceneTextLayers(scene)[0]?.title ?? '';
}

export function layerStartSeconds(layer: TextLayer, timebase: Timebase) {
  return (layer.startTicks * timebase.numerator) / timebase.denominator;
}

export function layerDurationSeconds(layer: TextLayer, timebase: Timebase) {
  return (layer.durationTicks * timebase.numerator) / timebase.denominator;
}

export function layerVisibleAt(layer: TextLayer, localSeconds: number, timebase: Timebase, tolerance = 0.001) {
  const start = layerStartSeconds(layer, timebase);
  const end = start + layerDurationSeconds(layer, timebase);
  return localSeconds + tolerance >= start && localSeconds < end - tolerance * 0.5;
}

export function layerTimingLabel(layer: TextLayer, timebase: Timebase) {
  const start = layerStartSeconds(layer, timebase);
  const duration = layerDurationSeconds(layer, timebase);
  return `${start.toFixed(1)}–${(start + duration).toFixed(1)} s`;
}
