import { useUi, type UiStore } from '../ui-store';
import { usePlayback, type PlaybackStore } from '../playback-store';
import { useSelection, type SelectionStore } from '../selection-store';
import { useDrafts, type DraftsStore } from '../drafts-store';
import { emptyProject, projectScenes, type Command, type Project, type Scene, type FormatVariant } from '../../stores/model';
import { FORMAT_PRESETS } from '../../stores/formats';
import { useFormats } from './useFormats';
import { buildTemplateProject, type TemplateDefinition } from '../../templates/catalog';

import { type Preferences } from '../../stores/preferences';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { FormatQuality } from '../../stores/model';

export function useProjectStarts({activeFormat, customFormatDraft, latestProject, newCustomFormats, newFormatIds, newFormatSelection, newProjectFps, persistCurrent, preferences, project, run, selectedScene, selectionAnchor, setActiveFormatId, setCustomFormatDraft, setError, setNewCustomFormats, setNotice, setPendingTemplate, setScreen, uiStore, playbackStore, selectionStore, draftsStore}: {
  activeFormat: FormatVariant;
  customFormatDraft: { name: string; width: number; height: number; fps: number; quality: "draft" | "standard" | "high"; };
  latestProject: RefObject<Project>;
  newCustomFormats: FormatVariant[];
  newFormatIds: string[];
  newFormatSelection: (FormatVariant | { name: string; presetId: string; platform: string; width: number; height: number; fps: number; quality: FormatQuality; })[];
  newProjectFps: number;
  persistCurrent: () => Promise<void>;
  preferences: Preferences;
  project: Project;
  run: (command: Command) => Promise<boolean>;
  selectedScene: Scene | undefined;
  selectionAnchor: RefObject<string | null>;
  setActiveFormatId: Dispatch<SetStateAction<string | null>>;
  setCustomFormatDraft: Dispatch<SetStateAction<{ name: string; width: number; height: number; fps: number; quality: "draft" | "standard" | "high"; }>>;
  setError: Dispatch<SetStateAction<string>>;
  setNewCustomFormats: Dispatch<SetStateAction<FormatVariant[]>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setPendingTemplate: Dispatch<SetStateAction<TemplateDefinition | null>>;
  setScreen: Dispatch<SetStateAction<"home" | "editor">>;
  uiStore: UiStore;
  playbackStore: PlaybackStore;
  selectionStore: SelectionStore;
  draftsStore: DraftsStore;
}) {
  const { setEditingText, setHomeSection, setModal } = useUi(uiStore);
  const { setPlaying, setPosition } = usePlayback(playbackStore);
  const { setPrimarySelected, setSelectedIds } = useSelection(selectionStore);
  const { setPreviewScene } = useDrafts(draftsStore);
  async function launchProject(p: Project) {
    if (projectScenes(latestProject.current).length) await persistCurrent();
    if (!(await run({ type: 'replace', project: p }))) return false;
    const first = projectScenes(p)[0]?.id ?? null;
    setSelectedIds(first ? [first] : []);
    setPrimarySelected(first);
    selectionAnchor.current = first;
    setPosition(0);
    setPreviewScene(null);
    setEditingText(false);
    setPlaying(false);
    setScreen('editor');
    setModal(null);
    setPendingTemplate(null);
    setHomeSection('home');
    return true;
  }

  async function startBlank() {
    await launchProject(emptyProject('Untitled story', preferences.defaultAspect));
  }

  async function startWithFormats() {
    const selected = FORMAT_PRESETS.filter(preset => newFormatIds.includes(preset.id));
    try { if (selected.length) localStorage.setItem('pixcut.lastFormats', JSON.stringify(selected.map(preset => preset.id))); } catch { /* remembering the last choice is optional */ }
    const baseAspect = (['16:9', '9:16', '1:1', '4:5'].includes(selected[0]?.aspect ?? '') ? selected[0].aspect : preferences.defaultAspect) as Project['aspect'];
    const next = emptyProject('Untitled story', baseAspect, newProjectFps);
    const presetFormats = selected.map(preset => ({ id: crypto.randomUUID(), name: preset.name, platform: preset.platform, aspect: preset.aspect, width: preset.width, height: preset.height, fps: preset.fps, quality: preset.quality, presetId: preset.id, overrides: {} }));
    next.formats = presetFormats.length || newCustomFormats.length ? [...presetFormats, ...newCustomFormats] : next.formats;
    setNewCustomFormats([]);
    await launchProject(next);
  }

  const { toggleFormatPreset, addNewCustomFormat, addCustomFormat, updateFormatSettings, removeFormat, applyFramingToAllFormats } = useFormats({ project, run, setNotice, setError, activeFormat, setActiveFormatId, selectedScene, newFormatCount: newFormatSelection.length, setNewCustomFormats, customFormatDraft, setCustomFormatDraft });

  async function startTemplate(template: TemplateDefinition) {
    // A template is a fresh story: always use its bundled photography, never
    // the photos from whichever project happened to be open underneath it.
    await launchProject(await buildTemplateProject(template));
  }

  function chooseTemplate(template: TemplateDefinition) {
    if (projectScenes(latestProject.current).length) {
      setPendingTemplate(template);
      setModal('new');
      return;
    }
    void startTemplate(template);
  }

  return { launchProject, startBlank, startWithFormats, toggleFormatPreset, addNewCustomFormat, addCustomFormat, updateFormatSettings, removeFormat, applyFramingToAllFormats, startTemplate, chooseTemplate };
}
