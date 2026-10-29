import { useRef, type Dispatch, type SetStateAction } from 'react';
import { MAX_AUDIO_LANES, minTicks, overlayScenes, projectScenes, secondsToTicks, ticksToSeconds, trimSceneWindow, type AudioClip, type Command, type ElementLayer, type Project, type Scene } from '../../stores/model';
import { nudgeStart, pasteStart, rippleRemove, startingAtOrAfter, trimToPlayhead } from '../../components/timeline/clip-edit';
import { type TimelineOverlay } from '../../components/elements/overlays';

type Clipboard =
  | { kind: 'audio'; clip: AudioClip }
  | { kind: 'element'; element: ElementLayer }
  | { kind: 'pip'; clip: Scene }
  | { kind: 'scenes'; ids: string[] };

/** Timeline lane ids, as used by the lane toggles and locks. */
export type LaneId = string;

const isMedia = (element: ElementLayer) => element.kind === 'image' || element.kind === 'video';

/**
 * Keyboard-driven clip edits that work on whatever is selected: audio, a
 * project element, a picture-in-picture clip or a visual clip. Each returns
 * after raising a notice when the selection cannot take the edit, so a
 * shortcut never silently does nothing.
 */
export function useClipEditing({ project, run, position, canEdit, setNotice, editTargetRef, audioTargetRef, selectedAudio, selectedElement, selectedPip, selectedScenes, saveOverlay, removeSelected, setSelectedIds, setPrimarySelected, selectionAnchor, setSelectedAudioId, setSelectedPipId, setSelectedElementId, setEditTarget }: {
  project: Project;
  run: (command: Command) => Promise<boolean>;
  position: number;
  canEdit: boolean;
  setNotice: Dispatch<SetStateAction<string>>;
  editTargetRef: { current: 'scene' | 'text' | 'element' | 'audio' };
  audioTargetRef: { current: string | null };
  selectedAudio: AudioClip | null;
  selectedElement: TimelineOverlay | null;
  selectedPip: Scene | null;
  selectedScenes: Scene[];
  saveOverlay: (element: TimelineOverlay, next: TimelineOverlay | null) => Promise<boolean>;
  /** The plain (gap-leaving) delete for whatever is selected. */
  removeSelected: () => void;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setPrimarySelected: Dispatch<SetStateAction<string | null>>;
  selectionAnchor: { current: string | null };
  setSelectedAudioId: Dispatch<SetStateAction<string | null>>;
  setSelectedPipId: Dispatch<SetStateAction<string | null>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setEditTarget: Dispatch<SetStateAction<'scene' | 'text' | 'element' | 'audio'>>;
}) {
  const clipboard = useRef<Clipboard | null>(null);
  const timebase = project.timebase;
  const projectTicks = projectScenes(project).reduce((end, scene) => Math.max(end, scene.startTicks + scene.durationTicks), 0);
  const playTick = () => secondsToTicks(position, timebase);
  const audioTarget = () => editTargetRef.current === 'audio' ? project.audio.find(clip => clip.id === (audioTargetRef.current ?? selectedAudio?.id)) ?? null : null;
  const elementTarget = () => editTargetRef.current === 'element' ? selectedElement : null;

  /** Which lane the current selection lives on, for locks. */
  function selectionLane(): LaneId {
    const audio = audioTarget();
    if (audio) return `audio-${audio.lane ?? 0}`;
    const element = elementTarget();
    if (element) return isMedia(element) ? 'overlays' : 'elements';
    if (selectedPip) return 'pip';
    if (editTargetRef.current === 'text') return 'text';
    return 'visuals';
  }

  /** Delete that closes the gap: later clips on the same lane move earlier. The visual track always closes its gaps. */
  function rippleDeleteSelected() {
    const audio = audioTarget();
    if (audio) {
      const next = rippleRemove(project.audio, audio.id, (clip, removed) => (clip.lane ?? 0) === (removed.lane ?? 0));
      void run({ type: 'audio', audio: next }).then(ok => { if (ok) { setSelectedAudioId(next[0]?.id ?? null); setNotice('Audio clip removed and the gap closed.'); } });
      return;
    }
    const element = elementTarget();
    if (element && !element.legacySceneId && (project.overlays ?? []).some(item => item.id === element.id)) {
      const next = rippleRemove(project.overlays ?? [], element.id, (clip, removed) => isMedia(clip) === isMedia(removed));
      void run({ type: 'overlays', overlays: next }).then(ok => { if (ok) { setSelectedElementId(null); setNotice('Element removed and the gap closed.'); } });
      return;
    }
    if (selectedPip) {
      const next = rippleRemove(overlayScenes(project), selectedPip.id);
      void run({ type: 'pip', scenes: next }).then(ok => { if (ok) { setSelectedPipId(null); setNotice('Picture-in-picture clip removed and the gap closed.'); } });
      return;
    }
    removeSelected();
  }

  /** Trims the start or end of the selected clip to the playhead. */
  function trimSelected(edge: 'start' | 'end') {
    if (!canEdit) return;
    const at = playTick(), minimum = minTicks(timebase);
    const refuse = () => setNotice('Place the playhead inside the selected clip, at least half a second from its other edge.');
    const audio = audioTarget();
    if (audio) {
      const trimmed = trimToPlayhead(audio, edge, at, minimum);
      if (!trimmed) { refuse(); return; }
      const sourceIn = audio.sourceInSeconds + ticksToSeconds(trimmed.shiftTicks, timebase);
      void run({ type: 'audio', audio: project.audio.map(clip => clip.id === audio.id ? { ...clip, startTicks: trimmed.startTicks, durationTicks: trimmed.durationTicks, sourceInSeconds: sourceIn } : clip) });
      return;
    }
    const element = elementTarget();
    if (element) {
      const trimmed = trimToPlayhead(element, edge, at, minimum);
      if (!trimmed) { refuse(); return; }
      const next: TimelineOverlay = { ...element, startTicks: trimmed.startTicks, durationTicks: trimmed.durationTicks };
      if (element.kind === 'video') next.sourceInSeconds = (element.sourceInSeconds ?? 0) + ticksToSeconds(trimmed.shiftTicks, timebase);
      void saveOverlay(element, next);
      return;
    }
    if (selectedPip) {
      const trimmed = trimToPlayhead(selectedPip, edge, at, minimum);
      if (!trimmed) { refuse(); return; }
      const next = { ...selectedPip, startTicks: trimmed.startTicks, durationTicks: trimmed.durationTicks, sourceInTicks: (selectedPip.sourceInTicks ?? 0) + trimmed.shiftTicks };
      void run({ type: 'pip', scenes: overlayScenes(project).map(clip => clip.id === next.id ? next : clip) });
      return;
    }
    if (selectedScenes.length !== 1) { setNotice('Select one clip to trim to the playhead.'); return; }
    const scene = selectedScenes[0];
    const local = at - scene.startTicks;
    if (!trimToPlayhead({ id: scene.id, startTicks: 0, durationTicks: scene.durationTicks }, edge, local, minimum)) { refuse(); return; }
    const trimmed = trimSceneWindow(scene, edge === 'start' ? local : local - scene.durationTicks, edge === 'start' ? 'left' : 'right', timebase);
    const seconds = ticksToSeconds(trimmed.durationTicks, timebase);
    void run({ type: 'update', scene: { ...scene, durationTicks: trimmed.durationTicks, sourceInTicks: trimmed.sourceInTicks, fadeIn: Math.min(scene.fadeIn ?? 0, seconds), fadeOut: Math.min(scene.fadeOut ?? 0, seconds) } });
  }

  /** Moves the selected clip by frames (negative = earlier). Visual clips are magnetic, so they reorder instead. */
  function nudgeSelected(frames: number) {
    if (!canEdit) return;
    const audio = audioTarget();
    if (audio) {
      const start = nudgeStart(audio, frames, projectTicks);
      if (start !== audio.startTicks) void run({ type: 'audio', audio: project.audio.map(clip => clip.id === audio.id ? { ...clip, startTicks: start } : clip) });
      return;
    }
    const element = elementTarget();
    if (element) {
      const start = nudgeStart(element, frames, projectTicks);
      if (start !== element.startTicks) void saveOverlay(element, { ...element, startTicks: start });
      return;
    }
    if (selectedPip) {
      const start = nudgeStart(selectedPip, frames, projectTicks);
      if (start !== selectedPip.startTicks) void run({ type: 'pip', scenes: overlayScenes(project).map(clip => clip.id === selectedPip.id ? { ...clip, startTicks: start } : clip) });
      return;
    }
    setNotice('Visual clips follow each other. Use the arrows in the timeline toolbar to move one earlier or later.');
  }

  function copySelected() {
    const audio = audioTarget();
    if (audio) { clipboard.current = { kind: 'audio', clip: audio }; setNotice(`Copied “${audio.name}”. Paste puts it at the playhead.`); return; }
    const element = elementTarget();
    if (element) { clipboard.current = { kind: 'element', element }; setNotice('Copied the element. Paste puts it at the playhead.'); return; }
    if (selectedPip) { clipboard.current = { kind: 'pip', clip: selectedPip }; setNotice('Copied the picture-in-picture clip. Paste puts it at the playhead.'); return; }
    if (selectedScenes.length) { clipboard.current = { kind: 'scenes', ids: selectedScenes.map(scene => scene.id) }; setNotice(`Copied ${selectedScenes.length} clip${selectedScenes.length === 1 ? '' : 's'}. Paste adds ${selectedScenes.length === 1 ? 'a copy' : 'copies'} after ${selectedScenes.length === 1 ? 'it' : 'them'}.`); return; }
    setNotice('Select a clip to copy.');
  }

  function pasteClipboard() {
    if (!canEdit) return;
    const item = clipboard.current;
    if (!item) { setNotice('Nothing copied yet. Select a clip and copy it first.'); return; }
    const at = playTick();
    if (item.kind === 'scenes') {
      const existing = projectScenes(project).filter(scene => item.ids.includes(scene.id));
      if (!existing.length) { setNotice('The copied clips are no longer in this project.'); return; }
      const items = existing.map(scene => ({ id: scene.id, newId: crypto.randomUUID() }));
      void run({ type: 'duplicateMany', items }).then(ok => {
        if (!ok) return;
        const ids = items.map(entry => entry.newId);
        setSelectedIds(ids); setPrimarySelected(ids.at(-1) ?? null); selectionAnchor.current = ids.at(-1) ?? null; setEditTarget('scene');
      });
      return;
    }
    const duration = item.kind === 'audio' ? item.clip.durationTicks : item.kind === 'element' ? item.element.durationTicks : item.clip.durationTicks;
    const start = pasteStart(duration, at, projectTicks);
    if (start === null) { setNotice('That clip is longer than the whole story.'); return; }
    const id = crypto.randomUUID();
    if (item.kind === 'audio') {
      const busy = (lane: number) => project.audio.some(clip => (clip.lane ?? 0) === lane && clip.startTicks < start + duration && clip.startTicks + clip.durationTicks > start);
      const lane = [item.clip.lane ?? 0, ...Array.from({ length: MAX_AUDIO_LANES }, (_, index) => index)].find(candidate => !busy(candidate));
      if (lane === undefined) { setNotice('Every audio track is busy at the playhead. Move the playhead or free a track.'); return; }
      const clip: AudioClip = { ...item.clip, id, lane, startTicks: start };
      void run({ type: 'audio', audio: [...project.audio, clip] }).then(ok => { if (ok) { setSelectedAudioId(id); setEditTarget('audio'); } });
      return;
    }
    if (item.kind === 'element') {
      const { legacySceneId: _scene, legacyId: _legacy, ...clean } = item.element as TimelineOverlay;
      const element: ElementLayer = { ...clean, id, startTicks: start };
      void run({ type: 'overlays', overlays: [...(project.overlays ?? []), element] }).then(ok => { if (ok) { setSelectedElementId(id); setEditTarget('element'); } });
      return;
    }
    const clip: Scene = { ...item.clip, id, startTicks: start };
    void run({ type: 'pip', scenes: [...overlayScenes(project), clip] }).then(ok => { if (ok) setSelectedPipId(id); });
  }

  /** Selects every visual clip that starts at or after the playhead. */
  function selectAfterPlayhead() {
    const ids = startingAtOrAfter(projectScenes(project), playTick());
    if (!ids.length) { setNotice('No clips start at or after the playhead.'); return; }
    setSelectedIds(ids); setPrimarySelected(ids[0]); selectionAnchor.current = ids[0]; setEditTarget('scene');
    setNotice(`${ids.length} clip${ids.length === 1 ? '' : 's'} selected after the playhead.`);
  }

  return { rippleDeleteSelected, trimSelected, nudgeSelected, copySelected, pasteClipboard, selectAfterPlayhead, selectionLane };
}
