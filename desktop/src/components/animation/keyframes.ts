import { MAX_KEYFRAMES, type ElementLayer, type FramingKeyframe, type Keyframe, type TextLayer } from '../../stores/model';
import { sampleTrack } from './sample';

/**
 * Keyframes animate the layer's own geometry over its visible time. Times are
 * seconds from the layer's start, and each property interpolates linearly
 * between the frames that set it; properties a frame leaves out keep the
 * layer's static value, so a frame can move without touching the opacity.
 */
export type MotionFrame = { x: number; y: number; rotation: number; opacity: number; scale: number };

type Animatable = { x: number; y: number; rotation: number; opacity: number; keyframes?: Keyframe[] };

/** The layer's animated geometry at `at` seconds from its start. */
export function motionAt(layer: Animatable, at: number): MotionFrame {
  const frames = (layer.keyframes ?? []).filter(frame => Number.isFinite(frame.at)).sort((a, b) => a.at - b.at);
  if (!frames.length || !Number.isFinite(at)) return { x: layer.x, y: layer.y, rotation: layer.rotation, opacity: layer.opacity, scale: 1 };
  return {
    x: sampleTrack(frames, 'x', at, layer.x),
    y: sampleTrack(frames, 'y', at, layer.y),
    rotation: sampleTrack(frames, 'rotation', at, layer.rotation),
    opacity: sampleTrack(frames, 'opacity', at, layer.opacity),
    scale: sampleTrack(frames, 'scale', at, 1),
  };
}

export function applyTextMotion(layer: TextLayer, at: number): TextLayer {
  if (!layer.keyframes?.length) return layer;
  const frame = motionAt(layer, at);
  return { ...layer, x: frame.x, y: frame.y, rotation: frame.rotation, opacity: frame.opacity, size: layer.size * frame.scale };
}

export function applyElementMotion(element: ElementLayer, at: number): ElementLayer {
  if (!element.keyframes?.length) return element;
  const frame = motionAt(element, at);
  return { ...element, x: frame.x, y: frame.y, rotation: frame.rotation, opacity: frame.opacity, width: element.width * frame.scale, height: element.height * frame.scale };
}

/** Adds or replaces the keyframe at `at`, keeping the list sorted and bounded. */
export function upsertKeyframe(keyframes: Keyframe[] | undefined, at: number, frame: Omit<Keyframe, 'at'>): Keyframe[] {
  const time = Math.round(Math.max(0, Number.isFinite(at) ? at : 0) * 100) / 100;
  const next = (keyframes ?? []).filter(key => Math.abs(key.at - time) > .005);
  next.push({ at: time, ...frame });
  next.sort((a, b) => a.at - b.at);
  return next.slice(0, MAX_KEYFRAMES);
}

export function removeKeyframe(keyframes: Keyframe[] | undefined, at: number): Keyframe[] | undefined {
  const next = (keyframes ?? []).filter(key => Math.abs(key.at - at) > .005);
  return next.length ? next : undefined;
}

export function keyframeAtPlayhead(layer: Animatable, localSeconds: number, durationSeconds: number): { at: number; frame: Omit<Keyframe, 'at'> } {
  const at = Math.min(Math.max(0, localSeconds), Math.max(0, durationSeconds));
  const frame = motionAt(layer, at);
  return { at, frame: { x: frame.x, y: frame.y, rotation: frame.rotation, opacity: frame.opacity, scale: frame.scale } };
}

export type FramingFrame = { x: number; y: number; zoom: number };

/** Resolves a photo's pan/zoom at `at` seconds from the scene start. */
export function framingAt(scene: { imageX?: number; imageY?: number; imageZoom?: number; framingKeyframes?: FramingKeyframe[] }, at: number): FramingFrame {
  const frames = (scene.framingKeyframes ?? []).filter(frame => Number.isFinite(frame.at)).sort((a, b) => a.at - b.at);
  return {
    x: sampleTrack(frames, 'x', at, scene.imageX ?? 0),
    y: sampleTrack(frames, 'y', at, scene.imageY ?? 0),
    zoom: sampleTrack(frames, 'zoom', at, scene.imageZoom ?? 1),
  };
}

export function upsertFramingKeyframe(frames: FramingKeyframe[] | undefined, at: number, values: Omit<FramingKeyframe, 'at'>): FramingKeyframe[] {
  const time = Math.round(Math.max(0, Number.isFinite(at) ? at : 0) * 100) / 100;
  const next = (frames ?? []).filter(frame => Math.abs(frame.at - time) > .005);
  next.push({ at: time, ...values });
  next.sort((a, b) => a.at - b.at);
  return next.slice(0, MAX_KEYFRAMES);
}

export function removeFramingKeyframe(frames: FramingKeyframe[] | undefined, at: number): FramingKeyframe[] | undefined {
  const next = (frames ?? []).filter(frame => Math.abs(frame.at - at) > .005);
  return next.length ? next : undefined;
}

/** Captures the photo's current framing as a keyframe at the playhead. */
export function framingKeyframeAt(scene: Parameters<typeof framingAt>[0], localSeconds: number, durationSeconds: number): FramingKeyframe {
  const at = Math.min(Math.max(0, localSeconds), Math.max(0, durationSeconds));
  const frame = framingAt(scene, at);
  return { at, x: frame.x, y: frame.y, zoom: frame.zoom };
}
