import { elementDisplayName } from '../../components/elements/catalog';
import { Play, Plus, Trash2 } from 'lucide-react';
import { t } from '../../i18n';
import { ELEMENT_CATALOG, elementPreset } from '../../components/elements/catalog';
import { presetSize } from '../../components/elements/designer';
import { ELEMENT_LABEL_DEFAULTS } from '../../components/elements/symbols';
import { ElementTextField } from '../../components/elements/ElementTextField';
import { StackOrder } from '../../components/inspector/StackOrder';
import { secondsPerTick, secondsToTicks, ticksToSeconds, type ElementLayer } from '../../stores/model';
import { SOUND_EFFECTS, type SoundEffectId } from '../../components/elements/sound-effects';
import { BehaviorControls } from '../../components/elements/BehaviorControls';
import { animationSelection, isContinuousMotion, ELEMENT_ANIMATIONS } from '../../components/elements/motion';
import { ElementPreview } from '../../components/elements/ElementPreview';
import { KeyframeControls } from '../../components/animation/KeyframeControls';
import { MaskControls } from '../../components/inspector/MaskControls';
import { ChromaControls } from '../../components/inspector/ChromaControls';
import { RangeField } from '../../components/inspector/NumberField';
import { type TimelineOverlay } from '../../components/elements/overlays';
import { type Preferences } from '../../stores/preferences';
import type { SoundId } from '../../components/elements/sound-catalog';
import type { StackEntry, StackMove } from '../../components/elements/stack';
import type { Project } from '../../stores/model';
import type { Dispatch, SetStateAction } from 'react';

const ELEMENT_COLORS = ['#9D7CFF', '#FF7A9E', '#FFD166', '#6BE7FF', '#7CF0B4', '#FFFFFF'];

export function ElementInspector({ activeSize, addSound, canEdit, commitElement, elementStackPosition, hoverEntrance, moveElementLayer, position, preferences, previewSound, project, projectTicks, removeElement, sceneLayerStack, selectedElement, setHoverEntrance, setPlaying, setPosition, setSoundEffect, soundEffect, stageElement, updateElement }: {
  activeSize: { width: number; height: number; };
  addSound: (id: SoundId, startTicks: number) => Promise<void>;
  canEdit: boolean;
  commitElement: () => void;
  elementStackPosition: (element: ElementLayer | TimelineOverlay) => number;
  hoverEntrance: string | null;
  moveElementLayer: (move: StackMove) => void;
  position: number;
  preferences: Preferences;
  previewSound: (id: SoundEffectId) => void;
  project: Project;
  projectTicks: number;
  removeElement: (id: string) => void;
  sceneLayerStack: StackEntry[];
  selectedElement: TimelineOverlay | null;
  setHoverEntrance: Dispatch<SetStateAction<string | null>>;
  setPlaying: Dispatch<SetStateAction<boolean>>;
  setPosition: Dispatch<SetStateAction<number>>;
  setSoundEffect: Dispatch<SetStateAction<SoundEffectId>>;
  soundEffect: SoundEffectId;
  stageElement: (patch: Partial<ElementLayer>, target?: TimelineOverlay | null) => void;
  updateElement: (patch: Partial<ElementLayer>) => void;
}) {
  return (selectedElement && <div className="element-controls">
                <div className="element-controls-head"><strong>{elementDisplayName(selectedElement)}</strong><button className="text-button danger" onClick={() => removeElement(selectedElement.id)}><Trash2 size={12} /> {t('Delete')}</button></div>
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
              </div>);
}
