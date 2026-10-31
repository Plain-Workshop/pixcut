import type { ModalId } from '../modal';
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { resolveMediaSource } from '../../components/preview/media-url';
import { isTextEntryTarget } from '../../shortcuts/registry';
import type { Scene } from '../../stores/model';

/** State and controls for the full-size media viewer opened from the library. */
export function useSourcePreview({ modal, setModal, setPlaying, filteredScenes, sourceMedia }: {
  modal: string | null;
  setModal: Dispatch<SetStateAction<ModalId | null>>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  filteredScenes: Scene[];
  sourceMedia: Scene[];
}) {
  const [sourcePreview, setSourcePreview] = useState<Scene | null>(null);
  const previewVideo = useRef<HTMLVideoElement | null>(null);
  const [previewVideoTime, setPreviewVideoTime] = useState(0);
  const [previewVideoDuration, setPreviewVideoDuration] = useState(0);
  const [previewVideoPlaying, setPreviewVideoPlaying] = useState(false);
  const [previewVolume, setPreviewVolume] = useState(.8);
  const [previewMuted, setPreviewMuted] = useState(false);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | undefined>(undefined);
  const previewList = useMemo(() => {
    if (!sourcePreview) return sourceMedia;
    return filteredScenes.some(item => item.id === sourcePreview.id) ? filteredScenes : sourceMedia;
  }, [filteredScenes, sourceMedia, sourcePreview]);
  const previewIndex = sourcePreview ? previewList.findIndex(item => item.id === sourcePreview.id) : -1;

  useEffect(() => {
    let cancelled = false;
    const source = sourcePreview?.image;
    if (!source) { setSourcePreviewUrl(undefined); return; }
    if (!source.startsWith('pixcut-asset:')) { setSourcePreviewUrl(source); return; }
    setSourcePreviewUrl(undefined);
    void resolveMediaSource(source).then(url => { if (!cancelled) setSourcePreviewUrl(url); }).catch(() => {});
    return () => { cancelled = true; };
  }, [sourcePreview?.image]);

  function previewMedia(scene: Scene) {
    setPlaying(false);
    setSourcePreview(scene);
    setPreviewVideoTime(0);
    setPreviewVideoDuration(0);
    setPreviewVideoPlaying(false);
    setModal('source');
  }

  function switchPreview(delta: number) {
    if (!sourcePreview || previewList.length < 2) return;
    const index = previewIndex < 0 ? 0 : previewIndex;
    const next = previewList[(index + delta + previewList.length) % previewList.length];
    if (!next || next.id === sourcePreview.id) return;
    setSourcePreview(next);
    setPreviewVideoTime(0);
    setPreviewVideoDuration(0);
    setPreviewVideoPlaying(false);
  }

  function togglePreviewPlayback() {
    const video = previewVideo.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setPreviewVideoPlaying(false));
    else video.pause();
  }

  function seekPreview(seconds: number) {
    const video = previewVideo.current;
    if (!video || !Number.isFinite(seconds)) return;
    video.currentTime = Math.max(0, Math.min(video.duration || previewVideoDuration, seconds));
    setPreviewVideoTime(video.currentTime);
  }

  function changePreviewVolume(value: number) {
    const volume = Math.max(0, Math.min(1, value));
    setPreviewVolume(volume);
    setPreviewMuted(volume === 0);
    const video = previewVideo.current;
    if (video) { video.volume = volume; video.muted = volume === 0; }
  }

  function togglePreviewMute() {
    const muted = !previewMuted;
    setPreviewMuted(muted);
    if (previewVideo.current) previewVideo.current.muted = muted;
  }

  useEffect(() => {
    setPreviewVideoTime(0);
    setPreviewVideoDuration(0);
    setPreviewVideoPlaying(false);
  }, [sourcePreview?.id]);

  useEffect(() => {
    const video = previewVideo.current;
    if (!video) return;
    video.volume = previewVolume;
    video.muted = previewMuted;
  }, [previewVolume, previewMuted, sourcePreview?.id]);

  useEffect(() => {
    if (modal !== 'source' || !sourcePreview) return;
    const key = (event: KeyboardEvent) => {
      if (event.isComposing || event.target instanceof HTMLInputElement || isTextEntryTarget(event.target)) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        switchPreview(event.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (!sourcePreview.mediaKind || sourcePreview.image.startsWith('pixcut-asset:')) return;
      if (event.key === ' ') {
        event.preventDefault();
        togglePreviewPlayback();
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        changePreviewVolume(previewVolume + (event.key === 'ArrowUp' ? .05 : -.05));
      } else if (event.key.toLowerCase() === 'm') {
        event.preventDefault();
        togglePreviewMute();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [modal, sourcePreview, previewList, previewVolume, previewMuted, previewVideoPlaying]);

  return { sourcePreview, setSourcePreview, previewVideo, sourcePreviewUrl, previewMuted, setPreviewVideoDuration, setPreviewVideoTime, setPreviewVideoPlaying, previewList, previewIndex, previewVideoPlaying, previewVideoTime, previewVideoDuration, previewVolume, previewMedia, switchPreview, togglePreviewPlayback, seekPreview, changePreviewVolume, togglePreviewMute };
}
