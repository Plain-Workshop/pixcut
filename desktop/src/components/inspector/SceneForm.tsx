import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Blend, Crop, Maximize2, SlidersHorizontal, SunDim, Wand2, Shapes, Check, ClipboardPaste, Copy, Gauge, Move, Plus, RotateCcw, Search, Sparkles, Trash2, Type } from 'lucide-react';
import { sceneSeconds, secondsToTicks, setSceneSeconds, ticksToSeconds, type ElementLayer, type Scene, type ScenePatchKey, type TextAnimation, type TextLayer, type Timebase, type TransitionType } from '../../stores/model';
import { DEFAULT_TEXT_LINE_HEIGHT, DEFAULT_TEXT_SIZE, DEFAULT_TEXT_SUBTITLE_SCALE, DEFAULT_TEXT_WEIGHT, DEFAULT_TEXT_WIDTH, DEFAULT_TEXT_X, DEFAULT_TEXT_Y, FONTS, clampWeight, fontOption, fontWeights } from '../text/fonts';
import { MAX_TEXT_LAYERS, TEXT_LAYER_STYLE_DEFAULTS, createTextLayer, layerTimingLabel } from '../text/layers';
import { KeyframeControls } from '../animation/KeyframeControls';
import { sceneStack, stackIndex, stackZ, overlaysForScene, type StackMove } from '../elements/stack';
import { StackOrder } from './StackOrder';
import { FILTERS, clamp, thumbnailFilterCss } from '../preview/filters';

type Tab = 'elements' | 'video' | 'text' | 'transition' | 'color' | 'speed' | 'fade' | 'filters';
type ColorKey = 'brightness' | 'contrast' | 'saturation' | 'exposure' | 'highlights' | 'shadows' | 'temperature' | 'tint';

const COLOR_CONTROLS: { key: ColorKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'brightness', label: 'Brightness', min: 0, max: 2.5, step: 0.01 },
  { key: 'contrast', label: 'Contrast', min: 0, max: 2.5, step: 0.01 },
  { key: 'exposure', label: 'Exposure', min: -3, max: 3, step: 0.05 },
  { key: 'highlights', label: 'Highlights', min: -1, max: 1, step: 0.01 },
  { key: 'shadows', label: 'Shadows', min: -1, max: 1, step: 0.01 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 2.5, step: 0.01 },
  { key: 'temperature', label: 'Temperature', min: -1, max: 1, step: 0.01 },
  { key: 'tint', label: 'Tint', min: -1, max: 1, step: 0.01 },
];

const COLOR_DEFAULTS: Partial<Scene> = { brightness: 1, contrast: 1, saturation: 1, exposure: 0, highlights: 0, shadows: 0, temperature: 0, tint: 0 };
const COLOR_KEYS: ScenePatchKey[] = COLOR_CONTROLS.map(control => control.key);
const TEXT_STYLE_DEFAULTS: Partial<TextLayer> = { ...TEXT_LAYER_STYLE_DEFAULTS };
const LEGIBLE_TEXT: Partial<TextLayer> = {
  ...TEXT_STYLE_DEFAULTS,
  backdropEnabled: true,
  backdropColor: '#000000',
  backdropOpacity: 45,
  backdropBlur: 18,
  backdropPadding: 24,
  backdropRadius: 16,
  backdropNoise: 8,
  outlineEnabled: true,
  strokeColor: '#000000',
  strokeWidth: 1.5,
  shadowEnabled: true,
  shadowColor: '#000000',
  shadowIntensity: 55,
  shadowBlur: 6,
  shadowOffsetX: 0,
  shadowOffsetY: 2,
  glowEnabled: false,
};
type TemplatePreset = { label: string; patch: Partial<TextLayer> };
const BACKDROP_PRESETS: TemplatePreset[] = [
  { label: 'None', patch: { backdropEnabled: false } },
  { label: 'Dark glass', patch: { backdropEnabled: true, backdropColor: '#000000', backdropOpacity: 45, backdropBlur: 18, backdropPadding: 24, backdropRadius: 16, backdropNoise: 8 } },
  { label: 'Light glass', patch: { backdropEnabled: true, backdropColor: '#FFFFFF', backdropOpacity: 62, backdropBlur: 20, backdropPadding: 24, backdropRadius: 16, backdropNoise: 4 } },
  { label: 'Heavy', patch: { backdropEnabled: true, backdropColor: '#000000', backdropOpacity: 58, backdropBlur: 40, backdropPadding: 30, backdropRadius: 22, backdropNoise: 0 } },
  { label: 'Grain', patch: { backdropEnabled: true, backdropColor: '#000000', backdropOpacity: 62, backdropBlur: 8, backdropPadding: 22, backdropRadius: 12, backdropNoise: 45 } },
];
const OUTLINE_PRESETS: TemplatePreset[] = [
  { label: 'None', patch: { outlineEnabled: false } },
  { label: 'Thin', patch: { outlineEnabled: true, strokeColor: '#000000', strokeWidth: 1.5 } },
  { label: 'Bold', patch: { outlineEnabled: true, strokeColor: '#000000', strokeWidth: 3 } },
  { label: 'Light', patch: { outlineEnabled: true, strokeColor: '#FFFFFF', strokeWidth: 2 } },
];
const GLOW_PRESETS: TemplatePreset[] = [
  { label: 'None', patch: { glowEnabled: false } },
  { label: 'Soft', patch: { glowEnabled: true, glowColor: '#FFFFFF', glowBlur: 20, glowIntensity: 40 } },
  { label: 'Neon', patch: { glowEnabled: true, glowColor: '#9B7CFF', glowBlur: 28, glowIntensity: 70 } },
  { label: 'Cyan', patch: { glowEnabled: true, glowColor: '#6BE7FF', glowBlur: 24, glowIntensity: 60 } },
  { label: 'Warm', patch: { glowEnabled: true, glowColor: '#FFB36B', glowBlur: 24, glowIntensity: 55 } },
];
const SHADOW_PRESETS: TemplatePreset[] = [
  { label: 'None', patch: { shadowEnabled: false } },
  { label: 'Soft', patch: { shadowEnabled: true, shadowColor: '#000000', shadowIntensity: 55, shadowBlur: 8, shadowOffsetX: 0, shadowOffsetY: 2 } },
  { label: 'Lifted', patch: { shadowEnabled: true, shadowColor: '#000000', shadowIntensity: 45, shadowBlur: 20, shadowOffsetX: 0, shadowOffsetY: 8 } },
  { label: 'Hard', patch: { shadowEnabled: true, shadowColor: '#000000', shadowIntensity: 70, shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 4 } },
];
const SPEED_PRESETS = [0.5, 1, 1.5, 2];
export const TRANSITION_OPTIONS: { id: TransitionType; label: string; description: string }[] = [
  { id: 'none', label: 'None', description: 'Hard cut' },
  { id: 'fade', label: 'Crossfade', description: 'Smooth dissolve' },
  { id: 'slide', label: 'Slide', description: 'Push to the next scene' },
  { id: 'wipe', label: 'Wipe', description: 'Reveal left to right' },
  { id: 'zoom', label: 'Zoom', description: 'Push in and blend' },
  { id: 'blur', label: 'Soft blur', description: 'Defocus' },
  { id: 'circle', label: 'Circle', description: 'Center reveal' },
  { id: 'slide-up', label: 'Slide up', description: 'Push upward' },
  { id: 'spin', label: 'Spin', description: 'Rotate and fade' },
];
const TEXT_ANIMATIONS: { id: TextAnimation; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'fade', label: 'Fade' },
  { id: 'slide-up', label: 'Slide up' },
  { id: 'slide-left', label: 'Slide left' },
  { id: 'pop', label: 'Pop' },
];

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  if (value.length !== 6) return `rgba(0, 0, 0, ${alpha})`;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function TemplateCard({ kind, preset, active, onApply }: { kind: 'backdrop' | 'outline' | 'glow' | 'shadow'; preset: TemplatePreset; active: boolean; onApply: () => void }) {
  const patch = preset.patch;
  let stage: ReactNode;
  if (kind === 'backdrop') {
    const enabled = patch.backdropEnabled ?? false;
    const color = patch.backdropColor ?? '#000000';
    const opacity = (patch.backdropOpacity ?? 45) / 100;
    stage = <span className="text-style-stage backdrop-stage">
      {enabled && <span className="text-style-plate" style={{ background: hexToRgba(color, opacity), borderRadius: Math.min(12, (patch.backdropRadius ?? 16) / 4), backdropFilter: `blur(${Math.min(6, (patch.backdropBlur ?? 18) / 5)}px)` }} />}
      <span className="text-style-aa">Aa</span>
    </span>;
  } else if (kind === 'outline') {
    const enabled = patch.outlineEnabled ?? false;
    stage = <span className="text-style-stage mid-stage"><span className="text-style-aa" style={{ WebkitTextStroke: enabled ? `${Math.min(3, patch.strokeWidth ?? 1.5)}px ${patch.strokeColor ?? '#000000'}` : undefined }}>Aa</span></span>;
  } else if (kind === 'glow') {
    const enabled = patch.glowEnabled ?? false;
    const color = patch.glowColor ?? '#FFFFFF';
    const intensity = (patch.glowIntensity ?? 55) / 100;
    const blur = Math.min(16, (patch.glowBlur ?? 24) / 2);
    stage = <span className="text-style-stage dark-stage"><span className="text-style-aa" style={{ textShadow: enabled ? `0 0 ${blur}px ${hexToRgba(color, intensity)}, 0 0 ${blur * 1.8}px ${hexToRgba(color, intensity * 0.7)}` : undefined }}>Aa</span></span>;
  } else {
    const enabled = patch.shadowEnabled ?? false;
    const color = patch.shadowColor ?? '#000000';
    const intensity = (patch.shadowIntensity ?? 60) / 100;
    const blur = Math.min(12, (patch.shadowBlur ?? 8) / 2);
    stage = <span className="text-style-stage mid-stage"><span className="text-style-aa" style={{ textShadow: enabled ? `${(patch.shadowOffsetX ?? 0) / 2}px ${(patch.shadowOffsetY ?? 2) / 2}px ${blur}px ${hexToRgba(color, intensity)}` : undefined }}>Aa</span></span>;
  }
  return <button className={`text-style-card ${active ? 'active' : ''}`} type="button" onClick={onApply} title={preset.label} aria-label={`${kind} template: ${preset.label}`}>
    {stage}
    <span className="text-style-name">{preset.label}</span>
  </button>;
}

