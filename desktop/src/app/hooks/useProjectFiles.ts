import { secondsToTicks, validateProject, type Command, type Project, type Scene, type Session } from '../../stores/model';
import * as bridge from '../bridge';
import { probeVideo } from '../../components/preview/video';
import { loadImage } from '../../components/preview/render';
import { messageFor } from '../errors';
import { type ChangeEvent } from 'react';
import { readPixcutBundle } from '../../stores/pixcut-bundle';
import { replaceAssetRef, type MissingAsset } from '../../stores/missing-assets';
import { t } from '../../i18n';
import { type Preferences } from '../../stores/preferences';
import type { Dispatch, RefObject, SetStateAction } from 'react';

export function useProjectFiles({ latestProject, operation, persistCurrent, preferences, project, projectInput, replaceSceneWithAsset, run, scenes, selectionAnchor, setBusy, setError, setNotice, setPlaying, setPosition, setPrimarySelected, setRelinking, setScreen, setSelectedIds, setSession, stageImportedMedia }: {
  latestProject: RefObject<Project>;
  operation: RefObject<boolean>;
  persistCurrent: () => Promise<void>;
  preferences: Preferences;
  project: Project;
  projectInput: RefObject<HTMLInputElement | null>;
  replaceSceneWithAsset: (sceneId: string, asset: bridge.ImportedAsset) => Promise<void>;
  run: (command: Command) => Promise<boolean>;
  scenes: Scene[];
  selectionAnchor: RefObject<string | null>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  setPosition: Dispatch<SetStateAction<number>>;
  setPrimarySelected: Dispatch<SetStateAction<string | null>>;
  setRelinking: Dispatch<SetStateAction<string | null>>;
  setScreen: Dispatch<SetStateAction<"home" | "editor">>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setSession: Dispatch<SetStateAction<Session>>;
  stageImportedMedia: (added: Scene[]) => Promise<void>;
}) {
  function nativeTimelineAt(position: { x: number; y: number }) {
    const ratio = window.devicePixelRatio || 1;
    return [[position.x / ratio, position.y / ratio], [position.x / ratio, position.y / ratio - 28], [position.x, position.y]].some(([x,y]) => Boolean(document.elementFromPoint(x,y)?.closest('.timeline')));
  }

  function nativeSceneAt(position: { x: number; y: number }) {
    const ratio = window.devicePixelRatio || 1;
    const points: [number, number][] = [[position.x / ratio, position.y / ratio], [position.x / ratio, position.y / ratio - 28], [position.x, position.y]];
    for (const [x, y] of points) {
      const element = document.elementFromPoint(x, y);
      const clip = element?.closest<HTMLElement>('.timeline-clip');
      if (clip?.dataset.sceneId) return clip.dataset.sceneId;
      if (element?.closest('.media-grid')) return null;
    }
    return null;
  }

  async function importNativePaths(paths: string[]) {
    if (operation.current) return;
    setPlaying(false); setBusy(true); operation.current = true;
    try {
      const added: Scene[] = [];
      for (const path of paths) {
        const asset = await bridge.importMediaPath(path);
        if (asset.mime.startsWith('video/')) {
          const probe = await probeVideo(asset.reference);
          added.push({
            id: crypto.randomUUID(), startTicks: 0, sourceInTicks: 0, name: asset.name, image: asset.reference,
            mediaKind: 'video', videoPoster: probe.poster, sourceDurationSeconds: Math.min(3600, Math.max(.01, probe.duration)),
            durationTicks: secondsToTicks(Math.min(600, Math.max(.5, probe.duration)), project.timebase),
            title: '', subtitle: '', color: '#ffffff', fit: preferences.defaultFit, transition: null,
          });
        } else {
          await loadImage(asset.reference);
          added.push({
            id: crypto.randomUUID(), startTicks: 0, sourceInTicks: 0, name: asset.name, image: asset.reference,
            durationTicks: secondsToTicks(preferences.defaultSceneSeconds, project.timebase),
            title: '', subtitle: '', color: '#ffffff', fit: preferences.defaultFit,
          });
        }
      }
      if (added.length + scenes.length > 100) throw new Error('Add up to 100 scenes per project.');
      if (added.length) await stageImportedMedia(added);
    } catch (error) { setError(messageFor(error)); }
    finally { setBusy(false); operation.current = false; }
  }

  async function dropNativeOnScene(sceneId: string, paths: string[]) {
    try {
      const asset = await bridge.importMediaPath(paths[0]);
      await replaceSceneWithAsset(sceneId, asset);
    } catch (error) { setError(messageFor(error)); }
  }

  async function open() {
    if (!bridge.native) { projectInput.current?.click(); return; }
    try { const next = await bridge.openProject(); if (next) { await persistCurrent(); latestProject.current = next.project; setSession(next); setScreen('editor'); setSelectedIds([]); setPrimarySelected(null); selectionAnchor.current = null; setPosition(0); } } catch (e) { setError(messageFor(e)); }
  }

  async function openBrowserProject(e: ChangeEvent<HTMLInputElement>) {
    try {
      const file = e.target.files?.[0]; if (!file) return;
      await openProjectFile(file);
    } catch (e) { setError(messageFor(e)); } finally { e.target.value = ''; }
  }

  async function openProjectFile(file: File) {
    try {
      if (file.size > 2 * 1024 * 1024 * 1024) throw new Error('Project file exceeds the 2 GB browser limit.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const p = bytes[0] === 0x50 && bytes[1] === 0x4b
        ? await readPixcutBundle(bytes)
        : validateProject(JSON.parse(new TextDecoder().decode(bytes)));
      await persistCurrent();
      if (await run({ type: 'replace', project: p })) { setScreen('editor'); setSelectedIds([]); setPrimarySelected(null); selectionAnchor.current = null; setPosition(0); }
    } catch (e) { setError(messageFor(e)); }
  }

  function togglePreviewFullscreen() { const element = document.querySelector('.preview-panel'); if (!document.fullscreenElement) void element?.requestFullscreen?.(); else void document.exitFullscreen(); }

  async function relinkMissing(asset: MissingAsset) {
    if (!bridge.native) { setError(t('Relinking is available in the desktop app.')); return; }
    setRelinking(asset.ref);
    try {
      // Stream the replacement into the same local store as the rest of the
      // footage; a relink never creates an IndexedDB copy on native.
      let imported: { reference: string; name: string } | null;
      if (asset.kind === 'audio') {
        imported = await bridge.importAudioAsset();
      } else {
        const picked = await bridge.importMediaAsset();
        if (!picked) return;
        if (asset.kind === 'video' ? !picked.mime.startsWith('video/') : !picked.mime.startsWith('image/')) {
          throw new Error(asset.kind === 'video' ? 'Choose a video file to relink this clip.' : 'Choose an image file to relink this photo.');
        }
        imported = picked;
      }
      if (!imported) return;
      const next = replaceAssetRef(latestProject.current, asset.ref, imported.reference);
      if (await run({ type: 'replace', project: next })) {
        setNotice(t('Relinked {label} with {name}.', { label: asset.label, name: imported.name }));
        setError(t(''));
      }
    } catch (error) { setError(messageFor(error)); }
    finally { setRelinking(null); }
  }

  return { nativeTimelineAt, nativeSceneAt, importNativePaths, dropNativeOnScene, open, openBrowserProject, openProjectFile, togglePreviewFullscreen, relinkMissing };
}
