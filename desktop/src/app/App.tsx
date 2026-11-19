import { useAppearanceEffects } from './hooks/useAppearanceEffects';
import { usePreferenceActions } from './hooks/usePreferenceActions';
import { useSceneDerived } from './hooks/useSceneDerived';
import { useAppEffects } from './hooks/useAppEffects';
import { useCommandDispatch } from './hooks/useCommandDispatch';
import { useShortcutHelpers } from './hooks/useShortcutHelpers';
import { usePreviewPlayback } from './hooks/usePreviewPlayback';
import { useProjectStarts } from './hooks/useProjectStarts';
import { useFontsAndCaptions } from './hooks/useFontsAndCaptions';
import { useProjectFiles } from './hooks/useProjectFiles';
import { useExportFlow } from './hooks/useExportFlow';
import { useTextAndElements } from './hooks/useTextAndElements';
import { creditForClipName } from '../stores/music-library';
import { SOUND_EFFECTS, type SoundEffectId } from '../components/elements/sound-effects';
import { creditForRecordedClip, loadRecordedSounds, type RecordedSound } from '../stores/sound-library';
import { ElementTextField } from '../components/elements/ElementTextField';
import { inspectorKind } from './inspector';
import { presetSize } from '../components/elements/designer';
import { ClipContextMenu } from './parts/ClipContextMenu';
import { Toast, ErrorBanner, ExportJobCard } from './parts/Notices';
import { BehaviorControls } from '../components/elements/BehaviorControls';
import { ELEMENT_CATALOG, elementPreset, elementDisplayName } from '../components/elements/catalog';
import { exportOutputFormat } from './export-progress';






import { KeyframeControls } from '../components/animation/KeyframeControls';
import { isAssetRef, resolveMediaSource } from '../components/preview/media-url';
import { assetExists } from '../stores/assets';

import { MaskControls } from '../components/inspector/MaskControls';
import { ChromaControls } from '../components/inspector/ChromaControls';



import { type TimelineOverlay } from '../components/elements/overlays';
import { newOverlayZ } from '../components/elements/stack';
import { StackOrder } from '../components/inspector/StackOrder';
import { actionAudio } from '../components/elements/sound';

import { LatestRenderQueue } from '../components/preview/render-queue';
import { loadMediaBin, saveMediaBin, uniqueMediaSources } from '../stores/media-bin';
import { missingAssets, projectAssetRefs } from '../stores/missing-assets';

import { formatCount, isLocale, mediaFileCount, sceneCount, setLocale, t, loadLocale, type Locale } from '../i18n';

import { audibleVideoWindows } from '../components/preview/ducking';
import { AudioSource } from '../components/preview/AudioSource';
import { useUpdates } from './hooks/useUpdates';
import { SelectionProvider, useCreateSelectionStore, useSelection } from './selection-store';
import { ExportProvider, effectiveHardware, useCreateExportStore, useExportSettings } from './export-store';
import { DraftsProvider, useCreateDraftsStore, useDrafts } from './drafts-store';
import { LibraryProvider, useCreateLibraryStore, useLibraryState } from './library-store';
import { LayoutProvider, useCreateLayoutStore, useLayout } from './layout-store';
import { EditorModelProvider } from './editor-model';
import { EditorViewProvider, useEditorViewModel } from './editor-view';
import { EditorActionsProvider, type EditorActions } from './editor-actions';
import { RangeField } from '../components/inspector/NumberField';
import { useClipEditing } from './hooks/useClipEditing';

import { type TimelineControls } from './screens/TimelinePanel';

import { useSceneCommands } from './hooks/useSceneCommands';
import { useLibraryAudio } from './hooks/useLibraryAudio';
import { useStagePointer } from './hooks/useStagePointer';

import { useSourcePreview } from './hooks/useSourcePreview';
import { useProjectLibrary } from './hooks/useProjectLibrary';
import { ELEMENT_LABEL_DEFAULTS } from '../components/elements/symbols';
import { Suspense, useCallback, useMemo, useEffect, useRef, useState, type DragEvent as ReactDragEvent } from 'react';
import {
  AudioLines, 
  AlertTriangle,
  Check,
  
  
  
  
  
  
  
  
  
  
  
  Clapperboard,
  
  Command as 
  Copy,
  Download,
  
  FolderOpen,
  
  
  
  
  
  Layers,
  Link as LinkIcon,
  
  
  
  
  
  
  
  Magnet,
  
  MoreHorizontal,
  Music,
  Mic,
  
  Pencil,
  Play,
  
  Plus,
  
  
  RotateCcw,
  
  
  
  
  
  
  
  Sparkles,
  Square,
  
  Star,
  
  Trash2,
  
  
  
  
  
  
  
  
  X,
  
  
  
} from 'lucide-react';
import { ElementPreview } from '../components/elements/ElementPreview';
import { animationSelection, isContinuousMotion, ELEMENT_ANIMATIONS } from '../components/elements/motion';
import { IconButton } from '../components/IconButton';
import { CommandPalette } from '../components/shortcuts/CommandPalette';
import { ShortcutHelp } from '../components/shortcuts/ShortcutHelp';
import * as bridge from './bridge';
import type { ModalId } from './modal';
import { buildDiagnostics } from './home-support';
import { runCommand } from './command-runner';
import { HINTS_KEY } from './export-options';
import { audioMixOf, videoAudioGain, edit, emptyProject, projectScenes, secondsPerTick, secondsToTicks, ticksToSeconds, timecode, totalDuration, totalTicks, type AudioClip, type AudioMix, type Command, type Scene, type Session, type TextLayer, type FormatVariant, type ElementLayer } from '../stores/model';
import { loadImage } from '../components/preview/render';
import { probeVideo } from '../components/preview/video';


import { FORMAT_FILTERS, FORMAT_PRESETS, filterFormatGroups, formatSize, groupFormatsByOutput } from '../stores/formats';
import { messageFor } from './errors';
import { formatBytes, hasMedia, relativeTime, sortProjects } from './helpers';
import { backfillThumbnails, exportState, listProjects, saveLibraryProject, type ProjectSummary } from '../stores/library';
import { loadPreferences, resolveTheme, type Preferences } from '../stores/preferences';
import { TEMPLATES, templatePreview, type TemplateDefinition } from '../templates/catalog';
import {
  COMMANDS,
  bindingMatchesEvent,
  detectPlatform,
  
  isTextEntryTarget,
  loadShortcutSettings,
  type ShortcutSettings as ShortcutSettingsData,
} from '../shortcuts/registry';
import '../styles/styles.css';
import type { SettingsTab } from './modals/SettingsModal';
import { ExportModal, FormatsModal, NewProjectModal, SettingsModal, SourceModal, TemplatesModal } from './modals/lazy';
import { MissingMediaModal } from './modals/MissingMediaModal';
import { DeleteProjectModal } from './modals/DeleteProjectModal';
import { GroupsModal } from './modals/GroupsModal';
import { GroupModal } from './modals/GroupModal';
import { RenameProjectModal } from './modals/RenameProjectModal';
import { TimelinePanel } from './screens/TimelinePanel';
import { LibraryPanel } from './screens/LibraryPanel';
import { PreviewPanel } from './screens/PreviewPanel';
import { InspectorPanel } from './screens/InspectorPanel';
import { EditorHeader } from './screens/EditorHeader';
import { HomeMain } from './screens/HomeMain';
import { ProjectThumb } from '../components/ProjectThumb';
import { HomeSidebar } from './screens/HomeSidebar';

import { useSceneReplacement } from './hooks/useSceneReplacement';
import { useAudioActions } from './hooks/useAudioActions';
import { useMediaImport } from './hooks/useMediaImport';
import { usePipLayers } from './hooks/usePipLayers';

const INITIAL: Session = { project: emptyProject(), canUndo: false, canRedo: false };

const RANGE_NAVIGATION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
// Codecs use different CRF scales; ProRes maps the value to a 422 profile.
const ELEMENT_COLORS = ['#9D7CFF', '#FF7A9E', '#FFD166', '#6BE7FF', '#7CF0B4', '#FFFFFF'];
const elementName = elementDisplayName;


