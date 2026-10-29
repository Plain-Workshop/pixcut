import { useEffect, useMemo, useState } from 'react';
import { projectCount, sceneCount, t } from '../../i18n';
import { ArrowRight, ArrowUpRight, Ban, Check, Clapperboard, FolderOpen, Images, Layers, LayoutTemplate, Play, Plus, Search, Settings2, Star, Upload, WifiOff, Zap } from 'lucide-react';
import { DATE_BUCKETS, dateBucket, homeProjectOrder, resumeProject } from '../home-order';
import { BatchBar, type BatchControls } from '../parts/BatchBar';
import { HomeHealth } from '../parts/HomeHealth';
import { RecentlyDeleted, type DeletedControls } from '../parts/RecentlyDeleted';
import { type ProjectSummary } from '../../stores/library';
import { TEMPLATES, type TemplateDefinition } from '../../templates/catalog';
import type { Dispatch, SetStateAction, ReactElement } from 'react';

export function HomeMain({ deleted, goProjects, batch, openSettings, libraryReady, shortcutText, openProject, homeSection, open, canEdit, ready, setModal, chooseImages, projects, libraryQuery, setLibraryQuery, librarySort, setLibrarySort, favoriteOnly, setFavoriteOnly, groupFilter, setGroupFilter, projectGroupsList, openGroupManager, matchingProjects, renderProjectCard, visibleProjects, chooseTemplate, templateImage }: {
  deleted: DeletedControls;
  goProjects: () => void;
  batch: BatchControls;
  openSettings: () => void;
  libraryReady: boolean;
  shortcutText: (id: string) => string;
  openProject: (entry: ProjectSummary) => Promise<void> | void;
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
  const returning = homeSection === 'home' && projects.length > 0;
  // With many projects sorted by recency, the Projects page gets Today / This week headings.
  const dated = homeSection === 'projects' && librarySort === 'recent' && groupFilter === 'all' && !projectGroupsList.length && visibleProjects.length >= 6;
  const loading = !libraryReady && !projects.length;
  const [templateAspect, setTemplateAspect] = useState<string>('all');
  const templateAspects = useMemo(() => [...new Set(TEMPLATES.map(template => template.aspect))], []);
  const shownTemplates = TEMPLATES.filter(template => templateAspect === 'all' || template.aspect === templateAspect).slice(0, 6);
  const createGrid = <section className={`create-grid ${returning ? 'compact' : ''}`} aria-label={t('Create something new')}>
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
        </section>;
  // Starred projects lead the Home grid; the sort is stable, so recency still orders each group.
  const homeProjects = returning ? homeProjectOrder(visibleProjects) : visibleProjects;
  const resumeTarget = resumeProject(projects);

  useEffect(() => {
    if (homeSection !== 'home') return;
    const key = (event: KeyboardEvent) => {
      if (event.isComposing || document.querySelector('[role="dialog"], .modal-backdrop')) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable="true"]')) return;
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && /^[1-6]$/.test(event.key)) {
        const entry = homeProjects[Number(event.key) - 1];
        if (entry) { event.preventDefault(); void openProject(entry); }
        return;
      }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || event.metaKey || event.ctrlKey || event.altKey) return;
      const cards = Array.from(document.querySelectorAll<HTMLButtonElement>('.recent-section .project-open'));
      if (!cards.length) return;
      const current = cards.findIndex(card => card === document.activeElement);
      const columns = Math.max(1, cards.filter(card => card.offsetTop === cards[0].offsetTop).length);
      const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -columns : columns;
      const next = current < 0 ? 0 : Math.min(cards.length - 1, Math.max(0, current + step));
      event.preventDefault();
      cards[next].focus();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [homeSection, homeProjects.map(entry => entry.id).join('|'), openProject]);
  return (
    <>
      
      <main className="home-main">
        <div className="home-drop" aria-hidden="true"><Images size={34} /><strong>{t('Drop photos or videos to start a movie')}</strong><small>{t('PNG, JPEG, WebP, MP4, MOV, M4V, WebM or a .pixcut project')}</small></div>
        <header className="home-topbar">
          <div className={`home-heading ${returning ? 'returning' : ''}`}>
            <div className="eyebrow"><span /><>{t(homeSection === 'home' ? 'A LITTLE MOMENT. A GREAT STORY.' : 'YOUR LOCAL LIBRARY')}</></div>
            <h1>{homeSection === 'home' ? <>{t('What would you like')}<br /><em>{t('to create?')}</em></> : <>{t('Your stories,')}<br /><em>{t('kept close.')}</em></>}</h1>
            <p className="home-intro">{homeSection === 'home' ? (returning ? t('Pick up where you left off, or start something new.') : <>{t('Your photos, your pace, your point of view.')}<br />{t('Bring them together in a place that’s entirely yours.')}</>) : <>{t('Everything lives on this device. Open a recent story or start a new one whenever inspiration arrives.')}</>}</p>
          </div>
          <div className="home-actions">
            <button className="button subtle" onClick={() => void open()} disabled={!canEdit} title={`${t('Open project')} · ${shortcutText('project.open')}`}><FolderOpen size={16} /> {t('Open project')} <kbd className="button-key">{shortcutText('project.open')}</kbd></button>
            {returning && resumeTarget && <button className="button primary resume-button" onClick={() => void openProject(resumeTarget)} disabled={!canEdit} title={resumeTarget.name}><Play size={14} fill="currentColor" /> <span className="resume-name">{t('Resume')} “{resumeTarget.name}”</span></button>}
            <button className={`button ${returning ? 'subtle' : 'primary'}`} disabled={!ready} onClick={() => setModal('new')} title={`${t('New project')} · ${shortcutText('project.new')}`}><Plus size={16} /> {t('New project')} <kbd className="button-key">{shortcutText('project.new')}</kbd></button>
          </div>
        </header>
      
        {homeSection === 'home' && <HomeHealth openSettings={openSettings} />}

        {homeSection === 'home' && !returning && createGrid}

        <section className="recent-section">
          <div className="section-title">
            <div><h2>{t(homeSection === 'home' ? (returning ? 'Continue editing' : 'Recent projects') : 'Your projects')}</h2><p>{t(homeSection === 'home' ? 'Pick up where you left off.' : 'Stored locally, recovered automatically.')}</p></div>
            <span className="count-label">{projects.length ? (returning && visibleProjects.length > homeProjects.length ? `${homeProjects.length} of ${projectCount(projects.length)}` : projectCount(projects.length)) : t('Nothing yet')}</span>
          </div>
          {returning && (projectGroupsList.length > 0 || projects.some(entry => entry.favorite)) && <div className="group-filter home-shortcuts" role="group" aria-label={t('Jump to favorites and groups')}>
            {projects.some(entry => entry.favorite) && <button className="group-chip" onClick={() => { setFavoriteOnly(true); setGroupFilter('all'); goProjects(); }}><Star size={11} fill="currentColor" />{t('Favorites')} <span>{projects.filter(entry => entry.favorite).length}</span></button>}
            {projectGroupsList.map(group => <button key={group} className="group-chip" onClick={() => { setFavoriteOnly(false); setGroupFilter(group); goProjects(); }}><FolderOpen size={11} />{group} <span>{projects.filter(entry => entry.group === group).length}</span></button>)}
          </div>}
          {loading ? <div className="project-grid home-skeletons" aria-busy="true" aria-label={t('Loading projects')}>{[0, 1, 2].map(index => <div className="project-card skeleton" key={index}><div className="skeleton-thumb" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>)}</div> : projects.length ? <>
            {homeSection === 'projects' && <div className="library-controls">
              <label className="search-field"><Search size={14} /><input aria-label={t('Search projects')} placeholder={t('Search projects or groups…')} value={libraryQuery} onChange={event => setLibraryQuery(event.target.value)} /></label>
              <select aria-label={t('Sort projects')} value={librarySort} onChange={event => setLibrarySort(event.target.value as 'recent' | 'name' | 'duration')}><option value="recent">{t('Recently edited')}</option><option value="name">{t('Name A–Z')}</option><option value="duration">{t('Longest first')}</option></select>
              <button className={`favorite-filter ${favoriteOnly ? 'active' : ''}`} aria-pressed={favoriteOnly} onClick={() => setFavoriteOnly(value => !value)}><Star size={13} fill={favoriteOnly ? 'currentColor' : 'none'} /> {t('Favorites')}</button>
              <button className={`favorite-filter ${batch.mode ? 'active' : ''}`} aria-pressed={batch.mode} onClick={() => batch.mode ? batch.end() : batch.begin()}><Check size={13} /> {t('Select')}</button>
            </div>}
            {homeSection === 'projects' && batch.mode && <BatchBar batch={batch} groups={projectGroupsList} selectedCount={batch.ids.length} />}
            {homeSection === 'projects' && <div className="group-filter" role="group" aria-label={t('Filter projects by group')}>
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
                  <div className="project-group-title"><h3>{group}</h3><span>{projectCount(items.length)}</span></div>
                  <div className="project-grid">{items.map(renderProjectCard)}</div>
                </div>;
              })}
              <div className="project-group-section"><div className="project-group-title"><h3>{t('New')}</h3><span>{t('Start a fresh story')}</span></div><div className="project-grid">
                <button className="project-card ghost" onClick={() => setModal('new')} disabled={!canEdit}>
                  <span className="ghost-art"><span><Plus size={24} /></span><small>{t('Blank canvas')}</small></span>
                  <div className="project-meta"><strong>{t('Start something new')}</strong><small>{t('A fresh story, ready for your photos.')}</small></div>
                </button>
              </div></div>
            </> : dated ? <>
              {DATE_BUCKETS.map(bucket => {
                const items = visibleProjects.filter(entry => dateBucket(entry.updatedAt) === bucket);
                if (!items.length) return null;
                return <div className="project-group-section" key={bucket}>
                  <div className="project-group-title"><h3>{t(bucket)}</h3><span>{projectCount(items.length)}</span></div>
                  <div className="project-grid">{items.map(renderProjectCard)}</div>
                </div>;
              })}
            </> : <div className={`project-grid ${homeSection === 'home' ? 'home-grid' : ''}`}>
              {homeProjects.map(renderProjectCard)}
              {!visibleProjects.length && <div className="library-empty compact group-empty"><FolderOpen size={28} /><strong>{t('No projects in this group yet.')}</strong><p>{t('Use a project’s ••• menu to move it here.')}</p></div>}
              {homeSection === 'projects' && <button className="project-card ghost" onClick={() => setModal('new')} disabled={!canEdit}>
                <span className="ghost-art"><span><Plus size={24} /></span><small>{t('Blank canvas')}</small></span>
                <div className="project-meta"><strong>{t('Start something new')}</strong><small>{t('A fresh story, ready for your photos.')}</small></div>
              </button>}
            </div>}
          </> : <div className="empty-projects empty-dropzone">
            <div className="empty-projects-icon"><Clapperboard size={28} /></div>
            <div><strong>{t('Your next favorite starts here.')}</strong><p>{t('Drop photos anywhere in this window, import them, or start from a template.')}</p></div>
            <div className="empty-actions">
              <button className="button primary" onClick={() => void chooseImages()} disabled={!canEdit}><Upload size={15} /> {t('Import photos')}</button>
              <button className="button subtle" onClick={() => setModal('templates')} disabled={!ready}><LayoutTemplate size={15} /> {t('Browse templates')}</button>
            </div>
            <div className="empty-templates">{TEMPLATES.slice(0, 3).map(template => <button key={template.id} className="empty-template" onClick={() => chooseTemplate(template)} title={t(template.name)}><img src={templateImage(template)} alt="" /><span>{t(template.name)}</span></button>)}</div>
          </div>}
        </section>

        {homeSection === 'projects' && <RecentlyDeleted deleted={deleted} />}

        {returning && createGrid}

        {homeSection === 'home' && <section className="thumb-strip" aria-label={t('Template inspiration')}>
          <div className="section-title"><div><h2>{t('Skip the blank page')}</h2><p>{t('Start from a sample and make it yours.')}</p></div><button className="text-button" onClick={() => setModal('templates')}>{t('Browse templates')} <ArrowRight size={14} /></button></div>
          <div className="group-filter template-filter" role="group" aria-label={t('Filter templates by format')}>
            {['all', ...templateAspects].map(aspect => <button key={aspect} className={`group-chip ${templateAspect === aspect ? 'active' : ''}`} aria-pressed={templateAspect === aspect} onClick={() => setTemplateAspect(aspect)}>{aspect === 'all' ? t('All') : aspect}</button>)}
          </div>
          <div className="thumb-grid">{shownTemplates.map(template => <button key={template.id} className="thumb-card" onClick={() => chooseTemplate(template)}><span className="thumb-art"><img src={templateImage(template)} alt="" /></span><span><strong>{t(template.name)}</strong><small>{sceneCount(template.sceneCount)} · {template.duration.toFixed(1)} s</small></span></button>)}</div>
        </section>}
      
        {homeSection === 'home' && !returning && <section className="home-perks">
          <div><span className="perk-icon violet"><Zap size={17} /></span><strong>{t('Simple')}</strong><small>{t('Start creating in minutes')}</small></div>
          <div><span className="perk-icon blue"><Layers size={17} /></span><strong>{t('Powerful')}</strong><small>{t('Timing, titles, and color')}</small></div>
          <div><span className="perk-icon pink"><WifiOff size={17} /></span><strong>{t('On this device')}</strong><small>{t('Edit without internet or account')}</small></div>
          <div><span className="perk-icon green"><Ban size={17} /></span><strong>{t('No watermark')}</strong><small>{t('Export beautiful videos, free')}</small></div>
        </section>}
      </main>
    </>
  );
}
