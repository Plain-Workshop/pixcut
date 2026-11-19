import { t } from '../../i18n';
import * as bridge from '../bridge';
import { formatSlug } from '../../stores/formats';
import { useVideoExport } from './useVideoExport';
import { type MissingAsset } from '../../stores/missing-assets';
import type { ModalId } from '../modal';
import { type Project, type Scene, type FormatVariant, type ElementLayer } from '../../stores/model';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { TransitionType } from '../../stores/model';

export function useExportFlow({ activeFormat, activeSize, commitElement, displayAspect, exportAudio, exportCancelled, exportCodec, exportCodecs, exportContainer, exportFormatIds, exportFps, exportQuality, exportResolution, exportSettings, exportSpeed, inspectorFlush, latestProject, missing, musicCredits, pending, position, presentRefs, previewLocalSeconds, previewTransition, project, renderOverlays, renderPipScenes, resolvedNextScene, saveCredits, sceneForPreview, sceneVideo, setCancellingExport, setError, setExportCodecs, setExportElapsed, setExportFormatIds, setExportHardware, setExportJob, setExportProgress, setExporting, setHardwareAvailable, setModal, setNotice, setPlaying, useHardware, videoScene }: {
  activeFormat: FormatVariant;
  activeSize: { width: number; height: number; };
  commitElement: () => void;
  displayAspect: "16:9" | "9:16" | "1:1" | "4:5";
  exportAudio: boolean;
  exportCancelled: RefObject<boolean>;
  exportCodec: bridge.ExportCodec;
  exportCodecs: bridge.ExportCodec[];
  exportContainer: bridge.ExportContainer;
  exportFormatIds: string[];
  exportFps: string;
  exportQuality: string;
  exportResolution: string;
  exportSettings: { name: string; version: string; includeQuality: boolean; includePreset: boolean; };
  exportSpeed: "fast" | "medium" | "slow";
  inspectorFlush: RefObject<() => void>;
  latestProject: RefObject<Project>;
  missing: MissingAsset[];
  musicCredits: string[];
  pending: RefObject<Promise<boolean>>;
  position: number;
  presentRefs: Set<string>;
  previewLocalSeconds: number;
  previewTransition: { type: TransitionType; progress: number; next: Scene; } | null;
  project: Project;
  renderOverlays: ElementLayer[];
  renderPipScenes: Scene[];
  resolvedNextScene: Scene | undefined;
  saveCredits: boolean;
  sceneForPreview: Scene | null;
  sceneVideo: RefObject<HTMLVideoElement | null>;
  setCancellingExport: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setExportCodecs: Dispatch<SetStateAction<bridge.ExportCodec[]>>;
  setExportElapsed: Dispatch<SetStateAction<number>>;
  setExportFormatIds: Dispatch<SetStateAction<string[]>>;
  setExportHardware: Dispatch<SetStateAction<boolean>>;
  setExportJob: Dispatch<SetStateAction<{ name: string; phase: string; }>>;
  setExportProgress: Dispatch<SetStateAction<number>>;
  setExporting: Dispatch<SetStateAction<boolean>>;
  setHardwareAvailable: Dispatch<SetStateAction<boolean>>;
  setModal: Dispatch<SetStateAction<ModalId | null>>;
  setNotice: Dispatch<SetStateAction<string>>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  useHardware: boolean;
  videoScene: Scene | null;
}) {
  function openExportModal() {
    if (missing.length) { setError(t('Relink missing media before exporting this project.')); return; }
    void bridge.exporterCapabilities().then(setExportCodecs).catch(() => setExportCodecs([]));
    void bridge.exporterHardware().then(available => {
      setHardwareAvailable(available);
      if (!available) setExportHardware(false);
    }).catch(() => setHardwareAvailable(false));
    setPlaying(false);
    setExportFormatIds(project.formats.map(format => format.id));
    setModal('export');
  }

  /**
   * One file can serve several social formats. When that happens the name lists
   * every platform it covers, e.g. `Story - insta-story+tiktok+fb-reels - 1080x1920.mp4`.
   */
  function exportFilename(delivery: { formats: { name: string; presetId?: string | null; quality: string; width: number; height: number }[]; slug?: string }, includeFormat = false) {
    const formats = delivery.formats;
    const first = formats[0];
    const combined = formats.length > 1;
    const name = exportSettings.name.trim() || project.name || 'PixCut project';
    if (combined && first) {
      // Compact delivery: Story-v1-yt-ig-tt-fb-sc-1080x1920.mp4
      const tokens: [string, number][] = [[name, 48], [exportSettings.version.trim(), 16], [delivery.slug ?? formats.map(format => formatSlug(format)).join('-'), 40], [`${first.width}x${first.height}`, 12]];
      return `${tokens.filter(([token]) => token).map(([token, limit]) => token.replace(/\s+/g, '-').slice(0, limit)).join('-')}.${exportContainer}`;
    }
    const parts = [name];
    if (exportSettings.version.trim()) parts.push(exportSettings.version.trim());
    if (first && (includeFormat || exportSettings.includePreset)) parts.push(first.name);
    if (first && exportSettings.includeQuality) parts.push(first.quality === 'draft' ? 'Draft' : first.quality === 'high' ? 'High quality' : 'Standard');
    return `${parts.join(' - ')}.${exportContainer}`;
  }

  /**
   * A hidden video element that can be seeked frame by frame. Transitions need
   * the outgoing clip's real frames, not its poster, so the planner decodes the
   * last few frames here and blits them into the same canvas the preview uses.
   */
  const { saveStillFrame, exportVideo } = useVideoExport({ saveCredits, musicCredits, exportAudio, exportCancelled, setExportProgress, exportCodec, exportContainer, exportSpeed, useHardware, exportFilename, sceneForPreview, setError, previewTransition, resolvedNextScene, displayAspect, previewLocalSeconds, project, activeSize, renderOverlays, position, videoScene, sceneVideo, renderPipScenes, activeFormat, setNotice, latestProject, presentRefs, exportCodecs, commitElement, inspectorFlush, pending, exportFormatIds, exportResolution, exportQuality, exportFps, setCancellingExport, setExporting, setExportElapsed, setExportJob, setPlaying, setModal });


  function cancelExport() {
    exportCancelled.current = true;
    setCancellingExport(true);
    bridge.cancelExport().catch(() => { /* the export promise reports the outcome */ });
  }

  return { openExportModal, exportFilename, saveStillFrame, exportVideo, cancelExport };
}
