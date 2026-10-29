import { creditsFileText } from '../helpers';
import { buildVideoPlan } from '../export-plan';
import { exportOutputFormat } from '../export-progress';
import { canvasPng } from '../../components/preview/png';
import { actionAudio } from '../../components/elements/sound';
import { missingAssets } from '../../stores/missing-assets';
import { exportBoundaries } from '../../components/preview/export-timing';
import * as bridge from '../bridge';
import { EXPORT_CODEC_CRF } from '../export-options';
import { overlayScenes, projectScenes, secondsToTicks, ticksToSeconds, type Project, type Scene, type FormatVariant, type ElementLayer } from '../../stores/model';
import { drawPipClips, drawScene, drawProjectOverlays, drawProjectText, drawTransition } from '../../components/preview/render';
import { formatSize, groupFormatsByOutput, resolveScenesForFormat } from '../../stores/formats';
import { messageFor } from '../errors';
import type { TransitionType } from '../../stores/model';
import { type Dispatch, type SetStateAction, type RefObject } from 'react';

export function useVideoExport({ saveCredits, musicCredits, exportAudio, exportCancelled, setExportProgress, exportCodec, exportContainer, exportSpeed, useHardware, exportFilename, sceneForPreview, setError, previewTransition, resolvedNextScene, displayAspect, previewLocalSeconds, project, activeSize, renderOverlays, position, videoScene, sceneVideo, renderPipScenes, activeFormat, setNotice, latestProject, presentRefs, exportCodecs, commitElement, inspectorFlush, pending, exportFormatIds, exportResolution, exportQuality, exportFps, setCancellingExport, setExporting, setExportElapsed, setExportJob, setPlaying, setModal }: {
  exportAudio: boolean;
  exportCancelled: RefObject<boolean>;
  setExportProgress: Dispatch<SetStateAction<number>>;
  exportCodec: bridge.ExportCodec;
  exportContainer: bridge.ExportContainer;
  exportSpeed: "fast" | "medium" | "slow";
  useHardware: boolean;
  exportFilename: (delivery: { formats: { name: string; presetId?: string | null; quality: string; width: number; height: number; }[]; slug?: string; }, includeFormat?: boolean) => string;
  sceneForPreview: Scene | null;
  setError: Dispatch<SetStateAction<string>>;
  previewTransition: { type: TransitionType; progress: number; next: Scene; } | null;
  resolvedNextScene: Scene | undefined;
  displayAspect: "16:9" | "9:16" | "1:1" | "4:5";
  previewLocalSeconds: number;
  project: Project;
  activeSize: { width: number; height: number; };
  renderOverlays: ElementLayer[];
  position: number;
  videoScene: Scene | null;
  sceneVideo: RefObject<HTMLVideoElement | null>;
  renderPipScenes: Scene[];
  activeFormat: FormatVariant;
  setNotice: Dispatch<SetStateAction<string>>;
  saveCredits: boolean;
  musicCredits: string[];
  latestProject: RefObject<Project>;
  presentRefs: Set<string>;
  exportCodecs: bridge.ExportCodec[];
  commitElement: () => void;
  inspectorFlush: RefObject<() => void>;
  pending: RefObject<Promise<boolean>>;
  exportFormatIds: string[];
  exportResolution: string;
  exportQuality: string;
  exportFps: string;
  setCancellingExport: Dispatch<SetStateAction<boolean>>;
  setExporting: Dispatch<SetStateAction<boolean>>;
  setExportElapsed: Dispatch<SetStateAction<number>>;
  setExportJob: Dispatch<SetStateAction<{ name: string; phase: string; }>>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  setModal: Dispatch<SetStateAction<"source" | "templates" | "export" | "new" | "shortcuts" | "palette" | "settings" | "delete" | "rename" | "group" | "groups" | "formats" | "missing" | null>>;
}) {
  /** Writes `<video>-credits.txt` beside each exported video when the project uses music that needs a credit. */
  async function writeCredits(paths: string[], name: string) {
    if (!saveCredits || !exportAudio || !musicCredits.length) return;
    const text = creditsFileText(name, musicCredits);
    for (const path of paths) {
      try { await bridge.saveCreditsFile(path, text); } catch (e) { setError(messageFor(e)); return; }
    }
  }

  async function saveStillFrame() {
    if (!sceneForPreview) { setError('Add a scene before saving a still frame.'); return; }
    try {
      await document.fonts.ready;
      const canvas = document.createElement('canvas');
      if (previewTransition && resolvedNextScene) {
        await drawTransition(canvas, sceneForPreview, resolvedNextScene, previewTransition.type, displayAspect, 'export', previewTransition.progress, previewLocalSeconds, 0, project.timebase, activeSize, project.audio);
        await drawProjectOverlays(canvas, renderOverlays, position, project.timebase, true, project.audio);
      } else {
        await drawScene(canvas, sceneForPreview, displayAspect, 'export', previewLocalSeconds, project.timebase, activeSize, videoScene ? sceneVideo.current : null, project.audio, renderOverlays, position);
      }
      await drawPipClips(canvas, renderPipScenes, position, displayAspect, 'export', project.timebase, project.audio, true);
      await drawProjectText(canvas, project.globalText ?? [], position, project.timebase);
      const saved = await bridge.saveStillFrame(await canvasPng(canvas), `${project.name} - ${activeFormat?.name ?? 'Original'}`);
      if (saved) setNotice(`Still frame saved at ${activeSize.width} × ${activeSize.height}. The preview, overlays and colour match the timeline.`);
    } catch (error) {
      setError(messageFor(error));
    }
  }

  async function exportVideo() {
    if (missingAssets(latestProject.current, presentRefs).length) { setError('Relink missing media before exporting this project.'); return; }
    if (!exportCodecs.includes(exportCodec)) { setError('Choose an available video codec before exporting.'); return; }
    commitElement(); inspectorFlush.current();
    await pending.current;
    const snapshot = structuredClone(latestProject.current);
    const visualAudio = snapshot.audio;
    snapshot.audio = exportAudio ? [...snapshot.audio, ...actionAudio(snapshot)] : [];
    const selectedFormats = snapshot.formats.filter(format => exportFormatIds.includes(format.id)).map(format => exportOutputFormat(format, exportResolution, exportQuality, exportFps));
    if (!selectedFormats.length) { setError('Choose at least one output format.'); return; }
    // Several social formats often share one render. Encode it once and name
    // the file for every platform it covers.
    const outputs = groupFormatsByOutput(selectedFormats);
    exportCancelled.current = false; setCancellingExport(false);
    setExporting(true); setExportProgress(1); setExportElapsed(0); setExportJob({ name: snapshot.name, phase: 'Preparing frames' }); setPlaying(false); setError(''); setModal(current => current === 'export' ? null : current);
    try {
      await document.fonts.ready;
      if (projectScenes(snapshot).some(scene => scene.mediaKind === 'video')) {
        const progressRef = { count: 0, total: Math.max(1, outputs.reduce((sum, output) => sum + resolveScenesForFormat(projectScenes(snapshot), output.formats[0]).reduce((n, scene, i, list) => n + (scene.mediaKind === 'video' ? scene.durationTicks : exportBoundaries(scene, snapshot.timebase, Boolean(list[i + 1]), snapshot.overlays).length - 1), 0), 0)) };
        const jobs: bridge.ExportPlan[] = [];
        for (const output of outputs) jobs.push(await buildVideoPlan({ exportAudio, exportCancelled, setExportProgress, exportCodec, exportContainer, exportSpeed, useHardware, exportFilename }, output.formats[0], progressRef, snapshot, visualAudio, exportAudio, output.formats, output.slug));
        setExportProgress(72); setExportJob(current => ({ ...current, phase: 'Choose destination / starting encoder' }));
        const paths = await bridge.exportPlanVariants(snapshot.id, jobs, snapshot);
        if (paths.length) {
          await writeCredits(paths, snapshot.name);
          setExportProgress(100);
          setNotice(`${paths.length} video${paths.length === 1 ? '' : 's'} exported. Files stay on this device.`);
          setModal(current => current === 'export' ? null : current);
        }
        return;
      }
      const plans = outputs.map(output => {
        const format = output.formats[0];
        const formatScenes = resolveScenesForFormat(projectScenes(snapshot), format);
        const segments: { scene: Scene; next?: Scene; startTicks: number; durationTicks: number }[] = [];
        for (let sceneIndex = 0; sceneIndex < formatScenes.length; sceneIndex++) {
          const scene = formatScenes[sceneIndex];
          const next = formatScenes[sceneIndex + 1];
          const points = exportBoundaries(scene, snapshot.timebase, Boolean(next), snapshot.overlays);
          for (let index = 0; index < points.length - 1; index++) {
            const durationTicks = points[index + 1] - points[index];
            if (durationTicks > 0) segments.push({ scene, next, startTicks: points[index], durationTicks });
          }
        }
        return { format, formats: output.formats, slug: output.slug, segments };
      });
      const totalSegments = plans.reduce((sum, plan) => sum + plan.segments.length, 0);
      if (!totalSegments) throw new Error('Add at least one photo before exporting.');
      const jobs: bridge.ExportJob[] = [];
      let rendered = 0;
      for (const plan of plans) {
        const frames: string[] = [], durations: number[] = [];
        const size = formatSize(plan.format);
        for (const segment of plan.segments) {
          const canvas = document.createElement('canvas');
          const localTicks = segment.startTicks;
          const localSeconds = ticksToSeconds(localTicks, snapshot.timebase);
          const transition = segment.scene.transition && segment.next ? segment.scene.transition : null;
          const transitionStart = transition ? segment.scene.durationTicks - secondsToTicks(transition.duration, snapshot.timebase) : 0;
          const projectSeconds = ticksToSeconds(segment.scene.startTicks + localTicks, snapshot.timebase);
          if (transition && segment.next && localTicks >= transitionStart) {
            const progress = Math.min(1, (localTicks - transitionStart) / Math.max(1, secondsToTicks(transition.duration, snapshot.timebase)));
            await drawTransition(canvas, segment.scene, segment.next, transition.type, snapshot.aspect, 'export', progress, localSeconds, 0, snapshot.timebase, size, visualAudio);
            // Transitions blend two scenes, so overlays stay on top for their duration — the same boundary as the preview.
            await drawProjectOverlays(canvas, snapshot.overlays, projectSeconds, snapshot.timebase, true, visualAudio);
          } else {
            await drawScene(canvas, segment.scene, snapshot.aspect, 'export', localSeconds, snapshot.timebase, size, undefined, visualAudio, snapshot.overlays, projectSeconds);
            await drawPipClips(canvas, overlayScenes(snapshot), projectSeconds, snapshot.aspect, 'export', snapshot.timebase, visualAudio, true);
            await drawProjectText(canvas, snapshot.globalText ?? [], projectSeconds, snapshot.timebase);
          }
          frames.push(await canvasPng(canvas));
          await new Promise(resolve => setTimeout(resolve, 0));
          durations.push(segment.durationTicks);
          rendered += 1;
          if (exportCancelled.current) throw new Error('Export cancelled.');
          setExportProgress(Math.round(2 + rendered / totalSegments * 66));
        }
        jobs.push({ frames, durations, options: { width: size.width, height: size.height, fps: plan.format.fps, codec: exportCodec, container: exportContainer, speed: exportSpeed, hardware: useHardware, crf: EXPORT_CODEC_CRF[exportCodec][plan.format.quality], filename: exportFilename({ formats: plan.formats, slug: plan.slug }, outputs.length > 1) } });
      }
      setExportProgress(72); setExportJob(current => ({ ...current, phase: 'Choose destination / starting encoder' }));
      const paths = await bridge.exportVariants(snapshot.id, jobs, snapshot);
      if (paths.length) {
        await writeCredits(paths, snapshot.name);
        setExportProgress(100);
        setNotice(`${paths.length} video${paths.length === 1 ? '' : 's'} exported. Files stay on this device.`);
        setModal(current => current === 'export' ? null : current);
      }
    } catch (e) {
      if (/cancel/i.test(e instanceof Error ? e.message : String(e))) {
        setNotice('Export cancelled. No file was written.');
      } else {
        setError(messageFor(e));
      }
      setExportProgress(0);
    } finally { setExporting(false); setCancellingExport(false); }
  }

  return { saveStillFrame, exportVideo };
}
