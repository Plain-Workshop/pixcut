import { type Dispatch, type PointerEvent as ReactPointerEvent, type RefObject, type SetStateAction } from 'react';
import { centreGuides, snapToTargets } from '../../components/preview/snapping';
import { landedOn, setSnapGuide, snapEdges, snapThreshold, timelineSnapPoints } from '../../components/timeline/timeline-snap';
import { resizeRotatedBox, rotationFromPointer, type ResizeCorner } from '../../components/preview/transform-handles';
import { constrainOverlay, type TimelineOverlay } from '../../components/elements/overlays';
import { secondsToTicks, ticksToSeconds, type ElementLayer, type Project } from '../../stores/model';

/** Pointer gestures on the preview stage and overlay timeline: move, resize, rotate and retime elements. */
export function useElementPointer({ canEdit, inspectorFlush, previewStage, selectedElement, selectOverlay, allOverlays, position, project, projectTicks, snapping, setPlaying, setDraggingOverlay, setSnapGuides, setOverlayDraft, overlayDraftRef, stageElement, commitElement }: {
  canEdit: boolean;
  inspectorFlush: RefObject<() => void>;
  previewStage: RefObject<HTMLElement | null>;
  selectedElement: TimelineOverlay | null | undefined;
  selectOverlay: (element: TimelineOverlay, seek?: boolean) => void;
  allOverlays: TimelineOverlay[];
  position: number;
  project: Project;
  projectTicks: number;
  snapping: boolean;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  setDraggingOverlay: Dispatch<SetStateAction<boolean>>;
  setSnapGuides: Dispatch<SetStateAction<{ x: number | null; y: number | null }>>;
  setOverlayDraft: Dispatch<SetStateAction<TimelineOverlay | null>>;
  overlayDraftRef: RefObject<TimelineOverlay | null>;
  stageElement: (patch: Partial<ElementLayer>, target?: TimelineOverlay | null) => void;
  commitElement: () => void;
}) {
  function beginElementMove(event: ReactPointerEvent<HTMLElement>, element = selectedElement) {
    if (!element || !canEdit || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); inspectorFlush.current();
    selectOverlay(element, false);
    const stage = previewStage.current?.getBoundingClientRect(); if (!stage?.width || !stage.height) return;
    setPlaying(false); setDraggingOverlay(true);
    const startX = event.clientX, startY = event.clientY;
    const visibleOthers = allOverlays.filter(other => other.id !== element.id
      && position >= ticksToSeconds(other.startTicks, project.timebase)
      && position < ticksToSeconds(other.startTicks + other.durationTicks, project.timebase));
    const xGuides = centreGuides(visibleOthers.map(other => other.x));
    const yGuides = centreGuides(visibleOthers.map(other => other.y));
    const move = (e: PointerEvent) => {
      const rawX = Math.max(element.width / 2, Math.min(1 - element.width / 2, element.x + (e.clientX - startX) / stage.width));
      const rawY = Math.max(element.height / 2, Math.min(1 - element.height / 2, element.y + (e.clientY - startY) / stage.height));
      const x = snapToTargets(rawX, xGuides);
      const y = snapToTargets(rawY, yGuides);
      setSnapGuides({ x: x.guide, y: y.guide });
      stageElement({ x: x.value, y: y.value }, element);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setSnapGuides({ x: null, y: null }); setDraggingOverlay(false); commitElement(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
  }

  function beginElementResize(event: ReactPointerEvent<HTMLElement>, element = selectedElement, corner: ResizeCorner = 'se') {
    if (!element || !canEdit || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); inspectorFlush.current();
    selectOverlay(element, false);
    const stage = previewStage.current?.getBoundingClientRect(); if (!stage?.width || !stage.height) return;
    setPlaying(false); setDraggingOverlay(true);
    const startX = event.clientX, startY = event.clientY;
    const base = { cx: element.x * stage.width, cy: element.y * stage.height, w: element.width * stage.width, h: element.height * stage.height, rotation: element.rotation };
    const limits = { minWidth: Math.max(6, .02 * stage.width), minHeight: Math.max(6, .02 * stage.height), maxWidth: stage.width, maxHeight: stage.height };
    const move = (e: PointerEvent) => {
      const box = resizeRotatedBox(base, corner, e.clientX - startX, e.clientY - startY, limits, e.shiftKey);
      stageElement({
        x: Math.min(1, Math.max(0, box.cx / stage.width)),
        y: Math.min(1, Math.max(0, box.cy / stage.height)),
        width: box.w / stage.width,
        height: box.h / stage.height,
      }, element);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setDraggingOverlay(false); commitElement(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
  }

  function beginElementRotate(event: ReactPointerEvent<HTMLElement>, element = selectedElement) {
    if (!element || !canEdit || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); inspectorFlush.current();
    selectOverlay(element, false);
    const stage = previewStage.current?.getBoundingClientRect(); if (!stage?.width || !stage.height) return;
    setPlaying(false); setDraggingOverlay(true);
    const centre = { x: stage.left + element.x * stage.width, y: stage.top + element.y * stage.height };
    const angleAt = (clientX: number, clientY: number) => Math.atan2(clientY - centre.y, clientX - centre.x) * 180 / Math.PI;
    const startAngle = angleAt(event.clientX, event.clientY);
    const startRotation = element.rotation;
    const move = (e: PointerEvent) => {
      stageElement({ rotation: rotationFromPointer(startRotation, startAngle, angleAt(e.clientX, e.clientY), e.shiftKey) }, element);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setDraggingOverlay(false); commitElement(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
  }

  function beginOverlayTiming(event: ReactPointerEvent<HTMLElement>, element: TimelineOverlay, edge: 'move' | 'start' | 'end') {
    if (!canEdit || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); selectOverlay(element, false);
    const track = event.currentTarget.closest('.overlay-track')?.getBoundingClientRect(); if (!track?.width) return;
    const startX = event.clientX; let moved = false;
    const points = snapping ? timelineSnapPoints(project, secondsToTicks(position, project.timebase), element.id) : [];
    const threshold = snapThreshold(projectTicks, track.width);
    const move = (e: PointerEvent) => {
      const delta = Math.round((e.clientX - startX) / track.width * projectTicks); moved ||= Math.abs(e.clientX - startX) > 2;
      let patch: Partial<ElementLayer>;
      if (edge === 'move') patch = { startTicks: element.startTicks + delta };
      else if (edge === 'end') patch = { durationTicks: Math.max(1, element.durationTicks + delta) };
      else { const start = Math.min(element.startTicks + element.durationTicks - 1, element.startTicks + delta); patch = { startTicks: start, durationTicks: element.durationTicks + element.startTicks - start }; }
      const snapped = snapEdges(edge, patch.startTicks ?? element.startTicks, patch.durationTicks ?? element.durationTicks, points, threshold);
      if (snapped.guide) patch = { startTicks: snapped.startTicks, durationTicks: snapped.durationTicks };
      if (edge === 'move') patch.startTicks = Math.max(0, Math.min(projectTicks - element.durationTicks, patch.startTicks ?? element.startTicks));
      const next = { ...element, ...constrainOverlay(element, projectTicks, patch) };
      if (next.kind === 'video' && next.sourceDurationSeconds) next.durationTicks = Math.min(next.durationTicks, Math.max(1, secondsToTicks(next.sourceDurationSeconds - (next.sourceInSeconds ?? 0), project.timebase)));
      setSnapGuide(landedOn(snapped.guide, next.startTicks, next.durationTicks));
      overlayDraftRef.current = next; setOverlayDraft(next);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setSnapGuide(null); if (moved) commitElement(); else selectOverlay(element); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
  }

  return { beginElementMove, beginElementResize, beginElementRotate, beginOverlayTiming };
}
