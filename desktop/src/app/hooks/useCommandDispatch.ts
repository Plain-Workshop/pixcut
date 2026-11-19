import { useUi, type UiStore } from '../ui-store';
import { usePlayback, type PlaybackStore } from '../playback-store';
import { useSelection, type SelectionStore } from '../selection-store';
import { useDrafts, type DraftsStore } from '../drafts-store';
import { t } from '../../i18n';
import { COMMANDS, type CommandAvailability } from '../../shortcuts/registry';
import { type TimelineOverlay } from '../../components/elements/overlays';
import { type TimelineControls } from '../screens/TimelinePanel';

import { type Command, type Scene, type TextLayer } from '../../stores/model';
import { type ProjectSummary } from '../../stores/library';
import { type TemplateDefinition } from '../../templates/catalog';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { LaneId } from './useClipEditing';

export function useCommandDispatch({addBeatAtPlayhead, addTextLayerAtPlayhead, availabilityFor, chooseImages, clipEditing, closeModalRef, commandRef, deleteSelected, duplicateSelected, duration, fullscreenRef, jumpToEdit, movePlayhead, open, openExportModal, overlayDraftRef, pipDraftRef, playForward, playReverse, run, save, scenes, selectionAnchor, setDeleteTarget, setGroupDrafts, setGroupTarget, setNotice, setPendingTemplate, setRenameTarget, setShortcutDirty, shortcutDirty, splitAtPlayhead, startBlank, stepFrame, timelineControls, togglePlayback, toggleSnapping, uiStore, playbackStore, selectionStore, draftsStore}: {
  addBeatAtPlayhead: () => void;
  addTextLayerAtPlayhead: (preset?: Partial<TextLayer>) => void;
  availabilityFor: (id: string) => CommandAvailability;
  chooseImages: () => Promise<void>;
  clipEditing: RefObject<{ rippleDeleteSelected: () => void; trimSelected: (edge: "start" | "end") => void; nudgeSelected: (frames: number) => void; copySelected: () => void; pasteClipboard: () => void; selectAfterPlayhead: () => void; selectionLane: () => LaneId; } | null>;
  closeModalRef: RefObject<() => void>;
  commandRef: RefObject<(id: string) => void>;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  duration: number;
  fullscreenRef: RefObject<() => void>;
  jumpToEdit: (direction: 1 | -1) => void;
  movePlayhead: (seconds: number) => void;
  open: () => Promise<void>;
  openExportModal: () => void;
  overlayDraftRef: RefObject<TimelineOverlay | null>;
  pipDraftRef: RefObject<Scene | null>;
  playForward: () => void;
  playReverse: () => void;
  run: (command: Command) => Promise<boolean>;
  save: () => Promise<void>;
  scenes: Scene[];
  selectionAnchor: RefObject<string | null>;
  setDeleteTarget: Dispatch<SetStateAction<ProjectSummary | null>>;
  setGroupDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setGroupTarget: Dispatch<SetStateAction<ProjectSummary | null>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setPendingTemplate: Dispatch<SetStateAction<TemplateDefinition | null>>;
  setRenameTarget: Dispatch<SetStateAction<ProjectSummary | null>>;
  setShortcutDirty: Dispatch<SetStateAction<boolean>>;
  shortcutDirty: boolean;
  splitAtPlayhead: () => void;
  startBlank: () => Promise<void>;
  stepFrame: (direction: 1 | -1) => void;
  timelineControls: RefObject<TimelineControls | null>;
  togglePlayback: () => void;
  toggleSnapping: () => void;
  uiStore: UiStore;
  playbackStore: PlaybackStore;
  selectionStore: SelectionStore;
  draftsStore: DraftsStore;
}) {
  const { modal, setContextMenu, setEditingText, setFramingMode, setModal, setSafeArea, settingsTab } = useUi(uiStore);
  const { position, setPlaying } = usePlayback(playbackStore);
  const { setPrimarySelected, setSelectedElementId, setSelectedGlobalTextId, setSelectedIds, setSelectedPipId, setSelectedTextLayerId } = useSelection(selectionStore);
  const { setOverlayDraft, setPipDraft } = useDrafts(draftsStore);
  function requestCloseModal() {
    if (modal === 'settings' && settingsTab === 'shortcuts' && shortcutDirty) {
      setNotice(t('Apply or cancel your shortcut changes before closing Settings.'));
      return;
    }
    if (modal === 'new') setPendingTemplate(null);
    if (modal === 'delete') setDeleteTarget(null);
    if (modal === 'rename') setRenameTarget(null);
    if (modal === 'group') setGroupTarget(null);
    if (modal === 'groups') setGroupDrafts({});
    setModal(null);
  }

  function closeShortcutSettings() {
    setShortcutDirty(false);
    setModal(null);
  }

  function runCommandId(id: string) {
    const state = availabilityFor(id);
    if (state.disabled) { if (state.reason) setNotice(state.reason); return; }
    setContextMenu(null);
    if (modal === 'palette') setModal(null);
    switch (id) {
      case 'palette.open': setModal('palette'); break;
      case 'help.shortcuts': setModal('shortcuts'); break;
      case 'settings.open': setModal('settings'); break;
      case 'project.new': scenes.length ? setModal('new') : void startBlank(); break;
      case 'project.open': void open(); break;
      case 'project.save': void save(); break;
      case 'project.import': void chooseImages(); break;
      case 'export.open': openExportModal(); break;
      case 'history.undo': void run({ type: 'undo' }); break;
      case 'history.redo': void run({ type: 'redo' }); break;
      case 'playback.toggle': togglePlayback(); break;
      case 'playback.forward': playForward(); break;
      case 'playback.reverse': playReverse(); break;
      case 'playback.stop': setPlaying(false); break;
      case 'clip.split': splitAtPlayhead(); break;
      case 'clip.delete': deleteSelected(); break;
      case 'clip.ripple_delete': clipEditing.current?.rippleDeleteSelected(); break;
      case 'clip.trim_start': clipEditing.current?.trimSelected('start'); break;
      case 'clip.trim_end': clipEditing.current?.trimSelected('end'); break;
      case 'clip.nudge_left': clipEditing.current?.nudgeSelected(-1); break;
      case 'clip.nudge_right': clipEditing.current?.nudgeSelected(1); break;
      case 'clip.nudge_left_10': clipEditing.current?.nudgeSelected(-10); break;
      case 'clip.nudge_right_10': clipEditing.current?.nudgeSelected(10); break;
      case 'clip.copy': clipEditing.current?.copySelected(); break;
      case 'clip.paste': clipEditing.current?.pasteClipboard(); break;
      case 'edit.select_after': clipEditing.current?.selectAfterPlayhead(); break;
      case 'clip.duplicate': duplicateSelected(); break;
      case 'timeline.prev_frame': stepFrame(-1); break;
      case 'timeline.next_frame': stepFrame(1); break;
      case 'timeline.prev_edit': jumpToEdit(-1); break;
      case 'timeline.next_edit': jumpToEdit(1); break;
      case 'timeline.back_second': movePlayhead(position - 1); break;
      case 'timeline.forward_second': movePlayhead(position + 1); break;
      case 'timeline.go_start': movePlayhead(0); break;
      case 'timeline.go_end': movePlayhead(duration); break;
      case 'timeline.zoom_in': timelineControls.current?.zoomBy(1.5); break;
      case 'timeline.zoom_out': timelineControls.current?.zoomBy(1 / 1.5); break;
      case 'timeline.zoom_fit': timelineControls.current?.fit(); break;
      case 'timeline.snapping': toggleSnapping(); break;
      case 'edit.select_all': {
        const ids = scenes.map(scene => scene.id);
        if (!ids.length) break;
        setSelectedIds(ids);
        setPrimarySelected(ids[ids.length - 1]);
        selectionAnchor.current = ids[ids.length - 1];
        break;
      }
      case 'edit.deselect':
        setSelectedIds([]); setPrimarySelected(null); selectionAnchor.current = null;
        setSelectedTextLayerId(null); setSelectedGlobalTextId(null); setSelectedPipId(null); setPipDraft(null); pipDraftRef.current = null; setSelectedElementId(null);
        setOverlayDraft(null); overlayDraftRef.current = null;
        setEditingText(false); setFramingMode(false);
        break;
      case 'beat.add': addBeatAtPlayhead(); break;
      case 'text.add': addTextLayerAtPlayhead(); break;
      case 'view.safe_area': setSafeArea(value => !value); break;
    }
  }

  commandRef.current = runCommandId;
  fullscreenRef.current = () => { const element = document.querySelector('.preview-panel'); if (!document.fullscreenElement) void element?.requestFullscreen?.(); else void document.exitFullscreen(); };
  closeModalRef.current = requestCloseModal;
  const commandAvailability: Record<string, CommandAvailability> = Object.fromEntries(COMMANDS.map(command => [command.id, availabilityFor(command.id)]));

  return { requestCloseModal, closeShortcutSettings, runCommandId, commandAvailability };
}
