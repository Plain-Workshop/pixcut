import { fileCount, formatCount, sceneCount, t } from '../../i18n';
import { ArrowRight, Check, Layers, LayoutTemplate, Plus } from 'lucide-react';
import { MAX_PROJECT_FORMATS, type FormatVariant } from '../../stores/model';
import { filterFormatGroups } from '../../stores/formats';
import { SAMPLE_TEMPLATE, type TemplateDefinition } from '../../templates/catalog';
import type { Dispatch, SetStateAction, ReactElement } from 'react';
import type { FormatQuality } from '../../stores/model';
import type { FormatOutputGroup } from '../../stores/formats';

export function NewProjectModal({ pendingTemplate, templateImage, canEdit, startTemplate, requestCloseModal, newProjectFps, setNewProjectFps, formatFilterChips, formatFilter, newFormatIds, setNewFormatIds, customFormatDraft, setCustomFormatDraft, newFormatSelection, addNewCustomFormat, newCustomFormats, newFormatOutputs, startWithFormats }: {
  pendingTemplate: TemplateDefinition | null;
  templateImage: (template: TemplateDefinition) => string;
  canEdit: boolean;
  startTemplate: (template: TemplateDefinition) => Promise<void>;
  requestCloseModal: () => void;
  newProjectFps: number;
  setNewProjectFps: Dispatch<SetStateAction<number>>;
  formatFilterChips: (onCustom?: () => void) => ReactElement;
  formatFilter: string;
  newFormatIds: string[];
  setNewFormatIds: Dispatch<SetStateAction<string[]>>;
  customFormatDraft: { name: string; width: number; height: number; fps: number; quality: "draft" | "standard" | "high"; };
  setCustomFormatDraft: Dispatch<SetStateAction<{ name: string; width: number; height: number; fps: number; quality: "draft" | "standard" | "high"; }>>;
  newFormatSelection: ({ name: string; presetId: string; platform: string; width: number; height: number; fps: number; quality: FormatQuality; } | FormatVariant)[];
  addNewCustomFormat: () => void;
  newCustomFormats: FormatVariant[];
  newFormatOutputs: FormatOutputGroup<{ name: string; presetId: string; platform: string; width: number; height: number; fps: number; quality: FormatQuality; } | FormatVariant>[];
  startWithFormats: () => Promise<void>;
}) {
  return (
    <>
      {pendingTemplate ? <>
        <h2 id="modal-title">{t('Start with {name}?', { name: t(pendingTemplate.name) })}</h2>
        <p>{t('Your current story is already saved in the local library. This template opens as a new project: {scenes} to edit.', { scenes: sceneCount(pendingTemplate.sceneCount) })}</p>
        <div className="template-confirm">
          <span className="template-confirm-art"><img src={templateImage(pendingTemplate)} alt="" /></span>
          <div><strong>{t(pendingTemplate.name)}</strong><small>{pendingTemplate.aspect} · {sceneCount(pendingTemplate.sceneCount)} · {pendingTemplate.duration.toFixed(1)} s</small><p>{t(pendingTemplate.description)}</p><span className="template-badges">{pendingTemplate.video && <span className="template-badge video">{t('VIDEO')}</span>}{pendingTemplate.audio && <span className="template-badge music">{t('MUSIC')}</span>}</span></div>
        </div>
        <div className="modal-actions">
          <button className="button primary" disabled={!canEdit} onClick={() => void startTemplate(pendingTemplate)}>{t('Start with {name}', { name: t(pendingTemplate.name) })} <ArrowRight size={15} /></button>
          <button className="button subtle" onClick={requestCloseModal}>{t('Cancel')}</button>
        </div>
      </> : <>
        <h2 id="modal-title">{t('A fresh start.')}</h2>
        <p>{t('Your current story is saved in the local library automatically. Choose the formats you want to deliver.')}</p>
        <div className="project-setup-body">
        <label className="field new-project-fps">{t('Project frame rate')}<select value={newProjectFps} onChange={event => setNewProjectFps(Number(event.target.value))}><option value={24}>{t('24 fps · Film')}</option><option value={25}>{t('25 fps · PAL')}</option><option value={30}>{t('30 fps · Standard')}</option><option value={60}>{t('60 fps · Smooth')}</option></select></label>
        {formatFilterChips()}
        <div className="format-groups">{filterFormatGroups(formatFilter).map(group => <section className="format-group" key={group.platform}>
          <div className="format-group-head"><strong>{t(group.label)}</strong><span>{formatCount(group.presets.length)}</span></div>
          <div className="format-group-grid">{group.presets.map(preset => <label key={preset.id} className={`format-card ${newFormatIds.includes(preset.id) ? 'active' : ''}`}><input type="checkbox" checked={newFormatIds.includes(preset.id)} onChange={event => setNewFormatIds(current => event.target.checked ? [...current, preset.id] : current.filter(id => id !== preset.id))} /><span className="format-check" aria-hidden="true">{newFormatIds.includes(preset.id) ? <Check size={11} /> : null}</span><span className="format-ratio">{preset.aspect}</span><strong>{preset.name}</strong><small>{preset.description}</small></label>)}</div>
        </section>)}</div>
        <div className="settings-section-title">{t('Custom size')}</div>
        <div className="custom-format-form new-custom-format">
          <label className="field">{t('Name')}<input placeholder="Client 2:3" value={customFormatDraft.name} onChange={event => setCustomFormatDraft(current => ({ ...current, name: event.target.value }))} /></label>
          <label className="field">{t('Width')}<input type="number" min="160" max="3840" step="2" value={customFormatDraft.width} onChange={event => setCustomFormatDraft(current => ({ ...current, width: Number(event.target.value) }))} /></label>
          <label className="field">{t('Height')}<input type="number" min="160" max="3840" step="2" value={customFormatDraft.height} onChange={event => setCustomFormatDraft(current => ({ ...current, height: Number(event.target.value) }))} /></label>
          <label className="field">FPS<select value={customFormatDraft.fps} onChange={event => setCustomFormatDraft(current => ({ ...current, fps: Number(event.target.value) }))}><option value={24}>24</option><option value={25}>25</option><option value={30}>30</option><option value={60}>60</option></select></label>
          <label className="field">{t('Quality')}<select value={customFormatDraft.quality} onChange={event => setCustomFormatDraft(current => ({ ...current, quality: event.target.value as 'draft' | 'standard' | 'high' }))}><option value="draft">{t('Draft')}</option><option value="standard">{t('Standard')}</option><option value="high">{t('High')}</option></select></label>
          <button className="button" disabled={newFormatSelection.length >= MAX_PROJECT_FORMATS} onClick={addNewCustomFormat}><Plus size={14} /> {t('Add')}</button>
        </div>
        {newCustomFormats.length > 0 && <div className="group-filter">{newCustomFormats.map(format => <span className="group-chip" key={format.id}><Layers size={11} />{format.name} · {format.width}×{format.height}</span>)}</div>}
        <p className="note"><Layers size={14} /><span>{t('Photos, text, timing, transitions, audio, and looks are common to every format. Size, FPS, quality, and framing (zoom, pan, fit, letterbox) are saved per format.')}</span></p>
        </div>
        <div className="project-setup-foot">
          <div className="format-pick-summary" role="status" aria-live="polite"><Layers size={13} /><span>{newFormatSelection.length ? <>{t('{formats} selected · {files} will be written', { formats: formatCount(newFormatSelection.length), files: fileCount(newFormatOutputs.length) })}{newFormatOutputs.length < newFormatSelection.length ? t(' · identical sizes are combined') : ''}</> : t('Pick at least one format, or start with the default 16:9.')}</span></div>
          <div className="modal-actions">
            <button className="button primary" disabled={!canEdit} onClick={() => void startWithFormats()}><Plus size={16} /> {t('Start blank')}</button>
            <button className="button" disabled={!canEdit} onClick={() => void startTemplate(SAMPLE_TEMPLATE)}><LayoutTemplate size={16} /> {t('Use Travel sample')}</button>
            <button className="button subtle" onClick={requestCloseModal}>{t('Cancel')}</button>
          </div>
        </div>
      </>}
    </>
  );
}
