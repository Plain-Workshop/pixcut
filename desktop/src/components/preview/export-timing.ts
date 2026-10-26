import { isDynamicElement } from '../elements/dynamic';
import { sceneTextLayers } from '../text/layers';
import { secondsToTicks, type ElementLayer, type Scene, type Timebase } from '../../stores/model';

// Both photo export paths use the same frame boundaries as the preview.
export function exportBoundaries(scene: Scene, timebase: Timebase, hasNext: boolean, overlays: ElementLayer[] = []): number[] {
  const points = new Set([0, scene.durationTicks]);
  const add = (tick: number) => points.add(Math.min(scene.durationTicks, Math.max(0, tick)));
  for (const layer of [...sceneTextLayers(scene), ...(scene.elements ?? [])]) {
    add(layer.startTicks); add(layer.startTicks + layer.durationTicks);
  }
  const activeOverlays = overlays.filter(e => e.startTicks < scene.startTicks + scene.durationTicks && e.startTicks + e.durationTicks > scene.startTicks);
  for (const e of activeOverlays) { add(e.startTicks - scene.startTicks); add(e.startTicks + e.durationTicks - scene.startTicks); }
  const animated = activeOverlays.some(e => e.animation !== 'none' || e.action || (e.exit && e.exit !== 'none') || isDynamicElement(e.kind) || e.kind === 'video') || (scene.motion && scene.motion !== 'none') || (hasNext && scene.transition) ||
    sceneTextLayers(scene).some(layer => layer.animation !== 'none') || scene.elements?.some(layer => layer.animation !== 'none' || layer.action || (layer.exit && layer.exit !== 'none') || isDynamicElement(layer.kind) || layer.kind === 'video');
  if (animated) for (let tick = 1; tick < scene.durationTicks; tick++) add(tick);
  if (scene.transition && hasNext) add(scene.durationTicks - secondsToTicks(scene.transition.duration, timebase));
  return [...points].sort((a, b) => a - b);
}
