import { MAX_GLOBAL_TEXT, sceneAt, secondsToTicks, ticksToSeconds, type Command, type Project, type Scene, type TextLayer, type ElementLayer } from '../../stores/model';
import { t } from '../../i18n';
import { createTextLayer, layerStartSeconds, sceneTextLayers } from '../../components/text/layers';
import { ELEMENT_CATALOG } from '../../components/elements/catalog';
import { stackIndex, stackZ, newOverlayZ, type StackMove } from '../../components/elements/stack';
import { presetSize } from '../../components/elements/designer';
import { replaceOverlay, constrainOverlay, type TimelineOverlay } from '../../components/elements/overlays';
import { useElementPointer } from './useElementPointer';
import { fadeOpacity } from '../../components/preview/render';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { ElementKind } from '../../stores/model';
import type { StackEntry } from '../../components/elements/stack';
import type { EditTarget } from '../selection-store';

const ELEMENT_COLOR_DEFAULTS: Partial<Record<ElementKind, string>> = {
  subscribe: '#FF0033', like: '#0A66C2', bell: '#FFD166', comment: '#FFFFFF',
  share: '#6BE7FF', play: '#FFFFFF', progress: '#FF7A9E', location: '#FF6B6B',
  music: '#9D7CFF', check: '#7CF0B4', cross: '#FF7A9E', ring: '#9D7CFF',
  cursor: '#FFFFFF', underline: '#9D7CFF',
};

