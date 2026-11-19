import { usePlayback, type PlaybackStore } from '../playback-store';
import { formatBinding, saveShortcutSettings, type CommandAvailability, type ShortcutSettings as ShortcutSettingsData } from '../../shortcuts/registry';
import { commandAvailability as resolveAvailability } from '../command-availability';
import { t } from '../../i18n';
import { messageFor } from '../errors';
import { HINTS_KEY } from '../export-options';
import { type AudioClip, type Scene, type Session } from '../../stores/model';
import { type Preferences } from '../../stores/preferences';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { LaneId } from './useClipEditing';
import type { ShortcutPlatform } from '../../shortcuts/registry';
import type { Project } from '../../stores/model';

export function useShortcutHelpers({audio, audioTargetRef, busy, canEdit, clipEditing, duration, editTargetRef, exporting, lockedLanes, platform, project, projectTicks, ready, scenes, screen, selectedAudio, selectedScene, selectedScenes, session, setError, setNotice, setShortcuts, setShowHints, shortcuts, updatePreferences, playbackStore}: {
  audio: AudioClip[];
  audioTargetRef: RefObject<string | null>;
  busy: boolean;
  canEdit: boolean;
  clipEditing: RefObject<{ rippleDeleteSelected: () => void; trimSelected: (edge: "start" | "end") => void; nudgeSelected: (frames: number) => void; copySelected: () => void; pasteClipboard: () => void; selectAfterPlayhead: () => void; selectionLane: () => LaneId; } | null>;
  duration: number;
  editTargetRef: RefObject<"text" | "audio" | "scene" | "element">;
  exporting: boolean;
  lockedLanes: string[];
  platform: ShortcutPlatform;
  project: Project;
  projectTicks: number;
  ready: boolean;
  scenes: Scene[];
  screen: "home" | "editor";
  selectedAudio: AudioClip;
  selectedScene: Scene | undefined;
  selectedScenes: Scene[];
  session: Session;
  setError: Dispatch<SetStateAction<string>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setShortcuts: Dispatch<SetStateAction<ShortcutSettingsData>>;
  setShowHints: Dispatch<SetStateAction<boolean>>;
  shortcuts: ShortcutSettingsData;
  updatePreferences: (patch: Partial<Preferences>) => void;
  playbackStore: PlaybackStore;
}) {
  const { position } = usePlayback(playbackStore);
  function shortcutText(id: string) {
    const binding = shortcuts.bindings[id] ?? '';
    return binding ? formatBinding(binding, platform) : 'Unassigned';
  }

  function availabilityFor(id: string): CommandAvailability {
    return resolveAvailability(id, {
      screen, ready, busy, canEdit, exporting, canUndo: session.canUndo, canRedo: session.canRedo, scenes, selectedScenes, selectedScene,
      position, timebase: project.timebase, duration, projectTicks, editTarget: editTargetRef.current, audioTargetId: audioTargetRef.current,
      audio, selectedAudio, lockedLanes, selectionLane: () => clipEditing.current?.selectionLane() ?? '',
    });
  }

  function tip(id: string, label: string) {
    const state = availabilityFor(id);
    return `${t(label)} · ${shortcutText(id)}${state.disabled && state.reason ? ` — ${state.reason}` : ''}`;
  }

  function applyShortcuts(next: ShortcutSettingsData) {
    try { saveShortcutSettings(next); } catch (e) { setError(t('Shortcuts could not be saved. {e}', { e: messageFor(e) })); return false; }
    setShortcuts(next);
    setNotice(t('Shortcuts applied everywhere: tooltips, help, and the command palette.'));
    return true;
  }

  function dismissHints() {
    setShowHints(false);
    updatePreferences({ showHints: false });
    try { localStorage.setItem(HINTS_KEY, '1'); } catch { /* local preferences are optional */ }
  }

  return { shortcutText, availabilityFor, tip, applyShortcuts, dismissHints };
}