function formatNumber(value: number) {
  return String(Number(value.toFixed(2)));
}

function comparable(scene: Scene) {
  return JSON.stringify({
    durationTicks: scene.durationTicks,
    textLayers: scene.textLayers ?? [],
    transition: scene.transition ?? null,
    title: scene.title,
    subtitle: scene.subtitle,
    color: scene.color,
    fit: scene.fit,
    imageX: scene.imageX ?? 0,
    imageY: scene.imageY ?? 0,
    imageZoom: scene.imageZoom ?? 1,
    framingBackground: scene.framingBackground ?? '#000000',
    brightness: scene.brightness ?? 1,
    contrast: scene.contrast ?? 1,
    saturation: scene.saturation ?? 1,
    exposure: scene.exposure ?? 0,
    highlights: scene.highlights ?? 0,
    shadows: scene.shadows ?? 0,
    temperature: scene.temperature ?? 0,
    tint: scene.tint ?? 0,
    filter: scene.filter ?? 'none',
    filterIntensity: scene.filterIntensity ?? 100,
    speed: scene.speed ?? 1,
    pitch: scene.pitch ?? true,
    fadeIn: scene.fadeIn ?? 0,
    fadeOut: scene.fadeOut ?? 0,
    textBackdropEnabled: scene.textBackdropEnabled ?? false,
    textBackdropColor: scene.textBackdropColor ?? '#000000',
    textBackdropOpacity: scene.textBackdropOpacity ?? 45,
    textBackdropBlur: scene.textBackdropBlur ?? 18,
    textBackdropPadding: scene.textBackdropPadding ?? 24,
    textBackdropRadius: scene.textBackdropRadius ?? 16,
    textBackdropNoise: scene.textBackdropNoise ?? 8,
    textStrokeColor: scene.textStrokeColor ?? '#000000',
    textOutlineEnabled: scene.textOutlineEnabled ?? false,
    textStrokeWidth: scene.textStrokeWidth ?? 0,
    textShadowColor: scene.textShadowColor ?? '#000000',
    textShadowEnabled: scene.textShadowEnabled ?? false,
    textShadowIntensity: scene.textShadowIntensity ?? 60,
    textShadowBlur: scene.textShadowBlur ?? 0,
    textShadowOffsetX: scene.textShadowOffsetX ?? 0,
    textShadowOffsetY: scene.textShadowOffsetY ?? 0,
    textGlowEnabled: scene.textGlowEnabled ?? false,
    textGlowColor: scene.textGlowColor ?? '#FFFFFF',
    textGlowBlur: scene.textGlowBlur ?? 24,
    textGlowIntensity: scene.textGlowIntensity ?? 55,
    textX: scene.textX ?? DEFAULT_TEXT_X,
    textY: scene.textY ?? DEFAULT_TEXT_Y,
    textWidth: scene.textWidth ?? DEFAULT_TEXT_WIDTH,
    textAlign: scene.textAlign ?? 'left',
    textFont: scene.textFont ?? 'inter',
    textFontWeight: scene.textFontWeight ?? DEFAULT_TEXT_WEIGHT,
    textFontStyle: scene.textFontStyle ?? 'normal',
    textSize: scene.textSize ?? DEFAULT_TEXT_SIZE,
    textLineHeight: scene.textLineHeight ?? DEFAULT_TEXT_LINE_HEIGHT,
    textLetterSpacing: scene.textLetterSpacing ?? 0,
    textRotation: scene.textRotation ?? 0,
    textOpacity: scene.textOpacity ?? 100,
    textSubtitleScale: scene.textSubtitleScale ?? DEFAULT_TEXT_SUBTITLE_SCALE,
  });
}

