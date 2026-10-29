import { canvasPng } from '../components/preview/png';
import { splitTransition } from '../components/preview/transition-timing';
import { isRamped, sourceSecondsAt, speedCurve } from '../components/preview/speed';
import { resolveMediaSource } from '../components/preview/media-url';
import { exportBoundaries } from '../components/preview/export-timing';
import * as bridge from './bridge';
import { EXPORT_CODEC_CRF } from './export-options';
import { overlayScenes, projectScenes, secondsToTicks, ticksToSeconds, type Project, type FormatVariant } from '../stores/model';
import { drawOverlayStack, drawPipClips, drawScene, drawProjectOverlays, drawProjectText, drawTransition } from '../components/preview/render';
import { gradeLutCube } from '../components/preview/filters';
import { sceneTextLayers } from '../components/text/layers';
import { formatSize, resolveScenesForFormat } from '../stores/formats';
import { type RefObject } from 'react';

/** Everything the planner needs from the export dialog, so planning itself stays free of React state. */
export type VideoPlanContext = {
  exportAudio: boolean;
  exportCancelled: RefObject<boolean>;
  setExportProgress: (percent: number) => void;
  exportCodec: bridge.ExportCodec;
  exportContainer: bridge.ExportContainer;
  exportSpeed: 'fast' | 'medium' | 'slow';
  useHardware: boolean;
  exportFilename: (delivery: { formats: { name: string; presetId?: string | null; quality: string; width: number; height: number }[]; slug?: string }, includeFormat?: boolean) => string;
};

export async function videoFrameReader(sourceValue: string) {
  const url = await resolveMediaSource(sourceValue);
  if (!url) throw new Error('That video is missing from the local store. Relink the clip and export again.');
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    const fail = () => reject(new Error('That video could not be read for the transition. Relink the clip and export again.'));
    video.addEventListener('loadeddata', () => resolve(), { once: true });
    video.addEventListener('error', fail, { once: true });
    video.load();
  });
  return {
    video,
    async seek(seconds: number) {
      const end = Number.isFinite(video.duration) && video.duration > 0 ? Math.max(0, video.duration - 0.04) : seconds;
      const target = Math.max(0, Math.min(seconds, end));
      if (video.readyState >= 2 && Math.abs(video.currentTime - target) < 0.001) return video;
      await new Promise<void>((resolve, reject) => {
        const done = () => { cleanup(); resolve(); };
        const fail = () => { cleanup(); reject(new Error('That video could not be read for the transition. Relink the clip and export again.')); };
        const cleanup = () => { video.removeEventListener('seeked', done); video.removeEventListener('error', fail); };
        video.addEventListener('seeked', done);
        video.addEventListener('error', fail);
        video.currentTime = target;
      });
      return video;
    },
    close() { video.removeAttribute('src'); video.load(); },
  };
}