export default function App() {
  const [session, setSession] = useState(INITIAL), [screen, setScreen] = useState<'home' | 'editor'>('home');
  const [homeSection, setHomeSection] = useState<'home' | 'projects'>('home');
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [playing, setPlaying] = useState(false);
  const selectionStore = useCreateSelectionStore();
  const { selectedIds, primarySelected, selectedAudioId, selectedElementId, selectedPipId, selectedTextLayerId, selectedGlobalTextId, editTarget, setSelectedIds, setPrimarySelected, setSelectedAudioId, setSelectedElementId, setSelectedPipId, setSelectedTextLayerId, setSelectedGlobalTextId, setEditTarget } = useSelection(selectionStore);
  const [position, setPosition] = useState(0);
  const [tab, setTab] = useState<'media' | 'text' | 'elements' | 'audio' | 'templates'>('media'), [modal, setModal] = useState<ModalId | null>(null);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  const [systemDark, setSystemDark] = useState(() => typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [language, setLanguage] = useState<Locale>(() => {
    try {
      const stored = localStorage.getItem('pixcut-language');
      return isLocale(stored) ? stored : 'en';
    } catch { return 'en'; }
  });
  const [storageUsage, setStorageUsage] = useState<bridge.AssetUsage | null>(null);
  const [storageBusy, setStorageBusy] = useState(false);
  const [storageConfirm, setStorageConfirm] = useState(false);
  const [storageNote, setStorageNote] = useState<string | null>(null);
  const [mediaBin, setMediaBin] = useState<{ projectId: string; items: Scene[] }>({ projectId: '', items: [] });
  const customElementInput = useRef<HTMLInputElement>(null);
  const customElementKind = useRef<'image' | 'video'>('image');
  const [exportElapsed, setExportElapsed] = useState(0);
  const [exportJob, setExportJob] = useState({ name: '', phase: 'Preparing frames' });
  const [hardwareAvailable, setHardwareAvailable] = useState(false);

  const [exportCodecs, setExportCodecs] = useState<bridge.ExportCodec[]>([]);
  const exportStore = useCreateExportStore();
  const { quality: exportQuality, codec: exportCodec, container: exportContainer, speed: exportSpeed, hardware: exportHardware, audio: exportAudio, saveCredits, resolution: exportResolution, fps: exportFps, formatIds: exportFormatIds, setFormatIds: setExportFormatIds, setHardware: setExportHardware } = useExportSettings(exportStore);
  const draftsStore = useCreateDraftsStore();
  const { previewScene, overlayDraft, pipDraft, audioDraft, setPreviewScene, setOverlayDraft, setPipDraft, setAudioDraft } = useDrafts(draftsStore);
  const overlayDraftRef = useRef<TimelineOverlay | null>(null);
  const [draggingOverlay, setDraggingOverlay] = useState(false);
  const [loop, setLoop] = useState(false);
  const [snapGuides, setSnapGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [templateQuery, setTemplateQuery] = useState('');
  const [templateCategory, setTemplateCategory] = useState<'All' | TemplateDefinition['category']>('All');
  const [pendingTemplate, setPendingTemplate] = useState<TemplateDefinition | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]), [libraryReady, setLibraryReady] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [librarySort, setLibrarySort] = useState<'recent' | 'name' | 'duration'>('recent');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [reorderId, setReorderId] = useState<string | null>(null);
  const [replacingSceneId, setReplacingSceneId] = useState<string | null>(null);
  const [fileDragActive, setFileDragActive] = useState(false);
  const [mixDraft, setMixDraft] = useState<AudioMix | null>(null);
  const [videoVolumeDraft, setVideoVolumeDraft] = useState<{ id: string; value: number } | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunks = useRef<Blob[]>([]);
  const recordTimer = useRef<number | null>(null);
  const [beatBusy, setBeatBusy] = useState(false), [beatTempo, setBeatTempo] = useState<number | null>(null);
  const [previewAudio, setPreviewAudio] = useState<AudioClip[] | null>(null);
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null);
  const [notice, setNotice] = useState(''), [error, setError] = useState(''), [exporter, setExporter] = useState(false), [exporting, setExporting] = useState(false), [exportProgress, setExportProgress] = useState(0), [status, setStatus] = useState('Saved');
  const [relinking, setRelinking] = useState<string | null>(null);
  const [exportSettings, setExportSettings] = useState({ name: '', version: 'v1', includeQuality: true, includePreset: true });
  const [cancellingExport, setCancellingExport] = useState(false);
  const exportCancelled = useRef(false);
  const [customFormatDraft, setCustomFormatDraft] = useState<{ name: string; width: number; height: number; fps: number; quality: 'draft' | 'standard' | 'high' }>({ name: '', width: 1080, height: 1080, fps: 30, quality: 'standard' });
  const [formatFilter, setFormatFilter] = useState('all');
  const [formatSection, setFormatSection] = useState<'social' | 'sizes' | 'custom'>('social');
  const [formatPlatform, setFormatPlatform] = useState('all');
  const [formatSearch, setFormatSearch] = useState('');
  const formatBrowserGroups = filterFormatGroups('all').filter(group => formatSection === 'social' ? !['Sizes', '4K Master'].includes(group.platform) && (formatPlatform === 'all' || group.platform === formatPlatform) : ['Sizes', '4K Master'].includes(group.platform)).map(group => ({ ...group, presets: group.presets.filter(preset => `${preset.name} ${preset.description} ${preset.platform}`.toLowerCase().includes(formatSearch.trim().toLowerCase())) })).filter(group => group.presets.length);
  const [newCustomFormats, setNewCustomFormats] = useState<FormatVariant[]>([]);
  const [newProjectFps, setNewProjectFps] = useState(30);
  const [videoTick, setVideoTick] = useState(0);
  const [pipVideoTick, setPipVideoTick] = useState(0);
  const [name, setName] = useState('Untitled story');
  const [editingText, setEditingText] = useState(false), [safeArea, setSafeArea] = useState(false);
  const [textDraft, setTextDraft] = useState({ title: '', subtitle: '' });
  const pipDraftRef = useRef<Scene | null>(null);
  const [globalTextDraft, setGlobalTextDraft] = useState<TextLayer[] | null>(null);
  const [textFocus, setTextFocus] = useState(0);
  const [activeFormatId, setActiveFormatId] = useState<string | null>(null);
  const [newFormatIds, setNewFormatIds] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('pixcut.lastFormats') ?? '[]');
      const known = Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string' && FORMAT_PRESETS.some(preset => preset.id === id)) : [];
      return known.length ? known : ['youtube-video'];
    } catch { return ['youtube-video']; }
  });
  // Mirrors startWithFormats() so the modal can preview how many files the
  // selection will actually produce.
  const newFormatSelection = [
    ...FORMAT_PRESETS.filter(preset => newFormatIds.includes(preset.id)).map(preset => ({ name: preset.name, presetId: preset.id, platform: preset.platform, width: preset.width, height: preset.height, fps: preset.fps, quality: preset.quality })),
    ...newCustomFormats,
  ];
  const newFormatOutputs = groupFormatsByOutput(newFormatSelection);
  const [framingMode, setFramingMode] = useState(false);
  const [, setFontTick] = useState(0);
  const [propertyClipboard, setPropertyClipboard] = useState<Partial<Scene> | null>(null);
  const [platform] = useState(detectPlatform);
  const [shortcuts, setShortcuts] = useState<ShortcutSettingsData>(() => loadShortcutSettings(platform));
  const [shortcutDirty, setShortcutDirty] = useState(false);
  const [showHints, setShowHints] = useState(() => loadPreferences().showHints && (() => { try { return localStorage.getItem(HINTS_KEY) !== '1'; } catch { return true; } })());
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [storageLabel, setStorageLabel] = useState('Checking local storage…');
  const [snapping, setSnapping] = useState(() => loadPreferences().snapping), [playDirection, setPlayDirection] = useState<1 | -1>(1);
  const [duckDraft, setDuckDraft] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [fadeDrag, setFadeDrag] = useState<{ sceneId: string; side: 'in' | 'out'; value: number } | null>(null);
  const layoutStore = useCreateLayoutStore();
  const libraryStore = useCreateLibraryStore();
  const { mediaQuery, audioLibraryTab, setHoveredMedia, setHoveredElement } = useLibraryState(libraryStore);
  const { timelineHeight, lockedLanes, beginResize, reset: resetLayout } = useLayout(layoutStore);
  const timelineControls = useRef<TimelineControls | null>(null);
  const clipEditing = useRef<ReturnType<typeof useClipEditing> | null>(null);

  const pending = useRef<Promise<boolean>>(Promise.resolve(true)), latestProject = useRef(INITIAL.project);
  const mediaInput = useRef<HTMLInputElement>(null), projectInput = useRef<HTMLInputElement>(null), replaceInput = useRef<HTMLInputElement>(null), audioInput = useRef<HTMLInputElement>(null), captionInput = useRef<HTMLInputElement>(null), fontInput = useRef<HTMLInputElement>(null), videoInput = useRef<HTMLInputElement>(null), sceneVideo = useRef<HTMLVideoElement>(null), preview = useRef<HTMLCanvasElement>(null), audioElements = useRef<Map<string, HTMLAudioElement>>(new Map()), previewArea = useRef<HTMLDivElement>(null), previewStage = useRef<HTMLDivElement>(null), operation = useRef(false);
  // Live picture-in-picture videos, keyed by clip id, plus the source each one
  // was last pointed at. Preview draws these directly instead of seeking.
  const pipVideoElements = useRef<Map<string, HTMLVideoElement>>(new Map()), pipVideoSources = useRef<Map<string, string>>(new Map());
  // A scene change (including the two halves a split creates) or a new source
  // gets one exact seek once the element has frames, so the clip starts on its
  // own in-point instead of inheriting the previous clip's drift.
  const videoSync = useRef<{ sceneId: string | null; needsSync: boolean }>({ sceneId: null, needsSync: false });
  // While a constant-speed video plays forward its media clock is the master:
  // the timeline follows `currentTime` instead of wall time, so a decoder stall
  // slows the playhead instead of triggering a catch-up seek (which looked like
  // a freeze and could repeat every half second).
  const videoClock = useRef<{ activeStart: number; sourceIn: number; speed: number; constant: boolean; duration: number; reverse: boolean; element: HTMLVideoElement } | null>(null);
  // The click that selects a clip updates these synchronously, so a Split
  // shortcut arriving before React has rendered still targets what was clicked.
  const editTargetRef = useRef<'scene' | 'text' | 'element' | 'audio'>('scene');
  const audioTargetRef = useRef<string | null>(null);
  const replaceTargetId = useRef<string | null>(null), inspectorFlush = useRef<() => void>(() => {}), audioDraftRef = useRef<AudioClip | null>(null), mixDraftRef = useRef<AudioMix | null>(null), videoVolumeDraftRef = useRef<{ id: string; value: number } | null>(null), fontTargetId = useRef<string | null>(null), audioLaneRef = useRef(0);
  const sceneQueue = useRef<Command[]>([]), previewQueue = useRef<LatestRenderQueue | null>(null), timelineScroll = useRef<HTMLDivElement>(null);
  const positionRef = useRef(0), closeModalRef = useRef<() => void>(() => {}), commandRef = useRef<(id: string) => void>(() => {}), fullscreenRef = useRef<() => void>(() => {});
  const selectionAnchor = useRef<string | null>(null), reorderRef = useRef<string | null>(null);
  const mediaDragRef = useRef<Scene | null>(null);
  const mediaDropAt = useRef(0);
  const [soundEffect, setSoundEffect] = useState<SoundEffectId>('click');
  const [recordedSounds,setRecordedSounds]=useState<RecordedSound[]>([]);
  useEffect(()=>{let live=true;void loadRecordedSounds().then(list=>{if(live)setRecordedSounds(list);});return()=>{live=false;};},[]);
  const [hoverEntrance,setHoverEntrance]=useState<string|null>(null);
  const [audioDisplay,setAudioDisplay]=useState<'spectrogram'|'waveform'>('spectrogram');

  useEffect(() => { if (!exporting) return; const start = performance.now(); const timer = setInterval(() => setExportElapsed((performance.now() - start) / 1000), 500); return () => clearInterval(timer); }, [exporting]);
  const project = session.project, duration = totalDuration(project);
  const scenes = projectScenes(project);
  // Streamed media keeps a reference in the project, so ask the local store
  // which references are still on disk before calling anything missing. New
  // references are treated as present until the check answers, so importing a
  // clip never flashes a missing-media banner.
  const [presentRefs, setPresentRefs] = useState<Set<string>>(() => new Set(projectAssetRefs(project)));
  useEffect(() => {
    const refs = projectAssetRefs(project);
    if (!refs.length) { setPresentRefs(new Set()); return; }
    if (!bridge.native) {
      let cancelled = false;
      setPresentRefs(current => new Set([...current, ...refs]));
      void Promise.all(refs.map(async reference => {
        try { return await assetExists(reference.slice('pixcut-asset:'.length)) ? reference : null; }
        catch { return null; }
      })).then(present => {
        if (cancelled) return;
        setPresentRefs(new Set(present.filter((value): value is string => Boolean(value))));
      });
      return () => { cancelled = true; };
    }
    setPresentRefs(current => new Set([...current, ...refs]));
    let cancelled = false;
    const timer = window.setTimeout(() => {
      bridge.missingAssetRefs(refs).then(missingRefs => {
        if (cancelled) return;
        setPresentRefs(current => {
          const next = new Set(current);
          for (const reference of missingRefs) next.delete(reference);
          return next;
        });
      }).catch(() => { /* keep optimistic presence; export still validates */ });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [project]);
  const missing = useMemo(() => missingAssets(project, presentRefs), [project, presentRefs]);
  const importedMedia = mediaBin.projectId === project.id ? mediaBin.items : [];
  const sourceMedia = useMemo(() => uniqueMediaSources(importedMedia, scenes), [importedMedia, scenes]);
  useEffect(() => {
    let cancelled = false;
    void loadMediaBin(project.id).then(items => { if (!cancelled) setMediaBin(current => current.projectId === project.id ? current : { projectId: project.id, items }); }).catch(error => { if (!cancelled) setError(messageFor(error)); });
    return () => { cancelled = true; };
  }, [project.id]);

  useEffect(() => {
    let depth = 0;
    const files = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
    const enter = (event: DragEvent) => { if (!files(event)) return; depth += 1; setFileDragActive(true); };
    const over = (event: DragEvent) => { if (files(event)) setFileDragActive(true); };
    const leave = (event: DragEvent) => { if (!files(event)) return; depth = Math.max(0, depth - 1); if (!depth) setFileDragActive(false); };
    const drop = () => { depth = 0; setFileDragActive(false); };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop, true);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop, true);
    };
  }, []);

  useEffect(() => {
    if (!bridge.native) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void bridge.onDragDrop(event => {
      if (disposed) return;
      if (event.type === 'leave') { setFileDragActive(false); setDropTarget(null); return; }
      if (reorderRef.current || Date.now() - mediaDropAt.current < 800) return;
      if (mediaDragRef.current) {
        if (event.type === 'drop') { const source = mediaDragRef.current; mediaDragRef.current = null; mediaDropAt.current = Date.now(); setFileDragActive(false); setDropTarget(null); if (nativeTimelineAt(event.position)) void appendMedia(source); }
        return;
      }
      setFileDragActive(true);
      const sceneId = nativeSceneAt(event.position);
      setDropTarget(sceneId);
      if (event.type !== 'drop') return;
      setFileDragActive(false); setDropTarget(null);
      const projectFile = screen === 'home' ? (event.paths ?? []).find(path => /\.pixcut$/i.test(path)) : undefined;
      if (projectFile) { void bridge.openProjectPath(projectFile).catch(e => setError(messageFor(e))); return; }
      const paths = (event.paths ?? []).filter(path => /\.(png|jpe?g|webp|mp4|m4v|mov|webm)$/i.test(path));
      if (!(event.paths?.length)) return;
      if (!paths.length) { setError(t('Drop a PNG, JPEG, WebP, MP4, MOV, M4V, or WebM file.')); return; }
      if (sceneId) void dropNativeOnScene(sceneId, paths);
      else void importNativePaths(paths);
    })?.then(fn => { if (disposed) fn(); else unlisten = fn; }).catch(() => {});
    return () => { disposed = true; unlisten?.(); };
  }, [project, preferences, screen]);

  const hasVideoScenes = scenes.some(scene => scene.mediaKind === 'video');
  const activeFormat = project.formats.find(format => format.id === activeFormatId) ?? project.formats[0];
  const activeSize = formatSize(activeFormat);
  const exportFormats = project.formats.map(format => exportOutputFormat(format, exportResolution, exportQuality, exportFps));
  const exportOutputs = groupFormatsByOutput(exportFormats.filter(format => exportFormatIds.includes(format.id)));
  const projectFormatOutputs = groupFormatsByOutput(project.formats);
  const useHardware = effectiveHardware({ hardware: exportHardware, codec: exportCodec }, hardwareAvailable);
  const displayAspect = project.aspect;
  const cueAudio = useMemo(() => actionAudio(project), [project]);
  const videoDuckWindows = useMemo(() => audibleVideoWindows(projectScenes(project), project.timebase, videoAudioGain({ audioMix: mixDraft ?? project.audioMix })), [project.tracks, project.timebase, project.audioMix, mixDraft]);
  const audioClips = previewAudio ?? project.audio;
  const musicCredits = [...new Set(project.audio.map(clip => clip.credit || creditForClipName(clip.name) || creditForRecordedClip(clip.name, recordedSounds)).filter((credit): credit is string => Boolean(credit)))];
  const audio = audioClips.map(clip => audioDraft?.id === clip.id ? audioDraft : clip);
  const selectedAudio = audioDraft ?? audio.find(clip => clip.id === selectedAudioId) ?? audio[0] ?? null;
  editTargetRef.current = editTarget;
  audioTargetRef.current = editTarget === 'audio' ? selectedAudio?.id ?? null : null;
  const audioMix = mixDraft ?? audioMixOf(project);
  const audioLanes = Array.from({ length: Math.max(0, ...audio.map(clip => clip.lane ?? 0)) + 1 }, (_, lane) => lane);
  const videoScenes = scenes.filter(scene => scene.mediaKind === 'video');
  const projectTicks = totalTicks(project);
  setLocale(language);
  const [, setLocaleReady] = useState(0);
  useEffect(() => { let live = true; void loadLocale(language).then(ok => { if (live && ok) setLocaleReady(value => value + 1); }); return () => { live = false; }; }, [language]);
  const timelineRatio = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  const frameSeconds = secondsPerTick(project.timebase);
  const view = useEditorViewModel({ project, position, playing, selectedIds, primarySelected, selectedGlobalTextId, selectedPipId, selectedTextLayerId, previewScene, pipDraft });
  const { active, activeStart, selectedScenes, selectedScene, selectedCount, hasSceneSelection, previewTarget, selectedGlobalText, selectedPip, renderPipScenes, pipVideoScenes, activePip, selectedTextLayer } = view;
  const pipVideoSignature = pipVideoScenes.map(clip => `${clip.id}:${clip.image.length}:${clip.videoPoster?.length ?? 0}:${clip.startTicks}:${clip.durationTicks}:${clip.sourceInTicks ?? 0}`).join('|');

  const { allOverlays, orderedLayers, layerNumbers, hasMediaOverlays, selectedElement, renderOverlays, sceneLayerStack, sceneLayerRank, inspectorScene, previewLocalSeconds, videoScene, textLayerLocal, textBox, selectedTextVisible, textStartTicks, previewTransition, framingStaged, sceneForPreview, resolvedNextScene } = useSceneDerived({ active, activeFormat, activeSize, activeStart, displayAspect, overlayDraft, position, previewScene, previewTarget, project, scenes, selectedElementId, selectedGlobalText, selectedScene, selectedTextLayer });

  const filteredScenes = sourceMedia.filter(s => s.name.toLowerCase().includes(mediaQuery.trim().toLowerCase()));

  const { sourcePreview, setSourcePreview, previewVideo, sourcePreviewUrl, previewMuted, setPreviewVideoDuration, setPreviewVideoTime, setPreviewVideoPlaying, previewList, previewIndex, previewVideoPlaying, previewVideoTime, previewVideoDuration, previewVolume, previewMedia, switchPreview, togglePreviewPlayback, seekPreview, changePreviewVolume, togglePreviewMute } = useSourcePreview({ modal, setModal, setPlaying, filteredScenes, sourceMedia });
  const canEdit = ready && !busy;

  const refreshLibrary = useCallback(async () => {
    try {
      const listed = await listProjects();
      setProjects(sortProjects(listed));
      void backfillThumbnails(listed).then(fixed => { if (fixed) setProjects(current => current.map(item => { const next = fixed.find(entry => entry.id === item.id); return next?.thumbnail && !item.thumbnail ? { ...item, thumbnail: next.thumbnail } : item; })); }).catch(() => {});
    }
    catch (e) { setError(t('Project library could not be read. {e}', { e: messageFor(e) })); }
    finally { setLibraryReady(true); }
  }, []);

  const { updatePreferences, movePlayhead, jumpToEdit, toggleSnapping, resetPreferences, refreshStorage, recheckExporter } = usePreferenceActions({ duration, frameSeconds, position, project, setError, setExporter, setNotice, setPlaying, setPosition, setPreferences, setShowHints, setSnapping, setStorageLabel });


  const { appVersion, updateState, updateInfo, updateProgress, updateMessage, checkForUpdates, downloadUpdate, restartUpdate, copyDownloadLink } = useUpdates({ automaticUpdates: preferences.automaticUpdates, home: screen === 'home', exporting, setNotice, saveBeforeUpdate: async () => { if (ready) await persistCurrent(); } });

  useAppearanceEffects({ language, modal, preferences, setStorageLabel, setSystemDark, settingsTab });


  function diagnostics() {
    return buildDiagnostics({ appVersion, buildSha: __BUILD_SHA__, buildDate: __BUILD_DATE__, native: bridge.native, platform, project: latestProject.current, exporter, preferences });
  }

  function copyDiagnostics() {
    const text = diagnostics();
    if (!navigator.clipboard) { setNotice(t('Clipboard access is unavailable in this preview.')); return; }
    navigator.clipboard.writeText(text).then(() => setNotice(t('Build diagnostics copied.'))).catch(error => setError(messageFor(error)));
  }

  const persistCurrent = useCallback(async () => {
    const current = latestProject.current;
    try {
      const summary = await saveLibraryProject(current);
      setProjects(list => summary
        ? sortProjects([summary, ...list.filter(item => item.id !== summary.id)])
        : list.filter(item => item.id !== current.id));
    } catch { /* recovery remains the source of truth if a thumbnail cannot be drawn */ }
  }, []);


  useEffect(() => {
    if (!modal) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [modal]);
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(t('')), 5000); return () => clearTimeout(id); }, [notice]);

  function optimisticScene(scene: Scene) {
    const before = latestProject.current;
    const next = edit(before, { type: 'update', scene });
    latestProject.current = next;
    setSession(current => ({ ...current, project: next }));
    return before;
  }

  const run = useCallback((command: Command): Promise<boolean> => runCommand(command, { operation, queue: sceneQueue, pending }, {
    dispatch: bridge.dispatch, applyOrder: bridge.applyOrder, edit,
    getProject: () => latestProject.current, setProject: next => { latestProject.current = next; },
    setSession, setBusy, stopPlayback: () => setPlaying(false), setStatus, setError, describeError: messageFor,
  }), []);

  usePreviewPlayback({ activeFormat, activeSize, audioMix, displayAspect, draggingOverlay, duration, frameSeconds, framingStaged, globalTextDraft, latestProject, loop, pipDraft, pipVideoElements, pipVideoScenes, pipVideoSignature, pipVideoSources, pipVideoTick, playDirection, playing, position, positionRef, preview, previewArea, previewLocalSeconds, previewQueue, previewTarget, previewTransition, project, renderOverlays, renderPipScenes, resolvedNextScene, sceneForPreview, sceneVideo, screen, setError, setPlaying, setPosition, setPreviewSize, videoClock, videoScene, videoSync, videoTick });


  const save = useCallback(async () => {
    if (missingAssets(latestProject.current, presentRefs).length) { setError(t('Relink missing media before saving this project.')); return; }
    try { await pending.current; await persistCurrent(); if (await bridge.saveProject(latestProject.current)) setNotice(bridge.native ? t('Project saved as a .pixcut package with its media files.') : t('Project file downloaded. A local copy is also saved on this device.')); } catch (e) { setError(messageFor(e)); }
  }, [persistCurrent]);

  function goHome() {
    setPlaying(false);
    setPreviewScene(null);
    setEditingText(false);
    setScreen('home');
    void persistCurrent();
  }

  function adoptProject(next: Session, message: string) {
    latestProject.current = next.project;
    setSession(next);
    setName(next.project.name);
    setSelectedIds([]);
    setPrimarySelected(null);
    selectionAnchor.current = null;
    setPosition(0);
    setPreviewScene(null);
    setEditingText(false);
    setPlaying(false);
    setScreen('editor');
    setModal(null);
    setNotice(message);
  }

  const { shortcutText, availabilityFor, tip, applyShortcuts, dismissHints } = useShortcutHelpers({ audio, audioTargetRef, busy, canEdit, clipEditing, duration, editTargetRef, exporting, lockedLanes, platform, position, project, projectTicks, ready, scenes, screen, selectedAudio, selectedScene, selectedScenes, session, setError, setNotice, setShortcuts, setShowHints, shortcuts, updatePreferences });


  const { copySceneProperties, notifyPasted, selectTextLayer, selectGlobalText, addProjectText, replaceSceneTextLayers, addElement, selectOverlay, saveOverlay, stageElement, commitElement, updateElement, elementStackPosition, moveElementLayer, reorderLayer, removeElement, beginElementMove, beginElementResize, beginElementRotate, beginOverlayTiming, addBeatAtPlayhead, removeBeat, addTextLayerAtPlayhead, previewInlineText, commitInlineText, cancelInlineText, blurInlineText, fadeAmount } = useTextAndElements({ active, activeSize, activeStart, allOverlays, canEdit, inspectorFlush, latestProject, overlayDraftRef, position, positionRef, previewScene, previewStage, project, projectTicks, run, sceneLayerStack, selectedElement, selectedGlobalText, selectedScene, selectedTextLayer, selectionAnchor, setDraggingOverlay, setEditTarget, setEditingText, setFramingMode, setGlobalTextDraft, setNotice, setOverlayDraft, setPlaying, setPosition, setPreviewScene, setPrimarySelected, setPropertyClipboard, setSelectedElementId, setSelectedGlobalTextId, setSelectedIds, setSelectedPipId, setSelectedTextLayerId, setSnapGuides, setTab, setTextDraft, setTextFocus, snapping, textDraft, textStartTicks });



  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (modal || event.isComposing) return;
      const target = event.target;
      const range = target instanceof HTMLInputElement && target.type === 'range';
      if (!range && isTextEntryTarget(target)) return;
      if (range && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && RANGE_NAVIGATION_KEYS.has(event.key)) return;
      const candidates = COMMANDS.filter(command => command.context === 'global' || screen === 'editor');
      const command = candidates.find(item => bindingMatchesEvent(shortcuts.bindings[item.id] ?? '', event, platform));
      if (!command) return;
      if (event.repeat && !['timeline.prev_frame', 'timeline.next_frame', 'clip.nudge_left', 'clip.nudge_right'].includes(command.id)) return;
      event.preventDefault();
      commandRef.current(command.id);
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [modal, screen, exporting, shortcuts, platform]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('.clip-context-menu')) return;
      setContextMenu(null);
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setContextMenu(null); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', key);
    };
  }, [contextMenu]);

  const { launchProject, startBlank, startWithFormats, toggleFormatPreset, addNewCustomFormat, addCustomFormat, updateFormatSettings, removeFormat, applyFramingToAllFormats, startTemplate, chooseTemplate } = useProjectStarts({ activeFormat, customFormatDraft, latestProject, newCustomFormats, newFormatIds, newFormatSelection, newProjectFps, persistCurrent, preferences, project, run, selectedScene, selectionAnchor, setActiveFormatId, setCustomFormatDraft, setEditingText, setError, setHomeSection, setModal, setNewCustomFormats, setNotice, setPendingTemplate, setPlaying, setPosition, setPreviewScene, setPrimarySelected, setScreen, setSelectedIds });


  const { deletedProjects, refreshDeleted, restoreProject, purgeProject, batchMode, setBatchMode, batchIds, toggleBatch, endBatch, batchFavorite, batchMove, batchDelete, projectMenu, setProjectMenu, deleteTarget, setDeleteTarget, setRenameTarget, renameDraft, setRenameDraft, groupTarget, setGroupTarget, groupDraft, setGroupDraft, groupDrafts, setGroupDrafts, groupFilter, setGroupFilter, openLibraryProject, duplicateProject, askDeleteProject, askRenameProject, askGroupProject, confirmGroupProject, projectGroups, openGroupManager, saveGroupRename, removeGroup, toggleProjectFavorite, confirmDeleteProject, renameProject, exportLibraryProject } = useProjectLibrary({ projects, setProjects, project, latestProject, canEdit, launchProject, refreshLibrary, persistCurrent, run, setScreen, setModal, setNotice, setError, setSelectedIds, setPrimarySelected, selectionAnchor, setPosition });

  async function stageImportedMedia(added: Scene[]) {
    const items = [...importedMedia, ...added.filter(item => !importedMedia.some(old => old.image === item.image))];
    await saveMediaBin(project.id, items);
    setMediaBin({ projectId: project.id, items }); setScreen('editor'); setTab('media');
    setSourcePreview(added[0] ?? null); if (added.length) setModal('source');
  }

  function beginMediaDrag(event: ReactDragEvent<HTMLElement>, source: Scene) {
    if (!canEdit || !hasMedia(source.image)) { event.preventDefault(); return; }
    mediaDragRef.current = source;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/x-pixcut-media', source.id);
    event.dataTransfer.setData('text/plain', source.name);
  }
  function dropLibraryMedia(event: ReactDragEvent<HTMLElement>) {
    if (!mediaDragRef.current && !Array.from(event.dataTransfer.types).includes('application/x-pixcut-media')) return false;
    event.preventDefault(); event.stopPropagation();
    const source = mediaDragRef.current; mediaDragRef.current = null; mediaDropAt.current = Date.now();
    setDropTarget(null); setFileDragActive(false);
    if (source) void appendMedia(source); return true;
  }
  const { previewingAudio, savedTracks, stopLibraryPreview, hoverLibraryAudio, copyMusicCredit, copyMusicCredits, addMusic, removeSavedTrack, addSavedTrack, addOnlineMusic, previewSound, addRecordedSound, addSound } = useLibraryAudio({ canEdit, projectTicks, position, project, latestProject, run, setBusy, setNotice, setError, tab, audioLibraryTab, playing, modal, setHoveredMedia, setHoveredElement });

  async function appendMedia(scene: Scene) {
    const next = { ...structuredClone(scene), id: crypto.randomUUID(), startTicks: 0, elements: [], textLayers: [], title: '', subtitle: '', transition: null };
    const start = totalDuration(latestProject.current);
    if (await run({ type: 'add', scenes: [next] })) {
      setSelectedIds([next.id]); setPrimarySelected(next.id); selectionAnchor.current = next.id;
      setSelectedElementId(null); setSelectedTextLayerId(null); setEditTarget('scene'); setPosition(start); setModal(null); setScreen('editor');
    }
  }

  async function addMediaOverlay(source: Scene) {
    if (!selectedScene) { setNotice(t('Select the background scene first, then add an overlay.')); return; }
    if (allOverlays.length >= 64) { setNotice(t('This project already has 64 overlays.')); return; }
    const startTicks = Math.max(0, Math.min(projectTicks - 1, secondsToTicks(position, project.timebase)));
    let width = 1, height = 1, sourceDuration = ticksToSeconds(source.sourceInTicks + source.durationTicks, project.timebase);
    if (source.mediaKind === 'video') { const probe = await probeVideo((await resolveMediaSource(source.image)) ?? source.image); width = probe.width; height = probe.height; sourceDuration = probe.duration; }
    else { const image = await loadImage(source.image); width = image.naturalWidth; height = image.naturalHeight; }
    const occupied = new Set(allOverlays.map(element => (element.x < .5 ? 1 : 0) + (element.y >= .5 ? 2 : 0)));
    const corner = [0, 1, 2, 3].find(candidate => !occupied.has(candidate)) ?? allOverlays.length % 4;
    const boxWidth = .34, boxHeight = Math.min(.7, Math.max(.04, boxWidth * activeSize.width / activeSize.height * height / width));
    const element: ElementLayer = { id: crypto.randomUUID(), z: newOverlayZ(sceneLayerStack), kind: source.mediaKind === 'video' ? 'video' : 'image', label: source.name.slice(0, 80), source: source.image,
      ...(source.videoPoster ? { poster: source.videoPoster } : {}), sourceInSeconds: ticksToSeconds(source.sourceInTicks, project.timebase), sourceDurationSeconds: sourceDuration,
      x: corner % 2 ? .25 : .75, y: corner < 2 ? Math.max(.25, boxHeight / 2 + .04) : Math.min(.75, 1 - boxHeight / 2 - .04), width: boxWidth, height: boxHeight, color: '#FFFFFF', opacity: 100, rotation: 0,
      startTicks, durationTicks: Math.min(projectTicks - startTicks, source.durationTicks), animation: 'none' };
    if (await run({ type: 'overlays', overlays: [...project.overlays, element] })) {
      setEditTarget('element'); setSelectedElementId(element.id); setEditingText(false); setFramingMode(false); setModal(null); setTab('elements');
    }
  }

  const { removePip, addMediaPip, stagePip, commitPip, stagePipStyle, selectPip, beginPipTiming } = usePipLayers({ timelineSnapping: snapping, setSelectedPipId, setSelectedIds, setPrimarySelected, selectionAnchor, setSelectedTextLayerId, setSelectedGlobalTextId, setSelectedElementId, setEditTarget, setEditingText, setFramingMode, setPlaying, setPosition, project, selectedPip, pipDraftRef, setPipDraft, activePip, setError, run, setNotice, canEdit, projectTicks, selectedScene, position, activeSize });

  const { refreshAssetUsage, chooseImages, commitDucking, importCustomElement, importVideos, importCaptionFile, chooseVideo, chooseCustomElement, cleanStorage } = useMediaImport({ canEdit, setBusy, customElementKind, addMediaOverlay, project, selectedScene, setError, customElementInput, mediaInput, operation, setPlaying, scenes, preferences, stageImportedMedia, videoInput, latestProject, run, setNotice, captionInput, setStorageUsage, storageBusy, storageConfirm, setStorageConfirm, setStorageNote, setStorageBusy, setDuckDraft });

  const { importFontFile, removeFont, exportCaptions } = useFontsAndCaptions({ canEdit, fontInput, fontTargetId, latestProject, project, run, setError, setNotice });


  const { removeAudio, importFiles, stopVoiceover, startVoiceover, stageAudio, commitAudio, detectAudioBeats, snapCutsToBeat, importAudio, chooseAudio, focusAudio, setVideoAudioLevel, commitMix, stageVideoVolume, commitVideoVolume, toggleLaneMute, setLaneMix, beginAudioMove, beginAudioTrim } = useAudioActions({ timelineSnapping: snapping, canEdit, setError, audioInput, projectTicks, setNotice, position, project, audioLaneRef, run, setEditTarget, setSelectedAudioId, setTab, operation, setPlaying, setBusy, scenes, preferences, stageImportedMedia, mediaInput, recordChunks, recorderRef, setRecording, setRecordSeconds, recordTimer, latestProject, positionRef, audioDraftRef, setAudioDraft, setPreviewAudio, selectedAudio, mixDraftRef, setMixDraft, videoVolumeDraftRef, setVideoVolumeDraft, playing, setPosition, editTargetRef, audioTargetRef, setSelectedIds, setPrimarySelected, setSelectedElementId, setSelectedGlobalTextId, setBeatBusy, setBeatTempo, beatTempo });

  const { togglePlayback, playForward, playReverse, stepFrame, scrubTo, selectScene, updateSelection, splitAtPlayhead, duplicateSelected, deleteSelected } = useSceneCommands({ activeFormat, audio, audioTargetRef, commitElement, duration, editTarget, editTargetRef, frameSeconds, hasSceneSelection, latestProject, operation, overlayDraftRef, pending, pipDraftRef, playing, position, positionRef, primarySelected, project, removeAudio, removeElement, removePip, replaceSceneTextLayers, run, scenes, selectedAudio, selectedAudioId, selectedElement, selectedGlobalText, selectedIds, selectedPip, selectedScene, selectedScenes, selectedTextLayerId, selectionAnchor, setEditTarget, setEditingText, setGlobalTextDraft, setNotice, setOverlayDraft, setPipDraft, setPlayDirection, setPlaying, setPosition, setPreviewScene, setPrimarySelected, setSelectedAudioId, setSelectedElementId, setSelectedGlobalTextId, setSelectedIds, setSelectedPipId, setSelectedTextLayerId, snapping });
  clipEditing.current = useClipEditing({ project, run, position, canEdit, setNotice, editTargetRef, audioTargetRef, selectedAudio, selectedElement, selectedPip, selectedScenes, saveOverlay, removeSelected: deleteSelected, setSelectedIds, setPrimarySelected, selectionAnchor, setSelectedAudioId, setSelectedPipId, setSelectedElementId, setEditTarget });

  const { beginImagePan, beginTextMove, beginTextResize, beginFadeDrag, beginSceneTrim, beginPlayheadDrag } = useStagePointer({ timelineSnapping: snapping, playheadSeconds: position, canEdit, inspectorFlush, previewStage, inspectorScene, selectedScene, selectedIds, selectedTextLayer, textBox, project, latestProject, projectTicks, duration, activeSize, pending, run, updateSelection, optimisticScene, replaceSceneTextLayers, scrubTo, selectionAnchor, setSession, setPreviewScene, setPlaying, setEditingText, setFadeDrag, setSnapGuides, setSelectedIds, setPrimarySelected, setDraggingOverlay });

  const { replaceSceneWithAsset, replaceSceneMedia, requestReplaceImage, beginReorder, endReorder, dragOverScene, dropScene } = useSceneReplacement({ canEdit, setReplacingSceneId, inspectorFlush, pending, latestProject, project, optimisticScene, run, setNotice, setSession, setError, selectedCount, selectedScene, replaceTargetId, replaceInput, reorderRef, setReorderId, setDropTarget, setFileDragActive, dragOverTarget, dropLibraryMedia, scenes });

  function dragOverTarget(event: ReactDragEvent<HTMLElement>, id: string) {
    if (!mediaDragRef.current && !Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setDropTarget(id);
  }

  function dropIntoMedia(event: ReactDragEvent<HTMLElement>) {
    event.preventDefault();
    setDropTarget(null);
    setFileDragActive(false);
    if (event.dataTransfer.files.length) void importFiles(event.dataTransfer.files);
  }

  const { nativeTimelineAt, nativeSceneAt, importNativePaths, dropNativeOnScene, open, openBrowserProject, openProjectFile, togglePreviewFullscreen, relinkMissing } = useProjectFiles({ latestProject, operation, persistCurrent, preferences, project, projectInput, replaceSceneWithAsset, run, scenes, selectionAnchor, setBusy, setError, setNotice, setPlaying, setPosition, setPrimarySelected, setRelinking, setScreen, setSelectedIds, setSession, stageImportedMedia });


  const { missingCounts } = useAppEffects({ adoptProject, audio, audioDraftRef, audioElements, audioMix, canEdit, commandRef, cueAudio, duration, endBatch, frameSeconds, fullscreenRef, homeSection, importFiles, importVideos, language, latestProject, libraryReady, mixDraftRef, modal, openProjectFile, persistCurrent, pipDraftRef, playDirection, playing, position, preferences, project, projects, ready, recordTimer, recorderRef, refreshAssetUsage, refreshDeleted, refreshLibrary, refreshStorage, scenes, screen, selectedAudioId, selectedPipId, selectedScene, selectedTextLayer, selectionAnchor, setAudioDraft, setBeatTempo, setError, setExportJob, setExportProgress, setExportSettings, setExporter, setFontTick, setMixDraft, setName, setPipDraft, setPosition, setPreviewScene, setPrimarySelected, setReady, setScreen, setSelectedAudioId, setSelectedIds, setSelectedPipId, setSelectedTextLayerId, setSession, setTextDraft, settingsTab, videoDuckWindows });
  const { openExportModal, exportFilename, saveStillFrame, exportVideo, cancelExport } = useExportFlow({ activeFormat, activeSize, commitElement, displayAspect, exportAudio, exportCancelled, exportCodec, exportCodecs, exportContainer, exportFormatIds, exportFps, exportQuality, exportResolution, exportSettings, exportSpeed, inspectorFlush, latestProject, missing, musicCredits, pending, position, presentRefs, previewLocalSeconds, previewTransition, project, renderOverlays, renderPipScenes, resolvedNextScene, saveCredits, sceneForPreview, sceneVideo, setCancellingExport, setError, setExportCodecs, setExportElapsed, setExportFormatIds, setExportHardware, setExportJob, setExportProgress, setExporting, setHardwareAvailable, setModal, setNotice, setPlaying, useHardware, videoScene });


  const { requestCloseModal, closeShortcutSettings, runCommandId, commandAvailability } = useCommandDispatch({ addBeatAtPlayhead, addTextLayerAtPlayhead, availabilityFor, chooseImages, clipEditing, closeModalRef, commandRef, deleteSelected, duplicateSelected, duration, fullscreenRef, jumpToEdit, modal, movePlayhead, open, openExportModal, overlayDraftRef, pipDraftRef, playForward, playReverse, position, run, save, scenes, selectionAnchor, setContextMenu, setDeleteTarget, setEditingText, setFramingMode, setGroupDrafts, setGroupTarget, setModal, setNotice, setOverlayDraft, setPendingTemplate, setPipDraft, setPlaying, setPrimarySelected, setRenameTarget, setSafeArea, setSelectedElementId, setSelectedGlobalTextId, setSelectedIds, setSelectedPipId, setSelectedTextLayerId, setShortcutDirty, settingsTab, shortcutDirty, splitAtPlayhead, startBlank, stepFrame, timelineControls, togglePlayback, toggleSnapping });
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex]:not([tabindex="-1"])') ?? []).filter(element => element.getClientRects().length > 0 || element === document.activeElement);
    if (dialog && !dialog.contains(document.activeElement)) focusable()[0]?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeModalRef.current(); }
      if (e.key !== 'Tab') return;
      const items = focusable(), first = items[0], last = items.at(-1);
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, [modal, exporting]);

  const tabTitles = { media: 'Your media', text: 'Titles', elements: 'Elements', transitions: 'Transitions', effects: 'Effects', audio: 'Audio', templates: 'Templates' } as const;
  const wideModal = modal === 'shortcuts' || modal === 'palette' || modal === 'templates';
  const mediumModal = modal === 'source' || modal === 'new' || modal === 'formats' || modal === 'missing';
  const modalEyebrow = modal === 'export' ? t('VIDEO EXPORT') : modal === 'shortcuts' ? 'FIND YOUR FLOW' : modal === 'palette' ? 'EVERY ACTION, ONE PLACE' : modal === 'settings' ? 'MAKE PIXCUT YOURS' : modal === 'delete' ? 'REMOVE FROM THIS DEVICE' : modal === 'rename' ? 'PROJECT DETAILS' : modal === 'group' ? 'ORGANIZE YOUR LIBRARY' : modal === 'groups' ? 'ORGANIZE YOUR LIBRARY' : modal === 'formats' ? 'DELIVERABLES' : modal === 'missing' ? 'RESTORE YOUR MEDIA' : 'YOUR NEXT STORY';
  const projectGroupsList = projectGroups();
  // A filter for a group that no longer exists would show an empty library; fall back to everything.
  useEffect(() => { if (libraryReady && groupFilter !== 'all' && groupFilter !== 'ungrouped' && !projectGroupsList.includes(groupFilter)) setGroupFilter('all'); }, [libraryReady, groupFilter, projectGroupsList.join('|')]);
  const matchingProjects = projects
    .filter(entry => {
      const query = libraryQuery.trim().toLowerCase();
      return (!query || `${entry.name} ${entry.group ?? ''}`.toLowerCase().includes(query)) && (!favoriteOnly || entry.favorite);
    })
    .sort((a, b) => librarySort === 'name' ? a.name.localeCompare(b.name) : librarySort === 'duration' ? b.duration - a.duration : b.updatedAt - a.updatedAt);
  const visibleProjects = groupFilter === 'all' ? matchingProjects : groupFilter === 'ungrouped' ? matchingProjects.filter(entry => !entry.group) : matchingProjects.filter(entry => entry.group === groupFilter);
  const templateMatches = TEMPLATES.filter(template => {
    const category = templateCategory === 'All' || template.category === templateCategory;
    const haystack = `${template.name} ${template.category} ${template.description}`.toLowerCase();
    return category && haystack.includes(templateQuery.trim().toLowerCase());
  });

  function formatFilterChips(onCustom?: () => void) {
    return <div className="format-filters" role="tablist" aria-label={t('Format filters')}>
      {FORMAT_FILTERS.map(filter => <button key={filter.id} role="tab" aria-selected={formatFilter === filter.id} className={formatFilter === filter.id ? 'active' : ''} onClick={() => setFormatFilter(filter.id)}>{t(filter.label)}</button>)}
      {onCustom && <button type="button" className="format-filter-custom" onClick={onCustom}><Plus size={11} /> {t('Custom size')}</button>}
    </div>;
  }

  function templateImage(template: TemplateDefinition) { return templatePreview(template); }

  function renderProjectCard(entry: ProjectSummary) {
    const active = entry.id === project.id;
    return <div className={`project-card ${active ? 'active' : ''} ${projectMenu === entry.id ? 'menu-open' : ''}`} key={entry.id}>
      <button className={`project-open ${batchMode && batchIds.includes(entry.id) ? 'batch-selected' : ''}`} aria-pressed={batchMode ? batchIds.includes(entry.id) : undefined} onClick={() => batchMode ? toggleBatch(entry.id) : void openLibraryProject(entry)} disabled={!libraryReady || (!batchMode && !canEdit)}>
        <ProjectThumb key={`${entry.id}-${entry.updatedAt}`} entry={entry}>
          <div className="project-frame" style={{ aspectRatio: entry.width && entry.height ? `${entry.width} / ${entry.height}` : entry.aspect.replace(':', ' / ') }}>
            {entry.thumbnail ? <img src={entry.thumbnail} alt="" /> : <span className="project-thumb-fallback"><Clapperboard size={24} /></span>}
          </div>
          <span className="project-aspect">{entry.aspect}</span>
          {missingCounts[entry.id] > 0 && <span className="project-missing" title={t('Some media for this project is missing from this device.')}><AlertTriangle size={10} />{missingCounts[entry.id]} {t('missing')}</span>}
          {entry.group && <span className="project-group-badge"><FolderOpen size={10} />{entry.group}</span>}
          {batchMode ? <span className={`project-check ${batchIds.includes(entry.id) ? 'on' : ''}`}><Check size={14} /></span> : <span className="project-play"><Play size={15} fill="currentColor" /></span>}
        </ProjectThumb>
        <div className="project-meta">
          <strong>{entry.name}</strong>
          <small>{sceneCount(entry.sceneCount)} · {timecode(entry.duration, entry.timebase)}</small>
          {entry.formats && entry.formats.length > 0 && <span className="project-formats" title={entry.formats.map(format => `${format.name} · ${format.width}×${format.height}`).join('\n')}>
            {[...new Set(entry.formats.map(format => format.aspect))].slice(0, 4).map(aspect => <span className="project-format-chip" key={aspect}>{aspect}</span>)}
            {entry.formats.length > 1 && <span className="project-format-count">{formatCount(entry.formats.length)}</span>}
          </span>}
          <span className="project-status"><span className="status-dot" /> {active ? t('Open now') : t('Edited {time}', { time: relativeTime(entry.updatedAt) })}</span>
          {(() => { const state = exportState(entry); return <span className={`project-export ${state}`}>{state === 'never' ? t('Not exported yet') : state === 'changed' ? t('Changed since export {time}', { time: relativeTime(entry.exportedAt ?? 0) }) : t('Exported {time}', { time: relativeTime(entry.exportedAt ?? 0) })}</span>; })()}
        </div>
      </button>
      {!batchMode && <div className="project-quick" role="group" aria-label={t('Quick actions for {name}', { name: entry.name })}>
        <button aria-label={t('Export {name}', { name: entry.name })} title={t('Export project file')} onClick={() => void exportLibraryProject(entry)}><Download size={13} /></button>
        <button aria-label={t('Duplicate {name}', { name: entry.name })} title={t('Duplicate')} disabled={!canEdit} onClick={() => void duplicateProject(entry)}><Copy size={13} /></button>
        <button aria-label={t('Rename {name}', { name: entry.name })} title={t('Rename…')} disabled={!canEdit} onClick={() => askRenameProject(entry)}><Pencil size={13} /></button>
      </div>}
      {!batchMode && <button className={`project-favorite ${entry.favorite ? 'active' : ''}`} aria-label={entry.favorite ? `Remove ${entry.name} from favorites` : `Add ${entry.name} to favorites`} aria-pressed={Boolean(entry.favorite)} onClick={() => void toggleProjectFavorite(entry)}><Star size={15} fill={entry.favorite ? 'currentColor' : 'none'} /></button>}
      {!batchMode && <button className="project-actions" data-project-actions={entry.id} aria-label={t('Actions for {name}', { name: entry.name })} aria-haspopup="menu" aria-expanded={projectMenu === entry.id} onClick={() => setProjectMenu(id => id === entry.id ? null : entry.id)}><MoreHorizontal size={16} /></button>}
      {projectMenu === entry.id && <div className="project-menu" data-project-menu={entry.id} role="menu" aria-label={t('{name} actions', { name: entry.name })}>
        <span className="project-menu-heading">{entry.name}</span>
        <button role="menuitem" onClick={() => void openLibraryProject(entry)}><FolderOpen size={14} /><span>{t('Open project')}</span></button>
        <button role="menuitem" disabled={!canEdit} onClick={() => askRenameProject(entry)}><Pencil size={14} /><span>{t('Rename…')}</span></button>
        <button role="menuitem" onClick={() => void toggleProjectFavorite(entry)}><Star size={14} /><span>{entry.favorite ? t('Remove from favorites') : t('Add to favorites')}</span></button>
        <button role="menuitem" disabled={!canEdit} onClick={() => askGroupProject(entry)}><Layers size={14} /><span>{entry.group ? t('Group: {name}', { name: entry.group }) : t('Move to group…')}</span></button>
        <button role="menuitem" disabled={!canEdit} onClick={() => void duplicateProject(entry)}><Copy size={14} /><span>{t('Duplicate')}</span></button>
        <button role="menuitem" onClick={() => void exportLibraryProject(entry)}><Download size={14} /><span>{t('Export project file')}</span></button>
        <button role="menuitem" className="danger" onClick={() => askDeleteProject(entry)}><Trash2 size={14} /><span>{t('Move to Recently deleted…')}</span></button>
      </div>}
    </div>;
  }

  const audioInspector = <>
              <details className="inspector-section ducking-panel"><summary>{t('Project music mix')}</summary>
                <label className="checkbox-field"><input type="checkbox" checked={(project.ducking ?? 0) > 0} disabled={!canEdit || !hasVideoScenes} onChange={event => void run({ type: 'ducking', amount: event.target.checked ? 60 : 0 })} /> {t('Lower music under video sound')}</label>
                {(project.ducking ?? 0) > 0 && <RangeField label={'Reduce music by'} sliderLabel="Music ducking amount" unit="%" min={10} max={90} step={5} value={duckDraft ?? project.ducking ?? 60} disabled={!canEdit} onChange={v => setDuckDraft(v)} onCommit={() => commitDucking(duckDraft ?? project.ducking ?? 60)} />}
                <p className="note"><AudioLines size={14} /><span>{hasVideoScenes ? t('Lowers all music tracks while video audio is playing.') : t('Add a video clip to duck music under its sound.')}</span></p>
              </details>
              <div className="voiceover-panel">
                <div className="beat-sync-head"><strong>{t('Voiceover')}</strong>{recording ? <span>{recordSeconds.toFixed(1)} s</span> : null}</div>
                <div className="beat-sync-actions">
                  {recording
                    ? <button className="button danger" onClick={stopVoiceover}><Square size={13} /> {t('Stop and add')}</button>
                    : <button className="button" disabled={!canEdit || !projectTicks} onClick={() => void startVoiceover()}><Mic size={14} /> {t('Record voiceover')}</button>}
                </div>
                <small>{recording ? t('Speak now. The take is added at the playhead when you stop.') : t('Records from your microphone at the playhead. Nothing is uploaded.')}</small>
              </div>
              {selectedAudio && <div className="audio-editor">
                <div className="audio-editor-title"><small>{isAssetRef(selectedAudio.data) ? t('Stored locally') : formatBytes(selectedAudio.data.length * .75)} · {t('{duration} s source', { duration: selectedAudio.sourceDurationSeconds.toFixed(1) })}</small></div>
                {(selectedAudio.credit || creditForClipName(selectedAudio.name)) && <div className="music-credit-note"><Music size={13} /><span>{selectedAudio.credit || creditForClipName(selectedAudio.name)}</span><button className="text-button" onClick={() => void navigator.clipboard.writeText((selectedAudio.credit || creditForClipName(selectedAudio.name))!).then(() => setNotice(t('Music credit copied.'))).catch(() => setError(t('Could not copy the credit. It is listed in the Music panel.')))}><Copy size={12} /> {t('Copy credit')}</button></div>}
                <label className="field">{t('Audio track')}<select aria-label={t('Audio track')} value={selectedAudio.lane} onChange={event => stageAudio({ lane: Number(event.target.value) })} onBlur={commitAudio}>{audioLanes.map((lane, index) => <option key={lane} value={lane}>{t('Track {number}', { number: index + 1 })}</option>)}{audioLanes.length < 8 && <option value={audioLanes.length}>{t('Track {number}', { number: audioLanes.length + 1 })}</option>}</select></label>
                <RangeField label={'Start'} sliderLabel="Audio start" unit="s" min={0} max={ticksToSeconds(Math.max(0, projectTicks - selectedAudio.durationTicks), project.timebase)} step={secondsPerTick(project.timebase)} value={ticksToSeconds(selectedAudio.startTicks, project.timebase)} disabled={!canEdit} onChange={v => stageAudio({ startTicks: secondsToTicks(v, project.timebase) })} onCommit={commitAudio} />
                <RangeField label={'Trim in'} sliderLabel="Audio trim in" unit="s" min={0} max={Math.max(0, selectedAudio.sourceDurationSeconds - secondsPerTick(project.timebase))} step={0.1} value={selectedAudio.sourceInSeconds} disabled={!canEdit} onChange={v => stageAudio({ sourceInSeconds: v })} onCommit={commitAudio} />
                <RangeField label={'Duration'} sliderLabel="Audio duration" unit="s" min={0.1} max={Math.max(0.1, Math.min(ticksToSeconds(projectTicks - selectedAudio.startTicks, project.timebase), selectedAudio.sourceDurationSeconds - selectedAudio.sourceInSeconds))} step={0.1} value={ticksToSeconds(selectedAudio.durationTicks, project.timebase)} disabled={!canEdit} onChange={v => stageAudio({ durationTicks: secondsToTicks(v, project.timebase) })} onCommit={commitAudio} />
                <RangeField label={'Volume'} sliderLabel="Audio volume" unit="%" min={0} max={100} step={1} value={Math.round(selectedAudio.volume * 100)} disabled={!canEdit} onChange={v => stageAudio({ volume: v / 100 })} onCommit={commitAudio} />
                <RangeField label={'Fade in'} sliderLabel="Audio fade in" unit="s" min={0} max={Math.min(30, ticksToSeconds(selectedAudio.durationTicks, project.timebase))} step={0.1} value={selectedAudio.fadeIn} disabled={!canEdit} onChange={v => stageAudio({ fadeIn: v })} onCommit={commitAudio} />
                <RangeField label={'Fade out'} sliderLabel="Audio fade out" unit="s" min={0} max={Math.min(30, ticksToSeconds(selectedAudio.durationTicks, project.timebase))} step={0.1} value={selectedAudio.fadeOut} disabled={!canEdit} onChange={v => stageAudio({ fadeOut: v })} onCommit={commitAudio} />
                <details className="inspector-section" open>
                  <summary>{t('Three-band EQ')}</summary>
                  {([['low', 'Bass · 120 Hz'], ['mid', 'Voice · 1 kHz'], ['high', 'Treble · 6 kHz']] as const).map(([key, label]) => (
                    <RangeField key={key} label={label} sliderLabel={`Audio ${key} EQ`} unit="dB" min={-12} max={12} step={1} value={selectedAudio[key] ?? 0} disabled={!canEdit} onChange={v => stageAudio({ [key]: v })} onCommit={commitAudio} />
                  ))}
                  <button className="button" disabled={!canEdit || !selectedAudio.low && !selectedAudio.mid && !selectedAudio.high} onClick={() => { stageAudio({ low: 0, mid: 0, high: 0 }); window.setTimeout(commitAudio, 0); }}><RotateCcw size={13} /> {t('Reset EQ')}</button>
                </details>
                <div className="beat-sync">
                  <div className="beat-sync-head"><strong>{t('Beat tools')}</strong>{beatTempo ? <span>{beatTempo} BPM</span> : null}</div>
                  <div className="beat-sync-actions">
                    <button className="button" disabled={!canEdit || beatBusy} onClick={() => void detectAudioBeats()}><AudioLines size={14} />{beatBusy ? t('Listening…') : t('Detect beats')}</button>
                    <button className="button" disabled={!canEdit || beatBusy} onClick={() => void snapCutsToBeat()}><Magnet size={14} />{t('Snap cuts')}</button>
                  </div>
                  <small>{t('Detect beat markers, then align cuts to the rhythm.')}</small>
                </div>

              </div>}
  </>;
  const propertyKind = inspectorKind(editTarget, { scene: Boolean(selectedScene), text: Boolean(selectedTextLayer), element: Boolean(selectedElement), audio: Boolean(selectedAudio) });

  const elementInspector = selectedElement && <div className="element-controls">
                <div className="element-controls-head"><strong>{elementName(selectedElement)}</strong><button className="text-button danger" onClick={() => removeElement(selectedElement.id)}><Trash2 size={12} /> {t('Delete')}</button></div>
                {!selectedElement.presetId && !['image','video'].includes(selectedElement.kind) && <label className="field">{t('Replace old decoration')}<select aria-label={t('Replace old decoration')} value="" onChange={event => { const preset = ELEMENT_CATALOG.find(p => p.id === event.target.value); if (preset) updateElement({ kind:preset.kind,presetId:preset.id,label:preset.text,color:preset.color,animation:preset.animation,...presetSize(preset,activeSize) }); }}><option value="">{t('Choose a current element…')}</option>{ELEMENT_CATALOG.filter(p => ['Social','Titles'].includes(p.category)).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}
                {(selectedElement.presetId || ELEMENT_LABEL_DEFAULTS[selectedElement.kind] !== undefined) && <ElementTextField key={selectedElement.id} value={selectedElement.label ?? elementPreset(selectedElement)?.text ?? ELEMENT_LABEL_DEFAULTS[selectedElement.kind] ?? ''} stage={label => stageElement({ label })} commit={commitElement} />}
                {selectedElement.kind !== 'image' && selectedElement.kind !== 'video' && <div className="element-color-row">{ELEMENT_COLORS.map(color => <button key={color} className={`element-color ${selectedElement.color === color ? 'active' : ''}`} style={{ background: color }} aria-label={t('Element color {color}', { color })} onClick={() => updateElement({ color })} onPointerUp={commitElement} onKeyUp={commitElement} onBlur={commitElement} />)}</div>}
                {selectedElement.kind === 'video' && <p className="note">{t('Overlay audio is muted. Add music on an audio track.')}</p>}
                {sceneLayerStack.length > 1 && <StackOrder position={elementStackPosition(selectedElement)} total={sceneLayerStack.length} disabled={!canEdit} onMove={moveElementLayer} />}
                <details className="inspector-section" open><summary>{t('Timing')}</summary><div className="overlay-timing">
                  <label className="field">{t('Start (project seconds)')}<input aria-label={t('Overlay start')} type="number" min="0" max={ticksToSeconds(projectTicks - 1, project.timebase)} step={secondsPerTick(project.timebase)} value={Number(ticksToSeconds(selectedElement.startTicks, project.timebase).toFixed(3))} onChange={event => stageElement({ startTicks: secondsToTicks(Number(event.target.value), project.timebase) })} onBlur={commitElement} onKeyDown={event => { if (event.key === 'Enter') commitElement(); }} /></label>
                  <label className="field">{t('Duration (seconds)')}<input aria-label={t('Overlay duration')} type="number" min={secondsPerTick(project.timebase)} max={ticksToSeconds(projectTicks - selectedElement.startTicks, project.timebase)} step={secondsPerTick(project.timebase)} value={Number(ticksToSeconds(selectedElement.durationTicks, project.timebase).toFixed(3))} onChange={event => stageElement({ durationTicks: secondsToTicks(Number(event.target.value), project.timebase) })} onBlur={commitElement} onKeyDown={event => { if (event.key === 'Enter') commitElement(); }} /></label>
                </div></details>
<details className="inspector-section element-sounds"><summary>{t('Sound')}</summary><label className="field">{t('Sound effect')}<select aria-label={t('Element sound effect')} value={soundEffect} onChange={event => setSoundEffect(event.target.value as SoundEffectId)}>{SOUND_EFFECTS.map(effect => <option key={effect.id} value={effect.id}>{effect.label}</option>)}</select></label><div className="sound-effect-actions"><button className="button" onClick={() => previewSound(soundEffect)}><Play size={13} /> Listen</button><button className="button" onClick={() => void addSound(soundEffect, selectedElement.startTicks)}><Plus size={13} /> At entrance</button>{selectedElement.action && <button className="button" onClick={() => void addSound(soundEffect, selectedElement.startTicks + selectedElement.action!.startTicks)}><Plus size={13} /> At action</button>}</div></details>
<details className="inspector-section motion-properties" open><summary>{t('Motion')}</summary>
                <BehaviorControls canvas={activeSize} element={selectedElement} audio={project.audio} update={updateElement} stage={stageElement} commit={commitElement} preview={seconds => { commitElement(); setPosition(Math.min(ticksToSeconds(projectTicks - 1, project.timebase), ticksToSeconds(selectedElement.startTicks, project.timebase) + seconds)); setPlaying(true); }} />
                <section className="element-motion"><h3>{t('Entrance')}</h3>                <div className="library-label">{t('ENTRANCE')} <span>{ELEMENT_ANIMATIONS.length - 1} motions</span></div>
                <div className="animation-choices">{ELEMENT_ANIMATIONS.map(([id, label]) => <button key={id} onPointerEnter={()=>setHoverEntrance(id)} onPointerLeave={()=>setHoverEntrance(null)} onFocus={()=>setHoverEntrance(id)} onBlur={()=>setHoverEntrance(null)} aria-pressed={selectedElement.animation === id} className={selectedElement.animation === id ? 'active' : ''} onClick={() => updateElement(animationSelection(id))}><span className="motion-preview"><ElementPreview motionSample kind="name-tag" color={selectedElement.color} animation={id} active={hoverEntrance===id} label={'Aa\nMotion'} reduceMotion={preferences.reduceMotion} /></span><span>{label}</span></button>)}</div>
                <label className="checkbox-field element-repeat"><input type="checkbox" checked={selectedElement.loop ?? false} disabled={selectedElement.animation === 'none'} onChange={event => updateElement({ loop: event.target.checked })} onPointerUp={commitElement} onKeyUp={commitElement} onBlur={commitElement} /> {isContinuousMotion(selectedElement.animation) ? 'Repeat motion' : 'Repeat entrance'}</label>
                {selectedElement.animation !== 'none' && <label className="field">{t('Entrance duration')}<input aria-label={t('Element animation duration')} type="number" min="0.1" max="5" step="0.1" value={selectedElement.animationDuration ?? .6} onChange={event => stageElement({ animationDuration: Math.max(.1, Math.min(5, Number(event.target.value) || .6)) })} onPointerUp={commitElement} onKeyUp={commitElement} onBlur={commitElement} /></label>}
                </section>
                <details className="overlay-action"><summary>{t('Timed action')}</summary><label className="field">{t('Later action')}<select aria-label={t('Element action')} value={selectedElement.action?.kind ?? 'none'} onChange={event => updateElement({ action: event.target.value === 'none' ? undefined : { kind: event.target.value as 'ring', startTicks: Math.min(selectedElement.durationTicks - 1, secondsToTicks(1, project.timebase)), durationTicks: Math.min(selectedElement.durationTicks, secondsToTicks(2, project.timebase)), repeat: false, sound: false } })}><option value="none">{t('None')}</option><option value="ring">{t('Ring / shake')}</option><option value="pulse">{t('Pulse')}</option><option value="float">{t('Float')}</option><option value="spin">{t('Spin')}</option></select></label>
                {selectedElement.action && <>
                  <label className="field">{t('Action starts after (seconds)')}<input aria-label={t('Action start')} type="number" min="0" max={ticksToSeconds(selectedElement.durationTicks - 1, project.timebase)} step="0.1" value={ticksToSeconds(selectedElement.action.startTicks, project.timebase)} onChange={event => stageElement({ action: { ...selectedElement.action!, startTicks: secondsToTicks(Number(event.target.value), project.timebase) } })} onBlur={commitElement} onKeyDown={event => { if (event.key === 'Enter') commitElement(); }} /></label>
                  <label className="field">{t('Action duration (seconds)')}<input aria-label={t('Action duration')} type="number" min="0.1" max={ticksToSeconds(selectedElement.durationTicks - selectedElement.action.startTicks, project.timebase)} step="0.1" value={ticksToSeconds(selectedElement.action.durationTicks, project.timebase)} onChange={event => stageElement({ action: { ...selectedElement.action!, durationTicks: secondsToTicks(Number(event.target.value), project.timebase) } })} onBlur={commitElement} /></label>
                  <label className="checkbox-field"><input type="checkbox" checked={selectedElement.action.repeat} onChange={event => updateElement({ action: { ...selectedElement.action!, repeat: event.target.checked } })} /> {t('Repeat action')}</label>
                  {selectedElement.action.kind === 'ring' && <label className="checkbox-field"><input type="checkbox" checked={selectedElement.action.sound} onChange={event => updateElement({ action: { ...selectedElement.action!, sound: event.target.checked } })} /> {t('Bell sound')}</label>}
                </>}
                </details>
</details>
                <details className="element-adjustments"><summary>{t('Size & position')}</summary>
                <KeyframeControls layer={selectedElement} playheadSeconds={Math.max(0, position - ticksToSeconds(selectedElement.startTicks, project.timebase))} durationSeconds={ticksToSeconds(selectedElement.durationTicks, project.timebase)} disabled={!canEdit} onChange={keyframes => updateElement({ keyframes })} />
                {(selectedElement.kind === 'image' || selectedElement.kind === 'video') && <MaskControls mask={selectedElement.mask} disabled={!canEdit} onStage={mask => stageElement({ mask })} onCommit={commitElement} onApply={mask => updateElement({ mask })} />}
                {(selectedElement.kind === 'image' || selectedElement.kind === 'video') && <ChromaControls chroma={selectedElement.chroma} disabled={!canEdit} onStage={chroma => stageElement({ chroma })} onCommit={commitElement} onApply={chroma => updateElement({ chroma })} />}

                <RangeField label={'Opacity'} unit="%" min={0} max={100} step={1} value={selectedElement.opacity} onChange={v => stageElement({ opacity: v })} onCommit={commitElement} />
                <RangeField label={'Rotation'} unit="°" min={-180} max={180} step={1} value={selectedElement.rotation} onChange={v => stageElement({ rotation: v })} onCommit={commitElement} />
                <RangeField label="Width" unit="%" min={2} max={100} step={1} value={Math.round(selectedElement.width * 100)} onChange={v => stageElement({ width: v / 100 })} onCommit={commitElement} />
                <RangeField label="Height" unit="%" min={2} max={100} step={1} value={Math.round(selectedElement.height * 100)} onChange={v => stageElement({ height: v / 100 })} onCommit={commitElement} />
                <p className="note">Drag a corner handle on the preview to resize (hold Shift to keep proportions); use the round handle above it to rotate (Shift snaps to 15°).</p>
                </details>
              </div>;

  const editorModel = { project, scenes, audio, canEdit, run, duration, projectTicks, frameSeconds, preferences, activeSize, setNotice, setError };

  const editorActions: EditorActions = { chooseImages, chooseVideo, chooseCustomElement, chooseAudio, dragOverTarget, dropIntoMedia, beginMediaDrag, previewMedia, appendMedia, addMediaPip, selectGlobalText, addProjectText, selectTextLayer, exportCaptions, removeFont, addTextLayerAtPlayhead, hoverLibraryAudio, stopLibraryPreview, focusAudio, copyMusicCredit, addMusic, addSavedTrack, removeSavedTrack, addOnlineMusic, copyMusicCredits, addSound, addRecordedSound, chooseTemplate, templateImage, selectOverlay, addElement, tip, runCommandId, saveStillFrame, togglePreviewFullscreen, beginImagePan, beginTextMove, beginTextResize, beginElementMove, beginElementRotate, beginElementResize, previewInlineText, blurInlineText, cancelInlineText, commitInlineText, shortcutText, scrubTo, togglePlayback, removePip, stagePip, commitPip, stagePipStyle, removeAudio, updateSelection, copySceneProperties, notifyPasted, inspectorFlush, requestReplaceImage, applyFramingToAllFormats, reorderLayer, deleteSelected, duplicateSelected, dropLibraryMedia, beginPlayheadDrag, removeBeat, selectScene, beginOverlayTiming, beginReorder, endReorder, dragOverScene, dropScene, beginFadeDrag, beginSceneTrim, setVideoAudioLevel, commitMix, stageVideoVolume, commitVideoVolume, selectPip, beginPipTiming, toggleLaneMute, setLaneMix, beginAudioMove, beginAudioTrim, stageAudio, commitAudio, addBeatAtPlayhead };

  return (
    <SelectionProvider store={selectionStore}>
    <LayoutProvider store={layoutStore}>
    <LibraryProvider store={libraryStore}>
    <ExportProvider store={exportStore}>
    <DraftsProvider store={draftsStore}>
    <EditorModelProvider value={editorModel}>
    <EditorViewProvider value={view}>
    <EditorActionsProvider value={editorActions}>
    <div className={`app ${screen} theme-${resolveTheme(preferences.theme, systemDark)} ${preferences.compact ? 'compact' : ''} ${preferences.reduceMotion ? 'reduce-motion' : ''} ${fileDragActive ? 'file-drag' : ''}`}>
      <input ref={customElementInput} type="file" hidden onChange={event => void importCustomElement(event.target.files)} />
      <input ref={mediaInput} type="file" hidden multiple accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={e => void importFiles(e.target.files)} />
      <input ref={videoInput} type="file" hidden multiple accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v" onChange={e => void importVideos(e.target.files)} />
      <input ref={replaceInput} type="file" hidden accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,video/x-m4v,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov,.m4v" onChange={e => { const file = e.target.files?.[0]; const id = replaceTargetId.current; e.target.value = ''; if (file && id) void replaceSceneMedia(id, file); }} />
      <input ref={audioInput} type="file" hidden accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,audio/webm,.mp3,.wav,.m4a,.aac,.ogg,.oga,.webm" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void importAudio(file); }} />
      {[...audio, ...cueAudio].map(clip => <AudioSource key={clip.id} id={clip.id} data={clip.data} register={(id, element) => { if (element) audioElements.current.set(id, element); else audioElements.current.delete(id); }} />)}
      <input ref={projectInput} type="file" hidden accept=".json,.pixcut" onChange={e => void openBrowserProject(e)} />
      <input ref={captionInput} type="file" hidden accept=".srt,.vtt,text/plain,text/vtt" onChange={e => void importCaptionFile(e.target.files)} />
      <input ref={fontInput} type="file" hidden accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" onChange={e => void importFontFile(e.target.files)} />

      {screen === 'home' ? <>
        <HomeSidebar storageLabel={storageLabel} projects={projects} openProject={openLibraryProject} setHomeSection={setHomeSection} homeSection={homeSection} setModal={setModal} updateState={updateState} setSettingsTab={setSettingsTab} updateProgress={updateProgress} updateInfo={updateInfo} appVersion={appVersion} />
<HomeMain deleted={{ items: deletedProjects, restore: restoreProject, purge: purgeProject }} goProjects={() => setHomeSection('projects')} batch={{ mode: batchMode, ids: batchIds, begin: () => setBatchMode(true), end: endBatch, favorite: batchFavorite, move: batchMove, remove: batchDelete }} openSettings={() => setModal('settings')} libraryReady={libraryReady} shortcutText={shortcutText} openProject={openLibraryProject} homeSection={homeSection} open={open} canEdit={canEdit} ready={ready} setModal={setModal} chooseImages={chooseImages} projects={projects} libraryQuery={libraryQuery} setLibraryQuery={setLibraryQuery} librarySort={librarySort} setLibrarySort={setLibrarySort} favoriteOnly={favoriteOnly} setFavoriteOnly={setFavoriteOnly} groupFilter={groupFilter} setGroupFilter={setGroupFilter} projectGroupsList={projectGroupsList} openGroupManager={openGroupManager} matchingProjects={matchingProjects} renderProjectCard={renderProjectCard} visibleProjects={visibleProjects} chooseTemplate={chooseTemplate} templateImage={templateImage} />
      </> : <>
        <EditorHeader goHome={goHome} name={name} canEdit={canEdit} setName={setName} project={project} run={run} status={status} tip={tip} runCommandId={runCommandId} session={session} ready={ready} save={save} scenes={scenes} exporting={exporting} openExportModal={openExportModal} />

        {missing.length > 0 && <div className="missing-banner" role="alert">
          <span className="missing-badge"><AlertTriangle size={16} /></span>
          <span className="missing-copy"><strong>{t('{files} missing', { files: mediaFileCount(missing.length) })}</strong><span>{t('This project still opens, but those clips stay empty until you relink them. Saving and exporting are paused.')}</span></span>
          <button className="button" onClick={() => setModal('missing')}><LinkIcon size={14} /> Relink media</button>
        </div>}

        {showHints && scenes.length > 0 && <div className="shortcut-hints" role="status">
          <span className="hint-title"><Sparkles size={13} /> Quick start</span>
          <span className="hint"><kbd>{shortcutText('playback.toggle')}</kbd> Play / pause</span>
          <span className="hint"><kbd>{shortcutText('clip.split')}</kbd> Split at playhead</span>
          <span className="hint"><kbd>{shortcutText('history.undo')}</kbd> Undo</span>
          <button className="text-button hint-dismiss" onClick={dismissHints}>{t('Got it')}</button>
        </div>}

        <div className="editor-body">
          <LibraryPanel tab={tab} setTab={setTab} tabTitles={tabTitles} audioLaneRef={audioLaneRef} selectedAudio={selectedAudio} setModal={setModal} mediaDragRef={mediaDragRef} setDropTarget={setDropTarget} playing={playing} modal={modal} sourceMedia={sourceMedia} setSelectedGlobalTextId={setSelectedGlobalTextId} captionInput={captionInput} fontTargetId={fontTargetId} fontInput={fontInput} previewingAudio={previewingAudio} savedTracks={savedTracks} recordedSounds={recordedSounds} position={position} allOverlays={allOverlays} />
          <PreviewPanel setModal={setModal} playing={playing} modal={modal} position={position} allOverlays={allOverlays} safeArea={safeArea} activeFormat={activeFormat} setActiveFormatId={setActiveFormatId} previewArea={previewArea} previewStage={previewStage} previewSize={previewSize} preview={preview} sceneVideo={sceneVideo} setVideoTick={setVideoTick} pipVideoElements={pipVideoElements} setPipVideoTick={setPipVideoTick} snapGuides={snapGuides} framingMode={framingMode} textBox={textBox} selectedTextVisible={selectedTextVisible} selectedElement={selectedElement} editingText={editingText} setTextDraft={setTextDraft} setEditingText={setEditingText} sceneLayerRank={sceneLayerRank} textDraft={textDraft} fadeAmount={fadeAmount} setPosition={setPosition} setPlaying={setPlaying} loop={loop} setLoop={setLoop} />
          <InspectorPanel selectedAudio={selectedAudio} activeFormat={activeFormat} framingMode={framingMode} setEditingText={setEditingText} propertyKind={propertyKind} setSelectedIds={setSelectedIds} setPrimarySelected={setPrimarySelected} selectionAnchor={selectionAnchor} audioInspector={audioInspector} elementInspector={elementInspector} inspectorScene={inspectorScene} setGlobalTextDraft={setGlobalTextDraft} propertyClipboard={propertyClipboard} textStartTicks={textStartTicks} textLayerLocal={textLayerLocal} previewLocalSeconds={previewLocalSeconds} textFocus={textFocus} setFramingMode={setFramingMode} renderOverlays={renderOverlays} />
        </div>

        <div className="splitter horizontal" onPointerDown={e => beginResize('timeline', timelineHeight, e.clientY)} />

        <TimelinePanel onLockedEdit={() => setNotice(t('This lane is locked. Unlock it to edit.'))} timelineControls={timelineControls} snapping={snapping} audioDisplay={audioDisplay} setAudioDisplay={setAudioDisplay} fileDragActive={fileDragActive} timelineScroll={timelineScroll} mediaDragRef={mediaDragRef} timelineRatio={timelineRatio} position={position} hasMediaOverlays={hasMediaOverlays} setTab={setTab} setTextFocus={setTextFocus} setPosition={setPosition} orderedLayers={orderedLayers} layerNumbers={layerNumbers} dropTarget={dropTarget} reorderId={reorderId} replacingSceneId={replacingSceneId} setDropTarget={setDropTarget} selectionAnchor={selectionAnchor} setPlaying={setPlaying} setContextMenu={setContextMenu} fadeDrag={fadeDrag} videoScenes={videoScenes} audioMix={audioMix} videoVolumeDraft={videoVolumeDraft} audioLanes={audioLanes} selectedAudio={selectedAudio} audioLaneRef={audioLaneRef} />
      </>}

      {contextMenu && <ClipContextMenu
        position={contextMenu}
        canEdit={canEdit}
        selectedCount={selectedCount}
        onReplace={() => { setContextMenu(null); requestReplaceImage(selectedScene?.id); }}
        availabilityFor={availabilityFor}
        tip={tip}
        shortcutText={shortcutText}
        onRun={id => { runCommandId(id); setContextMenu(null); }}
      />}

      {notice && <Toast message={notice} onDismiss={() => setNotice(t(''))} />}
      {error && <ErrorBanner message={error} onDismiss={() => setError(t(''))} />}

      {exporting && <ExportJobCard name={exportJob.name} phase={exportJob.phase} progress={exportProgress} elapsed={exportElapsed} cancelling={cancellingExport} onCancel={cancelExport} />}
      {modal && <div className="modal-backdrop"><section className={`modal ${modal === 'export' ? 'export-studio' : modal === 'new' ? 'project-setup' : modal === 'formats' ? 'format-studio' : modal === 'settings' ? 'settings-modal' : wideModal ? 'wide' : mediumModal ? 'medium' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header"><span className="eyebrow">{modalEyebrow}</span><IconButton label="Close dialog" onClick={requestCloseModal}><X size={20} /></IconButton></div>
        <Suspense fallback={null}>
        {modal === 'source' && sourcePreview ? <>
          <SourceModal sourcePreview={sourcePreview} previewVideo={previewVideo} sourcePreviewUrl={sourcePreviewUrl} previewMuted={previewMuted} setPreviewVideoDuration={setPreviewVideoDuration} setPreviewVideoTime={setPreviewVideoTime} setPreviewVideoPlaying={setPreviewVideoPlaying} previewList={previewList} switchPreview={switchPreview} previewIndex={previewIndex} previewVideoPlaying={previewVideoPlaying} togglePreviewPlayback={togglePreviewPlayback} previewVideoTime={previewVideoTime} previewVideoDuration={previewVideoDuration} seekPreview={seekPreview} togglePreviewMute={togglePreviewMute} previewVolume={previewVolume} changePreviewVolume={changePreviewVolume} appendMedia={appendMedia} selectedScene={selectedScene} addMediaPip={addMediaPip} setError={setError} />
        </> : modal === 'templates' ? <>
          <TemplatesModal projects={projects} templateQuery={templateQuery} setTemplateQuery={setTemplateQuery} templateCategory={templateCategory} setTemplateCategory={setTemplateCategory} templateMatches={templateMatches} canEdit={canEdit} chooseTemplate={chooseTemplate} templateImage={templateImage} />
        </> : modal === 'new' ? <>
          <NewProjectModal pendingTemplate={pendingTemplate} templateImage={templateImage} canEdit={canEdit} startTemplate={startTemplate} requestCloseModal={requestCloseModal} newProjectFps={newProjectFps} setNewProjectFps={setNewProjectFps} formatFilterChips={formatFilterChips} formatFilter={formatFilter} newFormatIds={newFormatIds} setNewFormatIds={setNewFormatIds} customFormatDraft={customFormatDraft} setCustomFormatDraft={setCustomFormatDraft} newFormatSelection={newFormatSelection} addNewCustomFormat={addNewCustomFormat} newCustomFormats={newCustomFormats} newFormatOutputs={newFormatOutputs} startWithFormats={startWithFormats} />
        </> : modal === 'rename' ? <>
          <RenameProjectModal renameDraft={renameDraft} setRenameDraft={setRenameDraft} renameProject={renameProject} requestCloseModal={requestCloseModal} />
        </> : modal === 'group' ? <>
          <GroupModal groupTarget={groupTarget} groupDraft={groupDraft} setGroupDraft={setGroupDraft} confirmGroupProject={confirmGroupProject} projectGroupsList={projectGroupsList} requestCloseModal={requestCloseModal} />
        </> : modal === 'groups' ? <>
          <GroupsModal projectGroupsList={projectGroupsList} groupDrafts={groupDrafts} setGroupDrafts={setGroupDrafts} saveGroupRename={saveGroupRename} removeGroup={removeGroup} requestCloseModal={requestCloseModal} />
        </> : modal === 'formats' ? <>
          <FormatsModal formatSection={formatSection} setFormatSection={setFormatSection} setFormatSearch={setFormatSearch} customFormatDraft={customFormatDraft} setCustomFormatDraft={setCustomFormatDraft} canEdit={canEdit} project={project} addCustomFormat={addCustomFormat} formatSearch={formatSearch} formatPlatform={formatPlatform} setFormatPlatform={setFormatPlatform} formatBrowserGroups={formatBrowserGroups} toggleFormatPreset={toggleFormatPreset} activeFormat={activeFormat} setActiveFormatId={setActiveFormatId} removeFormat={removeFormat} updateFormatSettings={updateFormatSettings} projectFormatOutputs={projectFormatOutputs} requestCloseModal={requestCloseModal} />
        </> : modal === 'delete' ? <>
          <DeleteProjectModal deleteTarget={deleteTarget} confirmDeleteProject={confirmDeleteProject} requestCloseModal={requestCloseModal} />
        </> : modal === 'missing' ? <>
          <MissingMediaModal missing={missing} relinking={relinking} relinkMissing={relinkMissing} requestCloseModal={requestCloseModal} />
        </> : modal === 'shortcuts' ? <>
          <ShortcutHelp settings={shortcuts} platform={platform} onOpenSettings={() => { setModal('settings'); setSettingsTab('shortcuts'); }} />
        </> : modal === 'palette' ? <>
          <h2 id="modal-title">{t('Command palette')}</h2><p>{t('Every action, searchable. Shortcuts reflect your current settings.')}</p>
          <CommandPalette platform={platform} bindings={shortcuts.bindings} availability={commandAvailability} onRun={runCommandId} onClose={requestCloseModal} />
        </> : modal === 'settings' ? <>
          <SettingsModal settingsTab={settingsTab} shortcutDirty={shortcutDirty} setNotice={setNotice} setSettingsTab={setSettingsTab} preferences={preferences} updatePreferences={updatePreferences} storageUsage={storageUsage} refreshAssetUsage={refreshAssetUsage} storageBusy={storageBusy} cleanStorage={cleanStorage} storageConfirm={storageConfirm} storageNote={storageNote} language={language} setLanguage={setLanguage} resetPreferences={resetPreferences} showHints={showHints} setShowHints={setShowHints} setSnapping={setSnapping} resetLayout={resetLayout} shortcuts={shortcuts} platform={platform} applyShortcuts={applyShortcuts} setShortcutDirty={setShortcutDirty} closeShortcutSettings={closeShortcutSettings} appVersion={appVersion} updateState={updateState} updateInfo={updateInfo} updateMessage={updateMessage} checkForUpdates={checkForUpdates} downloadUpdate={downloadUpdate} updateProgress={updateProgress} restartUpdate={restartUpdate} copyDownloadLink={copyDownloadLink} exporter={exporter} diagnostics={diagnostics} copyDiagnostics={copyDiagnostics} recheckExporter={recheckExporter} storageLabel={storageLabel} refreshStorage={refreshStorage} />
        </> : <>
          <ExportModal project={project} duration={duration} scenes={scenes} exportCodecs={exportCodecs} hardwareAvailable={hardwareAvailable} musicCredits={musicCredits} setNotice={setNotice} setError={setError} hasVideoScenes={hasVideoScenes} exportSettings={exportSettings} setExportSettings={setExportSettings} exportOutputs={exportOutputs} exportFormats={exportFormats} exportFilename={exportFilename} exporter={exporter} platform={platform} exporting={exporting} busy={busy} exportVideo={exportVideo} />
        </>}
        </Suspense>
      </section></div>}
    </div>
    </EditorActionsProvider>
    </EditorViewProvider>
    </EditorModelProvider>
    </DraftsProvider>
    </ExportProvider>
    </LibraryProvider>
    </LayoutProvider>
    </SelectionProvider>
  );
}
