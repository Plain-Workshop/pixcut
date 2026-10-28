import { parseCaptions, placeCaptions } from '../../components/text/captions';
import { resolveAssetUrl, resolveMediaSource } from '../../components/preview/media-url';
import * as bridge from '../bridge';
import { projectScenes, secondsToTicks, type Command, type Project, type Scene } from '../../stores/model';
import { loadImage } from '../../components/preview/render';
import { probeVideo, videoFileData } from '../../components/preview/video';
import { messageFor } from '../errors';
import { formatBytes, imageFileData } from '../helpers';
import { libraryAssetRefs } from '../../stores/library';
import { type Preferences } from '../../stores/preferences';
import { type Dispatch, type SetStateAction, type RefObject } from 'react';

export function useMediaImport({ canEdit, setBusy, customElementKind, addMediaOverlay, project, selectedScene, setError, customElementInput, mediaInput, operation, setPlaying, scenes, preferences, stageImportedMedia, videoInput, latestProject, run, setNotice, captionInput, setStorageUsage, storageBusy, storageConfirm, setStorageConfirm, setStorageNote, setStorageBusy, setDuckDraft }: {
  canEdit: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  customElementKind: RefObject<"image" | "video">;
  addMediaOverlay: (source: Scene) => Promise<void>;
  project: Project;
  selectedScene: Scene | undefined;
  setError: Dispatch<SetStateAction<string>>;
  customElementInput: RefObject<HTMLInputElement | null>;
  mediaInput: RefObject<HTMLInputElement | null>;
  operation: RefObject<boolean>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  scenes: Scene[];
  preferences: Preferences;
  stageImportedMedia: (added: Scene[]) => Promise<void>;
  videoInput: RefObject<HTMLInputElement | null>;
  latestProject: RefObject<Project>;
  run: (command: Command) => Promise<boolean>;
  setNotice: Dispatch<SetStateAction<string>>;
  captionInput: RefObject<HTMLInputElement | null>;
  setStorageUsage: Dispatch<SetStateAction<bridge.AssetUsage | null>>;
  storageBusy: boolean;
  storageConfirm: boolean;
  setStorageConfirm: Dispatch<SetStateAction<boolean>>;
  setStorageNote: Dispatch<SetStateAction<string | null>>;
  setStorageBusy: Dispatch<SetStateAction<boolean>>;
  setDuckDraft: Dispatch<SetStateAction<number | null>>;
}) {
  async function importCustomElement(files: FileList | File[] | null) {
    if (!files?.length || !canEdit) return;
    setBusy(true);
    try {
      const file = files[0];
      if (file.size > 50 * 1024 * 1024) throw new Error('Choose a custom element smaller than 50 MB.');
      const isVideo = customElementKind.current === 'video';
      const image = isVideo ? await videoFileData(file) : await imageFileData(file);
      const probe = isVideo ? await probeVideo(image) : null;
      await addMediaOverlay({ id: crypto.randomUUID(), name: file.name, image, ...(probe ? { mediaKind: 'video', videoPoster: probe.poster } : {}), sourceInTicks: 0, startTicks: 0,
        durationTicks: probe ? secondsToTicks(Math.min(30, probe.duration), project.timebase) : selectedScene?.durationTicks ?? secondsToTicks(4, project.timebase), title: '', subtitle: '', color: '#FFFFFF', fit: 'contain' });
    } catch (error) { setError(messageFor(error)); }
    finally { setBusy(false); if (customElementInput.current) customElementInput.current.value = ''; }
  }

  async function chooseCustomElement(kind: 'image' | 'video') {
    customElementKind.current = kind;
    if (bridge.native) {
      // Native builds stream the picked file straight into the asset store and
      // keep only its reference, instead of round-tripping base64 through the
      // webview and then duplicating it in IndexedDB.
      try {
        const asset = await bridge.importMediaAsset();
        if (!asset) return;
        if (kind === 'video' ? !asset.mime.startsWith('video/') : !asset.mime.startsWith('image/')) {
          throw new Error(kind === 'video' ? 'Choose a video file for this overlay.' : 'Choose an image file for this overlay.');
        }
        if (asset.bytes > 50 * 1024 * 1024) throw new Error('Choose a custom element smaller than 50 MB.');
        setBusy(true);
        const probe = asset.mime.startsWith('video/')
          ? await probeVideo((await resolveMediaSource(asset.reference)) ?? asset.reference)
          : null;
        await addMediaOverlay({
          id: crypto.randomUUID(), name: asset.name, image: asset.reference,
          ...(probe ? { mediaKind: 'video', videoPoster: probe.poster } : {}),
          sourceInTicks: 0, startTicks: 0,
          durationTicks: probe ? secondsToTicks(Math.min(30, probe.duration), project.timebase) : selectedScene?.durationTicks ?? secondsToTicks(4, project.timebase),
          title: '', subtitle: '', color: '#FFFFFF', fit: 'contain',
        });
      } catch (error) { setError(messageFor(error)); }
      finally { setBusy(false); }
    } else if (customElementInput.current) { customElementInput.current.accept = kind === 'video' ? 'video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm' : 'image/png,image/jpeg,image/webp'; customElementInput.current.click(); }
  }

  async function chooseImages() {
    if (!canEdit) return;
    if (bridge.native) {
      try {
        const imported = await bridge.importImagesAsset();
        if (imported.length) await importStreamedImages(imported);
      } catch (e) { setError(messageFor(e)); }
      return;
    }
    mediaInput.current?.click();
  }

  async function importStreamedImages(assets: bridge.ImportedImage[]) {
    if (!assets.length || operation.current) return;
    setPlaying(false); setBusy(true); operation.current = true;
    try {
      const added: Scene[] = [];
      if (assets.length + scenes.length > 100) throw new Error('Add up to 100 photos per project.');
      for (const asset of assets) {
        // Decoding through the asset protocol rejects a broken or missing file
        // before it lands in the timeline.
        await loadImage(asset.reference);
        added.push({
          id: crypto.randomUUID(), startTicks: 0, sourceInTicks: 0, name: asset.name, image: asset.reference,
          durationTicks: secondsToTicks(preferences.defaultSceneSeconds, project.timebase),
          title: '', subtitle: '', color: '#ffffff', fit: preferences.defaultFit,
        });
      }
      await stageImportedMedia(added);
    } catch (e) { setError(messageFor(e)); }
    finally { setBusy(false); operation.current = false; }
  }

  async function chooseVideo() {
    if (!canEdit) return;
    if (bridge.native) {
      try {
        const imported = await bridge.importVideoAsset();
        if (imported) await importStreamedVideo(imported);
      } catch (e) { setError(messageFor(e)); }
      return;
    }
    videoInput.current?.click();
  }

  /**
   * Native video import keeps the file in the local asset store and writes only
   * a reference into the project, so long clips no longer live in memory.
   */
  async function importStreamedVideo(imported: bridge.ImportedMedia) {
    if (operation.current) return;
    setPlaying(false); setBusy(true); operation.current = true;
    try {
      if (scenes.length >= 100) throw new Error('Add up to 100 clips per project.');
      const url = await resolveAssetUrl(imported.reference);
      const probe = await probeVideo(url);
      const seconds = Math.min(600, Math.max(0.5, probe.duration));
      const scene: Scene = {
        id: crypto.randomUUID(), startTicks: 0, sourceInTicks: 0, name: imported.name,
        image: imported.reference, mediaKind: 'video', videoPoster: probe.poster,
        sourceDurationSeconds: Math.min(3600, Math.max(.01, probe.duration)),
        durationTicks: secondsToTicks(seconds, project.timebase),
        title: '', subtitle: '', color: '#ffffff', fit: preferences.defaultFit, transition: null,
      };
      await stageImportedMedia([scene]);
    } catch (e) { setError(messageFor(e)); }
    finally { setBusy(false); operation.current = false; }
  }

  async function importVideos(files: FileList | File[] | null) {
    if (!files?.length || operation.current) return;
    setPlaying(false); setBusy(true); operation.current = true;
    try {
      const added: Scene[] = [];
      let videoBytes = scenes.filter(scene => scene.mediaKind === 'video').reduce((sum, scene) => sum + scene.image.length, 0);
      if (files.length + scenes.length > 100) throw new Error('Add up to 100 clips per project.');
      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) throw new Error(`“${file.name}” is larger than 50 MB. Choose a shorter clip.`);
        const data = await videoFileData(file);
        videoBytes += data.length;
        if (videoBytes > 140_000_000) throw new Error('This project supports up to about 100 MB of video. Remove a clip or use a shorter one.');
        const probe = await probeVideo(data);
        const seconds = Math.min(600, Math.max(0.5, probe.duration));
        added.push({
          id: crypto.randomUUID(), startTicks: 0, sourceInTicks: 0, name: file.name, image: data,
          mediaKind: 'video', videoPoster: probe.poster, sourceDurationSeconds: Math.min(3600, Math.max(.01, probe.duration)),
          durationTicks: secondsToTicks(seconds, project.timebase), title: '', subtitle: '',
          color: '#ffffff', fit: preferences.defaultFit, transition: null,
        });
      }
      await stageImportedMedia(added);
    } catch (e) { setError(messageFor(e)); }
    finally { setBusy(false); operation.current = false; if (videoInput.current) videoInput.current.value = ''; }
  }

  async function importCaptionFile(files: FileList | null) {
    const file = files?.[0];
    if (!file || !canEdit) return;
    try {
      const cues = parseCaptions(await file.text());
      const { changed, placement } = placeCaptions(projectScenes(latestProject.current), cues, project.timebase);
      if (!changed.length) { setError('Those captions fall outside the timeline. Add scenes or import a file that matches the story length.'); return; }
      if (!await run({ type: 'updateMany', scenes: changed })) return;
      const notes = [`${placement.added} caption${placement.added === 1 ? '' : 's'} across ${placement.scenes} scene${placement.scenes === 1 ? '' : 's'}`];
      if (placement.split) notes.push(`${placement.split} long cue${placement.split === 1 ? '' : 's'} split`);
      if (placement.skipped) notes.push(`${placement.skipped} skipped`);
      setNotice(`${notes.join(' · ')}. Style them in Text.`);
    } catch (error) {
      setError(messageFor(error));
    } finally {
      if (captionInput.current) captionInput.current.value = '';
    }
  }

  async function refreshAssetUsage() {
    if (!bridge.native) return;
    try { setStorageUsage(await bridge.assetUsage()); } catch { setStorageUsage(null); }
  }

  async function cleanStorage() {
    if (!bridge.native || storageBusy) return;
    if (!storageConfirm) {
      setStorageConfirm(true);
      setStorageNote('Click again to remove media that no saved project, open project, or undo step uses.');
      return;
    }
    setStorageConfirm(false);
    setStorageBusy(true);
    try {
      const keep = new Set([...(await bridge.referencedRefs()), ...(await libraryAssetRefs())]);
      const removed = await bridge.pruneAssets([...keep]);
      setStorageNote(removed.files
        ? `Removed ${removed.files} unused file${removed.files === 1 ? '' : 's'} · ${formatBytes(removed.bytes)}.`
        : 'No unused media was found.');
      await refreshAssetUsage();
    } catch (error) {
      setError(messageFor(error));
    } finally {
      setStorageBusy(false);
    }
  }

  function commitDucking(amount: number) {
    setDuckDraft(null);
    if (!canEdit) return;
    if ((project.ducking ?? 0) !== amount) void run({ type: 'ducking', amount });
  }

  return { refreshAssetUsage, chooseImages, commitDucking, importCustomElement, importVideos, importCaptionFile, chooseVideo, chooseCustomElement, cleanStorage };
}
