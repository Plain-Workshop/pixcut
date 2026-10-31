import { clipCount, t } from '../../i18n';
import { splitAudioClip } from '../../components/timeline/audio-split';
import { type TimelineOverlay } from '../../components/elements/overlays';
import { type Dispatch, type MouseEvent as ReactMouseEvent, type RefObject, type SetStateAction } from 'react';
import { minTicks, projectScenes, scenePatch, sceneSeconds, secondsToTicks, setSceneSeconds, ticksToSeconds, type AudioClip, type Command, type Project, type Scene, type ScenePatchKey, type TextLayer, type SceneFormatOverride, type FormatVariant } from '../../stores/model';
import { sceneTextLayers } from '../../components/text/layers';

/** Playback, selection and scene editing commands (split, duplicate, delete, scrub, select). */
export function useSceneCommands({ activeFormat, audio, audioTargetRef, commitElement, duration, editTarget, editTargetRef, frameSeconds, hasSceneSelection, latestProject, operation, overlayDraftRef, pending, pipDraftRef, playing, position, positionRef, primarySelected, project, removeAudio, removeElement, removePip, replaceSceneTextLayers, run, scenes, selectedAudio, selectedAudioId, selectedElement, selectedGlobalText, selectedIds, selectedPip, selectedScene, selectedScenes, selectedTextLayerId, selectionAnchor, setEditTarget, setEditingText, setGlobalTextDraft, setNotice, setOverlayDraft, setPipDraft, setPlayDirection, setPlaying, setPosition, setPreviewScene, setPrimarySelected, setSelectedAudioId, setSelectedElementId, setSelectedGlobalTextId, setSelectedIds, setSelectedPipId, setSelectedTextLayerId, snapping }: {
  activeFormat: FormatVariant;
  audio: AudioClip[];
  audioTargetRef: RefObject<string | null>;
  commitElement: () => void;
  duration: number;
  editTarget: "scene" | "text" | "element" | "audio";
  editTargetRef: RefObject<"scene" | "text" | "element" | "audio">;
  frameSeconds: number;
  hasSceneSelection: boolean;
  latestProject: RefObject<Project>;
  operation: RefObject<boolean>;
  overlayDraftRef: RefObject<TimelineOverlay | null>;
  pending: RefObject<Promise<boolean>>;
  pipDraftRef: RefObject<Scene | null>;
  playing: boolean;
  position: number;
  positionRef: RefObject<number>;
  primarySelected: string | null;
  project: Project;
  removeAudio: (id: string) => void;
  removeElement: (id: string) => void;
  removePip: (id: string) => void;
  replaceSceneTextLayers: (scene: Scene, layers: TextLayer[]) => Scene;
  run: (command: Command) => Promise<boolean>;
  scenes: Scene[];
  selectedAudio: AudioClip;
  selectedAudioId: string | null;
  selectedElement: TimelineOverlay | null;
  selectedGlobalText: TextLayer | null;
  selectedIds: string[];
  selectedPip: Scene | null;
  selectedScene: Scene | undefined;
  selectedScenes: Scene[];
  selectedTextLayerId: string | null;
  selectionAnchor: RefObject<string | null>;
  setEditTarget: Dispatch<SetStateAction<"scene" | "text" | "element" | "audio">>;
  setEditingText: Dispatch<SetStateAction<boolean>>;
  setGlobalTextDraft: Dispatch<SetStateAction<TextLayer[] | null>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setOverlayDraft: Dispatch<SetStateAction<TimelineOverlay | null>>;
  setPipDraft: Dispatch<SetStateAction<Scene | null>>;
  setPlayDirection: Dispatch<SetStateAction<1 | -1>>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  setPosition: Dispatch<SetStateAction<number>>;
  setPreviewScene: Dispatch<SetStateAction<Scene | null>>;
  setPrimarySelected: Dispatch<SetStateAction<string | null>>;
  setSelectedAudioId: Dispatch<SetStateAction<string | null>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSelectedGlobalTextId: Dispatch<SetStateAction<string | null>>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPipId: Dispatch<SetStateAction<string | null>>;
  setSelectedTextLayerId: Dispatch<SetStateAction<string | null>>;
  snapping: boolean;
}) {
  function togglePlayback() {
    if (!duration) return;
    if (playing) { setPlaying(false); return; }
    if (position >= duration - frameSeconds) setPosition(0);
    setPreviewScene(null);
    setPlayDirection(1);
    setPlaying(true);
  }

  function playForward() {
    if (!duration) return;
    if (position >= duration - frameSeconds) setPosition(0);
    setPreviewScene(null);
    setPlayDirection(1);
    setPlaying(true);
  }

  function playReverse() {
    if (!duration) return;
    if (position <= frameSeconds) setPosition(Math.max(0, duration - frameSeconds));
    setPreviewScene(null);
    setPlayDirection(-1);
    setPlaying(true);
  }

  function stepFrame(direction: 1 | -1) {
    if (!duration) return;
    setPlaying(false);
    setPosition(value => Math.min(Math.max(0, value + direction * frameSeconds), Math.max(0, duration - frameSeconds)));
  }

  function snapTime(value: number) {
    const limit = Math.max(0, duration - frameSeconds);
    const clamped = Math.min(Math.max(0, value), limit);
    if (!snapping) return clamped;
    const cuts = [0];
    for (const scene of scenes) {
      cuts.push(Math.min(ticksToSeconds(scene.startTicks, project.timebase), limit));
      cuts.push(Math.min(ticksToSeconds(scene.startTicks + scene.durationTicks, project.timebase), limit));
    }
    let best = clamped, distance = 0.12;
    for (const cut of cuts) {
      const gap = Math.abs(cut - clamped);
      if (gap <= distance) { distance = gap; best = cut; }
    }
    return best;
  }

  function scrubTo(value: number) {
    setPlaying(false);
    setPosition(snapTime(value));
  }

  function focusScene(scene: Scene) {
    setPlaying(false);
    setPosition(ticksToSeconds(scene.startTicks, project.timebase));
  }

  function selectScene(scene: Scene, event?: ReactMouseEvent, seek = true) {
    commitElement();
    // A linked audio strip selects its scene without seeking; keep the
    // playhead exactly where it was if anything else tries to move it.
    const anchor = positionRef.current;
    const wasPlaying = playing;
    if (!seek) queueMicrotask(() => {
      if (!wasPlaying && positionRef.current !== anchor) { positionRef.current = anchor; setPosition(anchor); }
    });
    editTargetRef.current = 'scene';
    audioTargetRef.current = null;
    setSelectedElementId(null); setOverlayDraft(null); overlayDraftRef.current = null;
    setEditingText(false); setSelectedTextLayerId(null); setSelectedGlobalTextId(null); setGlobalTextDraft(null);
    setSelectedPipId(null); setPipDraft(null); pipDraftRef.current = null;
    setSelectedAudioId(null);
    setEditTarget('scene');
    const toggle = Boolean(event?.metaKey || event?.ctrlKey);
    const range = Boolean(event?.shiftKey);
    if (toggle) {
      if (selectedIds.includes(scene.id)) {
        const next = selectedIds.filter(id => id !== scene.id);
        setSelectedIds(next);
        if (primarySelected === scene.id) setPrimarySelected(next.at(-1) ?? null);
        selectionAnchor.current = scene.id;
      } else {
        setSelectedIds([...selectedIds, scene.id]);
        setPrimarySelected(scene.id);
        selectionAnchor.current = scene.id;
        if (seek) focusScene(scene);
      }
      return;
    }
    if (range && selectionAnchor.current) {
      const ids = scenes.map(item => item.id);
      const from = ids.indexOf(selectionAnchor.current), to = ids.indexOf(scene.id);
      if (from >= 0 && to >= 0) {
        setSelectedIds(ids.slice(Math.min(from, to), Math.max(from, to) + 1));
        setPrimarySelected(scene.id);
        if (seek) focusScene(scene);
        return;
      }
    }
    setSelectedIds([scene.id]);
    setPrimarySelected(scene.id);
    selectionAnchor.current = scene.id;
    if (seek) focusScene(scene);
  }

  /**
   * Writes the inspector's draft to the selected clips. With `scope: 'all'`
   * only the `force` fields are written, to every clip in the story, and an
   * unset field is written as unset so it clears on the others too.
   */
  function updateSelection(next: Scene, force: ScenePatchKey[] = [], scope: 'selection' | 'all' = 'selection'): Promise<boolean> {
    if (selectedGlobalText && scope === 'selection') {
      const layers = next.textLayers ?? [];
      return run({ type: 'globalText', layers }).finally(() => setGlobalTextDraft(null));
    }
    const targets = scope === 'all' ? scenes : selectedScenes;
    if (!targets.length) return Promise.resolve(false);
    const base = targets.find(scene => scene.id === next.id) ?? targets[0];
    const patch: Partial<Scene> = scope === 'all' ? {} : scenePatch(base, next);
    for (const key of force) {
      const value = (next as unknown as Record<string, unknown>)[key];
      if (value !== undefined || scope === 'all') (patch as Record<string, unknown>)[key] = value;
    }
    if (!Object.keys(patch).length) return Promise.resolve(true);
    const ids = targets.map(scene => scene.id);
    const framingKeys = ['imageX', 'imageY', 'imageZoom', 'fit', 'framingBackground'] as const;
    const framePatch: SceneFormatOverride = {};
    const existingFraming = activeFormat?.overrides[base.id];
    let frameChanged = false;
    for (const key of framingKeys) {
      if (!(key in patch)) continue;
      const value = (patch as Record<string, unknown>)[key];
      if (value !== undefined) {
        (framePatch as Record<string, unknown>)[key] = value;
        if ((existingFraming as Record<string, unknown> | undefined)?.[key] !== value) frameChanged = true;
      }
      delete (patch as Record<string, unknown>)[key];
    }
    let formatsTask: Promise<boolean> | null = null;
    if (frameChanged && activeFormat) {
      const nextFormats = project.formats.map(format => format.id === activeFormat.id
        ? { ...format, overrides: { ...format.overrides, ...Object.fromEntries(ids.map(id => [id, { ...format.overrides[id], ...framePatch }])) } }
        : format);
      formatsTask = run({ type: 'formats', formats: nextFormats });
    }
    const applyPatch = (): Promise<boolean> => {
      const latest = projectScenes(latestProject.current);
      const currentTargets = ids.map(id => latest.find(scene => scene.id === id)).filter((scene): scene is Scene => Boolean(scene));
      if (!currentTargets.length) return Promise.resolve(false);
      if (currentTargets.length === 1) {
        return run({ type: 'update', scene: { ...currentTargets[0], ...patch } });
      }
      const scenes = currentTargets.map(scene => {
        const merged: Scene = { ...scene, ...patch };
        if (patch.speed !== undefined) {
          const source = sceneSeconds(scene, project.timebase) * (scene.speed ?? 1);
          const duration = Math.min(30, Math.max(0.5, source / patch.speed));
          const resized = setSceneSeconds(scene, duration, project.timebase);
          merged.durationTicks = resized.durationTicks;
          merged.speed = patch.speed;
        } else if (patch.durationTicks !== undefined) {
          merged.durationTicks = setSceneSeconds(merged, ticksToSeconds(patch.durationTicks, project.timebase), project.timebase).durationTicks;
        }
        const seconds = sceneSeconds(merged, project.timebase);
        merged.fadeIn = Math.min(merged.fadeIn ?? 0, seconds);
        merged.fadeOut = Math.min(merged.fadeOut ?? 0, seconds);
        return merged;
      });
      return run({ type: 'updateMany', scenes });
    };
    const commonTask = Object.keys(patch).length ? (operation.current ? pending.current.then(applyPatch) : Promise.resolve(applyPatch())) : null;
    const task = formatsTask ?? commonTask ?? Promise.resolve(true);
    return task.finally(() => setPreviewScene(null));
  }

  function splitAtPlayhead() {
    if (editTargetRef.current === 'audio') {
      splitAudioAtPlayhead(audio.find(item => item.id === audioTargetRef.current) ?? selectedAudio);
      return;
    }
    if (selectedScenes.length !== 1) {
      setNotice(t('Select one clip to split at the playhead.'));
      return;
    }
    const scene = selectedScenes[0];
    const index = scenes.findIndex(item => item.id === scene.id);
    if (index < 0) return;
    const atTicks = secondsToTicks(position, project.timebase) - scene.startTicks;
    const splitMinimum = minTicks(project.timebase);
    if (atTicks < splitMinimum || scene.durationTicks - atTicks < splitMinimum) {
      setNotice(t('Place the playhead at least half a second inside the selected clip.'));
      return;
    }
    const newId = crypto.randomUUID();
    void run({ type: 'split', id: scene.id, atTicks, newId }).then(ok => {
      if (ok) {
        setSelectedIds([newId]);
        setPrimarySelected(newId);
        selectionAnchor.current = newId;
        setNotice(scene.mediaKind === 'video' ? t('Video split at the playhead, with its sound. Undo restores one clip.') : t('Clip split at the playhead. Undo restores one clip.'));
      }
    });
  }

  /**
   * Audio clips are not in the visual track's split command, so splitting one
   * replaces it with two clips that share the same source and lane. Selecting
   * audio and pressing Split used to split the active video instead, because
   * the visual selection falls back to whatever sits under the playhead.
   */
  function splitAudioAtPlayhead(clip: AudioClip | null) {
    if (!clip) { setNotice(t('Select an audio clip to split at the playhead.')); return; }
    const atTicks = secondsToTicks(position, project.timebase) - clip.startTicks;
    const splitMinimum = minTicks(project.timebase);
    if (atTicks < splitMinimum || clip.durationTicks - atTicks < splitMinimum) {
      setNotice(t('Place the playhead at least half a second inside the selected audio clip.'));
      return;
    }
    const parts = splitAudioClip(clip, atTicks, crypto.randomUUID(), project.timebase);
    if (!parts) { setNotice(t('Place the playhead inside the selected audio clip.')); return; }
    const audio = project.audio.flatMap(item => item.id === clip.id ? [parts.left, parts.right] : [item]);
    void run({ type: 'audio', audio }).then(ok => {
      if (ok) { setEditTarget('audio'); setSelectedAudioId(parts.right.id); setNotice(t('Audio split at the playhead. Undo restores one clip.')); }
    });
  }

  function duplicateSelected() {
    const targets = selectedScenes;
    if (!targets.length) return;
    const items = targets.map(scene => ({ id: scene.id, newId: crypto.randomUUID() }));
    void run({ type: 'duplicateMany', items }).then(ok => {
      if (ok) {
        const newIds = items.map(item => item.newId);
        setSelectedIds(newIds);
        setPrimarySelected(newIds.at(-1) ?? null);
        selectionAnchor.current = newIds.at(-1) ?? null;
        setNotice(t('{clips} duplicated.', { clips: clipCount(items.length) }));
      }
    });
  }

  function deleteSelected() {
    if (editTargetRef.current === 'audio') { const id = audioTargetRef.current ?? selectedAudioId; if (id) removeAudio(id); return; }
    if (editTarget === 'element') { if (selectedElement) removeElement(selectedElement.id); return; }
    if (selectedPip) { removePip(selectedPip.id); return; }
    if (editTarget === 'text' && selectedGlobalText) {
      const layers = (project.globalText ?? []).filter(layer => layer.id !== selectedGlobalText.id);
      void run({ type: 'globalText', layers });
      setSelectedGlobalTextId(null); return;
    }
    if (editTarget === 'text' && selectedScene && selectedTextLayerId) {
      const layers = sceneTextLayers(selectedScene).filter(layer => layer.id !== selectedTextLayerId);
      void updateSelection(replaceSceneTextLayers(selectedScene, layers));
      setSelectedTextLayerId(null); return;
    }
    if (editTarget === 'text') return;
    if (!hasSceneSelection) {
      if (selectedAudioId) {
        const clip = audio.find(item => item.id === selectedAudioId);
        if (clip) { removeAudio(clip.id); return; }
      }
      setNotice(t('Select a clip to delete.'));
      return;
    }
    const targets = selectedScenes;
    if (!targets.length) return;
    const ids = targets.map(scene => scene.id);
    void run({ type: 'removeMany', ids }).then(ok => {
      if (ok) {
        setSelectedIds([]);
        setPrimarySelected(null);
        selectionAnchor.current = null;
        setNotice(t('{clips} deleted. Undo brings them back.', { clips: clipCount(ids.length) }));
      }
    });
  }

  return { togglePlayback, playForward, playReverse, stepFrame, scrubTo, selectScene, updateSelection, splitAtPlayhead, duplicateSelected, deleteSelected };
}
