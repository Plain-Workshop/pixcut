import { usePlayback, type PlaybackStore } from '../playback-store';
import { useDrafts, type DraftsStore } from '../drafts-store';
import { useEffect } from 'react';
import { playbackPosition } from '../../components/preview/playback-clock';
import { mediaClockPosition, videoSeekTarget } from '../../components/preview/video-sync';
import { resolveMediaSource } from '../../components/preview/media-url';
import { t } from '../../i18n';
import { messageFor } from '../errors';
import { videoAudioGain, ticksToSeconds, type AudioMix, type Scene, type TextLayer, type FormatVariant, type ElementLayer } from '../../stores/model';
import { sourceSecondsAt, sourceSpan, speedAt, speedCurve } from '../../components/preview/speed';
import { videoGain } from '../../components/preview/video-audio';
import { clampPipSource, pipFrameTarget } from '../../components/preview/pip-playback';
import { LatestRenderQueue } from '../../components/preview/render-queue';
import { drawPipClips, drawScene, drawProjectOverlays, drawProjectText, drawTransition } from '../../components/preview/render';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { Project, TransitionType } from '../../stores/model';

export function usePreviewPlayback({activeFormat, activeSize, audioMix, displayAspect, draggingOverlay, duration, frameSeconds, framingStaged, globalTextDraft, latestProject, pipVideoElements, pipVideoScenes, pipVideoSignature, pipVideoSources, pipVideoTick, positionRef, preview, previewArea, previewLocalSeconds, previewQueue, previewTarget, previewTransition, project, renderOverlays, renderPipScenes, resolvedNextScene, sceneForPreview, sceneVideo, screen, setError, setPreviewSize, videoClock, videoScene, videoSync, videoTick, playbackStore, draftsStore}: {
  activeFormat: FormatVariant;
  activeSize: { width: number; height: number; };
  audioMix: AudioMix;
  displayAspect: "16:9" | "9:16" | "1:1" | "4:5";
  draggingOverlay: boolean;
  duration: number;
  frameSeconds: number;
  framingStaged: boolean;
  globalTextDraft: TextLayer[] | null;
  latestProject: RefObject<Project>;
  pipVideoElements: RefObject<Map<string, HTMLVideoElement>>;
  pipVideoScenes: Scene[];
  pipVideoSignature: string;
  pipVideoSources: RefObject<Map<string, string>>;
  pipVideoTick: number;
  positionRef: RefObject<number>;
  preview: RefObject<HTMLCanvasElement | null>;
  previewArea: RefObject<HTMLDivElement | null>;
  previewLocalSeconds: number;
  previewQueue: RefObject<LatestRenderQueue | null>;
  previewTarget: Scene | undefined;
  previewTransition: { type: TransitionType; progress: number; next: Scene; } | null;
  project: Project;
  renderOverlays: ElementLayer[];
  renderPipScenes: Scene[];
  resolvedNextScene: Scene | undefined;
  sceneForPreview: Scene | null;
  sceneVideo: RefObject<HTMLVideoElement | null>;
  screen: "home" | "editor";
  setError: Dispatch<SetStateAction<string>>;
  setPreviewSize: Dispatch<SetStateAction<{ width: number; height: number; } | null>>;
  videoClock: RefObject<{ activeStart: number; sourceIn: number; speed: number; constant: boolean; duration: number; reverse: boolean; element: HTMLVideoElement; } | null>;
  videoScene: Scene | null;
  videoSync: RefObject<{ sceneId: string | null; needsSync: boolean; }>;
  videoTick: number;
  playbackStore: PlaybackStore;
  draftsStore: DraftsStore;
}) {
  const { loop, playDirection, playing, position, setPlaying, setPosition } = usePlayback(playbackStore);
  const { pipDraft } = useDrafts(draftsStore);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let origin = positionRef.current, startedAt = performance.now();
    const tick = (now: number) => {
      const limit = Math.max(0, duration - frameSeconds);
      let next = playbackPosition(origin, startedAt, now, playDirection);
      // A forward-playing video is the time source. The picture and its sound
      // are decoded on the media clock; letting wall time run ahead of it used
      // to trigger a catch-up seek that froze the preview, then repeated.
      const clock = videoClock.current;
      if (playDirection > 0 && clock && clock.constant && !clock.reverse) {
        const media = clock.element;
        if (media === sceneVideo.current && !media.paused && !media.seeking && media.readyState >= 2) {
          const mediaPosition = mediaClockPosition(media.currentTime, clock.sourceIn, clock.speed, clock.duration, clock.activeStart);
          if (mediaPosition !== null && Math.abs(mediaPosition - next) < 2) {
            next = mediaPosition;
            origin = mediaPosition;
            startedAt = now;
          }
        }
      }
      if (playDirection > 0 && next >= duration) {
        if (loop) {
          origin = 0; startedAt = now;
          positionRef.current = 0; setPosition(0);
          frame = requestAnimationFrame(tick);
          return;
        }
        positionRef.current = limit; setPosition(limit); setPlaying(false); return;
      }
      if (playDirection < 0 && next <= 0) {
        if (loop) {
          origin = limit; startedAt = now;
          positionRef.current = limit; setPosition(limit);
          frame = requestAnimationFrame(tick);
          return;
        }
        positionRef.current = 0; setPosition(0); setPlaying(false); return;
      }
      const bounded = Math.min(Math.max(0, next), limit);
      positionRef.current = bounded; setPosition(bounded);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [playing, duration, playDirection, loop, frameSeconds]);

  useEffect(() => {
    const element = sceneVideo.current;
    if (!element) return;
    if (!videoScene) {
      element.pause();
      delete element.dataset.sceneId;
      delete element.dataset.sceneSource;
      videoSync.current = { sceneId: null, needsSync: false };
      if (element.getAttribute('src')) { element.removeAttribute('src'); element.load(); }
      return;
    }
    element.dataset.sceneId = videoScene.id;
    // Consecutive clips can share one source file (splitting a video creates
    // exactly that). Reloading the element at that boundary froze the picture
    // and the sound while WebKit opened the file again, so only a real source
    // change touches `src`.
    if (element.dataset.sceneSource !== videoScene.image) {
      element.dataset.sceneSource = videoScene.image;
      videoSync.current.needsSync = true;
      // Keep the new source silent until the play effect decides otherwise.
      element.muted = true;
      const source = videoScene.image;
      void resolveMediaSource(source).then(url => {
        if (!url) { setError(t('That video is missing from the local store. Relink the clip.')); return; }
        if (element.dataset.sceneSource !== source) return;
        element.src = url;
        element.load();
      }, error => setError(messageFor(error)));
    }
    // No dependency array: when a project is reopened the preview stage (and
    // this element) can mount after the clip list is already in place, so the
    // source must be picked up on the first render that has both.
  });

  useEffect(() => {
    const element = sceneVideo.current;
    if (!element || !videoScene) { videoClock.current = null; return; }
    const clipSeconds = Math.max(0.001, ticksToSeconds(videoScene.durationTicks, project.timebase));
    const inPoint = ticksToSeconds(videoScene.sourceInTicks ?? 0, project.timebase);
    const speed = speedCurve(videoScene);
    videoClock.current = {
      activeStart: ticksToSeconds(videoScene.startTicks, project.timebase),
      sourceIn: inPoint,
      speed: speed.start,
      constant: Math.abs(speed.end - speed.start) < 1e-6,
      duration: clipSeconds,
      reverse: Boolean(videoScene.reverse),
      element,
    };
    const fallback = inPoint + sourceSpan(videoScene, clipSeconds);
    const end = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : fallback;
    const target = Math.max(0, Math.min(sourceSecondsAt(videoScene, previewLocalSeconds, project.timebase), end - 0.04));
    // A reversed clip is stepped by seeking; `playbackRate` cannot go negative.
    if (!videoScene.reverse) {
      const speed = speedAt(videoScene, previewLocalSeconds, clipSeconds);
      if (element.playbackRate !== speed) element.playbackRate = speed;
    }
    element.volume = videoGain(previewLocalSeconds, clipSeconds, videoScene.fadeIn ?? 0, videoScene.fadeOut ?? 0, videoScene.videoVolume ?? 100) * videoAudioGain({ audioMix });
    // While the clip plays forward its own clock drives the picture, so only a
    // large drift is corrected. Seeking every frame fights the decoder, which
    // used to cost frames and silence. Scrubbing and reverse still track exactly.
    const forward = playing && playDirection > 0 && !videoScene.reverse;
    const sync = videoSync.current;
    if (sync.sceneId !== videoScene.id) {
      sync.sceneId = videoScene.id;
      sync.needsSync = true;
    }
    // The media clock drives the playhead for constant-speed forward playback,
    // so there is nothing to catch up with. Seeks stay for scrubbing, reverse,
    // ramped speeds and the one exact sync at a new clip or source. A loop or a
    // media time outside the clip falls back to the seek policy.
    const clock = videoClock.current;
    const clockPosition = clock ? mediaClockPosition(element.currentTime, clock.sourceIn, clock.speed, clock.duration, clock.activeStart) : null;
    const mediaClockActive = forward && Boolean(clock?.constant) && clockPosition !== null && !element.paused && element.readyState >= 2 && !element.seeking;
    let seekTo = mediaClockActive ? null : videoSeekTarget(element.currentTime, target, forward, element.readyState >= 2, element.seeking);
    if (sync.needsSync && element.readyState >= 2 && !element.seeking) {
      if (Math.abs(target - element.currentTime) > 0.08) seekTo = target;
      sync.needsSync = false;
    }
    if (seekTo !== null) element.currentTime = seekTo;
    // No dependency array for the same reason as the source effect: the volume
    // and the in/out point must reach the element even when it mounts after the
    // clip is already known (reopening a stored project).
  });

  useEffect(() => {
    const element = sceneVideo.current;
    if (!element || !videoScene) return;
    // The clip's own soundtrack only plays while moving forward; scrubbing and
    // reverse playback stay silent, matching how the audio clips behave.
    element.muted = !(playing && playDirection > 0) || Boolean(videoScene.reverse);
    if (playing && playDirection > 0 && !videoScene.reverse) {
      if (element.paused) element.play().catch(() => { /* retried once the source loads */ });
    } else element.pause();
    // `videoTick` changes when the source loads or finishes a seek. Pressing Play
    // before a data URL finished decoding used to leave the clip paused and mute
    // for the whole scene; retrying here starts it as soon as frames exist.
  }, [playing, playDirection, videoScene?.id, videoScene?.reverse, videoTick]);

  // Picture-in-picture videos keep one hidden element each. Preview draws them
  // live so playback is smooth; export still seeks frame by frame.
  useEffect(() => {
    for (const clip of pipVideoScenes) {
      const element = pipVideoElements.current.get(clip.id);
      if (!element || pipVideoSources.current.get(clip.id) === clip.image) continue;
      pipVideoSources.current.set(clip.id, clip.image);
      element.muted = true;
      const source = clip.image;
      void resolveMediaSource(source).then(url => {
        if (!url) { setError(t('That video is missing from the local store. Relink the clip.')); return; }
        if (pipVideoSources.current.get(clip.id) !== source) return;
        element.src = url;
        element.load();
      }, error => setError(messageFor(error)));
    }
    // Same reason as the base video: the hidden elements mount after the clip
    // list exists when a stored project is reopened.
  });

  useEffect(() => {
    const forward = playing && playDirection > 0;
    for (const clip of pipVideoScenes) {
      const element = pipVideoElements.current.get(clip.id);
      if (!element) continue;
      const { active, source } = pipFrameTarget(clip, position, project.timebase);
      if (!active || !forward) {
        if (!element.paused) element.pause();
        if (active) {
          const target = clampPipSource(source, element.duration);
          const seekTo = videoSeekTarget(element.currentTime, target, false, element.readyState >= 2, element.seeking);
          if (seekTo !== null) element.currentTime = seekTo;
        }
        continue;
      }
      const target = clampPipSource(source, element.duration);
      const seekTo = videoSeekTarget(element.currentTime, target, true, element.readyState >= 2, element.seeking);
      if (seekTo !== null) element.currentTime = seekTo;
      if (element.paused) element.play().catch(() => { /* retried when the source loads */ });
    }
    // Same mount-order guard as the base video: hidden PiP elements can appear
    // after their clips are already in the project.
  });

  useEffect(() => {
    if (!previewTarget || !preview.current) return;
    previewQueue.current ??= new LatestRenderQueue(error => setError(messageFor(error)));
    const projectId = project.id;
    // Full preview resolution while paused keeps text crisp; half-resolution
    // playback keeps 4K and overlay-heavy stories smooth.
    const renderLimit = draggingOverlay || playing ? 720 : 1280;
    // A compact deliverable (320×180, 480×854) must still preview sharply, so the
    // canvas renders at up to 720 px on its long edge even when the output is smaller.
    const longestSide = Math.max(activeSize.width, activeSize.height);
    const renderScale = Math.max(
      Math.min(1, renderLimit / longestSide),
      Math.min(720 / longestSide, 2.5),
    );
    const renderSize = { width: Math.max(1, Math.round(activeSize.width * renderScale)), height: Math.max(1, Math.round(activeSize.height * renderScale)) };
    previewQueue.current.enqueue(async () => {
      const layer = document.createElement('canvas');
      // A transition blends two whole scenes, so overlays are drawn once on top
      // while it runs; everywhere else they join the scene stack.
      if (previewTransition && resolvedNextScene) {
        await drawTransition(layer, sceneForPreview!, resolvedNextScene, previewTransition.type, displayAspect, 'preview', previewTransition.progress, previewLocalSeconds, 0, project.timebase, renderSize, project.audio, videoScene ? sceneVideo.current : null);
        await drawProjectOverlays(layer, renderOverlays, position, project.timebase, false, project.audio);
      } else {
        await drawScene(layer, sceneForPreview!, displayAspect, 'preview', previewLocalSeconds, project.timebase, renderSize, videoScene ? sceneVideo.current : null, project.audio, renderOverlays, position);
      }
      await drawPipClips(layer, renderPipScenes, position, displayAspect, 'preview', project.timebase, project.audio, false, pipVideoElements.current);
      await drawProjectText(layer, globalTextDraft ?? project.globalText ?? [], position, project.timebase);
      if (preview.current && latestProject.current.id === projectId) {
        preview.current.width = layer.width; preview.current.height = layer.height;
        preview.current.getContext('2d')?.drawImage(layer, 0, 0);
      }
    });
  }, [previewTarget, previewLocalSeconds, displayAspect, project.timebase, project.audio, project.tracks, pipDraft, project.globalText, globalTextDraft, screen, activeFormat?.id, framingStaged, previewTransition?.type, previewTransition?.progress, previewTransition?.next, videoTick, videoScene?.id, renderOverlays, draggingOverlay, playing, activeSize.width, activeSize.height, pipVideoTick, pipVideoSignature]);

  useEffect(() => {
    const area = previewArea.current;
    if (!area) return;
    const update = () => {
      const [width, height] = [activeSize.width, activeSize.height] as [number, number];
      const scale = Math.min(area.clientWidth / width, area.clientHeight / height);
      setPreviewSize({ width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(area);
    return () => observer.disconnect();
  }, [activeSize.width, activeSize.height, screen]);
}
