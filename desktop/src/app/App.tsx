import { ElementTextField } from '../components/elements/ElementTextField';
import { inspectorKind } from './inspector';
import { presetSize } from '../components/elements/designer';
import { PresetGlyph } from '../components/elements/PresetGlyph';
import { BehaviorControls } from '../components/elements/BehaviorControls';
import { ELEMENT_CATALOG, ELEMENT_CATEGORIES, ELEMENT_COLLECTIONS, elementPreset, elementDisplayName } from '../components/elements/catalog';
import { elementTransform } from '../components/elements/transform';
import { exportEta, exportOutputFormat } from './export-progress';
import { canvasPng } from '../components/preview/png';
import { framingTravel } from '../components/preview/framing';
import { centreGuides, edgeGuides, snapToTargets } from '../components/preview/snapping';
import { registerCustomFonts } from '../components/text/fonts';
import { splitTransition } from '../components/preview/transition-timing';
import { constrainPipTiming, freePipStart, pipSourceRoom } from '../components/timeline/pip';
import { isRamped, sourceSecondsAt, sourceSpan, speedAt, speedCurve } from '../components/preview/speed';
import { parseCaptions, placeCaptions } from '../components/text/captions';
import { textLayersAsCaptions, toSrt } from '../components/text/captions-export';
import { applyElementMotion, applyTextMotion } from '../components/animation/keyframes';
import { KeyframeControls } from '../components/animation/KeyframeControls';
import { snapOverlayTiming } from '../components/timeline/beats';
import { isAssetRef, resolveAssetUrl, resolveMediaSource } from '../components/preview/media-url';
import { assetExists, assetRef, storeAssetBlob } from '../stores/assets';
import { AssetImage, ClipFilmstrip } from '../components/preview/AssetImage';
import { beatMarkerTicks, detectBeats, snapScenesToBeats } from '../components/timeline/beat-sync';
import { MaskControls } from '../components/inspector/MaskControls';
import { videoGain } from '../components/preview/video-audio';
import { timelineOverlays, replaceOverlay, constrainOverlay, type TimelineOverlay } from '../components/elements/overlays';
import { sceneStack, stackIndex, stackZ, overlaysForScene, type StackMove } from '../components/elements/stack';
import { StackOrder } from '../components/inspector/StackOrder';
import { actionAudio } from '../components/elements/sound';
import { playbackPosition } from '../components/preview/playback-clock';
import { LatestRenderQueue } from '../components/preview/render-queue';
import { loadMediaBin, saveMediaBin, uniqueMediaSources } from '../stores/media-bin';
import { missingAssets, projectAssetRefs, replaceAssetRef, type MissingAsset } from '../stores/missing-assets';
import { syncAudioElement } from '../components/preview/audio';
import { isLocale, projectCount, setLocale, t, type Locale } from '../i18n';
import { applyClipEq } from '../components/preview/eq';
import { audibleVideoWindows, duckGain } from '../components/preview/ducking';
import { AudioSource } from '../components/preview/AudioSource';
import { shouldCheckForUpdates, showUpdateNotice } from './updates';
import { ELEMENT_LABEL_DEFAULTS } from '../components/elements/symbols';
import { exportBoundaries } from '../components/preview/export-timing';
import { useCallback, useMemo, useEffect, useRef, useState, type ChangeEvent, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  MousePointer2, Keyboard, Timer, AudioLines, ListChecks, Smartphone, ScanLine, Columns2, Captions, ListVideo, Flag,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Camera,
  Circle,
  Ban,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock3,
  Command as CommandIcon,
  Copy,
  Download,
  Film,
  FolderOpen,
  HardDrive,
  Home,
  ImagePlus,
  Images,
  Info,
  Layers,
  Link as LinkIcon,
  Quote,
  Hash,
  Heart,
  MapPin,
  MessageCircle,
  Minus,
  LayoutTemplate,
  Magnet,
  Maximize2,
  MoreHorizontal,
  Music,
  Mic,
  Pause,
  Pencil,
  Play,
  PlayCircle,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  Repeat,
  Save,
  Scissors,
  Search,
  Settings2,
  Shapes,
  SkipBack,
  Sparkles,
  Square,
  Share2,
  Star,
  ThumbsUp,
  Trash2,
  Triangle,
  Type,
  Undo2,
  Volume2,
  VolumeX,
  Youtube,
  Upload,
  WifiOff,
  X,
  ZoomIn,
  ZoomOut,
  Zap,
} from 'lucide-react';
import { ElementPreview } from '../components/elements/ElementPreview';
import { animationSelection, isContinuousMotion, ELEMENT_ANIMATIONS } from '../components/elements/motion';
import { Brand } from '../components/BrandLogo';
import { IconButton } from '../components/IconButton';
import { SceneForm, TRANSITION_OPTIONS } from '../components/inspector/SceneForm';
import { CommandPalette } from '../components/shortcuts/CommandPalette';
import { ShortcutHelp } from '../components/shortcuts/ShortcutHelp';
import { ShortcutSettings } from '../components/shortcuts/ShortcutSettings';
import * as bridge from './bridge';
import { MAX_AUDIO_FILE_BYTES, MAX_GLOBAL_TEXT, MAX_PROJECT_FONTS, overlayScenes, MAX_PROJECT_FORMATS, edit, emptyProject, frameRate, minTicks, projectScenes, replaceSceneImage, sceneAt, scenePatch, sceneSeconds, secondsPerTick, secondsToTicks, setSceneSeconds, ticksToSeconds, timecode, totalDuration, totalTicks, trimSceneWindow, validateProject, type AudioClip, type Command, type Project, type Scene, type ScenePatchKey, type Session, type TextLayer, type SceneFormatOverride, type FormatVariant, type ElementKind, type ElementLayer } from '../stores/model';
import { drawOverlayStack, drawPipClips, drawScene, drawProjectOverlays, drawProjectText, drawTransition, fadeOpacity, loadImage, textBoxLayout } from '../components/preview/render';
import { gradeLutCube } from '../components/preview/filters';
import { Waveform } from '../components/timeline/Waveform';
import { probeVideo, videoFileData } from '../components/preview/video';
import { createTextLayer, layerStartSeconds, layerVisibleAt, sceneTextLayers, sceneTextTitle } from '../components/text/layers';
import { clampWeight, fontOption } from '../components/text/fonts';
import { FORMAT_FILTERS, FORMAT_PRESETS, createCustomFormat, createFormat, filterFormatGroups, formatSlug, formatSize, groupFormatsByOutput, resolveSceneForFormat, resolveScenesForFormat } from '../stores/formats';
import { errorTitle, isImageFile, messageFor } from './errors';
import { deleteLibraryProject, deleteProjectGroup, duplicateLibraryProject, getLibraryProject, libraryAssetRefs, listProjects, renameProjectGroup, saveLibraryProject, setProjectFavorite, setProjectGroup, type ProjectSummary } from '../stores/library';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences, type Preferences } from '../stores/preferences';
import { SAMPLE_TEMPLATE, TEMPLATE_CATEGORIES, TEMPLATES, buildTemplateProject, templatePreview, type TemplateDefinition } from '../templates/catalog';
import { TEMPLATE_PHOTOS } from '../templates/photos';
import {
  COMMANDS,
  bindingMatchesEvent,
  detectPlatform,
  formatBinding,
  isTextEntryTarget,
  loadShortcutSettings,
  saveShortcutSettings,
  type CommandAvailability,
  type ShortcutPlatform,
  type ShortcutSettings as ShortcutSettingsData,
} from '../shortcuts/registry';
import '../styles/styles.css';

const INITIAL: Session = { project: emptyProject(), canUndo: false, canRedo: false };
const AVAILABLE: CommandAvailability = { disabled: false };
const HINTS_KEY = 'pixcut-hints-dismissed';
const RANGE_NAVIGATION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
const EXPORT_QUALITY_CRF: Record<'draft' | 'standard' | 'high', number> = { draft: 28, standard: 23, high: 18 };
// Codecs use different CRF scales; ProRes maps the value to a 422 profile.
const EXPORT_CODEC_CRF: Record<bridge.ExportCodec, Record<'draft' | 'standard' | 'high', number>> = {
  h264: EXPORT_QUALITY_CRF,
  hevc: { draft: 30, standard: 26, high: 20 },
  vp9: { draft: 35, standard: 32, high: 28 },
  prores: { draft: 30, standard: 24, high: 18 },
};
const EXPORT_CODEC_OPTIONS: { id: bridge.ExportCodec; label: string; description: string }[] = [
  { id: 'h264', label: 'H.264', description: 'Broad compatibility' },
  { id: 'hevc', label: 'H.265 / HEVC', description: 'Efficient compression' },
  { id: 'vp9', label: 'VP9', description: 'WebM for the web' },
  { id: 'prores', label: 'ProRes 422', description: 'Editing master' },
];
const EXPORT_CONTAINERS: Record<bridge.ExportCodec, bridge.ExportContainer[]> = {
  h264: ['mp4', 'mov', 'mkv'],
  hevc: ['mp4', 'mov', 'mkv'],
  vp9: ['webm'],
  prores: ['mov'],
};
const EXPORT_CONTAINER_LABEL: Record<bridge.ExportContainer, string> = {
  mp4: 'MP4 (.mp4)', mov: 'QuickTime (.mov)', mkv: 'Matroska (.mkv)', webm: 'WebM (.webm)',
};
const EXPORT_CONTAINER_SHORT: Record<bridge.ExportContainer, string> = { mp4: 'MP4', mov: 'MOV', mkv: 'MKV', webm: 'WEBM' };
const EXPORT_CODEC_NOTE: Record<bridge.ExportCodec, string> = {
  h264: 'H.264 is the default for sharing and everyday playback.',
  hevc: 'H.265 playback needs a player or device that supports HEVC.',
  vp9: 'VP9 in WebM plays in browsers and most modern players.',
  prores: 'ProRes 422 is a large editing master; quality picks LT, 422 or HQ.',
};
const RELEASES_URL = 'https://github.com/Plain-Workshop/pixcut/releases/latest';
const FFMPEG_INSTALL: Record<ShortcutPlatform, string> = { macos: 'brew install ffmpeg', windows: 'winget install Gyan.FFmpeg', linux: 'sudo apt install ffmpeg' };
const TITLE_PRESETS: { id: string; name: string; sample: string; layer: Partial<TextLayer> }[] = [
  { id: 'plain', name: 'Simple', sample: 'Your title', layer: { title: 'Your title', subtitle: '', font: 'inter', size: .07, align: 'center', x: .12, y: .42, width: .76 } },
  { id: 'editorial', name: 'Editorial', sample: 'A little story', layer: { title: 'A little story', subtitle: '', font: 'playfair', size: .08, x: .08, y: .65, width: .8, animation: 'fade' } },
  { id: 'bold', name: 'Bold', sample: 'MAKE IT.', layer: { title: 'MAKE IT.', subtitle: '', font: 'archivo-black', size: .1, x: .08, y: .2, width: .8, animation: 'pop' } },
  { id: 'note', name: 'Handwritten', sample: 'Remember this', layer: { title: 'Remember this', subtitle: '', font: 'caveat', size: .1, x: .08, y: .7, width: .8 } },
  { id: 'lower', name: 'Lower third', sample: 'Your name', layer: { title: 'Your name', subtitle: 'A little about you', font: 'dm-sans', size: .045, x: .08, y: .76, width: .7, backdropEnabled: true, backdropOpacity: 60 } },
  { id: 'plain', name: 'Chapter', sample: '01 / A new chapter', layer: { title: '01 / A new chapter', subtitle: '', font: 'space-grotesk', size: .055, x: .08, y: .45, width: .84, animation: 'slide-up' } },
  { id: 'bold', name: 'Quote', sample: '“Make it happen.”', layer: { title: '“Make it happen.”', subtitle: 'YOUR NAME', font: 'playfair', size: .075, align: 'center', x: .1, y: .4, width: .8 } },
  { id: 'lower', name: 'Interview', sample: 'Alex Morgan', layer: { title: 'Alex Morgan', subtitle: 'Designer / Creator', font: 'inter', size: .05, x: .07, y: .72, width: .75, backdropEnabled: true, backdropOpacity: 70, animation: 'slide-up' } },
  { id: 'plain', name: 'Date & place', sample: 'Warsaw, October 2026', layer: { title: 'Warsaw, October 2026', subtitle: '', font: 'dm-sans', size: .035, x: .08, y: .1, width: .84 } },
  { id: 'bold', name: 'Call to action', sample: 'Discover more', layer: { title: 'Discover more', subtitle: 'YOUR WEBSITE', font: 'archivo-black', size: .065, align: 'center', x: .1, y: .42, width: .8, animation: 'pop' } },
  { id: 'caption', name: 'Credits', sample: 'Made by you', layer: { title: 'Made by you', subtitle: 'FILM • PHOTOGRAPHY • MUSIC', font: 'inter', size: .045, align: 'center', x: .1, y: .48, width: .8, animation: 'fade' } },
  { id: 'caption', name: 'Caption', sample: 'Say something.', layer: { title: 'Say something.', subtitle: '', font: 'inter', size: .035, align: 'center', x: .1, y: .84, width: .8, backdropEnabled: true, backdropOpacity: 65 } },
];
const ELEMENTS = ELEMENT_CATALOG;
const ELEMENT_COLOR_DEFAULTS: Partial<Record<ElementKind, string>> = {
  subscribe: '#FF0033', like: '#0A66C2', bell: '#FFD166', comment: '#FFFFFF',
  share: '#6BE7FF', play: '#FFFFFF', progress: '#FF7A9E', location: '#FF6B6B',
  music: '#9D7CFF', check: '#7CF0B4', cross: '#FF7A9E', ring: '#9D7CFF',
  cursor: '#FFFFFF', underline: '#9D7CFF',
};
const ELEMENT_COLORS = ['#9D7CFF', '#FF7A9E', '#FFD166', '#6BE7FF', '#7CF0B4', '#FFFFFF'];
function ElementGlyph({ kind, presetId, size = 18 }: { kind: ElementKind; presetId?: string; size?: number }) {
  if (presetId) return <PresetGlyph id={presetId} size={size} />;
  switch (kind) {
    case 'caption': return <Captions size={size} />;
    case 'chapter': return <ListVideo size={size} />;
    case 'callout': return <MapPin size={size} />;
    case 'keycaps': return <Keyboard size={size} />;
    case 'mouse': return <MousePointer2 size={size} />;
    case 'device': return <Smartphone size={size} />;
    case 'comparison': return <Columns2 size={size} />;
    case 'checklist': return <ListChecks size={size} />;
    case 'rating': return <Star size={size} />;
    case 'countdown': return <Timer size={size} />;
    case 'waveform': return <AudioLines size={size} />;
    case 'message': return <MessageCircle size={size} />;
    case 'qr': return <ScanLine size={size} />;
    case 'end-screen': return <Flag size={size} />;
    case 'burst': return <Sparkles size={size} />;
    case 'frame': return <Maximize2 size={size} />;
    case 'dots': return <MoreHorizontal size={size} />;
    case 'tape': return <Square size={size} />;
    case 'chevron': return <ArrowRight size={size} />;
    case 'label': case 'name-tag': return <Type size={size} />;
    case 'link': return <LinkIcon size={size} />;
    case 'quote': return <Quote size={size} />;
    case 'counter': return <Hash size={size} />;
    case 'status': return <Check size={size} />;
    case 'image': return <Images size={size} />;
    case 'video': return <Film size={size} />;
    case 'subscribe': return <Youtube size={size} />;
    case 'like': return <ThumbsUp size={size} />;
    case 'bell': return <Bell size={size} />;
    case 'comment': return <MessageCircle size={size} />;
    case 'share': return <Share2 size={size} />;
    case 'play': return <PlayCircle size={size} />;
    case 'progress': return <Minus size={size} />;
    case 'location': return <MapPin size={size} />;
    case 'music': return <Music size={size} />;
    case 'check': return <Check size={size} />;
    case 'cross': return <X size={size} />;
    case 'ring': return <Circle size={size} />;
    case 'cursor': return <MousePointer2 size={size} />;
    case 'underline': return <Minus size={size} />;
    case 'rectangle': return <Square size={size} />;
    case 'ellipse': return <Circle size={size} />;
    case 'triangle': return <Triangle size={size} />;
    case 'star': return <Star size={size} />;
    case 'sparkle': return <Sparkles size={size} />;
    case 'line': return <Minus size={size} />;
    case 'arrow': return <ArrowRight size={size} />;
    case 'heart': return <Heart size={size} />;
  }
}

const elementName = elementDisplayName;

function sortProjects(items: ProjectSummary[]) {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt);
}

function relativeTime(timestamp: number) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)} d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function imageFileData(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return Promise.reject(new Error(`“${file.name}” is not a JPEG, PNG, or WebP image. Choose one of those formats.`));
  }
  if (file.size > 500 * 1024 * 1024) {
    return Promise.reject(new Error(`“${file.name}” is larger than 500 MB. Choose a smaller image.`));
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function audioMime(file: File) {
  const type = file.type.toLowerCase();
  if (type === 'audio/mpeg' || type === 'audio/mp3') return 'audio/mpeg';
  if (type === 'audio/wav' || type === 'audio/x-wav') return 'audio/wav';
  if (type === 'audio/mp4' || type === 'audio/x-m4a') return 'audio/mp4';
  if (type === 'audio/aac') return 'audio/aac';
  if (type === 'audio/ogg') return 'audio/ogg';
  if (type === 'audio/webm') return 'audio/webm';
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'mp3') return 'audio/mpeg';
  if (extension === 'wav') return 'audio/wav';
  if (extension === 'm4a' || extension === 'mp4') return 'audio/mp4';
  if (extension === 'aac') return 'audio/aac';
  if (extension === 'ogg' || extension === 'oga') return 'audio/ogg';
  if (extension === 'webm') return 'audio/webm';
  return '';
}

function fileFromPicked(item: bridge.PickedMedia): File {
  const payload = item.data.slice(item.data.indexOf(',') + 1);
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], item.name, { type: item.mime });
}

async function audioFileData(file: File) {
  const mime = audioMime(file);
  if (!mime) {
    if (isImageFile(file)) throw new Error(`“${file.name}” is an image, not audio. Choose an MP3, WAV, M4A, OGG, or WebM audio file.`);
    throw new Error(`“${file.name}” is not a supported audio file. Choose MP3, WAV, M4A, OGG, or WebM.`);
  }
  if (file.size > MAX_AUDIO_FILE_BYTES) throw new Error(`“${file.name}” is larger than 50 MB. Choose a shorter or smaller audio file.`);
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`“${file.name}” could not be read. Try choosing it again.`));
    reader.readAsDataURL(file);
  });
  return `data:${mime};base64,${raw.slice(raw.indexOf(',') + 1)}`;
}

async function audioDuration(data: string) {
  const source = await resolveMediaSource(data);
  if (!source) return 0;
  return new Promise<number>(resolve => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.onerror = () => resolve(0);
    audio.src = source;
  });
}

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function previewClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}


function mediaSource(value: string | undefined) {
  return value && !value.startsWith('pixcut-asset:') ? value : undefined;
}
/** True when a source is a data URL or a streamed asset reference. */
function hasMedia(value: string | undefined) {
  return Boolean(value) && (value!.startsWith('pixcut-asset:') || Boolean(mediaSource(value)));
}

