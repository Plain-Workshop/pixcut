import { useCallback, useEffect, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Ban,
  Blend,
  Check,
  ChevronDown,
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
  Keyboard,
  Layers,
  LayoutTemplate,
  LoaderCircle,
  Magnet,
  Maximize2,
  Music,
  Pause,
  Play,
  Plus,
  Redo2,
  Save,
  Scissors,
  Search,
  Settings2,
  Shapes,
  SkipBack,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Upload,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { Brand } from '../components/BrandLogo';
import { IconButton } from '../components/IconButton';
import { SceneForm } from '../components/inspector/SceneForm';
import { CommandPalette } from '../components/shortcuts/CommandPalette';
import { ShortcutHelp } from '../components/shortcuts/ShortcutHelp';
import { ShortcutSettings } from '../components/shortcuts/ShortcutSettings';
import * as bridge from './bridge';
import { emptyProject, sceneAt, scenePatch, timecode, totalDuration, validateProject, type Command, type Project, type Scene, type ScenePatchKey, type Session } from '../stores/model';
import { demoImage, demoScenes, dimensions, drawScene, fadeOpacity, loadImage } from '../components/preview/render';
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

const INITIAL: Session = { project: emptyProject(), canUndo: false, canRedo: false };
const TEMPLATE_NAMES = ['Travel', 'Family', 'Birthday', 'Product', 'Social'];
const AVAILABLE: CommandAvailability = { disabled: false };
const HINTS_KEY = 'pixcut-hints-dismissed';
const RANGE_NAVIGATION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);

