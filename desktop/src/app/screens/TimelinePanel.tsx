import { Spectrogram } from '../../components/timeline/Spectrogram';
import { ElementGlyph } from '../../components/elements/ElementGlyph';
import { sourceSpan } from '../../components/preview/speed';
import { AssetImage, ClipFilmstrip } from '../../components/preview/AssetImage';
import { type TimelineOverlay } from '../../components/elements/overlays';
import { t } from '../../i18n';
import { useEffect, useLayoutEffect, useRef, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { AudioLines, ArrowLeft, ArrowRight, ChevronDown, Clock3, Film, FoldVertical, UnfoldVertical, Layers, Magnet, Music, Plus, Shapes, Sparkles, Type, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';
import { IconButton } from '../../components/IconButton';
import { TRANSITION_OPTIONS } from '../../components/inspector/SceneForm';
import { MAX_AUDIO_LANES, audioLaneMix, frameRate, sceneSeconds, ticksToSeconds, type AudioClip, type AudioMix, type AudioLaneMix, type Command, type Project, type Scene, type TextLayer } from '../../stores/model';
import { Waveform } from '../../components/timeline/Waveform';
import { sceneTextLayers } from '../../components/text/layers';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import { elementDisplayName } from '../../components/elements/catalog';
import { anchoredScroll, clampZoom, formatRulerTime, MIN_TIMELINE_ZOOM, rulerTicks, secondsAt, timelineMaxZoom, TRACK_CHROME_PX, TRACK_LABEL_PX, TRACK_TAIL_PX } from '../../components/timeline/ruler';
import { SNAP_LABELS, useSnapGuide } from '../../components/timeline/timeline-snap';

/** Zoom commands the editor's shortcuts call; the panel owns the scroll position they anchor to. */
export type TimelineControls = { zoomBy: (factor: number) => void; fit: () => void };

/** Horizontal x inside the timeline for a 0–1 ratio of the story, matching the playhead. */
const at = (ratio: number) => `calc(${ratio * 100}% + ${TRACK_LABEL_PX - ratio * TRACK_CHROME_PX}px)`;

function LaneToggle({ id, label, collapsed, toggle }: { id: string; label: string; collapsed: boolean; toggle: (id: string) => void }) {
  return <button type="button" className="lane-toggle" aria-expanded={!collapsed} aria-label={`${collapsed ? t('Expand') : t('Collapse')} ${label}`} title={collapsed ? t('Expand lane') : t('Collapse lane')} onClick={event => { event.stopPropagation(); toggle(id); }}><ChevronDown size={12} /></button>;
}

export function TimelinePanel({ timelineControls, collapsedLanes, toggleLane, setCollapsedLanes, timelineHeight, scenes, selectedCount, selectedScene, canEdit, run, snapping, tip, runCommandId, addBeatAtPlayhead, timelineZoom, changeTimelineZoom, audioDisplay, setAudioDisplay, duration, fileDragActive, timelineScroll, mediaDragRef, dropLibraryMedia, timelineRatio, beginPlayheadDrag, project, projectTicks, removeBeat, frameSeconds, position, scrubTo, hasMediaOverlays, isSelected, selectScene, setTab, setTextFocus, selectedTextLayer, setEditTarget, setSelectedElementId, setSelectedTextLayerId, setPosition, addTextLayerAtPlayhead, orderedLayers, overlayDraft, selectedElementId, selectOverlay, beginOverlayTiming, layerNumbers, previewScene, active, dropTarget, reorderId, replacingSceneId, beginReorder, endReorder, dragOverScene, setDropTarget, dropScene, selectedIds, setSelectedIds, setPrimarySelected, selectionAnchor, setPlaying, setContextMenu, beginFadeDrag, beginSceneTrim, fadeDrag, chooseImages, videoScenes, audioMix, setVideoAudioLevel, commitMix, editTarget, videoVolumeDraft, stageVideoVolume, commitVideoVolume, renderPipScenes, selectedPipId, selectPip, beginPipTiming, audioLanes, toggleLaneMute, setLaneMix, audio, selectedAudio, focusAudio, beginAudioMove, beginAudioTrim, stageAudio, commitAudio, audioLaneRef, chooseAudio, shortcutText }: {
  timelineControls: RefObject<TimelineControls | null>;
  collapsedLanes: string[];
  toggleLane: (id: string) => void;
  setCollapsedLanes: (ids: string[]) => void;
  timelineHeight: any;
  scenes: Scene[];
  selectedCount: number;
  selectedScene: Scene | undefined;
  canEdit: boolean;
  run: (command: Command) => Promise<boolean>;
  snapping: boolean;
  tip: (id: string, label: string) => string;
  runCommandId: (id: string) => void;
  addBeatAtPlayhead: () => void;
  timelineZoom: number;
  changeTimelineZoom: (value: number) => void;
  audioDisplay: "spectrogram" | "waveform";
  setAudioDisplay: Dispatch<SetStateAction<"spectrogram" | "waveform">>;
  duration: number;
  fileDragActive: boolean;
  timelineScroll: RefObject<HTMLDivElement | null>;
  mediaDragRef: RefObject<Scene | null>;
  dropLibraryMedia: (event: ReactDragEvent<HTMLElement>) => boolean;
  timelineRatio: number;
  beginPlayheadDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  project: Project;
  projectTicks: number;
  removeBeat: (tick: number) => void;
  frameSeconds: number;
  position: number;
  scrubTo: (value: number) => void;
  hasMediaOverlays: boolean;
  isSelected: (id: string) => boolean;
  selectScene: (scene: Scene, event?: ReactMouseEvent, seek?: boolean) => void;
  setTab: Dispatch<SetStateAction<"text" | "audio" | "media" | "elements" | "templates">>;
  setTextFocus: Dispatch<SetStateAction<number>>;
  selectedTextLayer: TextLayer;
  setEditTarget: Dispatch<SetStateAction<"text" | "audio" | "scene" | "element">>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSelectedTextLayerId: Dispatch<SetStateAction<string | null>>;
  setPosition: Dispatch<SetStateAction<number>>;
  addTextLayerAtPlayhead: (preset?: Partial<TextLayer>) => void;
  orderedLayers: TimelineOverlay[];
  overlayDraft: TimelineOverlay | null;
  selectedElementId: string | null;
  selectOverlay: (element: TimelineOverlay, seek?: boolean) => void;
  beginOverlayTiming: (event: ReactPointerEvent<HTMLElement>, element: TimelineOverlay, edge: "move" | "start" | "end") => void;
  layerNumbers: Map<string, number>;
  previewScene: Scene | null;
  active: Scene | undefined;
  dropTarget: string | null;
  reorderId: string | null;
  replacingSceneId: string | null;
  beginReorder: (event: ReactDragEvent<HTMLElement>, scene: Scene) => void;
  endReorder: () => void;
  dragOverScene: (event: ReactDragEvent<HTMLElement>, id: string) => void;
  setDropTarget: Dispatch<SetStateAction<string | null>>;
  dropScene: (event: ReactDragEvent<HTMLElement>, target: Scene) => void;
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setPrimarySelected: Dispatch<SetStateAction<string | null>>;
  selectionAnchor: RefObject<string | null>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  setContextMenu: Dispatch<SetStateAction<{ x: number; y: number; } | null>>;
  beginFadeDrag: (event: ReactPointerEvent<HTMLSpanElement>, scene: Scene, side: "in" | "out") => void;
  beginSceneTrim: (event: ReactPointerEvent<HTMLSpanElement>, scene: Scene, side: "left" | "right") => void;
  fadeDrag: { sceneId: string; side: "in" | "out"; value: number; } | null;
  chooseImages: () => Promise<void>;
  videoScenes: Scene[];
  audioMix: AudioMix;
  setVideoAudioLevel: (volume: number) => void;
  commitMix: () => void;
  editTarget: "text" | "audio" | "scene" | "element";
  videoVolumeDraft: { id: string; value: number; } | null;
  stageVideoVolume: (scene: Scene, value: number) => void;
  commitVideoVolume: (scene: Scene, value: number) => void;
  renderPipScenes: Scene[];
  selectedPipId: string | null;
  selectPip: (clip: Scene) => void;
  beginPipTiming: (event: ReactPointerEvent<HTMLElement>, clip: Scene, edge: "move" | "start" | "end") => void;
  audioLanes: number[];
  toggleLaneMute: (lane: number) => void;
  setLaneMix: (lane: number, patch: Partial<Omit<AudioLaneMix, "lane">>) => void;
  audio: AudioClip[];
  selectedAudio: AudioClip;
  focusAudio: (clip: AudioClip) => void;
  beginAudioMove: (event: ReactPointerEvent<HTMLElement>, clip: AudioClip) => void;
  beginAudioTrim: (event: ReactPointerEvent<HTMLElement>, clip: AudioClip, side: "left" | "right") => void;
  stageAudio: (patch: Partial<AudioClip>) => void;
  commitAudio: () => void;
  audioLaneRef: RefObject<number>;
  chooseAudio: () => Promise<void>;
  shortcutText: (id: string) => string;
}) {
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
    changeTimelineZoom(next);
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
      <section className="timeline" aria-label="Timeline" aria-describedby="timeline-help" style={{ height: timelineHeight }}>
        <p className="sr-only" id="timeline-help">J and L play backwards and forwards, K stops, Left and Right step one frame (with Shift, one second), Up and Down jump between clip edges, Home and End go to the start and end, equals and minus zoom, and Space plays or pauses. Scene, text and audio clips are buttons: Enter selects one, and the commands in the Help dialog act on the selection.</p>
        <div className="timeline-toolbar">
          <div><span className="timeline-heading">{t('Your story')}</span><span className="tiny-label">{scenes.length} scenes</span></div>
          <div className="timeline-tools"><IconButton label={selectedCount > 1 ? 'Select one clip to reorder' : 'Move selected scene earlier'} disabled={!selectedScene || selectedCount !== 1 || !canEdit || scenes[0]?.id === selectedScene.id} onClick={() => selectedCount === 1 && selectedScene && void run({ type: 'move', id: selectedScene.id, offset: -1 })}><ArrowLeft size={16} /></IconButton><IconButton label={selectedCount > 1 ? 'Select one clip to reorder' : 'Move selected scene later'} disabled={!selectedScene || selectedCount !== 1 || !canEdit || scenes.at(-1)?.id === selectedScene.id} onClick={() => selectedCount === 1 && selectedScene && void run({ type: 'move', id: selectedScene.id, offset: 1 })}><ArrowRight size={16} /></IconButton><IconButton className={snapping ? 'active' : ''} label={tip('timeline.snapping', `Snapping ${snapping ? 'on' : 'off'}`)} onClick={() => runCommandId('timeline.snapping')}><Magnet size={16} /></IconButton><IconButton label="Add beat at playhead" onClick={addBeatAtPlayhead}><AudioLines size={16} /></IconButton><span className="header-divider" /><div className="timeline-zoom" role="group" aria-label="Timeline zoom"><IconButton label={tip('timeline.zoom_out', 'Zoom out timeline')} disabled={zoom <= MIN_TIMELINE_ZOOM} onClick={() => zoomTo(zoom / 1.5)}><ZoomOut size={15} /></IconButton><input aria-label="Timeline zoom" aria-valuetext={zoomLabel} type="range" min={Math.log(MIN_TIMELINE_ZOOM)} max={Math.log(maxZoom)} step="0.01" value={Math.log(zoom)} onChange={event => zoomTo(Math.exp(Number(event.target.value)))} /><button className="timeline-zoom-label" title={tip('timeline.zoom_fit', 'Fit timeline')} onClick={() => zoomTo(1, { seconds: 0, x: TRACK_LABEL_PX })}>{zoomLabel}</button><IconButton label={tip('timeline.zoom_in', 'Zoom in timeline')} disabled={zoom >= maxZoom} onClick={() => zoomTo(zoom * 1.5)}><ZoomIn size={15} /></IconButton></div><IconButton label={allCollapsed ? t('Expand all lanes') : t('Collapse all lanes')} onClick={() => setCollapsedLanes(allCollapsed ? [] : laneIds)}>{allCollapsed ? <UnfoldVertical size={15} /> : <FoldVertical size={15} />}</IconButton><span className="header-divider" /><select className="audio-display-select" aria-label="Timeline audio display" value={audioDisplay} onChange={event=>setAudioDisplay(event.target.value as 'spectrogram'|'waveform')}><option value="spectrogram">{t('Spectrogram')}</option><option value="waveform">{t('Waveform')}</option></select><span className="timeline-total"><Clock3 size={14} />{duration.toFixed(1)}s</span></div>
        </div>
        {fileDragActive && <div className="file-drop-hint" role="status">Drop an image or video on a scene to replace it · or drop it in the media panel</div>}
        <div className="timeline-content" ref={timelineScroll} onDragOver={event => { if (mediaDragRef.current) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }} onDrop={event => { dropLibraryMedia(event); }}>
          <div className="timeline-inner" style={{ width: `${zoom * 100}%` }}>
          {duration > 0 && <div className="timeline-playhead" style={{ left: `calc(${timelineRatio * 100}% + ${148 - timelineRatio * 198}px)` }} title="Drag playhead" onPointerDown={beginPlayheadDrag}><span className="timeline-playhead-handle" /></div>}
          {guide && projectTicks > 0 && <div className={`timeline-snap-guide ${guide.kind}`} style={{ left: at(Math.min(1, guide.tick / projectTicks)) }} aria-hidden="true"><span>{t(SNAP_LABELS[guide.kind])} · {formatRulerTime(ticksToSeconds(guide.tick, project.timebase), fps, true)}</span></div>}
          {(project.beatTicks ?? []).map(tick => { const ratio = tick / Math.max(1, projectTicks); const seconds = ticksToSeconds(tick, project.timebase); return <button key={tick} className="beat-marker" style={{ left: `calc(${ratio * 100}% + ${148 - ratio * 198}px)` }} title={`Remove beat at ${seconds.toFixed(2)} s`} aria-label={`Remove beat at ${seconds.toFixed(2)} seconds`} disabled={!canEdit} onClick={() => removeBeat(tick)} />; })}
          <div className="timeline-sticky">
            <div className="timeline-ruler-row" onPointerDown={beginPlayheadDrag} title={t('Click or drag to move the playhead')} aria-hidden="true">
              <span className="ruler-corner" />
              {duration > 0 && ruler.minor.map(seconds => <span key={`minor-${seconds.toFixed(6)}`} className="ruler-tick minor" style={{ left: at(seconds / duration) }} />)}
              {duration > 0 && ruler.major.map(tick => <span key={tick.seconds.toFixed(6)} className="ruler-tick major" style={{ left: at(tick.seconds / duration) }}><span>{tick.label}</span></span>)}
            </div>
            <div className="timeline-scrub-row"><input className="scrubber" aria-label="Timeline playhead" type="range" min="0" max={Math.max(duration - frameSeconds, 0)} step={frameSeconds} value={position} disabled={!duration} onChange={e => scrubTo(Number(e.target.value))} /></div>
          </div>
          <div className={`timeline-row text-row ${collapsed('text') ? 'collapsed' : ''}`} role="group" aria-label="Text track">
            <div className="track-label"><LaneToggle id="text" label={t('Text')} collapsed={collapsed('text')} toggle={toggleLane} /><Type size={14} /><span>{t('Text')}</span><span className="track-number">{String(hasMediaOverlays ? 4 : 3).padStart(2, '0')}</span></div>
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
                {!layers.length && <button className={`text-clip empty ${isSelected(scene.id) ? 'selected' : ''}`} aria-label={`Add text to ${scene.name}`} onClick={event => { selectScene(scene, event); setTab('text'); setTextFocus(value => value + 1); }} title="Add text to this scene"><span className="text-clip-inner"><Type size={10} /><span>{t('Add text')}</span></span></button>}
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
          {[{ label: 'Overlays', media: true, items: orderedLayers.filter(e => e.kind === 'image' || e.kind === 'video') }, { label: 'Elements', media: false, items: orderedLayers.filter(e => e.kind !== 'image' && e.kind !== 'video') }].filter(group => !group.media || group.items.length > 0).map(group => <div key={group.label} className={`timeline-row ${group.media ? 'media-overlay-row' : 'element-row'} ${collapsed(group.media ? 'overlays' : 'elements') ? 'collapsed' : ''}`} role="group" aria-label={`${group.label} track`}>
            <div className="track-label"><LaneToggle id={group.media ? 'overlays' : 'elements'} label={t(group.label)} collapsed={collapsed(group.media ? 'overlays' : 'elements')} toggle={toggleLane} />{group.media ? <Layers size={14} /> : <Shapes size={14} />}<span>{t(group.label)}</span><span className="track-number">{String(group.media ? 2 : hasMediaOverlays ? 3 : 2).padStart(2, '0')}</span></div>
            <div className="tracks"><div className="element-track overlay-track" style={{ height: Math.max(34, group.items.length * 29 + 8), position: 'relative' }}>{group.items.map((saved, index) => {
              const element = overlayDraft?.id === saved.id ? overlayDraft : saved;
              const start = element.startTicks, end = start + element.durationTicks;
              const span = scenes.map((scene, sceneIndex) => ({ scene, sceneIndex })).filter(({ scene }) => scene.startTicks < end && scene.startTicks + scene.durationTicks > start);
              const spanLabel = span.length > 1 ? `S${span[0].sceneIndex + 1}–${span[span.length - 1].sceneIndex + 1}` : '';
              return <button key={element.id} className={`element-clip ${selectedElementId === element.id ? 'selected' : ''}`} style={{ left: `${element.startTicks / Math.max(1, projectTicks) * 100}%`, width: `${element.durationTicks / Math.max(1, projectTicks) * 100}%`, top: index * 29 + 4 }} aria-label={`Select ${group.media ? 'overlay' : 'element'} ${elementDisplayName(element)}`} aria-pressed={selectedElementId === element.id} onClick={event => { if (event.detail === 0) selectOverlay(element); }} onPointerDown={event => beginOverlayTiming(event, element, 'move')} title={`${elementDisplayName(element)} · ${ticksToSeconds(element.startTicks, project.timebase).toFixed(1)}–${ticksToSeconds(element.startTicks + element.durationTicks, project.timebase).toFixed(1)} s`}>
                <span className="overlay-trim start" onPointerDown={event => beginOverlayTiming(event, element, 'start')} aria-label="Trim overlay start" />
                {element.poster || element.kind === 'image' ? <AssetImage className="overlay-thumb" source={element.poster ?? element.source} alt="" fallback={<span className="overlay-thumb missing" />} /> : <ElementGlyph presetId={element.presetId} kind={element.kind} size={12} />}<span>{elementDisplayName(element)}</span>{element.action && <span className="overlay-action-region" style={{ left: `${element.action.startTicks / element.durationTicks * 100}%`, width: `${element.action.durationTicks / element.durationTicks * 100}%` }} title={`${element.action.kind}${element.action.sound ? ' + sound' : ''}`} />}
                <span className="layer-badge" title={`Layer ${layerNumbers.get(saved.id) ?? '?'} of ${orderedLayers.length}${spanLabel ? ` · covers scenes ${span[0].sceneIndex + 1}–${span[span.length - 1].sceneIndex + 1}` : ''}`}>L{layerNumbers.get(saved.id) ?? '?'}{spanLabel && <small>{spanLabel}</small>}</span>
                <span className="overlay-trim end" onPointerDown={event => beginOverlayTiming(event, element, 'end')} aria-label="Trim overlay end" />
              </button>;
            })}</div></div>
            <div className="timeline-add-slot"><button className="add-clip" aria-label="Add element" disabled={!canEdit || !selectedScene} onClick={() => setTab('elements')}><Plus size={16} /></button></div>
          </div>)}
          <div className={`timeline-row video-row ${collapsed('visuals') ? 'collapsed' : ''}`} role="group" aria-label="Visuals track">
            <div className="track-label"><LaneToggle id="visuals" label={t('Visuals')} collapsed={collapsed('visuals')} toggle={toggleLane} /><Film size={14} /><span>{t('Visuals')}</span><span className="track-number">01</span></div>
            <div className="tracks"><div className="scene-track">{scenes.map((scene, i) => {
              const display = previewScene?.id === scene.id ? previewScene : scene;
              const displayDuration = sceneSeconds(display, project.timebase);
              const fadeIn = Math.min(displayDuration, Math.max(0, display.fadeIn ?? 0));
              const fadeOut = Math.min(displayDuration, Math.max(0, display.fadeOut ?? 0));
              return <button key={scene.id} data-scene-id={scene.id} draggable={canEdit} aria-label={`Scene ${i + 1}: ${scene.name}, ${ticksToSeconds(scene.startTicks, project.timebase).toFixed(2)} to ${ticksToSeconds(scene.startTicks + scene.durationTicks, project.timebase).toFixed(2)} seconds${scene.mediaKind === 'video' ? ', video' : ''}`} aria-pressed={isSelected(scene.id)} aria-current={active?.id === scene.id ? 'true' : undefined} className={`timeline-clip ${isSelected(scene.id) ? 'selected' : ''} ${selectedScene?.id === scene.id ? 'primary' : ''} ${active?.id === scene.id ? 'current' : ''} ${dropTarget === scene.id ? 'drop-target' : ''} ${reorderId === scene.id ? 'dragging' : ''} ${replacingSceneId === scene.id ? 'replacing' : ''} ${previewScene?.id === scene.id ? 'trimming' : ''}`} aria-busy={replacingSceneId === scene.id} style={{ flexGrow: display.durationTicks }} onClick={event => selectScene(scene, event)} onDragStart={event => beginReorder(event, scene)} onDragEnd={endReorder} onDragOver={event => dragOverScene(event, scene.id)} onDragLeave={() => setDropTarget(current => current === scene.id ? null : current)} onDrop={event => dropScene(event, scene)} onContextMenu={event => { event.preventDefault(); if (!selectedIds.includes(scene.id)) { setSelectedIds([scene.id]); setPrimarySelected(scene.id); selectionAnchor.current = scene.id; } setPlaying(false); setContextMenu({ x: event.clientX, y: event.clientY }); }}>
                <ClipFilmstrip className="timeline-filmstrip" source={scene.mediaKind === 'video' ? (scene.videoPoster ?? scene.image) : scene.image} />
                <div><span>{String(i + 1).padStart(2, '0')} <b>{scene.name}</b></span><small>{displayDuration.toFixed(1)}s</small></div>
                {scene.mediaKind === 'video' && <span className="clip-media-badge"><Film size={9} /> VIDEO</span>}
                <span className="layer-badge base" title="Base visual layer">L0</span>
                {scene.transition && <span className="clip-transition" title={`${TRANSITION_OPTIONS.find(option => option.id === scene.transition?.type)?.label ?? 'Transition'} · ${scene.transition.duration.toFixed(1)} s`}><Sparkles size={9} />{scene.transition.duration.toFixed(1)}s</span>}
                <span className="fade-shade in" style={{ width: `${(fadeIn / displayDuration) * 100}%` }} aria-hidden="true" />
                <span className="fade-shade out" style={{ width: `${(fadeOut / displayDuration) * 100}%` }} aria-hidden="true" />
                <span className="fade-handle in" style={{ left: `calc(${Math.min((fadeIn / displayDuration) * 100, 96)}% + 3px)` }} title={`Fade in ${fadeIn.toFixed(1)} s — drag to adjust`} aria-hidden="true" onPointerDown={event => beginFadeDrag(event, scene, 'in')} onClick={event => event.stopPropagation()} />
                <span className="fade-handle out" style={{ right: `calc(${Math.min((fadeOut / displayDuration) * 100, 96)}% + 3px)` }} title={`Fade out ${fadeOut.toFixed(1)} s — drag to adjust`} aria-hidden="true" onPointerDown={event => beginFadeDrag(event, scene, 'out')} onClick={event => event.stopPropagation()} />
                <span className="clip-trim left" title={`Trim the start · ${ticksToSeconds(scene.sourceInTicks ?? 0, project.timebase).toFixed(1)} s in`} aria-hidden="true" onPointerDown={event => beginSceneTrim(event, scene, 'left')} onClick={event => event.stopPropagation()} />
                <span className="clip-trim right" title={`Trim the end · ${displayDuration.toFixed(1)} s`} aria-hidden="true" onPointerDown={event => beginSceneTrim(event, scene, 'right')} onClick={event => event.stopPropagation()} />
                {fadeDrag?.sceneId === scene.id && <span className="fade-drag-label" aria-hidden="true">{fadeDrag.side === 'in' ? 'Fade in' : 'Fade out'} {fadeDrag.value.toFixed(1)} s</span>}
              </button>;
            })}</div></div><div className="timeline-add-slot"><button className="add-clip" aria-label="Add images to timeline" disabled={!canEdit} onClick={() => void chooseImages()}><Plus size={20} /></button></div>
          </div>
          {videoScenes.length > 0 && <div className={`timeline-row video-audio-row ${audioDisplay} ${collapsed('video-audio') ? 'collapsed' : ''}`} role="group" aria-label="Video audio track">
            <div className="track-label audio-mixer">
              <div className="track-label-head"><LaneToggle id="video-audio" label={t('Video audio')} collapsed={collapsed('video-audio')} toggle={toggleLane} /><Film size={14} /><span>{t('Video audio')}</span></div>
              <div className="track-volume">
                <button className={`track-mute ${audioMix.video > 0 ? '' : 'muted'}`} aria-label={audioMix.video > 0 ? 'Mute video audio' : 'Unmute video audio'} aria-pressed={audioMix.video === 0} disabled={!canEdit} onClick={() => { setVideoAudioLevel(audioMix.video > 0 ? 0 : 1); commitMix(); }}>{audioMix.video > 0 ? <Volume2 size={11} /> : <VolumeX size={11} />}</button>
                <input aria-label="Video audio volume" type="range" min="0" max="100" step="1" value={Math.round(audioMix.video * 100)} disabled={!canEdit} onChange={event => setVideoAudioLevel(Number(event.target.value) / 100)} onPointerUp={commitMix} onKeyUp={commitMix} onBlur={commitMix} />
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
                  aria-label={`Video audio in ${scene.name}, ${ticksToSeconds(scene.startTicks, project.timebase).toFixed(2)} to ${ticksToSeconds(scene.startTicks + scene.durationTicks, project.timebase).toFixed(2)} seconds`}
                  aria-pressed={active}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${scene.name} · linked to the picture · trimming or splitting changes both`}
                  onClick={() => selectScene(scene, undefined, false)}
                  onPointerDown={event => event.currentTarget.focus({ preventScroll: true })}
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectScene(scene, undefined, false); } }}
                >
                  <span className="audio-trim left" title="Drag to trim the start" onPointerDown={event => beginSceneTrim(event, scene, 'left')} onClick={event => event.stopPropagation()} />
                  {audioDisplay === 'spectrogram'
                    ? <Spectrogram data={display.image} sourceInSeconds={sourceIn} durationSeconds={sourceSpanSeconds} sourceDurationSeconds={sourceDuration} showStatus={false} />
                    : <Waveform clipId={display.id} data={display.image} sourceInSeconds={sourceIn} durationSeconds={sourceSpanSeconds} sourceDurationSeconds={sourceDuration} />}
                  <Film size={10} /><span className="audio-name">{scene.name}</span><small>{level}%</small>
                  {active && <span className="clip-volume" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
                    <Volume2 size={9} />
                    <input aria-label={`${scene.name} sound level`} type="range" min="0" max="100" step="1" value={videoVolumeDraft?.id === scene.id ? videoVolumeDraft.value : level} onChange={event => stageVideoVolume(scene, Number(event.target.value))} onPointerUp={event => { commitVideoVolume(scene, Number(event.currentTarget.value)); }} onKeyUp={event => commitVideoVolume(scene, Number(event.currentTarget.value))} onBlur={event => commitVideoVolume(scene, Number(event.currentTarget.value))} />
                  </span>}
                  <span className="audio-trim right" title="Drag to trim the end" onPointerDown={event => beginSceneTrim(event, scene, 'right')} onClick={event => event.stopPropagation()} />
                </div>;
              })}
            </div></div>
            <div className="timeline-add-slot"><button className="add-clip" aria-label="Add video to the timeline" disabled={!canEdit} onClick={() => setTab('media')}><Plus size={16} /></button></div>
          </div>}
          <div className={`timeline-row pip-row ${collapsed('pip') ? 'collapsed' : ''}`} role="group" aria-label="Picture in picture track">
            <div className="track-label"><LaneToggle id="pip" label={t('Picture in picture')} collapsed={collapsed('pip')} toggle={toggleLane} /><Layers size={14} /><span>{t('Picture in picture')}</span><span className="track-number">02</span></div>
            <div className="tracks"><div className="pip-track element-track overlay-track" style={{ height: 38, position: 'relative' }}>
              {renderPipScenes.map(clip => <button key={clip.id} className={`element-clip ${selectedPipId === clip.id ? 'selected' : ''}`} style={{ left: `${clip.startTicks / Math.max(1, projectTicks) * 100}%`, width: `${clip.durationTicks / Math.max(1, projectTicks) * 100}%`, top: 4 }} aria-label={`Picture in picture ${clip.name}, ${ticksToSeconds(clip.startTicks, project.timebase).toFixed(2)} to ${ticksToSeconds(clip.startTicks + clip.durationTicks, project.timebase).toFixed(2)} seconds`} aria-pressed={selectedPipId === clip.id} onClick={() => selectPip(clip)} onPointerDown={event => beginPipTiming(event, clip, 'move')} title={`${clip.name} · drag to move, drag the edges to trim`}>
                <span className="overlay-trim start" onPointerDown={event => beginPipTiming(event, clip, 'start')} aria-label="Trim picture-in-picture start" />
                <AssetImage className="overlay-thumb" source={clip.videoPoster ?? clip.image} alt="" fallback={<span className="overlay-thumb missing" />} />
                <span>{clip.name}</span>
                <span className="overlay-trim end" onPointerDown={event => beginPipTiming(event, clip, 'end')} aria-label="Trim picture-in-picture end" />
              </button>)}
              {!renderPipScenes.length && <span className="audio-empty">{t('Pick a media tile → Picture in picture')}</span>}
            </div></div>
            <div className="timeline-add-slot"><button className="add-clip" aria-label="Add picture in picture" disabled={!canEdit} onClick={() => setTab('media')}><Plus size={16} /></button></div>
          </div>
          {audioLanes.map((lane, laneIndex) => {
            const laneMix = audioLaneMix({ audioMix }, lane);
            return <div className={`timeline-row audio-row ${audioDisplay} ${collapsed(`audio-${lane}`) ? 'collapsed' : ''}`} role="group" aria-label={`Audio track ${laneIndex + 1}`} key={lane}>
            <div className="track-label audio-mixer">
              <div className="track-label-head"><LaneToggle id={`audio-${lane}`} label={`${t('Audio')} ${laneIndex + 1}`} collapsed={collapsed(`audio-${lane}`)} toggle={toggleLane} /><Music size={14} /><span>{t('Audio')} {laneIndex + 1}</span><span className="track-number">{String((hasMediaOverlays ? 6 : 5) + laneIndex).padStart(2, '0')}</span></div>
              <div className="track-volume">
                <button className={`track-mute ${laneMix.muted ? 'muted' : ''}`} aria-label={`${laneMix.muted ? 'Unmute' : 'Mute'} audio track ${laneIndex + 1}`} aria-pressed={laneMix.muted} disabled={!canEdit} onClick={() => toggleLaneMute(lane)}>{laneMix.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}</button>
                <input aria-label={`Audio track ${laneIndex + 1} volume`} type="range" min="0" max="100" step="1" value={Math.round(laneMix.volume * 100)} disabled={!canEdit || laneMix.muted} onChange={event => setLaneMix(lane, { volume: Number(event.target.value) / 100 })} onPointerUp={commitMix} onKeyUp={commitMix} onBlur={commitMix} />
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
                  aria-label={`Audio clip ${clip.name}, ${ticksToSeconds(clip.startTicks, project.timebase).toFixed(2)} to ${ticksToSeconds(clip.startTicks + clip.durationTicks, project.timebase).toFixed(2)} seconds`}
                  aria-pressed={selected}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${clip.name} · drag to move · drag edges to trim`}
                  onClick={() => focusAudio(clip)}
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); focusAudio(clip); } }}
                  onPointerDown={event => beginAudioMove(event, clip)}
                >
                  <span className="audio-trim left" title="Drag to trim the start" onPointerDown={event => beginAudioTrim(event, clip, 'left')} />
                  {audioDisplay === 'spectrogram' ? <>
                  <Spectrogram
                    data={clip.data}
                    sourceInSeconds={clip.sourceInSeconds}
                    durationSeconds={ticksToSeconds(clip.durationTicks, project.timebase)}
                    sourceDurationSeconds={clip.sourceDurationSeconds}
                  />
                  </> : <>
                  <Waveform
                    clipId={clip.id}
                    data={clip.data}
                    sourceInSeconds={clip.sourceInSeconds}
                    durationSeconds={ticksToSeconds(clip.durationTicks, project.timebase)}
                    sourceDurationSeconds={clip.sourceDurationSeconds}
                  />
                  </>}
                  <Music size={10} /><span className="audio-name">{clip.name}</span><small>{Math.round(clip.volume * 100)}%</small>
                  {selected && <span className="clip-volume" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
                    <Volume2 size={9} />
                    <input aria-label={`${clip.name} volume`} type="range" min="0" max="100" step="1" value={Math.round(clip.volume * 100)} onChange={event => stageAudio({ volume: Number(event.target.value) / 100 })} onPointerUp={commitAudio} onKeyUp={commitAudio} onBlur={commitAudio} />
                  </span>}
                  <span className="audio-trim right" title="Drag to trim the end" onPointerDown={event => beginAudioTrim(event, clip, 'right')} />
                </div>;
              })}
              {!audio.some(clip => (clip.lane ?? 0) === lane) && <span className="audio-empty">{t('Empty audio track')}</span>}
            </div></div>
            <div className="timeline-add-slot"><button className="add-clip audio-add" aria-label={`Add audio to track ${laneIndex + 1}`} disabled={!canEdit || !projectTicks} onClick={() => { audioLaneRef.current = lane; void chooseAudio(); }}><Plus size={16} /></button></div>
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
