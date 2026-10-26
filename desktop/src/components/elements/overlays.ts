import { projectScenes, totalTicks, type ElementLayer, type Project } from '../../stores/model';
export type TimelineOverlay = ElementLayer & { legacySceneId?: string; legacyId?: string };
export function timelineOverlays(project: Project): TimelineOverlay[] {
  return [...(project.overlays ?? []), ...projectScenes(project).flatMap(scene => (scene.elements ?? []).map(element => ({ ...element, id: `legacy/${scene.id}/${element.id}`, legacySceneId: scene.id, legacyId: element.id, startTicks: scene.startTicks + element.startTicks })))];
}
export function constrainOverlay(element: ElementLayer, total: number, patch: Partial<ElementLayer>): ElementLayer {
  const next = { ...element, ...patch };
  next.startTicks = Math.round(Math.min(Math.max(0, next.startTicks), Math.max(0, total - 1)));
  next.durationTicks = Math.max(1, Math.round(Math.min(next.durationTicks, total - next.startTicks)));
  return next;
}
// Promoting an old scene element keeps its project position and makes it independent.
export function replaceOverlay(project: Project, selected: TimelineOverlay, next: ElementLayer | null): Project {
  const copy = { ...project, overlays: (project.overlays ?? []).filter(element => element.id !== selected.id) };
  if (selected.legacySceneId) copy.tracks = project.tracks.map(track => ({ ...track, clips: track.clips.map(scene => scene.id === selected.legacySceneId ? { ...scene, elements: scene.elements?.filter(element => element.id !== selected.legacyId) } : scene) }));
  if (next) { const { legacySceneId: _owner, legacyId: _id, ...clean } = next as TimelineOverlay; copy.overlays = [...copy.overlays, constrainOverlay(clean, totalTicks(project), {})]; }
  return copy;
}
