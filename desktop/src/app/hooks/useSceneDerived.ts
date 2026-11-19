import { useMemo } from 'react';
import { timelineOverlays, type TimelineOverlay } from '../../components/elements/overlays';
import { projectScenes, sceneSeconds, secondsToTicks, ticksToSeconds, type Scene, type TextLayer, type FormatVariant } from '../../stores/model';
import { sceneStack, layerZ, overlaysForScene } from '../../components/elements/stack';
import { resolveSceneForFormat } from '../../stores/formats';
import { textBoxLayout } from '../../components/preview/render';
import { applyTextMotion } from '../../components/animation/keyframes';
import { layerVisibleAt } from '../../components/text/layers';
import type { Project } from '../../stores/model';

export function useSceneDerived({ active, activeFormat, activeSize, activeStart, displayAspect, overlayDraft, position, previewScene, previewTarget, project, scenes, selectedElementId, selectedGlobalText, selectedScene, selectedTextLayer }: {
  active: Scene | undefined;
  activeFormat: FormatVariant;
  activeSize: { width: number; height: number; };
  activeStart: number;
  displayAspect: "16:9" | "9:16" | "1:1" | "4:5";
  overlayDraft: TimelineOverlay | null;
  position: number;
  previewScene: Scene | null;
  previewTarget: Scene | undefined;
  project: Project;
  scenes: Scene[];
  selectedElementId: string | null;
  selectedGlobalText: TextLayer | null;
  selectedScene: Scene | undefined;
  selectedTextLayer: TextLayer;
}) {
  const allOverlays = useMemo(() => timelineOverlays(project), [project]);
  const layerWeight = (element: TimelineOverlay) => {
    if (typeof element.z === 'number') return element.z;
    if (element.legacySceneId) {
      const owner = projectScenes(project).find(scene => scene.id === element.legacySceneId);
      const index = owner?.elements?.findIndex(item => item.id === element.legacyId) ?? 0;
      return layerZ(element, 'element', Math.max(0, index));
    }
    const index = (project.overlays ?? []).findIndex(item => item.id === element.id);
    return layerZ(element, 'overlay', Math.max(0, index));
  };
  const orderedLayers = useMemo(() => [...allOverlays].sort((a, b) => layerWeight(b) - layerWeight(a) || a.startTicks - b.startTicks || a.id.localeCompare(b.id)), [allOverlays]);
  const layerNumbers = useMemo(() => new Map([...orderedLayers].reverse().map((element, index) => [element.id, index + 1])), [orderedLayers]);
  const hasMediaOverlays = allOverlays.some(element => element.kind === 'image' || element.kind === 'video');
  const selectedElement = overlayDraft?.id === selectedElementId ? overlayDraft : allOverlays.find(element => element.id === selectedElementId) ?? null;
  const renderOverlays = useMemo(() => (project.overlays ?? []).filter(e => e.id !== overlayDraft?.id).concat(overlayDraft ? [overlayDraft] : []), [project.overlays, overlayDraft]);
  // One stack for everything drawn over the selected scene, so text, elements
  // and video overlays can be raised or lowered across each other.
  const sceneLayerStack = useMemo(() => {
    const owner = overlayDraft?.legacySceneId && overlayDraft.legacyId && selectedScene?.id === overlayDraft.legacySceneId
      ? { ...selectedScene, elements: (selectedScene.elements ?? []).filter(element => element.id !== overlayDraft.legacyId) }
      : selectedScene;
    return sceneStack(owner, overlaysForScene(owner, renderOverlays));
  }, [selectedScene, renderOverlays, overlayDraft]);
  const sceneLayerRank = useMemo(() => new Map(sceneLayerStack.map((entry, index) => [`${entry.kind}:${entry.id}`, index])), [sceneLayerStack]);
  const inspectorScene = useMemo(() => selectedScene ? resolveSceneForFormat(selectedScene, activeFormat) : null, [selectedScene, activeFormat]);
  const previewLocalSeconds = previewTarget && active && previewTarget.id === active.id ? Math.max(0, position - activeStart) : 0;
  const videoScene = previewTarget?.mediaKind === 'video' ? previewTarget : null;
  const textLayerLocal = selectedTextLayer ? (selectedGlobalText ? position : previewLocalSeconds) - ticksToSeconds(selectedTextLayer.startTicks, project.timebase) : 0;
  const textBox = selectedTextLayer ? textBoxLayout(applyTextMotion(selectedTextLayer, textLayerLocal), displayAspect, activeSize) : null;
  const selectedTextVisible = selectedTextLayer ? layerVisibleAt(selectedTextLayer, selectedGlobalText ? position : previewLocalSeconds, project.timebase) : false;
  const textStartTicks = selectedGlobalText
    ? Math.min(Math.max(0, secondsToTicks(position, project.timebase) - selectedGlobalText.startTicks), Math.max(0, selectedGlobalText.durationTicks - 1))
    : selectedScene ? Math.min(Math.max(0, secondsToTicks(position - ticksToSeconds(selectedScene.startTicks, project.timebase), project.timebase)), Math.max(0, selectedScene.durationTicks - 1)) : 0;
  const activeIndex = active ? scenes.findIndex(scene => scene.id === active.id) : -1;
  const nextScene = activeIndex >= 0 ? scenes[activeIndex + 1] : undefined;
  const previewTransition = active?.transition && nextScene && previewTarget?.id === active.id
    ? (() => {
      const sceneDuration = sceneSeconds(active, project.timebase);
      const start = Math.max(0, sceneDuration - active.transition!.duration);
      if (previewLocalSeconds < start) return null;
      return { type: active.transition!.type, progress: Math.min(1, (previewLocalSeconds - start) / active.transition!.duration), next: nextScene };
    })()
    : null;
  const rawPreviewScene = previewScene ? scenes.find(scene => scene.id === previewScene.id) : undefined;
  const framingStaged = Boolean(previewScene && rawPreviewScene && (previewScene.imageX !== rawPreviewScene.imageX || previewScene.imageY !== rawPreviewScene.imageY || previewScene.imageZoom !== rawPreviewScene.imageZoom || previewScene.fit !== rawPreviewScene.fit || previewScene.framingBackground !== rawPreviewScene.framingBackground));
  const resolvedPreviewTarget = previewTarget ? resolveSceneForFormat(overlayDraft?.legacySceneId === previewTarget.id ? { ...previewTarget, elements: previewTarget.elements?.filter(e => e.id !== overlayDraft.legacyId) } : previewTarget, activeFormat) : null;
  const sceneForPreview = resolvedPreviewTarget && framingStaged && previewScene ? { ...resolvedPreviewTarget, imageX: previewScene.imageX, imageY: previewScene.imageY, imageZoom: previewScene.imageZoom, fit: previewScene.fit, framingBackground: previewScene.framingBackground } : resolvedPreviewTarget;
  const resolvedNextScene = previewTransition?.next ? resolveSceneForFormat(previewTransition.next, activeFormat) : undefined;

  return { allOverlays, layerWeight, orderedLayers, layerNumbers, hasMediaOverlays, selectedElement, renderOverlays, sceneLayerStack, sceneLayerRank, inspectorScene, previewLocalSeconds, videoScene, textLayerLocal, textBox, selectedTextVisible, textStartTicks, activeIndex, nextScene, previewTransition, rawPreviewScene, framingStaged, resolvedPreviewTarget, sceneForPreview, resolvedNextScene };
}