export async function buildVideoPlan(ctx: VideoPlanContext, format: FormatVariant, progressRef: { count: number; total: number }, source: Project, visualAudio = source.audio, withClipAudio = ctx.exportAudio, nameFormats: FormatVariant[] = [format], nameSlug?: string): Promise<bridge.ExportPlan> {
  const formatScenes = resolveScenesForFormat(projectScenes(source), format);
  const size = formatSize(format);
  const segments: bridge.PlanSegment[] = [];
  const tick = () => {
    progressRef.count += 1;
    if (ctx.exportCancelled.current) throw new Error('Export cancelled.');
    ctx.setExportProgress(Math.round(2 + progressRef.count / Math.max(1, progressRef.total) * 66));
  };
  for (let sceneIndex = 0; sceneIndex < formatScenes.length; sceneIndex++) {
    const scene = formatScenes[sceneIndex];
    const next = formatScenes[sceneIndex + 1];
    if (scene.mediaKind === 'video') {
      // A transition lives in the outgoing clip's tail: the moving picture
      // stops early and the last window is baked frame by frame, blended with
      // the next clip's first frame, so the timeline keeps its duration.
      const transition = scene.transition && next ? scene.transition : null;
      const { transitionTicks, mainTicks, audioTicks } = splitTransition(scene.durationTicks, transition, source.timebase);
      const overlays: bridge.PlanOverlay[] = [];
      if ((scene.elements?.length ?? 0) || sceneTextLayers(scene).length || source.overlays.length || overlayScenes(source).length) {
        const frames: string[] = [];
        const canvas = document.createElement('canvas');
        canvas.width = size.width; canvas.height = size.height;
        for (let frame = 0; frame < mainTicks; frame++) {
          if (ctx.exportCancelled.current) throw new Error('Export cancelled.');
          await drawOverlayStack(canvas, scene, source.overlays, size, ticksToSeconds(frame, source.timebase), ticksToSeconds(scene.startTicks + frame, source.timebase), source.timebase, true, visualAudio);
          await drawPipClips(canvas, overlayScenes(source), ticksToSeconds(scene.startTicks + frame, source.timebase), source.aspect, 'export', source.timebase, visualAudio, true);
          await drawProjectText(canvas, source.globalText ?? [], ticksToSeconds(scene.startTicks + frame, source.timebase), source.timebase);
          frames.push(await canvasPng(canvas));
          tick();
      await new Promise(resolve => setTimeout(resolve, 0));
          if (frame % 10 === 0) await new Promise(resolve => setTimeout(resolve, 0));
        }
        overlays.push({ png: frames[0], frames, startTicks: scene.startTicks, durationTicks: mainTicks });
      }
      segments.push({
        kind: 'video', video: scene.image,
        sourceInSeconds: ticksToSeconds(scene.sourceInTicks, source.timebase),
        fit: scene.fit, speed: speedCurve(scene).start,
        ...(isRamped(scene) ? { speedEnd: speedCurve(scene).end } : {}),
        ...(scene.reverse ? { reverse: true } : {}),
        lut: gradeLutCube(scene) ?? undefined,
        fadeIn: Math.max(0, Math.min(scene.fadeIn ?? 0, ticksToSeconds(scene.durationTicks, source.timebase))),
        fadeOut: Math.max(0, Math.min(scene.fadeOut ?? 0, ticksToSeconds(scene.durationTicks, source.timebase))),
        videoVolume: Math.min(100, Math.max(0, scene.videoVolume ?? 100)),
        includeAudio: withClipAudio,
        durationTicks: mainTicks,
        ...(audioTicks ? { audioDurationTicks: audioTicks } : {}),
        overlays,
      });
      if (transition && next) {
        const reader = await videoFrameReader(scene.image);
        const nextReader = next.mediaKind === 'video' ? await videoFrameReader(next.image) : null;
        try {
          const toFrame = nextReader ? await nextReader.seek(ticksToSeconds(next.sourceInTicks ?? 0, source.timebase)) : null;
          const canvas = document.createElement('canvas');
          for (let frame = 0; frame < transitionTicks; frame++) {
            if (ctx.exportCancelled.current) throw new Error('Export cancelled.');
            const localTicks = mainTicks + frame;
            const localSeconds = ticksToSeconds(localTicks, source.timebase);
            const fromFrame = await reader.seek(sourceSecondsAt(scene, localSeconds, source.timebase));
            const progress = Math.min(1, (frame + 1) / transitionTicks);
            await drawTransition(canvas, scene, next, transition.type, source.aspect, 'export', progress, localSeconds, 0, source.timebase, size, visualAudio, fromFrame, toFrame);
            await drawProjectOverlays(canvas, source.overlays, ticksToSeconds(scene.startTicks + localTicks, source.timebase), source.timebase, true, visualAudio);
            await drawPipClips(canvas, overlayScenes(source), ticksToSeconds(scene.startTicks + localTicks, source.timebase), source.aspect, 'export', source.timebase, visualAudio, true);
            await drawProjectText(canvas, source.globalText ?? [], ticksToSeconds(scene.startTicks + localTicks, source.timebase), source.timebase);
            segments.push({ kind: 'image', png: await canvasPng(canvas), durationTicks: 1, overlays: [] });
            tick();
          }
        } finally {
          reader.close();
          nextReader?.close();
        }
      }
      continue;
    }
    const transitionAllowed = Boolean(scene.transition && next);
    const points = exportBoundaries(scene, source.timebase, transitionAllowed, source.overlays);
    for (let index = 0; index < points.length - 1; index++) {
      const durationTicks = points[index + 1] - points[index];
      if (durationTicks <= 0) continue;
      const canvas = document.createElement('canvas');
      const localTicks = points[index];
      const localSeconds = ticksToSeconds(localTicks, source.timebase);
      const transition = scene.transition && transitionAllowed ? scene.transition : null;
      const transitionStart = transition ? scene.durationTicks - secondsToTicks(transition.duration, source.timebase) : 0;
      if (transition && localTicks >= transitionStart) {
        const progress = Math.min(1, (localTicks - transitionStart) / Math.max(1, secondsToTicks(transition.duration, source.timebase)));
        await drawTransition(canvas, scene, next!, transition.type, source.aspect, 'export', progress, localSeconds, 0, source.timebase, size, visualAudio);
        await drawProjectOverlays(canvas, source.overlays, ticksToSeconds(scene.startTicks + localTicks, source.timebase), source.timebase, true, visualAudio);
      } else {
        await drawScene(canvas, scene, source.aspect, 'export', localSeconds, source.timebase, size, undefined, visualAudio, source.overlays, ticksToSeconds(scene.startTicks + localTicks, source.timebase));
      }
      await drawPipClips(canvas, overlayScenes(source), ticksToSeconds(scene.startTicks + localTicks, source.timebase), source.aspect, 'export', source.timebase, visualAudio, true);
      await drawProjectText(canvas, source.globalText ?? [], ticksToSeconds(scene.startTicks + localTicks, source.timebase), source.timebase);
      segments.push({ kind: 'image', png: await canvasPng(canvas), durationTicks, overlays: [] });
      tick();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  return {
    segments,
    options: { width: size.width, height: size.height, fps: format.fps, codec: ctx.exportCodec, container: ctx.exportContainer, speed: ctx.exportSpeed, hardware: ctx.useHardware, crf: EXPORT_CODEC_CRF[ctx.exportCodec][format.quality], filename: ctx.exportFilename({ formats: nameFormats, slug: nameSlug }, nameFormats.length > 1) },
  };
}
