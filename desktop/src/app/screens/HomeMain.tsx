import { projectCount, sceneCount, t } from '../../i18n';
import { ArrowRight, ArrowUpRight, Ban, Clapperboard, FolderOpen, Images, Layers, LayoutTemplate, Plus, Search, Settings2, Star, Upload, WifiOff, Zap } from 'lucide-react';
import { type ProjectSummary } from '../../stores/library';
import { TEMPLATES, type TemplateDefinition } from '../../templates/catalog';
import type { Dispatch, SetStateAction, ReactElement } from 'react';

export function HomeMain({ homeSection, open, canEdit, ready, setModal, chooseImages, projects, libraryQuery, setLibraryQuery, librarySort, setLibrarySort, favoriteOnly, setFavoriteOnly, groupFilter, setGroupFilter, projectGroupsList, openGroupManager, matchingProjects, renderProjectCard, visibleProjects, chooseTemplate, templateImage }: {
  homeSection: "home" | "projects";
  open: () => Promise<void>;
  canEdit: boolean;
  ready: boolean;
  setModal: Dispatch<SetStateAction<"source" | "templates" | "export" | "new" | "shortcuts" | "palette" | "settings" | "delete" | "rename" | "group" | "groups" | "formats" | "missing" | null>>;
  chooseImages: () => Promise<void>;
  projects: ProjectSummary[];
  libraryQuery: string;
  setLibraryQuery: Dispatch<SetStateAction<string>>;
  librarySort: "recent" | "name" | "duration";
  setLibrarySort: Dispatch<SetStateAction<"recent" | "name" | "duration">>;
  favoriteOnly: boolean;
  setFavoriteOnly: Dispatch<SetStateAction<boolean>>;
  groupFilter: string;
  setGroupFilter: Dispatch<SetStateAction<string>>;
  projectGroupsList: string[];
  openGroupManager: () => void;
  matchingProjects: ProjectSummary[];
  renderProjectCard: (entry: ProjectSummary) => ReactElement;
  visibleProjects: ProjectSummary[];
  chooseTemplate: (template: TemplateDefinition) => void;
  templateImage: (template: TemplateDefinition) => string;
}) {
  return (
    <>
      
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
              <label className="search-field"><Search size={14} /><input aria-label="Search projects" placeholder={t('Search projects or groups…')} value={libraryQuery} onChange={event => setLibraryQuery(event.target.value)} /></label>
              <select aria-label="Sort projects" value={librarySort} onChange={event => setLibrarySort(event.target.value as 'recent' | 'name' | 'duration')}><option value="recent">{t('Recently edited')}</option><option value="name">{t('Name A–Z')}</option><option value="duration">{t('Longest first')}</option></select>
              <button className={`favorite-filter ${favoriteOnly ? 'active' : ''}`} aria-pressed={favoriteOnly} onClick={() => setFavoriteOnly(value => !value)}><Star size={13} fill={favoriteOnly ? 'currentColor' : 'none'} /> {t('Favorites')}</button>
            </div>}
            {homeSection === 'projects' && <div className="group-filter" role="group" aria-label="Filter projects by group">
              <button className={`group-chip ${groupFilter === 'all' ? 'active' : ''}`} onClick={() => setGroupFilter('all')}>{t('All')} <span>{projects.length}</span></button>
              {projectGroupsList.map(group => <button key={group} className={`group-chip ${groupFilter === group ? 'active' : ''}`} onClick={() => setGroupFilter(group)}><FolderOpen size={11} />{group} <span>{projects.filter(entry => entry.group === group).length}</span></button>)}
              <button className={`group-chip ${groupFilter === 'ungrouped' ? 'active' : ''}`} onClick={() => setGroupFilter('ungrouped')}>{t('Ungrouped')} <span>{projects.filter(entry => !entry.group).length}</span></button>
              {projectGroupsList.length > 0 && <button className="group-manage" onClick={openGroupManager}><Settings2 size={11} /> {t('Manage groups')}</button>}
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
              <div className="project-group-section"><div className="project-group-title"><h3>{t('New')}</h3><span>{t('Start a fresh story')}</span></div><div className="project-grid">
                <button className="project-card ghost" onClick={() => setModal('new')} disabled={!canEdit}>
                  <span className="ghost-art"><span><Plus size={24} /></span><small>{t('Blank canvas')}</small></span>
                  <div className="project-meta"><strong>{t('Start something new')}</strong><small>{t('A fresh story, ready for your photos.')}</small></div>
                </button>
              </div></div>
            </> : <div className="project-grid">
              {visibleProjects.map(renderProjectCard)}
              {!visibleProjects.length && <div className="library-empty compact group-empty"><FolderOpen size={28} /><strong>{t('No projects in this group yet.')}</strong><p>{t('Use a project’s ••• menu to move it here.')}</p></div>}
              <button className="project-card ghost" onClick={() => setModal('new')} disabled={!canEdit}>
                <span className="ghost-art"><span><Plus size={24} /></span><small>{t('Blank canvas')}</small></span>
                <div className="project-meta"><strong>{t('Start something new')}</strong><small>{t('A fresh story, ready for your photos.')}</small></div>
              </button>
            </div>}
          </> : <div className="empty-projects">
            <div className="empty-projects-icon"><Clapperboard size={28} /></div>
            <div><strong>{t('Your next favorite starts here.')}</strong><p>{t('Start a story above, import a photo movie, or open a saved PixCut project.')}</p></div>
            <button className="button subtle" onClick={() => void chooseImages()} disabled={!canEdit}><Upload size={15} /> {t('Import photos')}</button>
          </div>}
        </section>
      
        {homeSection === 'home' && <section className="thumb-strip" aria-label="Template inspiration">
          <div className="section-title"><div><h2>{t('Skip the blank page')}</h2><p>{t('Start from a sample and make it yours.')}</p></div><button className="text-button" onClick={() => setModal('templates')}>{t('Browse templates')} <ArrowRight size={14} /></button></div>
          <div className="thumb-grid">{TEMPLATES.slice(0, 3).map(template => <button key={template.id} className="thumb-card" onClick={() => chooseTemplate(template)}><span className="thumb-art"><img src={templateImage(template)} alt="" /></span><span><strong>{t(template.name)}</strong><small>{sceneCount(template.sceneCount)} · {template.duration.toFixed(1)} s</small></span></button>)}</div>
        </section>}
      
        {homeSection === 'home' && <section className="home-perks">
          <div><span className="perk-icon violet"><Zap size={17} /></span><strong>{t('Simple')}</strong><small>{t('Start creating in minutes')}</small></div>
          <div><span className="perk-icon blue"><Layers size={17} /></span><strong>{t('Powerful')}</strong><small>{t('Timing, titles, and color')}</small></div>
          <div><span className="perk-icon pink"><WifiOff size={17} /></span><strong>{t('On this device')}</strong><small>{t('Edit without internet or account')}</small></div>
          <div><span className="perk-icon green"><Ban size={17} /></span><strong>{t('No watermark')}</strong><small>{t('Export beautiful videos, free')}</small></div>
        </section>}
      </main>
    </>
  );
}