function NumericField({
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  const [text, setText] = useState(formatNumber(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(formatNumber(value)); }, [value]);
  function change(raw: string) {
    setText(raw);
    if (raw.trim() === '' || raw === '-') return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) onChange(clamp(parsed, min, max));
  }
  function commit() {
    const parsed = text.trim() === '' || text === '-' ? Number.NaN : Number(text);
    const next = Number.isFinite(parsed) ? clamp(parsed, min, max) : value;
    setText(formatNumber(next));
    if (next !== value) onChange(next);
    onCommit();
  }
  return <span className="range-number-wrap">
    <input
      className="range-number"
      type="number"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={text}
      disabled={disabled}
      onFocus={() => { focused.current = true; }}
      onChange={event => change(event.target.value)}
      onBlur={() => { focused.current = false; commit(); }}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }}
    />
    {unit && <span className="range-unit">{unit}</span>}
  </span>;
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  return <div className={`range-field ${disabled ? 'disabled' : ''}`}>
    <div className="range-head">
      <span>{label}</span>
      <NumericField label={label} value={value} min={min} max={max} step={step} unit={unit} disabled={disabled} onChange={onChange} onCommit={onCommit} />
    </div>
    <input
      type="range"
      aria-label={`${label} slider`}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={event => onChange(Number(event.target.value))}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
    />
  </div>;
}

