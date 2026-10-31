import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { overlayScenes, projectScenes, sceneAt, totalTicks, type Project, type Scene, type TextLayer } from '../stores/model';
import { resolvePreviewTarget } from '../components/preview/preview-target';
import { sceneTextLayers } from '../components/text/layers';

/** Everything the view derives from the project, the selection, the playhead and any drag still in progress. */
export type ViewInputs = {
  project: Project;
  /** Playhead, in seconds. */
  position: number;
  playing: boolean;
  selectedIds: string[];
  primarySelected: string | null;
  selectedGlobalTextId: string | null;
  selectedPipId: string | null;
  selectedTextLayerId: string | null;
  /** A visual clip staged by a drag or inspector edit that is not committed yet. */
  previewScene: Scene | null;
  /** A picture-in-picture clip being dragged. */
  pipDraft: Scene | null;
  /** Pass a memoised copy so its identity stays stable between frames; omitted, it is built fresh. */
  projectTextScene?: Scene | null;
};

export type EditorView = {
  /** The visual clip under the playhead. */
  active: Scene | undefined;
  activeStart: number;
  selectedScenes: Scene[];
  /** The clip the inspector shows: the primary one, else the last selected, else the active one. */
  selectedScene: Scene | undefined;
  selectedCount: number;
  /** True only when clips were selected on purpose, not when the active clip stands in for a selection. */
  hasSceneSelection: boolean;
  isSelected: (id: string) => boolean;
  previewTarget: Scene | undefined;
  /** Project-level text drawn over every scene, shaped like a scene so the text tools can edit it. */
  projectTextScene: Scene | null;
  selectedGlobalText: TextLayer | null;
  pipScenes: Scene[];
  selectedPip: Scene | null;
  /** Picture-in-picture clips with the one being dragged swapped for its draft. */
  renderPipScenes: Scene[];
  pipVideoScenes: Scene[];
  activePip: Scene | null;
  selectedTextScene: Scene | null | undefined;
  selectedTextLayers: TextLayer[];
  /**
   * The text layer being edited. Typed as present for the panels that only read it
   * while a text selection exists; with no text layers it is actually absent.
   */
  selectedTextLayer: TextLayer;
};

/** Project-level text shaped like a scene, so the text tools can edit it. Null when there is none. */
export function buildProjectTextScene(project: Project): Scene | null {
  return project.globalText?.length ? {
    id: `${project.id}-project-text`, startTicks: 0, sourceInTicks: 0, durationTicks: Math.max(1, totalTicks(project)),
    name: 'Project text', image: '', title: '', subtitle: '', color: '#ffffff', fit: 'cover',
    textLayers: project.globalText,
  } : null;
}

/** Pure: the same inputs always give the same view, so it can be tested without React. */
export function deriveEditorView(input: ViewInputs): EditorView {
  const { project, position, playing, selectedIds, primarySelected, selectedGlobalTextId, selectedPipId, selectedTextLayerId, previewScene, pipDraft } = input;
  const scenes = projectScenes(project);
  const activeInfo = sceneAt(project, position), active = activeInfo?.scene, activeStart = activeInfo?.start ?? 0;
  const selectedScenes = selectedIds.length
    ? selectedIds.map(id => scenes.find(scene => scene.id === id)).filter((scene): scene is Scene => Boolean(scene))
    : active ? [active] : [];
  const primaryScene = primarySelected ? selectedScenes.find(scene => scene.id === primarySelected) : undefined;
  const selectedScene = primaryScene ?? selectedScenes.at(-1) ?? active;
  const idSet = new Set(selectedIds);
  const previewTarget = resolvePreviewTarget(playing, active, previewScene);
  const projectTextScene: Scene | null = input.projectTextScene !== undefined ? input.projectTextScene : buildProjectTextScene(project);
  const selectedGlobalText = selectedGlobalTextId ? (project.globalText ?? []).find(layer => layer.id === selectedGlobalTextId) ?? null : null;
  const pipScenes = overlayScenes(project);
  const selectedPip = selectedPipId ? pipScenes.find(clip => clip.id === selectedPipId) ?? null : null;
  const renderPipScenes = pipDraft ? pipScenes.map(clip => clip.id === pipDraft.id ? pipDraft : clip) : pipScenes;
  const activePip = pipDraft?.id === selectedPip?.id ? pipDraft : selectedPip;
  // While a text drag or inline edit is previewing, follow the draft so the
  // selection box, guides, and canvas text stay in the same place.
  const selectedTextScene = selectedGlobalText ? projectTextScene : (previewScene && selectedScene && previewScene.id === selectedScene.id ? previewScene : selectedScene);
  const selectedTextLayers = selectedGlobalText ? [selectedGlobalText] : (selectedTextScene ? sceneTextLayers(selectedTextScene) : []);
  const selectedTextLayer = (selectedGlobalText ?? selectedTextLayers.find(layer => layer.id === selectedTextLayerId) ?? selectedTextLayers[0] ?? null) as TextLayer;
  return {
    active, activeStart, selectedScenes, selectedScene, selectedCount: selectedScenes.length, hasSceneSelection: selectedIds.length > 0,
    isSelected: id => idSet.has(id), previewTarget, projectTextScene, selectedGlobalText, pipScenes, selectedPip, renderPipScenes,
    pipVideoScenes: renderPipScenes.filter(clip => clip.mediaKind === 'video'), activePip, selectedTextScene, selectedTextLayers, selectedTextLayer,
  };
}

/** The view for the current inputs, recomputed only when one of them changes. */
export function useEditorViewModel(input: ViewInputs): EditorView {
  const { project, position, playing, selectedIds, primarySelected, selectedGlobalTextId, selectedPipId, selectedTextLayerId, previewScene, pipDraft } = input;
  const projectTicks = totalTicks(project);
  const projectTextScene = useMemo(() => buildProjectTextScene(project), [project.id, project.globalText, projectTicks]); // eslint-disable-line react-hooks/exhaustive-deps
  return useMemo(() => deriveEditorView({ ...input, projectTextScene }), [projectTextScene, project, position, playing, selectedIds, primarySelected, selectedGlobalTextId, selectedPipId, selectedTextLayerId, previewScene, pipDraft]); // eslint-disable-line react-hooks/exhaustive-deps
}

const EditorViewContext = createContext<EditorView | null>(null);

export function EditorViewProvider({ value, children }: { value: EditorView; children?: ReactNode }) {
  return createElement(EditorViewContext.Provider, { value }, children);
}

export function useEditorView(): EditorView {
  const view = useContext(EditorViewContext);
  if (!view) throw new Error('useEditorView needs an EditorViewProvider.');
  return view;
}
