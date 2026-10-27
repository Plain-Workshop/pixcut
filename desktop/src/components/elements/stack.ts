import type { ElementLayer, Scene, TextLayer } from '../../stores/model';

/**
 * Stack order for everything that draws over a scene: element layers, text
 * layers and project overlays. Each layer carries an optional `z` number —
 * bigger draws later, so it sits on top. Layers without a `z` keep the classic
 * order (scene elements, then text, then project overlays) through the default
 * bands below, so old projects look exactly the same.
 */
export type StackKind = 'element' | 'text' | 'overlay';
export type StackMove = 'front' | 'forward' | 'backward' | 'back';
type StackBase = { id: string; z: number; index: number };
export type StackEntry =
  | (StackBase & { kind: 'element'; layer: ElementLayer })
  | (StackBase & { kind: 'text'; layer: TextLayer })
  | (StackBase & { kind: 'overlay'; layer: ElementLayer });

export const STACK_Z_MAX = 100_000;
/** Default bands: elements at the bottom, text above them, project overlays on top. */
export const STACK_DEFAULT_Z: Record<StackKind, number> = { element: 1_000, text: 2_000, overlay: 3_000 };
const KIND_RANK: Record<StackKind, number> = { element: 0, text: 1, overlay: 2 };
const DECIMALS = 1_000_000;

const round = (value: number) => Math.round(value * DECIMALS) / DECIMALS;

export function layerZ(layer: { z?: number }, kind: StackKind, index: number): number {
  const z = layer.z;
  return typeof z === 'number' && Number.isFinite(z) ? Math.min(STACK_Z_MAX, Math.max(0, z)) : STACK_DEFAULT_Z[kind] + index;
}

/** Every layer that can draw over this scene, ordered from the bottom up. */
export function sceneStack(scene: Scene | null | undefined, overlays: ElementLayer[] = []): StackEntry[] {
  const entries: StackEntry[] = [];
  (scene?.elements ?? []).forEach((layer, index) => entries.push({ kind: 'element', id: layer.id, z: layerZ(layer, 'element', index), index, layer }));
  (scene?.textLayers ?? []).forEach((layer, index) => entries.push({ kind: 'text', id: layer.id, z: layerZ(layer, 'text', index), index, layer }));
  overlays.forEach((layer, index) => entries.push({ kind: 'overlay', id: layer.id, z: layerZ(layer, 'overlay', index), index, layer }));
  return entries.sort((a, b) => a.z - b.z || KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.index - b.index);
}

export function stackIndex(entries: StackEntry[], kind: StackKind, id: string): number {
  return entries.findIndex(entry => entry.kind === kind && entry.id === id);
}

/** Overlays that are on screen during this scene, for the editor's order readout. */
export function overlaysForScene(scene: Scene | null | undefined, overlays: ElementLayer[]): ElementLayer[] {
  if (!scene) return overlays;
  const start = scene.startTicks, end = scene.startTicks + scene.durationTicks;
  return overlays.filter(overlay => overlay.startTicks < end && overlay.startTicks + overlay.durationTicks > start);
}

/**
 * The `z` a layer needs to move in the requested direction, or `null` when it
 * is already at that end. One press moves one place; the value lands between
 * its new neighbours so no other layer has to be renumbered.
 */
export function stackZ(entries: StackEntry[], kind: StackKind, id: string, move: StackMove): number | null {
  const at = stackIndex(entries, kind, id);
  if (at < 0 || entries.length < 2) return null;
  const top = entries[entries.length - 1].z;
  const bottom = entries[0].z;
  const clamp = (value: number) => round(Math.min(STACK_Z_MAX, Math.max(0, value)));
  if (move === 'front') return at === entries.length - 1 ? null : clamp(top + 1);
  if (move === 'back') return at === 0 ? null : clamp(bottom - 1);
  if (move === 'forward') {
    const above = entries[at + 1];
    if (!above) return null;
    const after = entries[at + 2];
    return clamp(after && after.z > above.z ? (above.z + after.z) / 2 : above.z + .1);
  }
  const below = entries[at - 1];
  if (!below) return null;
  const before = entries[at - 2];
  return clamp(before && below.z > before.z ? (before.z + below.z) / 2 : below.z - .1);
}

/** Newly inserted overlays follow any manual ordering, including a capped top z. */
export function newOverlayZ(entries: StackEntry[]): number {
  return Math.min(STACK_Z_MAX, Math.max(STACK_DEFAULT_Z.overlay - 1, ...entries.map(entry => entry.z)) + 1);
}
