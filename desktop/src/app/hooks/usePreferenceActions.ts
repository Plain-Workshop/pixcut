import { usePlayback, type PlaybackStore } from '../playback-store';
import { DEFAULT_PREFERENCES, type Preferences } from '../../stores/preferences';
import { secondsToTicks, ticksToSeconds } from '../../stores/model';
import { editPoints, nextEditPoint } from '../../components/timeline/ruler';
import { HINTS_KEY } from '../export-options';
import { t } from '../../i18n';
import { formatBytes } from '../helpers';
import * as bridge from '../bridge';
import { messageFor } from '../errors';
import type { Project } from '../../stores/model';
import type { Dispatch, SetStateAction } from 'react';

export function usePreferenceActions({duration, frameSeconds, project, setError, setExporter, setNotice, setPreferences, setShowHints, setSnapping, setStorageLabel, playbackStore}: {
  duration: number;
  frameSeconds: number;
  project: Project;
  setError: Dispatch<SetStateAction<string>>;
  setExporter: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setPreferences: Dispatch<SetStateAction<Preferences>>;
  setShowHints: Dispatch<SetStateAction<boolean>>;
  setSnapping: Dispatch<SetStateAction<boolean>>;
  setStorageLabel: Dispatch<SetStateAction<string>>;
  playbackStore: PlaybackStore;
}) {
  const { position, setPlaying, setPosition } = usePlayback(playbackStore);
  function updatePreferences(patch: Partial<Preferences>) {
    setPreferences(current => ({ ...current, ...patch }));
  }

  /** Playhead moves from the keyboard stop playback and land on a frame inside the story. */
  function movePlayhead(seconds: number) {
    setPlaying(false);
    setPosition(Math.min(Math.max(0, seconds), Math.max(0, duration - frameSeconds)));
  }

  function jumpToEdit(direction: 1 | -1) {
    const current = secondsToTicks(position, project.timebase);
    const target = nextEditPoint(editPoints(project), current, direction);
    // The story's end tick is past the last frame, so step one frame back from it.
    movePlayhead(target === current && direction > 0 ? duration : ticksToSeconds(target, project.timebase));
  }

  function toggleSnapping() {
    setSnapping(value => {
      const next = !value;
      setPreferences(current => ({ ...current, snapping: next }));
      return next;
    });
  }

  function resetPreferences() {
    setPreferences({ ...DEFAULT_PREFERENCES });
    setSnapping(DEFAULT_PREFERENCES.snapping);
    setShowHints(true);
    try { localStorage.removeItem(HINTS_KEY); } catch { /* optional */ }
    setNotice(t('Preferences reset to their defaults.'));
  }

  function refreshStorage() {
    setStorageLabel('Checking local storage…');
    navigator.storage?.estimate?.().then(({ usage, quota }) => {
      setStorageLabel(`${formatBytes(usage ?? 0)} used${quota ? ` of ${formatBytes(quota)} available` : ''}`);
    }).catch(() => setStorageLabel('Storage usage is unavailable in this preview.'));
  }

  function recheckExporter() {
    bridge.exporterAvailable().then(available => { setExporter(available); setNotice(available ? t('FFmpeg is ready for MP4 export.') : t('FFmpeg was not found on this device.')); }).catch(error => setError(messageFor(error)));
  }

  return { updatePreferences, movePlayhead, jumpToEdit, toggleSnapping, resetPreferences, refreshStorage, recheckExporter };
}