export function SceneForm({
  elementPanel, elementSelection, onDeselectElement,
  scene,
  update,
  onPreview,
  onCopyProperties,
  onPasteProperties,
  propertyClipboard,
  flushRef,
  timebase,
  textLayerId,
  onSelectTextLayer,
  textStartTicks = 0,
  playheadSeconds = 0,
  focusText = 0,
  framingActive = false,
  onToggleFraming = () => {},
  formatCount = 1,
  onApplyFramingToAll = () => {},
  overlays = [],
  onReorderLayer,
}: {
  elementPanel?: ReactNode;
  elementSelection?: string;
  onDeselectElement?: () => void;
  scene: Scene;
  update: (scene: Scene, force?: ScenePatchKey[]) => Promise<boolean> | void;
  onPreview: (scene: Scene | null) => void;
  onCopyProperties: (scene: Scene) => void;
  onPasteProperties: () => void;
  propertyClipboard: Partial<Scene> | null;
  flushRef?: MutableRefObject<() => void>;
  onReplaceImage?: () => void;
  timebase: Timebase;
  textLayerId: string | null;
  onSelectTextLayer: (id: string | null) => void;
  textStartTicks?: number;
  /** Scene-local playhead, used to capture keyframes. */
  playheadSeconds?: number;
  focusText?: number;
  framingActive?: boolean;
  onToggleFraming?: () => void;
  formatName?: string;
  formatCount?: number;
  onApplyFramingToAll?: () => void;
  overlays?: ElementLayer[];
  onReorderLayer?: (kind: 'text' | 'element' | 'overlay', id: string, z: number) => void;
}) {
  const [tab, setTab] = useState<Tab>('video');
  const [draft, setDraft] = useState(scene);
  const [dirty, setDirty] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const draftRef = useRef(draft), dirtyRef = useRef(dirty);
  const updateRef = useRef(update), previewRef = useRef(onPreview), sceneIdRef = useRef(scene.id);
  const committedRef = useRef(comparable(scene));
  const internalFlushRef = useRef<() => void>(() => {});
  draftRef.current = draft;
  dirtyRef.current = dirty;
  updateRef.current = update;
  previewRef.current = onPreview;

  function finishPreview(result: Promise<boolean> | void) {
    if (result && typeof result.then === 'function') void result.finally(() => previewRef.current(null));
    else previewRef.current(null);
  }

  function flushIfDirty() {
    if (!dirtyRef.current) return;
    const next = draftRef.current;
    setDirty(false);
    dirtyRef.current = false;
    const signature = comparable(next);
    if (signature !== committedRef.current) {
      committedRef.current = signature;
      finishPreview(updateRef.current(next));
    } else previewRef.current(null);
  }
  internalFlushRef.current = flushIfDirty;
  if (flushRef) flushRef.current = flushIfDirty;

  useEffect(() => {
    const changed = sceneIdRef.current !== scene.id;
    sceneIdRef.current = scene.id;
    if (changed) flushIfDirty();
    if (changed || !dirtyRef.current) {
      setDraft(scene);
      draftRef.current = scene;
      committedRef.current = comparable(scene);
      setDirty(false);
      dirtyRef.current = false;
      previewRef.current(null);
    }
  }, [scene]);

  useEffect(() => {
    const inspector = document.querySelector<HTMLElement>('.inspector');
    if (inspector) inspector.scrollTop = 0;
  }, [tab, scene.id]);

  useEffect(() => { if (elementSelection) setTab('elements'); else if (tab === 'elements') setTab('video'); }, [elementSelection]);

  useEffect(() => {
    if (focusText) setTab('text');
  }, [focusText]);

  useEffect(() => { if (scene.mediaKind !== 'video' && tab === 'speed') setTab('video'); }, [scene.mediaKind, tab]);

  useEffect(() => () => { internalFlushRef.current(); previewRef.current(null); }, []);

  function stage(patch: Partial<Scene>) {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    setDirty(true);
    dirtyRef.current = true;
    return next;
  }

  function preview(next: Scene) {
    previewRef.current(next);
  }

  function commit(next = draftRef.current) {
    setDirty(false);
    dirtyRef.current = false;
    const signature = comparable(next);
    if (signature !== committedRef.current) {
      committedRef.current = signature;
      finishPreview(updateRef.current(next));
    } else previewRef.current(null);
  }

  function apply(patch: Partial<Scene>, force: ScenePatchKey[] = []) {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    setDirty(false);
    dirtyRef.current = false;
    const signature = comparable(next);
    if (signature !== committedRef.current || force.length) {
      committedRef.current = signature;
      finishPreview(updateRef.current(next, force));
    } else previewRef.current(null);
  }

  function stageDuration(value: number) {
    const resized = setSceneSeconds(draftRef.current, value, timebase);
    const next = stage({ durationTicks: resized.durationTicks, fadeIn: resized.fadeIn, fadeOut: resized.fadeOut });
    preview(next);
  }

  function speedPatch(target: number): Partial<Scene> {
    const baseDuration = sceneSeconds(draftRef.current, timebase) * (draftRef.current.speed ?? 1);
    const duration = clamp(baseDuration / target, 0.5, draftRef.current.mediaKind === 'video' ? 600 : 30);
    const resized = setSceneSeconds(draftRef.current, duration, timebase);
    return {
      speed: target,
      durationTicks: resized.durationTicks,
      fadeIn: resized.fadeIn,
      fadeOut: resized.fadeOut,
    };
  }

  function stageSpeed(target: number) {
    const next = stage(speedPatch(target));
    preview(next);
  }

  function applySpeed(target: number) {
    apply(speedPatch(target), ['speed']);
  }

  function stageColor(key: ColorKey, value: number) {
    preview(stage({ [key]: value } as Partial<Scene>));
  }

  const layers = draft.textLayers ?? [];
  const selectedLayer = layers.find(layer => layer.id === textLayerId) ?? layers[0] ?? null;
  const sceneDurationTicks = draft.durationTicks;
  const stack = sceneStack(draft, overlaysForScene(draft, overlays));
  const selectedLayerStackAt = selectedLayer ? stackIndex(stack, 'text', selectedLayer.id) + 1 : 0;

  function moveTextLayer(move: StackMove) {
    if (!selectedLayer) return;
    const z = stackZ(stack, 'text', selectedLayer.id, move);
    if (z === null) return;
    // Staged text edits ride along with the scene update; a clean layer uses the
    // lightweight order command, which never sends the scene's photo to Rust.
    if (!onReorderLayer || dirtyRef.current) { applyLayer({ z }); return; }
    onReorderLayer('text', selectedLayer.id, z);
  }

  function withLayers(nextLayers: TextLayer[]): Partial<Scene> {
    return { textLayers: nextLayers, title: nextLayers[0]?.title ?? '', subtitle: nextLayers[0]?.subtitle ?? '' };
  }

  function stageLayer(patch: Partial<TextLayer>) {
    const id = selectedLayer?.id;
    if (!id) return;
    const nextLayers = (draftRef.current.textLayers ?? []).map(layer => layer.id === id ? { ...layer, ...patch } : layer);
    const next = stage(withLayers(nextLayers));
    preview(next);
    return next;
  }

  function applyLayer(patch: Partial<TextLayer>) {
    const id = selectedLayer?.id;
    if (!id) return;
    const nextLayers = (draftRef.current.textLayers ?? []).map(layer => layer.id === id ? { ...layer, ...patch } : layer);
    apply(withLayers(nextLayers), ['textLayers']);
  }

  function replaceLayers(nextLayers: TextLayer[]) {
    apply(withLayers(nextLayers), ['textLayers']);
  }

  function addTextLayer() {
    if (layers.length >= MAX_TEXT_LAYERS) return;
    const duration = draftRef.current.durationTicks;
    const startTicks = Math.min(Math.max(0, textStartTicks), Math.max(0, duration - 1));
    const layer = createTextLayer(Math.max(1, duration - startTicks), { startTicks });
    replaceLayers([...(draftRef.current.textLayers ?? []), layer]);
    onSelectTextLayer(layer.id);
  }

  function removeTextLayer(id: string) {
    const nextLayers = (draftRef.current.textLayers ?? []).filter(layer => layer.id !== id);
    replaceLayers(nextLayers);
    onSelectTextLayer(nextLayers[0]?.id ?? null);
  }

  function resetTextStyle() {
    if (!selectedLayer) return;
    applyLayer({ ...TEXT_STYLE_DEFAULTS });
  }

  function resetTextTiming() {
    applyLayer({ startTicks: 0, durationTicks: sceneDurationTicks });
  }

  function stageLayerStart(seconds: number) {
    if (!selectedLayer) return;
    const maxStart = Math.max(0, sceneDurationTicks - 1);
    const startTicks = Math.min(secondsToTicks(seconds, timebase), maxStart);
    const durationTicks = Math.max(1, Math.min(selectedLayer.durationTicks, sceneDurationTicks - startTicks));
    stageLayer({ startTicks, durationTicks });
  }

  function stageLayerDuration(seconds: number) {
    if (!selectedLayer) return;
    const durationTicks = Math.max(1, Math.min(secondsToTicks(seconds, timebase), sceneDurationTicks - selectedLayer.startTicks));
    stageLayer({ durationTicks });
  }

  function applyTemplate(preset: TemplatePreset) {
    applyLayer(preset.patch);
  }

  function templateActive(preset: TemplatePreset) {
    if (!selectedLayer) return false;
    return Object.entries(preset.patch).every(([key, value]) => (selectedLayer as unknown as Record<string, unknown>)[key] === value);
  }

  function toggleBackdrop(enabled: boolean) {
    applyLayer({ backdropEnabled: enabled });
  }

  function toggleOutline(enabled: boolean) {
    const width = selectedLayer?.strokeWidth ?? 0;
    applyLayer(enabled && width <= 0 ? { outlineEnabled: true, strokeWidth: 2 } : { outlineEnabled: enabled });
  }

  function toggleGlow(enabled: boolean) {
    const blur = selectedLayer?.glowBlur ?? 0;
    const intensity = selectedLayer?.glowIntensity ?? 0;
    applyLayer({
      glowEnabled: enabled,
      ...(enabled && blur <= 0 ? { glowBlur: 24 } : {}),
      ...(enabled && intensity <= 0 ? { glowIntensity: 55 } : {}),
    });
  }

  function toggleShadow(enabled: boolean) {
    const blur = selectedLayer?.shadowBlur ?? 0;
    const x = selectedLayer?.shadowOffsetX ?? 0;
    const y = selectedLayer?.shadowOffsetY ?? 0;
    applyLayer({
      shadowEnabled: enabled,
      ...(enabled && blur <= 0 && x === 0 && y === 0 ? { shadowBlur: 8, shadowOffsetY: 2 } : {}),
    });
  }

  const speed = draft.speed ?? 1;
  const duration = sceneSeconds(draft, timebase);
  const activeFilter = draft.filter ?? 'none';
  const filterIntensity = draft.filterIntensity ?? 100;
  const filteredFilters = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return FILTERS;
    return FILTERS.filter(filter => `${filter.label} ${filter.description}`.toLowerCase().includes(query));
  }, [filterQuery]);

  return <>
    <div className="inspector-icon-tabs" role="tablist" aria-label="Scene inspector">
      {([
        ['elements', 'Element', Shapes], ['video', 'Framing', Crop], ['text', 'Text', Type], ['transition', 'Transitions', Blend],
        ['color', 'Color', SlidersHorizontal], ['speed', 'Speed', Gauge], ['fade', 'Fades', SunDim], ['filters', 'Looks', Wand2],
      ] as const).filter(([id]) => (id !== 'elements' || Boolean(elementSelection)) && (id !== 'speed' || draft.mediaKind === 'video')).map(([value, label, Icon]) => <button key={value} role="tab" aria-label={label} title={label} aria-selected={tab === value} className={tab === value ? 'active' : ''} onClick={() => { internalFlushRef.current(); setTab(value); if (value !== 'elements') onDeselectElement?.(); if (value !== 'video' && framingActive) onToggleFraming(); }}><Icon size={18} /></button>)}
    </div>
    <div className="inspector-current-tool">{({ elements: 'Element', video: 'Framing', text: 'Text', transition: 'Transitions', color: 'Color', speed: 'Speed', fade: 'Fades', filters: 'Looks' })[tab]}</div>

    {tab === 'elements' && elementPanel}

    {tab === 'video' && <>
      <RangeField label="Duration" value={duration} min={0.5} max={draft.mediaKind === 'video' ? 600 : 30} step={0.1} unit="s" onChange={stageDuration} onCommit={() => commit()} />
      <div className="framing-modes" role="group" aria-label="Image framing">{([['cover', 'Fill', Crop], ['contain', 'Fit', Maximize2], ['blur', 'Blur fill', Blend]] as const).map(([fit, label, Icon]) => <button key={fit} aria-pressed={draft.fit === fit} className={draft.fit === fit ? 'active' : ''} onClick={() => apply({ fit }, ['fit'])}><Icon size={16} />{label}</button>)}</div>
      <div className="range-field"><div className="range-head"><span>Zoom</span><span className="range-value">{Math.round((draft.imageZoom ?? 1) * 100)}%</span></div><input aria-label="Image zoom" type="range" min="100" max="400" step="1" value={Math.round((draft.imageZoom ?? 1) * 100)} onChange={event => preview(stage({ imageZoom: Number(event.target.value) / 100 }))} onPointerUp={() => commit()} onKeyUp={() => commit()} /></div>
      <div className="framing-actions">
        <button className={`button ${framingActive ? 'active' : ''}`} aria-pressed={framingActive} onClick={onToggleFraming}><Move size={15} /> Reposition</button>
        <button className="icon-button" title="Center image" aria-label="Center image" onClick={() => apply({ imageX: 0, imageY: 0 })}><Maximize2 size={16} /></button>
        <button className="icon-button" title="Reset framing" aria-label="Reset framing" onClick={() => apply({ imageX: 0, imageY: 0, imageZoom: 1, framingBackground: '#000000' })}><RotateCcw size={16} /></button>
      </div>
      {draft.fit === 'contain' && <label className="field color-field">Background<input aria-label="Image background color" type="color" value={draft.framingBackground ?? '#000000'} onChange={event => preview(stage({ framingBackground: event.target.value }))} onBlur={() => commit()} /></label>}
      <details className="inspector-disclosure"><summary>Position</summary>
        <RangeField label="Horizontal" value={Math.round((draft.imageX ?? 0) * 100)} min={-100} max={100} step={1} onChange={value => preview(stage({ imageX: value / 100 }))} onCommit={() => commit()} />
        <RangeField label="Vertical" value={Math.round((draft.imageY ?? 0) * 100)} min={-100} max={100} step={1} onChange={value => preview(stage({ imageY: value / 100 }))} onCommit={() => commit()} />
      </details>
      {draft.mediaKind !== 'video' && <details className="inspector-disclosure"><summary>Camera movement <small>{draft.motion && draft.motion !== 'none' ? draft.motion.replaceAll('-', ' ') : 'None'}</small></summary>
        <label className="field">Motion<select value={draft.motion ?? 'none'} onChange={event => apply({ motion: event.target.value as Scene['motion'] })}><option value="none">None</option><option value="zoom-in">Zoom in</option><option value="zoom-out">Zoom out</option><option value="pan-left">Pan left</option><option value="pan-right">Pan right</option><option value="pan-up">Pan up</option><option value="pan-down">Pan down</option><option value="ken-burns">Ken Burns</option></select></label>
        {(draft.motion ?? 'none') !== 'none' && <RangeField label="Amount" value={(draft.motionAmount ?? .2) * 100} min={5} max={60} step={1} unit="%" onChange={value => preview(stage({ motionAmount: value / 100 }))} onCommit={() => commit()} />}
      </details>}
      {formatCount > 1 && <button className="text-button format-apply" onClick={onApplyFramingToAll}>Apply framing to all formats</button>}
    </>}

    {tab === 'text' && <>
      {layers.length > 0 && <div className="text-layer-list">
        {layers.map((layer, index) => <div className={`text-layer-item ${selectedLayer?.id === layer.id ? 'active' : ''}`} key={layer.id}>
          <button className="text-layer-select" onClick={() => onSelectTextLayer(layer.id)} aria-pressed={selectedLayer?.id === layer.id}>
            <Type size={14} />
            <span><strong>{layer.title || `Text layer ${index + 1}`}</strong><small>{layerTimingLabel(layer, timebase)}</small></span>
          </button>
          <button className="icon-button" aria-label={`Delete ${layer.title || `text layer ${index + 1}`}`} onClick={() => removeTextLayer(layer.id)}><Trash2 size={14} /></button>
        </div>)}
      </div>}
      {layers.length > 0 && <button type="button" className="button text-add-layer" onClick={addTextLayer} disabled={layers.length >= MAX_TEXT_LAYERS}><Plus size={14} /> Add text layer <span>{layers.length}/{MAX_TEXT_LAYERS}</span></button>}

      {selectedLayer ? <>
        <label className="field">Text<textarea aria-label="Text layer content" maxLength={120} rows={3} placeholder="Give this moment a title…" value={selectedLayer.title} onChange={event => stageLayer({ title: event.target.value })} onBlur={() => commit()} /></label>
        <label className="field">Subtitle<input aria-label="Text layer subtitle" maxLength={200} placeholder="A little more to the story" value={selectedLayer.subtitle} onChange={event => stageLayer({ subtitle: event.target.value })} onBlur={() => commit()} /></label>
        <label className="field color-field">Text color<input aria-label="Text layer color" type="color" value={selectedLayer.color} onChange={event => stageLayer({ color: event.target.value })} onBlur={() => commit()} /><span>{selectedLayer.color.toUpperCase()}</span></label>
        {stack.length > 1 && <StackOrder position={selectedLayerStackAt} total={stack.length} onMove={moveTextLayer} />}

        <details className="advanced-disclosure text-layout-panel">
          <summary>Timing</summary>
          <RangeField label="Appears at" value={ticksToSeconds(selectedLayer.startTicks, timebase)} min={0} max={ticksToSeconds(Math.max(0, sceneDurationTicks - 1), timebase)} step={0.1} unit="sec" onChange={stageLayerStart} onCommit={() => commit()} />
          <RangeField label="Visible for" value={ticksToSeconds(selectedLayer.durationTicks, timebase)} min={Math.max(0.1, ticksToSeconds(1, timebase))} max={ticksToSeconds(Math.max(1, sceneDurationTicks - selectedLayer.startTicks), timebase)} step={0.1} unit="sec" onChange={stageLayerDuration} onCommit={() => commit()} />
          <button className="text-button" onClick={resetTextTiming}>Reset timing</button>
        </details>

        <KeyframeControls
          layer={selectedLayer}
          playheadSeconds={Math.max(0, playheadSeconds - ticksToSeconds(selectedLayer.startTicks, timebase))}
          durationSeconds={ticksToSeconds(selectedLayer.durationTicks, timebase)}
          onChange={keyframes => applyLayer({ keyframes })}
        />

        <details className="advanced-disclosure text-layout-panel">
          <summary>Animation</summary>
          <label className="field">Entrance & exit<select aria-label="Text animation" value={selectedLayer.animation} onChange={event => applyLayer({ animation: event.target.value as TextAnimation })}>{TEXT_ANIMATIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <RangeField label="Animation speed" value={selectedLayer.animationDuration} min={0.1} max={2} step={0.1} unit="sec" disabled={selectedLayer.animation === 'none'} onChange={value => stageLayer({ animationDuration: value })} onCommit={() => commit()} />
        </details>

        <details className="inspector-disclosure"><summary>Typography</summary><div className="text-typography">
          <label className="field">Font<select aria-label="Text font" value={selectedLayer.font} onChange={event => { const id = event.target.value; applyLayer({ font: id, fontWeight: clampWeight(selectedLayer.fontWeight, id), fontStyle: fontOption(id).italic ? selectedLayer.fontStyle : 'normal' }); }}>{FONTS.map(font => <option key={font.id} value={font.id}>{font.label} · {font.category}</option>)}</select></label>
          <p className="font-preview" style={{ fontFamily: fontOption(selectedLayer.font).family, fontWeight: clampWeight(selectedLayer.fontWeight, selectedLayer.font), fontStyle: selectedLayer.fontStyle }}>{selectedLayer.title || 'The little moments'}</p>
          <RangeField label="Text size" value={Math.round(selectedLayer.size * 1080)} min={16} max={240} step={1} unit="px" onChange={value => stageLayer({ size: value / 1080 })} onCommit={() => commit()} />
          <div className="text-style-row">
            <label className="field">Weight<select aria-label="Text weight" value={clampWeight(selectedLayer.fontWeight, selectedLayer.font)} onChange={event => applyLayer({ fontWeight: Number(event.target.value) })}>{fontWeights(selectedLayer.font).map(weight => <option key={weight} value={weight}>{weight}</option>)}</select></label>
            <button className={`button text-italic ${selectedLayer.fontStyle === 'italic' ? 'active' : ''}`} disabled={!fontOption(selectedLayer.font).italic} aria-pressed={selectedLayer.fontStyle === 'italic'} onClick={() => applyLayer({ fontStyle: selectedLayer.fontStyle === 'italic' ? 'normal' : 'italic' })}><span>I</span> Italic</button>
          </div>
          <div className="text-align-row" role="group" aria-label="Text alignment">
            {(['left', 'center', 'right'] as const).map(value => <button key={value} className={`button ${selectedLayer.align === value ? 'active' : ''}`} aria-label={`Align text ${value}`} aria-pressed={selectedLayer.align === value} onClick={() => applyLayer({ align: value })}>{value === 'left' ? <AlignLeft size={14} /> : value === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}</button>)}
          </div>
          <details className="advanced-disclosure text-layout-panel">
            <summary>Position & spacing</summary>
            <RangeField label="X position" value={selectedLayer.x * 100} min={0} max={100} step={1} unit="%" onChange={value => stageLayer({ x: value / 100 })} onCommit={() => commit()} />
            <RangeField label="Y position" value={selectedLayer.y * 100} min={0} max={100} step={1} unit="%" onChange={value => stageLayer({ y: value / 100 })} onCommit={() => commit()} />
            <RangeField label="Text width" value={selectedLayer.width * 100} min={15} max={100} step={1} unit="%" onChange={value => stageLayer({ width: value / 100 })} onCommit={() => commit()} />
            <RangeField label="Rotation" value={selectedLayer.rotation} min={-180} max={180} step={1} unit="°" onChange={value => stageLayer({ rotation: value })} onCommit={() => commit()} />
            <RangeField label="Line height" value={selectedLayer.lineHeight} min={0.8} max={3} step={0.05} onChange={value => stageLayer({ lineHeight: value })} onCommit={() => commit()} />
            <RangeField label="Letter spacing" value={Math.round(selectedLayer.letterSpacing * 1080)} min={-20} max={80} step={1} unit="px" onChange={value => stageLayer({ letterSpacing: value / 1080 })} onCommit={() => commit()} />
            <RangeField label="Text opacity" value={selectedLayer.opacity} min={0} max={100} step={1} unit="%" onChange={value => stageLayer({ opacity: value })} onCommit={() => commit()} />
            <RangeField label="Subtitle size" value={selectedLayer.subtitleScale * 100} min={20} max={100} step={1} unit="%" onChange={value => stageLayer({ subtitleScale: value / 100 })} onCommit={() => commit()} />
          </details>
        </div></details>
        <div className="text-effect-quick">
          <button className="button primary" onClick={() => applyLayer(LEGIBLE_TEXT)}><Sparkles size={13} /> Make text readable</button>
          <button className="text-button" onClick={resetTextStyle}>Reset styling</button>
        </div>
        <details className="advanced-disclosure text-effects-panel">
          <summary>Customize text effects</summary>

          <div className="text-effect-group">
            <div className="text-effect-group-head">
              <label className="checkbox-field"><input type="checkbox" checked={selectedLayer.backdropEnabled} onChange={event => toggleBackdrop(event.target.checked)} /> Backdrop</label>
              <span className="tiny-label">Frosted plate</span>
            </div>
            <div className="text-style-grid">{BACKDROP_PRESETS.map(preset => <TemplateCard key={preset.label} kind="backdrop" preset={preset} active={templateActive(preset)} onApply={() => applyTemplate(preset)} />)}</div>
            <label className="field color-field">Backdrop color<input aria-label="Text backdrop color" type="color" disabled={!selectedLayer.backdropEnabled} value={selectedLayer.backdropColor} onChange={event => stageLayer({ backdropColor: event.target.value })} onBlur={() => commit()} /><span>{selectedLayer.backdropColor.toUpperCase()}</span></label>
            <RangeField label="Backdrop opacity" value={selectedLayer.backdropOpacity} min={0} max={100} step={1} unit="%" disabled={!selectedLayer.backdropEnabled} onChange={value => stageLayer({ backdropOpacity: value })} onCommit={() => commit()} />
            <RangeField label="Backdrop blur" value={selectedLayer.backdropBlur} min={0} max={60} step={1} unit="px" disabled={!selectedLayer.backdropEnabled} onChange={value => stageLayer({ backdropBlur: value })} onCommit={() => commit()} />
            <RangeField label="Backdrop padding" value={selectedLayer.backdropPadding} min={0} max={80} step={1} unit="px" disabled={!selectedLayer.backdropEnabled} onChange={value => stageLayer({ backdropPadding: value })} onCommit={() => commit()} />
            <RangeField label="Backdrop radius" value={selectedLayer.backdropRadius} min={0} max={60} step={1} unit="px" disabled={!selectedLayer.backdropEnabled} onChange={value => stageLayer({ backdropRadius: value })} onCommit={() => commit()} />
            <RangeField label="Backdrop noise" value={selectedLayer.backdropNoise} min={0} max={100} step={1} unit="%" disabled={!selectedLayer.backdropEnabled} onChange={value => stageLayer({ backdropNoise: value })} onCommit={() => commit()} />
          </div>

          <div className="text-effect-group">
            <div className="text-effect-group-head">
              <label className="checkbox-field"><input type="checkbox" checked={selectedLayer.outlineEnabled} onChange={event => toggleOutline(event.target.checked)} /> Outline</label>
              <span className="tiny-label">Crisp edge</span>
            </div>
            <div className="text-style-grid">{OUTLINE_PRESETS.map(preset => <TemplateCard key={preset.label} kind="outline" preset={preset} active={templateActive(preset)} onApply={() => applyTemplate(preset)} />)}</div>
            <label className="field color-field">Outline color<input aria-label="Text outline color" type="color" disabled={!selectedLayer.outlineEnabled} value={selectedLayer.strokeColor} onChange={event => stageLayer({ strokeColor: event.target.value })} onBlur={() => commit()} /><span>{selectedLayer.strokeColor.toUpperCase()}</span></label>
            <RangeField label="Outline width" value={selectedLayer.strokeWidth} min={0} max={12} step={0.5} unit="px" disabled={!selectedLayer.outlineEnabled} onChange={value => stageLayer({ strokeWidth: value })} onCommit={() => commit()} />
          </div>

          <div className="text-effect-group">
            <div className="text-effect-group-head">
              <label className="checkbox-field"><input type="checkbox" checked={selectedLayer.glowEnabled} onChange={event => toggleGlow(event.target.checked)} /> Glow</label>
              <span className="tiny-label">Soft halo</span>
            </div>
            <div className="text-style-grid">{GLOW_PRESETS.map(preset => <TemplateCard key={preset.label} kind="glow" preset={preset} active={templateActive(preset)} onApply={() => applyTemplate(preset)} />)}</div>
            <label className="field color-field">Glow color<input aria-label="Text glow color" type="color" disabled={!selectedLayer.glowEnabled} value={selectedLayer.glowColor} onChange={event => stageLayer({ glowColor: event.target.value })} onBlur={() => commit()} /><span>{selectedLayer.glowColor.toUpperCase()}</span></label>
            <RangeField label="Glow blur" value={selectedLayer.glowBlur} min={0} max={80} step={1} unit="px" disabled={!selectedLayer.glowEnabled} onChange={value => stageLayer({ glowBlur: value })} onCommit={() => commit()} />
            <RangeField label="Glow intensity" value={selectedLayer.glowIntensity} min={0} max={100} step={1} unit="%" disabled={!selectedLayer.glowEnabled} onChange={value => stageLayer({ glowIntensity: value })} onCommit={() => commit()} />
          </div>

          <div className="text-effect-group">
            <div className="text-effect-group-head">
              <label className="checkbox-field"><input type="checkbox" checked={selectedLayer.shadowEnabled} onChange={event => toggleShadow(event.target.checked)} /> Drop shadow</label>
              <span className="tiny-label">Depth</span>
            </div>
            <div className="text-style-grid">{SHADOW_PRESETS.map(preset => <TemplateCard key={preset.label} kind="shadow" preset={preset} active={templateActive(preset)} onApply={() => applyTemplate(preset)} />)}</div>
            <label className="field color-field">Shadow color<input aria-label="Text shadow color" type="color" disabled={!selectedLayer.shadowEnabled} value={selectedLayer.shadowColor} onChange={event => stageLayer({ shadowColor: event.target.value })} onBlur={() => commit()} /><span>{selectedLayer.shadowColor.toUpperCase()}</span></label>
            <RangeField label="Shadow blur" value={selectedLayer.shadowBlur} min={0} max={60} step={1} unit="px" disabled={!selectedLayer.shadowEnabled} onChange={value => stageLayer({ shadowBlur: value })} onCommit={() => commit()} />
            <RangeField label="Shadow intensity" value={selectedLayer.shadowIntensity} min={0} max={100} step={1} unit="%" disabled={!selectedLayer.shadowEnabled} onChange={value => stageLayer({ shadowIntensity: value })} onCommit={() => commit()} />
            <RangeField label="Shadow offset X" value={selectedLayer.shadowOffsetX} min={-40} max={40} step={1} unit="px" disabled={!selectedLayer.shadowEnabled} onChange={value => stageLayer({ shadowOffsetX: value })} onCommit={() => commit()} />
            <RangeField label="Shadow offset Y" value={selectedLayer.shadowOffsetY} min={-40} max={40} step={1} unit="px" disabled={!selectedLayer.shadowEnabled} onChange={value => stageLayer({ shadowOffsetY: value })} onCommit={() => commit()} />
          </div>
        </details>
      </> : <div className="library-empty compact"><Type size={28} /><strong>No text on this scene yet.</strong><p>Add a layer, then place it in the preview and choose when it appears.</p><button type="button" className="button primary text-add-layer" onClick={addTextLayer}><Plus size={14} /> Add text layer</button></div>}
    </>}

    {tab === 'transition' && <>
      <div className="transition-grid">{TRANSITION_OPTIONS.map(option => <button key={option.id} className={`transition-card ${(draft.transition?.type ?? 'none') === option.id ? 'active' : ''}`} onClick={() => apply({ transition: option.id === 'none' ? null : { type: option.id, duration: draft.transition?.duration ?? .6 } }, ['transition'])}><span className={`transition-swatch ${option.id}`} /><strong>{option.label}</strong><small>{option.description}</small></button>)}</div>
      <RangeField label="Transition duration" value={draft.transition?.duration ?? .6} min={0.1} max={Math.min(2, duration / 2)} step={0.1} unit="sec" disabled={!draft.transition} onChange={value => preview(stage({ transition: { type: draft.transition?.type ?? 'fade', duration: value } }))} onCommit={() => commit()} />
    </>}

    {tab === 'color' && <>
      <div className="color-summary">
        <span>{activeFilter === 'none' ? 'Original look' : `Look: ${FILTERS.find(filter => filter.id === activeFilter)?.label} · ${Math.round(filterIntensity)}%`}</span>
        <span className="tiny-label">Non-destructive</span>
      </div>
      {COLOR_CONTROLS.map(control => <RangeField
        key={control.key}
        label={control.label}
        value={draft[control.key] ?? (control.key === 'brightness' || control.key === 'contrast' || control.key === 'saturation' ? 1 : 0)}
        min={control.min}
        max={control.max}
        step={control.step}
        onChange={value => stageColor(control.key, value)}
        onCommit={() => commit()}
      />)}
      <div className="property-actions">
        <button className="button" onClick={() => apply(COLOR_DEFAULTS, COLOR_KEYS)}><RotateCcw size={13} /> Reset color</button>
        <button className="button" onClick={() => onCopyProperties(draftRef.current)}><Copy size={13} /> Copy</button>
        <button className="button" onClick={() => { if (propertyClipboard) { apply(propertyClipboard, Object.keys(propertyClipboard) as ScenePatchKey[]); onPasteProperties(); } }} disabled={!propertyClipboard}><ClipboardPaste size={13} /> Paste</button>
      </div>
    </>}

    {tab === 'speed' && draft.mediaKind === 'video' && <>
      <div className="speed-presets">{SPEED_PRESETS.map(value => <button key={value} className={`button ${Math.abs(speed - value) < 0.01 ? 'active' : ''}`} onClick={() => applySpeed(value)}>{value}×</button>)}</div>
      <RangeField label="Speed" value={speed} min={0.25} max={4} step={0.05} unit="×" onChange={stageSpeed} onCommit={() => applySpeed(draftRef.current.speed ?? 1)} />
      <RangeField label="Clip sound" value={draft.videoVolume ?? 100} min={0} max={100} step={1} unit="%" onChange={value => stage({ videoVolume: value })} onCommit={() => commit()} />
      <label className="checkbox-field"><input type="checkbox" checked={(draft.videoVolume ?? 100) > 0} onChange={event => apply({ videoVolume: event.target.checked ? 100 : 0 }, ['videoVolume'])} /> Play the clip's own audio</label>
      <p className="inspector-inline-status">Duration · {duration.toFixed(1)} s</p>
    </>}

    {tab === 'fade' && <>
      <div className="fade-preview" aria-hidden="true">
        <span className="fade-preview-in" style={{ width: `${Math.min(100, ((draft.fadeIn ?? 0) / duration) * 100)}%` }} />
        <span className="fade-preview-out" style={{ width: `${Math.min(100, ((draft.fadeOut ?? 0) / duration) * 100)}%` }} />
        <span className="fade-preview-center" />
      </div>
      <RangeField label="Fade in" value={draft.fadeIn ?? 0} min={0} max={duration} step={0.1} unit="sec" onChange={value => preview(stage({ fadeIn: value }))} onCommit={() => commit()} />
      <RangeField label="Fade out" value={draft.fadeOut ?? 0} min={0} max={duration} step={0.1} unit="sec" onChange={value => preview(stage({ fadeOut: value }))} onCommit={() => commit()} />
      {(draft.fadeIn ?? 0) + (draft.fadeOut ?? 0) > duration && <p className="fade-warning">Fade in and fade out overlap. The clip may not reach full opacity.</p>}
    </>}

    {tab === 'filters' && <>
      <label className="search-field"><Search size={14} /><input aria-label="Search filters" placeholder="Search looks…" value={filterQuery} onChange={event => setFilterQuery(event.target.value)} /></label>
      <div className="filter-grid">
        {filteredFilters.map(filter => <button
          key={filter.id}
          className={`filter-card ${activeFilter === filter.id ? 'selected' : ''}`}
          onClick={() => apply({ filter: filter.id, filterIntensity: filter.id === 'none' ? 100 : filterIntensity }, ['filter', 'filterIntensity'])}
          onMouseEnter={() => preview({ ...draftRef.current, filter: filter.id, filterIntensity: filter.id === 'none' ? 100 : filterIntensity })}
          onMouseLeave={() => previewRef.current(null)}
          onFocus={() => preview({ ...draftRef.current, filter: filter.id, filterIntensity: filter.id === 'none' ? 100 : filterIntensity })}
          onBlur={() => previewRef.current(null)}
        >
          <span className="filter-thumb"><img src={draft.image} alt="" style={{ filter: thumbnailFilterCss(filter.id, filter.id === 'none' ? 0 : 100) }} />{activeFilter === filter.id && <span className="filter-check"><Check size={11} /></span>}</span>
          <span className="filter-name">{filter.label}</span>
          <small>{filter.description}</small>
        </button>)}
      </div>
      {!filteredFilters.length && <div className="library-empty compact"><Search size={24} /><strong>No matching look.</strong><p>Try “warm”, “mono”, or clear the search.</p></div>}
      <RangeField label="Filter intensity" value={filterIntensity} min={0} max={100} step={1} unit="%" disabled={activeFilter === 'none'} onChange={value => preview(stage({ filterIntensity: value }))} onCommit={() => commit()} />
      {activeFilter === 'none' && <p className="note">Choose a look to adjust intensity. Original is always first and never changes the source image.</p>}
      <p className="note"><Sparkles size={14} /><span>Hover or focus a look to preview it in the main viewer. Click to apply.</span></p>
    </>}
  </>;
}