export default function App() {
  const [session, setSession] = useState(INITIAL), [screen, setScreen] = useState<'home' | 'editor'>('home');
  const [homeSection, setHomeSection] = useState<'home' | 'projects'>('home');
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [playing, setPlaying] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]), [primarySelected, setPrimarySelected] = useState<string | null>(null), [position, setPosition] = useState(0);
  const [tab, setTab] = useState<'media' | 'text' | 'elements' | 'transitions' | 'effects' | 'audio' | 'templates'>('media'), [modal, setModal] = useState<'templates' | 'export' | 'new' | 'shortcuts' | 'palette' | 'settings' | null>(null);
  const [settingsTab, setSettingsTab] = useState<'general' | 'appearance' | 'editing' | 'shortcuts' | 'updates' | 'privacy'>('general');
  const [language, setLanguage] = useState(() => localStorage.getItem('pixcut-language') || 'en');
  const [templateQuery, setTemplateQuery] = useState(''), [mediaQuery, setMediaQuery] = useState(''), [exportOutro, setExportOutro] = useState(false);
  const [notice, setNotice] = useState(''), [error, setError] = useState(''), [exporter, setExporter] = useState(false), [exporting, setExporting] = useState(false), [status, setStatus] = useState('Saved locally');
  const [name, setName] = useState('Untitled story');
  const [templateArt] = useState(() => [demoImage(0), demoImage(1), demoImage(2)]);
  const [editingText, setEditingText] = useState(false), [safeArea, setSafeArea] = useState(false);
  const [textDraft, setTextDraft] = useState({ title: '', subtitle: '' });
  const [previewScene, setPreviewScene] = useState<Scene | null>(null);
  const [propertyClipboard, setPropertyClipboard] = useState<Partial<Scene> | null>(null);
  const [platform] = useState(detectPlatform);
  const [shortcuts, setShortcuts] = useState<ShortcutSettingsData>(() => loadShortcutSettings(platform));
  const [shortcutDirty, setShortcutDirty] = useState(false);
  const [showHints, setShowHints] = useState(() => { try { return localStorage.getItem(HINTS_KEY) !== '1'; } catch { return true; } });
  const [snapping, setSnapping] = useState(true), [playDirection, setPlayDirection] = useState<1 | -1>(1);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [fadeDrag, setFadeDrag] = useState<{ sceneId: string; side: 'in' | 'out'; value: number } | null>(null);
  const [layout, setLayout] = useState(() => { try { return JSON.parse(localStorage.getItem('pixcut-layout') || '{}'); } catch { return {}; } });
  const libraryWidth = layout.libraryWidth ?? 280, inspectorWidth = layout.inspectorWidth ?? 288, timelineHeight = layout.timelineHeight ?? 282;

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

  const pending = useRef<Promise<boolean>>(Promise.resolve(true)), latestProject = useRef(INITIAL.project);
  const mediaInput = useRef<HTMLInputElement>(null), projectInput = useRef<HTMLInputElement>(null), preview = useRef<HTMLCanvasElement>(null), operation = useRef(false);
  const sceneQueue = useRef<Command[]>([]), offscreen = useRef<HTMLCanvasElement | null>(null);
  const positionRef = useRef(0), closeModalRef = useRef<() => void>(() => {}), commandRef = useRef<(id: string) => void>(() => {});
  const selectionAnchor = useRef<string | null>(null);
  const project = session.project, duration = totalDuration(project);
  const activeInfo = sceneAt(project, position), active = activeInfo?.scene, activeStart = activeInfo?.start ?? 0;
  const selectedScenes = selectedIds.length
    ? selectedIds.map(id => project.scenes.find(scene => scene.id === id)).filter((scene): scene is Scene => Boolean(scene))
    : active ? [active] : [];
  const primaryScene = primarySelected ? selectedScenes.find(scene => scene.id === primarySelected) : undefined;
  const selectedScene = primaryScene ?? selectedScenes.at(-1) ?? active;
  const selectedCount = selectedScenes.length;
  const isSelected = (id: string) => selectedIds.includes(id);
  const previewTarget = previewScene ?? active;
  const filteredScenes = project.scenes.filter(s => s.name.toLowerCase().includes(mediaQuery.trim().toLowerCase()));
  const canEdit = ready && !busy && !exporting;

  useEffect(() => { bridge.initialize().then(s => { setSession(s); latestProject.current = s.project; setName(s.project.name); }).catch(e => setError(`Recovery could not be loaded: ${String(e)}`)).finally(() => setReady(true)); bridge.exporterAvailable().then(setExporter).catch(() => setExporter(false)); }, []);
  useEffect(() => { setName(project.name); }, [project.name]);
  useEffect(() => { if (selectedScene) setTextDraft({ title: selectedScene.title, subtitle: selectedScene.subtitle }); setPreviewScene(null); }, [selectedScene?.id]);
  useEffect(() => {
    setSelectedIds(ids => {
      const next = ids.filter(id => project.scenes.some(scene => scene.id === id));
      return next.length === ids.length ? ids : next;
    });
    setPrimarySelected(id => id && project.scenes.some(scene => scene.id === id) ? id : null);
    if (selectionAnchor.current && !project.scenes.some(scene => scene.id === selectionAnchor.current)) selectionAnchor.current = null;
  }, [project.scenes]);
  useEffect(() => { setPosition(t => Math.min(t, Math.max(0, duration - 1 / 30))); }, [duration]);
  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(id); }, [notice]);

  const run = useCallback((command: Command): Promise<boolean> => {
    const light = (value: Command) => value.type === 'update' || value.type === 'updateMany';
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
          const next = await bridge.dispatch(current);
          latestProject.current = next.project;
          setSession(next);
          setStatus('Saved locally');
        } catch (e) {
          success = false;
          sceneQueue.current = [];
          setError(String(e));
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
    let frame = 0, previous = performance.now();
    const tick = (now: number) => {
      const delta = (now - previous) / 1000; previous = now;
      const limit = Math.max(0, duration - 1 / 30);
      const next = positionRef.current + delta * playDirection;
      if (playDirection > 0 && next >= duration) { positionRef.current = limit; setPosition(limit); setPlaying(false); return; }
      if (playDirection < 0 && next <= 0) { positionRef.current = 0; setPosition(0); setPlaying(false); return; }
      const bounded = Math.min(Math.max(0, next), limit);
      positionRef.current = bounded; setPosition(bounded);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [playing, duration, playDirection]);

  useEffect(() => {
    if (!previewTarget || !preview.current) return;
    if (!offscreen.current) offscreen.current = document.createElement('canvas');
    const layer = offscreen.current; let cancelled = false;
    drawScene(layer, previewTarget, project.aspect, 'preview').then(() => { if (!cancelled && preview.current) { preview.current.width = layer.width; preview.current.height = layer.height; preview.current.getContext('2d')!.drawImage(layer, 0, 0); } }).catch(e => setError(String(e)));
    return () => { cancelled = true; };
  }, [previewTarget, project.aspect, screen]);

  const save = useCallback(async () => { try { await pending.current; if (await bridge.saveProject(latestProject.current)) setNotice('Project saved. Embedded images travel with your project.'); } catch (e) { setError(String(e)); } }, []);

  function shortcutText(id: string) {
    const binding = shortcuts.bindings[id] ?? '';
    return binding ? formatBinding(binding, platform) : 'Unassigned';
  }

  function availabilityFor(id: string): CommandAvailability {
    if (exporting) return { disabled: true, reason: 'Finish the current export first.' };
    const editor = screen === 'editor';
    const hasProject = project.scenes.length > 0;
    const scene = selectedScene;
    const sceneIndex = scene ? project.scenes.findIndex(item => item.id === scene.id) : -1;
    const sceneStart = sceneIndex > 0 ? project.scenes.slice(0, sceneIndex).reduce((sum, item) => sum + item.duration, 0) : 0;
    const sceneOffset = scene ? position - sceneStart : 0;
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
        return scene && sceneOffset >= 0.5 && scene.duration - sceneOffset >= 0.5 ? AVAILABLE : { disabled: true, reason: 'Place the playhead at least half a second inside the selected clip.' };
      case 'clip.delete':
      case 'clip.ripple_delete':
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
    if (position >= duration - 1 / 30) setPosition(0);
    setPlayDirection(1);
    setPlaying(true);
  }

  function playForward() {
    if (!duration) return;
    if (position >= duration - 1 / 30) setPosition(0);
    setPlayDirection(1);
    setPlaying(true);
  }

  function playReverse() {
    if (!duration) return;
    if (position <= 1 / 30) setPosition(Math.max(0, duration - 1 / 30));
    setPlayDirection(-1);
    setPlaying(true);
  }

  function stepFrame(direction: 1 | -1) {
    if (!duration) return;
    setPlaying(false);
    setPosition(value => Math.min(Math.max(0, value + direction / 30), Math.max(0, duration - 1 / 30)));
  }

  function snapTime(value: number) {
    const limit = Math.max(0, duration - 1 / 30);
    const clamped = Math.min(Math.max(0, value), limit);
    if (!snapping) return clamped;
    const cuts = [0];
    let cursor = 0;
    for (const scene of project.scenes) { cursor += scene.duration; cuts.push(Math.min(cursor, limit)); }
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
    const index = project.scenes.findIndex(item => item.id === scene.id);
    setPosition(project.scenes.slice(0, index).reduce((sum, item) => sum + item.duration, 0));
  }

  function selectScene(scene: Scene, event?: ReactMouseEvent) {
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
      const ids = project.scenes.map(item => item.id);
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

  function updateSelection(next: Scene, force: ScenePatchKey[] = []) {
    const targets = selectedScenes;
    if (!targets.length) return;
    const base = targets.find(scene => scene.id === next.id) ?? targets[0];
    const patch = scenePatch(base, next);
    for (const key of force) {
      const value = (next as unknown as Record<string, unknown>)[key];
      if (value !== undefined) (patch as Record<string, unknown>)[key] = value;
    }
    if (!Object.keys(patch).length) return;
    const ids = targets.map(scene => scene.id);
    const applyPatch = () => {
      const latest = latestProject.current.scenes;
      const currentTargets = ids.map(id => latest.find(scene => scene.id === id)).filter((scene): scene is Scene => Boolean(scene));
      if (!currentTargets.length) return;
      if (currentTargets.length === 1) {
        void run({ type: 'update', scene: { ...currentTargets[0], ...patch } });
        return;
      }
      const scenes = currentTargets.map(scene => {
        const merged: Scene = { ...scene, ...patch };
        if (patch.speed !== undefined) {
          const source = scene.duration * (scene.speed ?? 1);
          const duration = Math.min(30, Math.max(0.5, source / patch.speed));
          merged.duration = duration;
          merged.speed = source / duration;
        }
        merged.fadeIn = Math.min(merged.fadeIn ?? 0, merged.duration);
        merged.fadeOut = Math.min(merged.fadeOut ?? 0, merged.duration);
        return merged;
      });
      void run({ type: 'updateMany', scenes });
    };
    if (operation.current) void pending.current.then(applyPatch);
    else applyPatch();
  }

  function splitAtPlayhead() {
    if (selectedScenes.length !== 1) {
      setNotice('Select one clip to split at the playhead.');
      return;
    }
    const scene = selectedScenes[0];
    const index = project.scenes.findIndex(item => item.id === scene.id);
    if (index < 0) return;
    const start = project.scenes.slice(0, index).reduce((sum, item) => sum + item.duration, 0);
    const at = position - start;
    if (at < 0.5 || scene.duration - at < 0.5) {
      setNotice('Place the playhead at least half a second inside the selected clip.');
      return;
    }
    const newId = crypto.randomUUID();
    void run({ type: 'split', id: scene.id, at, newId }).then(ok => {
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
    try { saveShortcutSettings(next); } catch (e) { setError(`Shortcuts could not be saved: ${String(e)}`); return false; }
    setShortcuts(next);
    setNotice('Shortcuts applied everywhere: tooltips, help, and the command palette.');
    return true;
  }

  function dismissHints() {
    setShowHints(false);
    try { localStorage.setItem(HINTS_KEY, '1'); } catch { /* local preferences are optional */ }
  }

  function copySceneProperties(source: Scene) {
    setPropertyClipboard({
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
    });
    setNotice('Color and filter properties copied. Select another clip to paste them.');
  }

  function notifyPasted() {
    setNotice('Color and filter properties pasted.');
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
    setFadeDrag({ sceneId: scene.id, side, value: side === 'in' ? initialIn : initialOut });
    const move = (moveEvent: PointerEvent) => {
      const delta = ((moveEvent.clientX - startX) / width) * scene.duration * (side === 'in' ? 1 : -1);
      const base = side === 'in' ? initialIn : initialOut;
      const value = Math.min(scene.duration, Math.max(0, Math.round((base + delta) * 10) / 10));
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
        const current = latestProject.current.scenes.find(item => item.id === scene.id) ?? scene;
        if ((current.fadeIn ?? 0) !== next.fadeIn || (current.fadeOut ?? 0) !== next.fadeOut) {
          void run({ type: 'update', scene: { ...current, ...next } });
        }
      });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const fadeScene = previewScene && previewScene.id === active?.id ? previewScene : active;
  const fadeAmount = fadeScene ? 1 - fadeOpacity(fadeScene, position - activeStart) : 0;

  function requestCloseModal() {
    if (exporting) return;
    if (modal === 'settings' && settingsTab === 'shortcuts' && shortcutDirty) {
      setNotice('Apply or cancel your shortcut changes before closing Settings.');
      return;
    }
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
      case 'project.new': project.scenes.length ? setModal('new') : void start(); break;
      case 'project.open': void open(); break;
      case 'project.save': void save(); break;
      case 'project.import': mediaInput.current?.click(); break;
      case 'export.open': setPlaying(false); setModal('export'); break;
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
      case 'timeline.snapping': setSnapping(value => !value); break;
      case 'view.safe_area': setSafeArea(value => !value); break;
    }
  }

  commandRef.current = runCommandId;
  closeModalRef.current = requestCloseModal;
  const commandAvailability: Record<string, CommandAvailability> = Object.fromEntries(COMMANDS.map(command => [command.id, availabilityFor(command.id)]));

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (modal || exporting || event.isComposing) return;
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

  async function start(template = false) {
    const p = emptyProject(template ? 'A little further' : 'Untitled story'); if (template) p.scenes = demoScenes();
    if (await run({ type: 'replace', project: p })) { const first = p.scenes[0]?.id ?? null; setSelectedIds(first ? [first] : []); setPrimarySelected(first); selectionAnchor.current = first; setPosition(0); setScreen('editor'); setModal(null); }
  }

  async function importFiles(files: FileList | null) {
    if (!files?.length || operation.current) return;
    setPlaying(false); setBusy(true); operation.current = true;
    try {
      const scenes: Scene[] = [];
      const incomingBytes = Array.from(files).reduce((sum, file) => sum + Math.ceil(file.size / 3) * 4 + 64, 0);
      if (incomingBytes + project.scenes.reduce((sum, scene) => sum + scene.image.length, 0) > 90_000_000) throw new Error('This prototype supports up to 64 MB of embedded images per project.');
      if (files.length + project.scenes.length > 100) throw new Error('Add up to 100 images per project.');
      for (const file of Array.from(files)) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error(`${file.name}: use JPEG, PNG, or WebP images. Video and audio editing will come in a later slice.`);
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: choose an image smaller than 10 MB.`);
        const image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = () => reject(new Error(`Could not read ${file.name}`)); reader.readAsDataURL(file); });
        await loadImage(image);
        scenes.push({ id: crypto.randomUUID(), name: file.name, image, duration: 4, title: '', subtitle: '', color: '#ffffff', fit: 'cover' });
      }
      const next = await bridge.dispatch({ type: 'add', scenes }); latestProject.current = next.project; setSession(next); setStatus('Saved locally'); const first = scenes[0]?.id ?? null; setSelectedIds(first ? [first] : []); setPrimarySelected(first); selectionAnchor.current = first; setPosition(totalDuration(project)); setScreen('editor'); setNotice(`${scenes.length} image${scenes.length === 1 ? '' : 's'} added. Originals stay untouched.`);
    } catch (e) { setError(String(e)); } finally { setBusy(false); operation.current = false; if (mediaInput.current) mediaInput.current.value = ''; }
  }

  async function open() {
    if (!bridge.native) { projectInput.current?.click(); return; }
    try { const next = await bridge.openProject(); if (next) { latestProject.current = next.project; setSession(next); setScreen('editor'); setSelectedIds([]); setPrimarySelected(null); selectionAnchor.current = null; setPosition(0); } } catch (e) { setError(String(e)); }
  }

  async function openBrowserProject(e: ChangeEvent<HTMLInputElement>) {
    try {
      const file = e.target.files?.[0]; if (!file) return;
      if (file.size > 100_000_000) throw new Error('Project file exceeds 100 MB.');
      const p = validateProject(JSON.parse(await file.text()));
      if (await run({ type: 'replace', project: p })) { setScreen('editor'); setSelectedIds([]); setPrimarySelected(null); selectionAnchor.current = null; setPosition(0); }
    } catch (e) { setError(String(e)); } finally { e.target.value = ''; }
  }

  function togglePreviewFullscreen() { const element = document.querySelector('.preview-panel'); if (!document.fullscreenElement) void element?.requestFullscreen?.(); else void document.exitFullscreen(); }

  async function exportVideo() {
    setExporting(true); setPlaying(false); setError('');
    try {
      await document.fonts.ready; const frames: string[] = [];
      for (const scene of project.scenes) { const canvas = document.createElement('canvas'); await drawScene(canvas, scene, project.aspect); frames.push(canvas.toDataURL('image/png')); }
      const path = await bridge.exportMovie(project.id, frames);
      if (path) { setNotice(`MP4 exported to ${path}`); setModal(null); }
    } catch (e) { setError(String(e)); } finally { setExporting(false); }
  }

  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? []).filter(element => element.getClientRects().length > 0 || element === document.activeElement);
    if (dialog && !dialog.contains(document.activeElement)) focusable()[0]?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !exporting) { e.preventDefault(); closeModalRef.current(); }
      if (e.key !== 'Tab') return;
      const items = focusable(), first = items[0], last = items.at(-1);
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, [modal, exporting]);

  const tabTitles = { media: 'Your media', text: 'Text & titles', elements: 'Elements', transitions: 'Transitions', effects: 'Effects', audio: 'Audio', templates: 'Templates' } as const;
  const tabDescriptions = {
    media: 'A collection of moments, ready to become a story.',
    text: 'A few words can say a lot. Select a scene to make it yours.',
    elements: 'Shapes, stickers and overlays coming soon.',
    transitions: 'Transition presets coming soon.',
    effects: 'Visual effects coming soon.',
    audio: 'Audio tracks coming soon.',
    templates: 'Bundled templates coming soon.',
  } as const;
  const wideModal = modal === 'shortcuts' || modal === 'palette' || (modal === 'settings' && settingsTab === 'shortcuts');
  const modalEyebrow = modal === 'export' ? 'READY WHEN YOU ARE' : modal === 'shortcuts' ? 'FIND YOUR FLOW' : modal === 'palette' ? 'EVERY ACTION, ONE PLACE' : modal === 'settings' ? 'MAKE PIXCUT YOURS' : 'YOUR NEXT STORY';

  return (
    <div className={`app ${screen}`}>
      <input ref={mediaInput} type="file" hidden multiple accept="image/jpeg,image/png,image/webp" onChange={e => void importFiles(e.target.files)} />
      <input ref={projectInput} type="file" hidden accept=".json,.pixcut" onChange={e => void openBrowserProject(e)} />

      {screen === 'home' ? <>
        <aside className="home-sidebar">
          <button className="brand-button home-brand" aria-label="PixCut home" onClick={() => setHomeSection('home')}><Brand /></button>
          <nav className="home-nav" aria-label="Main navigation">
            <button className={homeSection === 'home' ? 'active' : ''} onClick={() => setHomeSection('home')}><Home size={18} /><span>Home</span></button>
            <button className={homeSection === 'projects' ? 'active' : ''} onClick={() => setHomeSection('projects')}><FolderOpen size={18} /><span>Projects</span></button>
            <button onClick={() => setModal('templates')}><LayoutTemplate size={18} /><span>Templates</span></button>
            <button onClick={() => setModal('settings')}><Settings2 size={18} /><span>Settings</span></button>
          </nav>
          <div className="sidebar-card">
            <span className="sidebar-badge"><WifiOff size={13} /> Offline first</span>
            <strong>Your media stays with you.</strong>
            <p>No account. No cloud. Just your stories.</p>
          </div>
          <div className="sidebar-bottom">
            <button className="sidebar-link" onClick={() => setModal('shortcuts')}><Keyboard size={16} /><span>Keyboard shortcuts</span></button>
            <button className="sidebar-link" onClick={() => setNotice(`PixCut 0.1 · Local photo movies · ${shortcutText('playback.toggle')} to play · ${shortcutText('project.save')} to save · ${shortcutText('history.undo')} to undo`)}><Info size={16} /><span>About this build</span></button>
            <div className="sidebar-version"><span>PIXCUT DESKTOP</span><span>0.1 · EARLY BUILD</span></div>
          </div>
        </aside>

        <main className="home-main">
          <header className="home-topbar">
            <div className="home-heading">
              <div className="eyebrow"><span />{homeSection === 'home' ? 'A LITTLE MOMENT. A GREAT STORY.' : 'YOUR LOCAL LIBRARY'}</div>
              <h1>{homeSection === 'home' ? <>What would you like<br /><em>to create?</em></> : <>Your stories,<br /><em>kept close.</em></>}</h1>
              <p className="home-intro">{homeSection === 'home' ? <>Your photos, your pace, your point of view.<br />Bring them together in a place that’s entirely yours.</> : <>Everything lives on this device. Open a recent story or start a new one whenever inspiration arrives.</>}</p>
            </div>
            <div className="home-actions">
              <button className="button subtle" onClick={() => void open()} disabled={!canEdit}><FolderOpen size={16} /> Open project</button>
              <button className="button primary" disabled={!ready} onClick={() => project.scenes.length ? setModal('new') : void start()}><Plus size={16} /> New project</button>
            </div>
          </header>

          {homeSection === 'home' && <section className="create-grid" aria-label="Create something new">
            <button className="create-card new-video" disabled={!ready} onClick={() => project.scenes.length ? setModal('new') : void start()}>
              <span className="create-icon"><Plus size={25} /></span>
              <span className="create-copy"><strong>New Video</strong><small>Start with an empty timeline.</small></span>
              <span className="create-arrow"><ArrowUpRight size={19} /></span>
            </button>
            <button className="create-card photo-movie" disabled={!ready} onClick={() => mediaInput.current?.click()}>
              <span className="create-icon"><Images size={24} /></span>
              <span className="create-copy"><strong>Photo Movie</strong><small>Turn photos into a story.</small></span>
              <span className="create-arrow"><ArrowUpRight size={19} /></span>
            </button>
            <button className="create-card templates" disabled={!ready} onClick={() => setModal('templates')}>
              <span className="create-icon"><LayoutTemplate size={24} /></span>
              <span className="create-copy"><strong>Templates</strong><small>Start with a ready-made design.</small></span>
              <span className="create-arrow"><ArrowUpRight size={19} /></span>
            </button>
          </section>}

          <section className="recent-section">
            <div className="section-title">
              <div><h2>{homeSection === 'home' ? 'Recent projects' : 'Your projects'}</h2><p>{homeSection === 'home' ? 'Pick up where you left off.' : 'Stored locally, recovered automatically.'}</p></div>
              <span className="count-label">{project.scenes.length ? '1 project' : 'Nothing yet'}</span>
            </div>
            {project.scenes.length ? <div className="project-grid">
              <button className="project-card" onClick={() => { setScreen('editor'); setPlaying(false); }}>
                <div className="project-thumb">
                  <img src={project.scenes[0].image} alt="" />
                  <span className="project-aspect">{project.aspect}</span>
                  <span className="project-play"><Play size={15} fill="currentColor" /></span>
                </div>
                <div className="project-meta">
                  <strong>{project.name}</strong>
                  <small>{project.scenes.length} scenes · {timecode(duration)}</small>
                  <span className="project-status"><span className="status-dot" /> Recovered on this device</span>
                </div>
              </button>
              <button className="project-card ghost" onClick={() => setModal('new')} disabled={!canEdit}>
                <span className="ghost-art"><span><Plus size={24} /></span><small>Blank canvas</small></span>
                <div className="project-meta"><strong>Start something new</strong><small>A fresh story, ready for your photos.</small></div>
              </button>
            </div> : <div className="empty-projects">
              <div className="empty-projects-icon"><Clapperboard size={28} /></div>
              <div><strong>Your next favorite starts here.</strong><p>Start a story above, import a photo movie, or open a saved PixCut project.</p></div>
              <button className="button subtle" onClick={() => mediaInput.current?.click()} disabled={!canEdit}><Upload size={15} /> Import photos</button>
            </div>}
          </section>

          {homeSection === 'home' && <section className="thumb-strip" aria-label="Template inspiration">
            <div className="section-title"><div><h2>Skip the blank page</h2><p>Start from a sample and make it yours.</p></div><button className="text-button" onClick={() => setModal('templates')}>Browse templates <ArrowRight size={14} /></button></div>
            <div className="thumb-grid">{TEMPLATE_NAMES.slice(0, 3).map((templateName, index) => <button key={templateName} className="thumb-card" onClick={() => setModal('templates')}><img src={templateArt[index]} alt="" /><span><strong>{templateName}</strong><small>Sample story · 12 s</small></span></button>)}</div>
          </section>}

          {homeSection === 'home' && <section className="home-perks">
            <div><span className="perk-icon violet"><Zap size={17} /></span><strong>Simple</strong><small>Start creating in minutes</small></div>
            <div><span className="perk-icon blue"><Layers size={17} /></span><strong>Powerful</strong><small>Timing, titles, and color</small></div>
            <div><span className="perk-icon pink"><WifiOff size={17} /></span><strong>Offline</strong><small>Edit without internet or account</small></div>
            <div><span className="perk-icon green"><Ban size={17} /></span><strong>No watermark</strong><small>Export beautiful videos, free</small></div>
          </section>}
        </main>
      </> : <>
        <header className="editor-header">
          <button className="brand-button" aria-label="Back to home" onClick={() => { setScreen('home'); setPlaying(false); }}><Brand /></button>
          <span className="header-divider" />
          <span className="editor-mode">Video Editor</span>
          <input className="project-name" aria-label="Project name" value={name} maxLength={120} disabled={!canEdit} onChange={e => setName(e.target.value)} onBlur={() => { if (name !== project.name) void run({ type: 'rename', name: name.trim() || 'Untitled story' }); }} />
          <span className="save-status"><span className="status-dot" />{status}</span>
          <div className="header-actions">
            <IconButton label={tip('palette.open', 'Command palette')} onClick={() => runCommandId('palette.open')}><CommandIcon size={17} /></IconButton>
            <IconButton label={tip('help.shortcuts', 'Keyboard shortcuts')} onClick={() => runCommandId('help.shortcuts')}><Keyboard size={17} /></IconButton>
            <span className="header-divider" />
            <IconButton label={tip('history.undo', 'Undo')} disabled={!session.canUndo || !canEdit} onClick={() => void run({ type: 'undo' })}><Undo2 size={17} /></IconButton>
            <IconButton label={tip('history.redo', 'Redo')} disabled={!session.canRedo || !canEdit} onClick={() => void run({ type: 'redo' })}><Redo2 size={17} /></IconButton>
            <button className="button subtle header-save" aria-label="Save project" title={tip('project.save', 'Save project')} disabled={!ready || exporting} onClick={() => void save()}><Save size={15} /> <span>Save</span></button>
            <button className="button export" title={tip('export.open', 'Export video')} disabled={!project.scenes.length || !ready || exporting} onClick={() => { setPlaying(false); setModal('export'); }}><Download size={15} /> Export <ChevronDown size={12} /></button>
          </div>
        </header>

        {showHints && project.scenes.length > 0 && <div className="shortcut-hints" role="status">
          <span className="hint-title"><Sparkles size={13} /> Quick start</span>
          <span className="hint"><kbd>{shortcutText('playback.toggle')}</kbd> Play / pause</span>
          <span className="hint"><kbd>{shortcutText('clip.split')}</kbd> Split at playhead</span>
          <span className="hint"><kbd>{shortcutText('history.undo')}</kbd> Undo</span>
          <button className="text-button hint-dismiss" onClick={dismissHints}>Got it</button>
        </div>}

        <div className="editor-body">
          <nav className="tool-rail" aria-label="Editor tools">
            <button className={tab === 'media' ? 'active' : ''} onClick={() => setTab('media')}><Clapperboard size={20} /><span>Media</span></button>
            <button className={tab === 'text' ? 'active' : ''} onClick={() => setTab('text')}><Type size={21} /><span>Text</span></button>
            <button className={tab === 'elements' ? 'active' : ''} onClick={() => setTab('elements')}><Shapes size={20} /><span>Elements</span></button>
            <button className={tab === 'transitions' ? 'active' : ''} onClick={() => setTab('transitions')}><Blend size={21} /><span>Transitions</span></button>
            <button className={tab === 'effects' ? 'active' : ''} onClick={() => setTab('effects')}><Sparkles size={20} /><span>Effects</span></button>
            <button className={tab === 'audio' ? 'active' : ''} onClick={() => setTab('audio')}><Music size={20} /><span>Audio</span></button>
            <button className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}><LayoutTemplate size={20} /><span>Templates</span></button>
            <div className="rail-bottom"><IconButton label="Back to home" onClick={() => { setScreen('home'); setPlaying(false); }}><ArrowLeft size={19} /></IconButton></div>
          </nav>

          <aside className="library" style={{ width: libraryWidth }}>
            <div className="panel-title"><h2>{tabTitles[tab]}</h2><span className="count">{project.scenes.length}</span></div>
            <p className="panel-description">{tabDescriptions[tab]}</p>

            {tab === 'media' ? <>
              <label className="search-field"><Search size={14} /><input aria-label="Search project media" placeholder="Search media…" value={mediaQuery} onChange={e => setMediaQuery(e.target.value)} /></label>
              <button className="import-button" title={tip('project.import', 'Import media')} disabled={!canEdit} onClick={() => mediaInput.current?.click()}><Upload size={16} /> Import images <span>+</span></button>
              <div className="library-label">PROJECT MEDIA <span>JPEG · PNG · WEBP</span></div>
              <div className="media-grid">{filteredScenes.map(scene => <button key={scene.id} className={`media-tile ${isSelected(scene.id) ? 'selected' : ''}`} onClick={event => selectScene(scene, event)}><div><img src={scene.image} alt={scene.name} /><span>{scene.duration.toFixed(1)}s</span></div><span className="media-name">{scene.name}</span><small>SCENE {String(project.scenes.indexOf(scene) + 1).padStart(2, '0')}</small></button>)}</div>
              {!project.scenes.length && <div className="library-empty"><ImagePlus size={34} /><strong>A story starts with a photo.</strong><p>Import images from your device.<br />Nothing gets uploaded.</p></div>}
              {project.scenes.length > 0 && !filteredScenes.length && <div className="library-empty"><Search size={30} /><strong>No matching media.</strong><p>Try a different name, or clear the search.</p></div>}
            </> : tab === 'text' ? <div className="text-presets">
              <div className="type-card"><span>THE EVERYDAY</span><strong>Make it<br />memorable.</strong><small>Clean title + subtitle</small></div>
              <p>Select a scene in the timeline, then add or change its title in the inspector.</p>
              <button className="button" disabled={!selectedScene || !canEdit} onClick={() => { if (selectedScene) updateSelection({ ...selectedScene, title: 'Make it memorable.', subtitle: 'A story by you' }); }}><Plus size={15} /> Add title to {selectedCount > 1 ? `${selectedCount} clips` : 'scene'}</button>
            </div> : <div className="library-empty"><Settings2 size={34} /><strong>Coming in the next slice.</strong><p>This tool is scaffolded and will connect to the media engine later.</p></div>}

            <div className="library-footer"><HardDrive size={13} /><span>Stored locally. Always yours.</span></div>
          </aside>

          <div className="splitter vertical" onPointerDown={e => beginResize('library', libraryWidth, e.clientX)} />

          <main className="preview-panel">
            <div className="preview-heading">
              <span>PREVIEW</span>
              <div>
                <span className="offline"><span />Offline</span>
                <button className="text-button" title={tip('view.safe_area', `Safe area ${safeArea ? 'on' : 'off'}`)} onClick={() => runCommandId('view.safe_area')}>Safe area {safeArea ? 'on' : 'off'}</button>
                <select aria-label="Canvas aspect ratio" value={project.aspect} disabled={!canEdit} onChange={e => void run({ type: 'aspect', aspect: e.target.value as Project['aspect'] })}><option>16:9</option><option>9:16</option><option>1:1</option><option>4:5</option></select>
                <IconButton label="Fullscreen preview" onClick={togglePreviewFullscreen}><Maximize2 size={15} /></IconButton>
              </div>
            </div>
            <div className="preview-area" onDoubleClick={() => { if (selectedScene && canEdit) setEditingText(true); }}>
              {previewTarget ? <canvas ref={preview} className="preview-canvas" style={{ aspectRatio: project.aspect.replace(':', ' / ') }} aria-label={`Preview: ${previewTarget.title || previewTarget.name}`} /> : <div className="empty-preview">
                <Film size={40} /><h2>Every story starts somewhere.</h2><p>Add a few photos. Make them your own.</p>
                <button className="button primary" disabled={!canEdit} onClick={() => mediaInput.current?.click()}><Plus size={16} /> Add your first images</button>
                <button className="text-button" disabled={!canEdit} onClick={() => void start(true)}>Or explore a sample story <ArrowRight size={14} /></button>
              </div>}
              {fadeAmount > 0.001 && <div className="preview-fade" style={{ opacity: fadeAmount }} aria-hidden="true" />}
              {safeArea && <div className="safe-area-overlay" aria-hidden="true" />}
              {editingText && selectedScene && <div className="text-edit-overlay">
                <input aria-label="Edit title in preview" value={textDraft.title} onChange={e => setTextDraft(d => ({ ...d, title: e.target.value }))} onBlur={() => { if (selectedScene) void run({ type: 'update', scene: { ...selectedScene, title: textDraft.title, subtitle: textDraft.subtitle } }); setEditingText(false); }} onKeyDown={e => { if (e.key === 'Escape') setEditingText(false); }} autoFocus />
                <input aria-label="Edit subtitle in preview" value={textDraft.subtitle} onChange={e => setTextDraft(d => ({ ...d, subtitle: e.target.value }))} onBlur={() => { if (selectedScene) void run({ type: 'update', scene: { ...selectedScene, title: textDraft.title, subtitle: textDraft.subtitle } }); setEditingText(false); }} onKeyDown={e => { if (e.key === 'Escape') setEditingText(false); }} />
              </div>}
            </div>
            <div className="preview-scrub"><input aria-label="Preview playhead" title={`Preview playhead · ${shortcutText('timeline.prev_frame')} / ${shortcutText('timeline.next_frame')} to step frames`} type="range" min="0" max={Math.max(duration - 1 / 30, 0)} step={1 / 30} value={position} disabled={!duration} onChange={e => scrubTo(Number(e.target.value))} /></div>
            <div className="preview-controls">
              <span className="timecode">{timecode(position)} <span>/ {timecode(duration)}</span></span>
              <div className="transport"><IconButton label="Return to start" onClick={() => { setPosition(0); setPlaying(false); }}><SkipBack size={17} /></IconButton><button className="play-button" disabled={!duration || !canEdit} title={tip('playback.toggle', playing ? 'Pause' : 'Play')} aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlayback}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button></div>
              <span className="preview-quality">{dimensions(project.aspect).join(' × ')} <Maximize2 size={13} /></span>
            </div>
          </main>

          <div className="splitter vertical" onPointerDown={e => beginResize('inspector', inspectorWidth, e.clientX)} />

          <aside className="inspector" style={{ width: inspectorWidth }}>
            <div className="panel-title"><h2>Scene settings</h2><div className="panel-title-meta">{selectedCount > 1 && <span className="selection-badge">{selectedCount} selected</span>}<Settings2 size={15} /></div></div>
            {selectedCount > 1 && <div className="multi-select-banner">
              <span><Layers size={13} /> Editing {selectedCount} clips</span>
              <small>Changes apply to every selected clip. Shift-click a range or Cmd/Ctrl-click to add clips.</small>
              <button className="text-button" onClick={() => { if (selectedScene) { setSelectedIds([selectedScene.id]); setPrimarySelected(selectedScene.id); selectionAnchor.current = selectedScene.id; } }}>Edit only this clip</button>
            </div>}
            {selectedScene ? <fieldset disabled={!canEdit} className="inspector-fields">
              <SceneForm scene={selectedScene} update={updateSelection} onPreview={setPreviewScene} onCopyProperties={copySceneProperties} propertyClipboard={propertyClipboard} onPasteProperties={notifyPasted} />
              <hr />
              <div className="scene-actions"><button className="button" title={tip('clip.duplicate', selectedCount > 1 ? `Duplicate ${selectedCount} clips` : 'Duplicate clip')} onClick={duplicateSelected}><Copy size={14} /> {selectedCount > 1 ? `Duplicate ${selectedCount}` : 'Duplicate'}</button><IconButton label={tip('clip.delete', selectedCount > 1 ? `Delete ${selectedCount} clips` : 'Delete selected scene')} onClick={deleteSelected}><Trash2 size={16} /></IconButton></div>
            </fieldset> : <div className="inspector-empty"><Settings2 size={26} /><p>Select a scene to adjust its timing, framing, and text.</p></div>}
          </aside>
        </div>

        <div className="splitter horizontal" onPointerDown={e => beginResize('timeline', timelineHeight, e.clientY)} />

        <section className="timeline" aria-label="Timeline" style={{ height: timelineHeight }}>
          <div className="timeline-toolbar">
            <div><span className="timeline-heading">Your story</span><span className="tiny-label">{project.scenes.length} scenes</span></div>
            <div className="timeline-tools"><IconButton label={selectedCount > 1 ? 'Select one clip to reorder' : 'Move selected scene earlier'} disabled={!selectedScene || selectedCount !== 1 || !canEdit || project.scenes[0]?.id === selectedScene.id} onClick={() => selectedCount === 1 && selectedScene && void run({ type: 'move', id: selectedScene.id, offset: -1 })}><ArrowLeft size={16} /></IconButton><IconButton label={selectedCount > 1 ? 'Select one clip to reorder' : 'Move selected scene later'} disabled={!selectedScene || selectedCount !== 1 || !canEdit || project.scenes.at(-1)?.id === selectedScene.id} onClick={() => selectedCount === 1 && selectedScene && void run({ type: 'move', id: selectedScene.id, offset: 1 })}><ArrowRight size={16} /></IconButton><IconButton className={snapping ? 'active' : ''} label={tip('timeline.snapping', `Snapping ${snapping ? 'on' : 'off'}`)} onClick={() => runCommandId('timeline.snapping')}><Magnet size={16} /></IconButton><span className="header-divider" /><span className="timeline-total"><Clock3 size={14} />{duration.toFixed(1)}s</span></div>
          </div>
          <div className="timeline-content">
            <div className="timeline-ruler-row"><span>00:00</span><span>YOUR TIMELINE · {project.aspect}</span><span>{timecode(duration)}</span></div>
            <div className="timeline-scrub-row"><input className="scrubber" aria-label="Timeline playhead" type="range" min="0" max={Math.max(duration - 1 / 30, 0)} step={1 / 30} value={position} disabled={!duration} onChange={e => scrubTo(Number(e.target.value))} /></div>
            <div className="timeline-row">
              <div className="track-label"><Type size={14} /><span>Text</span><span className="track-number">01</span></div>
              <div className="tracks"><div className="text-track">{project.scenes.map(scene => <button key={scene.id} className={`text-clip ${isSelected(scene.id) ? 'selected' : ''} ${scene.title ? 'has-text' : ''}`} style={{ flexGrow: scene.duration, minWidth: 60 }} onClick={event => { selectScene(scene, event); setTab('text'); }}><Type size={10} /><span>{scene.title || 'Add a title'}</span></button>)}</div></div>
            </div>
            <div className="timeline-row video-row">
              <div className="track-label"><Film size={14} /><span>Visuals</span><span className="track-number">02</span></div>
              <div className="tracks"><div className="scene-track">{project.scenes.map((scene, i) => {
                const display = previewScene?.id === scene.id ? previewScene : scene;
                const fadeIn = Math.min(display.duration, Math.max(0, display.fadeIn ?? 0));
                const fadeOut = Math.min(display.duration, Math.max(0, display.fadeOut ?? 0));
                return <button key={scene.id} className={`timeline-clip ${isSelected(scene.id) ? 'selected' : ''} ${selectedScene?.id === scene.id ? 'primary' : ''} ${active?.id === scene.id ? 'current' : ''}`} style={{ flexGrow: scene.duration, minWidth: 100 }} onClick={event => selectScene(scene, event)} onContextMenu={event => { event.preventDefault(); if (!selectedIds.includes(scene.id)) { setSelectedIds([scene.id]); setPrimarySelected(scene.id); selectionAnchor.current = scene.id; } setPlaying(false); setContextMenu({ x: event.clientX, y: event.clientY }); }}>
                  <img src={scene.image} alt="" />
                  <div><span>{String(i + 1).padStart(2, '0')} <b>{scene.name}</b></span><small>{scene.duration.toFixed(1)}s</small></div>
                  {scene.title && <span className="clip-title"><Type size={10} />{scene.title}</span>}
                  <span className="fade-shade in" style={{ width: `${(fadeIn / display.duration) * 100}%` }} aria-hidden="true" />
                  <span className="fade-shade out" style={{ width: `${(fadeOut / display.duration) * 100}%` }} aria-hidden="true" />
                  <span className="fade-handle in" style={{ left: `calc(${Math.min((fadeIn / display.duration) * 100, 96)}% + 3px)` }} title={`Fade in ${fadeIn.toFixed(1)} s — drag to adjust`} aria-hidden="true" onPointerDown={event => beginFadeDrag(event, scene, 'in')} onClick={event => event.stopPropagation()} />
                  <span className="fade-handle out" style={{ right: `calc(${Math.min((fadeOut / display.duration) * 100, 96)}% + 3px)` }} title={`Fade out ${fadeOut.toFixed(1)} s — drag to adjust`} aria-hidden="true" onPointerDown={event => beginFadeDrag(event, scene, 'out')} onClick={event => event.stopPropagation()} />
                  {fadeDrag?.sceneId === scene.id && <span className="fade-drag-label" aria-hidden="true">{fadeDrag.side === 'in' ? 'Fade in' : 'Fade out'} {fadeDrag.value.toFixed(1)} s</span>}
                </button>;
              })}<button className="add-clip" aria-label="Add images to timeline" disabled={!canEdit} onClick={() => mediaInput.current?.click()}><Plus size={20} /></button></div></div>
            </div>
          </div>
          <footer className="editor-footer"><span><span className="status-dot" />Local photo movie editor <span className="footer-separator">/</span> Originals never modified</span><span><kbd>{shortcutText('playback.toggle')}</kbd> to play <span className="footer-separator">·</span> {snapping ? 'Snap on' : 'Snap off'} <span className="footer-separator">·</span> 30 FPS</span></footer>
        </section>
      </>}

      {contextMenu && <div
        className="clip-context-menu"
        style={{ left: Math.max(10, Math.min(contextMenu.x, window.innerWidth - 252)), top: Math.max(10, Math.min(contextMenu.y, window.innerHeight - 232)) }}
        role="menu"
        aria-label="Clip actions"
      >
        <span className="context-menu-heading">Clip actions</span>
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
      {error && <div className="error-banner" role="alert"><span>{error}</span><IconButton label="Dismiss error" onClick={() => setError('')}><X size={17} /></IconButton></div>}

      {modal && <div className="modal-backdrop"><section className={`modal ${wideModal ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header"><span className="eyebrow">{modalEyebrow}</span><IconButton label="Close dialog" disabled={exporting} onClick={requestCloseModal}><X size={20} /></IconButton></div>
        {modal === 'templates' ? <>
          <h2 id="modal-title">Templates</h2><p>Bundled, ready offline. Search and use.</p>
          <input aria-label="Search templates" placeholder="Search templates…" value={templateQuery} onChange={e => setTemplateQuery(e.target.value)} className="palette-input" />
          {TEMPLATE_NAMES.filter(templateName => templateName.toLowerCase().includes(templateQuery.toLowerCase())).map((templateName, index) => <button key={templateName} className="template-card" disabled={!canEdit} onClick={() => { if (project.scenes.length) setModal('new'); else void start(true); }}>
            <img src={templateArt[index % templateArt.length]} alt={templateName} />
            <div><strong>{templateName}</strong><span>3 scenes · 12 seconds · Landscape</span><span className="button primary">Use sample <ArrowRight size={15} /></span></div>
          </button>)}
          {project.scenes.length > 0 && <p className="note">Save your current project before replacing it with the sample.</p>}
        </> : modal === 'new' ? <>
          <h2 id="modal-title">Make room for a new story.</h2><p>Starting a new project replaces the recovery copy on this device. Save your current story first to keep it.</p>
          <div className="modal-actions"><button className="button" onClick={() => void save()}><Save size={16} /> Save current project</button><button className="button primary" disabled={!canEdit} onClick={() => void start()}>Start blank</button><button className="button" disabled={!canEdit} onClick={() => void start(true)}>Use sample</button></div>
        </> : modal === 'shortcuts' ? <>
          <ShortcutHelp settings={shortcuts} platform={platform} onOpenSettings={() => { setModal('settings'); setSettingsTab('shortcuts'); }} />
        </> : modal === 'palette' ? <>
          <h2 id="modal-title">Command palette</h2><p>Every action, searchable. Shortcuts reflect your current settings.</p>
          <CommandPalette platform={platform} bindings={shortcuts.bindings} availability={commandAvailability} onRun={runCommandId} onClose={requestCloseModal} />
        </> : modal === 'settings' ? <>
          <h2 id="modal-title">Settings</h2>
          <div className="settings-tabs">{(['general', 'appearance', 'editing', 'shortcuts', 'updates', 'privacy'] as const).map(t => <button key={t} className={settingsTab === t ? 'active' : ''} onClick={() => { if (shortcutDirty && settingsTab === 'shortcuts' && t !== 'shortcuts') { setNotice('Apply or cancel your shortcut changes before leaving Shortcuts.'); return; } setSettingsTab(t); }}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
          {settingsTab === 'general' && <label className="field">Language<select value={language} onChange={e => { setLanguage(e.target.value); try { localStorage.setItem('pixcut-language', e.target.value); } catch {} }}><option value="en">English</option><option value="pl">Polski</option><option value="uk">Українська</option></select></label>}
          {settingsTab === 'appearance' && <p className="note">PixCut pairs a light, focused home with a deep navy editing workspace. Theme switching is coming soon.</p>}
          {settingsTab === 'editing' && <><p className="note">Undo history is session-only and capped at 30 edits.</p><button className="button" onClick={() => { setLayout({}); try { localStorage.removeItem('pixcut-layout'); } catch {} }}>Reset layout</button></>}
          {settingsTab === 'shortcuts' && <ShortcutSettings settings={shortcuts} platform={platform} onApply={applyShortcuts} onDirtyChange={setShortcutDirty} onClose={closeShortcutSettings} />}
          {settingsTab === 'updates' && <p className="note">Updates are checked locally and never interrupt editing or export.</p>}
          {settingsTab === 'privacy' && <p className="note">All media stays on your device. No account required.</p>}
        </> : <>
          <h2 id="modal-title">A story worth sharing.</h2><p>Export your photo movie. Your images and titles, exactly as previewed.</p>
          <div className="export-summary"><span>Format<strong>MP4 · H.264</strong></span><span>Resolution<strong>{dimensions(project.aspect).join(' × ')}</strong></span><span>Duration<strong>{duration.toFixed(1)} seconds · 30 fps</strong></span><span>Branding<strong className="accent"><Check size={15} /> No watermark</strong></span><label className="field checkbox-field"><input type="checkbox" checked={exportOutro} onChange={e => setExportOutro(e.target.checked)} /> Add “Made with PixCut” outro (off by default)</label></div>
          <div className="note"><HardDrive size={17} /><span>{bridge.native ? exporter ? 'Rendered locally using your installed FFmpeg. This slice exports still scenes and titles without audio or transitions.' : 'FFmpeg was not found. Install FFmpeg with libx264, then restart PixCut to enable MP4 export.' : 'MP4 export runs in the native desktop app. This browser preview supports editing and saving projects.'}</span></div>
          <button className="button primary export-confirm" disabled={!exporter || exporting || busy} onClick={() => void exportVideo()}>{exporting ? <LoaderCircle size={17} className="spin" /> : <Download size={17} />} {exporting ? 'Rendering your story…' : 'Choose destination & export'}</button>
          {exporting && <p className="export-wait">Keep PixCut open until rendering finishes. Longer stories take more time.</p>}
        </>}
      </section></div>}
    </div>
  );
}
