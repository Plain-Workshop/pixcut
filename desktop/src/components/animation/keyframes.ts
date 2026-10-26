import { MAX_KEYFRAMES, type ElementLayer, type Keyframe, type TextLayer } from '../../stores/model';

/**
 * Keyframes animate the layer's own geometry over its visible time. Times are
 * seconds from the layer's start, and each property interpolates linearly
 * between the frames that set it; properties a frame leaves out keep the
 * layer's static value, so a frame can move without touching the opacity.
 */
export type MotionFrame = { x: number; y: number; rotation: number; opacity: number; scale: number };

type Animatable = { x: number; y: number; rotation: number; opacity: number; keyframes?: Keyframe[] };

function sample(frames: Keyframe[], property: keyof Omit<Keyframe, 'at'>, at: number, fallback: number): number {
  const points = frames.filter(frame => typeof frame[property] === 'number');
  if (!points.length) return fallback;
  const first = points[0];
  if (at <= first.at) return first[property] as number;
  const last = points[points.length - 1];
  if (at >= last.at) return last[property] as number;
  for (let index = 1; index < points.length; index += 1) {
    const right = points[index];
    if (at > right.at) continue;
    const left = points[index - 1];
    const span = right.at - left.at;
    const progress = span <= 0 ? 1 : (at - left.at) / span;
    const from = left[property] as number, to = right[property] as number;
    return from + (to - from) * progress;
  }
  return last[property] as number;
}

/** The layer's animated geometry at `at` seconds from its start. */
export function motionAt(layer: Animatable, at: number): MotionFrame {
  const frames = (layer.keyframes ?? []).filter(frame => Number.isFinite(frame.at)).sort((a, b) => a.at - b.at);
  if (!frames.length || !Number.isFinite(at)) return { x: layer.x, y: layer.y, rotation: layer.rotation, opacity: layer.opacity, scale: 1 };
  return {
    x: sample(frames, 'x', at, layer.x),
    y: sample(frames, 'y', at, layer.y),
    rotation: sample(frames, 'rotation', at, layer.rotation),
    opacity: sample(frames, 'opacity', at, layer.opacity),
    scale: sample(frames, 'scale', at, 1),
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
