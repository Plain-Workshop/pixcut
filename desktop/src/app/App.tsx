import { creditForClipName } from '../stores/music-library';
import { SOUND_EFFECTS, type SoundEffectId } from '../components/elements/sound-effects';
import { creditForRecordedClip, loadRecordedSounds, type RecordedSound } from '../stores/sound-library';
import { groupedSounds } from '../components/elements/sound-catalog';
import { ElementTextField } from '../components/elements/ElementTextField';
import { inspectorKind } from './inspector';
import { presetSize } from '../components/elements/designer';
import { ClipContextMenu } from './parts/ClipContextMenu';
import { Toast, ErrorBanner, ExportJobCard } from './parts/Notices';
import { BehaviorControls } from '../components/elements/BehaviorControls';
import { ELEMENT_CATALOG, elementPreset, elementDisplayName } from '../components/elements/catalog';
import { exportOutputFormat } from './export-progress';
import { registerCustomFonts } from '../components/text/fonts';
import { subsetCharacters } from '../components/text/subset-chars';
import { subsetFontBytes } from '../components/text/subset';
import { sourceSecondsAt, sourceSpan, speedAt, speedCurve } from '../components/preview/speed';
import { textLayersAsCaptions, toSrt } from '../components/text/captions-export';
import { applyTextMotion } from '../components/animation/keyframes';
import { KeyframeControls } from '../components/animation/KeyframeControls';
import { isAssetRef, resolveMediaSource } from '../components/preview/media-url';
import { assetExists } from '../stores/assets';
import { readPixcutBundle } from '../stores/pixcut-bundle';
import { MaskControls } from '../components/inspector/MaskControls';
import { ChromaControls } from '../components/inspector/ChromaControls';
import { videoGain } from '../components/preview/video-audio';
import { mediaClockPosition, videoSeekTarget } from '../components/preview/video-sync';
import { clampPipSource, pipFrameTarget } from '../components/preview/pip-playback';
import { resolvePreviewTarget } from '../components/preview/preview-target';
import { timelineOverlays, replaceOverlay, constrainOverlay, type TimelineOverlay } from '../components/elements/overlays';
import { sceneStack, stackIndex, stackZ, layerZ, newOverlayZ, overlaysForScene, type StackMove } from '../components/elements/stack';
import { StackOrder } from '../components/inspector/StackOrder';
import { actionAudio } from '../components/elements/sound';
import { playbackPosition } from '../components/preview/playback-clock';
import { LatestRenderQueue } from '../components/preview/render-queue';
import { loadMediaBin, saveMediaBin, uniqueMediaSources } from '../stores/media-bin';
import { missingAssets, projectAssetRefs, replaceAssetRef, type MissingAsset } from '../stores/missing-assets';
import { syncAudioElement } from '../components/preview/audio';
import { formatCount, isLocale, sceneCount, setLocale, t, type Locale } from '../i18n';
import { applyClipEq } from '../components/preview/eq';
import { audibleVideoWindows, duckGain } from '../components/preview/ducking';
import { AudioSource } from '../components/preview/AudioSource';
import { useUpdates } from './hooks/useUpdates';
import { useFormats } from './hooks/useFormats';
import { useSceneCommands } from './hooks/useSceneCommands';
import { useLibraryAudio } from './hooks/useLibraryAudio';
import { useStagePointer } from './hooks/useStagePointer';
import { usePanelLayout } from './hooks/usePanelLayout';
import { useElementPointer } from './hooks/useElementPointer';
import { useSourcePreview } from './hooks/useSourcePreview';
import { useProjectLibrary } from './hooks/useProjectLibrary';
import { ELEMENT_LABEL_DEFAULTS } from '../components/elements/symbols';
import { useCallback, useMemo, useEffect, useRef, useState, type ChangeEvent, type DragEvent as ReactDragEvent } from 'react';
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
import { HINTS_KEY } from './export-options';
import { MAX_GLOBAL_TEXT, MAX_PROJECT_FONTS, overlayScenes, audioMixOf, audioLaneGain, videoAudioGain, edit, emptyProject, frameRate, minTicks, projectScenes, sceneAt, sceneSeconds, secondsPerTick, secondsToTicks, ticksToSeconds, timecode, totalDuration, totalTicks, validateProject, type AudioClip, type AudioMix, type Command, type Project, type Scene, type Session, type TextLayer, type FormatVariant, type ElementKind, type ElementLayer } from '../stores/model';
import { drawPipClips, drawScene, drawProjectOverlays, drawProjectText, drawTransition, fadeOpacity, loadImage, textBoxLayout } from '../components/preview/render';
import { probeVideo } from '../components/preview/video';
import { createTextLayer, layerStartSeconds, layerVisibleAt, sceneTextLayers } from '../components/text/layers';
import { clampWeight, fontOption } from '../components/text/fonts';
import { FORMAT_FILTERS, FORMAT_PRESETS, filterFormatGroups, formatSlug, formatSize, groupFormatsByOutput, resolveSceneForFormat } from '../stores/formats';
import { messageFor } from './errors';
import { formatBytes, hasMedia, relativeTime, sortProjects } from './helpers';
import { backfillThumbnails, getLibraryProject, listProjects, saveLibraryProject, type ProjectSummary } from '../stores/library';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences, type Preferences } from '../stores/preferences';
import { TEMPLATES, buildTemplateProject, templatePreview, type TemplateDefinition } from '../templates/catalog';
import {
  COMMANDS,
  bindingMatchesEvent,
  detectPlatform,
  formatBinding,
  isTextEntryTarget,
  loadShortcutSettings,
  saveShortcutSettings,
  type CommandAvailability,
  
  type ShortcutSettings as ShortcutSettingsData,
} from '../shortcuts/registry';
import '../styles/styles.css';
import { NewProjectModal } from './modals/NewProjectModal';
import { ExportModal } from './modals/ExportModal';
import { SettingsModal } from './modals/SettingsModal';
import { MissingMediaModal } from './modals/MissingMediaModal';
import { DeleteProjectModal } from './modals/DeleteProjectModal';
import { FormatsModal } from './modals/FormatsModal';
import { GroupsModal } from './modals/GroupsModal';
import { GroupModal } from './modals/GroupModal';
import { RenameProjectModal } from './modals/RenameProjectModal';
import { TemplatesModal } from './modals/TemplatesModal';
import { SourceModal } from './modals/SourceModal';
import { TimelinePanel } from './screens/TimelinePanel';
import { EditorBody } from './screens/EditorBody';
import { EditorHeader } from './screens/EditorHeader';
import { HomeMain } from './screens/HomeMain';
import { ProjectThumb } from '../components/ProjectThumb';
import { HomeSidebar } from './screens/HomeSidebar';
import { useVideoExport } from './hooks/useVideoExport';
import { useSceneReplacement } from './hooks/useSceneReplacement';
import { useAudioActions } from './hooks/useAudioActions';
import { useMediaImport } from './hooks/useMediaImport';
import { usePipLayers } from './hooks/usePipLayers';

const INITIAL: Session = { project: emptyProject(), canUndo: false, canRedo: false };
const AVAILABLE: CommandAvailability = { disabled: false };

const RANGE_NAVIGATION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
// Codecs use different CRF scales; ProRes maps the value to a 422 profile.
const ELEMENTS = ELEMENT_CATALOG;
const ELEMENT_COLOR_DEFAULTS: Partial<Record<ElementKind, string>> = {
  subscribe: '#FF0033', like: '#0A66C2', bell: '#FFD166', comment: '#FFFFFF',
  share: '#6BE7FF', play: '#FFFFFF', progress: '#FF7A9E', location: '#FF6B6B',
  music: '#9D7CFF', check: '#7CF0B4', cross: '#FF7A9E', ring: '#9D7CFF',
  cursor: '#FFFFFF', underline: '#9D7CFF',
};
const ELEMENT_COLORS = ['#9D7CFF', '#FF7A9E', '#FFD166', '#6BE7FF', '#7CF0B4', '#FFFFFF'];
const elementName = elementDisplayName;


