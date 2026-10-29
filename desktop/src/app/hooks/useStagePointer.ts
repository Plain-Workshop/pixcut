import { landedOn, setSnapGuide, snapEdges, snapThreshold, timelineSnapPoints } from '../../components/timeline/timeline-snap';
import { type Dispatch, type PointerEvent as ReactPointerEvent, type RefObject, type SetStateAction } from 'react';
import { framingTravel } from '../../components/preview/framing';
import { edgeGuides, snapToTargets } from '../../components/preview/snapping';
import { loadImage, textBoxLayout } from '../../components/preview/render';
import { sceneTextLayers } from '../../components/text/layers';
import { projectScenes, sceneSeconds, secondsToTicks, ticksToSeconds, trimSceneWindow, type Command, type Project, type Scene, type ScenePatchKey, type Session, type TextLayer } from '../../stores/model';
import { captureDragPointer } from '../helpers';

/** Pointer gestures on the preview stage (pan, text move/resize) and the timeline (fades, trims, playhead). */
export function useStagePointer({ timelineSnapping, playheadSeconds, canEdit, inspectorFlush, previewStage, inspectorScene, selectedScene, selectedIds, selectedTextLayer, textBox, project, latestProject, projectTicks, duration, activeSize, pending, run, updateSelection, optimisticScene, replaceSceneTextLayers, scrubTo, selectionAnchor, setSession, setPreviewScene, setPlaying, setEditingText, setFadeDrag, setSnapGuides, setSelectedIds, setPrimarySelected, setDraggingOverlay }: {
  canEdit: boolean;
  inspectorFlush: RefObject<() => void>;
  previewStage: RefObject<HTMLElement | null>;
  inspectorScene: Scene | null;
  selectedScene: Scene | null | undefined;
  selectedIds: string[];
  selectedTextLayer: TextLayer | null;
  textBox: ReturnType<typeof textBoxLayout> | null;
  project: Project;
  timelineSnapping: boolean;
  playheadSeconds: number;
  latestProject: RefObject<Project>;
  projectTicks: number;
  duration: number;
  activeSize: { width: number; height: number };
  pending: RefObject<Promise<boolean>>;
  run: (command: Command) => Promise<boolean>;
  updateSelection: (next: Scene, force?: ScenePatchKey[]) => Promise<boolean>;
  optimisticScene: (scene: Scene) => Project;
  replaceSceneTextLayers: (scene: Scene, layers: TextLayer[]) => Scene;
  scrubTo: (value: number) => void;
  selectionAnchor: RefObject<string | null>;
  setSession: Dispatch<SetStateAction<Session>>;
  setPreviewScene: Dispatch<SetStateAction<Scene | null>>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  setEditingText: Dispatch<SetStateAction<boolean>>;
  setFadeDrag: Dispatch<SetStateAction<{ sceneId: string; side: 'in' | 'out'; value: number } | null>>;
  setSnapGuides: Dispatch<SetStateAction<{ x: number | null; y: number | null }>>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setPrimarySelected: Dispatch<SetStateAction<string | null>>;
  setDraggingOverlay: Dispatch<SetStateAction<boolean>>;
}) {
  function beginImagePan(event: ReactPointerEvent<HTMLElement>) {
    const scene = inspectorScene;
    if (!scene || !canEdit || event.button !== 0) return;
    event.preventDefault();
    captureDragPointer(event);
    inspectorFlush.current();
    const stage = previewStage.current?.getBoundingClientRect();
    if (!stage || stage.width <= 0 || stage.height <= 0) return;
    setPlaying(false);
    setEditingText(false);
    const startX = event.clientX, startY = event.clientY;
    setDraggingOverlay(true);
    const initialX = scene.imageX ?? 0, initialY = scene.imageY ?? 0;
    let travel = { x: activeSize.width / 4, y: activeSize.height / 4 };
    void loadImage(scene.videoPoster ?? scene.image).then(image => { travel = framingTravel({ width: image.naturalWidth, height: image.naturalHeight }, activeSize, scene.fit, scene.imageZoom ?? 1); }).catch(() => {});
    let latest = { imageX: initialX, imageY: initialY };
    const move = (moveEvent: PointerEvent) => {
      latest = {
        imageX: Math.min(1, Math.max(-1, initialX - (moveEvent.clientX - startX) / stage.width * activeSize.width / travel.x)),
        imageY: Math.min(1, Math.max(-1, initialY - (moveEvent.clientY - startY) / stage.height * activeSize.height / travel.y)),
      };
      setPreviewScene({ ...scene, ...latest });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDraggingOverlay(false);
      void pending.current.then(() => {
        const current = projectScenes(latestProject.current).find(item => item.id === scene.id) ?? scene;
        if ((current.imageX ?? 0) === latest.imageX && (current.imageY ?? 0) === latest.imageY) { setPreviewScene(null); return; }
        void updateSelection({ ...scene, ...latest }).finally(() => setPreviewScene(null));
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function beginTextMove(event: ReactPointerEvent<HTMLElement>) {
    const scene = selectedScene;
    const layer = selectedTextLayer;
    if (!scene || !layer || !canEdit || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    inspectorFlush.current();
    const stage = previewStage.current?.getBoundingClientRect();
    if (!stage || stage.width <= 0 || stage.height <= 0) return;
    const startX = event.clientX, startY = event.clientY;
    const initialX = layer.x, initialY = layer.y;
    const width = layer.width;
    const height = (textBox?.heightPct ?? 10) / 100;
    let latest = { x: initialX, y: initialY };
    setPlaying(false);
    setEditingText(false);
    const move = (moveEvent: PointerEvent) => {
      const rawX = Math.min(Math.max(0, initialX + (moveEvent.clientX - startX) / stage.width), Math.max(0, 1 - width));
      const rawY = Math.min(Math.max(0, initialY + (moveEvent.clientY - startY) / stage.height), Math.max(0, 1 - height));
      const x = snapToTargets(rawX, edgeGuides(width));
      const y = snapToTargets(rawY, edgeGuides(height));
      setSnapGuides({ x: x.guide, y: y.guide });
      latest = { x: x.value, y: y.value };
      const layers = sceneTextLayers(scene).map(item => item.id === layer.id ? { ...item, x: x.value, y: y.value } : item);
      setPreviewScene(replaceSceneTextLayers(scene, layers));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setSnapGuides({ x: null, y: null });
      void pending.current.then(() => {
        const current = projectScenes(latestProject.current).find(item => item.id === scene.id) ?? scene;
        const currentLayer = sceneTextLayers(current).find(item => item.id === layer.id);
        if (!currentLayer || (currentLayer.x === latest.x && currentLayer.y === latest.y)) { setPreviewScene(null); return; }
        const layers = sceneTextLayers(current).map(item => item.id === layer.id ? { ...item, ...latest } : item);
        void run({ type: 'update', scene: replaceSceneTextLayers(current, layers) }).finally(() => setPreviewScene(null));
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function beginTextResize(event: ReactPointerEvent<HTMLElement>, side: 'left' | 'right') {
    const scene = selectedScene;
    const layer = selectedTextLayer;
    if (!scene || !layer || !canEdit || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    inspectorFlush.current();
    const stage = previewStage.current?.getBoundingClientRect();
    if (!stage || stage.width <= 0) return;
    const startX = event.clientX;
    const initialX = layer.x, initialWidth = layer.width;
    let latest = { x: initialX, width: initialWidth };
    setPlaying(false);
    setEditingText(false);
    const move = (moveEvent: PointerEvent) => {
      const delta = (moveEvent.clientX - startX) / stage.width;
      if (side === 'right') {
        const width = Math.min(1 - initialX, Math.max(.15, initialWidth + delta));
        latest = { x: initialX, width };
      } else {
        const x = Math.min(initialX + initialWidth - .15, Math.max(0, initialX + delta));
        latest = { x, width: initialWidth + (initialX - x) };
      }
      const layers = sceneTextLayers(scene).map(item => item.id === layer.id ? { ...item, ...latest } : item);
      setPreviewScene(replaceSceneTextLayers(scene, layers));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      void pending.current.then(() => {
        const current = projectScenes(latestProject.current).find(item => item.id === scene.id) ?? scene;
        const currentLayer = sceneTextLayers(current).find(item => item.id === layer.id);
        if (!currentLayer || (currentLayer.x === latest.x && currentLayer.width === latest.width)) { setPreviewScene(null); return; }
        const layers = sceneTextLayers(current).map(item => item.id === layer.id ? { ...item, ...latest } : item);
        void run({ type: 'update', scene: replaceSceneTextLayers(current, layers) }).finally(() => setPreviewScene(null));
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function beginFadeDrag(event: ReactPointerEvent<HTMLSpanElement>, scene: Scene, side: 'in' | 'out') {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    captureDragPointer(event);
    const clip = event.currentTarget.closest<HTMLElement>('.timeline-clip');
    const width = clip?.getBoundingClientRect().width ?? 0;
    if (width <= 0) return;
    const startX = event.clientX;
    const initialIn = scene.fadeIn ?? 0;
    const initialOut = scene.fadeOut ?? 0;
    let next = { fadeIn: initialIn, fadeOut: initialOut };
    setSelectedIds(ids => ids.includes(scene.id) ? ids : [scene.id]);
    setPrimarySelected(scene.id);
    if (!selectedIds.includes(scene.id)) selectionAnchor.current = scene.id;
    setPlaying(false);
    setPreviewScene({ ...scene, ...next });
    const sceneDuration = sceneSeconds(scene, project.timebase);
    setFadeDrag({ sceneId: scene.id, side, value: side === 'in' ? initialIn : initialOut });
    const move = (moveEvent: PointerEvent) => {
      const delta = ((moveEvent.clientX - startX) / width) * sceneDuration * (side === 'in' ? 1 : -1);
      const base = side === 'in' ? initialIn : initialOut;
      const value = Math.min(sceneDuration, Math.max(0, Math.round((base + delta) * 10) / 10));
      next = side === 'in' ? { ...next, fadeIn: value } : { ...next, fadeOut: value };
      setFadeDrag({ sceneId: scene.id, side, value });
      setPreviewScene({ ...scene, ...next });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setFadeDrag(null);
      setPreviewScene(null);
      void pending.current.then(() => {
        const current = projectScenes(latestProject.current).find(item => item.id === scene.id) ?? scene;
        if ((current.fadeIn ?? 0) !== next.fadeIn || (current.fadeOut ?? 0) !== next.fadeOut) {
          void run({ type: 'update', scene: { ...current, ...next } });
        }
      });
    };
    const cancel = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setFadeDrag(null);
      setPreviewScene(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }

  function beginSceneTrim(event: ReactPointerEvent<HTMLSpanElement>, scene: Scene, side: 'left' | 'right') {
    if (!canEdit || event.button !== 0 || !projectTicks) return;
    event.preventDefault();
    event.stopPropagation();
    captureDragPointer(event);
    const clip = event.currentTarget.closest<HTMLElement>('.timeline-clip, .video-audio-clip');
    clip?.focus({ preventScroll: true });
    const width = clip?.getBoundingClientRect().width ?? 0;
    if (width <= 0) return;
    setSelectedIds(ids => (ids.includes(scene.id) ? ids : [scene.id]));
    setPrimarySelected(scene.id);
    if (!selectedIds.includes(scene.id)) selectionAnchor.current = scene.id;
    setPlaying(false);
    const timebase = project.timebase;
    const startX = event.clientX;
    const initialDuration = scene.durationTicks;
    const initialSourceIn = scene.sourceInTicks ?? 0;
    let next = scene;
    let frame = 0;
    setPreviewScene(scene);
    // Later cuts ripple with the trim, so only targets before this clip's end hold still.
    const points = timelineSnapping && side === 'right' ? timelineSnapPoints(project, secondsToTicks(playheadSeconds, timebase), scene.id).filter(point => point.kind !== 'end' && !(point.kind === 'cut' && point.tick > scene.startTicks)) : [];
    const threshold = snapThreshold(initialDuration, width);
    const move = (moveEvent: PointerEvent) => {
      let delta = Math.round(((moveEvent.clientX - startX) / width) * initialDuration);
      const raw = trimSceneWindow(scene, delta, side, timebase);
      const snapped = snapEdges('end', scene.startTicks, raw.durationTicks, points, threshold);
      if (snapped.guide) delta = snapped.durationTicks - initialDuration;
      const candidate = snapped.guide ? trimSceneWindow(scene, delta, side, timebase) : raw;
      setSnapGuide(landedOn(snapped.guide, scene.startTicks, candidate.durationTicks));
      if (candidate.durationTicks === next.durationTicks && candidate.sourceInTicks === next.sourceInTicks) return;
      next = candidate;
      // Coalesce pointer moves into one paint. The timeline reads this draft
      // immediately, while the expensive preview/render tree only updates once
      // per animation frame.
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; setPreviewScene(next); });
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    const finish = (commit: boolean) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setSnapGuide(null);
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      setPreviewScene(null);
      if (!commit) return;
      if (next.durationTicks === initialDuration && next.sourceInTicks === initialSourceIn) return;
      const current = projectScenes(latestProject.current).find(item => item.id === scene.id);
      if (!current) return;
      const updated = { ...current, durationTicks: next.durationTicks, sourceInTicks: next.sourceInTicks, fadeIn: Math.min(current.fadeIn ?? 0, ticksToSeconds(next.durationTicks, timebase)), fadeOut: Math.min(current.fadeOut ?? 0, ticksToSeconds(next.durationTicks, timebase)) };
      const before = optimisticScene(updated);
      void run({ type: 'update', scene: updated }).then(ok => {
        if (!ok) { latestProject.current = before; setSession(session => ({ ...session, project: before })); }
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }

  function beginPlayheadDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!duration) return;
    const track = document.querySelector<HTMLElement>('.scene-track');
    if (!track) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    setPlaying(false);
    const update = (clientX: number) => scrubTo(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * duration);
    update(event.clientX);
    const move = (moveEvent: PointerEvent) => update(moveEvent.clientX);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  return { beginImagePan, beginTextMove, beginTextResize, beginFadeDrag, beginSceneTrim, beginPlayheadDrag };
}
