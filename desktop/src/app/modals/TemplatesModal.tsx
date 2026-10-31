import { sceneCount, t } from '../../i18n';
import { ArrowRight, Search } from 'lucide-react';
import { TEMPLATE_CATEGORIES } from '../../templates/catalog';
import { clampWeight, fontOption } from '../../components/text/fonts';
import { type ProjectSummary } from '../../stores/library';
import { type TemplateDefinition } from '../../templates/catalog';
import { TEMPLATE_PHOTOS } from '../../templates/photos';
import type { Dispatch, SetStateAction } from 'react';

export function TemplatesModal({ projects, templateQuery, setTemplateQuery, templateCategory, setTemplateCategory, templateMatches, canEdit, chooseTemplate, templateImage }: {
  projects: ProjectSummary[];
  templateQuery: string;
  setTemplateQuery: Dispatch<SetStateAction<string>>;
  templateCategory: "Nature" | "Travel" | "People" | "Family" | "Birthday" | "Social" | "Food" | "All";
  setTemplateCategory: Dispatch<SetStateAction<"Nature" | "Travel" | "People" | "Family" | "Birthday" | "Social" | "Food" | "All">>;
  templateMatches: TemplateDefinition[];
  canEdit: boolean;
  chooseTemplate: (template: TemplateDefinition) => void;
  templateImage: (template: TemplateDefinition) => string;
}) {
  return (
    <>
      <h2 id="modal-title">{t('Start from a story.')}</h2><p>{t('Photo stories, one animated video opener, and local music — all bundled and ready offline.')} {projects.length ? t('Your current project is saved before a template opens.') : ''}</p>
      <label className="shortcut-search template-search"><Search size={15} /><input aria-label={t('Search templates')} placeholder={t('Search templates…')} value={templateQuery} onChange={e => setTemplateQuery(e.target.value)} /></label>
      <div className="template-categories" role="tablist" aria-label={t('Template categories')}>{['All', ...TEMPLATE_CATEGORIES].map(category => <button key={category} role="tab" aria-selected={templateCategory === category} className={templateCategory === category ? 'active' : ''} onClick={() => setTemplateCategory(category as typeof templateCategory)}>{t(category)}</button>)}</div>
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
          <strong>{t(template.name)}</strong>
          <span>{t(template.description)}</span>
          <small>{sceneCount(template.sceneCount)} · {template.duration.toFixed(1)} s · {t(template.category)}</small>
          <span className="template-badges">{template.video && <span className="template-badge video">{t('VIDEO')}</span>}{template.audio && <span className="template-badge music">{t('MUSIC')}</span>}</span>
          <span className="button primary">{t('Use template')} <ArrowRight size={15} /></span>
        </div>
      </button>)}</div> : <div className="shortcut-empty"><Search size={24} /><strong>{t('No templates match “{query}”.', { query: templateQuery })}</strong><span>{t('Try Nature, Travel, People or Food.')}</span></div>}
      <details className="template-credits">
        <summary>{t('Media credits')}</summary>
        <p>{t('Every template photo ships with the app as a CC0 (public-domain) image, mostly Unsplash photographs archived on Wikimedia Commons. Template music and the motion background are generated for PixCut and released CC0. Nothing is downloaded while you edit.')}</p>
        <ul>{Object.values(TEMPLATE_PHOTOS).sort((a, b) => a.author.localeCompare(b.author)).map(photo => <li key={photo.file}><span>{photo.title}</span>{photo.author}</li>)}</ul>
      </details>
    </>
  );
}
