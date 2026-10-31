import { Spectrogram } from '../../components/timeline/Spectrogram';
import { ElementGlyph } from '../../components/elements/ElementGlyph';
import { sourceSpan } from '../../components/preview/speed';
import { AssetImage, ClipFilmstrip } from '../../components/preview/AssetImage';
import { type TimelineOverlay } from '../../components/elements/overlays';
import { t } from '../../i18n';
import { useEffect, useLayoutEffect, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { AudioLines, ArrowLeft, ArrowRight, ChevronDown, Clock3, Lock, Unlock, Film, FoldVertical, UnfoldVertical, Layers, Magnet, Music, Plus, Shapes, Sparkles, Type, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';
import { IconButton } from '../../components/IconButton';
import { TRANSITION_OPTIONS } from '../../components/inspector/SceneForm';
import { MAX_AUDIO_LANES, audioLaneMix, frameRate, sceneSeconds, ticksToSeconds, type AudioClip, type AudioMix, type Scene } from '../../stores/model';
import { NoSoundBadge, Waveform } from '../../components/timeline/Waveform';
import { sceneTextLayers } from '../../components/text/layers';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import { elementDisplayName } from '../../components/elements/catalog';
import { anchoredScroll, clampZoom, formatRulerTime, MIN_TIMELINE_ZOOM, rulerTicks, secondsAt, timelineMaxZoom, TRACK_CHROME_PX, TRACK_LABEL_PX, TRACK_TAIL_PX } from '../../components/timeline/ruler';
import { SNAP_LABELS, useSnapGuide } from '../../components/timeline/timeline-snap';
import { inRange } from '../../components/timeline/clip-edit';
import { useSelection } from '../selection-store';
import { useEditorActions } from '../editor-actions';
import { useDrafts } from '../drafts-store';
import { useLayout } from '../layout-store';
import { useEditorModel } from '../editor-model';
import { useEditorView } from '../editor-view';

/** Zoom commands the editor's shortcuts call; the panel owns the scroll position they anchor to. */
export type TimelineControls = { zoomBy: (factor: number) => void; fit: () => void };

/** Horizontal x inside the timeline for a 0–1 ratio of the story, matching the playhead. */
const at = (ratio: number) => `calc(${ratio * 100}% + ${TRACK_LABEL_PX - ratio * TRACK_CHROME_PX}px)`;

function LaneToggle({ id, label, collapsed, toggle, locked, toggleLock }: { id: string; label: string; collapsed: boolean; toggle: (id: string) => void; locked: boolean; toggleLock: (id: string) => void }) {
  return <span className="lane-controls">
    <button type="button" className="lane-toggle" aria-expanded={!collapsed} aria-label={collapsed ? t('Expand {name}', { name: label }) : t('Collapse {name}', { name: label })} title={collapsed ? t('Expand lane') : t('Collapse lane')} onClick={event => { event.stopPropagation(); toggle(id); }}><ChevronDown size={12} /></button>
    <button type="button" className={`lane-toggle lane-lock ${locked ? 'locked' : ''}`} aria-pressed={locked} aria-label={locked ? t('Unlock {name}', { name: label }) : t('Lock {name}', { name: label })} title={locked ? t('Unlock lane') : t('Lock lane: clips cannot be moved, trimmed or deleted')} onClick={event => { event.stopPropagation(); toggleLock(id); }}>{locked ? <Lock size={11} /> : <Unlock size={11} />}</button>
  </span>;
}

export function TimelinePanel({timelineControls, onLockedEdit, snapping, audioDisplay, setAudioDisplay, fileDragActive, timelineScroll, mediaDragRef, timelineRatio, position, hasMediaOverlays, setTab, setTextFocus, setPosition, orderedLayers, layerNumbers, dropTarget, reorderId, replacingSceneId, setDropTarget, selectionAnchor, setPlaying, setContextMenu, fadeDrag, videoScenes, audioMix, videoVolumeDraft, audioLanes, selectedAudio, audioLaneRef}: {
  timelineControls: RefObject<TimelineControls | null>;
  /** Called when a drag is refused because its lane is locked. */
  onLockedEdit: () => void;
  snapping: boolean;
  audioDisplay: "spectrogram" | "waveform";
  setAudioDisplay: Dispatch<SetStateAction<"spectrogram" | "waveform">>;
  fileDragActive: boolean;
  timelineScroll: RefObject<HTMLDivElement | null>;
  mediaDragRef: RefObject<Scene | null>;
  timelineRatio: number;
  position: number;
  hasMediaOverlays: boolean;
  setTab: Dispatch<SetStateAction<"text" | "audio" | "media" | "elements" | "templates">>;
  setTextFocus: Dispatch<SetStateAction<number>>;
  setPosition: Dispatch<SetStateAction<number>>;
  orderedLayers: TimelineOverlay[];
  layerNumbers: Map<string, number>;
  dropTarget: string | null;
  reorderId: string | null;
  replacingSceneId: string | null;
  setDropTarget: Dispatch<SetStateAction<string | null>>;
  selectionAnchor: RefObject<string | null>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  setContextMenu: Dispatch<SetStateAction<{ x: number; y: number; } | null>>;
  fadeDrag: { sceneId: string; side: "in" | "out"; value: number; } | null;
  videoScenes: Scene[];
  audioMix: AudioMix;
  videoVolumeDraft: { id: string; value: number; } | null;
  audioLanes: number[];
  selectedAudio: AudioClip;
  audioLaneRef: RefObject<number>;
}) {
  const { dropLibraryMedia, beginPlayheadDrag, removeBeat, selectScene, beginOverlayTiming: rawBeginOverlayTiming, beginReorder: rawBeginReorder, endReorder, dragOverScene, dropScene, beginFadeDrag: rawBeginFadeDrag, beginSceneTrim: rawBeginSceneTrim, setVideoAudioLevel, commitMix, stageVideoVolume, commitVideoVolume, selectPip, beginPipTiming: rawBeginPipTiming, toggleLaneMute, setLaneMix, beginAudioMove: rawBeginAudioMove, beginAudioTrim: rawBeginAudioTrim, stageAudio, commitAudio, addBeatAtPlayhead, tip, runCommandId, scrubTo, addTextLayerAtPlayhead, selectOverlay, chooseImages, focusAudio, chooseAudio, shortcutText } = useEditorActions();
  const { overlayDraft, previewScene } = useDrafts();
  const { scenes, canEdit, run, duration, project, projectTicks, frameSeconds, audio } = useEditorModel();
  const { selectedCount, selectedScene, isSelected, selectedTextLayer, active, renderPipScenes } = useEditorView();
  const { collapsedLanes, toggleLane, setCollapsedLanes, lockedLanes, toggleLaneLock, timelineHeight, timelineZoom, setTimelineZoom } = useLayout();
  const { selectedIds, setSelectedIds, setPrimarySelected, selectedElementId, setSelectedElementId, setSelectedTextLayerId, editTarget, setEditTarget, selectedPipId } = useSelection();
  const isLocked = (id: string) => lockedLanes.includes(id);
  /** Wraps a drag so a locked lane refuses it with a notice instead of starting. */
  function guard<E extends { preventDefault(): void; stopPropagation(): void }, A extends unknown[]>(lane: (event: E, ...args: A) => string, handler: (event: E, ...args: A) => void) {
    return (event: E, ...args: A) => {
      if (isLocked(lane(event, ...args))) { event.preventDefault(); event.stopPropagation(); onLockedEdit(); return; }
      handler(event, ...args);
    };
  }
  const mediaLane = (element: TimelineOverlay) => element.kind === 'image' || element.kind === 'video' ? 'overlays' : 'elements';
  const sceneLane = (event: ReactPointerEvent<HTMLElement>) => (event.currentTarget as HTMLElement).closest('.video-audio-clip') ? 'video-audio' : 'visuals';
  const beginOverlayTiming = guard((_event: ReactPointerEvent<HTMLElement>, element: TimelineOverlay, _edge: 'move' | 'start' | 'end') => mediaLane(element), rawBeginOverlayTiming);
  const beginPipTiming = guard((_event: ReactPointerEvent<HTMLElement>, _clip: Scene, _edge: 'move' | 'start' | 'end') => 'pip', rawBeginPipTiming);
  const beginAudioMove = guard((_event: ReactPointerEvent<HTMLElement>, clip: AudioClip) => `audio-${clip.lane ?? 0}`, rawBeginAudioMove);
  const beginAudioTrim = guard((_event: ReactPointerEvent<HTMLElement>, clip: AudioClip, _side: 'left' | 'right') => `audio-${clip.lane ?? 0}`, rawBeginAudioTrim);
  const beginSceneTrim = guard((event: ReactPointerEvent<HTMLSpanElement>, _scene: Scene, _side: 'left' | 'right') => sceneLane(event), rawBeginSceneTrim);
  const beginFadeDrag = guard((_event: ReactPointerEvent<HTMLSpanElement>, _scene: Scene, _side: 'in' | 'out') => 'visuals', rawBeginFadeDrag);
  const beginReorder = guard((_event: ReactDragEvent<HTMLElement>, _scene: Scene) => 'visuals', rawBeginReorder);

  // Dragging across empty lane space selects every visual clip in that stretch of time.
  const [marquee, setMarquee] = useState<{ from: number; to: number } | null>(null);
  function beginMarquee(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || !duration || target.closest('button, input, select, [role="button"], [draggable="true"], .timeline-playhead, .timeline-ruler-row, .beat-marker, .track-label, .timeline-add-slot, .clip-volume')) return;
    const inner = event.currentTarget.querySelector<HTMLElement>('.timeline-inner');
    if (!inner) return;
    const box = inner.getBoundingClientRect();
    const toTicks = (clientX: number) => Math.min(projectTicks, Math.max(0, (clientX - box.left - TRACK_LABEL_PX) / Math.max(1, box.width - TRACK_CHROME_PX) * projectTicks));
    if (event.clientX - box.left < TRACK_LABEL_PX) return;
    const startX = event.clientX, additive = event.shiftKey || event.metaKey || event.ctrlKey;
    const base = additive ? selectedIds : [];
    let dragging = false;
    const apply = (clientX: number) => {
      const from = toTicks(startX), to = toTicks(clientX);
      setMarquee({ from: Math.min(from, to), to: Math.max(from, to) });
      const hit = inRange(scenes, from, to);
      const ids = [...new Set([...base, ...hit])];
      setSelectedIds(ids); setPrimarySelected(ids[0] ?? null); selectionAnchor.current = ids[0] ?? null;
    };
    const move = (e: PointerEvent) => { if (!dragging && Math.abs(e.clientX - startX) < 5) return; dragging = true; setPlaying(false); apply(e.clientX); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); setMarquee(null); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  const fps = frameRate(project.timebase);
  const [viewport, setViewport] = useState({ width: 0, scroll: 0 });
  useEffect(() => {
    const element = timelineScroll.current;
    if (!element) return;
    let frame = 0;
    // The inner track is a percentage of the padded content box (18 px each side).
    const measure = () => { frame = 0; const width = Math.max(0, element.clientWidth - 36), scroll = element.scrollLeft; setViewport(current => current.width === width && current.scroll === scroll ? current : { width, scroll }); };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    element.addEventListener('scroll', schedule, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener('scroll', schedule); if (frame) cancelAnimationFrame(frame); };
  }, [timelineScroll]);

  const maxZoom = timelineMaxZoom(duration, fps, viewport.width);
  const zoom = clampZoom(timelineZoom, maxZoom);
  const innerPx = viewport.width * zoom;
  const zoomLabel = zoom < 10 ? `${Math.round(zoom * 100)}%` : `${Math.round(zoom)}×`;
  // Wheel and gesture listeners outlive renders, so they read the latest layout from here.
  const live = useRef({ duration, innerPx, zoom, maxZoom, position, base: viewport.width });
  live.current = { duration, innerPx, zoom, maxZoom, position, base: viewport.width };
  const zoomAnchor = useRef<{ seconds: number; x: number } | null>(null);

  /** Zooms keeping `anchor` (default: the playhead if visible, else the centre) under the same pixel. */
  function zoomTo(value: number, anchor?: { seconds: number; x: number }) {
    const element = timelineScroll.current, state = live.current;
    const next = clampZoom(value, state.maxZoom);
    if (element && state.duration > 0 && state.base > 0) {
      const head = TRACK_LABEL_PX + state.position / state.duration * (state.innerPx - TRACK_CHROME_PX) - element.scrollLeft;
      zoomAnchor.current = anchor ?? (head >= TRACK_LABEL_PX && head <= state.base - TRACK_TAIL_PX
        ? { seconds: state.position, x: head }
        : { seconds: secondsAt(state.base / 2, element.scrollLeft, state.duration, state.innerPx), x: state.base / 2 });
    }
    state.zoom = next;
    state.innerPx = state.base * next;
    setTimelineZoom(next);
  }
  const zoomRef = useRef(zoomTo);
  zoomRef.current = zoomTo;

  useLayoutEffect(() => {
    const element = timelineScroll.current, anchor = zoomAnchor.current;
    if (!element || !anchor) return;
    zoomAnchor.current = null;
    element.scrollLeft = anchoredScroll(anchor.seconds, anchor.x, duration, innerPx);
  }, [zoom]);

  useEffect(() => {
    timelineControls.current = { zoomBy: factor => zoomRef.current(live.current.zoom * factor), fit: () => zoomRef.current(1, { seconds: 0, x: TRACK_LABEL_PX }) };
    return () => { timelineControls.current = null; };
  }, [timelineControls]);

  // Ctrl/⌘ + wheel and trackpad pinch zoom around the pointer. WebKit reports
  // pinches as gesture events instead of ctrl-wheel, so listen for both.
  useEffect(() => {
    const element = timelineScroll.current;
    if (!element) return;
    const anchorAt = (clientX: number) => {
      const x = clientX - element.getBoundingClientRect().left - 18;
      return { x, seconds: secondsAt(x, element.scrollLeft, live.current.duration, live.current.innerPx) };
    };
    const wheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !live.current.duration) return;
      event.preventDefault();
      const delta = Math.max(-60, Math.min(60, event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY));
      zoomRef.current(live.current.zoom * Math.exp(-delta * 0.01), anchorAt(event.clientX));
    };
    let pinchStart = 1;
    const gestureStart = (event: Event) => { event.preventDefault(); pinchStart = live.current.zoom; };
    const gestureChange = (event: Event) => {
      event.preventDefault();
      const gesture = event as Event & { scale?: number; clientX?: number };
      if (gesture.scale && live.current.duration) zoomRef.current(pinchStart * gesture.scale, anchorAt(gesture.clientX ?? element.getBoundingClientRect().left + live.current.base / 2));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    element.addEventListener('gesturestart', gestureStart);
    element.addEventListener('gesturechange', gestureChange);
    return () => { element.removeEventListener('wheel', wheel); element.removeEventListener('gesturestart', gestureStart); element.removeEventListener('gesturechange', gestureChange); };
  }, [timelineScroll]);

  // Keep the playhead on screen when playback or a jump moves it out of view.
  useEffect(() => {
    const element = timelineScroll.current, state = live.current;
    if (!element || !state.duration || !state.base) return;
    const x = TRACK_LABEL_PX + state.position / state.duration * (state.innerPx - TRACK_CHROME_PX);
    if (x < element.scrollLeft + TRACK_LABEL_PX || x > element.scrollLeft + state.base - TRACK_TAIL_PX) element.scrollLeft = Math.max(0, x - TRACK_LABEL_PX - (state.base - TRACK_CHROME_PX) * .25);
  }, [position]);

  const ruler = rulerTicks(duration, Math.max(0, innerPx - TRACK_CHROME_PX), fps, { from: secondsAt(0, viewport.scroll, duration, innerPx), to: secondsAt(viewport.width, viewport.scroll, duration, innerPx) });
  const guide = useSnapGuide();
  const collapsed = (id: string) => collapsedLanes.includes(id);
  const laneIds = ['text', ...(hasMediaOverlays ? ['overlays'] : []), 'elements', 'visuals', ...(videoScenes.length ? ['video-audio'] : []), 'pip', ...audioLanes.map(lane => `audio-${lane}`)];
  const allCollapsed = laneIds.every(collapsed);

  return (
    <>
      <section className="timeline" aria-label={t('Timeline')} aria-describedby="timeline-help" style={{ height: timelineHeight }}>
        <p className="sr-only" id="timeline-help">J and L play backwards and forwards, K stops, Left and Right step one frame (with Shift, one second), Up and Down jump between clip edges, Home and End go to the start and end, equals and minus zoom, and Space plays or pauses. Scene, text and audio clips are buttons: Enter selects one, and the commands in the Help dialog act on the selection.</p>
        <div className="timeline-toolbar">
          <div><span className="timeline-heading">{t('Your story')}</span><span className="tiny-label">{scenes.length} scenes</span></div>
          <div className="timeline-tools"><IconButton label={selectedCount > 1 ? t('Select one clip to reorder') : t('Move selected scene earlier')} disabled={!selectedScene || selectedCount !== 1 || !canEdit || scenes[0]?.id === selectedScene.id} onClick={() => selectedCount === 1 && selectedScene && void run({ type: 'move', id: selectedScene.id, offset: -1 })}><ArrowLeft size={16} /></IconButton><IconButton label={selectedCount > 1 ? t('Select one clip to reorder') : t('Move selected scene later')} disabled={!selectedScene || selectedCount !== 1 || !canEdit || scenes.at(-1)?.id === selectedScene.id} onClick={() => selectedCount === 1 && selectedScene && void run({ type: 'move', id: selectedScene.id, offset: 1 })}><ArrowRight size={16} /></IconButton><IconButton className={snapping ? 'active' : ''} label={tip('timeline.snapping', (snapping ? t('Snapping on') : t('Snapping off')))} onClick={() => runCommandId('timeline.snapping')}><Magnet size={16} /></IconButton><IconButton label={t('Add beat at playhead')} onClick={addBeatAtPlayhead}><AudioLines size={16} /></IconButton><span className="header-divider" /><div className="timeline-zoom" role="group" aria-label={t('Timeline zoom')}><IconButton label={tip('timeline.zoom_out', 'Zoom out timeline')} disabled={zoom <= MIN_TIMELINE_ZOOM} onClick={() => zoomTo(zoom / 1.5)}><ZoomOut size={15} /></IconButton><input aria-label={t('Timeline zoom')} aria-valuetext={zoomLabel} type="range" min={Math.log(MIN_TIMELINE_ZOOM)} max={Math.log(maxZoom)} step="0.01" value={Math.log(zoom)} onChange={event => zoomTo(Math.exp(Number(event.target.value)))} /><button className="timeline-zoom-label" title={tip('timeline.zoom_fit', 'Fit timeline')} onClick={() => zoomTo(1, { seconds: 0, x: TRACK_LABEL_PX })}>{zoomLabel}</button><IconButton label={tip('timeline.zoom_in', 'Zoom in timeline')} disabled={zoom >= maxZoom} onClick={() => zoomTo(zoom * 1.5)}><ZoomIn size={15} /></IconButton></div><IconButton label={allCollapsed ? t('Expand all lanes') : t('Collapse all lanes')} onClick={() => setCollapsedLanes(allCollapsed ? [] : laneIds)}>{allCollapsed ? <UnfoldVertical size={15} /> : <FoldVertical size={15} />}</IconButton><span className="header-divider" /><select className="audio-display-select" aria-label={t('Timeline audio display')} value={audioDisplay} onChange={event=>setAudioDisplay(event.target.value as 'spectrogram'|'waveform')}><option value="spectrogram">{t('Spectrogram')}</option><option value="waveform">{t('Waveform')}</option></select><span className="timeline-total"><Clock3 size={14} />{duration.toFixed(1)}s</span></div>
        </div>
        {fileDragActive && <div className="file-drop-hint" role="status">{t('Drop an image or video on a scene to replace it · or drop it in the media panel')}</div>}
        <div className="timeline-content" ref={timelineScroll} onPointerDown={beginMarquee} onDragOver={event => { if (mediaDragRef.current) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }} onDrop={event => { dropLibraryMedia(event); }}>
          <div className="timeline-inner" style={{ width: `${zoom * 100}%` }}>
          {duration > 0 && <div className="timeline-playhead" style={{ left: `calc(${timelineRatio * 100}% + ${148 - timelineRatio * 198}px)` }} title={t('Drag playhead')} onPointerDown={beginPlayheadDrag}><span className="timeline-playhead-handle" /></div>}
          {marquee && projectTicks > 0 && <div className="timeline-marquee" style={{ left: at(marquee.from / projectTicks), width: `calc(${(marquee.to - marquee.from) / projectTicks * 100}% - ${(marquee.to - marquee.from) / projectTicks * TRACK_CHROME_PX}px)` }} aria-hidden="true" />}
          {guide && projectTicks > 0 && <div className={`timeline-snap-guide ${guide.kind}`} style={{ left: at(Math.min(1, guide.tick / projectTicks)) }} aria-hidden="true"><span>{t(SNAP_LABELS[guide.kind])} · {formatRulerTime(ticksToSeconds(guide.tick, project.timebase), fps, true)}</span></div>}
          {(project.beatTicks ?? []).map(tick => { const ratio = tick / Math.max(1, projectTicks); const seconds = ticksToSeconds(tick, project.timebase); return <button key={tick} className="beat-marker" style={{ left: `calc(${ratio * 100}% + ${148 - ratio * 198}px)` }} title={t('Remove beat at {seconds} s', { seconds: seconds.toFixed(2) })} aria-label={t('Remove beat at {seconds} seconds', { seconds: seconds.toFixed(2) })} disabled={!canEdit} onClick={() => removeBeat(tick)} />; })}
          <div className="timeline-sticky">
            <div className="timeline-ruler-row" onPointerDown={beginPlayheadDrag} title={t('Click or drag to move the playhead')} aria-hidden="true">
              <span className="ruler-corner" />
              {duration > 0 && ruler.minor.map(seconds => <span key={`minor-${seconds.toFixed(6)}`} className="ruler-tick minor" style={{ left: at(seconds / duration) }} />)}
              {duration > 0 && ruler.major.map(tick => <span key={tick.seconds.toFixed(6)} className="ruler-tick major" style={{ left: at(tick.seconds / duration) }}><span>{tick.label}</span></span>)}
            </div>
            <div className="timeline-scrub-row"><input className="scrubber" aria-label={t('Timeline playhead')} type="range" min="0" max={Math.max(duration - frameSeconds, 0)} step={frameSeconds} value={position} disabled={!duration} onChange={e => scrubTo(Number(e.target.value))} /></div>
          </div>
          <div className={`timeline-row text-row ${collapsed('text') ? 'collapsed' : ''} ${isLocked('text') ? 'locked' : ''}`} role="group" aria-label={t('Text track')}>
            <div className="track-label"><LaneToggle id="text" label={t('Text')} collapsed={collapsed('text')} toggle={toggleLane} locked={isLocked("text")} toggleLock={toggleLaneLock} /><Type size={14} /><span>{t('Text')}</span><span className="track-number">{String(hasMediaOverlays ? 4 : 3).padStart(2, '0')}</span></div>
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
                {!layers.length && <button className={`text-clip empty ${isSelected(scene.id) ? 'selected' : ''}`} aria-label={t('Add text to {name}', { name: scene.name })} onClick={event => { selectScene(scene, event); setTab('text'); setTextFocus(value => value + 1); }} title={t('Add text to this scene')}><span className="text-clip-inner"><Type size={10} /><span>{t('Add text')}</span></span></button>}
                {layers.map((layer, index) => {
                  const left = Math.max(0, Math.min(100, layer.startTicks / Math.max(1, scene.durationTicks) * 100));
                  const width = Math.max(3, Math.min(100 - left, layer.durationTicks / Math.max(1, scene.durationTicks) * 100));
                  const active = selectedScene?.id === scene.id && selectedTextLayer?.id === layer.id;
                  return <button key={layer.id} aria-label={t('Text layer {number} in {scene}: {title}, {start} to {end} seconds', { number: index + 1, scene: scene.name, title: layer.title || t('untitled'), start: ticksToSeconds(layer.startTicks, project.timebase).toFixed(2), end: ticksToSeconds(layer.startTicks + layer.durationTicks, project.timebase).toFixed(2) })} aria-pressed={active} className={`text-clip layer ${active ? 'selected' : ''} ${isSelected(scene.id) ? 'scene-selected' : ''}`} style={{ left: `${left}%`, width: `${width}%`, top: `${laneOf[index] * 17 + 3}px` }} onClick={event => { event.stopPropagation(); selectScene(scene, event); setEditTarget('text'); setSelectedElementId(null); setSelectedTextLayerId(layer.id); setPosition(ticksToSeconds(scene.startTicks + layer.startTicks, project.timebase)); setTab('text'); setTextFocus(value => value + 1); }} title={t('{name} · {start}–{end} s', { name: layer.title || layer.subtitle || t('Text layer'), start: ticksToSeconds(layer.startTicks, project.timebase).toFixed(1), end: ticksToSeconds(layer.startTicks + layer.durationTicks, project.timebase).toFixed(1) })}><span className="text-clip-inner"><Type size={9} /><span>{layer.title || layer.subtitle || 'Text layer'}</span></span></button>;
                })}
              </div>;
            })}</div></div>
            <div className="timeline-add-slot"><button className="add-clip text-add" aria-label={t('Add text layer at playhead')} disabled={!canEdit || !selectedScene} onClick={() => addTextLayerAtPlayhead()}><Plus size={16} /></button></div>
          </div>
          {[{ label: 'Overlays', media: true, items: orderedLayers.filter(e => e.kind === 'image' || e.kind === 'video') }, { label: 'Elements', media: false, items: orderedLayers.filter(e => e.kind !== 'image' && e.kind !== 'video') }].filter(group => !group.media || group.items.length > 0).map(group => <div key={group.label} className={`timeline-row ${group.media ? 'media-overlay-row' : 'element-row'} ${collapsed(group.media ? 'overlays' : 'elements') ? 'collapsed' : ''} ${isLocked(group.media ? 'overlays' : 'elements') ? 'locked' : ''}`} role="group" aria-label={t('{label} track', { label: t(group.label) })}>
            <div className="track-label"><LaneToggle id={group.media ? 'overlays' : 'elements'} label={t(group.label)} collapsed={collapsed(group.media ? 'overlays' : 'elements')} toggle={toggleLane} locked={isLocked(group.media ? 'overlays' : 'elements')} toggleLock={toggleLaneLock} />{group.media ? <Layers size={14} /> : <Shapes size={14} />}<span>{t(group.label)}</span><span className="track-number">{String(group.media ? 2 : hasMediaOverlays ? 3 : 2).padStart(2, '0')}</span></div>
            <div className="tracks"><div className="element-track overlay-track" style={{ height: Math.max(34, group.items.length * 29 + 8), position: 'relative' }}>{group.items.map((saved, index) => {
              const element = overlayDraft?.id === saved.id ? overlayDraft : saved;
              const start = element.startTicks, end = start + element.durationTicks;
              const span = scenes.map((scene, sceneIndex) => ({ scene, sceneIndex })).filter(({ scene }) => scene.startTicks < end && scene.startTicks + scene.durationTicks > start);
              const spanLabel = span.length > 1 ? `S${span[0].sceneIndex + 1}–${span[span.length - 1].sceneIndex + 1}` : '';
              return <button key={element.id} className={`element-clip ${selectedElementId === element.id ? 'selected' : ''}`} style={{ left: `${element.startTicks / Math.max(1, projectTicks) * 100}%`, width: `${element.durationTicks / Math.max(1, projectTicks) * 100}%`, top: index * 29 + 4 }} aria-label={group.media ? t('Select overlay {name}', { name: elementDisplayName(element) }) : t('Select element {name}', { name: elementDisplayName(element) })} aria-pressed={selectedElementId === element.id} onClick={event => { if (event.detail === 0) selectOverlay(element); }} onPointerDown={event => beginOverlayTiming(event, element, 'move')} title={t('{name} · {start}–{end} s', { name: elementDisplayName(element), start: ticksToSeconds(element.startTicks, project.timebase).toFixed(1), end: ticksToSeconds(element.startTicks + element.durationTicks, project.timebase).toFixed(1) })}>
                <span className="overlay-trim start" onPointerDown={event => beginOverlayTiming(event, element, 'start')} aria-label={t('Trim overlay start')} />
                {element.poster || element.kind === 'image' ? <AssetImage className="overlay-thumb" source={element.poster ?? element.source} alt="" fallback={<span className="overlay-thumb missing" />} /> : <ElementGlyph presetId={element.presetId} kind={element.kind} size={12} />}<span>{elementDisplayName(element)}</span>{element.action && <span className="overlay-action-region" style={{ left: `${element.action.startTicks / element.durationTicks * 100}%`, width: `${element.action.durationTicks / element.durationTicks * 100}%` }} title={element.action.sound ? t('{action} + sound', { action: element.action.kind }) : element.action.kind} />}
                <span className="layer-badge" title={`Layer ${layerNumbers.get(saved.id) ?? '?'} of ${orderedLayers.length}${spanLabel ? ` · covers scenes ${span[0].sceneIndex + 1}–${span[span.length - 1].sceneIndex + 1}` : ''}`}>L{layerNumbers.get(saved.id) ?? '?'}{spanLabel && <small>{spanLabel}</small>}</span>
                <span className="overlay-trim end" onPointerDown={event => beginOverlayTiming(event, element, 'end')} aria-label={t('Trim overlay end')} />
              </button>;
            })}</div></div>
            <div className="timeline-add-slot"><button className="add-clip" aria-label={t('Add element')} disabled={!canEdit || !selectedScene} onClick={() => setTab('elements')}><Plus size={16} /></button></div>
          </div>)}
          <div className={`timeline-row video-row ${collapsed('visuals') ? 'collapsed' : ''} ${isLocked('visuals') ? 'locked' : ''}`} role="group" aria-label={t('Visuals track')}>
            <div className="track-label"><LaneToggle id="visuals" label={t('Visuals')} collapsed={collapsed('visuals')} toggle={toggleLane} locked={isLocked("visuals")} toggleLock={toggleLaneLock} /><Film size={14} /><span>{t('Visuals')}</span><span className="track-number">01</span></div>
            <div className="tracks"><div className="scene-track">{scenes.map((scene, i) => {
              const display = previewScene?.id === scene.id ? previewScene : scene;
              const displayDuration = sceneSeconds(display, project.timebase);
              const fadeIn = Math.min(displayDuration, Math.max(0, display.fadeIn ?? 0));
              const fadeOut = Math.min(displayDuration, Math.max(0, display.fadeOut ?? 0));
              return <button key={scene.id} data-scene-id={scene.id} draggable={canEdit && !isLocked('visuals')} aria-label={scene.mediaKind === 'video' ? t('Scene {number}: {name}, {start} to {end} seconds, video', { number: i + 1, name: scene.name, start: ticksToSeconds(scene.startTicks, project.timebase).toFixed(2), end: ticksToSeconds(scene.startTicks + scene.durationTicks, project.timebase).toFixed(2) }) : t('Scene {number}: {name}, {start} to {end} seconds', { number: i + 1, name: scene.name, start: ticksToSeconds(scene.startTicks, project.timebase).toFixed(2), end: ticksToSeconds(scene.startTicks + scene.durationTicks, project.timebase).toFixed(2) })} aria-pressed={isSelected(scene.id)} aria-current={active?.id === scene.id ? 'true' : undefined} className={`timeline-clip ${isSelected(scene.id) ? 'selected' : ''} ${selectedScene?.id === scene.id ? 'primary' : ''} ${active?.id === scene.id ? 'current' : ''} ${dropTarget === scene.id ? 'drop-target' : ''} ${reorderId === scene.id ? 'dragging' : ''} ${replacingSceneId === scene.id ? 'replacing' : ''} ${previewScene?.id === scene.id ? 'trimming' : ''}`} aria-busy={replacingSceneId === scene.id} style={{ flexGrow: display.durationTicks }} onClick={event => selectScene(scene, event)} onDragStart={event => beginReorder(event, scene)} onDragEnd={endReorder} onDragOver={event => dragOverScene(event, scene.id)} onDragLeave={() => setDropTarget(current => current === scene.id ? null : current)} onDrop={event => dropScene(event, scene)} onContextMenu={event => { event.preventDefault(); if (!selectedIds.includes(scene.id)) { setSelectedIds([scene.id]); setPrimarySelected(scene.id); selectionAnchor.current = scene.id; } setPlaying(false); setContextMenu({ x: event.clientX, y: event.clientY }); }}>
                <ClipFilmstrip className="timeline-filmstrip" source={scene.mediaKind === 'video' ? (scene.videoPoster ?? scene.image) : scene.image} />
                <div><span>{String(i + 1).padStart(2, '0')} <b>{scene.name}</b></span><small>{displayDuration.toFixed(1)}s</small></div>
                {scene.mediaKind === 'video' && <span className="clip-media-badge"><Film size={9} /> VIDEO</span>}
                <span className="layer-badge base" title={t('Base visual layer')}>L0</span>
                {scene.transition && <span className="clip-transition" title={t('{name} · {seconds} s', { name: t(TRANSITION_OPTIONS.find(option => option.id === scene.transition?.type)?.label ?? 'Transition'), seconds: scene.transition.duration.toFixed(1) })}><Sparkles size={9} />{scene.transition.duration.toFixed(1)}s</span>}
                <span className="fade-shade in" style={{ width: `${(fadeIn / displayDuration) * 100}%` }} aria-hidden="true" />
                <span className="fade-shade out" style={{ width: `${(fadeOut / displayDuration) * 100}%` }} aria-hidden="true" />
                <span className="fade-handle in" style={{ left: `calc(${Math.min((fadeIn / displayDuration) * 100, 96)}% + 3px)` }} title={t('Fade in {seconds} s — drag to adjust', { seconds: fadeIn.toFixed(1) })} aria-hidden="true" onPointerDown={event => beginFadeDrag(event, scene, 'in')} onClick={event => event.stopPropagation()} />
                <span className="fade-handle out" style={{ right: `calc(${Math.min((fadeOut / displayDuration) * 100, 96)}% + 3px)` }} title={t('Fade out {seconds} s — drag to adjust', { seconds: fadeOut.toFixed(1) })} aria-hidden="true" onPointerDown={event => beginFadeDrag(event, scene, 'out')} onClick={event => event.stopPropagation()} />
                <span className="clip-trim left" title={t('Trim the start · {seconds} s in', { seconds: ticksToSeconds(scene.sourceInTicks ?? 0, project.timebase).toFixed(1) })} aria-hidden="true" onPointerDown={event => beginSceneTrim(event, scene, 'left')} onClick={event => event.stopPropagation()} />
                <span className="clip-trim right" title={t('Trim the end · {seconds} s', { seconds: displayDuration.toFixed(1) })} aria-hidden="true" onPointerDown={event => beginSceneTrim(event, scene, 'right')} onClick={event => event.stopPropagation()} />
                {fadeDrag?.sceneId === scene.id && <span className="fade-drag-label" aria-hidden="true">{fadeDrag.side === 'in' ? 'Fade in' : 'Fade out'} {fadeDrag.value.toFixed(1)} s</span>}
              </button>;
            })}</div></div><div className="timeline-add-slot"><button className="add-clip" aria-label={t('Add images to timeline')} disabled={!canEdit} onClick={() => void chooseImages()}><Plus size={20} /></button></div>
          </div>
          {videoScenes.length > 0 && <div className={`timeline-row video-audio-row ${audioDisplay} ${collapsed('video-audio') ? 'collapsed' : ''} ${isLocked('video-audio') ? 'locked' : ''}`} role="group" aria-label={t('Video audio track')}>
            <div className="track-label audio-mixer">
              <div className="track-label-head"><LaneToggle id="video-audio" label={t('Video audio')} collapsed={collapsed('video-audio')} toggle={toggleLane} locked={isLocked("video-audio")} toggleLock={toggleLaneLock} /><Film size={14} /><span>{t('Video audio')}</span></div>
              <div className="track-volume">
                <button className={`track-mute ${audioMix.video > 0 ? '' : 'muted'}`} aria-label={audioMix.video > 0 ? 'Mute video audio' : 'Unmute video audio'} aria-pressed={audioMix.video === 0} disabled={!canEdit} onClick={() => { setVideoAudioLevel(audioMix.video > 0 ? 0 : 1); commitMix(); }}>{audioMix.video > 0 ? <Volume2 size={11} /> : <VolumeX size={11} />}</button>
                <input aria-label={t('Video audio volume')} type="range" min="0" max="100" step="1" value={Math.round(audioMix.video * 100)} disabled={!canEdit} onChange={event => setVideoAudioLevel(Number(event.target.value) / 100)} onPointerUp={commitMix} onKeyUp={commitMix} onBlur={commitMix} />
                <span className="track-volume-value">{Math.round(audioMix.video * 100)}%</span>
              </div>
            </div>
            <div className="tracks"><div className="audio-track video-audio-track">
              {videoScenes.map(scene => {
                const display = previewScene?.id === scene.id ? previewScene : scene;
                const left = projectTicks ? (display.startTicks / projectTicks) * 100 : 0;
                const width = projectTicks ? (display.durationTicks / projectTicks) * 100 : 0;
                const level = Math.round(display.videoVolume ?? 100);
                const active = editTarget === 'scene' && selectedScene?.id === scene.id;
                const sourceIn = ticksToSeconds(display.sourceInTicks ?? 0, project.timebase);
                const clipSeconds = ticksToSeconds(display.durationTicks, project.timebase);
                const sourceSpanSeconds = sourceSpan(display, clipSeconds);
                const sourceDuration = display.sourceDurationSeconds ?? (sourceIn + sourceSpanSeconds);
                return <div
                  key={scene.id}
                  className={`video-audio-clip ${active ? 'selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={t('Video audio in {name}, {start} to {end} seconds', { name: scene.name, start: ticksToSeconds(scene.startTicks, project.timebase).toFixed(2), end: ticksToSeconds(scene.startTicks + scene.durationTicks, project.timebase).toFixed(2) })}
                  aria-pressed={active}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={t('{name} · linked to the picture · trimming or splitting changes both', { name: scene.name })}
                  onClick={() => selectScene(scene, undefined, false)}
                  onPointerDown={event => event.currentTarget.focus({ preventScroll: true })}
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectScene(scene, undefined, false); } }}
                >
                  <span className="audio-trim left" title={t('Drag to trim the start')} onPointerDown={event => beginSceneTrim(event, scene, 'left')} onClick={event => event.stopPropagation()} />
                  {audioDisplay === 'spectrogram'
                    ? <Spectrogram data={display.image} sourceInSeconds={sourceIn} durationSeconds={sourceSpanSeconds} sourceDurationSeconds={sourceDuration} showStatus={false} />
                    : <Waveform data={display.image} sourceInSeconds={sourceIn} durationSeconds={sourceSpanSeconds} sourceDurationSeconds={sourceDuration} />}
                  <Film size={10} /><span className="audio-name">{scene.name}</span><NoSoundBadge data={display.image} sourceDurationSeconds={sourceDuration} /><small>{level}%</small>
                  {active && <span className="clip-volume" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
                    <Volume2 size={9} />
                    <input aria-label={t('{name} sound level', { name: scene.name })} type="range" min="0" max="100" step="1" value={videoVolumeDraft?.id === scene.id ? videoVolumeDraft.value : level} onChange={event => stageVideoVolume(scene, Number(event.target.value))} onPointerUp={event => { commitVideoVolume(scene, Number(event.currentTarget.value)); }} onKeyUp={event => commitVideoVolume(scene, Number(event.currentTarget.value))} onBlur={event => commitVideoVolume(scene, Number(event.currentTarget.value))} />
                  </span>}
                  <span className="audio-trim right" title={t('Drag to trim the end')} onPointerDown={event => beginSceneTrim(event, scene, 'right')} onClick={event => event.stopPropagation()} />
                </div>;
              })}
            </div></div>
            <div className="timeline-add-slot"><button className="add-clip" aria-label={t('Add video to the timeline')} disabled={!canEdit} onClick={() => setTab('media')}><Plus size={16} /></button></div>
          </div>}
          <div className={`timeline-row pip-row ${collapsed('pip') ? 'collapsed' : ''} ${isLocked('pip') ? 'locked' : ''}`} role="group" aria-label={t('Picture in picture track')}>
            <div className="track-label"><LaneToggle id="pip" label={t('Picture in picture')} collapsed={collapsed('pip')} toggle={toggleLane} locked={isLocked("pip")} toggleLock={toggleLaneLock} /><Layers size={14} /><span>{t('Picture in picture')}</span><span className="track-number">02</span></div>
            <div className="tracks"><div className="pip-track element-track overlay-track" style={{ height: 38, position: 'relative' }}>
              {renderPipScenes.map(clip => <button key={clip.id} className={`element-clip ${selectedPipId === clip.id ? 'selected' : ''}`} style={{ left: `${clip.startTicks / Math.max(1, projectTicks) * 100}%`, width: `${clip.durationTicks / Math.max(1, projectTicks) * 100}%`, top: 4 }} aria-label={t('Picture in picture {name}, {start} to {end} seconds', { name: clip.name, start: ticksToSeconds(clip.startTicks, project.timebase).toFixed(2), end: ticksToSeconds(clip.startTicks + clip.durationTicks, project.timebase).toFixed(2) })} aria-pressed={selectedPipId === clip.id} onClick={() => selectPip(clip)} onPointerDown={event => beginPipTiming(event, clip, 'move')} title={t('{name} · drag to move, drag the edges to trim', { name: clip.name })}>
                <span className="overlay-trim start" onPointerDown={event => beginPipTiming(event, clip, 'start')} aria-label={t('Trim picture-in-picture start')} />
                <AssetImage className="overlay-thumb" source={clip.videoPoster ?? clip.image} alt="" fallback={<span className="overlay-thumb missing" />} />
                <span>{clip.name}</span>
                <span className="overlay-trim end" onPointerDown={event => beginPipTiming(event, clip, 'end')} aria-label={t('Trim picture-in-picture end')} />
              </button>)}
              {!renderPipScenes.length && <span className="audio-empty">{t('Pick a media tile → Picture in picture')}</span>}
            </div></div>
            <div className="timeline-add-slot"><button className="add-clip" aria-label={t('Add picture in picture')} disabled={!canEdit} onClick={() => setTab('media')}><Plus size={16} /></button></div>
          </div>
          {audioLanes.map((lane, laneIndex) => {
            const laneMix = audioLaneMix({ audioMix }, lane);
            return <div className={`timeline-row audio-row ${audioDisplay} ${collapsed(`audio-${lane}`) ? 'collapsed' : ''} ${isLocked(`audio-${lane}`) ? 'locked' : ''}`} role="group" aria-label={t('Audio track {number}', { number: laneIndex + 1 })} key={lane}>
            <div className="track-label audio-mixer">
              <div className="track-label-head"><LaneToggle id={`audio-${lane}`} label={`${t('Audio')} ${laneIndex + 1}`} collapsed={collapsed(`audio-${lane}`)} toggle={toggleLane} locked={isLocked(`audio-${lane}`)} toggleLock={toggleLaneLock} /><Music size={14} /><span>{t('Audio')} {laneIndex + 1}</span><span className="track-number">{String((hasMediaOverlays ? 6 : 5) + laneIndex).padStart(2, '0')}</span></div>
              <div className="track-volume">
                <button className={`track-mute ${laneMix.muted ? 'muted' : ''}`} aria-label={laneMix.muted ? t('Unmute audio track {number}', { number: laneIndex + 1 }) : t('Mute audio track {number}', { number: laneIndex + 1 })} aria-pressed={laneMix.muted} disabled={!canEdit} onClick={() => toggleLaneMute(lane)}>{laneMix.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}</button>
                <input aria-label={t('Audio track {number} volume', { number: laneIndex + 1 })} type="range" min="0" max="100" step="1" value={Math.round(laneMix.volume * 100)} disabled={!canEdit || laneMix.muted} onChange={event => setLaneMix(lane, { volume: Number(event.target.value) / 100 })} onPointerUp={commitMix} onKeyUp={commitMix} onBlur={commitMix} />
                <span className="track-volume-value">{laneMix.muted ? 'Muted' : `${Math.round(laneMix.volume * 100)}%`}</span>
              </div>
            </div>
            <div className="tracks"><div className="audio-track">
              {audio.filter(clip => (clip.lane ?? 0) === lane).map(clip => {
                const left = projectTicks ? (clip.startTicks / projectTicks) * 100 : 0;
                const width = projectTicks ? (clip.durationTicks / projectTicks) * 100 : 0;
                const selected = editTarget === 'audio' && selectedAudio?.id === clip.id;
                return <div
                  key={clip.id}
                  className={`audio-clip ${selected ? 'selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={t('Audio clip {name}, {start} to {end} seconds', { name: clip.name, start: ticksToSeconds(clip.startTicks, project.timebase).toFixed(2), end: ticksToSeconds(clip.startTicks + clip.durationTicks, project.timebase).toFixed(2) })}
                  aria-pressed={selected}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={t('{name} · drag to move · drag edges to trim', { name: clip.name })}
                  onClick={() => focusAudio(clip)}
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); focusAudio(clip); } }}
                  onPointerDown={event => beginAudioMove(event, clip)}
                >
                  <span className="audio-trim left" title={t('Drag to trim the start')} onPointerDown={event => beginAudioTrim(event, clip, 'left')} />
                  {audioDisplay === 'spectrogram' ? <>
                  <Spectrogram
                    data={clip.data}
                    sourceInSeconds={clip.sourceInSeconds}
                    durationSeconds={ticksToSeconds(clip.durationTicks, project.timebase)}
                    sourceDurationSeconds={clip.sourceDurationSeconds}
                  />
                  </> : <>
                  <Waveform
                    data={clip.data}
                    sourceInSeconds={clip.sourceInSeconds}
                    durationSeconds={ticksToSeconds(clip.durationTicks, project.timebase)}
                    sourceDurationSeconds={clip.sourceDurationSeconds}
                  />
                  </>}
                  <Music size={10} /><span className="audio-name">{clip.name}</span><small>{Math.round(clip.volume * 100)}%</small>
                  {selected && <span className="clip-volume" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
                    <Volume2 size={9} />
                    <input aria-label={t('{name} volume', { name: clip.name })} type="range" min="0" max="100" step="1" value={Math.round(clip.volume * 100)} onChange={event => stageAudio({ volume: Number(event.target.value) / 100 })} onPointerUp={commitAudio} onKeyUp={commitAudio} onBlur={commitAudio} />
                  </span>}
                  <span className="audio-trim right" title={t('Drag to trim the end')} onPointerDown={event => beginAudioTrim(event, clip, 'right')} />
                </div>;
              })}
              {!audio.some(clip => (clip.lane ?? 0) === lane) && <span className="audio-empty">{t('Empty audio track')}</span>}
            </div></div>
            <div className="timeline-add-slot"><button className="add-clip audio-add" aria-label={t('Add audio to track {number}', { number: laneIndex + 1 })} disabled={!canEdit || !projectTicks} onClick={() => { audioLaneRef.current = lane; void chooseAudio(); }}><Plus size={16} /></button></div>
          </div>;
          })}
          {audio.length > 0 && <div className="timeline-row audio-add-track-row">
            <div className="track-label"><Music size={14} /><span>{t('More audio')}</span></div>
            <div className="tracks"><button className="add-audio-track" disabled={!canEdit || !projectTicks || audioLanes.length >= MAX_AUDIO_LANES} onClick={() => { audioLaneRef.current = Math.max(0, ...audio.map(clip => clip.lane ?? 0)) + 1; void chooseAudio(); }}><Plus size={13} /> {t('Add another audio track')}</button></div>
            <div className="timeline-add-slot" />
          </div>}
          </div>
        </div>
        <footer className="editor-footer"><span><span className="status-dot" />{t('Local photo movie editor')} <span className="footer-separator">/</span> {t('Originals never modified')}</span><span><kbd>{shortcutText('playback.toggle')}</kbd> to play <span className="footer-separator">·</span> {snapping ? 'Snap on' : 'Snap off'} <span className="footer-separator">·</span> {frameRate(project.timebase).toFixed(0)} FPS</span></footer>
      </section>
    </>
  );
}
