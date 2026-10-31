import { fileCount, formatCount, t } from '../../i18n';
import { Check, Layers, Plus, Search, Trash2 } from 'lucide-react';
import { MAX_PROJECT_FORMATS, type Project, type FormatVariant } from '../../stores/model';
import { filterFormatGroups } from '../../stores/formats';
import type { Dispatch, SetStateAction } from 'react';
import type { FormatPreset, FormatOutputGroup } from '../../stores/formats';

export function FormatsModal({ formatSection, setFormatSection, setFormatSearch, customFormatDraft, setCustomFormatDraft, canEdit, project, addCustomFormat, formatSearch, formatPlatform, setFormatPlatform, formatBrowserGroups, toggleFormatPreset, activeFormat, setActiveFormatId, removeFormat, updateFormatSettings, projectFormatOutputs, requestCloseModal }: {
  formatSection: "social" | "sizes" | "custom";
  setFormatSection: Dispatch<SetStateAction<"social" | "sizes" | "custom">>;
  setFormatSearch: Dispatch<SetStateAction<string>>;
  customFormatDraft: { name: string; width: number; height: number; fps: number; quality: "draft" | "standard" | "high"; };
  setCustomFormatDraft: Dispatch<SetStateAction<{ name: string; width: number; height: number; fps: number; quality: "draft" | "standard" | "high"; }>>;
  canEdit: boolean;
  project: Project;
  addCustomFormat: () => Promise<void>;
  formatSearch: string;
  formatPlatform: string;
  setFormatPlatform: Dispatch<SetStateAction<string>>;
  formatBrowserGroups: { presets: FormatPreset[]; platform: string; label: string; }[];
  toggleFormatPreset: (presetId: string) => Promise<void>;
  activeFormat: FormatVariant;
  setActiveFormatId: Dispatch<SetStateAction<string | null>>;
  removeFormat: (formatId: string) => Promise<void>;
  updateFormatSettings: (format: FormatVariant, patch: Partial<FormatVariant>) => Promise<void>;
  projectFormatOutputs: FormatOutputGroup<FormatVariant>[];
  requestCloseModal: () => void;
}) {
  return (
    <>
      <h2 id="modal-title">{t('Deliverables')}.</h2>
      <p>{t('Choose output formats. Adjust each selected format on the right.')}</p>
      <div className="format-studio-body">
        <div className="format-browser">
          <div className="format-section-tabs" role="tablist" aria-label={t('Format type')}>{([['social','Social'],['sizes','Standard sizes'],['custom','Custom']] as const).map(([id,label]) => <button key={id} id={`format-tab-${id}`} role="tab" aria-selected={formatSection === id} aria-controls="format-browser-panel" onClick={() => { setFormatSection(id); setFormatSearch(''); }}>{t(label)}</button>)}</div>
          <div id="format-browser-panel" className="format-browser-panel" role="tabpanel" aria-labelledby={`format-tab-${formatSection}`} key={formatSection}>
          {formatSection === 'custom' ? <>
      <div className="settings-section-title" id="custom-format-section">{t('Custom format')}</div>
      <div className="custom-format-form">
        <label className="field">{t('Name')}<input id="custom-format-name" placeholder="Client vertical" value={customFormatDraft.name} onChange={event => setCustomFormatDraft(current => ({ ...current, name: event.target.value }))} /></label>
        <label className="field">{t('Width')}<input type="number" min="160" max="3840" step="2" value={customFormatDraft.width} onChange={event => setCustomFormatDraft(current => ({ ...current, width: Number(event.target.value) }))} /></label>
        <label className="field">{t('Height')}<input type="number" min="160" max="3840" step="2" value={customFormatDraft.height} onChange={event => setCustomFormatDraft(current => ({ ...current, height: Number(event.target.value) }))} /></label>
        <label className="field">FPS<select value={customFormatDraft.fps} onChange={event => setCustomFormatDraft(current => ({ ...current, fps: Number(event.target.value) }))}><option value={24}>24</option><option value={25}>25</option><option value={30}>30</option><option value={60}>60</option></select></label>
        <label className="field">{t('Quality')}<select value={customFormatDraft.quality} onChange={event => setCustomFormatDraft(current => ({ ...current, quality: event.target.value as 'draft' | 'standard' | 'high' }))}><option value="draft">{t('Draft')}</option><option value="standard">{t('Standard')}</option><option value="high">{t('High')}</option></select></label>
        <button className="button primary" disabled={!canEdit || project.formats.length >= MAX_PROJECT_FORMATS} onClick={() => void addCustomFormat()}><Plus size={14} /> {t('Add custom')}</button>
      </div>
      
          </> : <>
            <div className="format-browser-tools">
              <label className="search-field"><Search size={14} /><input aria-label={t('Search formats')} placeholder={t('Search formats…')} value={formatSearch} onChange={event => setFormatSearch(event.target.value)} /></label>
              {formatSection === 'social' && <select aria-label={t('Social platform')} value={formatPlatform} onChange={event => setFormatPlatform(event.target.value)}><option value="all">{t('All platforms')}</option>{filterFormatGroups('all').filter(group => !['Sizes','4K Master'].includes(group.platform)).map(group => <option key={group.platform} value={group.platform}>{t(group.label)}</option>)}</select>}
            </div>
            <div className="format-preset-scroll">
      <div className="format-groups">{formatBrowserGroups.map(group => <section className="format-group" key={group.platform}>
        <div className="format-group-head"><strong>{t(group.label)}</strong><span>{formatCount(group.presets.length)}</span></div>
        <div className="format-group-grid">{group.presets.map(preset => { const active = project.formats.some(format => format.presetId === preset.id); return <label key={preset.id} className={`format-card ${active ? 'active' : ''}`}><input type="checkbox" aria-label={preset.name} checked={active} disabled={!canEdit || (!active && project.formats.length >= MAX_PROJECT_FORMATS)} onChange={() => void toggleFormatPreset(preset.id)} /><span className="format-check" aria-hidden="true">{active ? <Check size={11} /> : null}</span><span className="format-ratio">{preset.aspect}</span><strong>{preset.name}</strong><small>{preset.description}</small></label>; })}</div>
      </section>)}</div>
      
              {formatBrowserGroups.length === 0 && <p className="note">{t('No matching formats. Try another search.')}</p>}
            </div>
          </>}
          </div>
        </div>
        <aside className="format-selection" aria-label={t('Selected format settings')}>
      <div className="settings-section-title">{t('Selected formats')}</div>
      <div className="format-current-list">{project.formats.map(format => <div className={`format-current ${activeFormat?.id === format.id ? 'active' : ''}`} key={format.id}><button className="format-current-select" onClick={() => setActiveFormatId(format.id)}><span className="format-ratio">{format.width}×{format.height}</span><span><strong>{format.name}</strong><small>{format.width}×{format.height} · {format.fps} fps · {format.quality}</small></span></button><button className="icon-button" aria-label={t('Remove {name}', { name: format.name })} disabled={project.formats.length <= 1} onClick={() => void removeFormat(format.id)}><Trash2 size={14} /></button></div>)}</div>
      {activeFormat && <div className="format-settings-card" key={activeFormat.id}>
        <div className="settings-section-title">{t('Settings for {name}', { name: activeFormat.name })}</div>
        <div className="format-settings-grid">
          <label className="field">{t('Name')}<input defaultValue={activeFormat.name} maxLength={80} onBlur={event => { if (event.target.value.trim() && event.target.value.trim() !== activeFormat.name) void updateFormatSettings(activeFormat, { name: event.target.value }); }} /></label>
          <label className="field">{t('Width')}<input type="number" min="160" max="3840" step="2" defaultValue={activeFormat.width} onBlur={event => { const value = Number(event.target.value); if (value !== activeFormat.width) void updateFormatSettings(activeFormat, { width: value }); }} /></label>
          <label className="field">{t('Height')}<input type="number" min="160" max="3840" step="2" defaultValue={activeFormat.height} onBlur={event => { const value = Number(event.target.value); if (value !== activeFormat.height) void updateFormatSettings(activeFormat, { height: value }); }} /></label>
          <label className="field">{t('Frame rate')}<select value={activeFormat.fps} onChange={event => void updateFormatSettings(activeFormat, { fps: Number(event.target.value) })}><option value={24}>24 fps</option><option value={25}>25 fps</option><option value={30}>30 fps</option><option value={60}>60 fps</option></select></label>
          <label className="field">{t('Quality')}<select value={activeFormat.quality} onChange={event => void updateFormatSettings(activeFormat, { quality: event.target.value as 'draft' | 'standard' | 'high' })}><option value="draft">{t('Draft')}</option><option value="standard">{t('Standard')}</option><option value="high">{t('High')}</option></select></label>
        </div>
      </div>}
      
        </aside>
      </div>
      <div className="format-studio-footer">
      <div className="format-pick-summary" role="status" aria-live="polite"><Layers size={13} /><span>{t('{formats} · {files} when you export', { formats: formatCount(project.formats.length), files: fileCount(projectFormatOutputs.length) })}{projectFormatOutputs.length < project.formats.length ? t('. Formats with the same size, frame rate and framing share one video.') : ''}</span></div>
      
        <button className="button primary" onClick={requestCloseModal}>{t('Done')}</button>
      </div>
    </>
  );
}
