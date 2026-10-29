import { elementTransform } from '../../components/elements/transform';
import { applyElementMotion } from '../../components/animation/keyframes';
import { type TimelineOverlay } from '../../components/elements/overlays';
import { t } from '../../i18n';
import { ArrowRight, Camera, Check, Film, Layers, Maximize2, Pause, Play, Plus, Repeat, SkipBack, Type } from 'lucide-react';
import { IconButton } from '../../components/IconButton';
import { useEditorActions } from '../editor-actions';
import { useEditorModel } from '../editor-model';
import { useEditorView } from '../editor-view';
import { useSelection } from '../selection-store';
import { ticksToSeconds, timecode, type FormatVariant } from '../../stores/model';
import { sceneTextTitle } from '../../components/text/layers';
import { SAMPLE_TEMPLATE } from '../../templates/catalog';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import { elementDisplayName } from '../../components/elements/catalog';

export function PreviewPanel({ setModal, playing, modal, position, allOverlays, safeArea, activeFormat, setActiveFormatId, previewArea, previewStage, previewSize, preview, sceneVideo, setVideoTick, pipVideoElements, setPipVideoTick, snapGuides, framingMode, textBox, selectedTextVisible, selectedElement, editingText, setTextDraft, setEditingText, overlayDraft, sceneLayerRank, textDraft, fadeAmount, setPosition, setPlaying, loop, setLoop }: {
  setModal: Dispatch<SetStateAction<"templates" | "source" | "export" | "new" | "shortcuts" | "palette" | "settings" | "delete" | "rename" | "group" | "groups" | "formats" | "missing" | null>>;
  playing: boolean;
  modal: "templates" | "source" | "export" | "new" | "shortcuts" | "palette" | "settings" | "delete" | "rename" | "group" | "groups" | "formats" | "missing" | null;
  position: number;
  allOverlays: TimelineOverlay[];
  safeArea: boolean;
  activeFormat: FormatVariant;
  setActiveFormatId: Dispatch<SetStateAction<string | null>>;
  previewArea: RefObject<HTMLDivElement | null>;
  previewStage: RefObject<HTMLDivElement | null>;
  previewSize: { width: number; height: number; } | null;
  preview: RefObject<HTMLCanvasElement | null>;
  sceneVideo: RefObject<HTMLVideoElement | null>;
  setVideoTick: Dispatch<SetStateAction<number>>;
  pipVideoElements: RefObject<Map<string, HTMLVideoElement>>;
  setPipVideoTick: Dispatch<SetStateAction<number>>;
  snapGuides: { x: number | null; y: number | null; };
  framingMode: boolean;
  textBox: { hasText: boolean; leftPct: number; topPct: number; widthPct: number; heightPct: number; rotation: number; } | null;
  selectedTextVisible: boolean;
  selectedElement: TimelineOverlay | null;
  editingText: boolean;
  setTextDraft: Dispatch<SetStateAction<{ title: string; subtitle: string; }>>;
  setEditingText: Dispatch<SetStateAction<boolean>>;
  overlayDraft: TimelineOverlay | null;
  sceneLayerRank: Map<string, number>;
  textDraft: { title: string; subtitle: string; };
  fadeAmount: number;
  setPosition: Dispatch<SetStateAction<number>>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  loop: boolean;
  setLoop: Dispatch<SetStateAction<boolean>>;
}) {
  const { canEdit, project, activeSize, duration, frameSeconds } = useEditorModel();
  const { selectedScene, previewTarget, pipVideoScenes, selectedTextLayer, selectedGlobalText } = useEditorView();
  const { selectedElementId } = useSelection();
  const { chooseImages, chooseTemplate, selectOverlay, tip, runCommandId, saveStillFrame, togglePreviewFullscreen, beginImagePan, beginTextMove, beginTextResize, beginElementMove, beginElementRotate, beginElementResize, previewInlineText, blurInlineText, cancelInlineText, commitInlineText, shortcutText, scrubTo, togglePlayback } = useEditorActions();
  return (
    <>
        <main className="preview-panel">
          <div className="preview-heading">
            <span>{t('PREVIEW')}</span>
            <div>
              <span className="offline"><span />{t('Local only')}</span>
              <button className="text-button" title={tip('view.safe_area', `Safe area ${safeArea ? 'on' : 'off'}`)} onClick={() => runCommandId('view.safe_area')}>{t('Safe area')} {safeArea ? t('on') : t('off')}</button>
              <select aria-label={t('Output format')} value={activeFormat?.id ?? ''} disabled={!canEdit} onChange={event => setActiveFormatId(event.target.value)}>{project.formats.map(format => <option key={format.id} value={format.id}>{format.name} · {format.aspect}</option>)}</select>
              <button className="format-manage-button" onClick={() => setModal('formats')}><Layers size={13} /> {t('Formats')} <span>{project.formats.length}</span></button>
              {previewTarget && <IconButton label={t('Save still frame · {width} × {height} PNG', { width: activeSize.width, height: activeSize.height })} onClick={() => void saveStillFrame()}><Camera size={15} /></IconButton>}
              <IconButton label="Fullscreen preview" onClick={togglePreviewFullscreen}><Maximize2 size={15} /></IconButton>
            </div>
          </div>
          <div className="preview-area" ref={previewArea}>
            {previewTarget ? <div className="preview-stage" data-dialog-open={Boolean(modal)} inert={Boolean(modal)} ref={previewStage} style={previewSize ? { width: previewSize.width, height: previewSize.height } : undefined}>
              <canvas ref={preview} className="preview-canvas" aria-label={t('Preview: {name}', { name: sceneTextTitle(previewTarget) || previewTarget.name })} />
              <video ref={sceneVideo} className="scene-video" playsInline preload="auto" aria-hidden="true" onLoadedData={() => setVideoTick(value => value + 1)} onSeeked={() => setVideoTick(value => value + 1)} />
              {pipVideoScenes.map(clip => <video
                key={clip.id}
                ref={node => { if (node) pipVideoElements.current.set(clip.id, node); else pipVideoElements.current.delete(clip.id); }}
                className="scene-video"
                playsInline
                preload="auto"
                muted
                aria-hidden="true"
                onLoadedData={() => setPipVideoTick(value => value + 1)}
                onSeeked={() => setPipVideoTick(value => value + 1)}
              />)}
              {snapGuides.x !== null && <span className="snap-guide vertical" style={{ left: `${snapGuides.x * 100}%` }} aria-hidden="true" />}
              {snapGuides.y !== null && <span className="snap-guide horizontal" style={{ top: `${snapGuides.y * 100}%` }} aria-hidden="true" />}
              {selectedScene && framingMode && canEdit && <div className="image-framing-overlay" onPointerDown={beginImagePan} title={t('Drag to choose the visible part of the image')}>
                <span className="framing-grid" aria-hidden="true" />
                <span className="framing-hint">{t('Drag to reposition · adjust zoom and letterbox in the inspector')}</span>
              </div>}
              {selectedScene && selectedTextLayer && !selectedGlobalText && textBox?.hasText && selectedTextVisible && !selectedElement && canEdit && !editingText && !framingMode && <div
                className="text-box"
                style={{ left: `${textBox.leftPct}%`, top: `${Math.max(0, textBox.topPct - .7)}%`, width: `${textBox.widthPct}%`, height: `${Math.max(7, textBox.heightPct + 1.4)}%`, transform: `rotate(${textBox.rotation}deg)` }}
                title={t('Drag to move · drag the edge handles to resize · double-click to edit')}
                onPointerDown={beginTextMove}
                onDoubleClick={event => { event.stopPropagation(); setTextDraft({ title: selectedTextLayer.title, subtitle: selectedTextLayer.subtitle }); setEditingText(true); }}
              >
                <span className="text-box-handle left" onPointerDown={event => beginTextResize(event, 'left')} />
                <span className="text-box-handle right" onPointerDown={event => beginTextResize(event, 'right')} />
                <span className="text-box-label">{t('TEXT')}</span>
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
                return <div key={element.id} role="button" tabIndex={0} aria-label={t('Select overlay {element}', { element: elementDisplayName(element) })} aria-pressed={selected} className={`overlay-hitbox ${selected ? 'element-box' : ''}`} style={{ left: `${(shown.x + motion.x - shown.width / 2) * 100}%`, top: `${(shown.y + motion.y - shown.height / 2) * 100}%`, width: `${shown.width * 100}%`, height: `${shown.height * 100}%`, transform: `rotate(${shown.rotation + motion.rotation}deg) scale(${motion.scale})`, zIndex: (element.legacySceneId ? 4 : 100) + rank, pointerEvents: playing ? 'none' : undefined }} title={t('Drag to move {element}', { element: elementDisplayName(element) })} onClick={event => { if (event.detail === 0) selectOverlay(element, false); }} onPointerDown={event => beginElementMove(event, element)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectOverlay(element, false); } }}>{selected && <>
                  <span className="element-box-label">{element.kind === 'image' || element.kind === 'video' ? 'OVERLAY' : 'ELEMENT'}</span>
                  <span className="element-rotate-stem" aria-hidden="true" />
                  <span className="element-rotate-handle" title={t('Drag to rotate · hold Shift to snap to 15°')} onPointerDown={event => beginElementRotate(event, element)} />
                  {(['nw', 'ne', 'sw', 'se'] as const).map(corner => <span key={corner} className={`element-handle ${corner}`} title={t('Drag to resize · hold Shift to keep proportions')} onPointerDown={event => beginElementResize(event, element, corner)} />)}
                </>}</div>;
              })}
              {editingText && selectedScene && selectedTextLayer && !selectedGlobalText && textBox?.hasText && <div
                className="text-edit-overlay"
                style={{ left: `${Math.min(textBox.leftPct, 56)}%`, top: `${Math.min(textBox.topPct, 42)}%`, width: 'min(340px, 74%)' }}
              >
                <div className="text-edit-head"><span><Type size={12} /> Edit text</span><small>{selectedTextLayer.title ? 'Title and subtitle' : 'Add a title'}</small></div>
                <label className="inline-edit-field"><span>{t('Title')}</span><textarea aria-label={t('Edit title in preview')} rows={2} maxLength={120} value={textDraft.title} onChange={event => previewInlineText({ ...textDraft, title: event.target.value })} onBlur={blurInlineText} onKeyDown={event => { if (event.key === 'Escape') cancelInlineText(); }} autoFocus /></label>
                <label className="inline-edit-field"><span>Subtitle <em>optional</em></span><input aria-label={t('Edit subtitle in preview')} maxLength={200} value={textDraft.subtitle} onChange={event => previewInlineText({ ...textDraft, subtitle: event.target.value })} onBlur={blurInlineText} onKeyDown={event => { if (event.key === 'Escape') cancelInlineText(); if (event.key === 'Enter') { event.preventDefault(); commitInlineText(); } }} /></label>
                <div className="text-edit-actions"><button className="text-button" onClick={cancelInlineText}>{t('Cancel')}</button><button className="button primary" onClick={commitInlineText}><Check size={13} /> Done</button></div>
              </div>}
              {fadeAmount > 0.001 && <div className="preview-fade" style={{ opacity: fadeAmount }} aria-hidden="true" />}
              {safeArea && <div className="safe-area-overlay" aria-hidden="true" />}
            </div> : <div className="empty-preview">
              <Film size={40} /><h2>{t('Every story starts somewhere.')}</h2><p>{t('Add a few photos. Make them your own.')}</p>
              <button className="button primary" disabled={!canEdit} onClick={() => void chooseImages()}><Plus size={16} /> {t('Add your first images')}</button>
              <button className="text-button" disabled={!canEdit} onClick={() => chooseTemplate(SAMPLE_TEMPLATE)}>{t('Or explore a sample story')} <ArrowRight size={14} /></button>
            </div>}
          </div>
          <div className="preview-scrub"><input aria-label={t('Preview playhead')} title={t('Preview playhead · {previous} / {next} to step frames', { previous: shortcutText('timeline.prev_frame'), next: shortcutText('timeline.next_frame') })} type="range" min="0" max={Math.max(duration - frameSeconds, 0)} step={frameSeconds} value={position} disabled={!duration} onChange={e => scrubTo(Number(e.target.value))} /></div>
          <div className="preview-controls">
            <span className="timecode">{timecode(position, project.timebase)} <span>/ {timecode(duration, project.timebase)}</span></span>
            <div className="transport"><IconButton label="Return to start" onClick={() => { setPosition(0); setPlaying(false); }}><SkipBack size={17} /></IconButton><button className="play-button" disabled={!duration || !canEdit} title={tip('playback.toggle', playing ? 'Pause' : 'Play')} aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlayback}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button><IconButton className={loop ? 'active' : ''} label={loop ? t('Loop playback on') : t('Loop playback off')} onClick={() => setLoop(value => !value)}><Repeat size={16} /></IconButton></div>
            <span className="preview-quality">{([activeSize.width, activeSize.height] as [number, number]).join(' × ')} <Maximize2 size={13} /></span>
          </div>
        </main>
    </>
  );
}
