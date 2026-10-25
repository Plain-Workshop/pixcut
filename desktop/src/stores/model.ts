import { MAX_TEXT_LAYERS, TEXT_LAYER_STYLE_DEFAULTS, legacyTextLayer } from '../components/text/layers';

export const FILTER_IDS = ['none', 'vivid', 'warm', 'cool', 'mono', 'film', 'noir', 'dream'] as const;
export type FilterId = typeof FILTER_IDS[number];
export type Timebase = { numerator: number; denominator: number };
export const DEFAULT_TIMEBASE: Timebase = { numerator: 1, denominator: 30 };
export const PROJECT_FRAME_RATES = [24, 25, 30, 60] as const;
export const timebaseFor = (fps: number): Timebase => ({ numerator: 1, denominator: PROJECT_FRAME_RATES.includes(fps as 24 | 25 | 30 | 60) ? fps : 30 });
export const secondsPerTick = (timebase: Timebase = DEFAULT_TIMEBASE) => timebase.numerator / timebase.denominator;
export const frameRate = (timebase: Timebase = DEFAULT_TIMEBASE) => timebase.denominator / timebase.numerator;
export const secondsToTicks = (seconds: number, timebase: Timebase = DEFAULT_TIMEBASE) => Math.round(seconds / secondsPerTick(timebase));
export const ticksToSeconds = (ticks: number, timebase: Timebase = DEFAULT_TIMEBASE) => ticks * secondsPerTick(timebase);
export const snapToTick = (seconds: number, timebase: Timebase = DEFAULT_TIMEBASE) => ticksToSeconds(secondsToTicks(seconds, timebase), timebase);
export const minTicks = (timebase: Timebase = DEFAULT_TIMEBASE) => Math.ceil(0.5 / secondsPerTick(timebase));
export const maxTicks = (timebase: Timebase = DEFAULT_TIMEBASE) => Math.floor(30 / secondsPerTick(timebase));
export const MAX_AUDIO_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_AUDIO_DATA_CHARS = 70_000_000;
export const MAX_PROJECT_AUDIO_CHARS = 280_000_000;
export const MAX_AUDIO_SECONDS = 3600;
export const sceneSeconds = (scene: Scene, timebase: Timebase = DEFAULT_TIMEBASE) => ticksToSeconds(scene.durationTicks, timebase);
export const setSceneSeconds = (scene: Scene, seconds: number, timebase: Timebase = DEFAULT_TIMEBASE): Scene => {
  const ticks = Math.min(maxTicks(timebase), Math.max(minTicks(timebase), secondsToTicks(seconds, timebase)));
  const duration = ticksToSeconds(ticks, timebase);
  return { ...scene, durationTicks: ticks, fadeIn: Math.min(scene.fadeIn ?? 0, duration), fadeOut: Math.min(scene.fadeOut ?? 0, duration) };
};
export type TransitionType = 'none' | 'fade' | 'slide' | 'wipe' | 'zoom';
export type Transition = { type: TransitionType; duration: number };
export type TextAnimation = 'none' | 'fade' | 'slide-up' | 'slide-left' | 'pop';
export type SceneFormatOverride = { imageX?: number; imageY?: number; imageZoom?: number; fit?: Scene['fit']; framingBackground?: string };
export type FormatQuality = 'draft' | 'standard' | 'high';
export type FormatVariant = { id: string; name: string; platform: string; aspect: string; width: number; height: number; fps: number; quality: FormatQuality; presetId?: string; overrides: Record<string, SceneFormatOverride> };
export type TextLayer = {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  startTicks: number;
  durationTicks: number;
  x: number;
  y: number;
  width: number;
  align: 'left' | 'center' | 'right';
  font: string;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  size: number;
  lineHeight: number;
  letterSpacing: number;
  rotation: number;
  opacity: number;
  subtitleScale: number;
  backdropEnabled: boolean;
  backdropColor: string;
  backdropOpacity: number;
  backdropBlur: number;
  backdropPadding: number;
  backdropRadius: number;
  backdropNoise: number;
  outlineEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowIntensity: number;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  glowEnabled: boolean;
  glowColor: string;
  glowBlur: number;
  glowIntensity: number;
  animation: TextAnimation;
  animationDuration: number;
};
export type Scene = {
  id: string;
  startTicks: number;
  sourceInTicks: number;
  durationTicks: number;
  name: string;
  image: string;
  mediaKind?: 'video';
  videoPoster?: string;
  title: string;
  subtitle: string;
  textLayers?: TextLayer[];
  transition?: Transition | null;
  color: string;
  fit: 'cover' | 'contain' | 'blur';
  imageX?: number;
  imageY?: number;
  imageZoom?: number;
  framingBackground?: string;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  exposure?: number;
  highlights?: number;
  shadows?: number;
  temperature?: number;
  tint?: number;
  filter?: FilterId;
  filterIntensity?: number;
  speed?: number;
  pitch?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  textBackdropEnabled?: boolean;
  textBackdropColor?: string;
  textBackdropOpacity?: number;
  textBackdropBlur?: number;
  textBackdropPadding?: number;
  textBackdropRadius?: number;
  textBackdropNoise?: number;
  textStrokeColor?: string;
  textOutlineEnabled?: boolean;
  textStrokeWidth?: number;
  textShadowColor?: string;
  textShadowEnabled?: boolean;
  textShadowIntensity?: number;
  textShadowBlur?: number;
  textShadowOffsetX?: number;
  textShadowOffsetY?: number;
  textGlowEnabled?: boolean;
  textGlowColor?: string;
  textGlowBlur?: number;
  textGlowIntensity?: number;
  textX?: number;
  textY?: number;
  textWidth?: number;
  textAlign?: 'left' | 'center' | 'right';
  textFont?: string;
  textFontWeight?: number;
  textFontStyle?: 'normal' | 'italic';
  textSize?: number;
  textLineHeight?: number;
  textLetterSpacing?: number;
  textRotation?: number;
  textOpacity?: number;
  textSubtitleScale?: number;
};
export type TrackKind = 'visual' | 'text' | 'audio';
export type Track = {
  id: string;
  kind: TrackKind;
  name: string;
  clips: Scene[];
  hidden?: boolean;
  muted?: boolean;
  locked?: boolean;
};
export type AudioClip = {
  id: string;
  name: string;
  data: string;
  lane: number;
  startTicks: number;
  durationTicks: number;
  sourceInSeconds: number;
  sourceDurationSeconds: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
};
type LegacyMusic = {
  id: string;
  name: string;
  data: string;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  durationSeconds: number;
};
export type Project = { schema_version: 7; id: string; name: string; aspect: '16:9' | '9:16' | '1:1' | '4:5'; timebase: Timebase; tracks: Track[]; audio: AudioClip[]; formats: FormatVariant[]; policy: { watermark: false; pixcut_outro: false; privacy: 'local' } };
export type Command =
  | { type: 'replace'; project: Project }
  | { type: 'rename'; name: string }
  | { type: 'aspect'; aspect: Project['aspect'] }
  | { type: 'audio'; audio: AudioClip[] }
  | { type: 'formats'; formats: FormatVariant[] }
  | { type: 'add'; scenes: Scene[] }
  | { type: 'update'; scene: Scene }
  | { type: 'remove'; id: string }
  | { type: 'move'; id: string; offset: number }
  | { type: 'duplicate'; id: string; newId: string }
  | { type: 'split'; id: string; atTicks: number; newId: string }
  | { type: 'updateMany'; scenes: Scene[] }
  | { type: 'removeMany'; ids: string[] }
  | { type: 'duplicateMany'; items: { id: string; newId: string }[] }
  | { type: 'undo' } | { type: 'redo' };