export function useTextAndElements({ active, activeSize, activeStart, allOverlays, canEdit, inspectorFlush, latestProject, overlayDraftRef, position, positionRef, previewScene, previewStage, project, projectTicks, run, sceneLayerStack, selectedElement, selectedGlobalText, selectedScene, selectedTextLayer, selectionAnchor, setDraggingOverlay, setEditTarget, setEditingText, setFramingMode, setGlobalTextDraft, setNotice, setOverlayDraft, setPlaying, setPosition, setPreviewScene, setPrimarySelected, setPropertyClipboard, setSelectedElementId, setSelectedGlobalTextId, setSelectedIds, setSelectedPipId, setSelectedTextLayerId, setSnapGuides, setTab, setTextDraft, setTextFocus, snapping, textDraft, textStartTicks }: {
  active: Scene | undefined;
  activeSize: { width: number; height: number; };
  activeStart: number;
  allOverlays: TimelineOverlay[];
  canEdit: boolean;
  inspectorFlush: RefObject<() => void>;
  latestProject: RefObject<Project>;
  overlayDraftRef: RefObject<TimelineOverlay | null>;
  position: number;
  positionRef: RefObject<number>;
  previewScene: Scene | null;
  previewStage: RefObject<HTMLDivElement | null>;
  project: Project;
  projectTicks: number;
  run: (command: Command) => Promise<boolean>;
  sceneLayerStack: StackEntry[];
  selectedElement: TimelineOverlay | null;
  selectedGlobalText: TextLayer | null;
  selectedScene: Scene | undefined;
  selectedTextLayer: TextLayer;
  selectionAnchor: RefObject<string | null>;
  setDraggingOverlay: Dispatch<SetStateAction<boolean>>;
  setEditTarget: Dispatch<SetStateAction<EditTarget>>;
  setEditingText: Dispatch<SetStateAction<boolean>>;
  setFramingMode: Dispatch<SetStateAction<boolean>>;
  setGlobalTextDraft: Dispatch<SetStateAction<TextLayer[] | null>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setOverlayDraft: Dispatch<SetStateAction<TimelineOverlay | null>>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  setPosition: Dispatch<SetStateAction<number>>;
  setPreviewScene: Dispatch<SetStateAction<Scene | null>>;
  setPrimarySelected: Dispatch<SetStateAction<string | null>>;
  setPropertyClipboard: Dispatch<SetStateAction<Partial<Scene> | null>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSelectedGlobalTextId: Dispatch<SetStateAction<string | null>>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPipId: Dispatch<SetStateAction<string | null>>;
  setSelectedTextLayerId: Dispatch<SetStateAction<string | null>>;
  setSnapGuides: Dispatch<SetStateAction<{ x: number | null; y: number | null; }>>;
  setTab: Dispatch<SetStateAction<"media" | "text" | "elements" | "audio" | "templates">>;
  setTextDraft: Dispatch<SetStateAction<{ title: string; subtitle: string; }>>;
  setTextFocus: Dispatch<SetStateAction<number>>;
  snapping: boolean;
  textDraft: { title: string; subtitle: string; };
  textStartTicks: number;
}) {
  function copySceneProperties(source: Scene) {
    setPropertyClipboard({
      textLayers: structuredClone(source.textLayers ?? []),
      brightness: source.brightness ?? 1,
      contrast: source.contrast ?? 1,
      saturation: source.saturation ?? 1,
      exposure: source.exposure ?? 0,
      highlights: source.highlights ?? 0,
      shadows: source.shadows ?? 0,
      temperature: source.temperature ?? 0,
      tint: source.tint ?? 0,
      filter: source.filter ?? 'none',
      filterIntensity: source.filterIntensity ?? 100,
      imageX: source.imageX ?? 0,
      imageY: source.imageY ?? 0,
      imageZoom: source.imageZoom ?? 1,
      framingBackground: source.framingBackground ?? '#000000',
      textBackdropEnabled: source.textBackdropEnabled ?? false,
      textBackdropColor: source.textBackdropColor ?? '#000000',
      textBackdropOpacity: source.textBackdropOpacity ?? 45,
      textBackdropBlur: source.textBackdropBlur ?? 18,
      textBackdropPadding: source.textBackdropPadding ?? 24,
      textBackdropRadius: source.textBackdropRadius ?? 16,
      textBackdropNoise: source.textBackdropNoise ?? 8,
      textStrokeColor: source.textStrokeColor ?? '#000000',
      textOutlineEnabled: source.textOutlineEnabled ?? false,
      textStrokeWidth: source.textStrokeWidth ?? 0,
      textShadowColor: source.textShadowColor ?? '#000000',
      textShadowEnabled: source.textShadowEnabled ?? false,
      textShadowIntensity: source.textShadowIntensity ?? 60,
      textShadowBlur: source.textShadowBlur ?? 0,
      textShadowOffsetX: source.textShadowOffsetX ?? 0,
      textShadowOffsetY: source.textShadowOffsetY ?? 0,
      textGlowEnabled: source.textGlowEnabled ?? false,
      textGlowColor: source.textGlowColor ?? '#FFFFFF',
      textGlowBlur: source.textGlowBlur ?? 24,
      textGlowIntensity: source.textGlowIntensity ?? 55,
      textX: source.textX ?? 0.09,
      textY: source.textY ?? 0.78,
      textWidth: source.textWidth ?? 0.82,
      textAlign: source.textAlign ?? 'left',
      textFont: source.textFont ?? 'inter',
      textFontWeight: source.textFontWeight ?? 600,
      textFontStyle: source.textFontStyle ?? 'normal',
      textSize: source.textSize ?? 0.068,
      textLineHeight: source.textLineHeight ?? 1.2,
      textLetterSpacing: source.textLetterSpacing ?? 0,
      textRotation: source.textRotation ?? 0,
      textOpacity: source.textOpacity ?? 100,
      textSubtitleScale: source.textSubtitleScale ?? 0.4,
    });
    setNotice(t('Color, look, text layout, and text-effect properties copied. Select another clip to paste them.'));
  }

  function notifyPasted() {
    setNotice(t('Color, look, and text effects pasted.'));
  }

  function selectTextLayer(id: string | null) {
    setTab('text');
    setEditTarget('text');
    setSelectedElementId(null);
    setSelectedGlobalTextId(null);
    setGlobalTextDraft(null);
    setSelectedPipId(null);
    setSelectedTextLayerId(id);
    if (!id || !selectedScene) return;
    const layer = sceneTextLayers(selectedScene).find(item => item.id === id);
    if (!layer) return;
    setPosition(ticksToSeconds(selectedScene.startTicks, project.timebase) + layerStartSeconds(layer, project.timebase));
  }

  function selectGlobalText(id: string) {
    const layer = (project.globalText ?? []).find(item => item.id === id);
    if (!layer) return;
    setTab('text'); setEditTarget('text');
    setSelectedElementId(null); setSelectedTextLayerId(null); setSelectedGlobalTextId(id);
    setEditingText(false);
    setPosition(ticksToSeconds(layer.startTicks, project.timebase));
  }

  function addProjectText() {
    if (!canEdit || !projectTicks) { setNotice(t('Add a scene before adding project text.')); return; }
    if ((project.globalText?.length ?? 0) >= MAX_GLOBAL_TEXT) { setNotice(t('A project supports up to {max} project text layers.', { max: MAX_GLOBAL_TEXT })); return; }
    const startTicks = Math.min(Math.max(0, secondsToTicks(positionRef.current, project.timebase)), projectTicks - 1);
    const layer = createTextLayer(Math.max(1, projectTicks - startTicks), { startTicks, y: .84, size: .052 });
    void run({ type: 'globalText', layers: [...(project.globalText ?? []), layer] }).then(ok => {
      if (!ok) return;
      setEditTarget('text'); setSelectedElementId(null); setSelectedTextLayerId(null); setSelectedGlobalTextId(layer.id);
      setTab('text'); setTextFocus(value => value + 1);
      setNotice(t('Project text added. It stays on screen across every scene.'));
    });
  }

  function replaceSceneTextLayers(scene: Scene, layers: TextLayer[]): Scene {
    return { ...scene, textLayers: layers, title: layers[0]?.title ?? '', subtitle: layers[0]?.subtitle ?? '' };
  }

  function addElement(presetId: string) {
    const preset = ELEMENT_CATALOG.find(item => item.id === presetId);
    if (!preset) return;
    const kind = preset.kind;
    if (!selectedScene || !canEdit) { setNotice(t('Select a scene first.')); return; }
    const count = allOverlays.length;
    if (count >= 64) { setNotice(t('This project already has 64 overlays.')); return; }
    const element: ElementLayer = {
      id: crypto.randomUUID(), kind, presetId, z: newOverlayZ(sceneLayerStack), label: preset.text, ...(preset.behavior ? { behavior: preset.behavior } : {}), x: .5 + (count % 3) * .035, y: .5 + (count % 2) * .035, ...presetSize(preset, activeSize),
      rotation: 0, color: preset?.color ?? ELEMENT_COLOR_DEFAULTS[kind] ?? '#9D7CFF', opacity: 100,
      ...(kind === 'countdown' ? { behavior: { countFrom: Math.max(0, Math.min(5, Math.ceil(ticksToSeconds(projectTicks, project.timebase) - position) - 2)), countTo: 0, ...preset.behavior } } : {}),
      startTicks: secondsToTicks(position, project.timebase), durationTicks: kind === 'countdown' ? secondsToTicks(7, project.timebase) : selectedScene.durationTicks, loop: false, animation: preset?.animation ?? 'none',
    };
    void run({ type: 'overlays', overlays: [...project.overlays, constrainOverlay(element, projectTicks, {})] });
    setEditTarget('element'); setSelectedElementId(element.id); setSelectedGlobalTextId(null);
    setEditingText(false); setFramingMode(false);
    setTab('elements');
  }

  function selectOverlay(element: TimelineOverlay, seek = true) {
    setOverlayDraft(null); overlayDraftRef.current = null;
    setSelectedElementId(element.id); setSelectedTextLayerId(null); setSelectedGlobalTextId(null); setSelectedPipId(null); setEditTarget('element');
    setFramingMode(false); setEditingText(false); setTab('elements'); setPlaying(false);
    const owner = sceneAt(project, ticksToSeconds(element.startTicks, project.timebase))?.scene;
    if (owner) { setSelectedIds([owner.id]); setPrimarySelected(owner.id); }
    if (seek) setPosition(ticksToSeconds(element.startTicks, project.timebase));
  }

  async function saveOverlay(element: TimelineOverlay, next: TimelineOverlay | null) {
    const current = latestProject.current;
    if (element.legacySceneId) return run({ type: 'replace', project: replaceOverlay(current, element, next) });
    const overlays = (current.overlays ?? []).filter(item => item.id !== element.id);
    if (next) overlays.push(next);
    return run({ type: 'overlays', overlays });
  }

  function stageElement(patch: Partial<ElementLayer>, target = selectedElement) {
    if (!target || !canEdit) return;
    const base = overlayDraftRef.current?.id === target.id ? overlayDraftRef.current : target;
    const next = { ...base, ...constrainOverlay(base, projectTicks, patch) };
    if (next.kind === 'video' && next.sourceDurationSeconds) next.durationTicks = Math.min(next.durationTicks, Math.max(1, secondsToTicks(next.sourceDurationSeconds - (next.sourceInSeconds ?? 0), project.timebase)));
    overlayDraftRef.current = next; setOverlayDraft(next);
    if (patch.startTicks !== undefined) { setPlaying(false); setPosition(ticksToSeconds(next.startTicks, project.timebase)); }
  }

  function commitElement() {
    const next = overlayDraftRef.current;
    if (!next) return;
    const original = allOverlays.find(e => e.id === next.id) ?? next;
    void saveOverlay(original, next).then(() => { if (overlayDraftRef.current === next) { overlayDraftRef.current = null; setOverlayDraft(null); } });
  }

  function updateElement(patch: Partial<ElementLayer>) { stageElement(patch); queueMicrotask(() => commitElement()); }

  function elementStackTarget(element: ElementLayer | TimelineOverlay) {
    const overlay = element as TimelineOverlay;
    // A legacy scene element is only addressable as an element while its draft
    // is not yet promoted to a project overlay.
    const at = overlay.legacySceneId ? stackIndex(sceneLayerStack, 'element', overlay.legacyId ?? element.id) : -1;
    return at >= 0 ? { kind: 'element' as const, id: overlay.legacyId ?? element.id } : { kind: 'overlay' as const, id: element.id };
  }

  function elementStackPosition(element: ElementLayer | TimelineOverlay) {
    const target = elementStackTarget(element);
    return stackIndex(sceneLayerStack, target.kind, target.id) + 1;
  }

  function moveElementLayer(move: StackMove) {
    if (!selectedElement || !canEdit) return;
    const target = elementStackTarget(selectedElement);
    const z = stackZ(sceneLayerStack, target.kind, target.id, move);
    if (z === null) return;
    // An uncommitted inspector draft has to survive the move, so let the draft
    // path stage and commit it. Every other press uses the lightweight command
    // that ships only the new position.
    if (overlayDraftRef.current) { updateElement({ z }); return; }
    void run({ type: 'order', kind: target.kind, sceneId: target.kind === 'overlay' ? undefined : selectedScene?.id, id: target.id, z });
  }

  function reorderLayer(kind: 'text' | 'element' | 'overlay', id: string, z: number) {
    if (!canEdit) return;
    void run({ type: 'order', kind, sceneId: kind === 'overlay' ? undefined : selectedScene?.id, id, z });
  }

  function removeElement(id: string) {
    const element = allOverlays.find(item => item.id === id); if (!element || !canEdit) return;
    void saveOverlay(element, null); setSelectedElementId(null); overlayDraftRef.current = null; setOverlayDraft(null);
  }

  const { beginElementMove, beginElementResize, beginElementRotate, beginOverlayTiming } = useElementPointer({ canEdit, inspectorFlush, previewStage, selectedElement, selectOverlay, allOverlays, position, project, projectTicks, snapping, setPlaying, setDraggingOverlay, setSnapGuides, setOverlayDraft, overlayDraftRef, stageElement, commitElement });

  function addBeatAtPlayhead() {
    if (!canEdit || !projectTicks) return;
    const tick = Math.min(projectTicks, Math.max(0, secondsToTicks(position, project.timebase)));
    const beats = project.beatTicks ?? [];
    if (beats.some(existing => Math.abs(existing - tick) < 2)) { setNotice(t('A beat is already there.')); return; }
    if (beats.length >= 500) { setNotice(t('A project supports up to 500 beat markers.')); return; }
    void run({ type: 'beats', beatTicks: [...beats, tick].sort((a, b) => a - b) });
  }

  function removeBeat(tick: number) {
    if (!canEdit) return;
    void run({ type: 'beats', beatTicks: (project.beatTicks ?? []).filter(beat => beat !== tick) });
  }

  function addTextLayerAtPlayhead(preset: Partial<TextLayer> = {}) {
    const scene = selectedScene ?? active;
    if (!scene || !canEdit) { setNotice(t('Add a photo before adding text.')); return; }
    if (sceneTextLayers(scene).length >= 8) { setNotice(t('This scene already has eight text layers.')); return; }
    const startTicks = Math.min(Math.max(0, textStartTicks), Math.max(0, scene.durationTicks - 1));
    const layer = createTextLayer(Math.max(1, scene.durationTicks - startTicks), { ...preset, startTicks });
    const next = replaceSceneTextLayers(scene, [...sceneTextLayers(scene), layer]);
    void run({ type: 'update', scene: next }).then(ok => {
      if (!ok) return;
      setSelectedIds([scene.id]);
      setPrimarySelected(scene.id);
      selectionAnchor.current = scene.id;
      setEditTarget('text'); setSelectedElementId(null); setSelectedTextLayerId(layer.id);
      setTab('text');
      setTextFocus(value => value + 1);

    });
  }

  function previewInlineText(next: { title: string; subtitle: string }) {
    if (!selectedScene || !selectedTextLayer) return;
    if (selectedGlobalText) {
      setTextDraft(next);
      setGlobalTextDraft((project.globalText ?? []).map(layer => layer.id === selectedGlobalText.id ? { ...layer, ...next } : layer));
      return;
    }
    setTextDraft(next);
    const layers = sceneTextLayers(selectedScene).map(layer => layer.id === selectedTextLayer.id ? { ...layer, ...next } : layer);
    setPreviewScene(replaceSceneTextLayers(selectedScene, layers));
  }

  function commitInlineText() {
    if (selectedGlobalText) {
      const layers = (project.globalText ?? []).map(layer => layer.id === selectedGlobalText.id ? { ...layer, ...textDraft } : layer);
      setGlobalTextDraft(null); setEditingText(false);
      void run({ type: 'globalText', layers });
      return;
    }
    const scene = selectedScene, layer = selectedTextLayer;
    if (!scene || !layer) { setEditingText(false); return; }
    const layers = sceneTextLayers(scene).map(item => item.id === layer.id ? { ...item, ...textDraft } : item);
    const next = replaceSceneTextLayers(scene, layers);
    setPreviewScene(next);
    void run({ type: 'update', scene: next }).finally(() => { setPreviewScene(null); setEditingText(false); });
  }

  function cancelInlineText() {
    setPreviewScene(null);
    setEditingText(false);
  }

  function blurInlineText(event: { currentTarget: HTMLElement; relatedTarget: EventTarget | null }) {
    const editor = event.currentTarget.closest('.text-edit-overlay');
    if (editor?.contains(event.relatedTarget as Node | null)) return;
    commitInlineText();
  }






  const fadeScene = previewScene && previewScene.id === active?.id ? previewScene : active;
  const fadeAmount = fadeScene ? 1 - fadeOpacity(fadeScene, position - activeStart, project.timebase) : 0;

  return { copySceneProperties, notifyPasted, selectTextLayer, selectGlobalText, addProjectText, replaceSceneTextLayers, addElement, selectOverlay, saveOverlay, stageElement, commitElement, updateElement, elementStackTarget, elementStackPosition, moveElementLayer, reorderLayer, removeElement, beginElementMove, beginElementResize, beginElementRotate, beginOverlayTiming, addBeatAtPlayhead, removeBeat, addTextLayerAtPlayhead, previewInlineText, commitInlineText, cancelInlineText, blurInlineText, fadeScene, fadeAmount };
}
