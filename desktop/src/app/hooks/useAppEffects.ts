import { useEffect, useState } from 'react';
import * as bridge from '../bridge';
import { t, type Locale } from '../../i18n';
import { messageFor } from '../errors';
import { registerCustomFonts } from '../../components/text/fonts';
import { classifyDrop, countMissingAssets } from '../home-support';
import { getLibraryProject, type ProjectSummary } from '../../stores/library';
import { projectAssetRefs } from '../../stores/missing-assets';
import { assetExists } from '../../stores/assets';
import { overlayScenes, audioLaneGain, type AudioClip, type AudioMix, type Scene, type Session, type TextLayer } from '../../stores/model';
import { duckGain } from '../../components/preview/ducking';
import { syncAudioElement } from '../../components/preview/audio';
import { applyClipEq } from '../../components/preview/eq';
import { sceneTextLayers } from '../../components/text/layers';
import { clampWeight, fontOption } from '../../components/text/fonts';
import type { ModalId } from '../modal';
import { type Preferences } from '../../stores/preferences';
import type { SettingsTab } from '../modals/SettingsModal';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { Project } from '../../stores/model';
import type { DuckWindow } from '../../components/preview/ducking';

export function useAppEffects({ adoptProject, audio, audioDraftRef, audioElements, audioMix, canEdit, commandRef, cueAudio, duration, endBatch, frameSeconds, fullscreenRef, homeSection, importFiles, importVideos, language, latestProject, libraryReady, mixDraftRef, modal, openProjectFile, persistCurrent, pipDraftRef, playDirection, playing, position, preferences, project, projects, ready, recordTimer, recorderRef, refreshAssetUsage, refreshDeleted, refreshLibrary, refreshStorage, scenes, screen, selectedAudioId, selectedPipId, selectedScene, selectedTextLayer, selectionAnchor, setAudioDraft, setBeatTempo, setError, setExportJob, setExportProgress, setExportSettings, setExporter, setFontTick, setMixDraft, setName, setPipDraft, setPosition, setPreviewScene, setPrimarySelected, setReady, setScreen, setSelectedAudioId, setSelectedIds, setSelectedPipId, setSelectedTextLayerId, setSession, setTextDraft, settingsTab, videoDuckWindows }: {
  adoptProject: (next: Session, message: string) => void;
  audio: AudioClip[];
  audioDraftRef: RefObject<AudioClip | null>;
  audioElements: RefObject<Map<string, HTMLAudioElement>>;
  audioMix: AudioMix;
  canEdit: boolean;
  commandRef: RefObject<(id: string) => void>;
  cueAudio: AudioClip[];
  duration: number;
  endBatch: () => void;
  frameSeconds: number;
  fullscreenRef: RefObject<() => void>;
  homeSection: "home" | "projects";
  importFiles: (files: FileList | File[] | null) => Promise<void>;
  importVideos: (files: FileList | File[] | null) => Promise<void>;
  language: Locale;
  latestProject: RefObject<Project>;
  libraryReady: boolean;
  mixDraftRef: RefObject<AudioMix | null>;
  modal: ModalId | null;
  openProjectFile: (file: File) => Promise<void>;
  persistCurrent: () => Promise<void>;
  pipDraftRef: RefObject<Scene | null>;
  playDirection: 1 | -1;
  playing: boolean;
  position: number;
  preferences: Preferences;
  project: Project;
  projects: ProjectSummary[];
  ready: boolean;
  recordTimer: RefObject<number | null>;
  recorderRef: RefObject<MediaRecorder | null>;
  refreshAssetUsage: () => Promise<void>;
  refreshDeleted: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  refreshStorage: () => void;
  scenes: Scene[];
  screen: "home" | "editor";
  selectedAudioId: string | null;
  selectedPipId: string | null;
  selectedScene: Scene | undefined;
  selectedTextLayer: TextLayer;
  selectionAnchor: RefObject<string | null>;
  setAudioDraft: Dispatch<SetStateAction<AudioClip | null>>;
  setBeatTempo: Dispatch<SetStateAction<number | null>>;
  setError: Dispatch<SetStateAction<string>>;
  setExportJob: Dispatch<SetStateAction<{ name: string; phase: string; }>>;
  setExportProgress: Dispatch<SetStateAction<number>>;
  setExportSettings: Dispatch<SetStateAction<{ name: string; version: string; includeQuality: boolean; includePreset: boolean; }>>;
  setExporter: Dispatch<SetStateAction<boolean>>;
  setFontTick: Dispatch<SetStateAction<number>>;
  setMixDraft: Dispatch<SetStateAction<AudioMix | null>>;
  setName: Dispatch<SetStateAction<string>>;
  setPipDraft: Dispatch<SetStateAction<Scene | null>>;
  setPosition: Dispatch<SetStateAction<number>>;
  setPreviewScene: Dispatch<SetStateAction<Scene | null>>;
  setPrimarySelected: Dispatch<SetStateAction<string | null>>;
  setReady: Dispatch<SetStateAction<boolean>>;
  setScreen: Dispatch<SetStateAction<"home" | "editor">>;
  setSelectedAudioId: Dispatch<SetStateAction<string | null>>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPipId: Dispatch<SetStateAction<string | null>>;
  setSelectedTextLayerId: Dispatch<SetStateAction<string | null>>;
  setSession: Dispatch<SetStateAction<Session>>;
  setTextDraft: Dispatch<SetStateAction<{ title: string; subtitle: string; }>>;
  settingsTab: SettingsTab;
  videoDuckWindows: DuckWindow[];
}) {
  useEffect(() => { bridge.initialize().then(s => { setSession(s); latestProject.current = s.project; setName(s.project.name); }).catch(e => setError(t('Recovery could not be loaded. {e}', { e: messageFor(e) }))).finally(() => setReady(true)); bridge.exporterAvailable().then(setExporter).catch(() => setExporter(false)); }, []);
  useEffect(() => { const listener = bridge.onExportProgress(percent => { setExportJob(job => ({ ...job, phase: 'Encoding video' })); setExportProgress(current => Math.max(current, 72 + Math.round(Math.min(99, percent) * .27))); }); return () => { void listener?.then(unlisten => unlisten()); }; }, []);
  useEffect(() => {
    if (!bridge.native) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const adopt = () => {
      void (async () => {
        try {
          await persistCurrent();
          const next = await bridge.takePendingProject();
          if (!disposed && next) adoptProject(next, 'Project opened from your device.');
        } catch (e) { if (!disposed) setError(messageFor(e)); }
      })();
    };
    const subscription = bridge.onProjectOpened(adopt);
    void (async () => {
      if (subscription) {
        const fn = await subscription;
        if (disposed) fn();
        else unlisten = fn;
      }
      if (!disposed) adopt();
    })();
    return () => { disposed = true; unlisten?.(); };
  }, [persistCurrent]);
  useEffect(() => {
    if (!bridge.native) return;
    let unlisten: (() => void) | undefined, cancelled = false;
    void bridge.onMenu(id => {
      if (id === 'view.home') { setScreen('home'); return; }
      if (id === 'view.fullscreen') { fullscreenRef.current(); return; }
      commandRef.current(id);
    })?.then(fn => {
      if (!fn) return;
      if (cancelled) fn(); else unlisten = fn;
    }).catch(() => { /* the editor keeps working without menus */ });
    return () => { cancelled = true; unlisten?.(); };
  }, []);

  useEffect(() => {
    registerCustomFonts(project.fonts, () => setFontTick(value => value + 1));
  }, [project.fonts]);


  useEffect(() => {
    if (!bridge.native || modal !== 'settings' || settingsTab !== 'privacy') return;
    void refreshAssetUsage();
  }, [modal, settingsTab]);

  useEffect(() => { void refreshLibrary(); }, [refreshLibrary]);
  useEffect(() => {
    void bridge.setAppMenu(language).catch(() => { /* the native menu is optional in the browser preview */ });
  }, [language]);
  useEffect(() => { if (screen === 'home') { void refreshLibrary(); refreshStorage(); } }, [screen, refreshLibrary]);
  useEffect(() => { if (screen !== 'home' || homeSection !== 'projects') endBatch(); }, [screen, homeSection]);
  useEffect(() => { if (screen === 'home' && libraryReady) void refreshDeleted(); }, [screen, libraryReady]);
  // Browser preview: files dropped on Home open a project or start a photo movie, like the native window does.
  useEffect(() => {
    if (bridge.native || screen !== 'home') return;
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
    const over = (event: DragEvent) => { if (hasFiles(event)) event.preventDefault(); };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      const action = classifyDrop(Array.from(event.dataTransfer?.files ?? []));
      if (action.kind === 'project') void openProjectFile(action.file);
      else if (action.kind === 'images' || action.kind === 'videos') {
        const transfer = new DataTransfer();
        action.files.forEach(file => transfer.items.add(file));
        void (action.kind === 'images' ? importFiles(transfer.files) : importVideos(transfer.files));
      } else setError(t('Drop photos, videos or a .pixcut project file.'));
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('drop', drop); };
  }, [screen, canEdit, project.id]);
  const [missingCounts, setMissingCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (screen !== 'home' || !libraryReady) return;
    let cancelled = false;
    void countMissingAssets(projects, { load: getLibraryProject, refsOf: projectAssetRefs, nativeMissing: bridge.native ? bridge.missingAssetRefs : null, exists: assetExists, isCancelled: () => cancelled })
      .then(found => { if (found) setMissingCounts(found); });
    return () => { cancelled = true; };
  }, [screen, libraryReady, projects.map(entry => `${entry.id}:${entry.updatedAt}`).join('|')]);
  useEffect(() => {
    if (!ready) return;
    const timeout = setTimeout(() => { void persistCurrent(); }, preferences.autosaveMs);
    return () => clearTimeout(timeout);
  }, [project, ready, persistCurrent, preferences.autosaveMs]);
  useEffect(() => {
    if (selectedPipId && !overlayScenes(project).some(clip => clip.id === selectedPipId)) {
      setSelectedPipId(null); setPipDraft(null); pipDraftRef.current = null;
    }
  }, [project.tracks, selectedPipId]);
  useEffect(() => { audioDraftRef.current = null; setAudioDraft(null); setBeatTempo(null); }, [project.id, selectedAudioId]);
  useEffect(() => { mixDraftRef.current = null; setMixDraft(null); }, [project.id]);
  useEffect(() => {
    if (!project.audio.length) { setSelectedAudioId(null); return; }
    setSelectedAudioId(id => id && project.audio.some(clip => clip.id === id) ? id : project.audio[0].id);
  }, [project.audio]);
  useEffect(() => {
    const duck = duckGain(position, videoDuckWindows, project.ducking ?? 0);
    for (const clip of audio) {
      const element = audioElements.current.get(clip.id);
      if (!element) continue;
      syncAudioElement(element, clip, position, playing && playDirection > 0, project.timebase, undefined, duck * audioLaneGain({ audioMix }, clip.lane ?? 0));
      applyClipEq(element, clip);
    }
    for (const clip of cueAudio) {
      const element = audioElements.current.get(clip.id);
      if (!element) continue;
      syncAudioElement(element, clip, position, playing && playDirection > 0, project.timebase);
    }
  }, [position, playing, playDirection, audio, cueAudio, project.timebase, videoDuckWindows, project.ducking, audioMix]);
  useEffect(() => () => { for (const element of audioElements.current.values()) element.pause(); recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop(); if (recordTimer.current) clearInterval(recordTimer.current); }, []);
  useEffect(() => { setName(project.name); }, [project.name]);
  useEffect(() => { if (modal === 'export') setExportSettings(current => ({ ...current, name: project.name, version: 'v1' })); }, [modal, project.id]);
  useEffect(() => {
    const layers = selectedScene ? sceneTextLayers(selectedScene) : [];
    setSelectedTextLayerId(id => id && layers.some(layer => layer.id === id) ? id : layers[0]?.id ?? null);
    setPreviewScene(null);
  }, [selectedScene?.id, selectedScene?.textLayers]);
  useEffect(() => {
    if (selectedTextLayer) setTextDraft({ title: selectedTextLayer.title, subtitle: selectedTextLayer.subtitle });
  }, [selectedTextLayer?.id]);
  useEffect(() => {
    if (!selectedTextLayer) return;
    const style = selectedTextLayer.fontStyle === 'italic' ? 'italic ' : '';
    const font = `${style}${clampWeight(selectedTextLayer.fontWeight, selectedTextLayer.font)} 32px ${fontOption(selectedTextLayer.font).family}`;
    let cancelled = false;
    void document.fonts.load(font, `${selectedTextLayer.title.slice(0, 20)}Aa`).then(() => { if (!cancelled) setFontTick(value => value + 1); }).catch(() => {});
    return () => { cancelled = true; };
  }, [selectedTextLayer?.id, selectedTextLayer?.font, selectedTextLayer?.fontWeight, selectedTextLayer?.fontStyle, selectedTextLayer?.title]);
  useEffect(() => {
    setSelectedIds(ids => {
      const next = ids.filter(id => scenes.some(scene => scene.id === id));
      return next.length === ids.length ? ids : next;
    });
    setPrimarySelected(id => id && scenes.some(scene => scene.id === id) ? id : null);
    if (selectionAnchor.current && !scenes.some(scene => scene.id === selectionAnchor.current)) selectionAnchor.current = null;
  }, [scenes]);
  useEffect(() => { setPosition(t => Math.min(t, Math.max(0, duration - frameSeconds))); }, [duration, frameSeconds]);

  return { missingCounts, setMissingCounts };
}