export type Session = { project: Project; canUndo: boolean; canRedo: boolean };
export const policy = { watermark: false, pixcut_outro: false, privacy: 'local' } as const;
export const emptyTrack = (kind: TrackKind = 'visual', name = 'Visuals'): Track => ({ id: crypto.randomUUID(), kind, name, clips: [] });
export const visualTrack = (project: Project) => project.tracks.find(track => track.kind === 'visual') ?? project.tracks[0];
export const projectScenes = (project: Project) => visualTrack(project)?.clips ?? [];
export function normalizeStarts(clips: Scene[]) {
  let cursor = 0;
  for (const clip of clips) {
    clip.startTicks = cursor;
    cursor += clip.durationTicks;
  }
}
export const defaultFormat = (aspect: Project['aspect'] = '16:9'): FormatVariant => { const [width, height] = aspect === '9:16' ? [1080, 1920] : aspect === '4:5' ? [1080, 1350] : aspect === '1:1' ? [1080, 1080] : [1920, 1080]; return { id: crypto.randomUUID(), name: 'Original', platform: 'Original', aspect, width, height, fps: 30, quality: 'standard', overrides: {} }; };
export const emptyProject = (name = 'Untitled story', aspect: Project['aspect'] = '16:9', fps = 30): Project => ({ schema_version: 7, id: crypto.randomUUID(), name, aspect, timebase: timebaseFor(fps), tracks: [emptyTrack()], audio: [], formats: [defaultFormat(aspect)], policy: { ...policy } });
export const totalTicks = (project: Project) => projectScenes(project).reduce((end, scene) => Math.max(end, scene.startTicks + scene.durationTicks), 0);
export const totalDuration = (project: Project) => ticksToSeconds(totalTicks(project), project.timebase);
const optionalNumber = (value: unknown, min: number, max: number) => value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max);
const optionalFilter = (value: unknown) => value === undefined || (typeof value === 'string' && (FILTER_IDS as readonly string[]).includes(value));
const optionalColor = (value: unknown) => value === undefined || (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value));
const AUDIO_DATA = /^data:audio\/(mpeg|mp3|wav|x-wav|mp4|aac|ogg|webm);base64,/;
const IMAGE_DATA = /^data:image\/(png|jpeg|webp);base64,/;
const VIDEO_DATA = /^data:video\/(mp4|webm|quicktime|x-m4v);base64,/;
const ASSET_REF = /^pixcut-asset:[0-9a-f]{64}$/;
function readNumber(value: unknown, min: number, max: number, fallback: number, label: string) {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${label}.`);
  return value;
}
function readBoolean(value: unknown, fallback: boolean, label: string) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new Error(`Invalid ${label}.`);
  return value;
}
function readTextColor(value: unknown, fallback: string, label: string) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value)) throw new Error(`Invalid ${label}.`);
  return value;
}
function readTextLayers(value: unknown, scene: Scene, durationTicks: number): TextLayer[] {
  if (value === undefined || (Array.isArray(value) && value.length === 0 && (scene.title || scene.subtitle))) {
    const legacy = legacyTextLayer({ ...scene, durationTicks });
    return legacy ? [legacy] : [];
  }
  if (!Array.isArray(value) || value.length > MAX_TEXT_LAYERS) throw new Error(`A scene supports up to ${MAX_TEXT_LAYERS} text layers.`);
  const ids = new Set<string>();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error('A text layer is missing its settings.');
    const layer = entry as Partial<TextLayer>;
    if (typeof layer.id !== 'string' || !layer.id || ids.has(layer.id)) throw new Error('A text layer has an invalid or duplicate ID.');
    ids.add(layer.id);
    if (typeof layer.title !== 'string' || layer.title.length > 120 || typeof layer.subtitle !== 'string' || layer.subtitle.length > 200) throw new Error('Text content is too long.');
    const start = Number.isInteger(layer.startTicks) ? Math.max(0, layer.startTicks as number) : 0;
    const startTicks = Math.min(start, Math.max(0, durationTicks - 1));
    const requested = Number.isInteger(layer.durationTicks) ? Math.max(1, layer.durationTicks as number) : durationTicks - startTicks;
    const duration = Math.max(1, Math.min(requested, durationTicks - startTicks));
    const defaults = TEXT_LAYER_STYLE_DEFAULTS;
    const align = layer.align ?? defaults.align;
    if (!['left', 'center', 'right'].includes(align)) throw new Error('A text layer has an invalid alignment.');
    const fontStyle = layer.fontStyle ?? defaults.fontStyle;
    if (!['normal', 'italic'].includes(fontStyle)) throw new Error('A text layer has an invalid font style.');
    const animation = layer.animation ?? defaults.animation;
    if (!['none', 'fade', 'slide-up', 'slide-left', 'pop'].includes(animation)) throw new Error('A text layer has an invalid animation.');
    if (typeof (layer.font ?? defaults.font) !== 'string') throw new Error('A text layer has an invalid font.');
    return {
      id: layer.id,
      title: layer.title,
      subtitle: layer.subtitle,
      color: readTextColor(layer.color, defaults.color, `text color in layer ${index + 1}`),
      startTicks,
      durationTicks: duration,
      x: readNumber(layer.x, 0, 1, defaults.x, 'text position'),
      y: readNumber(layer.y, 0, 1, defaults.y, 'text position'),
      width: readNumber(layer.width, 0.05, 1, defaults.width, 'text width'),
      align,
      font: layer.font ?? defaults.font,
      fontWeight: readNumber(layer.fontWeight, 100, 900, defaults.fontWeight, 'text weight'),
      fontStyle,
      size: readNumber(layer.size, 0.01, 0.5, defaults.size, 'text size'),
      lineHeight: readNumber(layer.lineHeight, 0.5, 3, defaults.lineHeight, 'text line height'),
      letterSpacing: readNumber(layer.letterSpacing, -0.05, 0.2, defaults.letterSpacing, 'text spacing'),
      rotation: readNumber(layer.rotation, -180, 180, defaults.rotation, 'text rotation'),
      opacity: readNumber(layer.opacity, 0, 100, defaults.opacity, 'text opacity'),
      subtitleScale: readNumber(layer.subtitleScale, 0.2, 1, defaults.subtitleScale, 'subtitle size'),
      backdropEnabled: readBoolean(layer.backdropEnabled, defaults.backdropEnabled, 'backdrop setting'),
      backdropColor: readTextColor(layer.backdropColor, defaults.backdropColor, 'backdrop color'),
      backdropOpacity: readNumber(layer.backdropOpacity, 0, 100, defaults.backdropOpacity, 'backdrop opacity'),
      backdropBlur: readNumber(layer.backdropBlur, 0, 60, defaults.backdropBlur, 'backdrop blur'),
      backdropPadding: readNumber(layer.backdropPadding, 0, 80, defaults.backdropPadding, 'backdrop padding'),
      backdropRadius: readNumber(layer.backdropRadius, 0, 60, defaults.backdropRadius, 'backdrop radius'),
      backdropNoise: readNumber(layer.backdropNoise, 0, 100, defaults.backdropNoise, 'backdrop grain'),
      outlineEnabled: readBoolean(layer.outlineEnabled, defaults.outlineEnabled, 'outline setting'),
      strokeColor: readTextColor(layer.strokeColor, defaults.strokeColor, 'outline color'),
      strokeWidth: readNumber(layer.strokeWidth, 0, 12, defaults.strokeWidth, 'outline width'),
      shadowEnabled: readBoolean(layer.shadowEnabled, defaults.shadowEnabled, 'shadow setting'),
      shadowColor: readTextColor(layer.shadowColor, defaults.shadowColor, 'shadow color'),
      shadowIntensity: readNumber(layer.shadowIntensity, 0, 100, defaults.shadowIntensity, 'shadow intensity'),
      shadowBlur: readNumber(layer.shadowBlur, 0, 60, defaults.shadowBlur, 'shadow blur'),
      shadowOffsetX: readNumber(layer.shadowOffsetX, -40, 40, defaults.shadowOffsetX, 'shadow offset'),
      shadowOffsetY: readNumber(layer.shadowOffsetY, -40, 40, defaults.shadowOffsetY, 'shadow offset'),
      glowEnabled: readBoolean(layer.glowEnabled, defaults.glowEnabled, 'glow setting'),
      glowColor: readTextColor(layer.glowColor, defaults.glowColor, 'glow color'),
      glowBlur: readNumber(layer.glowBlur, 0, 80, defaults.glowBlur, 'glow blur'),
      glowIntensity: readNumber(layer.glowIntensity, 0, 100, defaults.glowIntensity, 'glow intensity'),
      animation,
      animationDuration: readNumber(layer.animationDuration, .1, 2, defaults.animationDuration, 'text animation duration'),
    };
  });
}
function readTransition(value: unknown, durationTicks: number, timebase: Timebase): Transition | null {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object') throw new Error('Invalid transition.');
  const transition = value as Partial<Transition>;
  if (!['none', 'fade', 'slide', 'wipe', 'zoom'].includes(transition.type ?? '')) throw new Error('Invalid transition type.');
  if (transition.type === 'none') return null;
  const duration = transition.duration ?? .6;
  if (typeof duration !== 'number' || !Number.isFinite(duration)) throw new Error('Invalid transition duration.');
  const max = Math.min(2, ticksToSeconds(durationTicks, timebase) / 2);
  return { type: transition.type as TransitionType, duration: Math.min(max, Math.max(.1, duration)) };
}
function readAudioClip(value: unknown, total: number, timebase: Timebase): AudioClip {
  if (!value || typeof value !== 'object') throw new Error('Invalid audio clip.');
  const clip = value as AudioClip;
  if (typeof clip.id !== 'string' || !clip.id || typeof clip.name !== 'string' || !clip.name || clip.name.length > 120) throw new Error('Invalid audio clip identity.');
  if (typeof clip.data !== 'string' || (!AUDIO_DATA.test(clip.data) && !ASSET_REF.test(clip.data))) throw new Error('Invalid audio clip data.');
  const lane = clip.lane ?? 0;
  if (!Number.isInteger(lane) || lane < 0 || lane > 7) throw new Error('Invalid audio track.');
  if (!Number.isInteger(clip.startTicks) || clip.startTicks < 0 || !Number.isInteger(clip.durationTicks) || clip.durationTicks < 1) throw new Error('Invalid audio clip timing.');
  if (clip.startTicks + clip.durationTicks > total) throw new Error('An audio clip extends beyond the project.');
  if (typeof clip.sourceInSeconds !== 'number' || !Number.isFinite(clip.sourceInSeconds) || clip.sourceInSeconds < 0 || clip.sourceInSeconds > MAX_AUDIO_SECONDS || typeof clip.sourceDurationSeconds !== 'number' || !Number.isFinite(clip.sourceDurationSeconds) || clip.sourceDurationSeconds < 0 || clip.sourceDurationSeconds > MAX_AUDIO_SECONDS) throw new Error('Invalid audio source timing.');
  if (typeof clip.volume !== 'number' || !Number.isFinite(clip.volume) || clip.volume < 0 || clip.volume > 1 || typeof clip.fadeIn !== 'number' || !Number.isFinite(clip.fadeIn) || clip.fadeIn < 0 || clip.fadeIn > 30 || typeof clip.fadeOut !== 'number' || !Number.isFinite(clip.fadeOut) || clip.fadeOut < 0 || clip.fadeOut > 30) throw new Error('Invalid audio level.');
  const duration = ticksToSeconds(clip.durationTicks, timebase);
  if (clip.sourceInSeconds + duration > clip.sourceDurationSeconds + .05) throw new Error('Invalid audio trim.');
  if (clip.data.length > MAX_AUDIO_DATA_CHARS) throw new Error('An audio clip exceeds the 50 MB budget.');
  return {
    id: clip.id,
    name: clip.name,
    data: clip.data,
    lane,
    startTicks: clip.startTicks,
    durationTicks: clip.durationTicks,
    sourceInSeconds: clip.sourceInSeconds,
    sourceDurationSeconds: clip.sourceDurationSeconds,
    volume: clip.volume,
    fadeIn: clip.fadeIn,
    fadeOut: clip.fadeOut,
  };
}
function readFormats(value: unknown, aspect: Project['aspect'], clipIds: Set<string>): FormatVariant[] {
  if (value === undefined || value === null) return [defaultFormat(aspect)];
  if (!Array.isArray(value) || value.length === 0 || value.length > 6) throw new Error('A project supports 1–6 output formats.');
  const ids = new Set<string>();
  return value.map(entry => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid output format.');
    const format = entry as Partial<FormatVariant>;
    if (typeof format.id !== 'string' || !format.id || ids.has(format.id)) throw new Error('A format has an invalid or duplicate ID.');
    ids.add(format.id);
    if (typeof format.aspect !== 'string' || !format.aspect || format.aspect.length > 20) throw new Error('Invalid output format aspect.');
    const width = format.width ?? (format.aspect === '9:16' ? 1080 : format.aspect === '4:5' ? 1080 : format.aspect === '1:1' ? 1080 : 1920);
    const height = format.height ?? (format.aspect === '9:16' ? 1920 : format.aspect === '4:5' ? 1350 : format.aspect === '1:1' ? 1080 : 1080);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 240 || height < 240 || width > 3840 || height > 3840 || width % 2 !== 0 || height % 2 !== 0) throw new Error('Invalid output format size.');
    const fps = format.fps ?? 30;
    if (!Number.isInteger(fps) || fps < 15 || fps > 60) throw new Error('Invalid output format frame rate.');
    const quality = format.quality ?? 'standard';
    if (!['draft', 'standard', 'high'].includes(quality)) throw new Error('Invalid output format quality.');
    if (format.presetId !== undefined && typeof format.presetId !== 'string') throw new Error('Invalid output format preset.');
    if (typeof format.name !== 'string' || !format.name || format.name.length > 80 || typeof format.platform !== 'string' || !format.platform || format.platform.length > 80) throw new Error('Invalid output format name.');
    const overrides: Record<string, SceneFormatOverride> = {};
    if (format.overrides && typeof format.overrides === 'object') {
      for (const [sceneId, override] of Object.entries(format.overrides)) {
        if (!clipIds.has(sceneId) || !override || typeof override !== 'object') continue;
        const source = override as SceneFormatOverride;
        const clean: SceneFormatOverride = {};
        if (source.imageX !== undefined) clean.imageX = readNumber(source.imageX, -1, 1, 0, 'format image position');
        if (source.imageY !== undefined) clean.imageY = readNumber(source.imageY, -1, 1, 0, 'format image position');
        if (source.imageZoom !== undefined) clean.imageZoom = readNumber(source.imageZoom, 1, 4, 1, 'format image zoom');
        if (source.fit !== undefined) {
          if (!['cover', 'contain', 'blur'].includes(source.fit)) throw new Error('Invalid format image fit.');
          clean.fit = source.fit;
        }
        if (source.framingBackground !== undefined) clean.framingBackground = readTextColor(source.framingBackground, '#000000', 'format letterbox color');
        overrides[sceneId] = clean;
      }
    }
    return { id: format.id, name: format.name, platform: format.platform, aspect: format.aspect, width, height, fps, quality, ...(format.presetId ? { presetId: format.presetId } : {}), overrides };
  });
}
function readAudio(value: unknown, legacyMusic: unknown, total: number, timebase: Timebase): AudioClip[] {
  if (Array.isArray(value)) {
    const ids = new Set<string>();
    let audioBytes = 0;
    const clips = value.map(item => {
      const clip = readAudioClip(item, total, timebase);
      if (ids.has(clip.id)) throw new Error('Duplicate audio clip ID.');
      ids.add(clip.id);
      audioBytes += clip.data.length;
      return clip;
    });
    if (audioBytes > MAX_PROJECT_AUDIO_CHARS) throw new Error('Audio exceeds the 200 MB project budget.');
    return clips;
  }
  if (legacyMusic && typeof legacyMusic === 'object') {
    const music = legacyMusic as LegacyMusic;
    const totalSeconds = ticksToSeconds(total, timebase);
    const sourceDurationSeconds = Number.isFinite(music.durationSeconds) && music.durationSeconds > 0 ? music.durationSeconds : totalSeconds;
    const durationSeconds = Math.min(totalSeconds, sourceDurationSeconds);
    const durationTicks = Math.max(1, Math.min(total, secondsToTicks(durationSeconds, timebase)));
    return [readAudioClip({
      id: music.id,
      name: music.name,
      data: music.data,
      lane: 0,
      startTicks: 0,
      durationTicks,
      sourceInSeconds: 0,
      sourceDurationSeconds,
      volume: music.volume,
      fadeIn: music.fadeIn,
      fadeOut: music.fadeOut,
    }, total, timebase)];
  }
  return [];
}
type SceneInput = Omit<Scene, 'durationTicks' | 'startTicks' | 'sourceInTicks'> & { durationTicks?: number; startTicks?: number; sourceInTicks?: number; duration?: number };
type TrackInput = { id?: unknown; kind?: unknown; name?: unknown; clips?: SceneInput[]; hidden?: unknown; muted?: unknown; locked?: unknown };
type ProjectInput = Omit<Project, 'tracks' | 'timebase' | 'schema_version' | 'audio' | 'formats'> & { schema_version?: number; timebase?: Timebase; tracks?: TrackInput[]; scenes?: SceneInput[]; audio?: unknown; music?: unknown; formats?: unknown };
function readTimebase(value: unknown): Timebase {
  if (!value || typeof value !== 'object') return { ...DEFAULT_TIMEBASE };
  const timebase = value as Timebase;
  if (!Number.isInteger(timebase.numerator) || !Number.isInteger(timebase.denominator) || timebase.numerator <= 0 || timebase.denominator <= 0 || timebase.numerator > timebase.denominator || timebase.denominator > 1_000_000) {
    throw new Error('Invalid project timebase.');
  }
  return { numerator: timebase.numerator, denominator: timebase.denominator };
}
export function validateProject(value: unknown): Project {
  if (!value || typeof value !== 'object') throw new Error('This is not a PixCut project.');
  const p = value as ProjectInput;
  if (p.schema_version !== 1 && p.schema_version !== 2 && p.schema_version !== 3 && p.schema_version !== 4 && p.schema_version !== 5 && p.schema_version !== 6 && p.schema_version !== 7) throw new Error('Unsupported project version. Your original file has not been changed.');
  if (typeof p.id !== 'string' || typeof p.name !== 'string' || p.name.length > 120 || !['16:9', '9:16', '1:1', '4:5'].includes(p.aspect)) throw new Error('Invalid project format.');
  const timebase = p.schema_version === 1 ? { ...DEFAULT_TIMEBASE } : readTimebase(p.timebase);
  const minimum = minTicks(timebase), maximum = maxTicks(timebase);
  const clipIds = new Set<string>();
  let bytes = 0;
  function readClips(candidates: SceneInput[]): Scene[] {
    if (!Array.isArray(candidates) || candidates.length > 100) throw new Error('Invalid project format.');
    const clips: Scene[] = [];
    for (const candidate of candidates) {
      const s = { ...candidate };
      const ticks = p.schema_version === 1 ? secondsToTicks(candidate.duration ?? NaN, timebase) : candidate.durationTicks;
      if (!Number.isInteger(ticks) || (ticks as number) < minimum || (ticks as number) > maximum) throw new Error('A scene contains invalid timing.');
      const startTicks = candidate.startTicks ?? 0;
      const sourceInTicks = candidate.sourceInTicks ?? 0;
      if (!Number.isInteger(startTicks) || startTicks < 0 || !Number.isInteger(sourceInTicks) || sourceInTicks < 0) throw new Error('A clip contains invalid source timing.');
      const duration = ticksToSeconds(ticks as number, timebase);
      if (!s || typeof s.id !== 'string' || clipIds.has(s.id) || typeof s.name !== 'string' || typeof s.image !== 'string' || (s.mediaKind === 'video' ? !VIDEO_DATA.test(s.image) : (!IMAGE_DATA.test(s.image) && !ASSET_REF.test(s.image))) || (s.mediaKind !== undefined && s.mediaKind !== 'video') || (s.videoPoster !== undefined && (typeof s.videoPoster !== 'string' || !IMAGE_DATA.test(s.videoPoster))) || typeof s.title !== 'string' || s.title.length > 120 || typeof s.subtitle !== 'string' || s.subtitle.length > 200 || !/^#[0-9a-fA-F]{6}$/.test(s.color) || !['cover', 'contain', 'blur'].includes(s.fit) || !optionalNumber(s.imageX, -1, 1) || !optionalNumber(s.imageY, -1, 1) || !optionalNumber(s.imageZoom, 1, 4) || !optionalColor(s.framingBackground) || !optionalNumber(s.brightness, 0, 2.5) || !optionalNumber(s.contrast, 0, 2.5) || !optionalNumber(s.saturation, 0, 2.5) || !optionalNumber(s.exposure, -3, 3) || !optionalNumber(s.highlights, -1, 1) || !optionalNumber(s.shadows, -1, 1) || !optionalNumber(s.temperature, -1, 1) || !optionalNumber(s.tint, -1, 1) || !optionalFilter(s.filter) || !optionalNumber(s.filterIntensity, 0, 100) || !optionalNumber(s.speed, 0.25, 4) || (s.pitch !== undefined && typeof s.pitch !== 'boolean') || !optionalNumber(s.fadeIn, 0, duration) || !optionalNumber(s.fadeOut, 0, duration) || (s.textBackdropEnabled !== undefined && typeof s.textBackdropEnabled !== 'boolean') || !optionalColor(s.textBackdropColor) || !optionalNumber(s.textBackdropOpacity, 0, 100) || !optionalNumber(s.textBackdropBlur, 0, 60) || !optionalNumber(s.textBackdropPadding, 0, 80) || !optionalNumber(s.textBackdropRadius, 0, 60) || !optionalNumber(s.textBackdropNoise, 0, 100) || !optionalColor(s.textStrokeColor) || !optionalNumber(s.textStrokeWidth, 0, 12) || (s.textOutlineEnabled !== undefined && typeof s.textOutlineEnabled !== 'boolean') || !optionalColor(s.textShadowColor) || !optionalNumber(s.textShadowBlur, 0, 60) || !optionalNumber(s.textShadowOffsetX, -40, 40) || !optionalNumber(s.textShadowOffsetY, -40, 40) || (s.textShadowEnabled !== undefined && typeof s.textShadowEnabled !== 'boolean') || !optionalNumber(s.textShadowIntensity, 0, 100) || (s.textGlowEnabled !== undefined && typeof s.textGlowEnabled !== 'boolean') || !optionalColor(s.textGlowColor) || !optionalNumber(s.textGlowBlur, 0, 80) || !optionalNumber(s.textGlowIntensity, 0, 100) || !optionalNumber(s.textX, 0, 1) || !optionalNumber(s.textY, 0, 1) || !optionalNumber(s.textWidth, 0.05, 1) || (s.textAlign !== undefined && !['left', 'center', 'right'].includes(s.textAlign)) || (s.textFont !== undefined && (typeof s.textFont !== 'string' || s.textFont.length > 60)) || !optionalNumber(s.textFontWeight, 100, 900) || (s.textFontStyle !== undefined && !['normal', 'italic'].includes(s.textFontStyle)) || !optionalNumber(s.textSize, 0.01, 0.5) || !optionalNumber(s.textLineHeight, 0.5, 3) || !optionalNumber(s.textLetterSpacing, -0.05, 0.2) || !optionalNumber(s.textRotation, -180, 180) || !optionalNumber(s.textOpacity, 0, 100) || !optionalNumber(s.textSubtitleScale, 0.2, 1)) throw new Error('A scene contains invalid image, timing, title, color, or text layout data.');
      delete s.duration;
      s.durationTicks = ticks as number;
      s.startTicks = startTicks;
      s.sourceInTicks = sourceInTicks;
      const layers = readTextLayers(s.textLayers, { ...s, durationTicks: ticks as number, startTicks, sourceInTicks } as Scene, ticks as number);
      s.textLayers = layers;
      s.transition = readTransition(s.transition, ticks as number, timebase);
      s.title = layers[0]?.title ?? '';
      s.subtitle = layers[0]?.subtitle ?? '';
      clipIds.add(s.id); bytes += s.image.length;
      clips.push(s as Scene);
    }
    normalizeStarts(clips);
    return clips;
  }
  const trackIds = new Set<string>();
  function readTrack(track: TrackInput, index: number, clips: SceneInput[]): Track {
    if (!track || typeof track !== 'object') throw new Error('Invalid track data.');
    const kind = track.kind ?? 'visual';
    if (!['visual', 'text', 'audio'].includes(kind as string)) throw new Error('Invalid track kind.');
    const id = typeof track.id === 'string' && track.id ? track.id : `track-${index + 1}`;
    if (trackIds.has(id)) throw new Error('Duplicate track ID.');
    trackIds.add(id);
    const name = typeof track.name === 'string' && track.name.length <= 120 ? track.name : `${String(kind)[0].toUpperCase()}${String(kind).slice(1)}`;
    if (kind !== 'visual' && clips.length) throw new Error('Only visual clips are supported in this build.');
    return {
      id,
      kind: kind as TrackKind,
      name,
      clips: kind === 'visual' ? readClips(clips) : [],
      hidden: track.hidden === true,
      muted: track.muted === true,
      locked: track.locked === true,
    };
  }
  let tracks: Track[];
  if (p.schema_version !== undefined && p.schema_version >= 3) {
    if (!Array.isArray(p.tracks) || p.tracks.length === 0 || p.tracks.length > 8) throw new Error('Invalid project tracks.');
    tracks = p.tracks.map((track, index) => readTrack(track, index, Array.isArray(track.clips) ? track.clips : []));
  } else {
    tracks = [readTrack({ id: 'visual-1', kind: 'visual', name: 'Visuals' }, 0, Array.isArray(p.scenes) ? p.scenes : [])];
  }
  if (tracks.filter(track => track.kind === 'visual').length !== 1) throw new Error('A project needs exactly one visual track in this build.');
  if (bytes > 90_000_000) throw new Error('This prototype supports up to 64 MB of embedded images per project.');
  const total = tracks.filter(track => track.kind === 'visual').flatMap(track => track.clips).reduce((end, clip) => Math.max(end, clip.startTicks + clip.durationTicks), 0);
  const audio = readAudio(p.audio, p.music, total, timebase);
  const formats = readFormats(p.formats, p.aspect, clipIds);
  return { schema_version: 7, id: p.id, name: p.name, aspect: p.aspect, timebase, tracks, audio, formats, policy: { ...policy } };
}
const SCENE_PATCH_FIELDS = [
  { key: 'durationTicks', value: (scene: Scene) => scene.durationTicks },
  { key: 'title', value: (scene: Scene) => scene.title },
  { key: 'subtitle', value: (scene: Scene) => scene.subtitle },
  { key: 'textLayers', value: (scene: Scene) => JSON.stringify(scene.textLayers ?? []) },
  { key: 'transition', value: (scene: Scene) => JSON.stringify(scene.transition ?? null) },
  { key: 'color', value: (scene: Scene) => scene.color },
  { key: 'fit', value: (scene: Scene) => scene.fit },
  { key: 'imageX', value: (scene: Scene) => scene.imageX ?? 0 },
  { key: 'imageY', value: (scene: Scene) => scene.imageY ?? 0 },
  { key: 'imageZoom', value: (scene: Scene) => scene.imageZoom ?? 1 },
  { key: 'framingBackground', value: (scene: Scene) => scene.framingBackground ?? '#000000' },
  { key: 'brightness', value: (scene: Scene) => scene.brightness ?? 1 },
  { key: 'contrast', value: (scene: Scene) => scene.contrast ?? 1 },
  { key: 'saturation', value: (scene: Scene) => scene.saturation ?? 1 },
  { key: 'exposure', value: (scene: Scene) => scene.exposure ?? 0 },
  { key: 'highlights', value: (scene: Scene) => scene.highlights ?? 0 },
  { key: 'shadows', value: (scene: Scene) => scene.shadows ?? 0 },
  { key: 'temperature', value: (scene: Scene) => scene.temperature ?? 0 },
  { key: 'tint', value: (scene: Scene) => scene.tint ?? 0 },
  { key: 'filter', value: (scene: Scene) => scene.filter ?? 'none' },
  { key: 'filterIntensity', value: (scene: Scene) => scene.filterIntensity ?? 100 },
  { key: 'speed', value: (scene: Scene) => scene.speed ?? 1 },
  { key: 'pitch', value: (scene: Scene) => scene.pitch ?? true },
  { key: 'fadeIn', value: (scene: Scene) => scene.fadeIn ?? 0 },
  { key: 'fadeOut', value: (scene: Scene) => scene.fadeOut ?? 0 },
  { key: 'textBackdropEnabled', value: (scene: Scene) => scene.textBackdropEnabled ?? false },
  { key: 'textBackdropColor', value: (scene: Scene) => scene.textBackdropColor ?? '#000000' },
  { key: 'textBackdropOpacity', value: (scene: Scene) => scene.textBackdropOpacity ?? 45 },
  { key: 'textBackdropBlur', value: (scene: Scene) => scene.textBackdropBlur ?? 18 },
  { key: 'textBackdropPadding', value: (scene: Scene) => scene.textBackdropPadding ?? 24 },
  { key: 'textBackdropRadius', value: (scene: Scene) => scene.textBackdropRadius ?? 16 },
  { key: 'textBackdropNoise', value: (scene: Scene) => scene.textBackdropNoise ?? 8 },
  { key: 'textStrokeColor', value: (scene: Scene) => scene.textStrokeColor ?? '#000000' },
  { key: 'textOutlineEnabled', value: (scene: Scene) => scene.textOutlineEnabled ?? false },
  { key: 'textStrokeWidth', value: (scene: Scene) => scene.textStrokeWidth ?? 0 },
  { key: 'textShadowColor', value: (scene: Scene) => scene.textShadowColor ?? '#000000' },
  { key: 'textShadowEnabled', value: (scene: Scene) => scene.textShadowEnabled ?? false },
  { key: 'textShadowIntensity', value: (scene: Scene) => scene.textShadowIntensity ?? 60 },
  { key: 'textShadowBlur', value: (scene: Scene) => scene.textShadowBlur ?? 0 },
  { key: 'textShadowOffsetX', value: (scene: Scene) => scene.textShadowOffsetX ?? 0 },
  { key: 'textShadowOffsetY', value: (scene: Scene) => scene.textShadowOffsetY ?? 0 },
  { key: 'textGlowEnabled', value: (scene: Scene) => scene.textGlowEnabled ?? false },
  { key: 'textGlowColor', value: (scene: Scene) => scene.textGlowColor ?? '#ffffff' },
  { key: 'textGlowBlur', value: (scene: Scene) => scene.textGlowBlur ?? 24 },
  { key: 'textGlowIntensity', value: (scene: Scene) => scene.textGlowIntensity ?? 55 },
  { key: 'textX', value: (scene: Scene) => scene.textX ?? 0.09 },
  { key: 'textY', value: (scene: Scene) => scene.textY ?? 0.78 },
  { key: 'textWidth', value: (scene: Scene) => scene.textWidth ?? 0.82 },
  { key: 'textAlign', value: (scene: Scene) => scene.textAlign ?? 'left' },
  { key: 'textFont', value: (scene: Scene) => scene.textFont ?? 'inter' },
  { key: 'textFontWeight', value: (scene: Scene) => scene.textFontWeight ?? 600 },
  { key: 'textFontStyle', value: (scene: Scene) => scene.textFontStyle ?? 'normal' },
  { key: 'textSize', value: (scene: Scene) => scene.textSize ?? 0.068 },
  { key: 'textLineHeight', value: (scene: Scene) => scene.textLineHeight ?? 1.2 },
  { key: 'textLetterSpacing', value: (scene: Scene) => scene.textLetterSpacing ?? 0 },
  { key: 'textRotation', value: (scene: Scene) => scene.textRotation ?? 0 },
  { key: 'textOpacity', value: (scene: Scene) => scene.textOpacity ?? 100 },
  { key: 'textSubtitleScale', value: (scene: Scene) => scene.textSubtitleScale ?? 0.4 },
] as const;
export type ScenePatchKey = typeof SCENE_PATCH_FIELDS[number]['key'];
export function scenePatch(base: Scene, next: Scene): Partial<Scene> {
  const patch: Partial<Scene> = {};
  for (const field of SCENE_PATCH_FIELDS) {
    const before = field.value(base);
    const after = field.value(next);
    if (before !== after) (patch as Record<string, unknown>)[field.key] = field.key === 'textLayers' ? structuredClone(next.textLayers ?? []) : field.key === 'transition' ? structuredClone(next.transition ?? null) : after;
  }
  return patch;
}
function splitTextLayers(layers: TextLayer[], atTicks: number) {
  const left = layers
    .filter(layer => layer.startTicks < atTicks)
    .map(layer => ({ ...layer, durationTicks: Math.max(1, Math.min(layer.durationTicks, atTicks - layer.startTicks)) }));
  const right = layers
    .filter(layer => layer.startTicks + layer.durationTicks > atTicks)
    .map(layer => {
      const end = layer.startTicks + layer.durationTicks;
      return { ...layer, startTicks: Math.max(0, layer.startTicks - atTicks), durationTicks: Math.max(1, end - Math.max(layer.startTicks, atTicks)) };
    });
  return { left, right };
}
export function replaceSceneImage(scene: Scene, image: string, name?: string): Scene {
  const nextName = name?.trim();
  return { ...scene, image, name: nextName || scene.name, mediaKind: undefined, videoPoster: undefined };
}
export function edit(project: Project, command: Exclude<Command, { type: 'undo' } | { type: 'redo' }>): Project {
  const p = structuredClone(project);
  const track = visualTrack(p);
  if (!track) throw new Error('This project has no visual track.');
  let clips = track.clips;
  switch (command.type) {
    case 'replace': return validateProject(command.project);
    case 'rename': p.name = command.name; break;
    case 'aspect': p.aspect = command.aspect; break;
    case 'audio': p.audio = command.audio; break;
    case 'formats': p.formats = command.formats; break;
    case 'add': clips.push(...command.scenes); break;
    case 'update': clips = clips.map(s => s.id === command.scene.id ? command.scene : s); break;
    case 'remove': clips = clips.filter(s => s.id !== command.id); break;
    case 'move': { const index = clips.findIndex(s => s.id === command.id); const to = index + command.offset; if (index >= 0 && to >= 0 && to < clips.length) { const [scene] = clips.splice(index, 1); clips.splice(to, 0, scene); } break; }
    case 'duplicate': {
      const index = clips.findIndex(s => s.id === command.id);
      if (index < 0) throw new Error('Select a scene to duplicate.');
      if (clips.some(s => s.id === command.newId)) throw new Error('A scene with this ID already exists.');
      const copy = { ...clips[index], id: command.newId, name: `${clips[index].name} copy` };
      clips.splice(index + 1, 0, copy);
      break;
    }
    case 'split': {
      const index = clips.findIndex(s => s.id === command.id);
      if (index < 0) throw new Error('Select a scene to split.');
      const scene = clips[index];
      const minimum = minTicks(p.timebase);
      if (!Number.isInteger(command.atTicks) || command.atTicks < minimum || scene.durationTicks - command.atTicks < minimum) throw new Error('Move the playhead at least half a second inside the clip to split it.');
      if (clips.some(s => s.id === command.newId)) throw new Error('A scene with this ID already exists.');
      const leftSeconds = ticksToSeconds(command.atTicks, p.timebase);
      const rightSeconds = ticksToSeconds(scene.durationTicks - command.atTicks, p.timebase);
      const layers = splitTextLayers(scene.textLayers ?? [], command.atTicks);
      const left = { ...scene, durationTicks: command.atTicks, fadeIn: Math.min(scene.fadeIn ?? 0, leftSeconds), fadeOut: 0, textLayers: layers.left, title: layers.left[0]?.title ?? '', subtitle: layers.left[0]?.subtitle ?? '' };
      const right = { ...scene, id: command.newId, startTicks: scene.startTicks + command.atTicks, sourceInTicks: scene.sourceInTicks + command.atTicks, durationTicks: scene.durationTicks - command.atTicks, fadeIn: 0, fadeOut: Math.min(scene.fadeOut ?? 0, rightSeconds), textLayers: layers.right, title: layers.right[0]?.title ?? '', subtitle: layers.right[0]?.subtitle ?? '' };
      clips.splice(index, 1, left, right);
      break;
    }
    case 'updateMany': {
      const updates = new Map(command.scenes.map(scene => [scene.id, scene]));
      clips = clips.map(scene => updates.get(scene.id) ?? scene);
      break;
    }
    case 'removeMany': {
      const ids = new Set(command.ids);
      clips = clips.filter(scene => !ids.has(scene.id));
      break;
    }
    case 'duplicateMany': {
      if (new Set(command.items.map(item => item.id)).size !== command.items.length) throw new Error('A scene can only be duplicated once at a time.');
      const existing = new Set(clips.map(scene => scene.id));
      const newIds = new Set<string>();
      for (const item of command.items) {
        if (!existing.has(item.id)) throw new Error('Select a scene to duplicate.');
        if (existing.has(item.newId) || newIds.has(item.newId)) throw new Error('A scene with this ID already exists.');
        newIds.add(item.newId);
      }
      const items = new Map(command.items.map(item => [item.id, item.newId]));
      const next: Scene[] = [];
      for (const scene of clips) {
        next.push(scene);
        const newId = items.get(scene.id);
        if (newId) next.push({ ...scene, id: newId, name: `${scene.name} copy` });
      }
      clips = next;
      break;
    }
  }
  track.clips = clips;
  normalizeStarts(track.clips);
  const total = track.clips.reduce((end, clip) => Math.max(end, clip.startTicks + clip.durationTicks), 0);
  p.audio = p.audio.flatMap(clip => {
    if (total <= 0 || clip.startTicks >= total) return [];
    const durationTicks = Math.min(clip.durationTicks, total - clip.startTicks);
    return durationTicks > 0 ? [{ ...clip, durationTicks }] : [];
  });
  return validateProject(p);
}
export function sceneAt(project: Project, time: number) {
  const clips = projectScenes(project);
  for (const scene of clips) {
    const start = ticksToSeconds(scene.startTicks, project.timebase);
    const end = start + sceneSeconds(scene, project.timebase);
    if (time < start) return undefined;
    if (time < end) return { scene, start };
  }
  const scene = clips.at(-1);
  return scene ? { scene, start: ticksToSeconds(scene.startTicks, project.timebase) } : undefined;
}
export function timecode(seconds: number, timebase: Timebase = DEFAULT_TIMEBASE) {
  const fps = frameRate(timebase);
  const frames = Math.floor(Math.max(0, seconds) / secondsPerTick(timebase));
  return `${String(Math.floor(frames / (fps * 60))).padStart(2, '0')}:${String(Math.floor(frames / fps) % 60).padStart(2, '0')}:${String(Math.round(frames % fps)).padStart(2, '0')}`;
}
