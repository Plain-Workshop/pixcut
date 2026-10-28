import { resolveAssetUrl } from '../../components/preview/media-url';
import { assetRef, storeAssetBlob } from '../../stores/assets';
import { beatMarkerTicks, detectBeats, snapScenesToBeats } from '../../components/timeline/beat-sync';
import { type PointerEvent as ReactPointerEvent } from 'react';
import * as bridge from '../bridge';
import { MAX_AUDIO_FILE_BYTES, projectScenes, secondsPerTick, secondsToTicks, ticksToSeconds, totalTicks, type AudioClip, type AudioMix, type AudioLaneMix, type Command, type Project, type Scene } from '../../stores/model';
import { loadImage } from '../../components/preview/render';
import { messageFor } from '../errors';
import { captureDragPointer, audioDuration, audioFileData } from '../helpers';
import { type Preferences } from '../../stores/preferences';
import { type Dispatch, type SetStateAction, type RefObject } from 'react';

export function useAudioActions({ canEdit, setError, audioInput, projectTicks, setNotice, position, project, audioLaneRef, run, setEditTarget, setSelectedAudioId, setTab, operation, setPlaying, setBusy, scenes, preferences, stageImportedMedia, mediaInput, recordChunks, recorderRef, setRecording, setRecordSeconds, recordTimer, latestProject, positionRef, audioDraftRef, setAudioDraft, setPreviewAudio, selectedAudio, mixDraftRef, setMixDraft, videoVolumeDraftRef, setVideoVolumeDraft, playing, setPosition, editTargetRef, audioTargetRef, setSelectedIds, setPrimarySelected, setSelectedElementId, setSelectedGlobalTextId, setBeatBusy, setBeatTempo, beatTempo }: {
  canEdit: boolean;
  setError: Dispatch<SetStateAction<string>>;
  audioInput: RefObject<HTMLInputElement | null>;
  projectTicks: number;
  setNotice: Dispatch<SetStateAction<string>>;
  position: number;
  project: Project;
  audioLaneRef: RefObject<number>;
  run: (command: Command) => Promise<boolean>;
  setEditTarget: Dispatch<SetStateAction<"text" | "audio" | "scene" | "element">>;
  setSelectedAudioId: Dispatch<SetStateAction<string | null>>;
  setTab: Dispatch<SetStateAction<"text" | "audio" | "media" | "elements" | "templates">>;
  operation: RefObject<boolean>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  scenes: Scene[];
  preferences: Preferences;
  stageImportedMedia: (added: Scene[]) => Promise<void>;
  mediaInput: RefObject<HTMLInputElement | null>;
  recordChunks: RefObject<Blob[]>;
  recorderRef: RefObject<MediaRecorder | null>;
  setRecording: Dispatch<SetStateAction<boolean>>;
  setRecordSeconds: Dispatch<SetStateAction<number>>;
  recordTimer: RefObject<number | null>;
  latestProject: RefObject<Project>;
  positionRef: RefObject<number>;
  audioDraftRef: RefObject<AudioClip | null>;
  setAudioDraft: Dispatch<SetStateAction<AudioClip | null>>;
  setPreviewAudio: Dispatch<SetStateAction<AudioClip[] | null>>;
  selectedAudio: AudioClip;
  mixDraftRef: RefObject<AudioMix | null>;
  setMixDraft: Dispatch<SetStateAction<AudioMix | null>>;
  videoVolumeDraftRef: RefObject<{ id: string; value: number; } | null>;
  setVideoVolumeDraft: Dispatch<SetStateAction<{ id: string; value: number; } | null>>;
  playing: boolean;
  setPosition: Dispatch<SetStateAction<number>>;
  editTargetRef: RefObject<"text" | "audio" | "scene" | "element">;
  audioTargetRef: RefObject<string | null>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setPrimarySelected: Dispatch<SetStateAction<string | null>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSelectedGlobalTextId: Dispatch<SetStateAction<string | null>>;
  setBeatBusy: Dispatch<SetStateAction<boolean>>;
  setBeatTempo: Dispatch<SetStateAction<number | null>>;
  beatTempo: number | null;
}) {
  async function chooseAudio() {
    if (!canEdit) return;
    if (bridge.native) {
      try {
        const imported = await bridge.importAudioAsset();
        if (imported) await importStreamedAudio(imported);
      } catch (e) { setError(messageFor(e)); }
      return;
    }
    audioInput.current?.click();
  }

  async function importStreamedAudio(imported: bridge.ImportedMedia) {
    if (!projectTicks) { setNotice('Add photos before adding audio.'); return; }
    try {
      const url = await resolveAssetUrl(imported.reference);
      const sourceDuration = Math.round((await audioDuration(url)) * 100) / 100;
      const desiredStart = secondsToTicks(position, project.timebase);
      const startTicks = desiredStart >= projectTicks ? 0 : Math.min(desiredStart, projectTicks - 1);
      const remaining = ticksToSeconds(projectTicks - startTicks, project.timebase);
      const duration = Math.max(secondsPerTick(project.timebase), Math.min(sourceDuration || remaining, remaining));
      const clip = constrainAudio({
        id: crypto.randomUUID(),
        name: imported.name,
        data: imported.reference,
        lane: audioLaneRef.current,
        startTicks,
        durationTicks: secondsToTicks(duration, project.timebase),
        sourceInSeconds: 0,
        sourceDurationSeconds: sourceDuration || duration,
        volume: .8,
        fadeIn: 0,
        fadeOut: 0,
      });
      if (await run({ type: 'audio', audio: [...project.audio, clip] })) {
        setEditTarget('audio'); setSelectedAudioId(clip.id);
        setTab('audio');
        setNotice(`Audio added at ${ticksToSeconds(clip.startTicks, project.timebase).toFixed(1)} s. It stays on this device.`);
      }
    } catch (e) { setError(messageFor(e)); }
  }

  async function importFiles(files: FileList | File[] | null) {
    if (!files?.length || operation.current) return;
    setPlaying(false); setBusy(true); operation.current = true;
    try {
      const added: Scene[] = [];
      if (files.length + scenes.length > 100) throw new Error('Add up to 100 images per project.');
      for (const file of Array.from(files)) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error(`“${file.name}” is not a JPEG, PNG, or WebP image. Choose one of those formats.`);
        if (file.size > 500 * 1024 * 1024) throw new Error(`“${file.name}” is larger than 500 MB. Choose a smaller image.`);
        const asset = await storeAssetBlob(file, file.name);
        const image = assetRef(asset.id);
        await loadImage(image);
        added.push({ id: crypto.randomUUID(), startTicks: 0, sourceInTicks: 0, name: file.name, image, durationTicks: secondsToTicks(preferences.defaultSceneSeconds, project.timebase), title: '', subtitle: '', color: '#ffffff', fit: preferences.defaultFit });
      }
      await stageImportedMedia(added);
    } catch (e) { setError(messageFor(e)); } finally { setBusy(false); operation.current = false; if (mediaInput.current) mediaInput.current.value = ''; }
  }

  function constrainAudio(clip: AudioClip): AudioClip {
    const total = projectTicks;
    const currentDuration = ticksToSeconds(clip.durationTicks, project.timebase);
    const sourceDuration = Math.max(clip.sourceDurationSeconds > 0 ? clip.sourceDurationSeconds : currentDuration, secondsPerTick(project.timebase));
    const sourceIn = Math.min(Math.max(0, clip.sourceInSeconds), Math.max(0, sourceDuration - secondsPerTick(project.timebase)));
    const maxDuration = Math.max(1, Math.min(total - clip.startTicks, secondsToTicks(sourceDuration - sourceIn, project.timebase)));
    const durationTicks = Math.max(1, Math.min(clip.durationTicks, maxDuration));
    const startTicks = Math.min(Math.max(0, clip.startTicks), Math.max(0, total - durationTicks));
    const seconds = ticksToSeconds(durationTicks, project.timebase);
    return { ...clip, startTicks, durationTicks, sourceInSeconds: sourceIn, sourceDurationSeconds: sourceDuration, fadeIn: Math.min(clip.fadeIn, seconds), fadeOut: Math.min(clip.fadeOut, seconds) };
  }

  async function importAudio(file: File | null | undefined) {
    if (!file || !canEdit) return;
    if (!projectTicks) { setNotice('Add photos before adding audio.'); return; }
    try {
      const data = await audioFileData(file);
      const sourceDuration = Math.round((await audioDuration(data)) * 100) / 100;
      const desiredStart = secondsToTicks(position, project.timebase);
      const startTicks = desiredStart >= projectTicks ? 0 : Math.min(desiredStart, projectTicks - 1);
      const remaining = ticksToSeconds(projectTicks - startTicks, project.timebase);
      const duration = Math.max(secondsPerTick(project.timebase), Math.min(sourceDuration || remaining, remaining));
      const clip = constrainAudio({
        id: crypto.randomUUID(),
        name: file.name,
        data,
        lane: audioLaneRef.current,
        startTicks,
        durationTicks: secondsToTicks(duration, project.timebase),
        sourceInSeconds: 0,
        sourceDurationSeconds: sourceDuration || duration,
        volume: .8,
        fadeIn: 0,
        fadeOut: 0,
      });
      if (await run({ type: 'audio', audio: [...project.audio, clip] })) {
        setEditTarget('audio'); setSelectedAudioId(clip.id);
        setTab('audio');
        setNotice(`Audio added at ${ticksToSeconds(clip.startTicks, project.timebase).toFixed(1)} s. It stays on this device.`);
      }
    } catch (e) { setError(messageFor(e)); } finally { if (audioInput.current) audioInput.current.value = ''; }
  }

  async function startVoiceover() {
    if (!canEdit) return;
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Voiceover recording is not available in this build. Import an audio file instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type)) ?? '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recordChunks.current = [];
      recorder.ondataavailable = event => { if (event.data.size) recordChunks.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        void finishVoiceover(recorder.mimeType || mime || 'audio/webm');
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true); setRecordSeconds(0);
      const started = performance.now();
      recordTimer.current = window.setInterval(() => setRecordSeconds((performance.now() - started) / 1000), 200);
    } catch {
      setError('Microphone access is needed for voiceover. Allow it in your system settings and try again.');
    }
  }

  function stopVoiceover() {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  async function finishVoiceover(mime: string) {
    try {
      const chunks = recordChunks.current;
      recordChunks.current = [];
      const blob = new Blob(chunks, { type: mime.split(';')[0] || 'audio/webm' });
      if (!blob.size) throw new Error('The recording was empty. Try again.');
      if (blob.size > MAX_AUDIO_FILE_BYTES) throw new Error('The recording is larger than the voiceover limit.');
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('The recording could not be read.'));
        reader.readAsDataURL(blob);
      });
      const snapshot = latestProject.current;
      const total = totalTicks(snapshot);
      if (!total) throw new Error('Add a scene before recording a voiceover.');
      const sourceDuration = Math.round((await audioDuration(data)) * 100) / 100;
      const desiredStart = secondsToTicks(positionRef.current, snapshot.timebase);
      const startTicks = desiredStart >= total ? 0 : Math.min(desiredStart, total - 1);
      const remaining = ticksToSeconds(total - startTicks, snapshot.timebase);
      const length = Math.max(secondsPerTick(snapshot.timebase), Math.min(sourceDuration || remaining, remaining));
      const clip = constrainAudio({
        id: crypto.randomUUID(),
        name: `Voiceover ${snapshot.audio.filter(item => item.name.startsWith('Voiceover')).length + 1}`,
        data,
        lane: 0,
        startTicks,
        durationTicks: secondsToTicks(length, snapshot.timebase),
        sourceInSeconds: 0,
        sourceDurationSeconds: sourceDuration || length,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        low: 0,
        mid: 0,
        high: 0,
      });
      if (await run({ type: 'audio', audio: [...snapshot.audio, clip] })) {
        setEditTarget('audio'); setSelectedAudioId(clip.id); setTab('audio');
        setNotice('Voiceover added at the playhead. It stays on this device.');
      }
    } catch (error) {
      setError(messageFor(error));
    }
  }

  function removeAudio(id: string) {
    const next = project.audio.filter(clip => clip.id !== id);
    audioDraftRef.current = null;
    setAudioDraft(null);
    setPreviewAudio(null);
    void run({ type: 'audio', audio: next }).then(ok => {
      if (!ok) return;
      setSelectedAudioId(current => current === id ? next[0]?.id ?? null : current);
      setNotice('Audio clip removed from this project.');
    });
  }

  function stageAudio(patch: Partial<AudioClip>) {
    const base = audioDraftRef.current ?? selectedAudio;
    if (!base) return;
    const next = constrainAudio({ ...base, ...patch });
    audioDraftRef.current = next;
    setAudioDraft(next);
  }

  function commitAudio() {
    const next = audioDraftRef.current;
    if (!next) return;
    const constrained = constrainAudio(next);
    audioDraftRef.current = null;
    setAudioDraft(null);
    setPreviewAudio(null);
    void run({ type: 'audio', audio: project.audio.map(clip => clip.id === constrained.id ? constrained : clip) });
  }

  function stageMix(update: (mix: AudioMix) => AudioMix) {
    const base = mixDraftRef.current ?? project.audioMix ?? { video: 1, lanes: [] };
    const next = update({ video: base.video, lanes: base.lanes.map(lane => ({ ...lane })) });
    mixDraftRef.current = next;
    setMixDraft(next);
  }

  function commitMix() {
    const next = mixDraftRef.current;
    if (!next) return;
    mixDraftRef.current = null;
    setMixDraft(null);
    void run({ type: 'audioMix', mix: next });
  }

  function setLaneMix(lane: number, patch: Partial<Omit<AudioLaneMix, 'lane'>>) {
    stageMix(mix => {
      const existing = mix.lanes.find(item => item.lane === lane) ?? { lane, volume: 1, muted: false };
      const next = { ...existing, ...patch };
      const lanes = mix.lanes.filter(item => item.lane !== lane);
      if (next.volume !== 1 || next.muted) lanes.push(next);
      lanes.sort((a, b) => a.lane - b.lane);
      return { ...mix, lanes };
    });
  }

  function toggleLaneMute(lane: number) {
    const current = mixDraftRef.current ?? project.audioMix ?? { video: 1, lanes: [] };
    const muted = current.lanes.find(item => item.lane === lane)?.muted ?? false;
    setLaneMix(lane, { muted: !muted });
    commitMix();
  }

  function setVideoAudioLevel(volume: number) {
    stageMix(mix => ({ ...mix, video: Math.min(1, Math.max(0, volume)) }));
  }

  function stageVideoVolume(scene: Scene, value: number) {
    const draft = { id: scene.id, value: Math.min(100, Math.max(0, Math.round(value))) };
    videoVolumeDraftRef.current = draft;
    setVideoVolumeDraft(draft);
  }

  function commitVideoVolume(scene: Scene, value: number) {
    const draft = videoVolumeDraftRef.current;
    if (!draft || draft.id !== scene.id) return;
    videoVolumeDraftRef.current = null;
    setVideoVolumeDraft(null);
    if (!canEdit) return;
    const current = projectScenes(latestProject.current).find(item => item.id === scene.id);
    if (!current) return;
    const level = Math.min(100, Math.max(0, Math.round(value)));
    if ((current.videoVolume ?? 100) === level) return;
    void run({ type: 'update', scene: { ...current, videoVolume: level } });
  }

  function focusAudio(clip: AudioClip) {
    // Selecting audio is not a seek. If any overlapping handler (or a focus
    // scroll) moves the playhead during this click, put it back.
    const anchor = positionRef.current;
    const wasPlaying = playing;
    queueMicrotask(() => {
      if (!wasPlaying && positionRef.current !== anchor) { positionRef.current = anchor; setPosition(anchor); }
    });
    editTargetRef.current = 'audio';
    audioTargetRef.current = clip.id;
    setEditTarget('audio');
    setSelectedAudioId(clip.id);
    setSelectedIds([]);
    setPrimarySelected(null);
    setSelectedElementId(null);
    setSelectedGlobalTextId(null);
    setTab('audio');
  }

  async function detectAudioBeats() {
    if (!selectedAudio || !canEdit) return;
    setBeatBusy(true);
    setError('');
    try {
      const analysis = await detectBeats(selectedAudio.data);
      if (!analysis?.beats.length) {
        setError('No clear beat was found in this audio. Try a track with a steady pulse, or add markers at the playhead.');
        return;
      }
      setBeatTempo(analysis.bpm);
      const ticks = beatMarkerTicks(analysis.beats, selectedAudio.startTicks, project.timebase, projectTicks);
      if (!ticks.length) {
        setNotice('The detected beats fall outside this timeline.');
        return;
      }
      const merged = [...new Set([...(project.beatTicks ?? []), ...ticks])].sort((a, b) => a - b).slice(0, 500);
      const added = Math.max(0, merged.length - (project.beatTicks?.length ?? 0));
      if (!added) {
        setNotice(`Found ${analysis.bpm ? `${analysis.bpm} BPM` : 'a pulse'} · these beat markers are already on the timeline.`);
        return;
      }
      if (await run({ type: 'beats', beatTicks: merged })) {
        setNotice(`Found ${analysis.bpm ? `${analysis.bpm} BPM` : 'a pulse'} · ${added} beat marker${added === 1 ? '' : 's'} added. Overlay moves and trims now snap to them.`);
      }
    } catch (error) {
      setError(messageFor(error));
    } finally {
      setBeatBusy(false);
    }
  }

  async function snapCutsToBeat() {
    if (!selectedAudio || !canEdit) return;
    const photoScenes = projectScenes(project);
    if (photoScenes.some(scene => scene.mediaKind === 'video')) {
      setError('Beat sync currently works with photo stories. Video cuts keep their own source timing.');
      return;
    }
    if (photoScenes.length < 2) {
      setError('Add at least two photo scenes before snapping cuts to a beat.');
      return;
    }
    setBeatBusy(true);
    setError('');
    try {
      let beats = (project.beatTicks ?? []).map(tick => ticksToSeconds(tick, project.timebase));
      let offsetSeconds = 0;
      let bpm = beatTempo;
      if (!beats.length) {
        const analysis = await detectBeats(selectedAudio.data);
        if (!analysis?.beats.length) {
          setError('No clear beat was found in this audio. Try a track with a steady pulse, or add markers at the playhead.');
          return;
        }
        beats = analysis.beats;
        offsetSeconds = ticksToSeconds(selectedAudio.startTicks, project.timebase);
        bpm = analysis.bpm;
        setBeatTempo(bpm);
      }
      const result = snapScenesToBeats(photoScenes, beats, offsetSeconds, project.timebase);
      if (!result.moved) {
        setNotice(`Found ${bpm ? `${bpm} BPM` : 'a pulse'}, but no cut was within 0.35 s of a beat.`);
        return;
      }
      if (await run({ type: 'updateMany', scenes: result.scenes })) {
        setNotice(`Snapped ${result.moved} cut${result.moved === 1 ? '' : 's'} to ${bpm ? `${bpm} BPM` : 'the beat'}.`);
      }
    } catch (error) {
      setError(messageFor(error));
    } finally {
      setBeatBusy(false);
    }
  }

  function beginAudioMove(event: ReactPointerEvent<HTMLElement>, clip: AudioClip) {
    if (!canEdit || event.button !== 0 || !projectTicks) return;
    const track = (event.currentTarget as HTMLElement).closest<HTMLElement>('.audio-track');
    const width = track?.getBoundingClientRect().width ?? 0;
    if (!track || width <= 0) return;
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    captureDragPointer(event);
    focusAudio(clip);
    setPlaying(false);
    const startX = event.clientX;
    const initialStart = clip.startTicks;
    let latest = project.audio;
    let moved = false;
    const move = (moveEvent: PointerEvent) => {
      const delta = Math.round(((moveEvent.clientX - startX) / width) * projectTicks);
      if (delta !== 0) moved = true;
      const startTicks = Math.min(Math.max(0, initialStart + delta), Math.max(0, projectTicks - clip.durationTicks));
      latest = project.audio.map(item => item.id === clip.id ? { ...item, startTicks } : item);
      setPreviewAudio(latest);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setPreviewAudio(null);
      if (moved) void run({ type: 'audio', audio: latest });
    };
    const cancel = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setPreviewAudio(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }

  function beginAudioTrim(event: ReactPointerEvent<HTMLElement>, clip: AudioClip, side: 'left' | 'right') {
    if (!canEdit || event.button !== 0 || !projectTicks) return;
    const track = (event.currentTarget as HTMLElement).closest<HTMLElement>('.audio-track');
    const width = track?.getBoundingClientRect().width ?? 0;
    if (!track || width <= 0) return;
    event.stopPropagation();
    event.currentTarget.closest<HTMLElement>('.audio-clip')?.focus({ preventScroll: true });
    captureDragPointer(event);
    focusAudio(clip);
    setPlaying(false);
    const startX = event.clientX;
    const initialStart = clip.startTicks, initialDuration = clip.durationTicks, initialIn = clip.sourceInSeconds;
    let latest = project.audio;
    let moved = false;
    const move = (moveEvent: PointerEvent) => {
      const delta = Math.round(((moveEvent.clientX - startX) / width) * projectTicks);
      let startTicks = initialStart, durationTicks = initialDuration, sourceIn = initialIn;
      if (side === 'left') {
        let shift = Math.min(initialDuration - 1, Math.max(delta, -initialStart));
        shift = Math.max(shift, -secondsToTicks(initialIn, project.timebase));
        startTicks = initialStart + shift;
        durationTicks = initialDuration - shift;
        sourceIn = Math.max(0, initialIn + ticksToSeconds(shift, project.timebase));
      } else {
        const maxDuration = Math.min(projectTicks - initialStart, secondsToTicks(clip.sourceDurationSeconds - initialIn, project.timebase));
        durationTicks = Math.min(Math.max(1, initialDuration + delta), Math.max(1, maxDuration));
      }
      if (startTicks !== initialStart || durationTicks !== initialDuration || sourceIn !== initialIn) moved = true;
      latest = project.audio.map(item => item.id === clip.id ? { ...item, startTicks, durationTicks, sourceInSeconds: sourceIn } : item);
      setPreviewAudio(latest);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setPreviewAudio(null);
      if (moved) void run({ type: 'audio', audio: latest });
    };
    const cancel = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setPreviewAudio(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }

  return { removeAudio, importFiles, stopVoiceover, startVoiceover, stageAudio, commitAudio, detectAudioBeats, snapCutsToBeat, importAudio, chooseAudio, focusAudio, setVideoAudioLevel, commitMix, stageVideoVolume, commitVideoVolume, toggleLaneMute, setLaneMix, beginAudioMove, beginAudioTrim };
}