export default function App() {
  const [session, setSession] = useState(INITIAL), [screen, setScreen] = useState<'home' | 'editor'>('home');
  const [homeSection, setHomeSection] = useState<'home' | 'projects'>('home');
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [playing, setPlaying] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]), [primarySelected, setPrimarySelected] = useState<string | null>(null), [position, setPosition] = useState(0);
  const [tab, setTab] = useState<'media' | 'text' | 'elements' | 'audio' | 'templates'>('media'), [modal, setModal] = useState<'source' | 'templates' | 'export' | 'new' | 'shortcuts' | 'palette' | 'settings' | 'delete' | 'rename' | 'group' | 'groups' | 'formats' | 'missing' | null>(null);
  const [settingsTab, setSettingsTab] = useState<'general' | 'appearance' | 'editing' | 'shortcuts' | 'updates' | 'privacy'>('general');
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
  const [exportQuality, setExportQuality] = useState('standard');
  const [exportCodec, setExportCodec] = useState<bridge.ExportCodec>('h264');
  const [exportContainer, setExportContainer] = useState<bridge.ExportContainer>('mp4');
  const [exportSpeed, setExportSpeed] = useState<'fast' | 'medium' | 'slow'>('medium');
  const [hardwareAvailable, setHardwareAvailable] = useState(false);

  const [exportHardware, setExportHardware] = useState(false);
  const [exportAudio, setExportAudio] = useState(true);
  const [saveCredits, setSaveCredits] = useState(true);
  const [exportCodecs, setExportCodecs] = useState<bridge.ExportCodec[]>([]);
  const [exportResolution, setExportResolution] = useState('project');
  const [exportFps, setExportFps] = useState('project');
  const [overlayDraft, setOverlayDraft] = useState<TimelineOverlay | null>(null);
  const overlayDraftRef = useRef<TimelineOverlay | null>(null);
  const [draggingOverlay, setDraggingOverlay] = useState(false);
  const [loop, setLoop] = useState(false);
  const [snapGuides, setSnapGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [elementCategory, setElementCategory] = useState('All');
  const [elementSearch, setElementSearch] = useState('');
  const [elementCollection, setElementCollection] = useState('All');
  const [elementLimit, setElementLimit] = useState(40);
  const filteredElements = useMemo(() => ELEMENTS.filter(p => (elementCategory === 'All' || p.category === elementCategory) && (elementCollection === 'All' || p.collection === elementCollection) && `${p.label} ${p.collectionLabel} ${p.text} ${p.icon}`.toLocaleLowerCase().includes(elementSearch.trim().toLocaleLowerCase())), [elementCategory, elementCollection, elementSearch]);
  const [templateQuery, setTemplateQuery] = useState(''), [mediaQuery, setMediaQuery] = useState('');
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
  const [audioDraft, setAudioDraft] = useState<AudioClip | null>(null);
  const [mixDraft, setMixDraft] = useState<AudioMix | null>(null);
  const [videoVolumeDraft, setVideoVolumeDraft] = useState<{ id: string; value: number } | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
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
  const [editTarget, setEditTarget] = useState<'scene' | 'text' | 'element' | 'audio'>('scene');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [videoTick, setVideoTick] = useState(0);
  const [pipVideoTick, setPipVideoTick] = useState(0);
  const [name, setName] = useState('Untitled story');
  const [editingText, setEditingText] = useState(false), [safeArea, setSafeArea] = useState(false);
  const [textDraft, setTextDraft] = useState({ title: '', subtitle: '' });
  const [selectedTextLayerId, setSelectedTextLayerId] = useState<string | null>(null);
  const [selectedGlobalTextId, setSelectedGlobalTextId] = useState<string | null>(null);
  const [selectedPipId, setSelectedPipId] = useState<string | null>(null);
  const [pipDraft, setPipDraft] = useState<Scene | null>(null);
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
  const [exportFormatIds, setExportFormatIds] = useState<string[]>([]);
  const [framingMode, setFramingMode] = useState(false);
  const [, setFontTick] = useState(0);
  const [previewScene, setPreviewScene] = useState<Scene | null>(null);
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
  const { setLayout, libraryWidth, inspectorWidth, timelineHeight, timelineZoom, beginResize, changeTimelineZoom } = usePanelLayout();

  useEffect(() => {
    const element = timelineScroll.current;
    if (!element) return;
    const ratio = duration > 0 ? position / duration : 0;
    const frame = requestAnimationFrame(() => { element.scrollLeft = Math.max(0, ratio * element.scrollWidth - element.clientWidth * .45); });
    return () => cancelAnimationFrame(frame);
  }, [timelineZoom]);

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
  const [audioLibraryTab,setAudioLibraryTab]=useState<'project'|'music'|'sounds'>('project');
  const [musicMood,setMusicMood]=useState('All');
  const [soundQuery,setSoundQuery]=useState('');
  const [recordedSounds,setRecordedSounds]=useState<RecordedSound[]>([]);
  useEffect(()=>{let live=true;void loadRecordedSounds().then(list=>{if(live)setRecordedSounds(list);});return()=>{live=false;};},[]);
  const [openSoundGroup,setOpenSoundGroup]=useState<string|null>(null);
  const [hoveredElement,setHoveredElement]=useState<string|null>(null);
  const [hoverEntrance,setHoverEntrance]=useState<string|null>(null);
  const [audioDisplay,setAudioDisplay]=useState<'spectrogram'|'waveform'>('spectrogram');
  const [hoveredMedia,setHoveredMedia]=useState<string|null>(null);

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
      if (!paths.length) { setError('Drop a PNG, JPEG, WebP, MP4, MOV, M4V, or WebM file.'); return; }
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
  const useHardware = exportHardware && hardwareAvailable && (exportCodec === 'h264' || exportCodec === 'hevc');
  const displayAspect = project.aspect;
  const cueAudio = useMemo(() => actionAudio(project), [project]);
  const soundGroups = useMemo(() => groupedSounds(soundQuery), [soundQuery]);
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
  const timelineRatio = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  const frameSeconds = secondsPerTick(project.timebase);
  const activeInfo = sceneAt(project, position), active = activeInfo?.scene, activeStart = activeInfo?.start ?? 0;
  const selectedScenes = selectedIds.length
    ? selectedIds.map(id => scenes.find(scene => scene.id === id)).filter((scene): scene is Scene => Boolean(scene))
    : active ? [active] : [];
  const primaryScene = primarySelected ? selectedScenes.find(scene => scene.id === primarySelected) : undefined;
  const selectedScene = primaryScene ?? selectedScenes.at(-1) ?? active;
  const selectedCount = selectedScenes.length;
  const hasSceneSelection = selectedIds.length > 0;
  const isSelected = (id: string) => selectedIds.includes(id);
  const previewTarget = resolvePreviewTarget(playing, active, previewScene);
  // While a text drag or inline edit is previewing, follow the draft so the
  // selection box, guides, and canvas text stay in the same place.
  const projectTextScene = useMemo<Scene | null>(() => project.globalText?.length ? {
    id: `${project.id}-project-text`, startTicks: 0, sourceInTicks: 0, durationTicks: Math.max(1, projectTicks),
    name: 'Project text', image: '', title: '', subtitle: '', color: '#ffffff', fit: 'cover',
    textLayers: project.globalText,
  } : null, [project.id, project.globalText, projectTicks]);
  const selectedGlobalText = selectedGlobalTextId ? (project.globalText ?? []).find(layer => layer.id === selectedGlobalTextId) ?? null : null;
  const pipScenes = overlayScenes(project);
  const selectedPip = selectedPipId ? pipScenes.find(clip => clip.id === selectedPipId) ?? null : null;
  const renderPipScenes = pipDraft ? pipScenes.map(clip => clip.id === pipDraft.id ? pipDraft : clip) : pipScenes;
  const pipVideoScenes = renderPipScenes.filter(clip => clip.mediaKind === 'video');
  const pipVideoSignature = pipVideoScenes.map(clip => `${clip.id}:${clip.image.length}:${clip.videoPoster?.length ?? 0}:${clip.startTicks}:${clip.durationTicks}:${clip.sourceInTicks ?? 0}`).join('|');
  const activePip = pipDraft?.id === selectedPip?.id ? pipDraft : selectedPip;
  const selectedTextScene = selectedGlobalText ? projectTextScene : (previewScene && selectedScene && previewScene.id === selectedScene.id ? previewScene : selectedScene);
  const selectedTextLayers = selectedGlobalText ? [selectedGlobalText] : (selectedTextScene ? sceneTextLayers(selectedTextScene) : []);
  const selectedTextLayer = selectedGlobalText ?? selectedTextLayers.find(layer => layer.id === selectedTextLayerId) ?? selectedTextLayers[0] ?? null;
  const allOverlays = useMemo(() => timelineOverlays(project), [project]);
  const layerWeight = (element: TimelineOverlay) => {
    if (typeof element.z === 'number') return element.z;
    if (element.legacySceneId) {
      const owner = projectScenes(project).find(scene => scene.id === element.legacySceneId);
      const index = owner?.elements?.findIndex(item => item.id === element.legacyId) ?? 0;
      return layerZ(element, 'element', Math.max(0, index));
    }
    const index = (project.overlays ?? []).findIndex(item => item.id === element.id);
    return layerZ(element, 'overlay', Math.max(0, index));
  };
  const orderedLayers = useMemo(() => [...allOverlays].sort((a, b) => layerWeight(b) - layerWeight(a) || a.startTicks - b.startTicks || a.id.localeCompare(b.id)), [allOverlays]);
  const layerNumbers = useMemo(() => new Map([...orderedLayers].reverse().map((element, index) => [element.id, index + 1])), [orderedLayers]);
  const hasMediaOverlays = allOverlays.some(element => element.kind === 'image' || element.kind === 'video');
  const selectedElement = overlayDraft?.id === selectedElementId ? overlayDraft : allOverlays.find(element => element.id === selectedElementId) ?? null;
  const renderOverlays = useMemo(() => (project.overlays ?? []).filter(e => e.id !== overlayDraft?.id).concat(overlayDraft ? [overlayDraft] : []), [project.overlays, overlayDraft]);
  // One stack for everything drawn over the selected scene, so text, elements
  // and video overlays can be raised or lowered across each other.
  const sceneLayerStack = useMemo(() => {
    const owner = overlayDraft?.legacySceneId && overlayDraft.legacyId && selectedScene?.id === overlayDraft.legacySceneId
      ? { ...selectedScene, elements: (selectedScene.elements ?? []).filter(element => element.id !== overlayDraft.legacyId) }
      : selectedScene;
    return sceneStack(owner, overlaysForScene(owner, renderOverlays));
  }, [selectedScene, renderOverlays, overlayDraft]);
  const sceneLayerRank = useMemo(() => new Map(sceneLayerStack.map((entry, index) => [`${entry.kind}:${entry.id}`, index])), [sceneLayerStack]);
  const inspectorScene = useMemo(() => selectedScene ? resolveSceneForFormat(selectedScene, activeFormat) : null, [selectedScene, activeFormat]);
  const previewLocalSeconds = previewTarget && active && previewTarget.id === active.id ? Math.max(0, position - activeStart) : 0;
  const videoScene = previewTarget?.mediaKind === 'video' ? previewTarget : null;
  const textLayerLocal = selectedTextLayer ? (selectedGlobalText ? position : previewLocalSeconds) - ticksToSeconds(selectedTextLayer.startTicks, project.timebase) : 0;
  const textBox = selectedTextLayer ? textBoxLayout(applyTextMotion(selectedTextLayer, textLayerLocal), displayAspect, activeSize) : null;
  const selectedTextVisible = selectedTextLayer ? layerVisibleAt(selectedTextLayer, selectedGlobalText ? position : previewLocalSeconds, project.timebase) : false;
  const textStartTicks = selectedGlobalText
    ? Math.min(Math.max(0, secondsToTicks(position, project.timebase) - selectedGlobalText.startTicks), Math.max(0, selectedGlobalText.durationTicks - 1))
    : selectedScene ? Math.min(Math.max(0, secondsToTicks(position - ticksToSeconds(selectedScene.startTicks, project.timebase), project.timebase)), Math.max(0, selectedScene.durationTicks - 1)) : 0;
  const activeIndex = active ? scenes.findIndex(scene => scene.id === active.id) : -1;
  const nextScene = activeIndex >= 0 ? scenes[activeIndex + 1] : undefined;
  const previewTransition = active?.transition && nextScene && previewTarget?.id === active.id
    ? (() => {
      const sceneDuration = sceneSeconds(active, project.timebase);
      const start = Math.max(0, sceneDuration - active.transition!.duration);
      if (previewLocalSeconds < start) return null;
      return { type: active.transition!.type, progress: Math.min(1, (previewLocalSeconds - start) / active.transition!.duration), next: nextScene };
    })()
    : null;
  const rawPreviewScene = previewScene ? scenes.find(scene => scene.id === previewScene.id) : undefined;
  const framingStaged = Boolean(previewScene && rawPreviewScene && (previewScene.imageX !== rawPreviewScene.imageX || previewScene.imageY !== rawPreviewScene.imageY || previewScene.imageZoom !== rawPreviewScene.imageZoom || previewScene.fit !== rawPreviewScene.fit || previewScene.framingBackground !== rawPreviewScene.framingBackground));
  const resolvedPreviewTarget = previewTarget ? resolveSceneForFormat(overlayDraft?.legacySceneId === previewTarget.id ? { ...previewTarget, elements: previewTarget.elements?.filter(e => e.id !== overlayDraft.legacyId) } : previewTarget, activeFormat) : null;
  const sceneForPreview = resolvedPreviewTarget && framingStaged && previewScene ? { ...resolvedPreviewTarget, imageX: previewScene.imageX, imageY: previewScene.imageY, imageZoom: previewScene.imageZoom, fit: previewScene.fit, framingBackground: previewScene.framingBackground } : resolvedPreviewTarget;
  const resolvedNextScene = previewTransition?.next ? resolveSceneForFormat(previewTransition.next, activeFormat) : undefined;
  const filteredScenes = sourceMedia.filter(s => s.name.toLowerCase().includes(mediaQuery.trim().toLowerCase()));

  const { sourcePreview, setSourcePreview, previewVideo, sourcePreviewUrl, previewMuted, setPreviewVideoDuration, setPreviewVideoTime, setPreviewVideoPlaying, previewList, previewIndex, previewVideoPlaying, previewVideoTime, previewVideoDuration, previewVolume, previewMedia, switchPreview, togglePreviewPlayback, seekPreview, changePreviewVolume, togglePreviewMute } = useSourcePreview({ modal, setModal, setPlaying, filteredScenes, sourceMedia });
  const canEdit = ready && !busy;

  const refreshLibrary = useCallback(async () => {
    try {
      const listed = await listProjects();
      setProjects(sortProjects(listed));
      void backfillThumbnails(listed).then(fixed => { if (fixed) setProjects(current => current.map(item => { const next = fixed.find(entry => entry.id === item.id); return next?.thumbnail && !item.thumbnail ? { ...item, thumbnail: next.thumbnail } : item; })); }).catch(() => {});
    }
    catch (e) { setError(`Project library could not be read. ${messageFor(e)}`); }
    finally { setLibraryReady(true); }
  }, []);

  function updatePreferences(patch: Partial<Preferences>) {
    setPreferences(current => ({ ...current, ...patch }));
  }

  function toggleSnapping() {
    setSnapping(value => {
      const next = !value;
      setPreferences(current => ({ ...current, snapping: next }));
      return next;
    });
  }

  function resetPreferences() {
    setPreferences({ ...DEFAULT_PREFERENCES });
    setSnapping(DEFAULT_PREFERENCES.snapping);
    setShowHints(true);
    try { localStorage.removeItem(HINTS_KEY); } catch { /* optional */ }
    setNotice('Preferences reset to their defaults.');
  }

  function refreshStorage() {
    setStorageLabel('Checking local storage…');
    navigator.storage?.estimate?.().then(({ usage, quota }) => {
      setStorageLabel(`${formatBytes(usage ?? 0)} used${quota ? ` of ${formatBytes(quota)} available` : ''}`);
    }).catch(() => setStorageLabel('Storage usage is unavailable in this preview.'));
  }

  function recheckExporter() {
    bridge.exporterAvailable().then(available => { setExporter(available); setNotice(available ? 'FFmpeg is ready for MP4 export.' : 'FFmpeg was not found on this device.'); }).catch(error => setError(messageFor(error)));
  }

  const { appVersion, updateState, updateInfo, updateProgress, updateMessage, checkForUpdates, downloadUpdate, restartUpdate, copyDownloadLink } = useUpdates({ automaticUpdates: preferences.automaticUpdates, home: screen === 'home', exporting, setNotice });

  useEffect(() => { savePreferences(preferences); }, [preferences]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);

  useEffect(() => {
    if (modal !== 'settings' || settingsTab !== 'privacy') return;
    let cancelled = false;
    navigator.storage?.estimate?.().then(({ usage, quota }) => {
      if (cancelled) return;
      setStorageLabel(`${formatBytes(usage ?? 0)} used${quota ? ` of ${formatBytes(quota)} available` : ''}`);
    }).catch(() => { if (!cancelled) setStorageLabel('Storage usage is unavailable in this preview.'); });
    return () => { cancelled = true; };
  }, [modal, settingsTab]);

  function diagnostics() {
    return [
      `PixCut Desktop ${appVersion}`,
      `Build: ${__BUILD_SHA__.slice(0, 7)} · ${__BUILD_DATE__}`,
      `Runtime: ${bridge.native ? 'native Tauri' : 'browser preview'}`,
      `Platform: ${platform}`,
      `Project schema: ${latestProject.current.schema_version}`,
      `Project: ${latestProject.current.aspect} · ${frameRate(latestProject.current.timebase).toFixed(0)} fps · ${totalDuration(latestProject.current).toFixed(1)} s`,
      `FFmpeg: ${exporter ? 'available' : 'not found'}`,
      `Preferences: ${preferences.compact ? 'compact' : 'comfortable'} · ${preferences.reduceMotion ? 'reduced motion' : 'full motion'} · autosave ${preferences.autosaveMs} ms`,
    ].join('\n');
  }

  function copyDiagnostics() {
    const text = diagnostics();
    if (!navigator.clipboard) { setNotice('Clipboard access is unavailable in this preview.'); return; }
    navigator.clipboard.writeText(text).then(() => setNotice('Build diagnostics copied.')).catch(error => setError(messageFor(error)));
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

  useEffect(() => { bridge.initialize().then(s => { setSession(s); latestProject.current = s.project; setName(s.project.name); }).catch(e => setError(`Recovery could not be loaded. ${messageFor(e)}`)).finally(() => setReady(true)); bridge.exporterAvailable().then(setExporter).catch(() => setExporter(false)); }, []);
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
    if (!bridge.native || modal !== 'settings' || settingsTab !== 'general') return;
    void refreshAssetUsage();
  }, [modal, settingsTab]);

  useEffect(() => { void refreshLibrary(); }, [refreshLibrary]);
  useEffect(() => {
    void bridge.setAppMenu(language).catch(() => { /* the native menu is optional in the browser preview */ });
  }, [language]);
  useEffect(() => { if (screen === 'home') { void refreshLibrary(); refreshStorage(); } }, [screen, refreshLibrary]);
  useEffect(() => { if (screen !== 'home' || homeSection !== 'projects') endBatch(); }, [screen, homeSection]);
  const [missingCounts, setMissingCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (screen !== 'home' || !libraryReady) return;
    let cancelled = false;
    void (async () => {
      const found: Record<string, number> = {};
      for (const entry of projects.slice(0, 12)) {
        try {
          const saved = await getLibraryProject(entry.id);
          const refs = saved ? projectAssetRefs(saved) : [];
          if (!refs.length) continue;
          const lost = bridge.native
            ? await bridge.missingAssetRefs(refs)
            : (await Promise.all(refs.map(async reference => await assetExists(reference.slice('pixcut-asset:'.length)) ? null : reference))).filter(Boolean);
          if (lost.length) found[entry.id] = lost.length;
        } catch { /* a card without a badge is better than a failed library */ }
        if (cancelled) return;
      }
      if (!cancelled) setMissingCounts(found);
    })();
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
  useEffect(() => {
    if (!modal) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [modal]);
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(id); }, [notice]);

  function optimisticScene(scene: Scene) {
    const before = latestProject.current;
    const next = edit(before, { type: 'update', scene });
    latestProject.current = next;
    setSession(current => ({ ...current, project: next }));
    return before;
  }

  const run = useCallback((command: Command): Promise<boolean> => {
    const light = (value: Command) => value.type === 'order' || value.type === 'update' || value.type === 'updateMany' || value.type === 'audio' || value.type === 'audioMix' || value.type === 'overlays';
    if (operation.current) {
      if (command.type === 'update') {
        const queued = sceneQueue.current;
        const last = queued.at(-1);
        if (last?.type === 'update' && last.scene.id === command.scene.id) queued[queued.length - 1] = command;
        else queued.push(command);
      } else {
        sceneQueue.current.push(command);
        if (!light(command)) {
          setBusy(true);
          setPlaying(false);
        }
      }
      return pending.current;
    }
    operation.current = true;
    if (!light(command)) { setBusy(true); setPlaying(false); }
    setStatus('Saving…');
    const task = (async () => {
      let current: Command | undefined = command;
      let success = true;
      while (current) {
        if (!light(current)) { setBusy(true); setPlaying(false); }
        try {
          if (current.type === 'order') {
            // Compute the same edit Rust will make, then ask Rust to record it.
            // The answer carries history flags only, never a project payload.
            const project = edit(latestProject.current, current);
            const history = await bridge.applyOrder(current);
            latestProject.current = project;
            setSession({ project, ...history });
          } else {
            const next = await bridge.dispatch(current);
            latestProject.current = next.project;
            setSession(next);
          }
          setStatus('Saved');
        } catch (e) {
          success = false;
          sceneQueue.current = [];
          setError(messageFor(e));
          setStatus('Changes not saved');
          break;
        }
        current = sceneQueue.current.shift();
      }
      operation.current = false;
      setBusy(false);
      return success;
    })();
    pending.current = task;
    return task;
  }, []);

  useEffect(() => { positionRef.current = position; }, [position]);
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
        if (!url) { setError('That video is missing from the local store. Relink the clip.'); return; }
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
        if (!url) { setError('That video is missing from the local store. Relink the clip.'); return; }
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

  const save = useCallback(async () => {
    if (missingAssets(latestProject.current, presentRefs).length) { setError('Relink missing media before saving this project.'); return; }
    try { await pending.current; await persistCurrent(); if (await bridge.saveProject(latestProject.current)) setNotice(bridge.native ? 'Project saved as a .pixcut package with its media files.' : 'Project file downloaded. A local copy is also saved on this device.'); } catch (e) { setError(messageFor(e)); }
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

  function shortcutText(id: string) {
    const binding = shortcuts.bindings[id] ?? '';
    return binding ? formatBinding(binding, platform) : 'Unassigned';
  }

  function availabilityFor(id: string): CommandAvailability {
    if (exporting && id === 'export.open') return { disabled: true, reason: 'An export is already running.' };
    const editor = screen === 'editor';
    const hasProject = scenes.length > 0;
    const scene = selectedScene;
    const sceneStartTicks = scene?.startTicks ?? 0;
    const sceneOffsetTicks = secondsToTicks(position, project.timebase) - sceneStartTicks;
    const splitMinimum = minTicks(project.timebase);
    switch (id) {
      case 'project.new': return ready ? AVAILABLE : { disabled: true, reason: 'PixCut is still loading.' };
      case 'project.open': return canEdit ? AVAILABLE : { disabled: true, reason: 'Finish the current operation first.' };
      case 'project.save': return ready ? AVAILABLE : { disabled: true, reason: 'PixCut is still loading.' };
      case 'project.import': return canEdit ? AVAILABLE : { disabled: true, reason: 'Finish the current operation first.' };
      case 'export.open': return hasProject && ready && !busy ? AVAILABLE : { disabled: true, reason: hasProject ? 'PixCut is busy.' : 'Add at least one scene to export.' };
      case 'history.undo': return session.canUndo && canEdit ? AVAILABLE : { disabled: true, reason: session.canUndo ? 'Finish the current operation first.' : 'Nothing to undo.' };
      case 'history.redo': return session.canRedo && canEdit ? AVAILABLE : { disabled: true, reason: session.canRedo ? 'Finish the current operation first.' : 'Nothing to redo.' };
      case 'playback.toggle':
      case 'playback.forward':
      case 'playback.reverse':
      case 'playback.stop':
        if (!editor) return { disabled: true, reason: 'Open a story to use playback.' };
        if (!duration) return { disabled: true, reason: 'Add a scene to play.' };
        return canEdit ? AVAILABLE : { disabled: true, reason: 'Finish the current operation first.' };
      case 'clip.split':
        if (!editor) return { disabled: true, reason: 'Open a story to edit clips.' };
        if (!canEdit) return { disabled: true, reason: 'Finish the current operation first.' };
        if (editTargetRef.current === 'audio') {
          const audioClip = audio.find(item => item.id === audioTargetRef.current) ?? selectedAudio;
          if (!audioClip) return { disabled: true, reason: 'Select an audio clip first.' };
          const audioOffsetTicks = secondsToTicks(position, project.timebase) - audioClip.startTicks;
          return audioOffsetTicks >= splitMinimum && audioClip.durationTicks - audioOffsetTicks >= splitMinimum ? AVAILABLE : { disabled: true, reason: 'Place the playhead at least half a second inside the selected audio clip.' };
        }
        if (!selectedScenes.length) return { disabled: true, reason: 'Select a clip first.' };
        if (selectedScenes.length !== 1) return { disabled: true, reason: 'Select one clip to split.' };
        return scene && sceneOffsetTicks >= splitMinimum && scene.durationTicks - sceneOffsetTicks >= splitMinimum ? AVAILABLE : { disabled: true, reason: 'Place the playhead at least half a second inside the selected clip.' };
      case 'clip.delete':
      case 'clip.ripple_delete':
        if (!editor) return { disabled: true, reason: 'Open a story to edit clips.' };
        if (editTargetRef.current !== 'audio' && !selectedScenes.length || editTargetRef.current === 'audio' && !audioTargetRef.current) return { disabled: true, reason: 'Select a clip first.' };
        return canEdit ? AVAILABLE : { disabled: true, reason: 'Finish the current operation first.' };
      case 'clip.duplicate':
        if (!editor) return { disabled: true, reason: 'Open a story to edit clips.' };
        if (!selectedScenes.length) return { disabled: true, reason: 'Select a clip first.' };
        return canEdit ? AVAILABLE : { disabled: true, reason: 'Finish the current operation first.' };
      case 'timeline.prev_frame':
      case 'timeline.next_frame':
        return editor && duration > 0 ? AVAILABLE : { disabled: true, reason: 'Add a scene to step through frames.' };
      case 'timeline.snapping':
      case 'view.safe_area':
        return editor ? AVAILABLE : { disabled: true, reason: 'Open a story to use editor controls.' };
      case 'edit.select_all':
        return scenes.length && canEdit ? AVAILABLE : { disabled: true, reason: 'Open a project with scenes first.' };
      case 'edit.deselect':
        return AVAILABLE;
      case 'beat.add':
        return projectTicks && canEdit ? AVAILABLE : { disabled: true, reason: 'Add a scene before placing a beat.' };
      case 'text.add':
        return selectedScene && canEdit ? AVAILABLE : { disabled: true, reason: 'Select a scene first.' };
      default: return AVAILABLE;
    }
  }

  function tip(id: string, label: string) {
    const state = availabilityFor(id);
    return `${label} · ${shortcutText(id)}${state.disabled && state.reason ? ` — ${state.reason}` : ''}`;
  }

  function applyShortcuts(next: ShortcutSettingsData) {
    try { saveShortcutSettings(next); } catch (e) { setError(`Shortcuts could not be saved. ${messageFor(e)}`); return false; }
    setShortcuts(next);
    setNotice('Shortcuts applied everywhere: tooltips, help, and the command palette.');
    return true;
  }

  function dismissHints() {
    setShowHints(false);
    updatePreferences({ showHints: false });
    try { localStorage.setItem(HINTS_KEY, '1'); } catch { /* local preferences are optional */ }
  }

  function copySceneProperties(source: Scene) {
    setPropertyClipboard({
      textLayers: structuredClone(source.textLayers ?? []),
      brightness: source.brightness ?? 1,
      contrast: source.contrast ?? 1,
      saturation: source.saturation ?? 1,
      exposure: source.exposure ?? 0,
      highlights: source.highlights ?? 0,
      shadows: source.shadows ?? 0,
      temperature: source.temperature ?? 0,
      tint: source.tint ?? 0,
      filter: source.filter ?? 'none',
      filterIntensity: source.filterIntensity ?? 100,
      imageX: source.imageX ?? 0,
      imageY: source.imageY ?? 0,
      imageZoom: source.imageZoom ?? 1,
      framingBackground: source.framingBackground ?? '#000000',
      textBackdropEnabled: source.textBackdropEnabled ?? false,
      textBackdropColor: source.textBackdropColor ?? '#000000',
      textBackdropOpacity: source.textBackdropOpacity ?? 45,
      textBackdropBlur: source.textBackdropBlur ?? 18,
      textBackdropPadding: source.textBackdropPadding ?? 24,
      textBackdropRadius: source.textBackdropRadius ?? 16,
      textBackdropNoise: source.textBackdropNoise ?? 8,
      textStrokeColor: source.textStrokeColor ?? '#000000',
      textOutlineEnabled: source.textOutlineEnabled ?? false,
      textStrokeWidth: source.textStrokeWidth ?? 0,
      textShadowColor: source.textShadowColor ?? '#000000',
      textShadowEnabled: source.textShadowEnabled ?? false,
      textShadowIntensity: source.textShadowIntensity ?? 60,
      textShadowBlur: source.textShadowBlur ?? 0,
      textShadowOffsetX: source.textShadowOffsetX ?? 0,
      textShadowOffsetY: source.textShadowOffsetY ?? 0,
      textGlowEnabled: source.textGlowEnabled ?? false,
      textGlowColor: source.textGlowColor ?? '#FFFFFF',
      textGlowBlur: source.textGlowBlur ?? 24,
      textGlowIntensity: source.textGlowIntensity ?? 55,
      textX: source.textX ?? 0.09,
      textY: source.textY ?? 0.78,
      textWidth: source.textWidth ?? 0.82,
      textAlign: source.textAlign ?? 'left',
      textFont: source.textFont ?? 'inter',
      textFontWeight: source.textFontWeight ?? 600,
      textFontStyle: source.textFontStyle ?? 'normal',
      textSize: source.textSize ?? 0.068,
      textLineHeight: source.textLineHeight ?? 1.2,
      textLetterSpacing: source.textLetterSpacing ?? 0,
      textRotation: source.textRotation ?? 0,
      textOpacity: source.textOpacity ?? 100,
      textSubtitleScale: source.textSubtitleScale ?? 0.4,
    });
    setNotice('Color, look, text layout, and text-effect properties copied. Select another clip to paste them.');
  }

  function notifyPasted() {
    setNotice('Color, look, and text effects pasted.');
  }

  function selectTextLayer(id: string | null) {
    setTab('text');
    setEditTarget('text');
    setSelectedElementId(null);
    setSelectedGlobalTextId(null);
    setGlobalTextDraft(null);
    setSelectedPipId(null);
    setSelectedTextLayerId(id);
    if (!id || !selectedScene) return;
    const layer = sceneTextLayers(selectedScene).find(item => item.id === id);
    if (!layer) return;
    setPosition(ticksToSeconds(selectedScene.startTicks, project.timebase) + layerStartSeconds(layer, project.timebase));
  }

  function selectGlobalText(id: string) {
    const layer = (project.globalText ?? []).find(item => item.id === id);
    if (!layer) return;
    setTab('text'); setEditTarget('text');
    setSelectedElementId(null); setSelectedTextLayerId(null); setSelectedGlobalTextId(id);
    setEditingText(false);
    setPosition(ticksToSeconds(layer.startTicks, project.timebase));
  }

  function addProjectText() {
    if (!canEdit || !projectTicks) { setNotice('Add a scene before adding project text.'); return; }
    if ((project.globalText?.length ?? 0) >= MAX_GLOBAL_TEXT) { setNotice(`A project supports up to ${MAX_GLOBAL_TEXT} project text layers.`); return; }
    const startTicks = Math.min(Math.max(0, secondsToTicks(positionRef.current, project.timebase)), projectTicks - 1);
    const layer = createTextLayer(Math.max(1, projectTicks - startTicks), { startTicks, y: .84, size: .052 });
    void run({ type: 'globalText', layers: [...(project.globalText ?? []), layer] }).then(ok => {
      if (!ok) return;
      setEditTarget('text'); setSelectedElementId(null); setSelectedTextLayerId(null); setSelectedGlobalTextId(layer.id);
      setTab('text'); setTextFocus(value => value + 1);
      setNotice('Project text added. It stays on screen across every scene.');
    });
  }

  function replaceSceneTextLayers(scene: Scene, layers: TextLayer[]): Scene {
    return { ...scene, textLayers: layers, title: layers[0]?.title ?? '', subtitle: layers[0]?.subtitle ?? '' };
  }

  function addElement(presetId: string) {
    const preset = ELEMENT_CATALOG.find(item => item.id === presetId);
    if (!preset) return;
    const kind = preset.kind;
    if (!selectedScene || !canEdit) { setNotice('Select a scene first.'); return; }
    const count = allOverlays.length;
    if (count >= 64) { setNotice('This project already has 64 overlays.'); return; }
    const element: ElementLayer = {
      id: crypto.randomUUID(), kind, presetId, z: newOverlayZ(sceneLayerStack), label: preset.text, ...(preset.behavior ? { behavior: preset.behavior } : {}), x: .5 + (count % 3) * .035, y: .5 + (count % 2) * .035, ...presetSize(preset, activeSize),
      rotation: 0, color: preset?.color ?? ELEMENT_COLOR_DEFAULTS[kind] ?? '#9D7CFF', opacity: 100,
      ...(kind === 'countdown' ? { behavior: { countFrom: Math.max(0, Math.min(5, Math.ceil(ticksToSeconds(projectTicks, project.timebase) - position) - 2)), countTo: 0, ...preset.behavior } } : {}),
      startTicks: secondsToTicks(position, project.timebase), durationTicks: kind === 'countdown' ? secondsToTicks(7, project.timebase) : selectedScene.durationTicks, loop: false, animation: preset?.animation ?? 'none',
    };
    void run({ type: 'overlays', overlays: [...project.overlays, constrainOverlay(element, projectTicks, {})] });
    setEditTarget('element'); setSelectedElementId(element.id); setSelectedGlobalTextId(null);
    setEditingText(false); setFramingMode(false);
    setTab('elements');
  }

  function selectOverlay(element: TimelineOverlay, seek = true) {
    setOverlayDraft(null); overlayDraftRef.current = null;
    setSelectedElementId(element.id); setSelectedTextLayerId(null); setSelectedGlobalTextId(null); setSelectedPipId(null); setEditTarget('element');
    setFramingMode(false); setEditingText(false); setTab('elements'); setPlaying(false);
    const owner = sceneAt(project, ticksToSeconds(element.startTicks, project.timebase))?.scene;
    if (owner) { setSelectedIds([owner.id]); setPrimarySelected(owner.id); }
    if (seek) setPosition(ticksToSeconds(element.startTicks, project.timebase));
  }

  async function saveOverlay(element: TimelineOverlay, next: TimelineOverlay | null) {
    const current = latestProject.current;
    if (element.legacySceneId) return run({ type: 'replace', project: replaceOverlay(current, element, next) });
    const overlays = (current.overlays ?? []).filter(item => item.id !== element.id);
    if (next) overlays.push(next);
    return run({ type: 'overlays', overlays });
  }

  function stageElement(patch: Partial<ElementLayer>, target = selectedElement) {
    if (!target || !canEdit) return;
    const base = overlayDraftRef.current?.id === target.id ? overlayDraftRef.current : target;
    const next = { ...base, ...constrainOverlay(base, projectTicks, patch) };
    if (next.kind === 'video' && next.sourceDurationSeconds) next.durationTicks = Math.min(next.durationTicks, Math.max(1, secondsToTicks(next.sourceDurationSeconds - (next.sourceInSeconds ?? 0), project.timebase)));
    overlayDraftRef.current = next; setOverlayDraft(next);
    if (patch.startTicks !== undefined) { setPlaying(false); setPosition(ticksToSeconds(next.startTicks, project.timebase)); }
  }

  function commitElement() {
    const next = overlayDraftRef.current;
    if (!next) return;
    const original = allOverlays.find(e => e.id === next.id) ?? next;
    void saveOverlay(original, next).then(() => { if (overlayDraftRef.current === next) { overlayDraftRef.current = null; setOverlayDraft(null); } });
  }

  function updateElement(patch: Partial<ElementLayer>) { stageElement(patch); queueMicrotask(() => commitElement()); }

  function elementStackTarget(element: ElementLayer | TimelineOverlay) {
    const overlay = element as TimelineOverlay;
    // A legacy scene element is only addressable as an element while its draft
    // is not yet promoted to a project overlay.
    const at = overlay.legacySceneId ? stackIndex(sceneLayerStack, 'element', overlay.legacyId ?? element.id) : -1;
    return at >= 0 ? { kind: 'element' as const, id: overlay.legacyId ?? element.id } : { kind: 'overlay' as const, id: element.id };
  }

  function elementStackPosition(element: ElementLayer | TimelineOverlay) {
    const target = elementStackTarget(element);
    return stackIndex(sceneLayerStack, target.kind, target.id) + 1;
  }

  function moveElementLayer(move: StackMove) {
    if (!selectedElement || !canEdit) return;
    const target = elementStackTarget(selectedElement);
    const z = stackZ(sceneLayerStack, target.kind, target.id, move);
    if (z === null) return;
    // An uncommitted inspector draft has to survive the move, so let the draft
    // path stage and commit it. Every other press uses the lightweight command
    // that ships only the new position.
    if (overlayDraftRef.current) { updateElement({ z }); return; }
    void run({ type: 'order', kind: target.kind, sceneId: target.kind === 'overlay' ? undefined : selectedScene?.id, id: target.id, z });
  }

  function reorderLayer(kind: 'text' | 'element' | 'overlay', id: string, z: number) {
    if (!canEdit) return;
    void run({ type: 'order', kind, sceneId: kind === 'overlay' ? undefined : selectedScene?.id, id, z });
  }

  function removeElement(id: string) {
    const element = allOverlays.find(item => item.id === id); if (!element || !canEdit) return;
    void saveOverlay(element, null); setSelectedElementId(null); overlayDraftRef.current = null; setOverlayDraft(null);
  }

  const { beginElementMove, beginElementResize, beginElementRotate, beginOverlayTiming } = useElementPointer({ canEdit, inspectorFlush, previewStage, selectedElement, selectOverlay, allOverlays, position, project, projectTicks, snapping, setPlaying, setDraggingOverlay, setSnapGuides, setOverlayDraft, overlayDraftRef, stageElement, commitElement });

  function addBeatAtPlayhead() {
    if (!canEdit || !projectTicks) return;
    const tick = Math.min(projectTicks, Math.max(0, secondsToTicks(position, project.timebase)));
    const beats = project.beatTicks ?? [];
    if (beats.some(existing => Math.abs(existing - tick) < 2)) { setNotice('A beat is already there.'); return; }
    if (beats.length >= 500) { setNotice('A project supports up to 500 beat markers.'); return; }
    void run({ type: 'beats', beatTicks: [...beats, tick].sort((a, b) => a - b) });
  }

  function removeBeat(tick: number) {
    if (!canEdit) return;
    void run({ type: 'beats', beatTicks: (project.beatTicks ?? []).filter(beat => beat !== tick) });
  }

  function addTextLayerAtPlayhead(preset: Partial<TextLayer> = {}) {
    const scene = selectedScene ?? active;
    if (!scene || !canEdit) { setNotice('Add a photo before adding text.'); return; }
    if (sceneTextLayers(scene).length >= 8) { setNotice('This scene already has eight text layers.'); return; }
    const startTicks = Math.min(Math.max(0, textStartTicks), Math.max(0, scene.durationTicks - 1));
    const layer = createTextLayer(Math.max(1, scene.durationTicks - startTicks), { ...preset, startTicks });
    const next = replaceSceneTextLayers(scene, [...sceneTextLayers(scene), layer]);
    void run({ type: 'update', scene: next }).then(ok => {
      if (!ok) return;
      setSelectedIds([scene.id]);
      setPrimarySelected(scene.id);
      selectionAnchor.current = scene.id;
      setEditTarget('text'); setSelectedElementId(null); setSelectedTextLayerId(layer.id);
      setTab('text');
      setTextFocus(value => value + 1);

    });
  }

  function previewInlineText(next: { title: string; subtitle: string }) {
    if (!selectedScene || !selectedTextLayer) return;
    if (selectedGlobalText) {
      setTextDraft(next);
      setGlobalTextDraft((project.globalText ?? []).map(layer => layer.id === selectedGlobalText.id ? { ...layer, ...next } : layer));
      return;
    }
    setTextDraft(next);
    const layers = sceneTextLayers(selectedScene).map(layer => layer.id === selectedTextLayer.id ? { ...layer, ...next } : layer);
    setPreviewScene(replaceSceneTextLayers(selectedScene, layers));
  }

  function commitInlineText() {
    if (selectedGlobalText) {
      const layers = (project.globalText ?? []).map(layer => layer.id === selectedGlobalText.id ? { ...layer, ...textDraft } : layer);
      setGlobalTextDraft(null); setEditingText(false);
      void run({ type: 'globalText', layers });
      return;
    }
    const scene = selectedScene, layer = selectedTextLayer;
    if (!scene || !layer) { setEditingText(false); return; }
    const layers = sceneTextLayers(scene).map(item => item.id === layer.id ? { ...item, ...textDraft } : item);
    const next = replaceSceneTextLayers(scene, layers);
    setPreviewScene(next);
    void run({ type: 'update', scene: next }).finally(() => { setPreviewScene(null); setEditingText(false); });
  }

  function cancelInlineText() {
    setPreviewScene(null);
    setEditingText(false);
  }

  function blurInlineText(event: { currentTarget: HTMLElement; relatedTarget: EventTarget | null }) {
    const editor = event.currentTarget.closest('.text-edit-overlay');
    if (editor?.contains(event.relatedTarget as Node | null)) return;
    commitInlineText();
  }






  const fadeScene = previewScene && previewScene.id === active?.id ? previewScene : active;
  const fadeAmount = fadeScene ? 1 - fadeOpacity(fadeScene, position - activeStart, project.timebase) : 0;


  function requestCloseModal() {
    if (modal === 'settings' && settingsTab === 'shortcuts' && shortcutDirty) {
      setNotice('Apply or cancel your shortcut changes before closing Settings.');
      return;
    }
    if (modal === 'new') setPendingTemplate(null);
    if (modal === 'delete') setDeleteTarget(null);
    if (modal === 'rename') setRenameTarget(null);
    if (modal === 'group') setGroupTarget(null);
    if (modal === 'groups') setGroupDrafts({});
    setModal(null);
  }

  function closeShortcutSettings() {
    setShortcutDirty(false);
    setModal(null);
  }

  function runCommandId(id: string) {
    const state = availabilityFor(id);
    if (state.disabled) { if (state.reason) setNotice(state.reason); return; }
    setContextMenu(null);
    if (modal === 'palette') setModal(null);
    switch (id) {
      case 'palette.open': setModal('palette'); break;
      case 'help.shortcuts': setModal('shortcuts'); break;
      case 'settings.open': setModal('settings'); break;
      case 'project.new': scenes.length ? setModal('new') : void startBlank(); break;
      case 'project.open': void open(); break;
      case 'project.save': void save(); break;
      case 'project.import': void chooseImages(); break;
      case 'export.open': openExportModal(); break;
      case 'history.undo': void run({ type: 'undo' }); break;
      case 'history.redo': void run({ type: 'redo' }); break;
      case 'playback.toggle': togglePlayback(); break;
      case 'playback.forward': playForward(); break;
      case 'playback.reverse': playReverse(); break;
      case 'playback.stop': setPlaying(false); break;
      case 'clip.split': splitAtPlayhead(); break;
      case 'clip.delete':
      case 'clip.ripple_delete': deleteSelected(); break;
      case 'clip.duplicate': duplicateSelected(); break;
      case 'timeline.prev_frame': stepFrame(-1); break;
      case 'timeline.next_frame': stepFrame(1); break;
      case 'timeline.snapping': toggleSnapping(); break;
      case 'edit.select_all': {
        const ids = scenes.map(scene => scene.id);
        if (!ids.length) break;
        setSelectedIds(ids);
        setPrimarySelected(ids[ids.length - 1]);
        selectionAnchor.current = ids[ids.length - 1];
        break;
      }
      case 'edit.deselect':
        setSelectedIds([]); setPrimarySelected(null); selectionAnchor.current = null;
        setSelectedTextLayerId(null); setSelectedGlobalTextId(null); setSelectedPipId(null); setPipDraft(null); pipDraftRef.current = null; setSelectedElementId(null);
        setOverlayDraft(null); overlayDraftRef.current = null;
        setEditingText(false); setFramingMode(false);
        break;
      case 'beat.add': addBeatAtPlayhead(); break;
      case 'text.add': addTextLayerAtPlayhead(); break;
      case 'view.safe_area': setSafeArea(value => !value); break;
    }
  }

  commandRef.current = runCommandId;
  fullscreenRef.current = () => { const element = document.querySelector('.preview-panel'); if (!document.fullscreenElement) void element?.requestFullscreen?.(); else void document.exitFullscreen(); };
  closeModalRef.current = requestCloseModal;
  const commandAvailability: Record<string, CommandAvailability> = Object.fromEntries(COMMANDS.map(command => [command.id, availabilityFor(command.id)]));

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
      if (event.repeat && !['timeline.prev_frame', 'timeline.next_frame'].includes(command.id)) return;
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

  async function launchProject(p: Project) {
    if (projectScenes(latestProject.current).length) await persistCurrent();
    if (!(await run({ type: 'replace', project: p }))) return false;
    const first = projectScenes(p)[0]?.id ?? null;
    setSelectedIds(first ? [first] : []);
    setPrimarySelected(first);
    selectionAnchor.current = first;
    setPosition(0);
    setPreviewScene(null);
    setEditingText(false);
    setPlaying(false);
    setScreen('editor');
    setModal(null);
    setPendingTemplate(null);
    setHomeSection('home');
    return true;
  }

  async function startBlank() {
    await launchProject(emptyProject('Untitled story', preferences.defaultAspect));
  }

  async function startWithFormats() {
    const selected = FORMAT_PRESETS.filter(preset => newFormatIds.includes(preset.id));
    try { if (selected.length) localStorage.setItem('pixcut.lastFormats', JSON.stringify(selected.map(preset => preset.id))); } catch { /* remembering the last choice is optional */ }
    const baseAspect = (['16:9', '9:16', '1:1', '4:5'].includes(selected[0]?.aspect ?? '') ? selected[0].aspect : preferences.defaultAspect) as Project['aspect'];
    const next = emptyProject('Untitled story', baseAspect, newProjectFps);
    const presetFormats = selected.map(preset => ({ id: crypto.randomUUID(), name: preset.name, platform: preset.platform, aspect: preset.aspect, width: preset.width, height: preset.height, fps: preset.fps, quality: preset.quality, presetId: preset.id, overrides: {} }));
    next.formats = presetFormats.length || newCustomFormats.length ? [...presetFormats, ...newCustomFormats] : next.formats;
    setNewCustomFormats([]);
    await launchProject(next);
  }

  const { toggleFormatPreset, addNewCustomFormat, addCustomFormat, updateFormatSettings, removeFormat, applyFramingToAllFormats } = useFormats({ project, run, setNotice, setError, activeFormat, setActiveFormatId, selectedScene, newFormatCount: newFormatSelection.length, setNewCustomFormats, customFormatDraft, setCustomFormatDraft });

  async function startTemplate(template: TemplateDefinition) {
    // A template is a fresh story: always use its bundled photography, never
    // the photos from whichever project happened to be open underneath it.
    await launchProject(await buildTemplateProject(template));
  }

  function chooseTemplate(template: TemplateDefinition) {
    if (projectScenes(latestProject.current).length) {
      setPendingTemplate(template);
      setModal('new');
      return;
    }
    void startTemplate(template);
  }

  const { batchMode, setBatchMode, batchIds, toggleBatch, endBatch, batchFavorite, batchMove, batchDelete, projectMenu, setProjectMenu, deleteTarget, setDeleteTarget, setRenameTarget, renameDraft, setRenameDraft, groupTarget, setGroupTarget, groupDraft, setGroupDraft, groupDrafts, setGroupDrafts, groupFilter, setGroupFilter, openLibraryProject, duplicateProject, askDeleteProject, askRenameProject, askGroupProject, confirmGroupProject, projectGroups, openGroupManager, saveGroupRename, removeGroup, toggleProjectFavorite, confirmDeleteProject, renameProject, exportLibraryProject } = useProjectLibrary({ projects, setProjects, project, latestProject, canEdit, launchProject, refreshLibrary, persistCurrent, run, setScreen, setModal, setNotice, setError, setSelectedIds, setPrimarySelected, selectionAnchor, setPosition });

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
    if (!selectedScene) { setNotice('Select the background scene first, then add an overlay.'); return; }
    if (allOverlays.length >= 64) { setNotice('This project already has 64 overlays.'); return; }
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

  const { removePip, addMediaPip, stagePip, commitPip, stagePipStyle, selectPip, beginPipTiming } = usePipLayers({ setSelectedPipId, setSelectedIds, setPrimarySelected, selectionAnchor, setSelectedTextLayerId, setSelectedGlobalTextId, setSelectedElementId, setEditTarget, setEditingText, setFramingMode, setPlaying, setPosition, project, selectedPip, pipDraftRef, setPipDraft, activePip, setError, run, setNotice, canEdit, projectTicks, selectedScene, position, activeSize });

  const { refreshAssetUsage, chooseImages, commitDucking, importCustomElement, importVideos, importCaptionFile, chooseVideo, chooseCustomElement, cleanStorage } = useMediaImport({ canEdit, setBusy, customElementKind, addMediaOverlay, project, selectedScene, setError, customElementInput, mediaInput, operation, setPlaying, scenes, preferences, stageImportedMedia, videoInput, latestProject, run, setNotice, captionInput, setStorageUsage, storageBusy, storageConfirm, setStorageConfirm, setStorageNote, setStorageBusy, setDuckDraft });

  async function importFontFile(files: FileList | null) {
    const file = files?.[0];
    if (!file || !canEdit) return;
    const targetId = fontTargetId.current;
    fontTargetId.current = null;
    const target = targetId ? (project.fonts ?? []).find(font => font.id === targetId) : undefined;
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!['ttf', 'otf', 'woff', 'woff2'].includes(extension)) throw new Error('Choose a TTF, OTF, WOFF, or WOFF2 font.');
      if (file.size > 40 * 1024 * 1024) throw new Error('Choose a font smaller than 40 MB.');
      if (!target && (project.fonts?.length ?? 0) >= MAX_PROJECT_FONTS) throw new Error(`A project supports up to ${MAX_PROJECT_FONTS} imported fonts.`);
      if ((extension === 'woff' || extension === 'woff2') && file.size > 2 * 1024 * 1024) {
        throw new Error('WOFF and WOFF2 fonts cannot be subset here. Choose a TTF or OTF under 2 MB, or a large TTF/OTF that PixCut can subset.');
      }
      const mime = extension === 'woff2' ? 'font/woff2' : extension === 'woff' ? 'font/woff' : extension === 'otf' ? 'font/otf' : 'font/ttf';
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('That font could not be read.'));
        reader.readAsDataURL(file);
      });
      if (!base64) throw new Error('That font file is empty.');
      let data = `data:${mime};base64,${base64}`;
      let subsetted = 0;
      // A CJK face is often tens of megabytes. Subset it to the project's text
      // plus everyday alphabets so it fits the same local project budget.
      if ((extension === 'ttf' || extension === 'otf') && file.size > 300_000) {
        try {
          const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
          const projectText = [
            ...projectScenes(project).flatMap(scene => sceneTextLayers(scene).flatMap(layer => [layer.title, layer.subtitle])),
            ...(project.globalText ?? []).flatMap(layer => [layer.title, layer.subtitle]),
            'The little moments',
          ].join(' ');
          const subset = await subsetFontBytes(bytes, subsetCharacters(projectText));
          if (subset.length && subset.length < bytes.length) {
            let binary = '';
            for (let index = 0; index < subset.length; index += 0x8000) {
              binary += String.fromCharCode(...subset.subarray(index, index + 0x8000));
            }
            data = `data:${mime};base64,${btoa(binary)}`;
            subsetted = subset.length;
          }
        } catch { /* fall back to the original if it fits the project budget */ }
      }
      if (data.length > 3_000_000) {
        throw new Error('This font is still larger than 2 MB after subsetting. Choose a TTF or OTF with fewer glyphs.');
      }
      const font = {
        id: target?.id ?? `custom-${crypto.randomUUID()}`,
        name: target?.name ?? (file.name.replace(/\.[^.]+$/, '').trim() || 'Imported font').slice(0, 60),
        data,
      };
      const fonts = target
        ? (project.fonts ?? []).map(item => item.id === target.id ? font : item)
        : [...(project.fonts ?? []), font];
      if (await run({ type: 'fonts', fonts })) {
        setNotice(subsetted
          ? `“${font.name}” ${target ? 'subset refreshed' : 'is now in the font picker'} · ${formatBytes(subsetted)} of ${formatBytes(file.size)}.`
          : `“${font.name}” ${target ? 'updated' : 'is now in the font picker'}.`);
      }
    } catch (error) {
      setError(messageFor(error));
    } finally {
      if (fontInput.current) fontInput.current.value = '';
    }
  }

  function removeFont(id: string) {
    const font = (project.fonts ?? []).find(item => item.id === id);
    void run({ type: 'fonts', fonts: (project.fonts ?? []).filter(item => item.id !== id) }).then(ok => {
      if (ok) setNotice(`“${font?.name ?? 'Font'}” removed. Text using it falls back to Inter.`);
    });
  }

  async function exportCaptions() {
    const captions = textLayersAsCaptions(projectScenes(latestProject.current), project.timebase);
    if (!captions.length) { setError('Add a title or caption layer before exporting captions.'); return; }
    try {
      const saved = await bridge.saveTextFile(toSrt(captions), `${project.name} - captions`, 'srt', 'SubRip subtitles');
      if (saved) setNotice(`${captions.length} caption${captions.length === 1 ? '' : 's'} exported as an SRT file.`);
    } catch (error) {
      setError(messageFor(error));
    }
  }

  const { removeAudio, importFiles, stopVoiceover, startVoiceover, stageAudio, commitAudio, detectAudioBeats, snapCutsToBeat, importAudio, chooseAudio, focusAudio, setVideoAudioLevel, commitMix, stageVideoVolume, commitVideoVolume, toggleLaneMute, setLaneMix, beginAudioMove, beginAudioTrim } = useAudioActions({ canEdit, setError, audioInput, projectTicks, setNotice, position, project, audioLaneRef, run, setEditTarget, setSelectedAudioId, setTab, operation, setPlaying, setBusy, scenes, preferences, stageImportedMedia, mediaInput, recordChunks, recorderRef, setRecording, setRecordSeconds, recordTimer, latestProject, positionRef, audioDraftRef, setAudioDraft, setPreviewAudio, selectedAudio, mixDraftRef, setMixDraft, videoVolumeDraftRef, setVideoVolumeDraft, playing, setPosition, editTargetRef, audioTargetRef, setSelectedIds, setPrimarySelected, setSelectedElementId, setSelectedGlobalTextId, setBeatBusy, setBeatTempo, beatTempo });

  const { togglePlayback, playForward, playReverse, stepFrame, scrubTo, selectScene, updateSelection, splitAtPlayhead, duplicateSelected, deleteSelected } = useSceneCommands({ activeFormat, audio, audioTargetRef, commitElement, duration, editTarget, editTargetRef, frameSeconds, hasSceneSelection, latestProject, operation, overlayDraftRef, pending, pipDraftRef, playing, position, positionRef, primarySelected, project, removeAudio, removeElement, removePip, replaceSceneTextLayers, run, scenes, selectedAudio, selectedAudioId, selectedElement, selectedGlobalText, selectedIds, selectedPip, selectedScene, selectedScenes, selectedTextLayerId, selectionAnchor, setEditTarget, setEditingText, setGlobalTextDraft, setNotice, setOverlayDraft, setPipDraft, setPlayDirection, setPlaying, setPosition, setPreviewScene, setPrimarySelected, setSelectedAudioId, setSelectedElementId, setSelectedGlobalTextId, setSelectedIds, setSelectedPipId, setSelectedTextLayerId, snapping });

  const { beginImagePan, beginTextMove, beginTextResize, beginFadeDrag, beginSceneTrim, beginPlayheadDrag } = useStagePointer({ canEdit, inspectorFlush, previewStage, inspectorScene, selectedScene, selectedIds, selectedTextLayer, textBox, project, latestProject, projectTicks, duration, activeSize, pending, run, updateSelection, optimisticScene, replaceSceneTextLayers, scrubTo, selectionAnchor, setSession, setPreviewScene, setPlaying, setEditingText, setFadeDrag, setSnapGuides, setSelectedIds, setPrimarySelected, setDraggingOverlay });

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
      if (file.size > 2 * 1024 * 1024 * 1024) throw new Error('Project file exceeds the 2 GB browser limit.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const p = bytes[0] === 0x50 && bytes[1] === 0x4b
        ? await readPixcutBundle(bytes)
        : validateProject(JSON.parse(new TextDecoder().decode(bytes)));
      await persistCurrent();
      if (await run({ type: 'replace', project: p })) { setScreen('editor'); setSelectedIds([]); setPrimarySelected(null); selectionAnchor.current = null; setPosition(0); }
    } catch (e) { setError(messageFor(e)); } finally { e.target.value = ''; }
  }

  function togglePreviewFullscreen() { const element = document.querySelector('.preview-panel'); if (!document.fullscreenElement) void element?.requestFullscreen?.(); else void document.exitFullscreen(); }

  async function relinkMissing(asset: MissingAsset) {
    if (!bridge.native) { setError('Relinking is available in the desktop app.'); return; }
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
        setNotice(`Relinked ${asset.label} with ${imported.name}.`);
        setError('');
      }
    } catch (error) { setError(messageFor(error)); }
    finally { setRelinking(null); }
  }

  function openExportModal() {
    if (missing.length) { setError('Relink missing media before exporting this project.'); return; }
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
  const wideModal = modal === 'shortcuts' || modal === 'palette' || modal === 'templates' || (modal === 'settings' && settingsTab === 'shortcuts');
  const mediumModal = modal === 'source' || modal === 'new' || modal === 'formats' || modal === 'missing';
  const modalEyebrow = modal === 'export' ? t('VIDEO EXPORT') : modal === 'shortcuts' ? 'FIND YOUR FLOW' : modal === 'palette' ? 'EVERY ACTION, ONE PLACE' : modal === 'settings' ? 'MAKE PIXCUT YOURS' : modal === 'delete' ? 'REMOVE FROM THIS DEVICE' : modal === 'rename' ? 'PROJECT DETAILS' : modal === 'group' ? 'ORGANIZE YOUR LIBRARY' : modal === 'groups' ? 'ORGANIZE YOUR LIBRARY' : modal === 'formats' ? 'DELIVERABLES' : modal === 'missing' ? 'RESTORE YOUR MEDIA' : 'YOUR NEXT STORY';
  const projectGroupsList = projectGroups();
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
    return <div className="format-filters" role="tablist" aria-label="Format filters">
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
          <span className={`project-export ${entry.exportedAt ? 'done' : ''}`}>{entry.exportedAt ? t('Exported {time}', { time: relativeTime(entry.exportedAt) }) : t('Not exported yet')}</span>
        </div>
      </button>
      {!batchMode && <div className="project-quick" role="group" aria-label={`Quick actions for ${entry.name}`}>
        <button aria-label={`Export ${entry.name}`} title={t('Export project file')} onClick={() => void exportLibraryProject(entry)}><Download size={13} /></button>
        <button aria-label={`Duplicate ${entry.name}`} title={t('Duplicate')} disabled={!canEdit} onClick={() => void duplicateProject(entry)}><Copy size={13} /></button>
        <button aria-label={`Rename ${entry.name}`} title={t('Rename…')} disabled={!canEdit} onClick={() => askRenameProject(entry)}><Pencil size={13} /></button>
      </div>}
      {!batchMode && <button className={`project-favorite ${entry.favorite ? 'active' : ''}`} aria-label={entry.favorite ? `Remove ${entry.name} from favorites` : `Add ${entry.name} to favorites`} aria-pressed={Boolean(entry.favorite)} onClick={() => void toggleProjectFavorite(entry)}><Star size={15} fill={entry.favorite ? 'currentColor' : 'none'} /></button>}
      {!batchMode && <button className="project-actions" data-project-actions={entry.id} aria-label={`Actions for ${entry.name}`} aria-haspopup="menu" aria-expanded={projectMenu === entry.id} onClick={() => setProjectMenu(id => id === entry.id ? null : entry.id)}><MoreHorizontal size={16} /></button>}
      {projectMenu === entry.id && <div className="project-menu" data-project-menu={entry.id} role="menu" aria-label={`${entry.name} actions`}>
        <span className="project-menu-heading">{entry.name}</span>
        <button role="menuitem" onClick={() => void openLibraryProject(entry)}><FolderOpen size={14} /><span>{t('Open project')}</span></button>
        <button role="menuitem" disabled={!canEdit} onClick={() => askRenameProject(entry)}><Pencil size={14} /><span>{t('Rename…')}</span></button>
        <button role="menuitem" onClick={() => void toggleProjectFavorite(entry)}><Star size={14} /><span>{entry.favorite ? t('Remove from favorites') : t('Add to favorites')}</span></button>
        <button role="menuitem" disabled={!canEdit} onClick={() => askGroupProject(entry)}><Layers size={14} /><span>{entry.group ? t('Group: {name}', { name: entry.group }) : t('Move to group…')}</span></button>
        <button role="menuitem" disabled={!canEdit} onClick={() => void duplicateProject(entry)}><Copy size={14} /><span>{t('Duplicate')}</span></button>
        <button role="menuitem" onClick={() => void exportLibraryProject(entry)}><Download size={14} /><span>{t('Export project file')}</span></button>
        <button role="menuitem" className="danger" onClick={() => askDeleteProject(entry)}><Trash2 size={14} /><span>{t('Delete from device…')}</span></button>
      </div>}
    </div>;
  }

  const audioInspector = <>
              <details className="inspector-section ducking-panel"><summary>{t('Project music mix')}</summary>
                <label className="checkbox-field"><input type="checkbox" checked={(project.ducking ?? 0) > 0} disabled={!canEdit || !hasVideoScenes} onChange={event => void run({ type: 'ducking', amount: event.target.checked ? 60 : 0 })} /> {t('Lower music under video sound')}</label>
                {(project.ducking ?? 0) > 0 && <label className="music-control"><span>{t('Reduce music by')} <b>{duckDraft ?? project.ducking}%</b></span><input type="range" aria-label="Music ducking amount" min="10" max="90" step="5" value={duckDraft ?? project.ducking ?? 60} disabled={!canEdit} onChange={event => setDuckDraft(Number(event.target.value))} onPointerUp={event => commitDucking(Number(event.currentTarget.value))} onKeyUp={event => commitDucking(Number(event.currentTarget.value))} onBlur={event => commitDucking(Number(event.currentTarget.value))} /></label>}
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
                {(selectedAudio.credit || creditForClipName(selectedAudio.name)) && <div className="music-credit-note"><Music size={13} /><span>{selectedAudio.credit || creditForClipName(selectedAudio.name)}</span><button className="text-button" onClick={() => void navigator.clipboard.writeText((selectedAudio.credit || creditForClipName(selectedAudio.name))!).then(() => setNotice('Music credit copied.')).catch(() => setError('Could not copy the credit. It is listed in the Music panel.'))}><Copy size={12} /> {t('Copy credit')}</button></div>}
                <label className="field">{t('Audio track')}<select aria-label={t('Audio track')} value={selectedAudio.lane} onChange={event => stageAudio({ lane: Number(event.target.value) })} onBlur={commitAudio}>{audioLanes.map((lane, index) => <option key={lane} value={lane}>{t('Track {number}', { number: index + 1 })}</option>)}{audioLanes.length < 8 && <option value={audioLanes.length}>{t('Track {number}', { number: audioLanes.length + 1 })}</option>}</select></label>
                <label className="music-control"><span>{t('Start')} <b>{ticksToSeconds(selectedAudio.startTicks, project.timebase).toFixed(1)} s</b></span><input aria-label="Audio start" type="range" min="0" max={ticksToSeconds(Math.max(0, projectTicks - selectedAudio.durationTicks), project.timebase)} step={secondsPerTick(project.timebase)} value={ticksToSeconds(selectedAudio.startTicks, project.timebase)} disabled={!canEdit} onChange={event => stageAudio({ startTicks: secondsToTicks(Number(event.target.value), project.timebase) })} onPointerUp={commitAudio} onKeyUp={commitAudio} onBlur={commitAudio} /></label>
                <label className="music-control"><span>{t('Trim in')} <b>{selectedAudio.sourceInSeconds.toFixed(1)} s</b></span><input aria-label="Audio trim in" type="range" min="0" max={Math.max(0, selectedAudio.sourceDurationSeconds - secondsPerTick(project.timebase))} step="0.1" value={selectedAudio.sourceInSeconds} disabled={!canEdit} onChange={event => stageAudio({ sourceInSeconds: Number(event.target.value) })} onPointerUp={commitAudio} onKeyUp={commitAudio} onBlur={commitAudio} /></label>
                <label className="music-control"><span>{t('Duration')} <b>{ticksToSeconds(selectedAudio.durationTicks, project.timebase).toFixed(1)} s</b></span><input aria-label="Audio duration" type="range" min="0.1" max={Math.max(0.1, Math.min(ticksToSeconds(projectTicks - selectedAudio.startTicks, project.timebase), selectedAudio.sourceDurationSeconds - selectedAudio.sourceInSeconds))} step="0.1" value={ticksToSeconds(selectedAudio.durationTicks, project.timebase)} disabled={!canEdit} onChange={event => stageAudio({ durationTicks: secondsToTicks(Number(event.target.value), project.timebase) })} onPointerUp={commitAudio} onKeyUp={commitAudio} onBlur={commitAudio} /></label>
                <label className="music-control"><span>{t('Volume')} <b>{Math.round(selectedAudio.volume * 100)}%</b></span><input aria-label="Audio volume" type="range" min="0" max="100" step="1" value={Math.round(selectedAudio.volume * 100)} disabled={!canEdit} onChange={event => stageAudio({ volume: Number(event.target.value) / 100 })} onPointerUp={commitAudio} onKeyUp={commitAudio} onBlur={commitAudio} /></label>
                <label className="music-control"><span>{t('Fade in')} <b>{selectedAudio.fadeIn.toFixed(1)} s</b></span><input aria-label="Audio fade in" type="range" min="0" max={Math.min(30, ticksToSeconds(selectedAudio.durationTicks, project.timebase))} step="0.1" value={selectedAudio.fadeIn} disabled={!canEdit} onChange={event => stageAudio({ fadeIn: Number(event.target.value) })} onPointerUp={commitAudio} onKeyUp={commitAudio} onBlur={commitAudio} /></label>
                <label className="music-control"><span>{t('Fade out')} <b>{selectedAudio.fadeOut.toFixed(1)} s</b></span><input aria-label="Audio fade out" type="range" min="0" max={Math.min(30, ticksToSeconds(selectedAudio.durationTicks, project.timebase))} step="0.1" value={selectedAudio.fadeOut} disabled={!canEdit} onChange={event => stageAudio({ fadeOut: Number(event.target.value) })} onPointerUp={commitAudio} onKeyUp={commitAudio} onBlur={commitAudio} /></label>
                <details className="inspector-section" open>
                  <summary>{t('Three-band EQ')}</summary>
                  {([['low', 'Bass · 120 Hz'], ['mid', 'Voice · 1 kHz'], ['high', 'Treble · 6 kHz']] as const).map(([key, label]) => (
                    <label className="music-control" key={key}><span>{t(label)} <b>{(selectedAudio[key] ?? 0) > 0 ? '+' : ''}{selectedAudio[key] ?? 0} dB</b></span><input aria-label={`Audio ${key} EQ`} type="range" min="-12" max="12" step="1" value={selectedAudio[key] ?? 0} disabled={!canEdit} onChange={event => stageAudio({ [key]: Number(event.target.value) })} onPointerUp={commitAudio} onKeyUp={commitAudio} onBlur={commitAudio} /></label>
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
                {!selectedElement.presetId && !['image','video'].includes(selectedElement.kind) && <label className="field">{t('Replace old decoration')}<select aria-label={t('Replace old decoration')} value="" onChange={event => { const preset = ELEMENT_CATALOG.find(p => p.id === event.target.value); if (preset) updateElement({ kind:preset.kind,presetId:preset.id,label:preset.text,color:preset.color,animation:preset.animation,...presetSize(preset,activeSize) }); }}><option value="">Choose a current element…</option>{ELEMENT_CATALOG.filter(p => ['Social','Titles'].includes(p.category)).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}
                {(selectedElement.presetId || ELEMENT_LABEL_DEFAULTS[selectedElement.kind] !== undefined) && <ElementTextField key={selectedElement.id} value={selectedElement.label ?? elementPreset(selectedElement)?.text ?? ELEMENT_LABEL_DEFAULTS[selectedElement.kind] ?? ''} stage={label => stageElement({ label })} commit={commitElement} />}
                {selectedElement.kind !== 'image' && selectedElement.kind !== 'video' && <div className="element-color-row">{ELEMENT_COLORS.map(color => <button key={color} className={`element-color ${selectedElement.color === color ? 'active' : ''}`} style={{ background: color }} aria-label={`Element color ${color}`} onClick={() => updateElement({ color })} onPointerUp={commitElement} onKeyUp={commitElement} onBlur={commitElement} />)}</div>}
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
                <details className="overlay-action"><summary>{t('Timed action')}</summary><label className="field">{t('Later action')}<select aria-label={t('Element action')} value={selectedElement.action?.kind ?? 'none'} onChange={event => updateElement({ action: event.target.value === 'none' ? undefined : { kind: event.target.value as 'ring', startTicks: Math.min(selectedElement.durationTicks - 1, secondsToTicks(1, project.timebase)), durationTicks: Math.min(selectedElement.durationTicks, secondsToTicks(2, project.timebase)), repeat: false, sound: false } })}><option value="none">None</option><option value="ring">Ring / shake</option><option value="pulse">Pulse</option><option value="float">Float</option><option value="spin">Spin</option></select></label>
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

                <label className="music-control"><span>{t('Opacity')} <b>{Math.round(selectedElement.opacity)}%</b></span><input type="range" min="0" max="100" step="1" value={selectedElement.opacity} onChange={event => stageElement({ opacity: Number(event.target.value) })} onPointerUp={commitElement} onKeyUp={commitElement} onBlur={commitElement} /></label>
                <label className="music-control"><span>{t('Rotation')} <b>{Math.round(selectedElement.rotation)}°</b></span><input type="range" min="-180" max="180" step="1" value={selectedElement.rotation} onChange={event => stageElement({ rotation: Number(event.target.value) })} onPointerUp={commitElement} onKeyUp={commitElement} onBlur={commitElement} /></label>
                <label className="music-control"><span>Width <b>{Math.round(selectedElement.width * 100)}%</b></span><input type="range" min="2" max="100" step="1" value={Math.round(selectedElement.width * 100)} onChange={event => stageElement({ width: Number(event.target.value) / 100 })} onPointerUp={commitElement} onKeyUp={commitElement} onBlur={commitElement} /></label>
                <label className="music-control"><span>Height <b>{Math.round(selectedElement.height * 100)}%</b></span><input type="range" min="2" max="100" step="1" value={Math.round(selectedElement.height * 100)} onChange={event => stageElement({ height: Number(event.target.value) / 100 })} onPointerUp={commitElement} onKeyUp={commitElement} onBlur={commitElement} /></label>
                <p className="note">Drag a corner handle on the preview to resize (hold Shift to keep proportions); use the round handle above it to rotate (Shift snaps to 15°).</p>
                </details>
              </div>;

  return (
    <div className={`app ${screen} theme-${preferences.theme} ${preferences.compact ? 'compact' : ''} ${preferences.reduceMotion ? 'reduce-motion' : ''} ${fileDragActive ? 'file-drag' : ''}`}>
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
<HomeMain batch={{ mode: batchMode, ids: batchIds, begin: () => setBatchMode(true), end: endBatch, favorite: batchFavorite, move: batchMove, remove: batchDelete }} openSettings={() => setModal('settings')} libraryReady={libraryReady} shortcutText={shortcutText} openProject={openLibraryProject} homeSection={homeSection} open={open} canEdit={canEdit} ready={ready} setModal={setModal} chooseImages={chooseImages} projects={projects} libraryQuery={libraryQuery} setLibraryQuery={setLibraryQuery} librarySort={librarySort} setLibrarySort={setLibrarySort} favoriteOnly={favoriteOnly} setFavoriteOnly={setFavoriteOnly} groupFilter={groupFilter} setGroupFilter={setGroupFilter} projectGroupsList={projectGroupsList} openGroupManager={openGroupManager} matchingProjects={matchingProjects} renderProjectCard={renderProjectCard} visibleProjects={visibleProjects} chooseTemplate={chooseTemplate} templateImage={templateImage} />
      </> : <>
        <EditorHeader goHome={goHome} name={name} canEdit={canEdit} setName={setName} project={project} run={run} status={status} tip={tip} runCommandId={runCommandId} session={session} ready={ready} save={save} scenes={scenes} exporting={exporting} openExportModal={openExportModal} />

        {missing.length > 0 && <div className="missing-banner" role="alert">
          <span className="missing-badge"><AlertTriangle size={16} /></span>
          <span className="missing-copy"><strong>{missing.length} media file{missing.length === 1 ? '' : 's'} missing</strong><span>This project still opens, but those clips stay empty until you relink them. Saving and exporting are paused.</span></span>
          <button className="button" onClick={() => setModal('missing')}><LinkIcon size={14} /> Relink media</button>
        </div>}

        {showHints && scenes.length > 0 && <div className="shortcut-hints" role="status">
          <span className="hint-title"><Sparkles size={13} /> Quick start</span>
          <span className="hint"><kbd>{shortcutText('playback.toggle')}</kbd> Play / pause</span>
          <span className="hint"><kbd>{shortcutText('clip.split')}</kbd> Split at playhead</span>
          <span className="hint"><kbd>{shortcutText('history.undo')}</kbd> Undo</span>
          <button className="text-button hint-dismiss" onClick={dismissHints}>Got it</button>
        </div>}

        <EditorBody savedTracks={savedTracks} addSavedTrack={addSavedTrack} removeSavedTrack={removeSavedTrack} libraryWidth={libraryWidth} tab={tab} setTab={setTab} tabTitles={tabTitles} canEdit={canEdit} chooseImages={chooseImages} chooseVideo={chooseVideo} selectedScene={selectedScene} chooseCustomElement={chooseCustomElement} projectTicks={projectTicks} audioLaneRef={audioLaneRef} selectedAudio={selectedAudio} chooseAudio={chooseAudio} setModal={setModal} mediaQuery={mediaQuery} setMediaQuery={setMediaQuery} dragOverTarget={dragOverTarget} dropIntoMedia={dropIntoMedia} filteredScenes={filteredScenes} beginMediaDrag={beginMediaDrag} mediaDragRef={mediaDragRef} setDropTarget={setDropTarget} setHoveredMedia={setHoveredMedia} previewMedia={previewMedia} hoveredMedia={hoveredMedia} playing={playing} modal={modal} project={project} appendMedia={appendMedia} addMediaPip={addMediaPip} setError={setError} sourceMedia={sourceMedia} editTarget={editTarget} selectedGlobalTextId={selectedGlobalTextId} selectGlobalText={selectGlobalText} run={run} setSelectedGlobalTextId={setSelectedGlobalTextId} addProjectText={addProjectText} selectedTextLayerId={selectedTextLayerId} selectTextLayer={selectTextLayer} scenes={scenes} captionInput={captionInput} exportCaptions={exportCaptions} fontTargetId={fontTargetId} fontInput={fontInput} removeFont={removeFont} addTextLayerAtPlayhead={addTextLayerAtPlayhead} audioLibraryTab={audioLibraryTab} setAudioLibraryTab={setAudioLibraryTab} audio={audio} previewingAudio={previewingAudio} hoverLibraryAudio={hoverLibraryAudio} stopLibraryPreview={stopLibraryPreview} focusAudio={focusAudio} musicMood={musicMood} setMusicMood={setMusicMood} copyMusicCredit={copyMusicCredit} addMusic={addMusic} addOnlineMusic={addOnlineMusic} copyMusicCredits={copyMusicCredits} setNotice={setNotice} soundQuery={soundQuery} setSoundQuery={setSoundQuery} soundGroups={soundGroups} openSoundGroup={openSoundGroup} setOpenSoundGroup={setOpenSoundGroup} addSound={addSound} recordedSounds={recordedSounds} addRecordedSound={addRecordedSound} position={position} chooseTemplate={chooseTemplate} templateImage={templateImage} elementSearch={elementSearch} setElementSearch={setElementSearch} setElementLimit={setElementLimit} elementCollection={elementCollection} setElementCollection={setElementCollection} setElementCategory={setElementCategory} elementCategory={elementCategory} allOverlays={allOverlays} selectedElementId={selectedElementId} selectOverlay={selectOverlay} filteredElements={filteredElements} elementLimit={elementLimit} setHoveredElement={setHoveredElement} addElement={addElement} hoveredElement={hoveredElement} preferences={preferences} beginResize={beginResize} tip={tip} safeArea={safeArea} runCommandId={runCommandId} activeFormat={activeFormat} setActiveFormatId={setActiveFormatId} previewTarget={previewTarget} activeSize={activeSize} saveStillFrame={saveStillFrame} togglePreviewFullscreen={togglePreviewFullscreen} previewArea={previewArea} previewStage={previewStage} previewSize={previewSize} preview={preview} sceneVideo={sceneVideo} setVideoTick={setVideoTick} pipVideoScenes={pipVideoScenes} pipVideoElements={pipVideoElements} setPipVideoTick={setPipVideoTick} snapGuides={snapGuides} framingMode={framingMode} beginImagePan={beginImagePan} selectedTextLayer={selectedTextLayer} selectedGlobalText={selectedGlobalText} textBox={textBox} selectedTextVisible={selectedTextVisible} selectedElement={selectedElement} editingText={editingText} beginTextMove={beginTextMove} setTextDraft={setTextDraft} setEditingText={setEditingText} beginTextResize={beginTextResize} overlayDraft={overlayDraft} sceneLayerRank={sceneLayerRank} beginElementMove={beginElementMove} beginElementRotate={beginElementRotate} beginElementResize={beginElementResize} textDraft={textDraft} previewInlineText={previewInlineText} blurInlineText={blurInlineText} cancelInlineText={cancelInlineText} commitInlineText={commitInlineText} fadeAmount={fadeAmount} shortcutText={shortcutText} duration={duration} frameSeconds={frameSeconds} scrubTo={scrubTo} setPosition={setPosition} setPlaying={setPlaying} togglePlayback={togglePlayback} loop={loop} setLoop={setLoop} inspectorWidth={inspectorWidth} selectedPip={selectedPip} propertyKind={propertyKind} selectedCount={selectedCount} setSelectedIds={setSelectedIds} setPrimarySelected={setPrimarySelected} selectionAnchor={selectionAnchor} activePip={activePip} removePip={removePip} pipScenes={pipScenes} stagePip={stagePip} commitPip={commitPip} stagePipStyle={stagePipStyle} removeAudio={removeAudio} audioInspector={audioInspector} elementInspector={elementInspector} selectedTextScene={selectedTextScene} inspectorScene={inspectorScene} updateSelection={updateSelection} setGlobalTextDraft={setGlobalTextDraft} setPreviewScene={setPreviewScene} copySceneProperties={copySceneProperties} propertyClipboard={propertyClipboard} notifyPasted={notifyPasted} inspectorFlush={inspectorFlush} requestReplaceImage={requestReplaceImage} textStartTicks={textStartTicks} textLayerLocal={textLayerLocal} previewLocalSeconds={previewLocalSeconds} textFocus={textFocus} setFramingMode={setFramingMode} applyFramingToAllFormats={applyFramingToAllFormats} renderOverlays={renderOverlays} reorderLayer={reorderLayer} deleteSelected={deleteSelected} hasSceneSelection={hasSceneSelection} duplicateSelected={duplicateSelected} />

        <div className="splitter horizontal" onPointerDown={e => beginResize('timeline', timelineHeight, e.clientY)} />

        <TimelinePanel timelineHeight={timelineHeight} scenes={scenes} selectedCount={selectedCount} selectedScene={selectedScene} canEdit={canEdit} run={run} snapping={snapping} tip={tip} runCommandId={runCommandId} addBeatAtPlayhead={addBeatAtPlayhead} timelineZoom={timelineZoom} changeTimelineZoom={changeTimelineZoom} audioDisplay={audioDisplay} setAudioDisplay={setAudioDisplay} duration={duration} fileDragActive={fileDragActive} timelineScroll={timelineScroll} mediaDragRef={mediaDragRef} dropLibraryMedia={dropLibraryMedia} timelineRatio={timelineRatio} beginPlayheadDrag={beginPlayheadDrag} project={project} projectTicks={projectTicks} removeBeat={removeBeat} activeSize={activeSize} frameSeconds={frameSeconds} position={position} scrubTo={scrubTo} hasMediaOverlays={hasMediaOverlays} isSelected={isSelected} selectScene={selectScene} setTab={setTab} setTextFocus={setTextFocus} selectedTextLayer={selectedTextLayer} setEditTarget={setEditTarget} setSelectedElementId={setSelectedElementId} setSelectedTextLayerId={setSelectedTextLayerId} setPosition={setPosition} addTextLayerAtPlayhead={addTextLayerAtPlayhead} orderedLayers={orderedLayers} overlayDraft={overlayDraft} selectedElementId={selectedElementId} selectOverlay={selectOverlay} beginOverlayTiming={beginOverlayTiming} layerNumbers={layerNumbers} previewScene={previewScene} active={active} dropTarget={dropTarget} reorderId={reorderId} replacingSceneId={replacingSceneId} beginReorder={beginReorder} endReorder={endReorder} dragOverScene={dragOverScene} setDropTarget={setDropTarget} dropScene={dropScene} selectedIds={selectedIds} setSelectedIds={setSelectedIds} setPrimarySelected={setPrimarySelected} selectionAnchor={selectionAnchor} setPlaying={setPlaying} setContextMenu={setContextMenu} beginFadeDrag={beginFadeDrag} beginSceneTrim={beginSceneTrim} fadeDrag={fadeDrag} chooseImages={chooseImages} videoScenes={videoScenes} audioMix={audioMix} setVideoAudioLevel={setVideoAudioLevel} commitMix={commitMix} editTarget={editTarget} videoVolumeDraft={videoVolumeDraft} stageVideoVolume={stageVideoVolume} commitVideoVolume={commitVideoVolume} renderPipScenes={renderPipScenes} selectedPipId={selectedPipId} selectPip={selectPip} beginPipTiming={beginPipTiming} audioLanes={audioLanes} toggleLaneMute={toggleLaneMute} setLaneMix={setLaneMix} audio={audio} selectedAudio={selectedAudio} focusAudio={focusAudio} beginAudioMove={beginAudioMove} beginAudioTrim={beginAudioTrim} stageAudio={stageAudio} commitAudio={commitAudio} audioLaneRef={audioLaneRef} chooseAudio={chooseAudio} shortcutText={shortcutText} />
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

      {notice && <Toast message={notice} onDismiss={() => setNotice('')} />}
      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      {exporting && <ExportJobCard name={exportJob.name} phase={exportJob.phase} progress={exportProgress} elapsed={exportElapsed} cancelling={cancellingExport} onCancel={cancelExport} />}
      {modal && <div className="modal-backdrop"><section className={`modal ${modal === 'export' ? 'export-studio' : modal === 'new' ? 'project-setup' : modal === 'formats' ? 'format-studio' : wideModal ? 'wide' : mediumModal ? 'medium' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header"><span className="eyebrow">{modalEyebrow}</span><IconButton label="Close dialog" onClick={requestCloseModal}><X size={20} /></IconButton></div>
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
          <h2 id="modal-title">Command palette</h2><p>Every action, searchable. Shortcuts reflect your current settings.</p>
          <CommandPalette platform={platform} bindings={shortcuts.bindings} availability={commandAvailability} onRun={runCommandId} onClose={requestCloseModal} />
        </> : modal === 'settings' ? <>
          <SettingsModal settingsTab={settingsTab} shortcutDirty={shortcutDirty} setNotice={setNotice} setSettingsTab={setSettingsTab} preferences={preferences} updatePreferences={updatePreferences} storageUsage={storageUsage} refreshAssetUsage={refreshAssetUsage} storageBusy={storageBusy} cleanStorage={cleanStorage} storageConfirm={storageConfirm} storageNote={storageNote} language={language} setLanguage={setLanguage} resetPreferences={resetPreferences} showHints={showHints} setShowHints={setShowHints} setSnapping={setSnapping} setLayout={setLayout} shortcuts={shortcuts} platform={platform} applyShortcuts={applyShortcuts} setShortcutDirty={setShortcutDirty} closeShortcutSettings={closeShortcutSettings} appVersion={appVersion} updateState={updateState} updateInfo={updateInfo} updateMessage={updateMessage} checkForUpdates={checkForUpdates} downloadUpdate={downloadUpdate} updateProgress={updateProgress} restartUpdate={restartUpdate} copyDownloadLink={copyDownloadLink} exporter={exporter} diagnostics={diagnostics} copyDiagnostics={copyDiagnostics} recheckExporter={recheckExporter} storageLabel={storageLabel} refreshStorage={refreshStorage} />
        </> : <>
          <ExportModal saveCredits={saveCredits} setSaveCredits={setSaveCredits} project={project} duration={duration} scenes={scenes} exportCodec={exportCodec} exportCodecs={exportCodecs} setExportCodec={setExportCodec} setExportContainer={setExportContainer} exportContainer={exportContainer} exportSpeed={exportSpeed} setExportSpeed={setExportSpeed} exportHardware={exportHardware} hardwareAvailable={hardwareAvailable} setExportHardware={setExportHardware} exportQuality={exportQuality} setExportQuality={setExportQuality} exportResolution={exportResolution} setExportResolution={setExportResolution} exportFps={exportFps} setExportFps={setExportFps} exportAudio={exportAudio} setExportAudio={setExportAudio} musicCredits={musicCredits} setNotice={setNotice} setError={setError} hasVideoScenes={hasVideoScenes} exportSettings={exportSettings} setExportSettings={setExportSettings} exportFormatIds={exportFormatIds} exportOutputs={exportOutputs} exportFormats={exportFormats} setExportFormatIds={setExportFormatIds} exportFilename={exportFilename} exporter={exporter} platform={platform} exporting={exporting} busy={busy} exportVideo={exportVideo} />
        </>}
      </section></div>}
    </div>
  );
}