export default function App() {
  const [session, setSession] = useState(INITIAL), [screen, setScreen] = useState<'home' | 'editor'>('home');
  const [homeSection, setHomeSection] = useState<'home' | 'projects'>('home');
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [playing, setPlaying] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]), [primarySelected, setPrimarySelected] = useState<string | null>(null), [position, setPosition] = useState(0);
  const [tab, setTab] = useState<'media' | 'text' | 'elements' | 'audio' | 'templates'>('media'), [modal, setModal] = useState<'source' | 'templates' | 'export' | 'new' | 'shortcuts' | 'palette' | 'settings' | 'delete' | 'rename' | 'group' | 'groups' | 'formats' | 'missing' | null>(null);
  const [settingsTab, setSettingsTab] = useState<'general' | 'appearance' | 'editing' | 'shortcuts' | 'updates' | 'privacy'>('general');
  const [appVersion, setAppVersion] = useState(__APP_VERSION__);
  const lastUpdateCheck = useRef(0);
  const updateCheckInFlight = useRef(false);
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'>('idle');
  const [updateInfo, setUpdateInfo] = useState<bridge.UpdateInfo | null>(null);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateMessage, setUpdateMessage] = useState('');
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
  const [sourcePreview, setSourcePreview] = useState<Scene | null>(null);
  const previewVideo = useRef<HTMLVideoElement | null>(null);
  const [previewVideoTime, setPreviewVideoTime] = useState(0);
  const [previewVideoDuration, setPreviewVideoDuration] = useState(0);
  const [previewVideoPlaying, setPreviewVideoPlaying] = useState(false);
  const [previewVolume, setPreviewVolume] = useState(.8);
  const [previewMuted, setPreviewMuted] = useState(false);
  const customElementInput = useRef<HTMLInputElement>(null);
  const customElementKind = useRef<'image' | 'video'>('image');
  const [exportElapsed, setExportElapsed] = useState(0);
  const [exportJob, setExportJob] = useState({ name: '', phase: 'Preparing frames' });
  const [exportQuality, setExportQuality] = useState('standard');
  const [exportCodec, setExportCodec] = useState<bridge.ExportCodec>('h264');
  const [exportContainer, setExportContainer] = useState<bridge.ExportContainer>('mp4');
  const [exportSpeed, setExportSpeed] = useState<'fast' | 'medium' | 'slow'>('medium');
  const [hardwareAvailable, setHardwareAvailable] = useState(false);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | undefined>(undefined);
  const [exportHardware, setExportHardware] = useState(false);
  const [exportAudio, setExportAudio] = useState(true);
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
  const [projectMenu, setProjectMenu] = useState<string | null>(null), [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
  const [renameTarget, setRenameTarget] = useState<ProjectSummary | null>(null), [renameDraft, setRenameDraft] = useState('');
  const [groupTarget, setGroupTarget] = useState<ProjectSummary | null>(null), [groupDraft, setGroupDraft] = useState('');
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [librarySort, setLibrarySort] = useState<'recent' | 'name' | 'duration'>('recent');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [reorderId, setReorderId] = useState<string | null>(null);
  const [replacingSceneId, setReplacingSceneId] = useState<string | null>(null);
  const [fileDragActive, setFileDragActive] = useState(false);
  const [audioDraft, setAudioDraft] = useState<AudioClip | null>(null);
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
  const [newCustomFormats, setNewCustomFormats] = useState<FormatVariant[]>([]);
  const [newProjectFps, setNewProjectFps] = useState(30);
  const [editTarget, setEditTarget] = useState<'scene' | 'text' | 'element' | 'audio'>('scene');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [videoTick, setVideoTick] = useState(0);
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
  const [newFormatIds, setNewFormatIds] = useState<string[]>(['youtube-video']);
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
  const [layout, setLayout] = useState(() => { try { return JSON.parse(localStorage.getItem('pixcut-layout') || '{}'); } catch { return {}; } });
  const libraryWidth = layout.libraryWidth ?? 280, inspectorWidth = layout.inspectorWidth ?? 288, timelineHeight = layout.timelineHeight ?? 340;
  const timelineZoom = Math.min(6, Math.max(.5, Number(layout.timelineZoom) || 1));

  function beginResize(kind: 'library' | 'inspector' | 'timeline', start: number, coord: number) {
    const onMove = (e: PointerEvent) => {
      setLayout((l: any) => {
        if (kind === 'library') return { ...l, libraryWidth: Math.min(380, Math.max(220, start + (e.clientX - coord))) };
        if (kind === 'inspector') return { ...l, inspectorWidth: Math.min(380, Math.max(220, start + (coord - e.clientX))) };
        return { ...l, timelineHeight: Math.min(460, Math.max(230, start + (coord - e.clientY))) };
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setLayout((l: any) => { try { localStorage.setItem('pixcut-layout', JSON.stringify(l)); } catch {} return l; });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function changeTimelineZoom(value: number) {
    const next = Math.min(6, Math.max(.5, Math.round(value * 4) / 4));
    setLayout((current: any) => {
      const updated = { ...current, timelineZoom: next };
      try { localStorage.setItem('pixcut-layout', JSON.stringify(updated)); } catch { /* optional */ }
      return updated;
    });
  }

  useEffect(() => {
    const element = timelineScroll.current;
    if (!element) return;
    const ratio = duration > 0 ? position / duration : 0;
    const frame = requestAnimationFrame(() => { element.scrollLeft = Math.max(0, ratio * element.scrollWidth - element.clientWidth * .45); });
    return () => cancelAnimationFrame(frame);
  }, [timelineZoom]);

  const pending = useRef<Promise<boolean>>(Promise.resolve(true)), latestProject = useRef(INITIAL.project);
  const mediaInput = useRef<HTMLInputElement>(null), projectInput = useRef<HTMLInputElement>(null), replaceInput = useRef<HTMLInputElement>(null), audioInput = useRef<HTMLInputElement>(null), captionInput = useRef<HTMLInputElement>(null), fontInput = useRef<HTMLInputElement>(null), videoInput = useRef<HTMLInputElement>(null), sceneVideo = useRef<HTMLVideoElement>(null), preview = useRef<HTMLCanvasElement>(null), audioElements = useRef<Map<string, HTMLAudioElement>>(new Map()), previewArea = useRef<HTMLDivElement>(null), previewStage = useRef<HTMLDivElement>(null), operation = useRef(false);
  const replaceTargetId = useRef<string | null>(null), inspectorFlush = useRef<() => void>(() => {}), audioDraftRef = useRef<AudioClip | null>(null), audioLaneRef = useRef(0);
  const sceneQueue = useRef<Command[]>([]), previewQueue = useRef<LatestRenderQueue | null>(null), timelineScroll = useRef<HTMLDivElement>(null);
  const positionRef = useRef(0), closeModalRef = useRef<() => void>(() => {}), commandRef = useRef<(id: string) => void>(() => {}), fullscreenRef = useRef<() => void>(() => {});
  const selectionAnchor = useRef<string | null>(null), reorderRef = useRef<string | null>(null);
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

  const hasVideoScenes = scenes.some(scene => scene.mediaKind === 'video');
  const activeFormat = project.formats.find(format => format.id === activeFormatId) ?? project.formats[0];
  const activeSize = formatSize(activeFormat);
  const exportFormats = project.formats.map(format => exportOutputFormat(format, exportResolution, exportQuality, exportFps));
  const exportOutputs = groupFormatsByOutput(exportFormats.filter(format => exportFormatIds.includes(format.id)));
  const projectFormatOutputs = groupFormatsByOutput(project.formats);
  const useHardware = exportHardware && hardwareAvailable && (exportCodec === 'h264' || exportCodec === 'hevc');
  const displayAspect = project.aspect;
  const cueAudio = useMemo(() => actionAudio(project), [project]);
  const videoDuckWindows = useMemo(() => audibleVideoWindows(projectScenes(project), project.timebase), [project.tracks, project.timebase]);
  const audioClips = previewAudio ?? project.audio;
  const audio = audioClips.map(clip => audioDraft?.id === clip.id ? audioDraft : clip);
  const selectedAudio = audioDraft ?? audio.find(clip => clip.id === selectedAudioId) ?? audio[0] ?? null;
  const audioLanes = Array.from({ length: Math.max(0, ...audio.map(clip => clip.lane ?? 0)) + 1 }, (_, lane) => lane);
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
  const previewTarget = previewScene ?? active;
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
  const activePip = pipDraft?.id === selectedPip?.id ? pipDraft : selectedPip;
  const selectedTextScene = selectedGlobalText ? projectTextScene : (previewScene && selectedScene && previewScene.id === selectedScene.id ? previewScene : selectedScene);
  const selectedTextLayers = selectedGlobalText ? [selectedGlobalText] : (selectedTextScene ? sceneTextLayers(selectedTextScene) : []);
  const selectedTextLayer = selectedGlobalText ?? selectedTextLayers.find(layer => layer.id === selectedTextLayerId) ?? selectedTextLayers[0] ?? null;
  const allOverlays = useMemo(() => timelineOverlays(project), [project]);
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
  const previewList = useMemo(() => {
    if (!sourcePreview) return sourceMedia;
    return filteredScenes.some(item => item.id === sourcePreview.id) ? filteredScenes : sourceMedia;
  }, [filteredScenes, sourceMedia, sourcePreview]);
  const previewIndex = sourcePreview ? previewList.findIndex(item => item.id === sourcePreview.id) : -1;
  const canEdit = ready && !busy;

  const refreshLibrary = useCallback(async () => {
    try { setProjects(sortProjects(await listProjects())); }
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

  function updateErrorText(error: unknown) {
    const raw = error instanceof Error ? error.message : String(error ?? '');
    if (/fetch|network|connect|timeout|release json|status code|404|403|500/i.test(raw)) return 'Could not reach the release feed. Check your connection and try again.';
    if (/signature|public key|verify/i.test(raw)) return 'This update could not be verified, so PixCut did not install it.';
    return messageFor(error);
  }

  async function performUpdateCheck(silent: boolean) {
    if (updateCheckInFlight.current) return;
    updateCheckInFlight.current = true;
    lastUpdateCheck.current = Date.now();
    if (!silent) { setUpdateState('checking'); setUpdateMessage(''); }
    try {
      const info = await bridge.checkForUpdate();
      setUpdateInfo(info);
      setUpdateState(info ? 'available' : 'idle');
      if (!silent) setUpdateMessage(info ? '' : 'PixCut is up to date.');
    } catch (error) {
      if (!silent) { setUpdateState('error'); setUpdateMessage(updateErrorText(error)); }
    } finally { updateCheckInFlight.current = false; }
  }

  function checkForUpdates() { void performUpdateCheck(false); }

  useEffect(() => {
    const check = () => {
      if (shouldCheckForUpdates({ native: bridge.native, enabled: preferences.automaticUpdates, home: screen === 'home' && !exporting,
        visible: document.visibilityState === 'visible', online: navigator.onLine, state: updateState, lastCheck: lastUpdateCheck.current, now: Date.now() })) void performUpdateCheck(true);
    };
    const startup = window.setTimeout(check, 15_000);
    const interval = window.setInterval(check, 60_000);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    return () => { clearTimeout(startup); clearInterval(interval); window.removeEventListener('online', check); document.removeEventListener('visibilitychange', check); };
  }, [preferences.automaticUpdates, screen, exporting, updateState]);

  function downloadUpdate() {
    setUpdateState('downloading'); setUpdateProgress(0); setUpdateMessage('');
    bridge.installUpdate(setUpdateProgress)
      .then(() => { setUpdateState('ready'); setUpdateMessage(''); setNotice('Update downloaded. Restart PixCut to finish.'); })
      .catch(error => { setUpdateState('error'); setUpdateMessage(updateErrorText(error)); });
  }

  function restartUpdate() {
    bridge.restartToUpdate().catch(error => { setUpdateState('error'); setUpdateMessage(updateErrorText(error)); });
  }

  function copyDownloadLink() {
    if (!navigator.clipboard) { setNotice(`Download the latest release from ${RELEASES_URL}`); return; }
    navigator.clipboard.writeText(RELEASES_URL).then(() => setNotice('Download link copied.')).catch(() => setNotice(`Download the latest release from ${RELEASES_URL}`));
  }

  useEffect(() => { savePreferences(preferences); }, [preferences]);

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

  useEffect(() => { bridge.initialize().then(s => { setSession(s); latestProject.current = s.project; setName(s.project.name); }).catch(e => setError(`Recovery could not be loaded. ${messageFor(e)}`)).finally(() => setReady(true)); bridge.exporterAvailable().then(setExporter).catch(() => setExporter(false)); bridge.appVersion().then(version => { if (version) setAppVersion(version); }).catch(() => { /* browser preview */ }); }, []);
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
    let cancelled = false;
    const source = sourcePreview?.image;
    if (!source) { setSourcePreviewUrl(undefined); return; }
    if (!source.startsWith('pixcut-asset:')) { setSourcePreviewUrl(source); return; }
    setSourcePreviewUrl(undefined);
    void resolveMediaSource(source).then(url => { if (!cancelled) setSourcePreviewUrl(url); }).catch(() => {});
    return () => { cancelled = true; };
  }, [sourcePreview?.image]);

  useEffect(() => {
    if (!bridge.native || modal !== 'settings' || settingsTab !== 'general') return;
    void refreshAssetUsage();
  }, [modal, settingsTab]);

  useEffect(() => { void refreshLibrary(); }, [refreshLibrary]);
  useEffect(() => { if (screen === 'home') void refreshLibrary(); }, [screen, refreshLibrary]);
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
  useEffect(() => {
    if (!project.audio.length) { setSelectedAudioId(null); return; }
    setSelectedAudioId(id => id && project.audio.some(clip => clip.id === id) ? id : project.audio[0].id);
  }, [project.audio]);
  useEffect(() => {
    const duck = duckGain(position, videoDuckWindows, project.ducking ?? 0);
    for (const clip of audio) {
      const element = audioElements.current.get(clip.id);
      if (!element) continue;
      syncAudioElement(element, clip, position, playing && playDirection > 0, project.timebase, undefined, duck);
      applyClipEq(element, clip);
    }
    for (const clip of cueAudio) {
      const element = audioElements.current.get(clip.id);
      if (!element) continue;
      syncAudioElement(element, clip, position, playing && playDirection > 0, project.timebase);
    }
  }, [position, playing, playDirection, audio, cueAudio, project.timebase, videoDuckWindows, project.ducking]);
  useEffect(() => () => { for (const element of audioElements.current.values()) element.pause(); recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop(); if (recordTimer.current) clearInterval(recordTimer.current); }, []);
  useEffect(() => {
    if (!projectMenu) return;
    const close = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(`[data-project-menu="${projectMenu}"], [data-project-actions="${projectMenu}"]`)) return;
      setProjectMenu(null);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [projectMenu]);
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
    const light = (value: Command) => value.type === 'order' || value.type === 'update' || value.type === 'updateMany' || value.type === 'audio' || value.type === 'overlays';
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
      const next = playbackPosition(origin, startedAt, now, playDirection);
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
      if (element.getAttribute('src')) { element.removeAttribute('src'); element.load(); }
      return;
    }
    if (element.dataset.sceneId !== videoScene.id) {
      element.dataset.sceneId = videoScene.id;
      // Keep the new source silent until the play effect decides otherwise.
      element.muted = true;
      const sceneId = videoScene.id;
      void resolveMediaSource(videoScene.image).then(url => {
        if (!url) { setError('That video is missing from the local store. Relink the clip.'); return; }
        if (element.dataset.sceneId !== sceneId) return;
        element.src = url;
        element.load();
      }, error => setError(messageFor(error)));
    }
  }, [videoScene?.id, videoScene?.image]);

  useEffect(() => {
    const element = sceneVideo.current;
    if (!element || !videoScene) return;
    const clipSeconds = Math.max(0.001, ticksToSeconds(videoScene.durationTicks, project.timebase));
    const inPoint = ticksToSeconds(videoScene.sourceInTicks ?? 0, project.timebase);
    const fallback = inPoint + sourceSpan(videoScene, clipSeconds);
    const end = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : fallback;
    const target = Math.max(0, Math.min(sourceSecondsAt(videoScene, previewLocalSeconds, project.timebase), end - 0.04));
    // A reversed clip is stepped by seeking; `playbackRate` cannot go negative.
    if (!videoScene.reverse) {
      const speed = speedAt(videoScene, previewLocalSeconds, clipSeconds);
      if (element.playbackRate !== speed) element.playbackRate = speed;
    }
    element.volume = videoGain(previewLocalSeconds, clipSeconds, videoScene.fadeIn ?? 0, videoScene.fadeOut ?? 0, videoScene.videoVolume ?? 100);
    if (element.readyState >= 2 && Math.abs(element.currentTime - target) > 0.12) element.currentTime = target;
  }, [previewLocalSeconds, videoScene?.id, videoScene?.speed, videoScene?.speedEnd, videoScene?.reverse, videoScene?.fadeIn, videoScene?.fadeOut, project.timebase]);

  useEffect(() => {
    const element = sceneVideo.current;
    if (!element || !videoScene) return;
    // The clip's own soundtrack only plays while moving forward; scrubbing and
    // reverse playback stay silent, matching how the audio clips behave.
    element.muted = !(playing && playDirection > 0) || Boolean(videoScene.reverse);
    if (playing && playDirection > 0 && !videoScene.reverse) element.play().catch(() => { /* the poster stays visible */ });
    else element.pause();
  }, [playing, playDirection, videoScene?.id, videoScene?.reverse]);

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
      await drawPipClips(layer, renderPipScenes, position, displayAspect, 'preview', project.timebase, project.audio);
      await drawProjectText(layer, globalTextDraft ?? project.globalText ?? [], position, project.timebase);
      if (preview.current && latestProject.current.id === projectId) {
        preview.current.width = layer.width; preview.current.height = layer.height;
        preview.current.getContext('2d')?.drawImage(layer, 0, 0);
      }
    });
  }, [previewTarget, previewLocalSeconds, displayAspect, project.timebase, project.audio, project.tracks, pipDraft, project.globalText, globalTextDraft, screen, activeFormat?.id, framingStaged, previewTransition?.type, previewTransition?.progress, previewTransition?.next, videoTick, videoScene?.id, renderOverlays, draggingOverlay, playing, activeSize.width, activeSize.height]);

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
        if (!selectedScenes.length) return { disabled: true, reason: 'Select a clip first.' };
        if (selectedScenes.length !== 1) return { disabled: true, reason: 'Select one clip to split.' };
        if (!canEdit) return { disabled: true, reason: 'Finish the current operation first.' };
        return scene && sceneOffsetTicks >= splitMinimum && scene.durationTicks - sceneOffsetTicks >= splitMinimum ? AVAILABLE : { disabled: true, reason: 'Place the playhead at least half a second inside the selected clip.' };
      case 'clip.delete':
      case 'clip.ripple_delete':
        if (!editor) return { disabled: true, reason: 'Open a story to edit clips.' };
        if (editTarget !== 'audio' && !selectedScenes.length || editTarget === 'audio' && !selectedAudioId) return { disabled: true, reason: 'Select a clip first.' };
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

  function togglePlayback() {
    if (!duration) return;
    if (playing) { setPlaying(false); return; }
    if (position >= duration - frameSeconds) setPosition(0);
    setPlayDirection(1);
    setPlaying(true);
  }

  function playForward() {
    if (!duration) return;
    if (position >= duration - frameSeconds) setPosition(0);
    setPlayDirection(1);
    setPlaying(true);
  }

  function playReverse() {
    if (!duration) return;
    if (position <= frameSeconds) setPosition(Math.max(0, duration - frameSeconds));
    setPlayDirection(-1);
    setPlaying(true);
  }

  function stepFrame(direction: 1 | -1) {
    if (!duration) return;
    setPlaying(false);
    setPosition(value => Math.min(Math.max(0, value + direction * frameSeconds), Math.max(0, duration - frameSeconds)));
  }

  function snapTime(value: number) {
    const limit = Math.max(0, duration - frameSeconds);
    const clamped = Math.min(Math.max(0, value), limit);
    if (!snapping) return clamped;
    const cuts = [0];
    for (const scene of scenes) {
      cuts.push(Math.min(ticksToSeconds(scene.startTicks, project.timebase), limit));
      cuts.push(Math.min(ticksToSeconds(scene.startTicks + scene.durationTicks, project.timebase), limit));
    }
    let best = clamped, distance = 0.12;
    for (const cut of cuts) {
      const gap = Math.abs(cut - clamped);
      if (gap <= distance) { distance = gap; best = cut; }
    }
    return best;
  }

  function scrubTo(value: number) {
    setPlaying(false);
    setPosition(snapTime(value));
  }

  function focusScene(scene: Scene) {
    setPlaying(false);
    setPosition(ticksToSeconds(scene.startTicks, project.timebase));
  }

  function selectScene(scene: Scene, event?: ReactMouseEvent) {
    commitElement();
    setSelectedElementId(null); setOverlayDraft(null); overlayDraftRef.current = null;
    setEditingText(false); setSelectedTextLayerId(null); setSelectedGlobalTextId(null); setGlobalTextDraft(null);
    setSelectedPipId(null); setPipDraft(null); pipDraftRef.current = null;
    setEditTarget('scene');
    const toggle = Boolean(event?.metaKey || event?.ctrlKey);
    const range = Boolean(event?.shiftKey);
    if (toggle) {
      if (selectedIds.includes(scene.id)) {
        const next = selectedIds.filter(id => id !== scene.id);
        setSelectedIds(next);
        if (primarySelected === scene.id) setPrimarySelected(next.at(-1) ?? null);
        selectionAnchor.current = scene.id;
      } else {
        setSelectedIds([...selectedIds, scene.id]);
        setPrimarySelected(scene.id);
        selectionAnchor.current = scene.id;
        focusScene(scene);
      }
      return;
    }
    if (range && selectionAnchor.current) {
      const ids = scenes.map(item => item.id);
      const from = ids.indexOf(selectionAnchor.current), to = ids.indexOf(scene.id);
      if (from >= 0 && to >= 0) {
        setSelectedIds(ids.slice(Math.min(from, to), Math.max(from, to) + 1));
        setPrimarySelected(scene.id);
        focusScene(scene);
        return;
      }
    }
    setSelectedIds([scene.id]);
    setPrimarySelected(scene.id);
    selectionAnchor.current = scene.id;
    focusScene(scene);
  }

  function updateSelection(next: Scene, force: ScenePatchKey[] = []): Promise<boolean> {
    if (selectedGlobalText) {
      const layers = next.textLayers ?? [];
      return run({ type: 'globalText', layers }).finally(() => setGlobalTextDraft(null));
    }
    const targets = selectedScenes;
    if (!targets.length) return Promise.resolve(false);
    const base = targets.find(scene => scene.id === next.id) ?? targets[0];
    const patch = scenePatch(base, next);
    for (const key of force) {
      const value = (next as unknown as Record<string, unknown>)[key];
      if (value !== undefined) (patch as Record<string, unknown>)[key] = value;
    }
    if (!Object.keys(patch).length) return Promise.resolve(true);
    const ids = targets.map(scene => scene.id);
    const framingKeys = ['imageX', 'imageY', 'imageZoom', 'fit', 'framingBackground'] as const;
    const framePatch: SceneFormatOverride = {};
    const existingFraming = activeFormat?.overrides[base.id];
    let frameChanged = false;
    for (const key of framingKeys) {
      if (!(key in patch)) continue;
      const value = (patch as Record<string, unknown>)[key];
      if (value !== undefined) {
        (framePatch as Record<string, unknown>)[key] = value;
        if ((existingFraming as Record<string, unknown> | undefined)?.[key] !== value) frameChanged = true;
      }
      delete (patch as Record<string, unknown>)[key];
    }
    let formatsTask: Promise<boolean> | null = null;
    if (frameChanged && activeFormat) {
      const nextFormats = project.formats.map(format => format.id === activeFormat.id
        ? { ...format, overrides: { ...format.overrides, ...Object.fromEntries(ids.map(id => [id, { ...format.overrides[id], ...framePatch }])) } }
        : format);
      formatsTask = run({ type: 'formats', formats: nextFormats });
    }
    const applyPatch = (): Promise<boolean> => {
      const latest = projectScenes(latestProject.current);
      const currentTargets = ids.map(id => latest.find(scene => scene.id === id)).filter((scene): scene is Scene => Boolean(scene));
      if (!currentTargets.length) return Promise.resolve(false);
      if (currentTargets.length === 1) {
        return run({ type: 'update', scene: { ...currentTargets[0], ...patch } });
      }
      const scenes = currentTargets.map(scene => {
        const merged: Scene = { ...scene, ...patch };
        if (patch.speed !== undefined) {
          const source = sceneSeconds(scene, project.timebase) * (scene.speed ?? 1);
          const duration = Math.min(30, Math.max(0.5, source / patch.speed));
          const resized = setSceneSeconds(scene, duration, project.timebase);
          merged.durationTicks = resized.durationTicks;
          merged.speed = patch.speed;
        } else if (patch.durationTicks !== undefined) {
          merged.durationTicks = setSceneSeconds(merged, ticksToSeconds(patch.durationTicks, project.timebase), project.timebase).durationTicks;
        }
        const seconds = sceneSeconds(merged, project.timebase);
        merged.fadeIn = Math.min(merged.fadeIn ?? 0, seconds);
        merged.fadeOut = Math.min(merged.fadeOut ?? 0, seconds);
        return merged;
      });
      return run({ type: 'updateMany', scenes });
    };
    const commonTask = Object.keys(patch).length ? (operation.current ? pending.current.then(applyPatch) : Promise.resolve(applyPatch())) : null;
    const task = formatsTask ?? commonTask ?? Promise.resolve(true);
    return task.finally(() => setPreviewScene(null));
  }

  function splitAtPlayhead() {
    if (selectedScenes.length !== 1) {
      setNotice('Select one clip to split at the playhead.');
      return;
    }
    const scene = selectedScenes[0];
    const index = scenes.findIndex(item => item.id === scene.id);
    if (index < 0) return;
    const atTicks = secondsToTicks(position, project.timebase) - scene.startTicks;
    const splitMinimum = minTicks(project.timebase);
    if (atTicks < splitMinimum || scene.durationTicks - atTicks < splitMinimum) {
      setNotice('Place the playhead at least half a second inside the selected clip.');
      return;
    }
    const newId = crypto.randomUUID();
    void run({ type: 'split', id: scene.id, atTicks, newId }).then(ok => {
      if (ok) {
        setSelectedIds([newId]);
        setPrimarySelected(newId);
        selectionAnchor.current = newId;
        setNotice('Clip split at the playhead. Undo restores one clip.');
      }
    });
  }

  function duplicateSelected() {
    const targets = selectedScenes;
    if (!targets.length) return;
    const items = targets.map(scene => ({ id: scene.id, newId: crypto.randomUUID() }));
    void run({ type: 'duplicateMany', items }).then(ok => {
      if (ok) {
        const newIds = items.map(item => item.newId);
        setSelectedIds(newIds);
        setPrimarySelected(newIds.at(-1) ?? null);
        selectionAnchor.current = newIds.at(-1) ?? null;
        setNotice(`${items.length} clip${items.length === 1 ? '' : 's'} duplicated${items.length === 1 ? '' : ' together'}.`);
      }
    });
  }

  function deleteSelected() {
    if (editTarget === 'audio') { if (selectedAudioId) removeAudio(selectedAudioId); return; }
    if (editTarget === 'element') { if (selectedElement) removeElement(selectedElement.id); return; }
    if (selectedPip) { removePip(selectedPip.id); return; }
    if (editTarget === 'text' && selectedGlobalText) {
      const layers = (project.globalText ?? []).filter(layer => layer.id !== selectedGlobalText.id);
      void run({ type: 'globalText', layers });
      setSelectedGlobalTextId(null); return;
    }
    if (editTarget === 'text' && selectedScene && selectedTextLayerId) {
      const layers = sceneTextLayers(selectedScene).filter(layer => layer.id !== selectedTextLayerId);
      void updateSelection(replaceSceneTextLayers(selectedScene, layers));
      setSelectedTextLayerId(null); return;
    }
    if (editTarget === 'text') return;
    if (!hasSceneSelection) {
      if (selectedAudioId) {
        const clip = audio.find(item => item.id === selectedAudioId);
        if (clip) { removeAudio(clip.id); return; }
      }
      setNotice('Select a clip to delete.');
      return;
    }
    const targets = selectedScenes;
    if (!targets.length) return;
    const ids = targets.map(scene => scene.id);
    void run({ type: 'removeMany', ids }).then(ok => {
      if (ok) {
        setSelectedIds([]);
        setPrimarySelected(null);
        selectionAnchor.current = null;
        setNotice(`${ids.length} clip${ids.length === 1 ? '' : 's'} deleted. Undo restores ${ids.length === 1 ? 'it' : 'them'}.`);
      }
    });
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
      id: crypto.randomUUID(), kind, presetId, label: preset.text, ...(preset.behavior ? { behavior: preset.behavior } : {}), x: .5 + (count % 3) * .035, y: .5 + (count % 2) * .035, ...presetSize(preset, activeSize),
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

  function beginElementMove(event: ReactPointerEvent<HTMLElement>, element = selectedElement) {
    if (!element || !canEdit || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); inspectorFlush.current();
    selectOverlay(element, false);
    const stage = previewStage.current?.getBoundingClientRect(); if (!stage?.width || !stage.height) return;
    setPlaying(false); setDraggingOverlay(true);
    const startX = event.clientX, startY = event.clientY;
    const visibleOthers = allOverlays.filter(other => other.id !== element.id
      && position >= ticksToSeconds(other.startTicks, project.timebase)
      && position < ticksToSeconds(other.startTicks + other.durationTicks, project.timebase));
    const xGuides = centreGuides(visibleOthers.map(other => other.x));
    const yGuides = centreGuides(visibleOthers.map(other => other.y));
    const move = (e: PointerEvent) => {
      const rawX = Math.max(element.width / 2, Math.min(1 - element.width / 2, element.x + (e.clientX - startX) / stage.width));
      const rawY = Math.max(element.height / 2, Math.min(1 - element.height / 2, element.y + (e.clientY - startY) / stage.height));
      const x = snapToTargets(rawX, xGuides);
      const y = snapToTargets(rawY, yGuides);
      setSnapGuides({ x: x.guide, y: y.guide });
      stageElement({ x: x.value, y: y.value }, element);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setSnapGuides({ x: null, y: null }); setDraggingOverlay(false); commitElement(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
  }

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

  function beginOverlayTiming(event: ReactPointerEvent<HTMLElement>, element: TimelineOverlay, edge: 'move' | 'start' | 'end') {
    if (!canEdit || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); selectOverlay(element, false);
    const track = event.currentTarget.closest('.overlay-track')?.getBoundingClientRect(); if (!track?.width) return;
    const startX = event.clientX; let moved = false;
    const move = (e: PointerEvent) => {
      const delta = Math.round((e.clientX - startX) / track.width * projectTicks); moved ||= Math.abs(e.clientX - startX) > 2;
      let patch: Partial<ElementLayer>;
      if (edge === 'move') patch = { startTicks: Math.max(0, Math.min(projectTicks - element.durationTicks, element.startTicks + delta)) };
      else if (edge === 'end') patch = { durationTicks: Math.max(1, element.durationTicks + delta) };
      else { const start = Math.max(0, Math.min(element.startTicks + element.durationTicks - 1, element.startTicks + delta)); patch = { startTicks: start, durationTicks: element.durationTicks + element.startTicks - start }; }
      const next = { ...element, ...constrainOverlay(element, projectTicks, patch) };
      if (next.kind === 'video' && next.sourceDurationSeconds) next.durationTicks = Math.min(next.durationTicks, Math.max(1, secondsToTicks(next.sourceDurationSeconds - (next.sourceInSeconds ?? 0), project.timebase)));
      if (snapping && project.beatTicks?.length) {
        const snapped = snapOverlayTiming(edge, next.startTicks, next.durationTicks, project.beatTicks, Math.max(1, Math.round(projectTicks / track.width * 8)));
        next.startTicks = snapped.startTicks;
        next.durationTicks = snapped.durationTicks;
      }
      overlayDraftRef.current = next; setOverlayDraft(next);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); if (moved) commitElement(); else selectOverlay(element); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
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

  function beginImagePan(event: ReactPointerEvent<HTMLElement>) {
    const scene = inspectorScene;
    if (!scene || !canEdit || event.button !== 0) return;
    event.preventDefault();
    inspectorFlush.current();
    const stage = previewStage.current?.getBoundingClientRect();
    if (!stage || stage.width <= 0 || stage.height <= 0) return;
    setPlaying(false);
    setEditingText(false);
    const startX = event.clientX, startY = event.clientY;
    setDraggingOverlay(true);
    const initialX = scene.imageX ?? 0, initialY = scene.imageY ?? 0;
    let travel = { x: activeSize.width / 4, y: activeSize.height / 4 };
    void loadImage(scene.videoPoster ?? scene.image).then(image => { travel = framingTravel({ width: image.naturalWidth, height: image.naturalHeight }, activeSize, scene.fit, scene.imageZoom ?? 1); }).catch(() => {});
    let latest = { imageX: initialX, imageY: initialY };
    const move = (moveEvent: PointerEvent) => {
      latest = {
        imageX: Math.min(1, Math.max(-1, initialX - (moveEvent.clientX - startX) / stage.width * activeSize.width / travel.x)),
        imageY: Math.min(1, Math.max(-1, initialY - (moveEvent.clientY - startY) / stage.height * activeSize.height / travel.y)),
      };
      setPreviewScene({ ...scene, ...latest });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDraggingOverlay(false);
      void pending.current.then(() => {
        const current = projectScenes(latestProject.current).find(item => item.id === scene.id) ?? scene;
        if ((current.imageX ?? 0) === latest.imageX && (current.imageY ?? 0) === latest.imageY) { setPreviewScene(null); return; }
        void updateSelection({ ...scene, ...latest }).finally(() => setPreviewScene(null));
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function beginTextMove(event: ReactPointerEvent<HTMLElement>) {
    const scene = selectedScene;
    const layer = selectedTextLayer;
    if (!scene || !layer || !canEdit || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    inspectorFlush.current();
    const stage = previewStage.current?.getBoundingClientRect();
    if (!stage || stage.width <= 0 || stage.height <= 0) return;
    const startX = event.clientX, startY = event.clientY;
    const initialX = layer.x, initialY = layer.y;
    const width = layer.width;
    const height = (textBox?.heightPct ?? 10) / 100;
    let latest = { x: initialX, y: initialY };
    setPlaying(false);
    setEditingText(false);
    const move = (moveEvent: PointerEvent) => {
      const rawX = Math.min(Math.max(0, initialX + (moveEvent.clientX - startX) / stage.width), Math.max(0, 1 - width));
      const rawY = Math.min(Math.max(0, initialY + (moveEvent.clientY - startY) / stage.height), Math.max(0, 1 - height));
      const x = snapToTargets(rawX, edgeGuides(width));
      const y = snapToTargets(rawY, edgeGuides(height));
      setSnapGuides({ x: x.guide, y: y.guide });
      latest = { x: x.value, y: y.value };
      const layers = sceneTextLayers(scene).map(item => item.id === layer.id ? { ...item, x: x.value, y: y.value } : item);
      setPreviewScene(replaceSceneTextLayers(scene, layers));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setSnapGuides({ x: null, y: null });
      void pending.current.then(() => {
        const current = projectScenes(latestProject.current).find(item => item.id === scene.id) ?? scene;
        const currentLayer = sceneTextLayers(current).find(item => item.id === layer.id);
        if (!currentLayer || (currentLayer.x === latest.x && currentLayer.y === latest.y)) { setPreviewScene(null); return; }
        const layers = sceneTextLayers(current).map(item => item.id === layer.id ? { ...item, ...latest } : item);
        void run({ type: 'update', scene: replaceSceneTextLayers(current, layers) }).finally(() => setPreviewScene(null));
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function beginTextResize(event: ReactPointerEvent<HTMLElement>, side: 'left' | 'right') {
    const scene = selectedScene;
    const layer = selectedTextLayer;
    if (!scene || !layer || !canEdit || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    inspectorFlush.current();
    const stage = previewStage.current?.getBoundingClientRect();
    if (!stage || stage.width <= 0) return;
    const startX = event.clientX;
    const initialX = layer.x, initialWidth = layer.width;
    let latest = { x: initialX, width: initialWidth };
    setPlaying(false);
    setEditingText(false);
    const move = (moveEvent: PointerEvent) => {
      const delta = (moveEvent.clientX - startX) / stage.width;
      if (side === 'right') {
        const width = Math.min(1 - initialX, Math.max(.15, initialWidth + delta));
        latest = { x: initialX, width };
      } else {
        const x = Math.min(initialX + initialWidth - .15, Math.max(0, initialX + delta));
        latest = { x, width: initialWidth + (initialX - x) };
      }
      const layers = sceneTextLayers(scene).map(item => item.id === layer.id ? { ...item, ...latest } : item);
      setPreviewScene(replaceSceneTextLayers(scene, layers));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      void pending.current.then(() => {
        const current = projectScenes(latestProject.current).find(item => item.id === scene.id) ?? scene;
        const currentLayer = sceneTextLayers(current).find(item => item.id === layer.id);
        if (!currentLayer || (currentLayer.x === latest.x && currentLayer.width === latest.width)) { setPreviewScene(null); return; }
        const layers = sceneTextLayers(current).map(item => item.id === layer.id ? { ...item, ...latest } : item);
        void run({ type: 'update', scene: replaceSceneTextLayers(current, layers) }).finally(() => setPreviewScene(null));
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function beginFadeDrag(event: ReactPointerEvent<HTMLSpanElement>, scene: Scene, side: 'in' | 'out') {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const clip = event.currentTarget.closest<HTMLElement>('.timeline-clip');
    const width = clip?.getBoundingClientRect().width ?? 0;
    if (width <= 0) return;
    const startX = event.clientX;
    const initialIn = scene.fadeIn ?? 0;
    const initialOut = scene.fadeOut ?? 0;
    let next = { fadeIn: initialIn, fadeOut: initialOut };
    setSelectedIds(ids => ids.includes(scene.id) ? ids : [scene.id]);
    setPrimarySelected(scene.id);
    if (!selectedIds.includes(scene.id)) selectionAnchor.current = scene.id;
    setPlaying(false);
    setPreviewScene({ ...scene, ...next });
    const sceneDuration = sceneSeconds(scene, project.timebase);
    setFadeDrag({ sceneId: scene.id, side, value: side === 'in' ? initialIn : initialOut });
    const move = (moveEvent: PointerEvent) => {
      const delta = ((moveEvent.clientX - startX) / width) * sceneDuration * (side === 'in' ? 1 : -1);
      const base = side === 'in' ? initialIn : initialOut;
      const value = Math.min(sceneDuration, Math.max(0, Math.round((base + delta) * 10) / 10));
      next = side === 'in' ? { ...next, fadeIn: value } : { ...next, fadeOut: value };
      setFadeDrag({ sceneId: scene.id, side, value });
      setPreviewScene({ ...scene, ...next });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setFadeDrag(null);
      setPreviewScene(null);
      void pending.current.then(() => {
        const current = projectScenes(latestProject.current).find(item => item.id === scene.id) ?? scene;
        if ((current.fadeIn ?? 0) !== next.fadeIn || (current.fadeOut ?? 0) !== next.fadeOut) {
          void run({ type: 'update', scene: { ...current, ...next } });
        }
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function beginSceneTrim(event: ReactPointerEvent<HTMLSpanElement>, scene: Scene, side: 'left' | 'right') {
    if (!canEdit || event.button !== 0 || !projectTicks) return;
    event.preventDefault();
    event.stopPropagation();
    const clip = event.currentTarget.closest<HTMLElement>('.timeline-clip');
    const width = clip?.getBoundingClientRect().width ?? 0;
    if (width <= 0) return;
    setSelectedIds(ids => (ids.includes(scene.id) ? ids : [scene.id]));
    setPrimarySelected(scene.id);
    if (!selectedIds.includes(scene.id)) selectionAnchor.current = scene.id;
    setPlaying(false);
    const timebase = project.timebase;
    const startX = event.clientX;
    const initialDuration = scene.durationTicks;
    const initialSourceIn = scene.sourceInTicks ?? 0;
    let next = scene;
    setPreviewScene(scene);
    const move = (moveEvent: PointerEvent) => {
      const delta = Math.round(((moveEvent.clientX - startX) / width) * initialDuration);
      next = trimSceneWindow(scene, delta, side, timebase);
      setPreviewScene(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setPreviewScene(null);
      if (next.durationTicks === initialDuration && next.sourceInTicks === initialSourceIn) return;
      void pending.current.then(() => {
        const current = projectScenes(latestProject.current).find(item => item.id === scene.id);
        if (!current) return;
        void run({ type: 'update', scene: { ...current, durationTicks: next.durationTicks, sourceInTicks: next.sourceInTicks, fadeIn: Math.min(current.fadeIn ?? 0, ticksToSeconds(next.durationTicks, timebase)), fadeOut: Math.min(current.fadeOut ?? 0, ticksToSeconds(next.durationTicks, timebase)) } });
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
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
    const baseAspect = (['16:9', '9:16', '1:1', '4:5'].includes(selected[0]?.aspect ?? '') ? selected[0].aspect : preferences.defaultAspect) as Project['aspect'];
    const next = emptyProject('Untitled story', baseAspect, newProjectFps);
    const presetFormats = selected.map(preset => ({ id: crypto.randomUUID(), name: preset.name, platform: preset.platform, aspect: preset.aspect, width: preset.width, height: preset.height, fps: preset.fps, quality: preset.quality, presetId: preset.id, overrides: {} }));
    next.formats = presetFormats.length || newCustomFormats.length ? [...presetFormats, ...newCustomFormats] : next.formats;
    setNewCustomFormats([]);
    await launchProject(next);
  }

  async function addFormat(presetId: string) {
    if (project.formats.length >= MAX_PROJECT_FORMATS) { setNotice(`A project supports up to ${MAX_PROJECT_FORMATS} output formats.`); return; }
    const format = createFormat(presetId, project.formats);
    if (await run({ type: 'formats', formats: [...project.formats, format] })) {
      setActiveFormatId(format.id);
      setNotice(`${format.name} added. Framing is saved separately for this format.`);
    }
  }

  async function toggleFormatPreset(presetId: string) {
    const existing = project.formats.find(format => format.presetId === presetId);
    if (existing) await removeFormat(existing.id);
    else await addFormat(presetId);
  }

  function addNewCustomFormat() {
    if (newFormatSelection.length >= MAX_PROJECT_FORMATS) { setNotice(`A project supports up to ${MAX_PROJECT_FORMATS} output formats.`); return; }
    const width = Math.round(customFormatDraft.width / 2) * 2;
    const height = Math.round(customFormatDraft.height / 2) * 2;
    if (width < 160 || height < 160 || width > 3840 || height > 3840) { setError('Custom size must be between 160 and 3840 pixels.'); return; }
    setNewCustomFormats(current => [...current, createCustomFormat(customFormatDraft.name, width, height, customFormatDraft.fps, customFormatDraft.quality, current)]);
    setCustomFormatDraft({ name: '', width: 1080, height: 1080, fps: 30, quality: 'standard' });
  }

  async function addCustomFormat() {
    if (project.formats.length >= MAX_PROJECT_FORMATS) { setNotice(`A project supports up to ${MAX_PROJECT_FORMATS} output formats.`); return; }
    const width = Math.round(customFormatDraft.width / 2) * 2;
    const height = Math.round(customFormatDraft.height / 2) * 2;
    if (width < 160 || height < 160 || width > 3840 || height > 3840) { setError('Custom size must be between 160 and 3840 pixels.'); return; }
    const format = createCustomFormat(customFormatDraft.name, width, height, customFormatDraft.fps, customFormatDraft.quality, project.formats);
    if (await run({ type: 'formats', formats: [...project.formats, format] })) {
      setActiveFormatId(format.id);
      setCustomFormatDraft({ name: '', width: 1080, height: 1080, fps: 30, quality: 'standard' });
      setNotice(`${format.name} added.`);
    }
  }

  async function updateFormatSettings(format: FormatVariant, patch: Partial<FormatVariant>) {
    const width = Math.round((patch.width ?? format.width) / 2) * 2;
    const height = Math.round((patch.height ?? format.height) / 2) * 2;
    if (width < 160 || height < 160 || width > 3840 || height > 3840) { setError('Format size must be between 160 and 3840 pixels.'); return; }
    const next = project.formats.map(item => item.id === format.id ? { ...item, ...patch, width, height, name: (patch.name ?? item.name).trim() || item.name } : item);
    await run({ type: 'formats', formats: next });
  }

  async function removeFormat(formatId: string) {
    if (project.formats.length <= 1) { setNotice('Keep at least one output format.'); return; }
    const formats = project.formats.filter(format => format.id !== formatId);
    if (await run({ type: 'formats', formats })) {
      if (activeFormat?.id === formatId) setActiveFormatId(formats[0]?.id ?? null);
      setNotice('Output format removed.');
    }
  }

  async function applyFramingToAllFormats() {
    const scene = selectedScene;
    if (!scene || !activeFormat) return;
    const resolved = resolveSceneForFormat(scene, activeFormat);
    const override = { imageX: resolved.imageX ?? 0, imageY: resolved.imageY ?? 0, imageZoom: resolved.imageZoom ?? 1, fit: resolved.fit, framingBackground: resolved.framingBackground ?? '#000000' };
    const formats = project.formats.map(format => ({ ...format, overrides: { ...format.overrides, [scene.id]: { ...format.overrides[scene.id], ...override } } }));
    if (await run({ type: 'formats', formats })) setNotice('Current framing copied to every output format.');
  }

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

  async function openLibraryProject(summary: ProjectSummary) {
    setProjectMenu(null);
    if (summary.id === project.id) { setScreen('editor'); return; }
    if (!canEdit) return;
    try {
      const p = await getLibraryProject(summary.id);
      if (!p) throw new Error('This project could not be found on this device.');
      if (await launchProject(p)) setNotice(`Opened “${p.name}”.`);
    } catch (e) { setError(messageFor(e)); }
  }

  async function duplicateProject(summary: ProjectSummary) {
    setProjectMenu(null);
    if (!canEdit) return;
    try {
      const copy = await duplicateLibraryProject(summary.id);
      if (!copy) throw new Error('This project could not be duplicated.');
      await refreshLibrary();
      setNotice(`“${copy.name}” added to your library.`);
    } catch (e) { setError(messageFor(e)); }
  }

  function askDeleteProject(summary: ProjectSummary) {
    setProjectMenu(null);
    setDeleteTarget(summary);
    setModal('delete');
  }

  function askRenameProject(summary: ProjectSummary) {
    setProjectMenu(null);
    setRenameTarget(summary);
    setRenameDraft(summary.name);
    setModal('rename');
  }

  function askGroupProject(summary: ProjectSummary) {
    setProjectMenu(null);
    setGroupTarget(summary);
    setGroupDraft(summary.group ?? '');
    setModal('group');
  }

  async function confirmGroupProject(group: string | null) {
    const target = groupTarget;
    if (!target) return;
    setModal(null);
    setGroupTarget(null);
    try {
      await setProjectGroup(target.id, group);
      setProjects(items => items.map(item => item.id === target.id ? { ...item, ...(group?.trim() ? { group: group.trim() } : { group: undefined }) } : item));
      setNotice(group?.trim() ? `“${target.name}” moved to “${group.trim()}”.` : `“${target.name}” removed from its group.`);
    } catch (e) { setError(messageFor(e)); }
  }

  function projectGroups() {
    return [...new Set(projects.map(entry => entry.group).filter((group): group is string => Boolean(group)))].sort((a, b) => a.localeCompare(b));
  }

  function openGroupManager() {
    const groups = projectGroups();
    setGroupDrafts(Object.fromEntries(groups.map(group => [group, group])));
    setModal('groups');
  }

  async function saveGroupRename(from: string) {
    const to = groupDrafts[from]?.trim();
    if (!to || to === from) return;
    try {
      await renameProjectGroup(from, to);
      await refreshLibrary();
      setGroupDrafts(current => {
        const next = { ...current };
        delete next[from];
        next[to] = to;
        return next;
      });
      if (groupFilter === from) setGroupFilter(to);
      setNotice(`Group renamed to “${to}”.`);
    } catch (e) { setError(messageFor(e)); }
  }

  async function removeGroup(group: string) {
    try {
      await deleteProjectGroup(group);
      await refreshLibrary();
      setGroupDrafts(current => { const next = { ...current }; delete next[group]; return next; });
      if (groupFilter === group) setGroupFilter('all');
      setNotice(`“${group}” removed. Its projects are now ungrouped.`);
    } catch (e) { setError(messageFor(e)); }
  }

  async function toggleProjectFavorite(summary: ProjectSummary) {
    try {
      await setProjectFavorite(summary.id, !summary.favorite);
      setProjects(items => items.map(item => item.id === summary.id ? { ...item, ...(summary.favorite ? { favorite: undefined } : { favorite: true }) } : item));
      setNotice(summary.favorite ? `“${summary.name}” removed from favorites.` : `“${summary.name}” added to favorites.`);
      setProjectMenu(null);
    } catch (e) { setError(messageFor(e)); }
  }

  async function confirmDeleteProject() {
    const target = deleteTarget;
    if (!target) return;
    setModal(null);
    setDeleteTarget(null);
    try {
      await deleteLibraryProject(target.id);
      setProjects(list => list.filter(item => item.id !== target.id));
      if (target.id === latestProject.current.id) {
        await run({ type: 'replace', project: emptyProject() });
        setSelectedIds([]);
        setPrimarySelected(null);
        selectionAnchor.current = null;
        setPosition(0);
        setScreen('home');
      }
      setNotice(`“${target.name}” deleted from this device.`);
    } catch (e) { setError(messageFor(e)); }
  }

  async function stageImportedMedia(added: Scene[]) {
    const items = [...importedMedia, ...added.filter(item => !importedMedia.some(old => old.image === item.image))];
    await saveMediaBin(project.id, items);
    setMediaBin({ projectId: project.id, items }); setScreen('editor'); setTab('media');
    setSourcePreview(added[0] ?? null); if (added.length) setModal('source');
  }

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
    const element: ElementLayer = { id: crypto.randomUUID(), kind: source.mediaKind === 'video' ? 'video' : 'image', label: source.name.slice(0, 80), source: source.image,
      ...(source.videoPoster ? { poster: source.videoPoster } : {}), sourceInSeconds: ticksToSeconds(source.sourceInTicks, project.timebase), sourceDurationSeconds: sourceDuration,
      x: corner % 2 ? .25 : .75, y: corner < 2 ? Math.max(.25, boxHeight / 2 + .04) : Math.min(.75, 1 - boxHeight / 2 - .04), width: boxWidth, height: boxHeight, color: '#FFFFFF', opacity: 100, rotation: 0,
      startTicks, durationTicks: Math.min(projectTicks - startTicks, source.durationTicks), animation: 'none' };
    if (await run({ type: 'overlays', overlays: [...project.overlays, element] })) {
      setEditTarget('element'); setSelectedElementId(element.id); setEditingText(false); setFramingMode(false); setModal(null); setTab('elements');
    }
  }

  function selectPip(clip: Scene) {
    setSelectedPipId(clip.id);
    setSelectedIds([]); setPrimarySelected(null); selectionAnchor.current = null;
    setSelectedTextLayerId(null); setSelectedGlobalTextId(null); setSelectedElementId(null);
    setEditTarget('scene'); setEditingText(false); setFramingMode(false); setPlaying(false);
    setPosition(ticksToSeconds(clip.startTicks, project.timebase));
  }

  function stagePip(patch: Partial<Scene>) {
    if (!selectedPip) return;
    const base = pipDraftRef.current?.id === selectedPip.id ? pipDraftRef.current : selectedPip;
    const next = { ...base, ...patch };
    pipDraftRef.current = next;
    setPipDraft(next);
  }

  function stagePipStyle(key: 'x' | 'y' | 'width' | 'height' | 'radius' | 'shadow', value: number) {
    if (!activePip?.pip) return;
    stagePip({ pip: { ...activePip.pip, [key]: value } });
  }

  function commitPip() {
    const draft = pipDraftRef.current;
    pipDraftRef.current = null;
    setPipDraft(null);
    if (!draft) return;
    if (draft.pip && (![draft.pip.x, draft.pip.y, draft.pip.width, draft.pip.height, draft.pip.radius, draft.pip.shadow].every(Number.isFinite))) {
      setError('Picture-in-picture placement is invalid.');
      return;
    }
    void run({ type: 'pip', scenes: overlayScenes(project).map(clip => clip.id === draft.id ? draft : clip) });
  }

  function removePip(id: string) {
    void run({ type: 'pip', scenes: overlayScenes(project).filter(clip => clip.id !== id) }).then(ok => {
      if (ok) { setSelectedPipId(null); setPipDraft(null); pipDraftRef.current = null; setNotice('Picture-in-picture clip removed.'); }
    });
  }

  function beginPipTiming(event: ReactPointerEvent<HTMLElement>, clip: Scene, edge: 'move' | 'start' | 'end') {
    if (!canEdit || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); selectPip(clip);
    const track = event.currentTarget.closest('.pip-track')?.getBoundingClientRect();
    if (!track?.width) return;
    const startX = event.clientX;
    let moved = false;
    const move = (moveEvent: PointerEvent) => {
      const delta = Math.round((moveEvent.clientX - startX) / track.width * projectTicks);
      moved ||= Math.abs(moveEvent.clientX - startX) > 2;
      const timing = constrainPipTiming(clip, edge, delta, overlayScenes(project), projectTicks, project.timebase, minTicks(project.timebase));
      const next = { ...clip, ...timing };
      pipDraftRef.current = next;
      setPipDraft(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const draft = pipDraftRef.current;
      pipDraftRef.current = null;
      setPipDraft(null);
      if (moved && draft) void run({ type: 'pip', scenes: overlayScenes(project).map(item => item.id === draft.id ? draft : item) });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  }

  async function addMediaPip(source: Scene) {
    if (!selectedScene) { setNotice('Select the background scene first, then add picture in picture.'); return; }
    const existing = overlayScenes(project);
    if (existing.length >= 50) { setNotice('This project already has 50 picture-in-picture clips.'); return; }
    try {
      let sourceAspect = 16 / 9;
      if (source.mediaKind === 'video') {
        const probe = await probeVideo((await resolveMediaSource(source.image)) ?? source.image);
        sourceAspect = probe.width / probe.height;
      } else {
        const image = await loadImage(source.image);
        sourceAspect = image.naturalWidth / image.naturalHeight;
      }
      const minimum = minTicks(project.timebase);
      const desired = Math.max(0, Math.min(projectTicks - 1, secondsToTicks(position, project.timebase)));
      if (projectTicks - desired < minimum) { setNotice('Move the playhead earlier to fit a picture-in-picture clip.'); return; }
      let durationTicks = Math.min(source.durationTicks, projectTicks - desired);
      if (source.mediaKind === 'video' && source.sourceDurationSeconds) {
        durationTicks = Math.min(durationTicks, pipSourceRoom(source, project.timebase));
      }
      durationTicks = Math.max(minimum, Math.min(durationTicks, projectTicks));
      const startTicks = freePipStart(existing, desired, durationTicks, projectTicks);
      if (startTicks === null) {
        setNotice('There is no free space for picture in picture there. Move the playhead or shorten an existing clip.');
        return;
      }
      const width = .32;
      const height = Math.max(.08, Math.min(.9, width * (activeSize.width / activeSize.height) / Math.max(.1, sourceAspect)));
      const clip: Scene = {
        ...structuredClone(source),
        id: crypto.randomUUID(),
        startTicks,
        durationTicks,
        transition: null,
        textLayers: [],
        elements: [],
        pip: { x: .8, y: .78, width, height, radius: .06, shadow: 60 },
      };
      if (await run({ type: 'pip', scenes: [...existing, clip].sort((a, b) => a.startTicks - b.startTicks) })) {
        setSelectedPipId(clip.id);
        setSelectedIds([]); setPrimarySelected(null);
        setEditTarget('scene'); setSelectedTextLayerId(null); setSelectedGlobalTextId(null); setSelectedElementId(null);
        setPosition(ticksToSeconds(startTicks, project.timebase));
        setNotice('Picture in picture added. Adjust its corner and size in the inspector.');
      }
    } catch (error) {
      setError(messageFor(error));
    }
  }

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
      try { const picked = await bridge.pickMedia(kind === 'video' ? 'video' : 'image'); if (picked?.length) await importCustomElement(picked.map(fileFromPicked)); }
      catch (error) { setError(messageFor(error)); }
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

  async function importFontFile(files: FileList | null) {
    const file = files?.[0];
    if (!file || !canEdit) return;
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!['ttf', 'otf', 'woff', 'woff2'].includes(extension)) throw new Error('Choose a TTF, OTF, WOFF, or WOFF2 font.');
      if (file.size > 2 * 1024 * 1024) throw new Error('Choose a font smaller than 2 MB.');
      if ((project.fonts?.length ?? 0) >= MAX_PROJECT_FONTS) throw new Error(`A project supports up to ${MAX_PROJECT_FONTS} imported fonts.`);
      const mime = extension === 'woff2' ? 'font/woff2' : extension === 'woff' ? 'font/woff' : extension === 'otf' ? 'font/otf' : 'font/ttf';
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('That font could not be read.'));
        reader.readAsDataURL(file);
      });
      if (!base64) throw new Error('That font file is empty.');
      const font = {
        id: `custom-${crypto.randomUUID()}`,
        name: (file.name.replace(/\.[^.]+$/, '').trim() || 'Imported font').slice(0, 60),
        data: `data:${mime};base64,${base64}`,
      };
      if (await run({ type: 'fonts', fonts: [...(project.fonts ?? []), font] })) {
        setNotice(`“${font.name}” is now in the font picker.`);
      }
    } catch (error) {
      setError(messageFor(error));
    } finally {
      if (fontInput.current) fontInput.current.value = '';
    }
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

  async function chooseAudio() {
    if (!canEdit) return;
    if (bridge.native) {
      try {
        const imported = await bridge.importAudioAsset();
        if (imported) await importStreamedAudio(imported);
      } catch (e) { setError(messageFor(e)); }
      return;
    }
    audioInput.current?.click();
  }

  async function importStreamedAudio(imported: bridge.ImportedMedia) {
    if (!projectTicks) { setNotice('Add photos before adding audio.'); return; }
    try {
      const url = await resolveAssetUrl(imported.reference);
      const sourceDuration = Math.round((await audioDuration(url)) * 100) / 100;
      const desiredStart = secondsToTicks(position, project.timebase);
      const startTicks = desiredStart >= projectTicks ? 0 : Math.min(desiredStart, projectTicks - 1);
      const remaining = ticksToSeconds(projectTicks - startTicks, project.timebase);
      const duration = Math.max(secondsPerTick(project.timebase), Math.min(sourceDuration || remaining, remaining));
      const clip = constrainAudio({
        id: crypto.randomUUID(),
        name: imported.name,
        data: imported.reference,
        lane: audioLaneRef.current,
        startTicks,
        durationTicks: secondsToTicks(duration, project.timebase),
        sourceInSeconds: 0,
        sourceDurationSeconds: sourceDuration || duration,
        volume: .8,
        fadeIn: 0,
        fadeOut: 0,
      });
      if (await run({ type: 'audio', audio: [...project.audio, clip] })) {
        setEditTarget('audio'); setSelectedAudioId(clip.id);
        setTab('audio');
        setNotice(`Audio added at ${ticksToSeconds(clip.startTicks, project.timebase).toFixed(1)} s. It stays on this device.`);
      }
    } catch (e) { setError(messageFor(e)); }
  }

  async function importFiles(files: FileList | File[] | null) {
    if (!files?.length || operation.current) return;
    setPlaying(false); setBusy(true); operation.current = true;
    try {
      const added: Scene[] = [];
      if (files.length + scenes.length > 100) throw new Error('Add up to 100 images per project.');
      for (const file of Array.from(files)) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error(`“${file.name}” is not a JPEG, PNG, or WebP image. Choose one of those formats.`);
        if (file.size > 500 * 1024 * 1024) throw new Error(`“${file.name}” is larger than 500 MB. Choose a smaller image.`);
        const asset = await storeAssetBlob(file, file.name);
        const image = assetRef(asset.id);
        await loadImage(image);
        added.push({ id: crypto.randomUUID(), startTicks: 0, sourceInTicks: 0, name: file.name, image, durationTicks: secondsToTicks(preferences.defaultSceneSeconds, project.timebase), title: '', subtitle: '', color: '#ffffff', fit: preferences.defaultFit });
      }
      await stageImportedMedia(added);
    } catch (e) { setError(messageFor(e)); } finally { setBusy(false); operation.current = false; if (mediaInput.current) mediaInput.current.value = ''; }
  }

  function constrainAudio(clip: AudioClip): AudioClip {
    const total = projectTicks;
    const currentDuration = ticksToSeconds(clip.durationTicks, project.timebase);
    const sourceDuration = Math.max(clip.sourceDurationSeconds > 0 ? clip.sourceDurationSeconds : currentDuration, secondsPerTick(project.timebase));
    const sourceIn = Math.min(Math.max(0, clip.sourceInSeconds), Math.max(0, sourceDuration - secondsPerTick(project.timebase)));
    const maxDuration = Math.max(1, Math.min(total - clip.startTicks, secondsToTicks(sourceDuration - sourceIn, project.timebase)));
    const durationTicks = Math.max(1, Math.min(clip.durationTicks, maxDuration));
    const startTicks = Math.min(Math.max(0, clip.startTicks), Math.max(0, total - durationTicks));
    const seconds = ticksToSeconds(durationTicks, project.timebase);
    return { ...clip, startTicks, durationTicks, sourceInSeconds: sourceIn, sourceDurationSeconds: sourceDuration, fadeIn: Math.min(clip.fadeIn, seconds), fadeOut: Math.min(clip.fadeOut, seconds) };
  }

  async function importAudio(file: File | null | undefined) {
    if (!file || !canEdit) return;
    if (!projectTicks) { setNotice('Add photos before adding audio.'); return; }
    try {
      const data = await audioFileData(file);
      const sourceDuration = Math.round((await audioDuration(data)) * 100) / 100;
      const desiredStart = secondsToTicks(position, project.timebase);
      const startTicks = desiredStart >= projectTicks ? 0 : Math.min(desiredStart, projectTicks - 1);
      const remaining = ticksToSeconds(projectTicks - startTicks, project.timebase);
      const duration = Math.max(secondsPerTick(project.timebase), Math.min(sourceDuration || remaining, remaining));
      const clip = constrainAudio({
        id: crypto.randomUUID(),
        name: file.name,
        data,
        lane: audioLaneRef.current,
        startTicks,
        durationTicks: secondsToTicks(duration, project.timebase),
        sourceInSeconds: 0,
        sourceDurationSeconds: sourceDuration || duration,
        volume: .8,
        fadeIn: 0,
        fadeOut: 0,
      });
      if (await run({ type: 'audio', audio: [...project.audio, clip] })) {
        setEditTarget('audio'); setSelectedAudioId(clip.id);
        setTab('audio');
        setNotice(`Audio added at ${ticksToSeconds(clip.startTicks, project.timebase).toFixed(1)} s. It stays on this device.`);
      }
    } catch (e) { setError(messageFor(e)); } finally { if (audioInput.current) audioInput.current.value = ''; }
  }

  async function startVoiceover() {
    if (!canEdit) return;
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Voiceover recording is not available in this build. Import an audio file instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type)) ?? '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recordChunks.current = [];
      recorder.ondataavailable = event => { if (event.data.size) recordChunks.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        void finishVoiceover(recorder.mimeType || mime || 'audio/webm');
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true); setRecordSeconds(0);
      const started = performance.now();
      recordTimer.current = window.setInterval(() => setRecordSeconds((performance.now() - started) / 1000), 200);
    } catch {
      setError('Microphone access is needed for voiceover. Allow it in your system settings and try again.');
    }
  }

  function stopVoiceover() {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    if (recordTimer.current) { clearInterval(recordTimer.current); recordTimer.current = null; }
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  async function finishVoiceover(mime: string) {
    try {
      const chunks = recordChunks.current;
      recordChunks.current = [];
      const blob = new Blob(chunks, { type: mime.split(';')[0] || 'audio/webm' });
      if (!blob.size) throw new Error('The recording was empty. Try again.');
      if (blob.size > MAX_AUDIO_FILE_BYTES) throw new Error('The recording is larger than the voiceover limit.');
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('The recording could not be read.'));
        reader.readAsDataURL(blob);
      });
      const snapshot = latestProject.current;
      const total = totalTicks(snapshot);
      if (!total) throw new Error('Add a scene before recording a voiceover.');
      const sourceDuration = Math.round((await audioDuration(data)) * 100) / 100;
      const desiredStart = secondsToTicks(positionRef.current, snapshot.timebase);
      const startTicks = desiredStart >= total ? 0 : Math.min(desiredStart, total - 1);
      const remaining = ticksToSeconds(total - startTicks, snapshot.timebase);
      const length = Math.max(secondsPerTick(snapshot.timebase), Math.min(sourceDuration || remaining, remaining));
      const clip = constrainAudio({
        id: crypto.randomUUID(),
        name: `Voiceover ${snapshot.audio.filter(item => item.name.startsWith('Voiceover')).length + 1}`,
        data,
        lane: 0,
        startTicks,
        durationTicks: secondsToTicks(length, snapshot.timebase),
        sourceInSeconds: 0,
        sourceDurationSeconds: sourceDuration || length,
        volume: 1,
        fadeIn: 0,
        fadeOut: 0,
        low: 0,
        mid: 0,
        high: 0,
      });
      if (await run({ type: 'audio', audio: [...snapshot.audio, clip] })) {
        setEditTarget('audio'); setSelectedAudioId(clip.id); setTab('audio');
        setNotice('Voiceover added at the playhead. It stays on this device.');
      }
    } catch (error) {
      setError(messageFor(error));
    }
  }

  function removeAudio(id: string) {
    const next = project.audio.filter(clip => clip.id !== id);
    audioDraftRef.current = null;
    setAudioDraft(null);
    setPreviewAudio(null);
    void run({ type: 'audio', audio: next }).then(ok => {
      if (!ok) return;
      setSelectedAudioId(current => current === id ? next[0]?.id ?? null : current);
      setNotice('Audio clip removed from this project.');
    });
  }

  function stageAudio(patch: Partial<AudioClip>) {
    const base = audioDraftRef.current ?? selectedAudio;
    if (!base) return;
    const next = constrainAudio({ ...base, ...patch });
    audioDraftRef.current = next;
    setAudioDraft(next);
  }

  function commitAudio() {
    const next = audioDraftRef.current;
    if (!next) return;
    const constrained = constrainAudio(next);
    audioDraftRef.current = null;
    setAudioDraft(null);
    setPreviewAudio(null);
    void run({ type: 'audio', audio: project.audio.map(clip => clip.id === constrained.id ? constrained : clip) });
  }

  function focusAudio(clip: AudioClip) {
    setEditTarget('audio');
    setSelectedAudioId(clip.id);
    setSelectedIds([]);
    setPrimarySelected(null);
    setSelectedElementId(null);
    setSelectedGlobalTextId(null);
    setTab('audio');
  }

  async function detectAudioBeats() {
    if (!selectedAudio || !canEdit) return;
    setBeatBusy(true);
    setError('');
    try {
      const analysis = await detectBeats(selectedAudio.data);
      if (!analysis?.beats.length) {
        setError('No clear beat was found in this audio. Try a track with a steady pulse, or add markers at the playhead.');
        return;
      }
      setBeatTempo(analysis.bpm);
      const ticks = beatMarkerTicks(analysis.beats, selectedAudio.startTicks, project.timebase, projectTicks);
      if (!ticks.length) {
        setNotice('The detected beats fall outside this timeline.');
        return;
      }
      const merged = [...new Set([...(project.beatTicks ?? []), ...ticks])].sort((a, b) => a - b).slice(0, 500);
      const added = Math.max(0, merged.length - (project.beatTicks?.length ?? 0));
      if (!added) {
        setNotice(`Found ${analysis.bpm ? `${analysis.bpm} BPM` : 'a pulse'} · these beat markers are already on the timeline.`);
        return;
      }
      if (await run({ type: 'beats', beatTicks: merged })) {
        setNotice(`Found ${analysis.bpm ? `${analysis.bpm} BPM` : 'a pulse'} · ${added} beat marker${added === 1 ? '' : 's'} added. Overlay moves and trims now snap to them.`);
      }
    } catch (error) {
      setError(messageFor(error));
    } finally {
      setBeatBusy(false);
    }
  }

  async function snapCutsToBeat() {
    if (!selectedAudio || !canEdit) return;
    const photoScenes = projectScenes(project);
    if (photoScenes.some(scene => scene.mediaKind === 'video')) {
      setError('Beat sync currently works with photo stories. Video cuts keep their own source timing.');
      return;
    }
    if (photoScenes.length < 2) {
      setError('Add at least two photo scenes before snapping cuts to a beat.');
      return;
    }
    setBeatBusy(true);
    setError('');
    try {
      let beats = (project.beatTicks ?? []).map(tick => ticksToSeconds(tick, project.timebase));
      let offsetSeconds = 0;
      let bpm = beatTempo;
      if (!beats.length) {
        const analysis = await detectBeats(selectedAudio.data);
        if (!analysis?.beats.length) {
          setError('No clear beat was found in this audio. Try a track with a steady pulse, or add markers at the playhead.');
          return;
        }
        beats = analysis.beats;
        offsetSeconds = ticksToSeconds(selectedAudio.startTicks, project.timebase);
        bpm = analysis.bpm;
        setBeatTempo(bpm);
      }
      const result = snapScenesToBeats(photoScenes, beats, offsetSeconds, project.timebase);
      if (!result.moved) {
        setNotice(`Found ${bpm ? `${bpm} BPM` : 'a pulse'}, but no cut was within 0.35 s of a beat.`);
        return;
      }
      if (await run({ type: 'updateMany', scenes: result.scenes })) {
        setNotice(`Snapped ${result.moved} cut${result.moved === 1 ? '' : 's'} to ${bpm ? `${bpm} BPM` : 'the beat'}.`);
      }
    } catch (error) {
      setError(messageFor(error));
    } finally {
      setBeatBusy(false);
    }
  }

  function beginAudioMove(event: ReactPointerEvent<HTMLElement>, clip: AudioClip) {
    if (!canEdit || event.button !== 0 || !projectTicks) return;
    const track = (event.currentTarget as HTMLElement).closest<HTMLElement>('.audio-track');
    const width = track?.getBoundingClientRect().width ?? 0;
    if (!track || width <= 0) return;
    event.stopPropagation();
    focusAudio(clip);
    setPlaying(false);
    const startX = event.clientX;
    const initialStart = clip.startTicks;
    let latest = project.audio;
    const move = (moveEvent: PointerEvent) => {
      const delta = Math.round(((moveEvent.clientX - startX) / width) * projectTicks);
      const startTicks = Math.min(Math.max(0, initialStart + delta), Math.max(0, projectTicks - clip.durationTicks));
      latest = project.audio.map(item => item.id === clip.id ? { ...item, startTicks } : item);
      setPreviewAudio(latest);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setPreviewAudio(null);
      void run({ type: 'audio', audio: latest });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function beginAudioTrim(event: ReactPointerEvent<HTMLElement>, clip: AudioClip, side: 'left' | 'right') {
    if (!canEdit || event.button !== 0 || !projectTicks) return;
    const track = (event.currentTarget as HTMLElement).closest<HTMLElement>('.audio-track');
    const width = track?.getBoundingClientRect().width ?? 0;
    if (!track || width <= 0) return;
    event.stopPropagation();
    focusAudio(clip);
    setPlaying(false);
    const startX = event.clientX;
    const initialStart = clip.startTicks, initialDuration = clip.durationTicks, initialIn = clip.sourceInSeconds;
    let latest = project.audio;
    const move = (moveEvent: PointerEvent) => {
      const delta = Math.round(((moveEvent.clientX - startX) / width) * projectTicks);
      let startTicks = initialStart, durationTicks = initialDuration, sourceIn = initialIn;
      if (side === 'left') {
        let shift = Math.min(initialDuration - 1, Math.max(delta, -initialStart));
        shift = Math.max(shift, -secondsToTicks(initialIn, project.timebase));
        startTicks = initialStart + shift;
        durationTicks = initialDuration - shift;
        sourceIn = Math.max(0, initialIn + ticksToSeconds(shift, project.timebase));
      } else {
        const maxDuration = Math.min(projectTicks - initialStart, secondsToTicks(clip.sourceDurationSeconds - initialIn, project.timebase));
        durationTicks = Math.min(Math.max(1, initialDuration + delta), Math.max(1, maxDuration));
      }
      latest = project.audio.map(item => item.id === clip.id ? { ...item, startTicks, durationTicks, sourceInSeconds: sourceIn } : item);
      setPreviewAudio(latest);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setPreviewAudio(null);
      void run({ type: 'audio', audio: latest });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

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

  function dragOverTarget(event: ReactDragEvent<HTMLElement>, id: string) {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
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

  async function renameProject() {
    const target = renameTarget;
    if (!target) return;
    const name = renameDraft.trim().replace(/\s+/g, ' ').slice(0, 120) || 'Untitled story';
    try {
      if (target.id === latestProject.current.id) {
        if (!(await run({ type: 'rename', name }))) return;
        await persistCurrent();
      } else {
        const stored = await getLibraryProject(target.id);
        if (!stored) throw new Error('This project could not be found on this device.');
        await saveLibraryProject({ ...stored, name });
      }
      await refreshLibrary();
      setModal(null);
      setRenameTarget(null);
      setNotice(`Project renamed to “${name}”.`);
    } catch (e) { setError(messageFor(e)); }
  }

  async function exportLibraryProject(summary: ProjectSummary) {
    setProjectMenu(null);
    try {
      const stored = await getLibraryProject(summary.id);
      if (!stored) throw new Error('This project could not be found on this device.');
      if (await bridge.exportProjectFile(stored)) setNotice(`Project file for “${stored.name}” saved.`);
    } catch (e) { setError(messageFor(e)); }
  }

  async function open() {
    if (!bridge.native) { projectInput.current?.click(); return; }
    try { const next = await bridge.openProject(); if (next) { await persistCurrent(); latestProject.current = next.project; setSession(next); setScreen('editor'); setSelectedIds([]); setPrimarySelected(null); selectionAnchor.current = null; setPosition(0); } } catch (e) { setError(messageFor(e)); }
  }

  async function openBrowserProject(e: ChangeEvent<HTMLInputElement>) {
    try {
      const file = e.target.files?.[0]; if (!file) return;
      if (file.size > 100_000_000) throw new Error('Project file exceeds 100 MB.');
      const p = validateProject(JSON.parse(await file.text()));
      await persistCurrent();
      if (await run({ type: 'replace', project: p })) { setScreen('editor'); setSelectedIds([]); setPrimarySelected(null); selectionAnchor.current = null; setPosition(0); }
    } catch (e) { setError(messageFor(e)); } finally { e.target.value = ''; }
  }

  function togglePreviewFullscreen() { const element = document.querySelector('.preview-panel'); if (!document.fullscreenElement) void element?.requestFullscreen?.(); else void document.exitFullscreen(); }

  async function relinkMissing(asset: MissingAsset) {
    if (!bridge.native) { setError('Relinking is available in the desktop app.'); return; }
    setRelinking(asset.ref);
    try {
      const picked = await bridge.pickMedia(asset.kind);
      const file = picked?.[0];
      if (!file) return;
      const next = replaceAssetRef(latestProject.current, asset.ref, file.data);
      if (await run({ type: 'replace', project: next })) {
        setNotice(`Relinked ${asset.label} with ${file.name}.`);
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
  async function videoFrameReader(sourceValue: string) {
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

  async function buildVideoPlan(format: FormatVariant, progressRef: { count: number; total: number }, source: Project, visualAudio = source.audio, withClipAudio = exportAudio, nameFormats: FormatVariant[] = [format], nameSlug?: string): Promise<bridge.ExportPlan> {
    const formatScenes = resolveScenesForFormat(projectScenes(source), format);
    const size = formatSize(format);
    const segments: bridge.PlanSegment[] = [];
    const tick = () => {
      progressRef.count += 1;
      if (exportCancelled.current) throw new Error('Export cancelled.');
      setExportProgress(Math.round(2 + progressRef.count / Math.max(1, progressRef.total) * 66));
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
            if (exportCancelled.current) throw new Error('Export cancelled.');
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
              if (exportCancelled.current) throw new Error('Export cancelled.');
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
      options: { width: size.width, height: size.height, fps: format.fps, codec: exportCodec, container: exportContainer, speed: exportSpeed, hardware: useHardware, crf: EXPORT_CODEC_CRF[exportCodec][format.quality], filename: exportFilename({ formats: nameFormats, slug: nameSlug }, nameFormats.length > 1) },
    };
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
        for (const output of outputs) jobs.push(await buildVideoPlan(output.formats[0], progressRef, snapshot, visualAudio, exportAudio, output.formats, output.slug));
        setExportProgress(72); setExportJob(current => ({ ...current, phase: 'Choose destination / starting encoder' }));
        const paths = await bridge.exportPlanVariants(snapshot.id, jobs, snapshot);
        if (paths.length) {
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

  function beginPlayheadDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!duration) return;
    const track = document.querySelector<HTMLElement>('.scene-track');
    if (!track) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    setPlaying(false);
    const update = (clientX: number) => scrubTo(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * duration);
    update(event.clientX);
    const move = (moveEvent: PointerEvent) => update(moveEvent.clientX);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

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
  const modalEyebrow = modal === 'export' ? 'VIDEO EXPORT' : modal === 'shortcuts' ? 'FIND YOUR FLOW' : modal === 'palette' ? 'EVERY ACTION, ONE PLACE' : modal === 'settings' ? 'MAKE PIXCUT YOURS' : modal === 'delete' ? 'REMOVE FROM THIS DEVICE' : modal === 'rename' ? 'PROJECT DETAILS' : modal === 'group' ? 'ORGANIZE YOUR LIBRARY' : modal === 'groups' ? 'ORGANIZE YOUR LIBRARY' : modal === 'formats' ? 'DELIVERABLES' : modal === 'missing' ? 'RESTORE YOUR MEDIA' : 'YOUR NEXT STORY';
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
      {FORMAT_FILTERS.map(filter => <button key={filter.id} role="tab" aria-selected={formatFilter === filter.id} className={formatFilter === filter.id ? 'active' : ''} onClick={() => setFormatFilter(filter.id)}>{filter.label}</button>)}
      {onCustom && <button type="button" className="format-filter-custom" onClick={onCustom}><Plus size={11} /> Custom size</button>}
    </div>;
  }

  function templateImage(template: TemplateDefinition) { return templatePreview(template); }

  function renderProjectCard(entry: ProjectSummary) {
    const active = entry.id === project.id;
    return <div className={`project-card ${active ? 'active' : ''} ${projectMenu === entry.id ? 'menu-open' : ''}`} key={entry.id}>
      <button className="project-open" onClick={() => void openLibraryProject(entry)} disabled={!libraryReady || !canEdit}>
        <div className="project-thumb">
          <div className="project-frame" style={{ aspectRatio: entry.width && entry.height ? `${entry.width} / ${entry.height}` : entry.aspect.replace(':', ' / ') }}>
            {entry.thumbnail ? <img src={entry.thumbnail} alt="" /> : <span className="project-thumb-fallback"><Clapperboard size={24} /></span>}
          </div>
          <span className="project-aspect">{entry.aspect}</span>
          {entry.group && <span className="project-group-badge"><FolderOpen size={10} />{entry.group}</span>}
          <span className="project-play"><Play size={15} fill="currentColor" /></span>
        </div>
        <div className="project-meta">
          <strong>{entry.name}</strong>
          <small>{entry.sceneCount} scene{entry.sceneCount === 1 ? '' : 's'} · {timecode(entry.duration, entry.timebase)}</small>
          {entry.formats && entry.formats.length > 0 && <span className="project-formats" title={entry.formats.map(format => `${format.name} · ${format.width}×${format.height}`).join('\n')}>
            {[...new Set(entry.formats.map(format => format.aspect))].slice(0, 4).map(aspect => <span className="project-format-chip" key={aspect}>{aspect}</span>)}
            {entry.formats.length > 1 && <span className="project-format-count">{entry.formats.length} formats</span>}
          </span>}
          <span className="project-status"><span className="status-dot" /> {active ? 'Open now' : `Edited ${relativeTime(entry.updatedAt)}`}</span>
        </div>
      </button>
      <button className={`project-favorite ${entry.favorite ? 'active' : ''}`} aria-label={entry.favorite ? `Remove ${entry.name} from favorites` : `Add ${entry.name} to favorites`} aria-pressed={Boolean(entry.favorite)} onClick={() => void toggleProjectFavorite(entry)}><Star size={15} fill={entry.favorite ? 'currentColor' : 'none'} /></button>
      <button className="project-actions" data-project-actions={entry.id} aria-label={`Actions for ${entry.name}`} aria-haspopup="menu" aria-expanded={projectMenu === entry.id} onClick={() => setProjectMenu(id => id === entry.id ? null : entry.id)}><MoreHorizontal size={16} /></button>
      {projectMenu === entry.id && <div className="project-menu" data-project-menu={entry.id} role="menu" aria-label={`${entry.name} actions`}>
        <span className="project-menu-heading">{entry.name}</span>
        <button role="menuitem" onClick={() => void openLibraryProject(entry)}><FolderOpen size={14} /><span>Open project</span></button>
        <button role="menuitem" disabled={!canEdit} onClick={() => askRenameProject(entry)}><Pencil size={14} /><span>Rename…</span></button>
        <button role="menuitem" onClick={() => void toggleProjectFavorite(entry)}><Star size={14} /><span>{entry.favorite ? 'Remove from favorites' : 'Add to favorites'}</span></button>
        <button role="menuitem" disabled={!canEdit} onClick={() => askGroupProject(entry)}><Layers size={14} /><span>{entry.group ? `Group: ${entry.group}` : 'Move to group…'}</span></button>
        <button role="menuitem" disabled={!canEdit} onClick={() => void duplicateProject(entry)}><Copy size={14} /><span>Duplicate</span></button>
        <button role="menuitem" onClick={() => void exportLibraryProject(entry)}><Download size={14} /><span>Export project file</span></button>
        <button role="menuitem" className="danger" onClick={() => askDeleteProject(entry)}><Trash2 size={14} /><span>Delete from device…</span></button>
      </div>}
    </div>;
  }

  const audioInspector = <>
              <details className="inspector-section ducking-panel"><summary>Project music mix</summary>
                <label className="checkbox-field"><input type="checkbox" checked={(project.ducking ?? 0) > 0} disabled={!canEdit || !hasVideoScenes} onChange={event => void run({ type: 'ducking', amount: event.target.checked ? 60 : 0 })} /> Lower music under video sound</label>
                {(project.ducking ?? 0) > 0 && <label className="music-control"><span>Reduce music by <b>{duckDraft ?? project.ducking}%</b></span><input type="range" aria-label="Music ducking amount" min="10" max="90" step="5" value={duckDraft ?? project.ducking ?? 60} disabled={!canEdit} onChange={event => setDuckDraft(Number(event.target.value))} onPointerUp={event => commitDucking(Number(event.currentTarget.value))} onKeyUp={event => commitDucking(Number(event.currentTarget.value))} onBlur={event => commitDucking(Number(event.currentTarget.value))} /></label>}
                <p className="note"><AudioLines size={14} /><span>{hasVideoScenes ? 'Lowers all music tracks while video audio is playing.' : 'Add a video clip to duck music under its sound.'}</span></p>
              </details>
              <div className="voiceover-panel">
                <div className="beat-sync-head"><strong>Voiceover</strong>{recording ? <span>{recordSeconds.toFixed(1)} s</span> : null}</div>
                <div className="beat-sync-actions">
                  {recording
                    ? <button className="button danger" onClick={stopVoiceover}><Square size={13} /> Stop and add</button>
                    : <button className="button" disabled={!canEdit || !projectTicks} onClick={() => void startVoiceover()}><Mic size={14} /> Record voiceover</button>}
                </div>
                <small>{recording ? 'Speak now. The take is added at the playhead when you stop.' : 'Records from your microphone at the playhead. Nothing is uploaded.'}</small>
              </div>
              {selectedAudio && <div className="audio-editor">
                <div className="audio-editor-title"><small>{isAssetRef(selectedAudio.data) ? 'Stored locally' : formatBytes(selectedAudio.data.length * .75)} · {selectedAudio.sourceDurationSeconds.toFixed(1)} s source</small></div>
                <label className="field">Audio track<select aria-label="Audio track" value={selectedAudio.lane} onChange={event => stageAudio({ lane: Number(event.target.value) })} onBlur={commitAudio}>{audioLanes.map((lane, index) => <option key={lane} value={lane}>Track {index + 1}</option>)}{audioLanes.length < 8 && <option value={audioLanes.length}>Track {audioLanes.length + 1}</option>}</select></label>
                <label className="music-control"><span>Start <b>{ticksToSeconds(selectedAudio.startTicks, project.timebase).toFixed(1)} s</b></span><input aria-label="Audio start" type="range" min="0" max={ticksToSeconds(Math.max(0, projectTicks - selectedAudio.durationTicks), project.timebase)} step={secondsPerTick(project.timebase)} value={ticksToSeconds(selectedAudio.startTicks, project.timebase)} disabled={!canEdit} onChange={event => stageAudio({ startTicks: secondsToTicks(Number(event.target.value), project.timebase) })} onPointerUp={commitAudio} onKeyUp={commitAudio} onBlur={commitAudio} /></label>
                <label className="music-control"><span>Trim in <b>{selectedAudio.sourceInSeconds.toFixed(1)} s</b></span><input aria-label="Audio trim in" type="range" min="0" max={Math.max(0, selectedAudio.sourceDurationSeconds - secondsPerTick(project.timebase))} step="0.1" value={selectedAudio.sourceInSeconds} disabled={!canEdit} onChange={event => stageAudio({ sourceInSeconds: Number(event.target.value) })} onPointerUp={commitAudio} onKeyUp={commitAudio} onBlur={commitAudio} /></label>
                <label className="music-control"><span>Duration <b>{ticksToSeconds(selectedAudio.durationTicks, project.timebase).toFixed(1)} s</b></span><input aria-label="Audio duration" type="range" min="0.1" max={Math.max(0.1, Math.min(ticksToSeconds(projectTicks - selectedAudio.startTicks, project.timebase), selectedAudio.sourceDurationSeconds - selectedAudio.sourceInSeconds))} step="0.1" value={ticksToSeconds(selectedAudio.durationTicks, project.timebase)} disabled={!canEdit} onChange={event => stageAudio({ durationTicks: secondsToTicks(Number(event.target.value), project.timebase) })} onPointerUp={commitAudio} onKeyUp={commitAudio} onBlur={commitAudio} /></label>
                <label className="music-control"><span>Volume <b>{Math.round(selectedAudio.volume * 100)}%</b></span><input aria-label="Audio volume" type="range" min="0" max="100" step="1" value={Math.round(selectedAudio.volume * 100)} disabled={!canEdit} onChange={event => stageAudio({ volume: Number(event.target.value) / 100 })} onPointerUp={commitAudio} onKeyUp={commitAudio} onBlur={commitAudio} /></label>
                <label className="music-control"><span>Fade in <b>{selectedAudio.fadeIn.toFixed(1)} s</b></span><input aria-label="Audio fade in" type="range" min="0" max={Math.min(30, ticksToSeconds(selectedAudio.durationTicks, project.timebase))} step="0.1" value={selectedAudio.fadeIn} disabled={!canEdit} onChange={event => stageAudio({ fadeIn: Number(event.target.value) })} onPointerUp={commitAudio} onKeyUp={commitAudio} onBlur={commitAudio} /></label>
                <label className="music-control"><span>Fade out <b>{selectedAudio.fadeOut.toFixed(1)} s</b></span><input aria-label="Audio fade out" type="range" min="0" max={Math.min(30, ticksToSeconds(selectedAudio.durationTicks, project.timebase))} step="0.1" value={selectedAudio.fadeOut} disabled={!canEdit} onChange={event => stageAudio({ fadeOut: Number(event.target.value) })} onPointerUp={commitAudio} onKeyUp={commitAudio} onBlur={commitAudio} /></label>
                <details className="inspector-section" open>
                  <summary>Three-band EQ</summary>
                  {([['low', 'Bass · 120 Hz'], ['mid', 'Voice · 1 kHz'], ['high', 'Treble · 6 kHz']] as const).map(([key, label]) => (
                    <label className="music-control" key={key}><span>{label} <b>{(selectedAudio[key] ?? 0) > 0 ? '+' : ''}{selectedAudio[key] ?? 0} dB</b></span><input aria-label={`Audio ${key} EQ`} type="range" min="-12" max="12" step="1" value={selectedAudio[key] ?? 0} disabled={!canEdit} onChange={event => stageAudio({ [key]: Number(event.target.value) })} onPointerUp={commitAudio} onKeyUp={commitAudio} onBlur={commitAudio} /></label>
                  ))}
                  <button className="button" disabled={!canEdit || !selectedAudio.low && !selectedAudio.mid && !selectedAudio.high} onClick={() => { stageAudio({ low: 0, mid: 0, high: 0 }); window.setTimeout(commitAudio, 0); }}><RotateCcw size={13} /> Reset EQ</button>
                </details>
                <div className="beat-sync">
                  <div className="beat-sync-head"><strong>Beat tools</strong>{beatTempo ? <span>{beatTempo} BPM</span> : null}</div>
                  <div className="beat-sync-actions">
                    <button className="button" disabled={!canEdit || beatBusy} onClick={() => void detectAudioBeats()}><AudioLines size={14} />{beatBusy ? 'Listening…' : 'Detect beats'}</button>
                    <button className="button" disabled={!canEdit || beatBusy} onClick={() => void snapCutsToBeat()}><Magnet size={14} />Snap cuts</button>
                  </div>
                  <small>Detect beat markers, then align cuts to the rhythm.</small>
                </div>

              </div>}
  </>;
  const propertyKind = inspectorKind(editTarget, { scene: Boolean(selectedScene), text: Boolean(selectedTextLayer), element: Boolean(selectedElement), audio: Boolean(selectedAudio) });

  const elementInspector = selectedElement && <div className="element-controls">
                <div className="element-controls-head"><strong>{elementName(selectedElement)}</strong><button className="text-button danger" onClick={() => removeElement(selectedElement.id)}><Trash2 size={12} /> Delete</button></div>
                {(selectedElement.presetId || ELEMENT_LABEL_DEFAULTS[selectedElement.kind] !== undefined) && <ElementTextField key={selectedElement.id} value={selectedElement.label ?? elementPreset(selectedElement)?.text ?? ELEMENT_LABEL_DEFAULTS[selectedElement.kind] ?? ''} stage={label => stageElement({ label })} commit={commitElement} />}
                {selectedElement.kind !== 'image' && selectedElement.kind !== 'video' && <div className="element-color-row">{ELEMENT_COLORS.map(color => <button key={color} className={`element-color ${selectedElement.color === color ? 'active' : ''}`} style={{ background: color }} aria-label={`Element color ${color}`} onClick={() => updateElement({ color })} onPointerUp={commitElement} onKeyUp={commitElement} onBlur={commitElement} />)}</div>}
                {selectedElement.kind === 'video' && <p className="note">Overlay audio is muted. Add music on an audio track.</p>}
                {sceneLayerStack.length > 1 && <StackOrder position={elementStackPosition(selectedElement)} total={sceneLayerStack.length} disabled={!canEdit} onMove={moveElementLayer} />}
                <details className="inspector-section" open><summary>Timing</summary><div className="overlay-timing">
                  <label className="field">Start (project seconds)<input aria-label="Overlay start" type="number" min="0" max={ticksToSeconds(projectTicks - 1, project.timebase)} step={secondsPerTick(project.timebase)} value={Number(ticksToSeconds(selectedElement.startTicks, project.timebase).toFixed(3))} onChange={event => stageElement({ startTicks: secondsToTicks(Number(event.target.value), project.timebase) })} onBlur={commitElement} onKeyDown={event => { if (event.key === 'Enter') commitElement(); }} /></label>
                  <label className="field">Duration (seconds)<input aria-label="Overlay duration" type="number" min={secondsPerTick(project.timebase)} max={ticksToSeconds(projectTicks - selectedElement.startTicks, project.timebase)} step={secondsPerTick(project.timebase)} value={Number(ticksToSeconds(selectedElement.durationTicks, project.timebase).toFixed(3))} onChange={event => stageElement({ durationTicks: secondsToTicks(Number(event.target.value), project.timebase) })} onBlur={commitElement} onKeyDown={event => { if (event.key === 'Enter') commitElement(); }} /></label>
                </div></details>
<details className="inspector-section motion-properties" open><summary>Motion</summary>
                <BehaviorControls canvas={activeSize} element={selectedElement} audio={project.audio} update={updateElement} stage={stageElement} commit={commitElement} preview={seconds => { commitElement(); setPosition(Math.min(ticksToSeconds(projectTicks - 1, project.timebase), ticksToSeconds(selectedElement.startTicks, project.timebase) + seconds)); setPlaying(true); }} />
                <section className="element-motion"><h3>Entrance</h3>                <div className="library-label">ENTRANCE <span>{ELEMENT_ANIMATIONS.length - 1} motions</span></div>
                <div className="animation-choices">{ELEMENT_ANIMATIONS.map(([id, label]) => <button key={id} aria-pressed={selectedElement.animation === id} className={selectedElement.animation === id ? 'active' : ''} onClick={() => updateElement(animationSelection(id))}><span className="motion-preview"><ElementPreview motionSample kind="name-tag" color={selectedElement.color} animation={id} label={'Aa\nMotion'} reduceMotion={preferences.reduceMotion} /></span><span>{label}</span></button>)}</div>
                <label className="checkbox-field element-repeat"><input type="checkbox" checked={selectedElement.loop ?? false} disabled={selectedElement.animation === 'none'} onChange={event => updateElement({ loop: event.target.checked })} onPointerUp={commitElement} onKeyUp={commitElement} onBlur={commitElement} /> {isContinuousMotion(selectedElement.animation) ? 'Repeat motion' : 'Repeat entrance'}</label>
                {selectedElement.animation !== 'none' && <label className="field">Entrance duration<input aria-label="Element animation duration" type="number" min="0.1" max="5" step="0.1" value={selectedElement.animationDuration ?? .6} onChange={event => stageElement({ animationDuration: Math.max(.1, Math.min(5, Number(event.target.value) || .6)) })} onPointerUp={commitElement} onKeyUp={commitElement} onBlur={commitElement} /></label>}
                </section>
                <details className="overlay-action"><summary>Timed action</summary><label className="field">Later action<select aria-label="Element action" value={selectedElement.action?.kind ?? 'none'} onChange={event => updateElement({ action: event.target.value === 'none' ? undefined : { kind: event.target.value as 'ring', startTicks: Math.min(selectedElement.durationTicks - 1, secondsToTicks(1, project.timebase)), durationTicks: Math.min(selectedElement.durationTicks, secondsToTicks(2, project.timebase)), repeat: false, sound: false } })}><option value="none">None</option><option value="ring">Ring / shake</option><option value="pulse">Pulse</option><option value="float">Float</option><option value="spin">Spin</option></select></label>
                {selectedElement.action && <>
                  <label className="field">Action starts after (seconds)<input aria-label="Action start" type="number" min="0" max={ticksToSeconds(selectedElement.durationTicks - 1, project.timebase)} step="0.1" value={ticksToSeconds(selectedElement.action.startTicks, project.timebase)} onChange={event => stageElement({ action: { ...selectedElement.action!, startTicks: secondsToTicks(Number(event.target.value), project.timebase) } })} onBlur={commitElement} onKeyDown={event => { if (event.key === 'Enter') commitElement(); }} /></label>
                  <label className="field">Action duration (seconds)<input aria-label="Action duration" type="number" min="0.1" max={ticksToSeconds(selectedElement.durationTicks - selectedElement.action.startTicks, project.timebase)} step="0.1" value={ticksToSeconds(selectedElement.action.durationTicks, project.timebase)} onChange={event => stageElement({ action: { ...selectedElement.action!, durationTicks: secondsToTicks(Number(event.target.value), project.timebase) } })} onBlur={commitElement} /></label>
                  <label className="checkbox-field"><input type="checkbox" checked={selectedElement.action.repeat} onChange={event => updateElement({ action: { ...selectedElement.action!, repeat: event.target.checked } })} /> Repeat action</label>
                  {selectedElement.action.kind === 'ring' && <label className="checkbox-field"><input type="checkbox" checked={selectedElement.action.sound} onChange={event => updateElement({ action: { ...selectedElement.action!, sound: event.target.checked } })} /> Bell sound</label>}
                </>}
                </details>
</details>
                <details className="element-adjustments"><summary>Size & position</summary>
                <KeyframeControls layer={selectedElement} playheadSeconds={Math.max(0, position - ticksToSeconds(selectedElement.startTicks, project.timebase))} durationSeconds={ticksToSeconds(selectedElement.durationTicks, project.timebase)} disabled={!canEdit} onChange={keyframes => updateElement({ keyframes })} />
                {(selectedElement.kind === 'image' || selectedElement.kind === 'video') && <MaskControls mask={selectedElement.mask} disabled={!canEdit} onStage={mask => stageElement({ mask })} onCommit={commitElement} onApply={mask => updateElement({ mask })} />}

                <label className="music-control"><span>Opacity <b>{Math.round(selectedElement.opacity)}%</b></span><input type="range" min="0" max="100" step="1" value={selectedElement.opacity} onChange={event => stageElement({ opacity: Number(event.target.value) })} onPointerUp={commitElement} onKeyUp={commitElement} onBlur={commitElement} /></label>
                <label className="music-control"><span>Rotation <b>{Math.round(selectedElement.rotation)}°</b></span><input type="range" min="-180" max="180" step="1" value={selectedElement.rotation} onChange={event => stageElement({ rotation: Number(event.target.value) })} onPointerUp={commitElement} onKeyUp={commitElement} onBlur={commitElement} /></label>
                <label className="music-control"><span>Width <b>{Math.round(selectedElement.width * 100)}%</b></span><input type="range" min="2" max="100" step="1" value={Math.round(selectedElement.width * 100)} onChange={event => stageElement({ width: Number(event.target.value) / 100 })} onPointerUp={commitElement} onKeyUp={commitElement} onBlur={commitElement} /></label>
                <label className="music-control"><span>Height <b>{Math.round(selectedElement.height * 100)}%</b></span><input type="range" min="2" max="100" step="1" value={Math.round(selectedElement.height * 100)} onChange={event => stageElement({ height: Number(event.target.value) / 100 })} onPointerUp={commitElement} onKeyUp={commitElement} onBlur={commitElement} /></label>
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
        <aside className="home-sidebar">
          <button className="brand-button home-brand" aria-label="PixCut home" onClick={() => setHomeSection('home')}><Brand /></button>
          <nav className="home-nav" aria-label="Main navigation">
            <button className={homeSection === 'home' ? 'active' : ''} onClick={() => setHomeSection('home')}><Home size={18} /><span>{t('Home')}</span></button>
            <button className={homeSection === 'projects' ? 'active' : ''} onClick={() => setHomeSection('projects')}><FolderOpen size={18} /><span>{t('Projects')}</span></button>
            <button onClick={() => setModal('templates')}><LayoutTemplate size={18} /><span>{t('Templates')}</span></button>
            <button onClick={() => setModal('settings')}><Settings2 size={18} /><span>{t('Settings')}</span></button>
          </nav>
          <div className="sidebar-card">
            <strong>{t('Your media stays with you.')}</strong>
            <p>{t('No account. No cloud. Just your stories.')}</p>
          </div>
          <div className="sidebar-bottom">
            {showUpdateNotice(updateState) && <button className={`sidebar-update ${updateState}`} onClick={() => { setSettingsTab('updates'); setModal('settings'); }} aria-label="Open application updates">
              <Download size={18} />
              <span><strong>{updateState === 'ready' ? 'Ready to restart' : updateState === 'downloading' ? `Downloading · ${updateProgress}%` : `PixCut ${updateInfo?.version} available`}</strong><small>{updateState === 'ready' ? 'Restart to finish updating' : updateState === 'downloading' ? 'View progress' : 'View release notes & install'}</small></span>
              <ArrowUpRight size={14} />
            </button>}
            <button className="sidebar-link" onClick={() => setModal('shortcuts')}><Keyboard size={16} /><span>{t('Keyboard shortcuts')}</span></button>
            <button className="sidebar-link" onClick={() => { setSettingsTab('updates'); setModal('settings'); }}><Info size={16} /><span>{t('Version & build details')}</span></button>
            <div className="sidebar-version"><span>PIXCUT DESKTOP</span><span>v{appVersion}</span></div>
          </div>
        </aside>

        <main className="home-main">
          <header className="home-topbar">
            <div className="home-heading">
              <div className="eyebrow"><span /><>{t(homeSection === 'home' ? 'A LITTLE MOMENT. A GREAT STORY.' : 'YOUR LOCAL LIBRARY')}</></div>
              <h1>{homeSection === 'home' ? <>{t('What would you like')}<br /><em>{t('to create?')}</em></> : <>{t('Your stories,')}<br /><em>{t('kept close.')}</em></>}</h1>
              <p className="home-intro">{homeSection === 'home' ? <>{t('Your photos, your pace, your point of view.')}<br />{t('Bring them together in a place that’s entirely yours.')}</> : <>{t('Everything lives on this device. Open a recent story or start a new one whenever inspiration arrives.')}</>}</p>
            </div>
            <div className="home-actions">
              <button className="button subtle" onClick={() => void open()} disabled={!canEdit}><FolderOpen size={16} /> {t('Open project')}</button>
              <button className="button primary" disabled={!ready} onClick={() => setModal('new')}><Plus size={16} /> {t('New project')}</button>
            </div>
          </header>

          {homeSection === 'home' && <section className="create-grid" aria-label="Create something new">
            <button className="create-card new-video" disabled={!ready} onClick={() => setModal('new')}>
              <span className="create-icon"><Plus size={25} /></span>
              <span className="create-copy"><strong>{t('New Video')}</strong><small>{t('Start with an empty timeline.')}</small></span>
              <span className="create-arrow"><ArrowUpRight size={19} /></span>
            </button>
            <button className="create-card photo-movie" disabled={!ready} onClick={() => void chooseImages()}>
              <span className="create-icon"><Images size={24} /></span>
              <span className="create-copy"><strong>{t('Photo Movie')}</strong><small>{t('Turn photos into a story.')}</small></span>
              <span className="create-arrow"><ArrowUpRight size={19} /></span>
            </button>
            <button className="create-card templates" disabled={!ready} onClick={() => setModal('templates')}>
              <span className="create-icon"><LayoutTemplate size={24} /></span>
              <span className="create-copy"><strong>{t('Templates')}</strong><small>{t('Start with a ready-made design.')}</small></span>
              <span className="create-arrow"><ArrowUpRight size={19} /></span>
            </button>
          </section>}

          <section className="recent-section">
            <div className="section-title">
              <div><h2>{t(homeSection === 'home' ? 'Recent projects' : 'Your projects')}</h2><p>{t(homeSection === 'home' ? 'Pick up where you left off.' : 'Stored locally, recovered automatically.')}</p></div>
              <span className="count-label">{projects.length ? projectCount(projects.length) : t('Nothing yet')}</span>
            </div>
            {projects.length ? <>
              {homeSection === 'projects' && <div className="library-controls">
                <label className="search-field"><Search size={14} /><input aria-label="Search projects" placeholder="Search projects or groups…" value={libraryQuery} onChange={event => setLibraryQuery(event.target.value)} /></label>
                <select aria-label="Sort projects" value={librarySort} onChange={event => setLibrarySort(event.target.value as 'recent' | 'name' | 'duration')}><option value="recent">Recently edited</option><option value="name">Name A–Z</option><option value="duration">Longest first</option></select>
                <button className={`favorite-filter ${favoriteOnly ? 'active' : ''}`} aria-pressed={favoriteOnly} onClick={() => setFavoriteOnly(value => !value)}><Star size={13} fill={favoriteOnly ? 'currentColor' : 'none'} /> Favorites</button>
              </div>}
              {homeSection === 'projects' && <div className="group-filter" role="group" aria-label="Filter projects by group">
                <button className={`group-chip ${groupFilter === 'all' ? 'active' : ''}`} onClick={() => setGroupFilter('all')}>All <span>{projects.length}</span></button>
                {projectGroupsList.map(group => <button key={group} className={`group-chip ${groupFilter === group ? 'active' : ''}`} onClick={() => setGroupFilter(group)}><FolderOpen size={11} />{group} <span>{projects.filter(entry => entry.group === group).length}</span></button>)}
                <button className={`group-chip ${groupFilter === 'ungrouped' ? 'active' : ''}`} onClick={() => setGroupFilter('ungrouped')}>Ungrouped <span>{projects.filter(entry => !entry.group).length}</span></button>
                {projectGroupsList.length > 0 && <button className="group-manage" onClick={openGroupManager}><Settings2 size={11} /> Manage groups</button>}
              </div>}

              {homeSection === 'projects' && groupFilter === 'all' && projectGroupsList.length ? <>
                {[...projectGroupsList, 'Ungrouped'].map(group => {
                  const items = group === 'Ungrouped' ? matchingProjects.filter(entry => !entry.group) : matchingProjects.filter(entry => entry.group === group);
                  if (!items.length) return null;
                  return <div className="project-group-section" key={group}>
                    <div className="project-group-title"><h3>{group}</h3><span>{items.length} project{items.length === 1 ? '' : 's'}</span></div>
                    <div className="project-grid">{items.map(renderProjectCard)}</div>
                  </div>;
                })}
                <div className="project-group-section"><div className="project-group-title"><h3>New</h3><span>Start a fresh story</span></div><div className="project-grid">
                  <button className="project-card ghost" onClick={() => setModal('new')} disabled={!canEdit}>
                    <span className="ghost-art"><span><Plus size={24} /></span><small>Blank canvas</small></span>
                    <div className="project-meta"><strong>Start something new</strong><small>A fresh story, ready for your photos.</small></div>
                  </button>
                </div></div>
              </> : <div className="project-grid">
                {visibleProjects.map(renderProjectCard)}
                {!visibleProjects.length && <div className="library-empty compact group-empty"><FolderOpen size={28} /><strong>No projects in this group yet.</strong><p>Use a project’s ••• menu to move it here.</p></div>}
                <button className="project-card ghost" onClick={() => setModal('new')} disabled={!canEdit}>
                  <span className="ghost-art"><span><Plus size={24} /></span><small>Blank canvas</small></span>
                  <div className="project-meta"><strong>Start something new</strong><small>A fresh story, ready for your photos.</small></div>
                </button>
              </div>}
            </> : <div className="empty-projects">
              <div className="empty-projects-icon"><Clapperboard size={28} /></div>
              <div><strong>Your next favorite starts here.</strong><p>Start a story above, import a photo movie, or open a saved PixCut project.</p></div>
              <button className="button subtle" onClick={() => void chooseImages()} disabled={!canEdit}><Upload size={15} /> Import photos</button>
            </div>}
          </section>

          {homeSection === 'home' && <section className="thumb-strip" aria-label="Template inspiration">
            <div className="section-title"><div><h2>Skip the blank page</h2><p>Start from a sample and make it yours.</p></div><button className="text-button" onClick={() => setModal('templates')}>Browse templates <ArrowRight size={14} /></button></div>
            <div className="thumb-grid">{TEMPLATES.slice(0, 3).map(template => <button key={template.id} className="thumb-card" onClick={() => chooseTemplate(template)}><span className="thumb-art"><img src={templateImage(template)} alt="" /></span><span><strong>{template.name}</strong><small>{template.sceneCount} scenes · {template.duration.toFixed(1)} s</small></span></button>)}</div>
          </section>}

          {homeSection === 'home' && <section className="home-perks">
            <div><span className="perk-icon violet"><Zap size={17} /></span><strong>Simple</strong><small>Start creating in minutes</small></div>
            <div><span className="perk-icon blue"><Layers size={17} /></span><strong>Powerful</strong><small>Timing, titles, and color</small></div>
            <div><span className="perk-icon pink"><WifiOff size={17} /></span><strong>On this device</strong><small>Edit without internet or account</small></div>
            <div><span className="perk-icon green"><Ban size={17} /></span><strong>No watermark</strong><small>Export beautiful videos, free</small></div>
          </section>}
        </main>
      </> : <>
        <header className="editor-header">
          <button className="brand-button" aria-label="Back to home" onClick={goHome}><Brand /></button>
          <span className="header-divider" />
          <span className="editor-mode">{t('Video Editor')}</span>
          <input className="project-name" aria-label="Project name" value={name} maxLength={120} disabled={!canEdit} onChange={e => setName(e.target.value)} onBlur={() => { if (name !== project.name) void run({ type: 'rename', name: name.trim() || 'Untitled story' }); }} />
          <span className="save-status" role="status" aria-live="polite"><span className="status-dot" aria-hidden="true" />{status}</span>
          <div className="header-actions">
            <IconButton label={tip('palette.open', 'Command palette')} onClick={() => runCommandId('palette.open')}><CommandIcon size={17} /></IconButton>
            <IconButton label={tip('help.shortcuts', 'Keyboard shortcuts')} onClick={() => runCommandId('help.shortcuts')}><Keyboard size={17} /></IconButton>
            <span className="header-divider" />
            <IconButton label={tip('history.undo', 'Undo')} disabled={!session.canUndo || !canEdit} onClick={() => void run({ type: 'undo' })}><Undo2 size={17} /></IconButton>
            <IconButton label={tip('history.redo', 'Redo')} disabled={!session.canRedo || !canEdit} onClick={() => void run({ type: 'redo' })}><Redo2 size={17} /></IconButton>
            <button className="button subtle header-save" aria-label="Save project" title={tip('project.save', 'Save project')} disabled={!ready} onClick={() => void save()}><Save size={15} /> <span>{t('Save')}</span></button>
            <button className="button export" title={tip('export.open', 'Export video')} disabled={!scenes.length || !ready || exporting} onClick={openExportModal}><Download size={15} /> {t('Export')} <ChevronDown size={12} /></button>
          </div>
        </header>

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

        <div className="editor-body">
          <aside className="library" style={{ width: libraryWidth }}>
          <nav className="tool-rail" aria-label="Editor tools">
            <button aria-label="Media" title="Media" className={tab === 'media' ? 'active' : ''} onClick={() => setTab('media')}><Clapperboard size={20} /><span>{t('Media')}</span></button>
            <button aria-label="Titles" title="Titles" className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}><Type size={21} /><span>{t('Titles')}</span></button>
            <button aria-label="Elements" title="Elements" className={tab === 'elements' ? 'active' : ''} onClick={() => setTab('elements')}><Shapes size={20} /><span>{t('Elements')}</span></button>
            <button aria-label="Audio" title="Audio" className={tab === 'audio' ? 'active' : ''} onClick={() => setTab('audio')}><Music size={20} /><span>{t('Audio')}</span></button>
            <button aria-label="Templates" title="Templates" className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}><LayoutTemplate size={20} /><span>{t('Templates')}</span></button>
          </nav>


            <div className="panel-title"><h2>{t(tabTitles[tab])}</h2><span className="count">{tab === 'audio' ? audio.length : scenes.length}</span></div>

            {tab === 'media' ? <>
              <label className="search-field"><Search size={14} /><input aria-label="Search project media" placeholder="Search media…" value={mediaQuery} onChange={e => setMediaQuery(e.target.value)} /></label>
              <button className="import-button" title={tip('project.import', 'Import media')} disabled={!canEdit} onClick={() => void chooseImages()}><Upload size={16} /> Import images <span>+</span></button>


              <button className="button import-video" disabled={!canEdit} onClick={() => void chooseVideo()}><Film size={14} /> Import video</button>
              <div className="library-label">PROJECT MEDIA <span>JPEG · PNG · WEBP</span></div>
              <div className="media-grid" onDragOver={event => dragOverTarget(event, 'media-grid')} onDrop={dropIntoMedia}>{filteredScenes.map(source => <div key={source.id} className="media-tile source-tile">
                <button className="media-source" aria-label={`Preview ${source.name}`} onClick={() => previewMedia(source)}><div><AssetImage source={source.videoPoster ?? source.image} alt="" fallback={<span className="media-missing"><ImagePlus size={18} /> Missing</span>} /><span>{source.mediaKind === 'video' ? 'VIDEO · ' : ''}{sceneSeconds(source, project.timebase).toFixed(1)}s</span><Play className="source-play" size={20} /></div><span className="media-name">{source.name}</span></button>
                <div className="media-placement"><button title={hasMedia(source.image) ? 'Append to timeline' : 'Relink this file first'} aria-label={`Append ${source.name}`} disabled={!canEdit || !hasMedia(source.image)} onClick={() => void appendMedia(source)}><Plus size={14} /><span>Add</span></button><button title={hasMedia(source.image) ? 'Picture in picture' : 'Relink this file first'} aria-label={`Picture in picture: ${source.name}`} disabled={!canEdit || !selectedScene || !hasMedia(source.image)} onClick={() => void addMediaPip(source).catch(error => setError(messageFor(error)))}><Layers size={14} /></button></div>
              </div>)}</div>
              {!sourceMedia.length && <div className="library-empty"><ImagePlus size={34} /><strong>A story starts with a photo.</strong><p>Import images from your device.<br />Nothing gets uploaded.</p></div>}
              {sourceMedia.length > 0 && !filteredScenes.length && <div className="library-empty"><Search size={30} /><strong>No matching media.</strong><p>Try a different name, or clear the search.</p></div>}
            </> : tab === 'text' ? <div className="title-library">
              <div className="library-item-list" aria-label="Project text layers">
                <div className="library-label">PROJECT TEXT <span>ALL SCENES</span></div>
                {(project.globalText ?? []).map((layer, index) => <div className={`project-text-row ${editTarget === 'text' && selectedGlobalTextId === layer.id ? 'active' : ''}`} key={layer.id}>
                  <button className="project-text-select" aria-pressed={editTarget === 'text' && selectedGlobalTextId === layer.id} onClick={() => selectGlobalText(layer.id)}><Type size={14} /><span>{layer.title || `Project text ${index + 1}`}</span><small>{ticksToSeconds(layer.startTicks, project.timebase).toFixed(1)} s</small></button>
                  <button className="text-button danger" aria-label={`Delete ${layer.title || `Project text ${index + 1}`}`} disabled={!canEdit} onClick={() => void run({ type: 'globalText', layers: (project.globalText ?? []).filter(item => item.id !== layer.id) }).then(ok => { if (ok && selectedGlobalTextId === layer.id) setSelectedGlobalTextId(null); })}><Trash2 size={12} /></button>
                </div>)}
                <button className="button add-project-text" disabled={!canEdit || !projectTicks} onClick={addProjectText}><Plus size={14} /> Add project text</button>
              </div>
              {selectedScene && sceneTextLayers(selectedScene).length > 0 && <div className="library-item-list" aria-label="Text layers in selected scene"><div className="library-label">IN THIS SCENE</div>{sceneTextLayers(selectedScene).map((layer,index) => <button key={layer.id} className={editTarget === 'text' && selectedTextLayerId === layer.id ? 'active' : ''} aria-pressed={editTarget === 'text' && selectedTextLayerId === layer.id} onClick={() => selectTextLayer(layer.id)}><Type size={14} /><span>{layer.title || `Text layer ${index+1}`}</span></button>)}</div>}

              <div className="caption-import">
                <div className="caption-import-actions">
                  <button className="button" disabled={!canEdit || !scenes.length} onClick={() => captionInput.current?.click()}><Captions size={14} /> Import</button>
                  <button className="button" disabled={!canEdit || !scenes.length} onClick={() => void exportCaptions()}><Download size={14} /> Export SRT</button>
                </div>
                <small>Import SRT or WebVTT as editable layers; export every text layer back as subtitles.</small>
              </div>
              <div className="caption-import font-import">
                <button className="button" disabled={!canEdit || (project.fonts?.length ?? 0) >= MAX_PROJECT_FONTS} onClick={() => fontInput.current?.click()}><Type size={14} /> Import font</button>
                <small>{project.fonts?.length ? `${project.fonts.length} custom font${project.fonts.length === 1 ? '' : 's'} in the picker` : 'TTF, OTF, or WOFF · appears in the font picker'}</small>
              </div>
              {TITLE_PRESETS.map(preset => <button key={preset.name} className={`title-preset ${preset.id}`} disabled={!selectedScene || !canEdit || sceneTextLayers(selectedScene).length >= 8} onClick={() => addTextLayerAtPlayhead(preset.layer)} aria-label={`Add ${preset.name} title`}>
                <span className="title-preset-art" style={{ fontFamily: fontOption(preset.layer.font ?? 'inter').family }}><span>{preset.sample}</span></span><strong>{preset.name}</strong><Plus size={13} />
              </button>)}
            </div> : tab === 'audio' ? <div className="music-panel">
              <button className="import-button" disabled={!canEdit || !projectTicks} onClick={() => { audioLaneRef.current = selectedAudio?.lane ?? 0; void chooseAudio(); }}><Plus size={16} /> Add audio at playhead <span>{audio.length}</span></button>
              {audio.length ? <div className="audio-list">{audio.map(clip => {
                const start = ticksToSeconds(clip.startTicks, project.timebase);
                const length = ticksToSeconds(clip.durationTicks, project.timebase);
                return <div className={`audio-list-item ${editTarget === 'audio' && selectedAudio?.id === clip.id ? 'active' : ''}`} key={clip.id}>
                  <button className="audio-list-select" onClick={() => focusAudio(clip)}><Music size={15} /><span><strong>{clip.name}</strong><small>{start.toFixed(1)} s · {length.toFixed(1)} s</small></span></button>
                </div>;
              })}</div> : <div className="library-empty music-empty">
                <Music size={34} />
                <strong>Give your story a soundtrack.</strong>
                <p>Add as many audio clips as you need.<br />Stays on this device.</p>
              </div>}
            </div> : tab === 'templates' ? <div className="template-tab">
              <button className="import-button" onClick={() => setModal('templates')}><LayoutTemplate size={16} /> Browse the full gallery <span>{TEMPLATES.length}</span></button>
              <div className="library-label">BUNDLED STORIES <span>OFFLINE</span></div>
              <div className="template-tab-list">{TEMPLATES.map(template => <button key={template.id} className="template-tab-card" disabled={!canEdit} onClick={() => chooseTemplate(template)}>
                <span className="template-tab-art"><img src={templateImage(template)} alt="" /></span>
                <span className="template-tab-copy"><strong>{template.name}</strong><small>{template.aspect} · {template.sceneCount} scenes · {template.duration.toFixed(1)} s</small><span className="template-badges">{template.video && <span className="template-badge video">VIDEO</span>}{template.audio && <span className="template-badge music">MUSIC</span>}</span></span>
                <Plus size={15} />
              </button>)}</div>
              <p className="template-tab-note">Templates include real scenes, timing, looks, text effects, a local music bed, and one animated video opener. Your current story is saved before a template replaces it.</p>
            </div> : <div className="elements-panel">
              <div className="custom-import-actions"><button className="button" disabled={!selectedScene || !canEdit} onClick={() => void chooseCustomElement('image')}><ImagePlus size={15} /> Import graphic</button><button className="button" disabled={!selectedScene || !canEdit} onClick={() => void chooseCustomElement('video')}><Layers size={15} /> Video overlay</button></div>
              {allOverlays.length > 0 && <details className="element-list element-project-overlays">
                <summary>Project overlays <span>{allOverlays.length}</span></summary>
                {allOverlays.map(element => <button key={element.id} className={`element-list-row ${selectedElementId === element.id ? 'active' : ''}`} onClick={() => selectOverlay(element)}><span className="element-list-row-icon" style={{ color: element.color }}><ElementGlyph presetId={element.presetId} kind={element.kind} size={12} /></span><span>{elementName(element)}</span><small>{ticksToSeconds(element.startTicks, project.timebase).toFixed(1)}s</small></button>)}
              </details>}
              <div className="element-library-tools">
                <label className="element-search"><Search size={15} /><input aria-label="Search elements" placeholder={`Search ${ELEMENT_CATALOG.length} elements…`} value={elementSearch} onChange={e => { setElementSearch(e.target.value); setElementLimit(40); }} /></label>
                <select aria-label="Element collection" value={elementCollection} onChange={e => { setElementCollection(e.target.value); setElementCategory('All'); setElementLimit(40); }}><option value="All">All {ELEMENT_COLLECTIONS.length} collections</option>{ELEMENT_COLLECTIONS.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select>
                <div className="element-library-count"><strong>{filteredElements.length} elements</strong><span>{ELEMENT_CATALOG.length} in your library</span></div>
              </div>
              <div className="element-categories" role="group" aria-label="Element categories">{ELEMENT_CATEGORIES.map(category => <button key={category} aria-pressed={elementCategory === category} className={elementCategory === category ? 'active' : ''} onClick={() => { setElementCategory(category); setElementCollection('All'); setElementLimit(40); }}>{category}</button>)}</div>
              <div className="element-grid">{filteredElements.slice(0, elementLimit).map(item => <button key={item.id} className="element-card" aria-label={`Add ${item.label}`} disabled={!selectedScene || !canEdit || allOverlays.length >= 64} onClick={() => addElement(item.id)}><span className="element-card-icon"><ElementPreview presetId={item.id} kind={item.kind} color={item.color} animation={item.animation} reduceMotion={preferences.reduceMotion} /></span><strong>{item.label}</strong><Plus size={12} /></button>)}</div>
              {filteredElements.length === 0 && <p className="note">No matching elements. Try another collection or search.</p>}
              {filteredElements.length > elementLimit && <button className="button element-show-more" onClick={() => setElementLimit(n => n + 40)}>Show 40 more · {Math.min(elementLimit, filteredElements.length)} of {filteredElements.length}</button>}

            </div>}


          </aside>

          <div className="splitter vertical" onPointerDown={e => beginResize('library', libraryWidth, e.clientX)} />

          <main className="preview-panel">
            <div className="preview-heading">
              <span>PREVIEW</span>
              <div>
                <span className="offline"><span />Local only</span>
                <button className="text-button" title={tip('view.safe_area', `Safe area ${safeArea ? 'on' : 'off'}`)} onClick={() => runCommandId('view.safe_area')}>Safe area {safeArea ? 'on' : 'off'}</button>
                <select aria-label="Output format" value={activeFormat?.id ?? ''} disabled={!canEdit} onChange={event => setActiveFormatId(event.target.value)}>{project.formats.map(format => <option key={format.id} value={format.id}>{format.name} · {format.aspect}</option>)}</select>
                <button className="format-manage-button" onClick={() => setModal('formats')}><Layers size={13} /> Formats <span>{project.formats.length}</span></button>
                {previewTarget && <IconButton label={`Save still frame · ${activeSize.width} × ${activeSize.height} PNG`} onClick={() => void saveStillFrame()}><Camera size={15} /></IconButton>}
                <IconButton label="Fullscreen preview" onClick={togglePreviewFullscreen}><Maximize2 size={15} /></IconButton>
              </div>
            </div>
            <div className="preview-area" ref={previewArea}>
              {previewTarget ? <div className="preview-stage" data-dialog-open={Boolean(modal)} inert={Boolean(modal)} ref={previewStage} style={previewSize ? { width: previewSize.width, height: previewSize.height } : undefined}>
                <canvas ref={preview} className="preview-canvas" aria-label={`Preview: ${sceneTextTitle(previewTarget) || previewTarget.name}`} />
                <video ref={sceneVideo} className="scene-video" playsInline preload="auto" aria-hidden="true" onLoadedData={() => setVideoTick(value => value + 1)} onSeeked={() => setVideoTick(value => value + 1)} />
                {snapGuides.x !== null && <span className="snap-guide vertical" style={{ left: `${snapGuides.x * 100}%` }} aria-hidden="true" />}
                {snapGuides.y !== null && <span className="snap-guide horizontal" style={{ top: `${snapGuides.y * 100}%` }} aria-hidden="true" />}
                {selectedScene && framingMode && canEdit && <div className="image-framing-overlay" onPointerDown={beginImagePan} title="Drag to choose the visible part of the image">
                  <span className="framing-grid" aria-hidden="true" />
                  <span className="framing-hint">Drag to reposition · adjust zoom and letterbox in the inspector</span>
                </div>}
                {selectedScene && selectedTextLayer && !selectedGlobalText && textBox?.hasText && selectedTextVisible && !selectedElement && canEdit && !editingText && !framingMode && <div
                  className="text-box"
                  style={{ left: `${textBox.leftPct}%`, top: `${Math.max(0, textBox.topPct - .7)}%`, width: `${textBox.widthPct}%`, height: `${Math.max(7, textBox.heightPct + 1.4)}%`, transform: `rotate(${textBox.rotation}deg)` }}
                  title="Drag to move · drag the edge handles to resize · double-click to edit"
                  onPointerDown={beginTextMove}
                  onDoubleClick={event => { event.stopPropagation(); setTextDraft({ title: selectedTextLayer.title, subtitle: selectedTextLayer.subtitle }); setEditingText(true); }}
                >
                  <span className="text-box-handle left" onPointerDown={event => beginTextResize(event, 'left')} />
                  <span className="text-box-handle right" onPointerDown={event => beginTextResize(event, 'right')} />
                  <span className="text-box-label">TEXT</span>
                </div>}
                {canEdit && !framingMode && !editingText && allOverlays.map((saved, index) => {
                  const draft = overlayDraft?.id === saved.id ? overlayDraft : saved;
                  const local = position - ticksToSeconds(draft.startTicks, project.timebase);
                  if (local < 0 || local >= ticksToSeconds(draft.durationTicks, project.timebase)) return null;
                  const element = draft;
                  const shown = element.keyframes?.length ? applyElementMotion(element, local) : element;
                  const motion = elementTransform(shown, local, project.timebase);
                  const selected = selectedElementId === element.id;
                  const rank = sceneLayerRank.get(element.legacySceneId ? `element:${element.legacyId}` : `overlay:${element.id}`) ?? index;
                  return <div key={element.id} role="button" tabIndex={0} aria-label={`Select overlay ${elementName(element)}`} aria-pressed={selected} className={`overlay-hitbox ${selected ? 'element-box' : ''}`} style={{ left: `${(shown.x + motion.x - shown.width / 2) * 100}%`, top: `${(shown.y + motion.y - shown.height / 2) * 100}%`, width: `${shown.width * 100}%`, height: `${shown.height * 100}%`, transform: `rotate(${shown.rotation + motion.rotation}deg) scale(${motion.scale})`, zIndex: (element.legacySceneId ? 4 : 100) + rank, pointerEvents: playing ? 'none' : undefined }} title={`Drag to move ${elementName(element)}`} onClick={event => { if (event.detail === 0) selectOverlay(element, false); }} onPointerDown={event => beginElementMove(event, element)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectOverlay(element, false); } }}>{selected && <span className="element-box-label">{element.kind === 'image' || element.kind === 'video' ? 'OVERLAY' : 'ELEMENT'}</span>}</div>;
                })}
                {editingText && selectedScene && selectedTextLayer && !selectedGlobalText && textBox?.hasText && <div
                  className="text-edit-overlay"
                  style={{ left: `${Math.min(textBox.leftPct, 56)}%`, top: `${Math.min(textBox.topPct, 42)}%`, width: 'min(340px, 74%)' }}
                >
                  <div className="text-edit-head"><span><Type size={12} /> Edit text</span><small>{selectedTextLayer.title ? 'Title and subtitle' : 'Add a title'}</small></div>
                  <label className="inline-edit-field"><span>Title</span><textarea aria-label="Edit title in preview" rows={2} maxLength={120} value={textDraft.title} onChange={event => previewInlineText({ ...textDraft, title: event.target.value })} onBlur={blurInlineText} onKeyDown={event => { if (event.key === 'Escape') cancelInlineText(); }} autoFocus /></label>
                  <label className="inline-edit-field"><span>Subtitle <em>optional</em></span><input aria-label="Edit subtitle in preview" maxLength={200} value={textDraft.subtitle} onChange={event => previewInlineText({ ...textDraft, subtitle: event.target.value })} onBlur={blurInlineText} onKeyDown={event => { if (event.key === 'Escape') cancelInlineText(); if (event.key === 'Enter') { event.preventDefault(); commitInlineText(); } }} /></label>
                  <div className="text-edit-actions"><button className="text-button" onClick={cancelInlineText}>Cancel</button><button className="button primary" onClick={commitInlineText}><Check size={13} /> Done</button></div>
                </div>}
                {fadeAmount > 0.001 && <div className="preview-fade" style={{ opacity: fadeAmount }} aria-hidden="true" />}
                {safeArea && <div className="safe-area-overlay" aria-hidden="true" />}
              </div> : <div className="empty-preview">
                <Film size={40} /><h2>Every story starts somewhere.</h2><p>Add a few photos. Make them your own.</p>
                <button className="button primary" disabled={!canEdit} onClick={() => void chooseImages()}><Plus size={16} /> Add your first images</button>
                <button className="text-button" disabled={!canEdit} onClick={() => chooseTemplate(SAMPLE_TEMPLATE)}>Or explore a sample story <ArrowRight size={14} /></button>
              </div>}
            </div>
            <div className="preview-scrub"><input aria-label="Preview playhead" title={`Preview playhead · ${shortcutText('timeline.prev_frame')} / ${shortcutText('timeline.next_frame')} to step frames`} type="range" min="0" max={Math.max(duration - frameSeconds, 0)} step={frameSeconds} value={position} disabled={!duration} onChange={e => scrubTo(Number(e.target.value))} /></div>
            <div className="preview-controls">
              <span className="timecode">{timecode(position, project.timebase)} <span>/ {timecode(duration, project.timebase)}</span></span>
              <div className="transport"><IconButton label="Return to start" onClick={() => { setPosition(0); setPlaying(false); }}><SkipBack size={17} /></IconButton><button className="play-button" disabled={!duration || !canEdit} title={tip('playback.toggle', playing ? 'Pause' : 'Play')} aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlayback}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button><IconButton className={loop ? 'active' : ''} label={loop ? 'Loop playback on' : 'Loop playback off'} onClick={() => setLoop(value => !value)}><Repeat size={16} /></IconButton></div>
              <span className="preview-quality">{([activeSize.width, activeSize.height] as [number, number]).join(' × ')} <Maximize2 size={13} /></span>
            </div>
          </main>

          <div className="splitter vertical" onPointerDown={e => beginResize('inspector', inspectorWidth, e.clientX)} />

          <aside className="inspector" aria-label="Selected item properties" style={{ width: inspectorWidth }}>
            <div className="inspector-heading"><Settings2 size={16} /><h2>{selectedPip ? 'Picture in picture' : ({scene: selectedScene?.mediaKind === 'video' ? 'Video properties' : 'Scene properties', text:'Text properties', element:'Element properties', audio:'Audio properties', none:'Properties'})[propertyKind]}</h2></div>
            {propertyKind === 'scene' && selectedCount > 1 && <div className="multi-select-banner"><span><Layers size={13} /> Editing {selectedCount} clips</span><button className="text-button" onClick={() => { if(selectedScene){setSelectedIds([selectedScene.id]);setPrimarySelected(selectedScene.id);selectionAnchor.current=selectedScene.id;} }}>Edit only this clip</button></div>}
            {selectedPip && activePip && activePip.pip ? <fieldset disabled={!canEdit} className="inspector-fields">
              <div className="inspector-item-actions"><strong>{activePip.name}</strong><button className="icon-button danger" aria-label="Delete picture in picture" onClick={() => removePip(activePip.id)}><Trash2 size={15} /></button></div>
              <p className="note">Its own visual track over the base story. It never extends the timeline and its own audio is muted.</p>
              <label className="music-control"><span>Start <b>{ticksToSeconds(activePip.startTicks, project.timebase).toFixed(1)} s</b></span><input aria-label="Picture-in-picture start" type="range" min={0} max={Math.max(0, ticksToSeconds(projectTicks - activePip.durationTicks, project.timebase))} step={secondsPerTick(project.timebase)} value={ticksToSeconds(activePip.startTicks, project.timebase)} onChange={event => { const desired = secondsToTicks(Number(event.target.value), project.timebase); const start = freePipStart(pipScenes, desired, activePip.durationTicks, projectTicks); if (start !== null) stagePip({ startTicks: start }); }} onPointerUp={commitPip} onKeyUp={commitPip} onBlur={commitPip} /></label>
              <label className="music-control"><span>Duration <b>{ticksToSeconds(activePip.durationTicks, project.timebase).toFixed(1)} s</b></span><input aria-label="Picture-in-picture duration" type="range" min={Math.max(secondsPerTick(project.timebase), ticksToSeconds(minTicks(project.timebase), project.timebase))} max={Math.max(secondsPerTick(project.timebase), Math.min(ticksToSeconds(projectTicks - activePip.startTicks, project.timebase), activePip.sourceDurationSeconds ?? 600))} step={secondsPerTick(project.timebase)} value={ticksToSeconds(activePip.durationTicks, project.timebase)} onChange={event => { const wanted = secondsToTicks(Number(event.target.value), project.timebase); stagePip(constrainPipTiming(activePip, 'end', wanted - activePip.durationTicks, pipScenes, projectTicks, project.timebase, minTicks(project.timebase))); }} onPointerUp={commitPip} onKeyUp={commitPip} onBlur={commitPip} /></label>
              <label className="music-control"><span>Width <b>{Math.round(activePip.pip.width * 100)}%</b></span><input aria-label="Picture-in-picture width" type="range" min={5} max={100} step={1} value={Math.round(activePip.pip.width * 100)} onChange={event => stagePipStyle('width', Number(event.target.value) / 100)} onPointerUp={commitPip} onKeyUp={commitPip} onBlur={commitPip} /></label>
              <label className="music-control"><span>Height <b>{Math.round(activePip.pip.height * 100)}%</b></span><input aria-label="Picture-in-picture height" type="range" min={5} max={100} step={1} value={Math.round(activePip.pip.height * 100)} onChange={event => stagePipStyle('height', Number(event.target.value) / 100)} onPointerUp={commitPip} onKeyUp={commitPip} onBlur={commitPip} /></label>
              <label className="music-control"><span>Horizontal <b>{Math.round(activePip.pip.x * 100)}%</b></span><input aria-label="Picture-in-picture horizontal" type="range" min={0} max={100} step={1} value={Math.round(activePip.pip.x * 100)} onChange={event => stagePipStyle('x', Number(event.target.value) / 100)} onPointerUp={commitPip} onKeyUp={commitPip} onBlur={commitPip} /></label>
              <label className="music-control"><span>Vertical <b>{Math.round(activePip.pip.y * 100)}%</b></span><input aria-label="Picture-in-picture vertical" type="range" min={0} max={100} step={1} value={Math.round(activePip.pip.y * 100)} onChange={event => stagePipStyle('y', Number(event.target.value) / 100)} onPointerUp={commitPip} onKeyUp={commitPip} onBlur={commitPip} /></label>
              <label className="music-control"><span>Corner radius <b>{Math.round(activePip.pip.radius * 100)}%</b></span><input aria-label="Picture-in-picture corner radius" type="range" min={0} max={50} step={1} value={Math.round(activePip.pip.radius * 100)} onChange={event => stagePipStyle('radius', Number(event.target.value) / 100)} onPointerUp={commitPip} onKeyUp={commitPip} onBlur={commitPip} /></label>
              <label className="music-control"><span>Shadow <b>{Math.round(activePip.pip.shadow)}%</b></span><input aria-label="Picture-in-picture shadow" type="range" min={0} max={100} step={1} value={Math.round(activePip.pip.shadow)} onChange={event => stagePipStyle('shadow', Number(event.target.value))} onPointerUp={commitPip} onKeyUp={commitPip} onBlur={commitPip} /></label>
              <label className="field">Fill<select aria-label="Picture-in-picture fill" value={activePip.fit} onChange={event => { stagePip({ fit: event.target.value as Scene['fit'] }); window.setTimeout(commitPip, 0); }}><option value="cover">Fill frame</option><option value="contain">Fit whole image</option><option value="blur">Blur fill</option></select></label>
            </fieldset> : propertyKind === 'audio' && selectedAudio ? <fieldset disabled={!canEdit} className="inspector-fields"><div className="inspector-item-actions"><strong>{selectedAudio.name}</strong><button className="icon-button danger" aria-label="Delete selected audio" onClick={() => removeAudio(selectedAudio.id)}><Trash2 size={15} /></button></div>{audioInspector}</fieldset> : propertyKind === 'element' ? <fieldset disabled={!canEdit} className="inspector-fields">{elementInspector}</fieldset> : (propertyKind === 'scene' || propertyKind === 'text') && selectedScene ? <fieldset disabled={!canEdit} className="inspector-fields">
              <SceneForm mode={propertyKind === 'text' ? 'text' : 'scene'} hasNextScene={Boolean(selectedScene && scenes.findIndex(scene => scene.id === selectedScene.id) < scenes.length - 1)} scene={selectedGlobalText && selectedTextScene ? selectedTextScene : inspectorScene!} timebase={project.timebase} update={updateSelection} onPreview={selectedGlobalText ? (next: Scene | null) => setGlobalTextDraft(next?.textLayers ?? null) : setPreviewScene} onCopyProperties={copySceneProperties} propertyClipboard={propertyClipboard} onPasteProperties={notifyPasted} flushRef={inspectorFlush} onReplaceImage={selectedCount === 1 && !selectedGlobalText ? () => requestReplaceImage() : undefined} textLayerId={selectedGlobalText ? selectedGlobalText.id : selectedTextLayerId} onSelectTextLayer={selectTextLayer} textStartTicks={textStartTicks} playheadSeconds={selectedGlobalText ? Math.max(0, textLayerLocal) : previewLocalSeconds} focusText={textFocus} framingActive={framingMode} onToggleFraming={() => { setFramingMode(value => !value); setEditingText(false); }} formatName={activeFormat?.name ?? 'Original'} formatCount={project.formats.length} onApplyFramingToAll={applyFramingToAllFormats} overlays={renderOverlays} onReorderLayer={reorderLayer} />
              {propertyKind === 'text' && <div className="inspector-item-actions"><button className="button danger" aria-label="Delete selected text layer" onClick={deleteSelected}><Trash2 size={14} /> Delete text layer</button></div>}
              {propertyKind === 'scene' && hasSceneSelection && <div className="scene-actions compact-scene-actions"><IconButton label={tip('clip.duplicate', 'Duplicate clip')} onClick={duplicateSelected}><Copy size={16} /></IconButton><IconButton label={tip('clip.delete', 'Delete selected scene')} onClick={deleteSelected}><Trash2 size={16} /></IconButton></div>}
            </fieldset> : <div className="inspector-empty"><Settings2 size={26} /><p>Select a scene, text layer, element or audio clip to edit its properties.</p></div>}

          </aside>
        </div>

        <div className="splitter horizontal" onPointerDown={e => beginResize('timeline', timelineHeight, e.clientY)} />

        <section className="timeline" aria-label="Timeline" aria-describedby="timeline-help" style={{ height: timelineHeight }}>
          <p className="sr-only" id="timeline-help">J and L play backwards and forwards, K stops, the arrow keys step one frame, and Space plays or pauses. Scene, text and audio clips are buttons: Enter selects one, and the commands in the Help dialog act on the selection.</p>
          <div className="timeline-toolbar">
            <div><span className="timeline-heading">Your story</span><span className="tiny-label">{scenes.length} scenes</span></div>
            <div className="timeline-tools"><IconButton label={selectedCount > 1 ? 'Select one clip to reorder' : 'Move selected scene earlier'} disabled={!selectedScene || selectedCount !== 1 || !canEdit || scenes[0]?.id === selectedScene.id} onClick={() => selectedCount === 1 && selectedScene && void run({ type: 'move', id: selectedScene.id, offset: -1 })}><ArrowLeft size={16} /></IconButton><IconButton label={selectedCount > 1 ? 'Select one clip to reorder' : 'Move selected scene later'} disabled={!selectedScene || selectedCount !== 1 || !canEdit || scenes.at(-1)?.id === selectedScene.id} onClick={() => selectedCount === 1 && selectedScene && void run({ type: 'move', id: selectedScene.id, offset: 1 })}><ArrowRight size={16} /></IconButton><IconButton className={snapping ? 'active' : ''} label={tip('timeline.snapping', `Snapping ${snapping ? 'on' : 'off'}`)} onClick={() => runCommandId('timeline.snapping')}><Magnet size={16} /></IconButton><IconButton label="Add beat at playhead" onClick={addBeatAtPlayhead}><AudioLines size={16} /></IconButton><span className="header-divider" /><div className="timeline-zoom" role="group" aria-label="Timeline zoom"><IconButton label="Zoom out timeline" disabled={timelineZoom <= .5} onClick={() => changeTimelineZoom(timelineZoom - .5)}><ZoomOut size={15} /></IconButton><input aria-label="Timeline zoom" type="range" min=".5" max="6" step=".25" value={timelineZoom} onChange={event => changeTimelineZoom(Number(event.target.value))} /><button className="timeline-zoom-label" title="Fit timeline" onClick={() => changeTimelineZoom(1)}>{Math.round(timelineZoom * 100)}%</button><IconButton label="Zoom in timeline" disabled={timelineZoom >= 6} onClick={() => changeTimelineZoom(timelineZoom + .5)}><ZoomIn size={15} /></IconButton></div><span className="header-divider" /><span className="timeline-total"><Clock3 size={14} />{duration.toFixed(1)}s</span></div>
          </div>
          {fileDragActive && <div className="file-drop-hint" role="status">Drop an image or video on a scene to replace it · or drop it in the media panel</div>}
          <div className="timeline-content" ref={timelineScroll}>
            <div className="timeline-inner" style={{ width: `${timelineZoom * 100}%` }}>
            {duration > 0 && <div className="timeline-playhead" style={{ left: `calc(${timelineRatio * 100}% + ${148 - timelineRatio * 198}px)` }} title="Drag playhead" onPointerDown={beginPlayheadDrag}><span className="timeline-playhead-handle" /></div>}
            {(project.beatTicks ?? []).map(tick => { const ratio = tick / Math.max(1, projectTicks); const seconds = ticksToSeconds(tick, project.timebase); return <button key={tick} className="beat-marker" style={{ left: `calc(${ratio * 100}% + ${148 - ratio * 198}px)` }} title={`Remove beat at ${seconds.toFixed(2)} s`} aria-label={`Remove beat at ${seconds.toFixed(2)} seconds`} disabled={!canEdit} onClick={() => removeBeat(tick)} />; })}
            <div className="timeline-sticky">
              <div className="timeline-ruler-row"><span>00:00</span><span>YOUR TIMELINE · {activeSize.width} × {activeSize.height}</span><span>{timecode(duration, project.timebase)}</span></div>
              <div className="timeline-scrub-row"><input className="scrubber" aria-label="Timeline playhead" type="range" min="0" max={Math.max(duration - frameSeconds, 0)} step={frameSeconds} value={position} disabled={!duration} onChange={e => scrubTo(Number(e.target.value))} /></div>
            </div>
            <div className="timeline-row text-row" role="group" aria-label="Text track">
              <div className="track-label"><Type size={14} /><span>Text</span><span className="track-number">{String(hasMediaOverlays ? 4 : 3).padStart(2, '0')}</span></div>
              <div className="tracks"><div className="text-track">{scenes.map(scene => {
                const layers = sceneTextLayers(scene);
                const laneEnds: number[] = [];
                const laneOf = layers.map(layer => {
                  let lane = laneEnds.findIndex(end => end <= layer.startTicks);
                  if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
                  laneEnds[lane] = layer.startTicks + layer.durationTicks;
                  return lane;
                });
                const lanes = Math.max(1, laneEnds.length);
                return <div key={scene.id} className="text-scene" style={{ flexGrow: scene.durationTicks, height: `${Math.max(26, lanes * 17 + 5)}px` }}>
                  {!layers.length && <button className={`text-clip empty ${isSelected(scene.id) ? 'selected' : ''}`} aria-label={`Add text to ${scene.name}`} onClick={event => { selectScene(scene, event); setTab('text'); setTextFocus(value => value + 1); }} title="Add text to this scene"><span className="text-clip-inner"><Type size={10} /><span>Add text</span></span></button>}
                  {layers.map((layer, index) => {
                    const left = Math.max(0, Math.min(100, layer.startTicks / Math.max(1, scene.durationTicks) * 100));
                    const width = Math.max(3, Math.min(100 - left, layer.durationTicks / Math.max(1, scene.durationTicks) * 100));
                    const active = selectedScene?.id === scene.id && selectedTextLayer?.id === layer.id;
                    return <button key={layer.id} aria-label={`Text layer ${index + 1} in ${scene.name}: ${layer.title || 'untitled'}, ${ticksToSeconds(layer.startTicks, project.timebase).toFixed(2)} to ${ticksToSeconds(layer.startTicks + layer.durationTicks, project.timebase).toFixed(2)} seconds`} aria-pressed={active} className={`text-clip layer ${active ? 'selected' : ''} ${isSelected(scene.id) ? 'scene-selected' : ''}`} style={{ left: `${left}%`, width: `${width}%`, top: `${laneOf[index] * 17 + 3}px` }} onClick={event => { event.stopPropagation(); selectScene(scene, event); setEditTarget('text'); setSelectedElementId(null); setSelectedTextLayerId(layer.id); setPosition(ticksToSeconds(scene.startTicks + layer.startTicks, project.timebase)); setTab('text'); setTextFocus(value => value + 1); }} title={`${layer.title || layer.subtitle || 'Text layer'} · ${ticksToSeconds(layer.startTicks, project.timebase).toFixed(1)}–${ticksToSeconds(layer.startTicks + layer.durationTicks, project.timebase).toFixed(1)} s`}><span className="text-clip-inner"><Type size={9} /><span>{layer.title || layer.subtitle || 'Text layer'}</span></span></button>;
                  })}
                </div>;
              })}</div></div>
              <div className="timeline-add-slot"><button className="add-clip text-add" aria-label="Add text layer at playhead" disabled={!canEdit || !selectedScene} onClick={() => addTextLayerAtPlayhead()}><Plus size={16} /></button></div>
            </div>
            {[{ label: 'Overlays', media: true, items: allOverlays.filter(e => e.kind === 'image' || e.kind === 'video') }, { label: 'Elements', media: false, items: allOverlays.filter(e => e.kind !== 'image' && e.kind !== 'video') }].filter(group => !group.media || group.items.length > 0).map(group => <div key={group.label} className={`timeline-row ${group.media ? 'media-overlay-row' : 'element-row'}`} role="group" aria-label={`${group.label} track`}>
              <div className="track-label">{group.media ? <Layers size={14} /> : <Shapes size={14} />}<span>{group.label}</span><span className="track-number">{String(group.media ? 2 : hasMediaOverlays ? 3 : 2).padStart(2, '0')}</span></div>
              <div className="tracks"><div className="element-track overlay-track" style={{ height: Math.max(34, group.items.length * 29 + 8), position: 'relative' }}>{group.items.map((saved, index) => {
                const element = overlayDraft?.id === saved.id ? overlayDraft : saved;
                return <button key={element.id} className={`element-clip ${selectedElementId === element.id ? 'selected' : ''}`} style={{ left: `${element.startTicks / Math.max(1, projectTicks) * 100}%`, width: `${element.durationTicks / Math.max(1, projectTicks) * 100}%`, top: index * 29 + 4 }} aria-label={`Select ${group.media ? 'overlay' : 'element'} ${elementName(element)}`} aria-pressed={selectedElementId === element.id} onClick={event => { if (event.detail === 0) selectOverlay(element); }} onPointerDown={event => beginOverlayTiming(event, element, 'move')} title={`${elementName(element)} · ${ticksToSeconds(element.startTicks, project.timebase).toFixed(1)}–${ticksToSeconds(element.startTicks + element.durationTicks, project.timebase).toFixed(1)} s`}>
                  <span className="overlay-trim start" onPointerDown={event => beginOverlayTiming(event, element, 'start')} aria-label="Trim overlay start" />
                  {element.poster || element.kind === 'image' ? <AssetImage className="overlay-thumb" source={element.poster ?? element.source} alt="" fallback={<span className="overlay-thumb missing" />} /> : <ElementGlyph presetId={element.presetId} kind={element.kind} size={12} />}<span>{elementName(element)}</span>{element.action && <span className="overlay-action-region" style={{ left: `${element.action.startTicks / element.durationTicks * 100}%`, width: `${element.action.durationTicks / element.durationTicks * 100}%` }} title={`${element.action.kind}${element.action.sound ? ' + sound' : ''}`} />}
                  <span className="overlay-trim end" onPointerDown={event => beginOverlayTiming(event, element, 'end')} aria-label="Trim overlay end" />
                </button>;
              })}</div></div>
              <div className="timeline-add-slot"><button className="add-clip" aria-label="Add element" disabled={!canEdit || !selectedScene} onClick={() => setTab('elements')}><Plus size={16} /></button></div>
            </div>)}
            <div className="timeline-row video-row" role="group" aria-label="Visuals track">
              <div className="track-label"><Film size={14} /><span>Visuals</span><span className="track-number">01</span></div>
              <div className="tracks"><div className="scene-track">{scenes.map((scene, i) => {
                const display = previewScene?.id === scene.id ? previewScene : scene;
                const displayDuration = sceneSeconds(display, project.timebase);
                const fadeIn = Math.min(displayDuration, Math.max(0, display.fadeIn ?? 0));
                const fadeOut = Math.min(displayDuration, Math.max(0, display.fadeOut ?? 0));
                return <button key={scene.id} draggable={canEdit} aria-label={`Scene ${i + 1}: ${scene.name}, ${ticksToSeconds(scene.startTicks, project.timebase).toFixed(2)} to ${ticksToSeconds(scene.startTicks + scene.durationTicks, project.timebase).toFixed(2)} seconds${scene.mediaKind === 'video' ? ', video' : ''}`} aria-pressed={isSelected(scene.id)} aria-current={active?.id === scene.id ? 'true' : undefined} className={`timeline-clip ${isSelected(scene.id) ? 'selected' : ''} ${selectedScene?.id === scene.id ? 'primary' : ''} ${active?.id === scene.id ? 'current' : ''} ${dropTarget === scene.id ? 'drop-target' : ''} ${reorderId === scene.id ? 'dragging' : ''} ${replacingSceneId === scene.id ? 'replacing' : ''}`} aria-busy={replacingSceneId === scene.id} style={{ flexGrow: scene.durationTicks }} onClick={event => selectScene(scene, event)} onDragStart={event => beginReorder(event, scene)} onDragEnd={endReorder} onDragOver={event => dragOverScene(event, scene.id)} onDragLeave={() => setDropTarget(current => current === scene.id ? null : current)} onDrop={event => dropScene(event, scene)} onContextMenu={event => { event.preventDefault(); if (!selectedIds.includes(scene.id)) { setSelectedIds([scene.id]); setPrimarySelected(scene.id); selectionAnchor.current = scene.id; } setPlaying(false); setContextMenu({ x: event.clientX, y: event.clientY }); }}>
                  <ClipFilmstrip className="timeline-filmstrip" source={scene.mediaKind === 'video' ? (scene.videoPoster ?? scene.image) : scene.image} />
                  <div><span>{String(i + 1).padStart(2, '0')} <b>{scene.name}</b></span><small>{sceneSeconds(scene, project.timebase).toFixed(1)}s</small></div>
                  {scene.mediaKind === 'video' && <span className="clip-media-badge"><Film size={9} /> VIDEO</span>}
                  {scene.transition && <span className="clip-transition" title={`${TRANSITION_OPTIONS.find(option => option.id === scene.transition?.type)?.label ?? 'Transition'} · ${scene.transition.duration.toFixed(1)} s`}><Sparkles size={9} />{scene.transition.duration.toFixed(1)}s</span>}
                  <span className="fade-shade in" style={{ width: `${(fadeIn / displayDuration) * 100}%` }} aria-hidden="true" />
                  <span className="fade-shade out" style={{ width: `${(fadeOut / displayDuration) * 100}%` }} aria-hidden="true" />
                  <span className="fade-handle in" style={{ left: `calc(${Math.min((fadeIn / displayDuration) * 100, 96)}% + 3px)` }} title={`Fade in ${fadeIn.toFixed(1)} s — drag to adjust`} aria-hidden="true" onPointerDown={event => beginFadeDrag(event, scene, 'in')} onClick={event => event.stopPropagation()} />
                  <span className="fade-handle out" style={{ right: `calc(${Math.min((fadeOut / displayDuration) * 100, 96)}% + 3px)` }} title={`Fade out ${fadeOut.toFixed(1)} s — drag to adjust`} aria-hidden="true" onPointerDown={event => beginFadeDrag(event, scene, 'out')} onClick={event => event.stopPropagation()} />
                  <span className="clip-trim left" title={`Trim the start · ${ticksToSeconds(scene.sourceInTicks ?? 0, project.timebase).toFixed(1)} s in`} aria-hidden="true" onPointerDown={event => beginSceneTrim(event, scene, 'left')} onClick={event => event.stopPropagation()} />
                  <span className="clip-trim right" title={`Trim the end · ${sceneSeconds(scene, project.timebase).toFixed(1)} s`} aria-hidden="true" onPointerDown={event => beginSceneTrim(event, scene, 'right')} onClick={event => event.stopPropagation()} />
                  {fadeDrag?.sceneId === scene.id && <span className="fade-drag-label" aria-hidden="true">{fadeDrag.side === 'in' ? 'Fade in' : 'Fade out'} {fadeDrag.value.toFixed(1)} s</span>}
                </button>;
              })}</div></div><div className="timeline-add-slot"><button className="add-clip" aria-label="Add images to timeline" disabled={!canEdit} onClick={() => void chooseImages()}><Plus size={20} /></button></div>
            </div>
            <div className="timeline-row pip-row" role="group" aria-label="Picture in picture track">
              <div className="track-label"><Layers size={14} /><span>Picture in picture</span><span className="track-number">02</span></div>
              <div className="tracks"><div className="pip-track element-track overlay-track" style={{ height: 38, position: 'relative' }}>
                {renderPipScenes.map(clip => <button key={clip.id} className={`element-clip ${selectedPipId === clip.id ? 'selected' : ''}`} style={{ left: `${clip.startTicks / Math.max(1, projectTicks) * 100}%`, width: `${clip.durationTicks / Math.max(1, projectTicks) * 100}%`, top: 4 }} aria-label={`Picture in picture ${clip.name}, ${ticksToSeconds(clip.startTicks, project.timebase).toFixed(2)} to ${ticksToSeconds(clip.startTicks + clip.durationTicks, project.timebase).toFixed(2)} seconds`} aria-pressed={selectedPipId === clip.id} onClick={() => selectPip(clip)} onPointerDown={event => beginPipTiming(event, clip, 'move')} title={`${clip.name} · drag to move, drag the edges to trim`}>
                  <span className="overlay-trim start" onPointerDown={event => beginPipTiming(event, clip, 'start')} aria-label="Trim picture-in-picture start" />
                  <AssetImage className="overlay-thumb" source={clip.videoPoster ?? clip.image} alt="" fallback={<span className="overlay-thumb missing" />} />
                  <span>{clip.name}</span>
                  <span className="overlay-trim end" onPointerDown={event => beginPipTiming(event, clip, 'end')} aria-label="Trim picture-in-picture end" />
                </button>)}
                {!renderPipScenes.length && <span className="audio-empty">Pick a media tile → Picture in picture</span>}
              </div></div>
              <div className="timeline-add-slot"><button className="add-clip" aria-label="Add picture in picture" disabled={!canEdit} onClick={() => setTab('media')}><Plus size={16} /></button></div>
            </div>
            {audioLanes.map((lane, laneIndex) => <div className="timeline-row audio-row" role="group" aria-label={`Audio track ${laneIndex + 1}`} key={lane}>
              <div className="track-label"><Music size={14} /><span>Audio {laneIndex + 1}</span><span className="track-number">{String((hasMediaOverlays ? 5 : 4) + laneIndex).padStart(2, '0')}</span></div>
              <div className="tracks"><div className="audio-track">
                {audio.filter(clip => (clip.lane ?? 0) === lane).map(clip => {
                  const left = projectTicks ? (clip.startTicks / projectTicks) * 100 : 0;
                  const width = projectTicks ? (clip.durationTicks / projectTicks) * 100 : 0;
                  return <button
                    key={clip.id}
                    className={`audio-clip ${selectedAudio?.id === clip.id ? 'selected' : ''}`}
                    aria-label={`Audio clip ${clip.name}, ${ticksToSeconds(clip.startTicks, project.timebase).toFixed(2)} to ${ticksToSeconds(clip.startTicks + clip.durationTicks, project.timebase).toFixed(2)} seconds`}
                    aria-pressed={selectedAudio?.id === clip.id}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${clip.name} · drag to move · drag edges to trim`}
                    onClick={() => focusAudio(clip)}
                    onPointerDown={event => beginAudioMove(event, clip)}
                  >
                    <span className="audio-trim left" title="Drag to trim the start" onPointerDown={event => beginAudioTrim(event, clip, 'left')} />
                    <Waveform
                      clipId={clip.id}
                      data={clip.data}
                      sourceInSeconds={clip.sourceInSeconds}
                      durationSeconds={ticksToSeconds(clip.durationTicks, project.timebase)}
                      sourceDurationSeconds={clip.sourceDurationSeconds}
                    />
                    <Music size={10} /><span className="audio-name">{clip.name}</span><small>{Math.round(clip.volume * 100)}%</small>
                    <span className="audio-trim right" title="Drag to trim the end" onPointerDown={event => beginAudioTrim(event, clip, 'right')} />
                  </button>;
                })}
                {!audio.some(clip => (clip.lane ?? 0) === lane) && <span className="audio-empty">Empty audio track</span>}
              </div></div>
              <div className="timeline-add-slot"><button className="add-clip audio-add" aria-label={`Add audio to track ${laneIndex + 1}`} disabled={!canEdit || !projectTicks} onClick={() => { audioLaneRef.current = lane; void chooseAudio(); }}><Plus size={16} /></button></div>
            </div>)}
            {audio.length > 0 && <div className="timeline-row audio-add-track-row">
              <div className="track-label"><Music size={14} /><span>More audio</span></div>
              <div className="tracks"><button className="add-audio-track" disabled={!canEdit || !projectTicks || audioLanes.length >= 8} onClick={() => { audioLaneRef.current = Math.max(0, ...audio.map(clip => clip.lane ?? 0)) + 1; void chooseAudio(); }}><Plus size={13} /> Add another audio track</button></div>
              <div className="timeline-add-slot" />
            </div>}
            </div>
          </div>
          <footer className="editor-footer"><span><span className="status-dot" />Local photo movie editor <span className="footer-separator">/</span> Originals never modified</span><span><kbd>{shortcutText('playback.toggle')}</kbd> to play <span className="footer-separator">·</span> {snapping ? 'Snap on' : 'Snap off'} <span className="footer-separator">·</span> {frameRate(project.timebase).toFixed(0)} FPS</span></footer>
        </section>
      </>}

      {contextMenu && <div
        className="clip-context-menu"
        style={{ left: Math.max(10, Math.min(contextMenu.x, window.innerWidth - 252)), top: Math.max(10, Math.min(contextMenu.y, window.innerHeight - 232)) }}
        role="menu"
        aria-label="Clip actions"
      >
        <span className="context-menu-heading">Clip actions</span>
        <button role="menuitem" disabled={!canEdit || selectedCount !== 1} title={selectedCount === 1 ? 'Replace this scene photo or video and keep its timing, text, and looks' : 'Select one clip to replace its media'} onClick={() => { setContextMenu(null); requestReplaceImage(selectedScene?.id); }}><RefreshCw size={14} /><span>Replace media…</span><kbd>—</kbd></button>
        <span className="context-menu-divider" aria-hidden="true" />
        {[
          { id: 'clip.split', label: 'Split at playhead', icon: <Scissors size={14} /> },
          { id: 'clip.duplicate', label: selectedCount > 1 ? `Duplicate ${selectedCount} clips` : 'Duplicate clip', icon: <Copy size={14} /> },
          { id: 'clip.ripple_delete', label: selectedCount > 1 ? `Ripple delete ${selectedCount} clips` : 'Ripple delete', icon: <Trash2 size={14} /> },
          { id: 'clip.delete', label: selectedCount > 1 ? `Delete ${selectedCount} clips` : 'Delete clip', icon: <Trash2 size={14} /> },
        ].map(action => {
          const state = availabilityFor(action.id);
          return <button
            key={action.id}
            role="menuitem"
            disabled={state.disabled}
            title={state.disabled ? state.reason : tip(action.id, action.label)}
            onClick={() => { runCommandId(action.id); setContextMenu(null); }}
          >
            {action.icon}<span>{action.label}{state.disabled && state.reason ? <small className="context-reason">{state.reason}</small> : null}</span><kbd>{shortcutText(action.id)}</kbd>
          </button>;
        })}
      </div>}

      {notice && <div className="toast" role="status"><Check size={17} /><span>{notice}</span><IconButton label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></IconButton></div>}
      {error && <div className="error-banner" role="alert">
        <span className="error-badge"><AlertTriangle size={16} /></span>
        <span className="error-copy"><strong>{errorTitle(error)}</strong><span>{error}</span></span>
        <IconButton label="Dismiss error" onClick={() => setError('')}><X size={16} /></IconButton>
      </div>}

      {exporting && <aside className="export-job" aria-label="Background export"><div><strong>Exporting {exportJob.name}</strong><button className="text-button" onClick={cancelExport} disabled={cancellingExport}>{cancellingExport ? 'Cancelling…' : 'Cancel'}</button></div><span>{exportJob.phase} · {Math.round(exportProgress)}%</span><progress max="100" value={exportProgress} /><span>{exportEta(exportElapsed, exportProgress)}</span><small>You can keep editing. This export uses the version captured when you started.</small></aside>}
      {modal && <div className="modal-backdrop"><section className={`modal ${modal === 'export' ? 'export-studio' : modal === 'new' ? 'project-setup' : wideModal ? 'wide' : mediumModal ? 'medium' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header"><span className="eyebrow">{modalEyebrow}</span><IconButton label="Close dialog" onClick={requestCloseModal}><X size={20} /></IconButton></div>
        {modal === 'source' && sourcePreview ? <>
          <h2 id="modal-title">{sourcePreview.name}</h2>
          <div className="source-preview">
            {sourcePreview.mediaKind === 'video' ? <video
              key={sourcePreview.id}
              ref={previewVideo}
              src={sourcePreviewUrl}
              controls={false}
              playsInline
              autoPlay
              muted={previewMuted}
              onLoadedMetadata={event => setPreviewVideoDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
              onTimeUpdate={event => setPreviewVideoTime(event.currentTarget.currentTime)}
              onPlay={() => setPreviewVideoPlaying(true)}
              onPause={() => setPreviewVideoPlaying(false)}
              onEnded={() => setPreviewVideoPlaying(false)}
            /> : <AssetImage source={sourcePreview.image} alt={sourcePreview.name} fallback={<div className="source-missing"><ImagePlus size={28} /><strong>This file is missing.</strong><span>Relink the project’s media before adding it again.</span></div>} />}
            {previewList.length > 1 && <>
              <button className="source-nav previous" aria-label="Previous media" title="Previous media (←)" onClick={() => switchPreview(-1)}><ChevronLeft size={22} /></button>
              <button className="source-nav next" aria-label="Next media" title="Next media (→)" onClick={() => switchPreview(1)}><ChevronRight size={22} /></button>
              <span className="source-counter" aria-live="polite">{Math.max(0, previewIndex) + 1} / {previewList.length}</span>
            </>}
          </div>
          {sourcePreview.mediaKind === 'video' && hasMedia(sourcePreview.image) && <div className="source-controls">
            <button className="source-play-button" aria-label={previewVideoPlaying ? 'Pause preview' : 'Play preview'} onClick={togglePreviewPlayback}>{previewVideoPlaying ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}</button>
            <span className="source-time">{previewClock(previewVideoTime)} / {previewClock(previewVideoDuration || sourcePreview.sourceDurationSeconds || 0)}</span>
            <input className="source-seek" aria-label="Preview position" type="range" min="0" max={Math.max(.01, previewVideoDuration || sourcePreview.sourceDurationSeconds || 0)} step=".01" value={Math.min(previewVideoTime, previewVideoDuration || sourcePreview.sourceDurationSeconds || 0)} onChange={event => seekPreview(Number(event.target.value))} />
            <button className="source-mute" aria-label={previewMuted ? 'Unmute preview' : 'Mute preview'} onClick={togglePreviewMute}>{previewMuted || previewVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
            <input className="source-volume" aria-label="Preview volume" type="range" min="0" max="1" step=".01" value={previewVolume} onChange={event => changePreviewVolume(Number(event.target.value))} />
            <span className="source-volume-label">{Math.round(previewVolume * 100)}%</span>
          </div>}
          <div className="source-preview-actions"><button className="button primary" disabled={!hasMedia(sourcePreview.image)} onClick={() => void appendMedia(sourcePreview)}><Plus size={15} /> Append to timeline</button><button className="button" disabled={!selectedScene || !hasMedia(sourcePreview.image)} onClick={() => void addMediaPip(sourcePreview).catch(error => setError(messageFor(error)))}><Layers size={15} /> Picture in picture</button><span className="source-keyboard-hint">{sourcePreview.mediaKind === 'video' ? '← → switch · Space play · ↑ ↓ volume' : '← → switch media'}</span></div>
        </> : modal === 'templates' ? <>
          <h2 id="modal-title">Start from a story.</h2><p>Photo stories, one animated video opener, and local music — all bundled and ready offline. {projects.length ? 'Your current project is saved before a template opens.' : ''}</p>
          <label className="shortcut-search template-search"><Search size={15} /><input aria-label="Search templates" placeholder="Search templates…" value={templateQuery} onChange={e => setTemplateQuery(e.target.value)} /></label>
          <div className="template-categories" role="tablist" aria-label="Template categories">{['All', ...TEMPLATE_CATEGORIES].map(category => <button key={category} role="tab" aria-selected={templateCategory === category} className={templateCategory === category ? 'active' : ''} onClick={() => setTemplateCategory(category as typeof templateCategory)}>{category}</button>)}</div>
          {templateMatches.length ? <div className="template-grid">{templateMatches.map(template => <button key={template.id} className="template-card" disabled={!canEdit} onClick={() => chooseTemplate(template)}>
            <div className="template-preview"><span className="template-frame">
              <img src={templateImage(template)} alt="" />
              <span className="template-frame-title" aria-hidden="true" style={{
                left: `${(template.x ?? .08) * 100}%`, top: `${(template.y ?? .6) * 100}%`, width: `${(template.width ?? .8) * 100}%`,
                fontFamily: fontOption(template.font).family, fontWeight: clampWeight(template.weight ?? 600, template.font),
                fontStyle: template.italic ? 'italic' : 'normal', fontSize: `calc(${(template.size ?? .1) * 100}cqh)`,
                lineHeight: template.lineHeight ?? 1.04, letterSpacing: `${(template.letterSpacing ?? 0) * 100}cqw`, textAlign: template.align ?? 'left',
              }}>{template.titles[0]}</span>
            </span><span className="template-aspect">{template.aspect}</span></div>
            <div className="template-body">
              <strong>{template.name}</strong>
              <span>{template.description}</span>
              <small>{template.sceneCount} scenes · {template.duration.toFixed(1)} s · {template.category}</small>
              <span className="template-badges">{template.video && <span className="template-badge video">VIDEO</span>}{template.audio && <span className="template-badge music">MUSIC</span>}</span>
              <span className="button primary">Use template <ArrowRight size={15} /></span>
            </div>
          </button>)}</div> : <div className="shortcut-empty"><Search size={24} /><strong>No templates match “{templateQuery}”.</strong><span>Try Nature, Travel, People or Food.</span></div>}
          <details className="template-credits">
            <summary>Media credits</summary>
            <p>Every template photo ships with the app as a CC0 (public-domain) image, mostly Unsplash photographs archived on Wikimedia Commons. Template music and the motion background are generated for PixCut and released CC0. Nothing is downloaded while you edit.</p>
            <ul>{Object.values(TEMPLATE_PHOTOS).sort((a, b) => a.author.localeCompare(b.author)).map(photo => <li key={photo.file}><span>{photo.title}</span>{photo.author}</li>)}</ul>
          </details>
        </> : modal === 'new' ? <>
          {pendingTemplate ? <>
            <h2 id="modal-title">Start with {pendingTemplate.name}?</h2>
            <p>Your current story is already saved in the local library. This template opens as a new project with {pendingTemplate.sceneCount} editable scenes.</p>
            <div className="template-confirm">
              <span className="template-confirm-art"><img src={templateImage(pendingTemplate)} alt="" /></span>
              <div><strong>{pendingTemplate.name}</strong><small>{pendingTemplate.aspect} · {pendingTemplate.sceneCount} scenes · {pendingTemplate.duration.toFixed(1)} s</small><p>{pendingTemplate.description}</p><span className="template-badges">{pendingTemplate.video && <span className="template-badge video">VIDEO</span>}{pendingTemplate.audio && <span className="template-badge music">MUSIC</span>}</span></div>
            </div>
            <div className="modal-actions">
              <button className="button primary" disabled={!canEdit} onClick={() => void startTemplate(pendingTemplate)}>Start with {pendingTemplate.name} <ArrowRight size={15} /></button>
              <button className="button subtle" onClick={requestCloseModal}>Cancel</button>
            </div>
          </> : <>
            <h2 id="modal-title">A fresh start.</h2>
            <p>Your current story is saved in the local library automatically. Choose the formats you want to deliver.</p>
            <div className="project-setup-body">
            <label className="field new-project-fps">Project frame rate<select value={newProjectFps} onChange={event => setNewProjectFps(Number(event.target.value))}><option value={24}>24 fps · Film</option><option value={25}>25 fps · PAL</option><option value={30}>30 fps · Standard</option><option value={60}>60 fps · Smooth</option></select></label>
            {formatFilterChips()}
            <div className="format-groups">{filterFormatGroups(formatFilter).map(group => <section className="format-group" key={group.platform}>
              <div className="format-group-head"><strong>{group.label}</strong><span>{group.presets.length} {group.presets.length === 1 ? 'format' : 'formats'}</span></div>
              <div className="format-group-grid">{group.presets.map(preset => <label key={preset.id} className={`format-card ${newFormatIds.includes(preset.id) ? 'active' : ''}`}><input type="checkbox" checked={newFormatIds.includes(preset.id)} onChange={event => setNewFormatIds(current => event.target.checked ? [...current, preset.id] : current.filter(id => id !== preset.id))} /><span className="format-check" aria-hidden="true">{newFormatIds.includes(preset.id) ? <Check size={11} /> : null}</span><span className="format-ratio">{preset.aspect}</span><strong>{preset.name}</strong><small>{preset.description}</small></label>)}</div>
            </section>)}</div>
            <div className="settings-section-title">Custom size</div>
            <div className="custom-format-form new-custom-format">
              <label className="field">Name<input placeholder="Client 2:3" value={customFormatDraft.name} onChange={event => setCustomFormatDraft(current => ({ ...current, name: event.target.value }))} /></label>
              <label className="field">Width<input type="number" min="160" max="3840" step="2" value={customFormatDraft.width} onChange={event => setCustomFormatDraft(current => ({ ...current, width: Number(event.target.value) }))} /></label>
              <label className="field">Height<input type="number" min="160" max="3840" step="2" value={customFormatDraft.height} onChange={event => setCustomFormatDraft(current => ({ ...current, height: Number(event.target.value) }))} /></label>
              <label className="field">FPS<select value={customFormatDraft.fps} onChange={event => setCustomFormatDraft(current => ({ ...current, fps: Number(event.target.value) }))}><option value={24}>24</option><option value={25}>25</option><option value={30}>30</option><option value={60}>60</option></select></label>
              <label className="field">Quality<select value={customFormatDraft.quality} onChange={event => setCustomFormatDraft(current => ({ ...current, quality: event.target.value as 'draft' | 'standard' | 'high' }))}><option value="draft">Draft</option><option value="standard">Standard</option><option value="high">High</option></select></label>
              <button className="button" disabled={newFormatSelection.length >= MAX_PROJECT_FORMATS} onClick={addNewCustomFormat}><Plus size={14} /> Add</button>
            </div>
            {newCustomFormats.length > 0 && <div className="group-filter">{newCustomFormats.map(format => <span className="group-chip" key={format.id}><Layers size={11} />{format.name} · {format.width}×{format.height}</span>)}</div>}
            <p className="note"><Layers size={14} /><span>Photos, text, timing, transitions, audio, and looks are common to every format. Size, FPS, quality, and framing (zoom, pan, fit, letterbox) are saved per format.</span></p>
            </div>
            <div className="project-setup-foot">
              <div className="format-pick-summary" role="status" aria-live="polite"><Layers size={13} /><span>{newFormatSelection.length ? <><strong>{newFormatSelection.length} format{newFormatSelection.length === 1 ? '' : 's'}</strong> selected · {newFormatOutputs.length} file{newFormatOutputs.length === 1 ? '' : 's'} will be written{newFormatOutputs.length < newFormatSelection.length ? ' · identical sizes are combined' : ''}</> : 'Pick at least one format, or start with the default 16:9.'}</span></div>
              <div className="modal-actions">
                <button className="button primary" disabled={!canEdit} onClick={() => void startWithFormats()}><Plus size={16} /> Start blank</button>
                <button className="button" disabled={!canEdit} onClick={() => void startTemplate(SAMPLE_TEMPLATE)}><LayoutTemplate size={16} /> Use Travel sample</button>
                <button className="button subtle" onClick={requestCloseModal}>Cancel</button>
              </div>
            </div>
          </>}
        </> : modal === 'rename' ? <>
          <h2 id="modal-title">Rename this project.</h2>
          <p>Give this story a name you will recognize. It is stored only on this device.</p>
          <label className="field rename-field">Project name<input autoFocus maxLength={120} value={renameDraft} onChange={event => setRenameDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void renameProject(); } }} /></label>
          <div className="modal-actions">
            <button className="button primary" disabled={!renameDraft.trim()} onClick={() => void renameProject()}><Check size={16} /> Save name</button>
            <button className="button subtle" onClick={requestCloseModal}>Cancel</button>
          </div>
        </> : modal === 'group' ? <>
          <h2 id="modal-title">Organize “{groupTarget?.name}”.</h2>
          <p>Groups are local labels that keep related stories together. They never change the project file or move media.</p>
          <label className="field rename-field">Group name<input autoFocus maxLength={60} placeholder="e.g. Client work, Summer 2026" value={groupDraft} onChange={event => setGroupDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && groupDraft.trim()) { event.preventDefault(); void confirmGroupProject(groupDraft); } }} /></label>
          {projectGroupsList.length > 0 && <div className="group-suggestions"><span>Existing groups</span><div>{projectGroupsList.map(group => <button key={group} className={`group-chip ${groupDraft === group ? 'active' : ''}`} onClick={() => setGroupDraft(group)}><FolderOpen size={11} />{group}</button>)}</div></div>}
          <div className="modal-actions">
            <button className="button primary" disabled={!groupDraft.trim()} onClick={() => void confirmGroupProject(groupDraft)}><FolderOpen size={16} /> Move to group</button>
            {groupTarget?.group && <button className="button" onClick={() => void confirmGroupProject(null)}>Remove from group</button>}
            <button className="button subtle" onClick={requestCloseModal}>Cancel</button>
          </div>
        </> : modal === 'groups' ? <>
          <h2 id="modal-title">Manage project groups.</h2>
          <p>Rename a group or remove it. Removing a group keeps every project and simply moves those projects back to Ungrouped.</p>
          {projectGroupsList.length ? <div className="group-manager-list">{projectGroupsList.map(group => <div className="group-manager-row" key={group}><input aria-label={`Name for ${group}`} maxLength={60} value={groupDrafts[group] ?? group} onChange={event => setGroupDrafts(current => ({ ...current, [group]: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') void saveGroupRename(group); }} /><button className="button" disabled={(groupDrafts[group] ?? group).trim() === group || !(groupDrafts[group] ?? '').trim()} onClick={() => void saveGroupRename(group)}><Check size={14} /> Save</button><button className="button danger" onClick={() => void removeGroup(group)}><Trash2 size={14} /> Remove</button></div>)}</div> : <p className="note">No groups yet. Use a project’s ••• menu to move it into one.</p>}
          <div className="modal-actions"><button className="button primary" onClick={requestCloseModal}>Done</button></div>
        </> : modal === 'formats' ? <>
          <h2 id="modal-title">Deliverables.</h2>
          <p>Select the social formats you publish to. Each selected format keeps its own size, frame rate, quality, and image framing.</p>
          {formatFilterChips(() => { document.getElementById('custom-format-section')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); (document.getElementById('custom-format-name') as HTMLInputElement | null)?.focus(); })}
          <div className="settings-section-title">{formatFilter === 'social' ? 'Social formats' : formatFilter === 'sizes' ? 'Sizes & drafts' : formatFilter === 'all' ? 'Social formats & sizes' : FORMAT_FILTERS.find(filter => filter.id === formatFilter)?.label ?? 'Formats'}</div>
          <div className="format-groups">{filterFormatGroups(formatFilter).map(group => <section className="format-group" key={group.platform}>
            <div className="format-group-head"><strong>{group.label}</strong><span>{group.presets.length} {group.presets.length === 1 ? 'format' : 'formats'}</span></div>
            <div className="format-group-grid">{group.presets.map(preset => { const active = project.formats.some(format => format.presetId === preset.id); return <label key={preset.id} className={`format-card ${active ? 'active' : ''}`}><input type="checkbox" checked={active} disabled={!canEdit || (!active && project.formats.length >= MAX_PROJECT_FORMATS)} onChange={() => void toggleFormatPreset(preset.id)} /><span className="format-check" aria-hidden="true">{active ? <Check size={11} /> : null}</span><span className="format-ratio">{preset.aspect}</span><strong>{preset.name}</strong><small>{preset.description}</small></label>; })}</div>
          </section>)}</div>
          <div className="settings-section-title">Selected formats</div>
          <div className="format-pick-summary" role="status" aria-live="polite"><Layers size={13} /><span><strong>{project.formats.length} format{project.formats.length === 1 ? '' : 's'}</strong> · {projectFormatOutputs.length} file{projectFormatOutputs.length === 1 ? '' : 's'} when you export{projectFormatOutputs.length < project.formats.length ? '. Formats with the same size, frame rate and framing share one video.' : ''}</span></div>
          <div className="format-current-list">{project.formats.map(format => <div className={`format-current ${activeFormat?.id === format.id ? 'active' : ''}`} key={format.id}><button className="format-current-select" onClick={() => setActiveFormatId(format.id)}><span className="format-ratio">{format.width}×{format.height}</span><span><strong>{format.name}</strong><small>{format.width}×{format.height} · {format.fps} fps · {format.quality}</small></span></button><button className="icon-button" aria-label={`Remove ${format.name}`} disabled={project.formats.length <= 1} onClick={() => void removeFormat(format.id)}><Trash2 size={14} /></button></div>)}</div>
          {activeFormat && <div className="format-settings-card" key={activeFormat.id}>
            <div className="settings-section-title">Settings for {activeFormat.name}</div>
            <div className="format-settings-grid">
              <label className="field">Name<input defaultValue={activeFormat.name} maxLength={80} onBlur={event => { if (event.target.value.trim() && event.target.value.trim() !== activeFormat.name) void updateFormatSettings(activeFormat, { name: event.target.value }); }} /></label>
              <label className="field">Width<input type="number" min="160" max="3840" step="2" defaultValue={activeFormat.width} onBlur={event => { const value = Number(event.target.value); if (value !== activeFormat.width) void updateFormatSettings(activeFormat, { width: value }); }} /></label>
              <label className="field">Height<input type="number" min="160" max="3840" step="2" defaultValue={activeFormat.height} onBlur={event => { const value = Number(event.target.value); if (value !== activeFormat.height) void updateFormatSettings(activeFormat, { height: value }); }} /></label>
              <label className="field">Frame rate<select value={activeFormat.fps} onChange={event => void updateFormatSettings(activeFormat, { fps: Number(event.target.value) })}><option value={24}>24 fps</option><option value={25}>25 fps</option><option value={30}>30 fps</option><option value={60}>60 fps</option></select></label>
              <label className="field">Quality<select value={activeFormat.quality} onChange={event => void updateFormatSettings(activeFormat, { quality: event.target.value as 'draft' | 'standard' | 'high' })}><option value="draft">Draft</option><option value="standard">Standard</option><option value="high">High</option></select></label>
            </div>
          </div>}
          <div className="settings-section-title" id="custom-format-section">Custom format</div>
          <div className="custom-format-form">
            <label className="field">Name<input id="custom-format-name" placeholder="Client vertical" value={customFormatDraft.name} onChange={event => setCustomFormatDraft(current => ({ ...current, name: event.target.value }))} /></label>
            <label className="field">Width<input type="number" min="160" max="3840" step="2" value={customFormatDraft.width} onChange={event => setCustomFormatDraft(current => ({ ...current, width: Number(event.target.value) }))} /></label>
            <label className="field">Height<input type="number" min="160" max="3840" step="2" value={customFormatDraft.height} onChange={event => setCustomFormatDraft(current => ({ ...current, height: Number(event.target.value) }))} /></label>
            <label className="field">FPS<select value={customFormatDraft.fps} onChange={event => setCustomFormatDraft(current => ({ ...current, fps: Number(event.target.value) }))}><option value={24}>24</option><option value={25}>25</option><option value={30}>30</option><option value={60}>60</option></select></label>
            <label className="field">Quality<select value={customFormatDraft.quality} onChange={event => setCustomFormatDraft(current => ({ ...current, quality: event.target.value as 'draft' | 'standard' | 'high' }))}><option value="draft">Draft</option><option value="standard">Standard</option><option value="high">High</option></select></label>
            <button className="button primary" disabled={!canEdit || project.formats.length >= MAX_PROJECT_FORMATS} onClick={() => void addCustomFormat()}><Plus size={14} /> Add custom</button>
          </div>
          <div className="format-scope-grid"><div><span className="tiny-label">COMMON</span><p>Photos, text content, fonts, timing, transitions, audio, color, and filters.</p></div><div><span className="tiny-label">PER FORMAT</span><p>Size, frame rate, quality, image zoom/pan/fit, and letterbox color.</p></div></div>
          <div className="modal-actions"><button className="button primary" onClick={requestCloseModal}>Done</button></div>
        </> : modal === 'delete' ? <>
          <h2 id="modal-title">Delete “{deleteTarget?.name}”?</h2>
          <p>This removes the project and its embedded photos from this device. It cannot be undone. Exported videos and downloaded project backups are not affected.</p>
          {deleteTarget && <div className="delete-summary">
            {deleteTarget.thumbnail ? <img src={deleteTarget.thumbnail} alt="" /> : <span className="delete-summary-icon"><Clapperboard size={20} /></span>}
            <div><strong>{deleteTarget.name}</strong><small>{deleteTarget.sceneCount} scene{deleteTarget.sceneCount === 1 ? '' : 's'} · {timecode(deleteTarget.duration, deleteTarget.timebase)} · {deleteTarget.aspect}</small></div>
          </div>}
          <div className="modal-actions">
            <button className="button danger" onClick={() => void confirmDeleteProject()}><Trash2 size={16} /> Delete project</button>
            <button className="button" onClick={requestCloseModal}>Keep project</button>
          </div>
        </> : modal === 'missing' ? <>
          <h2 id="modal-title">Relink missing media.</h2>
          <p>These files are no longer in PixCut’s local media store. Choose a replacement for each one; the project’s edits and timing stay unchanged. Saving and exporting resume once every item is linked.</p>
          {missing.length > 0 ? <div className="missing-list">{missing.map(asset => <div className="missing-row" key={asset.ref}>
            <span className="missing-row-icon">{asset.kind === 'audio' ? <Music size={16} /> : asset.kind === 'video' ? <Film size={16} /> : <ImagePlus size={16} />}</span>
            <span className="missing-row-copy"><strong>{asset.label}</strong><small>{asset.kind} · {asset.ref.slice(13, 21)}…</small></span>
            <button className="button" title={bridge.native ? 'Choose a replacement file' : 'Relinking is available in the desktop app'} disabled={!bridge.native || relinking !== null} onClick={() => void relinkMissing(asset)}>{relinking === asset.ref ? 'Choosing…' : 'Choose file'}</button>
          </div>)}</div> : <div className="missing-done"><Check size={17} /><span><strong>All media is linked again.</strong><small>You can save and export this project.</small></span></div>}
          <div className="modal-actions"><button className="button primary" onClick={requestCloseModal}>Done</button></div>
        </> : modal === 'shortcuts' ? <>
          <ShortcutHelp settings={shortcuts} platform={platform} onOpenSettings={() => { setModal('settings'); setSettingsTab('shortcuts'); }} />
        </> : modal === 'palette' ? <>
          <h2 id="modal-title">Command palette</h2><p>Every action, searchable. Shortcuts reflect your current settings.</p>
          <CommandPalette platform={platform} bindings={shortcuts.bindings} availability={commandAvailability} onRun={runCommandId} onClose={requestCloseModal} />
        </> : modal === 'settings' ? <>
          <h2 id="modal-title">Settings</h2>
          <div className="settings-tabs">{(['general', 'appearance', 'editing', 'shortcuts', 'updates', 'privacy'] as const).map(t => <button key={t} className={settingsTab === t ? 'active' : ''} onClick={() => { if (shortcutDirty && settingsTab === 'shortcuts' && t !== 'shortcuts') { setNotice('Apply or cancel your shortcut changes before leaving Shortcuts.'); return; } setSettingsTab(t); }}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
          {settingsTab === 'general' && <div className="settings-panel">
            <div className="settings-section-title">{t('New project defaults')}</div>
            <div className="settings-grid">
              <label className="field">Canvas format<select value={preferences.defaultAspect} onChange={event => updatePreferences({ defaultAspect: event.target.value as Project['aspect'] })}><option value="16:9">16:9 · Landscape</option><option value="9:16">9:16 · Vertical</option><option value="1:1">1:1 · Square</option><option value="4:5">4:5 · Portrait</option></select></label>
              <label className="field">Photo duration<input type="number" min="1" max="10" step="0.5" value={preferences.defaultSceneSeconds} onChange={event => updatePreferences({ defaultSceneSeconds: Math.min(10, Math.max(1, Number(event.target.value) || 4)) })} /></label>
              <label className="field">Image scaling<select value={preferences.defaultFit} onChange={event => updatePreferences({ defaultFit: event.target.value as Scene['fit'] })}><option value="cover">Fill frame</option><option value="contain">Fit whole image</option><option value="blur">Blur fill</option></select></label>
            </div>
            {bridge.native && <div className="settings-section storage-section">
              <div className="settings-section-title">{t('Local media store')}</div>
              <p className="storage-usage">{storageUsage ? `${storageUsage.files} file${storageUsage.files === 1 ? '' : 's'} · ${formatBytes(storageUsage.bytes)}` : 'Checking…'}</p>
              <p className="note">Imported photos, video and audio live in PixCut's local store. Cleanup keeps anything used by an open project, its undo steps, or a saved project.</p>
              <div className="settings-actions">
                <button className="button" onClick={() => void refreshAssetUsage()} disabled={storageBusy}>Refresh</button>
                <button className="button" onClick={() => void cleanStorage()} disabled={storageBusy}>{storageBusy ? 'Cleaning…' : storageConfirm ? 'Confirm cleanup' : 'Remove unused media'}</button>
              </div>
              {storageNote && <p className="note" role="status">{storageNote}</p>}
            </div>}
            <div className="settings-section-title">{t('Language')}</div>
            <label className="field">{t('Interface language')}<select value={language} onChange={e => { const next = isLocale(e.target.value) ? e.target.value : 'en'; setLanguage(next); try { localStorage.setItem('pixcut-language', next); } catch {} }}><option value="en">English</option><option value="pl">Polski</option><option value="uk">Українська</option></select></label>
            <p className="note">{t('Language selection is stored locally and applies to the main screens; some editor panels are still being translated.')}</p>
            <div className="settings-footer"><button className="button subtle" onClick={resetPreferences}><RefreshCw size={14} /> Reset preferences</button></div>
          </div>}
          {settingsTab === 'appearance' && <div className="settings-panel">
            <div className="settings-section-title">{t('Theme')}</div>
            <label className="field">{t('App theme')}<select value={preferences.theme} onChange={event => updatePreferences({ theme: event.target.value as 'dark' | 'light' })}><option value="dark">Dark gray · default</option><option value="light">Light</option></select></label>
            <p className="note">Dark gray is the default. The light theme keeps the original bright home and navy editor.</p>
            <div className="settings-section-title">{t('Editor comfort')}</div>
            <label className="checkbox-field settings-toggle"><input type="checkbox" checked={preferences.compact} onChange={event => updatePreferences({ compact: event.target.checked })} /><span><strong>Compact editor</strong><small>Tighter panels and controls, more timeline space.</small></span></label>
            <label className="checkbox-field settings-toggle"><input type="checkbox" checked={preferences.reduceMotion} onChange={event => updatePreferences({ reduceMotion: event.target.checked })} /><span><strong>Reduce motion</strong><small>Disable interface animations and transitions.</small></span></label>
            <label className="checkbox-field settings-toggle"><input type="checkbox" checked={showHints && preferences.showHints} onChange={event => { setShowHints(event.target.checked); updatePreferences({ showHints: event.target.checked }); if (!event.target.checked) { try { localStorage.setItem(HINTS_KEY, '1'); } catch { /* optional */ } } else { try { localStorage.removeItem(HINTS_KEY); } catch { /* optional */ } } }} /><span><strong>Quick-start hints</strong><small>Show the shortcut strip the first time you edit.</small></span></label>
            <div className="settings-preview"><span className="settings-preview-frame"><span /></span><div><strong>Home stays light. Editing stays focused.</strong><p>PixCut uses a light library for browsing and a deep navy workspace for editing. Media never leaves this device.</p></div></div>
          </div>}
          {settingsTab === 'editing' && <div className="settings-panel">
            <div className="settings-section-title">{t('Editing behavior')}</div>
            <label className="field">{t('Autosave delay')}<select value={preferences.autosaveMs} onChange={event => updatePreferences({ autosaveMs: Number(event.target.value) })}><option value={300}>Fast · 0.3 s</option><option value={700}>Balanced · 0.7 s</option><option value={1500}>Relaxed · 1.5 s</option><option value={3000}>Battery saver · 3 s</option></select></label>
            <label className="checkbox-field settings-toggle"><input type="checkbox" checked={preferences.snapping} onChange={event => { setSnapping(event.target.checked); updatePreferences({ snapping: event.target.checked }); }} /><span><strong>Snap timeline by default</strong><small>New sessions start with snapping enabled.</small></span></label>
            <p className="note">Undo history is session-only and keeps up to 30 edits. Duration, speed, text, and audio edits commit as undo steps.</p>
            <div className="settings-footer"><button className="button" onClick={() => { setLayout({}); try { localStorage.removeItem('pixcut-layout'); } catch {} setNotice('Editor layout reset.'); }}><RefreshCw size={14} /> Reset panel layout</button></div>
          </div>}
          {settingsTab === 'shortcuts' && <ShortcutSettings settings={shortcuts} platform={platform} onApply={applyShortcuts} onDirtyChange={setShortcutDirty} onClose={closeShortcutSettings} />}
          {settingsTab === 'updates' && <div className="settings-panel">
            <div className="settings-section-title">Application updates</div>
            <label className="checkbox-field settings-toggle"><input type="checkbox" checked={preferences.automaticUpdates} onChange={event => updatePreferences({ automaticUpdates: event.target.checked })} /><span><strong>Automatically check for updates</strong><small>On launch and daily while Home is open. Downloads require your approval.</small></span></label>
            <div className="update-card">
              <div className="update-head">
                <div>
                  <strong>PixCut {appVersion}</strong>
                  <small>{updateState === 'checking' ? 'Checking the release feed…' : updateState === 'available' ? `Version ${updateInfo?.version ?? ''} is available.` : updateState === 'downloading' ? 'Downloading and verifying the update…' : updateState === 'ready' ? 'The update is ready to install.' : updateState === 'error' ? updateMessage : updateMessage || (preferences.automaticUpdates ? 'Checks on launch and once a day while Home is open.' : 'Automatic checks are off.')}</small>
                </div>
                <button className="button subtle" disabled={!bridge.native || updateState === 'checking' || updateState === 'downloading' || updateState === 'ready'} onClick={checkForUpdates}><RefreshCw size={14} className={updateState === 'checking' ? 'spin' : ''} /> Check for updates</button>
              </div>
              {updateState === 'available' && updateInfo && <div className="update-body">
                <div className="update-version"><span>Version {updateInfo.version}</span>{updateInfo.date && <span>{new Date(updateInfo.date).toLocaleDateString()}</span>}</div>
                {updateInfo.notes && <p className="update-notes">{updateInfo.notes}</p>}
                <button className="button" onClick={downloadUpdate}><Download size={14} /> Download and install</button>
              </div>}
              {updateState === 'downloading' && <div className="export-progress"><div><span style={{ width: `${updateProgress}%` }} /></div><span>{updateProgress}%</span></div>}
              {updateState === 'ready' && <div className="update-body"><p className="note">Restart PixCut to finish installing version {updateInfo?.version ?? 'the update'}.</p><button className="button" onClick={restartUpdate}><RefreshCw size={14} /> Restart to update</button></div>}
              {updateState === 'error' && <div className="update-body"><button className="button subtle" onClick={copyDownloadLink}><Copy size={14} /> Copy download link</button></div>}
              {!bridge.native && <p className="note">Updates are available in the installed desktop app, not the browser preview.</p>}
              <p className="note">Updates are signed and verified. Automatic checks wait until you return Home.</p>
            </div>
            <div className="settings-section-title">Version & build details</div>
            <div className="build-summary"><div><span>Version</span><strong>{appVersion}</strong></div><div><span>Running as</span><strong>{bridge.native ? 'Desktop app' : 'Browser preview'}</strong></div><div><span>Build</span><strong>{__BUILD_SHA__ === 'dev' ? 'Local development' : __BUILD_SHA__.slice(0, 8)}</strong></div><div><span>Built on</span><strong>{new Date(__BUILD_DATE__).toLocaleDateString()}</strong></div><div><span>Video export</span><strong>{!bridge.native ? 'Desktop app only' : exporter ? 'FFmpeg ready' : 'FFmpeg not found'}</strong></div></div>
            <p className="note">These details identify your installed copy. Include the diagnostics below when reporting a problem.</p>
            <pre className="diagnostics">{diagnostics()}</pre>
            <div className="settings-footer"><button className="button" onClick={copyDiagnostics}><Copy size={14} /> Copy diagnostics</button><button className="button subtle" onClick={recheckExporter}><RefreshCw size={14} /> Recheck FFmpeg</button></div>
          </div>}
          {settingsTab === 'privacy' && <div className="settings-panel">
            <div className="settings-section-title">Local storage</div>
            <div className="storage-card"><HardDrive size={18} /><div><strong>{storageLabel}</strong><small>Projects, recovery, thumbnails, and preferences are stored on this device.</small></div><button className="text-button" onClick={refreshStorage}>Refresh</button></div>
            <div className="privacy-grid"><div><WifiOff size={16} /><strong>No account</strong><span>No sign-in, cloud sync, or profile.</span></div><div><Ban size={16} /><strong>No trackers</strong><span>No analytics or remote requests while editing.</span></div><div><HardDrive size={16} /><strong>Your files</strong><span>Original photos and audio are never modified.</span></div></div>
            <p className="note">Deleting a project removes its local library record and media assets. Exported videos and downloaded project backups are not touched.</p>
          </div>}
        </> : <>
          <div className="export-title"><h2 id="modal-title">Export video</h2><p>{project.name} <span>· {duration.toFixed(1)} s · {scenes.length} scenes</span></p></div>
          <div className="export-workspace">
            <div className="export-controls">
              <section className="export-section"><h3>Encoding</h3>
                <div className="codec-choices" role="group" aria-label="Video codec">{EXPORT_CODEC_OPTIONS.map(({ id, label, description }) => <button type="button" key={id} aria-pressed={exportCodec === id} disabled={!exportCodecs.includes(id)} className={exportCodec === id ? 'active' : ''} onClick={() => { setExportCodec(id); setExportContainer(current => EXPORT_CONTAINERS[id].includes(current) ? current : EXPORT_CONTAINERS[id][0]); }}><strong>{label}</strong><small>{exportCodecs.includes(id) ? description : 'Encoder unavailable'}</small>{exportCodec === id && <Check size={15} />}</button>)}</div>
                <div className="export-pair"><label className="field">Container<select aria-label="Video container" value={exportContainer} onChange={event => setExportContainer(event.target.value as bridge.ExportContainer)}>{EXPORT_CONTAINERS[exportCodec].map(id => <option key={id} value={id}>{EXPORT_CONTAINER_LABEL[id]}</option>)}</select></label><label className="field">Encoding speed<select aria-label="Encoding speed" value={exportSpeed} disabled={exportCodec === 'prores'} onChange={event => setExportSpeed(event.target.value as 'medium')}><option value="fast">Fast</option><option value="medium">Balanced</option><option value="slow">Slower · better compression</option></select></label></div>
                <label className="export-audio-toggle"><input type="checkbox" checked={exportHardware} disabled={!hardwareAvailable || (exportCodec !== 'h264' && exportCodec !== 'hevc')} onChange={event => setExportHardware(event.target.checked)} /> Hardware encoder <small>{!hardwareAvailable ? 'Unavailable in this build' : exportCodec !== 'h264' && exportCodec !== 'hevc' ? 'H.264 and H.265 only' : 'Platform encoder · much faster'}</small></label>
              </section>
              <section className="export-section"><h3>Quality</h3><div className="quality-choices" role="group" aria-label="Export quality">{([['draft','Smaller','Quick drafts'],['standard','Balanced','Everyday sharing'],['high','High','Sharper details']] as const).map(([id,label,description]) => <button type="button" key={id} aria-pressed={exportQuality === id} className={exportQuality === id ? 'active' : ''} onClick={() => setExportQuality(id)}><strong>{label}</strong><small>{description}</small></button>)}</div></section>
              <section className="export-section"><h3>Picture</h3><div className="export-pair"><label className="field">Resolution<select aria-label="Export resolution" value={exportResolution} onChange={event => setExportResolution(event.target.value)}><option value="project">Project dimensions</option><option value="720">720p HD</option><option value="1080">1080p Full HD</option><option value="2160">4K UHD</option></select></label><label className="field">Frame rate<select aria-label="Export frame rate" value={exportFps} onChange={event => setExportFps(event.target.value)}><option value="project">Match each output</option>{[24,25,30,60].map(fps => <option key={fps} value={fps}>{fps} fps</option>)}</select></label></div><label className="export-audio-toggle"><input type="checkbox" checked={exportAudio} onChange={event => setExportAudio(event.target.checked)} /> Include audio <small>{exportAudio ? (exportCodec === 'vp9' ? 'Opus · 160 kbps' : exportCodec === 'prores' ? 'PCM · 48 kHz' : 'AAC · 192 kbps') : 'Silent video'}</small></label></section>
              {hasVideoScenes && <details className="export-naming-details"><summary>Video source rendering</summary><p>Trims, speed, color grade, fades and overlays are baked into the video. Scene transitions touching video become hard cuts, and picture-in-picture video tracks are not supported yet.</p></details>}
              <section className="export-section export-naming"><h3>File name</h3><div className="export-pair name-pair"><label className="field">Name<input aria-label="Export file name" maxLength={100} value={exportSettings.name} onChange={event => setExportSettings(current => ({ ...current, name: event.target.value }))} placeholder={project.name} /></label><label className="field">Version<input aria-label="Export version" maxLength={20} value={exportSettings.version} onChange={event => setExportSettings(current => ({ ...current, version: event.target.value }))} placeholder="v1" /></label></div><details className="export-naming-details"><summary>File naming options</summary><label className="checkbox-field"><input type="checkbox" checked={exportSettings.includePreset} onChange={event => setExportSettings(current => ({ ...current, includePreset: event.target.checked }))} /> Add output name</label><label className="checkbox-field"><input type="checkbox" checked={exportSettings.includeQuality} onChange={event => setExportSettings(current => ({ ...current, includeQuality: event.target.checked }))} /> Add quality</label></details></section>
            </div>
            <aside className="export-delivery"><div className="export-output-heading"><h3>Outputs</h3><span>{exportFormatIds.length} selected · {exportOutputs.length} file{exportOutputs.length === 1 ? '' : 's'}</span></div>{exportFormatIds.length > exportOutputs.length && <p className="export-combine-note"><Layers size={13} /><span>{exportFormatIds.length} formats share {exportOutputs.length} render{exportOutputs.length === 1 ? '' : 's'}, so PixCut writes {exportOutputs.length === 1 ? 'one video' : `${exportOutputs.length} videos`} with every platform in the file name.</span></p>}<div className="export-output-list">{exportFormats.map(format => <label key={format.id} className={`export-output ${exportFormatIds.includes(format.id) ? 'active' : ''}`}><input type="checkbox" checked={exportFormatIds.includes(format.id)} onChange={event => setExportFormatIds(current => event.target.checked ? [...current, format.id] : current.filter(id => id !== format.id))} /><span className="export-aspect-icon" style={{ aspectRatio: `${format.width}/${format.height}` }} /><span><strong>{format.name}</strong><small>{format.width} × {format.height} · {format.fps} fps</small></span></label>)}</div><details className="export-file-preview"><summary>File names <span>{exportOutputs.length} file{exportOutputs.length === 1 ? '' : 's'}</span></summary>{exportOutputs.map(output => <div key={output.key}><Film size={15} /><strong>{exportFilename(output, exportOutputs.length > 1)}</strong><small>{output.label}{output.formats.length > 1 ? ` · ${output.formats.length} formats` : ''}</small></div>)}{!exportOutputs.length && <p>Select an output above.</p>}</details><p className="export-codec-note">{EXPORT_CODEC_NOTE[exportCodec]}</p></aside>
          </div>
          <footer className="export-studio-footer"><div>{!bridge.native ? 'Video export is available in the desktop app.' : !exporter ? `FFmpeg unavailable. Install with ${FFMPEG_INSTALL[platform]}, then restart PixCut.` : !exportCodecs.includes(exportCodec) ? 'This codec is unavailable in your FFmpeg installation.' : <><span>{EXPORT_CONTAINER_SHORT[exportContainer]} · {EXPORT_CODEC_OPTIONS.find(option => option.id === exportCodec)?.label} · {exportQuality === 'high' ? 'High quality' : exportQuality === 'draft' ? 'Smaller file' : 'Balanced'}</span><small>{exportCodec === 'prores' ? 'ProRes uses the quality setting.' : 'You can continue editing during export.'}</small></>}</div><button type="button" className="button primary" disabled={!bridge.native || !exporter || exporting || busy || !exportFormatIds.length || !exportCodecs.includes(exportCodec)} onClick={() => void exportVideo()}><Download size={17} /> Export {exportOutputs.length > 1 ? `${exportOutputs.length} videos` : 'video'}</button></footer>
        </>}
      </section></div>}
    </div>
  );
}
