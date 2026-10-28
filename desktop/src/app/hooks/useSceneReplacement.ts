import { assetRef, storeAssetBlob } from '../../stores/assets';
import { type DragEvent as ReactDragEvent } from 'react';
import * as bridge from '../bridge';
import { minTicks, projectScenes, replaceSceneImage, secondsToTicks, ticksToSeconds, type Command, type Project, type Scene, type Session } from '../../stores/model';
import { loadImage } from '../../components/preview/render';
import { probeVideo, videoFileData } from '../../components/preview/video';
import { messageFor } from '../errors';
import { imageFileData } from '../helpers';
import { type Dispatch, type SetStateAction, type RefObject } from 'react';

export function useSceneReplacement({ canEdit, setReplacingSceneId, inspectorFlush, pending, latestProject, project, optimisticScene, run, setNotice, setSession, setError, selectedCount, selectedScene, replaceTargetId, replaceInput, reorderRef, setReorderId, setDropTarget, setFileDragActive, dragOverTarget, dropLibraryMedia, scenes }: {
  canEdit: boolean;
  setReplacingSceneId: Dispatch<SetStateAction<string | null>>;
  inspectorFlush: RefObject<() => void>;
  pending: RefObject<Promise<boolean>>;
  latestProject: RefObject<Project>;
  project: Project;
  optimisticScene: (scene: Scene) => Project;
  run: (command: Command) => Promise<boolean>;
  setNotice: Dispatch<SetStateAction<string>>;
  setSession: Dispatch<SetStateAction<Session>>;
  setError: Dispatch<SetStateAction<string>>;
  selectedCount: number;
  selectedScene: Scene | undefined;
  replaceTargetId: RefObject<string | null>;
  replaceInput: RefObject<HTMLInputElement | null>;
  reorderRef: RefObject<string | null>;
  setReorderId: Dispatch<SetStateAction<string | null>>;
  setDropTarget: Dispatch<SetStateAction<string | null>>;
  setFileDragActive: Dispatch<SetStateAction<boolean>>;
  dragOverTarget: (event: ReactDragEvent<HTMLElement>, id: string) => void;
  dropLibraryMedia: (event: ReactDragEvent<HTMLElement>) => boolean;
  scenes: Scene[];
}) {
  async function replaceSceneWithAsset(sceneId: string, asset: bridge.ImportedAsset) {
    if (!canEdit) return;
    setReplacingSceneId(sceneId);
    try {
      inspectorFlush.current();
      await pending.current;
      const target = projectScenes(latestProject.current).find(scene => scene.id === sceneId);
      if (!target) throw new Error('That scene is no longer in the project.');
      let next: Scene;
      if (asset.mime.startsWith('video/')) {
        const probe = await probeVideo(asset.reference);
        const source = Math.min(3600, Math.max(.01, probe.duration));
        const duration = Math.min(target.durationTicks, secondsToTicks(source, project.timebase));
        next = {
          ...target, name: asset.name, image: asset.reference, mediaKind: 'video', videoPoster: probe.poster,
          sourceDurationSeconds: source, sourceInTicks: 0, durationTicks: Math.max(minTicks(project.timebase), duration),
          motion: 'none', transition: null,
          fadeIn: Math.min(target.fadeIn ?? 0, ticksToSeconds(duration, project.timebase)),
          fadeOut: Math.min(target.fadeOut ?? 0, ticksToSeconds(duration, project.timebase)),
        };
      } else {
        await loadImage(asset.reference);
        next = replaceSceneImage(target, asset.reference, asset.name);
      }
      const before = optimisticScene(next);
      const ok = await run({ type: 'update', scene: next });
      if (ok) setNotice(asset.mime.startsWith('video/') ? 'Video replaced. Text, looks, and the scene\'s timeline position were kept.' : 'Image replaced. Timing, text, and looks were kept.');
      else { latestProject.current = before; setSession(current => ({ ...current, project: before })); }
    } catch (error) { setError(messageFor(error)); }
    finally { setReplacingSceneId(null); }
  }

  function requestReplaceImage(sceneId?: string) {
    const id = sceneId ?? (selectedCount === 1 ? selectedScene?.id : undefined);
    if (!id) { setNotice('Select one scene to replace its media.'); return; }
    if (!canEdit) return;
    if (bridge.native) {
      void bridge.importMediaAsset().then(asset => { if (asset) void replaceSceneWithAsset(id, asset); }).catch(error => setError(messageFor(error)));
      return;
    }
    inspectorFlush.current();
    replaceTargetId.current = id;
    replaceInput.current?.click();
  }

  async function replaceVideoForScene(sceneId: string, file: File) {
    if (!canEdit) return;
    setReplacingSceneId(sceneId);
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error(`“${file.name}” is larger than 50 MB. Choose a shorter clip.`);
      const data = await videoFileData(file);
      const probe = await probeVideo(data);
      inspectorFlush.current();
      await pending.current;
      const target = projectScenes(latestProject.current).find(scene => scene.id === sceneId);
      if (!target) throw new Error('That scene is no longer in the project.');
      const source = Math.min(3600, Math.max(.01, probe.duration));
      const duration = Math.min(target.durationTicks, secondsToTicks(source, project.timebase));
      const next = {
        ...target, name: file.name, image: data, mediaKind: 'video' as const, videoPoster: probe.poster,
        sourceDurationSeconds: source, sourceInTicks: 0, durationTicks: Math.max(minTicks(project.timebase), duration),
        motion: 'none' as const, transition: null,
        fadeIn: Math.min(target.fadeIn ?? 0, ticksToSeconds(duration, project.timebase)),
        fadeOut: Math.min(target.fadeOut ?? 0, ticksToSeconds(duration, project.timebase)),
      };
      const before = optimisticScene(next);
      const ok = await run({ type: 'update', scene: next });
      if (ok) setNotice(`Video replaced. Text, looks, and the scene's timeline position were kept.`);
      else { latestProject.current = before; setSession(current => ({ ...current, project: before })); }
    } catch (e) { setError(messageFor(e)); }
    finally { setReplacingSceneId(null); }
  }

  async function replaceSceneMedia(sceneId: string, file: File) {
    if (file.type.startsWith('video/')) await replaceVideoForScene(sceneId, file);
    else await replaceImageForScene(sceneId, file);
  }

  async function replaceImageForScene(sceneId: string, file: File) {
    if (!canEdit) return;
    setReplacingSceneId(sceneId);
    try {
      let image: string;
      if (bridge.native) {
        image = await imageFileData(file);
        await loadImage(image);
      } else {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error(`“${file.name}” is not a JPEG, PNG, or WebP image. Choose one of those formats.`);
        if (file.size > 500 * 1024 * 1024) throw new Error(`“${file.name}” is larger than 500 MB. Choose a smaller image.`);
        const asset = await storeAssetBlob(file, file.name);
        image = assetRef(asset.id);
        await loadImage(image);
      }
      inspectorFlush.current();
      await pending.current;
      const target = projectScenes(latestProject.current).find(scene => scene.id === sceneId);
      if (!target) throw new Error('That scene is no longer in the project.');
      const next = replaceSceneImage(target, image, file.name);
      const before = optimisticScene(next);
      const ok = await run({ type: 'update', scene: next });
      if (ok) setNotice(`Image replaced. Timing, text, and looks were kept.`);
      else { latestProject.current = before; setSession(current => ({ ...current, project: before })); }
    } catch (e) { setError(messageFor(e)); }
    finally { setReplacingSceneId(null); }
  }

  function beginReorder(event: ReactDragEvent<HTMLElement>, scene: Scene) {
    if (!canEdit || (event.target as HTMLElement).closest('.fade-handle') || (event.target as HTMLElement).closest('.clip-trim')) { event.preventDefault(); return; }
    reorderRef.current = scene.id;
    setReorderId(scene.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', scene.id);
  }

  function endReorder() {
    reorderRef.current = null;
    setReorderId(null);
    setDropTarget(null);
    setFileDragActive(false);
  }

  function dragOverScene(event: ReactDragEvent<HTMLElement>, id: string) {
    if (reorderRef.current) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      setDropTarget(id);
      return;
    }
    dragOverTarget(event, id);
  }

  function dropScene(event: ReactDragEvent<HTMLElement>, target: Scene) {
    if (dropLibraryMedia(event)) return;
    const sourceId = reorderRef.current;
    if (sourceId) {
      event.preventDefault();
      event.stopPropagation();
      const sourceIndex = scenes.findIndex(scene => scene.id === sourceId);
      const targetIndex = scenes.findIndex(scene => scene.id === target.id);
      endReorder();
      if (sourceIndex >= 0 && targetIndex >= 0 && sourceIndex !== targetIndex) {
        void run({ type: 'move', id: sourceId, offset: targetIndex - sourceIndex });
      }
      return;
    }
    void dropReplacement(event, target);
  }

  async function dropReplacement(event: ReactDragEvent<HTMLElement>, scene: Scene) {
    event.preventDefault();
    event.stopPropagation();
    setDropTarget(null);
    setFileDragActive(false);
    const file = Array.from(event.dataTransfer.files).find(item => item.type.startsWith('image/') || item.type.startsWith('video/'));
    if (!file) { setError('Drop a JPEG, PNG, WebP, MP4, MOV, M4V, or WebM file to replace this scene.'); return; }
    await replaceSceneMedia(scene.id, file);
  }

  return { replaceSceneWithAsset, replaceSceneMedia, requestReplaceImage, beginReorder, endReorder, dragOverScene, dropScene };
}
