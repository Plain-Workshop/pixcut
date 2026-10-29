import { constrainPipTiming, freePipStart } from '../../components/timeline/pip';
import { AssetImage } from '../../components/preview/AssetImage';
import { t } from '../../i18n';
import { Copy, ImagePlus, Layers, Settings2, Trash2 } from 'lucide-react';
import { IconButton } from '../../components/IconButton';
import { SceneForm } from '../../components/inspector/SceneForm';
import { RangeField } from '../../components/inspector/NumberField';
import { useLayout } from '../layout-store';
import { useEditorActions } from '../editor-actions';
import { useEditorModel } from '../editor-model';
import { useEditorView } from '../editor-view';
import { useSelection } from '../selection-store';
import { minTicks, sceneSeconds, secondsPerTick, secondsToTicks, ticksToSeconds, type AudioClip, type Scene, type ScenePatchKey, type TextLayer, type FormatVariant, type ElementLayer } from '../../stores/model';
import type { Dispatch, SetStateAction, ReactElement, RefObject } from 'react';
import type { InspectorKind } from '../inspector';

export function InspectorPanel({ selectedAudio, activeFormat, framingMode, setEditingText, propertyKind, setSelectedIds, setPrimarySelected, selectionAnchor, audioInspector, elementInspector, inspectorScene, setGlobalTextDraft, setPreviewScene, propertyClipboard, textStartTicks, textLayerLocal, previewLocalSeconds, textFocus, setFramingMode, renderOverlays }: {
  selectedAudio: AudioClip;
  activeFormat: FormatVariant;
  framingMode: boolean;
  setEditingText: Dispatch<SetStateAction<boolean>>;
  propertyKind: InspectorKind;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  setPrimarySelected: Dispatch<SetStateAction<string | null>>;
  selectionAnchor: RefObject<string | null>;
  audioInspector: ReactElement;
  elementInspector: ReactElement | null;
  inspectorScene: Scene | null;
  setGlobalTextDraft: Dispatch<SetStateAction<TextLayer[] | null>>;
  setPreviewScene: Dispatch<SetStateAction<Scene | null>>;
  propertyClipboard: Partial<Scene> | null;
  textStartTicks: number;
  textLayerLocal: number;
  previewLocalSeconds: number;
  textFocus: number;
  setFramingMode: Dispatch<SetStateAction<boolean>>;
  renderOverlays: ElementLayer[];
}) {
  const { canEdit, projectTicks, project, scenes, preferences } = useEditorModel();
  const { selectedScene, selectedGlobalText, selectedPip, selectedCount, activePip, pipScenes, selectedTextScene, hasSceneSelection } = useEditorView();
  const { selectedTextLayerId } = useSelection();
  const { selectTextLayer, tip, removePip, stagePip, commitPip, stagePipStyle, removeAudio, updateSelection, copySceneProperties, notifyPasted, inspectorFlush, requestReplaceImage, applyFramingToAllFormats, reorderLayer, deleteSelected, duplicateSelected } = useEditorActions();
  const { inspectorWidth, beginResize } = useLayout();
  return (
    <>
        <div className="splitter vertical" onPointerDown={e => beginResize('inspector', inspectorWidth, e.clientX)} />
      
        <aside className="inspector" aria-label={t('Selected item properties')} style={{ width: inspectorWidth }}>
          <div className="inspector-heading">
            {propertyKind === 'scene' && selectedScene && !selectedPip && selectedCount === 1
              ? <AssetImage className="inspector-heading-thumb" source={selectedScene.mediaKind === 'video' ? (selectedScene.videoPoster ?? selectedScene.image) : selectedScene.image} alt="" fallback={<span className="inspector-heading-thumb missing" />} />
              : <span className="inspector-heading-icon"><Settings2 size={15} /></span>}
            <div className="inspector-heading-text">
              {propertyKind === 'scene' && selectedScene && !selectedPip && selectedCount === 1
                ? <><h2 title={selectedScene.name}>{selectedScene.name || t('Untitled clip')}</h2><small>{selectedScene.mediaKind === 'video' ? t('Video') : t('Photo')} {String(scenes.findIndex(scene => scene.id === selectedScene.id) + 1).padStart(2, '0')} · {sceneSeconds(selectedScene, project.timebase).toFixed(1)} s</small></>
                : <><h2>{selectedPip ? t('Picture in picture') : t(({scene: selectedScene?.mediaKind === 'video' ? 'Video properties' : 'Scene properties', text:'Text properties', element:'Element properties', audio:'Audio properties', none:'Properties'})[propertyKind])}</h2>
                  {propertyKind === 'scene' && selectedCount > 1 && <small>{t('{count} clips selected', { count: selectedCount })}</small>}</>}
            </div>
            {propertyKind === 'scene' && selectedScene && !selectedPip && selectedCount === 1 && !selectedGlobalText && <button type="button" className="button subtle inspector-replace" disabled={!canEdit} aria-label={t('Replace selected scene media')} title={t('Replace media…')} onClick={() => requestReplaceImage()}><ImagePlus size={14} /> {t('Replace')}</button>}
          </div>
          {propertyKind === 'scene' && selectedCount > 1 && <div className="multi-select-banner"><span><Layers size={13} /> {t('Editing {count} clips', { count: selectedCount })}</span><button className="text-button" onClick={() => { if(selectedScene){setSelectedIds([selectedScene.id]);setPrimarySelected(selectedScene.id);selectionAnchor.current=selectedScene.id;} }}>{t('Edit only this clip')}</button></div>}
          {selectedPip && activePip && activePip.pip ? <fieldset disabled={!canEdit} className="inspector-fields">
            <div className="inspector-item-actions"><strong>{activePip.name}</strong><button className="icon-button danger" aria-label={t('Delete picture in picture')} onClick={() => removePip(activePip.id)}><Trash2 size={15} /></button></div>
            <p className="note">Its own visual track over the base story. It never extends the timeline and its own audio is muted.</p>
            <RangeField label="Start" sliderLabel="Picture-in-picture start" unit="s" min={0} max={Math.max(0, ticksToSeconds(projectTicks - activePip.durationTicks, project.timebase))} step={secondsPerTick(project.timebase)} value={ticksToSeconds(activePip.startTicks, project.timebase)} onChange={v => { const desired = secondsToTicks(v, project.timebase); const start = freePipStart(pipScenes.filter(clip => clip.id !== activePip.id), desired, activePip.durationTicks, projectTicks); if (start !== null) stagePip({ startTicks: start }); }} onCommit={commitPip} />
            <RangeField label="Duration" sliderLabel="Picture-in-picture duration" unit="s" min={Math.max(secondsPerTick(project.timebase), ticksToSeconds(minTicks(project.timebase), project.timebase))} max={Math.max(secondsPerTick(project.timebase), Math.min(ticksToSeconds(projectTicks - activePip.startTicks, project.timebase), activePip.sourceDurationSeconds ?? 600))} step={secondsPerTick(project.timebase)} value={ticksToSeconds(activePip.durationTicks, project.timebase)} onChange={v => { const wanted = secondsToTicks(v, project.timebase); stagePip(constrainPipTiming(activePip, 'end', wanted - activePip.durationTicks, pipScenes, projectTicks, project.timebase, minTicks(project.timebase))); }} onCommit={commitPip} />
            <RangeField label="Width" sliderLabel="Picture-in-picture width" unit="%" min={5} max={100} step={1} value={Math.round(activePip.pip.width * 100)} onChange={v => stagePipStyle('width', v / 100)} onCommit={commitPip} />
            <RangeField label="Height" sliderLabel="Picture-in-picture height" unit="%" min={5} max={100} step={1} value={Math.round(activePip.pip.height * 100)} onChange={v => stagePipStyle('height', v / 100)} onCommit={commitPip} />
            <RangeField label="Horizontal" sliderLabel="Picture-in-picture horizontal" unit="%" min={0} max={100} step={1} value={Math.round(activePip.pip.x * 100)} onChange={v => stagePipStyle('x', v / 100)} onCommit={commitPip} />
            <RangeField label="Vertical" sliderLabel="Picture-in-picture vertical" unit="%" min={0} max={100} step={1} value={Math.round(activePip.pip.y * 100)} onChange={v => stagePipStyle('y', v / 100)} onCommit={commitPip} />
            <RangeField label="Corner radius" sliderLabel="Picture-in-picture corner radius" unit="%" min={0} max={50} step={1} value={Math.round(activePip.pip.radius * 100)} onChange={v => stagePipStyle('radius', v / 100)} onCommit={commitPip} />
            <RangeField label="Shadow" sliderLabel="Picture-in-picture shadow" unit="%" min={0} max={100} step={1} value={Math.round(activePip.pip.shadow)} onChange={v => stagePipStyle('shadow', v)} onCommit={commitPip} />
            <label className="field">{t('Fill')}<select aria-label={t('Picture-in-picture fill')} value={activePip.fit} onChange={event => { stagePip({ fit: event.target.value as Scene['fit'] }); window.setTimeout(commitPip, 0); }}><option value="cover">{t('Fill frame')}</option><option value="contain">{t('Fit whole image')}</option><option value="blur">{t('Blur fill')}</option></select></label>
          </fieldset> : propertyKind === 'audio' && selectedAudio ? <fieldset disabled={!canEdit} className="inspector-fields"><div className="inspector-item-actions"><strong>{selectedAudio.name}</strong><button className="icon-button danger" aria-label={t('Delete selected audio')} onClick={() => removeAudio(selectedAudio.id)}><Trash2 size={15} /></button></div>{audioInspector}</fieldset> : propertyKind === 'element' ? <fieldset disabled={!canEdit} className="inspector-fields">{elementInspector}</fieldset> : (propertyKind === 'scene' || propertyKind === 'text') && selectedScene ? <fieldset disabled={!canEdit} className="inspector-fields">
            <SceneForm reduceMotion={preferences.reduceMotion} mode={propertyKind === 'text' ? 'text' : 'scene'} hasNextScene={Boolean(selectedScene && scenes.findIndex(scene => scene.id === selectedScene.id) < scenes.length - 1)} scene={selectedGlobalText && selectedTextScene ? selectedTextScene : inspectorScene!} timebase={project.timebase} update={updateSelection} onPreview={selectedGlobalText ? (next: Scene | null) => setGlobalTextDraft(next?.textLayers ?? null) : setPreviewScene} onCopyProperties={copySceneProperties} propertyClipboard={propertyClipboard} onPasteProperties={notifyPasted} flushRef={inspectorFlush} sceneCount={scenes.length} onApplyToAll={selectedGlobalText ? undefined : (next: Scene, keys: ScenePatchKey[]) => updateSelection(next, keys, 'all')} textLayerId={selectedGlobalText ? selectedGlobalText.id : selectedTextLayerId} onSelectTextLayer={selectTextLayer} textStartTicks={textStartTicks} playheadSeconds={selectedGlobalText ? Math.max(0, textLayerLocal) : previewLocalSeconds} focusText={textFocus} framingActive={framingMode} onToggleFraming={() => { setFramingMode(value => !value); setEditingText(false); }} formatName={activeFormat?.name ?? 'Original'} formatCount={project.formats.length} onApplyFramingToAll={applyFramingToAllFormats} overlays={renderOverlays} onReorderLayer={reorderLayer} />
            {propertyKind === 'text' && <div className="inspector-item-actions"><button className="button danger" aria-label={t('Delete selected text layer')} onClick={deleteSelected}><Trash2 size={14} /> Delete text layer</button></div>}
            {propertyKind === 'scene' && hasSceneSelection && <div className="scene-actions compact-scene-actions"><IconButton label={tip('clip.duplicate', 'Duplicate clip')} onClick={duplicateSelected}><Copy size={16} /></IconButton><IconButton label={tip('clip.delete', 'Delete selected scene')} onClick={deleteSelected}><Trash2 size={16} /></IconButton></div>}
          </fieldset> : <div className="inspector-empty"><Settings2 size={26} /><p>{t('Select a scene, text layer, element or audio clip to edit its properties.')}</p></div>}
      
        </aside>
    </>
  );
}
