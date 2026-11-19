import { exportState, type ProjectSummary } from '../../stores/library';
import { ProjectThumb } from '../../components/ProjectThumb';
import { AlertTriangle, Check, Clapperboard, Copy, Download, FolderOpen, Layers, MoreHorizontal, Pencil, Play, Star, Trash2 } from 'lucide-react';
import { formatCount, sceneCount, t } from '../../i18n';
import { timecode } from '../../stores/model';
import { relativeTime } from '../helpers';
import type { Project } from '../../stores/model';
import type { Dispatch, SetStateAction } from 'react';

export function ProjectCard({ entry, askDeleteProject, askGroupProject, askRenameProject, batchIds, batchMode, canEdit, duplicateProject, exportLibraryProject, libraryReady, missingCounts, openLibraryProject, project, projectMenu, setProjectMenu, toggleBatch, toggleProjectFavorite }: {
  entry: ProjectSummary;
  askDeleteProject: (summary: ProjectSummary) => void;
  askGroupProject: (summary: ProjectSummary) => void;
  askRenameProject: (summary: ProjectSummary) => void;
  batchIds: string[];
  batchMode: boolean;
  canEdit: boolean;
  duplicateProject: (summary: ProjectSummary) => Promise<void>;
  exportLibraryProject: (summary: ProjectSummary) => Promise<void>;
  libraryReady: boolean;
  missingCounts: Record<string, number>;
  openLibraryProject: (summary: ProjectSummary) => Promise<void>;
  project: Project;
  projectMenu: string | null;
  setProjectMenu: Dispatch<SetStateAction<string | null>>;
  toggleBatch: (id: string) => void;
  toggleProjectFavorite: (summary: ProjectSummary) => Promise<void>;
}) {
    const active = entry.id === project.id;
    return <div className={`project-card ${active ? 'active' : ''} ${projectMenu === entry.id ? 'menu-open' : ''}`} key={entry.id}>
      <button className={`project-open ${batchMode && batchIds.includes(entry.id) ? 'batch-selected' : ''}`} aria-pressed={batchMode ? batchIds.includes(entry.id) : undefined} onClick={() => batchMode ? toggleBatch(entry.id) : void openLibraryProject(entry)} disabled={!libraryReady || (!batchMode && !canEdit)}>
        <ProjectThumb key={`${entry.id}-${entry.updatedAt}`} entry={entry}>
          <div className="project-frame" style={{ aspectRatio: entry.width && entry.height ? `${entry.width} / ${entry.height}` : entry.aspect.replace(':', ' / ') }}>
            {entry.thumbnail ? <img src={entry.thumbnail} alt="" /> : <span className="project-thumb-fallback"><Clapperboard size={24} /></span>}
          </div>
          <span className="project-aspect">{entry.aspect}</span>
          {missingCounts[entry.id] > 0 && <span className="project-missing" title={t('Some media for this project is missing from this device.')}><AlertTriangle size={10} />{missingCounts[entry.id]} {t('missing')}</span>}
          {entry.group && <span className="project-group-badge"><FolderOpen size={10} />{entry.group}</span>}
          {batchMode ? <span className={`project-check ${batchIds.includes(entry.id) ? 'on' : ''}`}><Check size={14} /></span> : <span className="project-play"><Play size={15} fill="currentColor" /></span>}
        </ProjectThumb>
        <div className="project-meta">
          <strong>{entry.name}</strong>
          <small>{sceneCount(entry.sceneCount)} · {timecode(entry.duration, entry.timebase)}</small>
          {entry.formats && entry.formats.length > 0 && <span className="project-formats" title={entry.formats.map(format => `${format.name} · ${format.width}×${format.height}`).join('\n')}>
            {[...new Set(entry.formats.map(format => format.aspect))].slice(0, 4).map(aspect => <span className="project-format-chip" key={aspect}>{aspect}</span>)}
            {entry.formats.length > 1 && <span className="project-format-count">{formatCount(entry.formats.length)}</span>}
          </span>}
          <span className="project-status"><span className="status-dot" /> {active ? t('Open now') : t('Edited {time}', { time: relativeTime(entry.updatedAt) })}</span>
          {(() => { const state = exportState(entry); return <span className={`project-export ${state}`}>{state === 'never' ? t('Not exported yet') : state === 'changed' ? t('Changed since export {time}', { time: relativeTime(entry.exportedAt ?? 0) }) : t('Exported {time}', { time: relativeTime(entry.exportedAt ?? 0) })}</span>; })()}
        </div>
      </button>
      {!batchMode && <div className="project-quick" role="group" aria-label={t('Quick actions for {name}', { name: entry.name })}>
        <button aria-label={t('Export {name}', { name: entry.name })} title={t('Export project file')} onClick={() => void exportLibraryProject(entry)}><Download size={13} /></button>
        <button aria-label={t('Duplicate {name}', { name: entry.name })} title={t('Duplicate')} disabled={!canEdit} onClick={() => void duplicateProject(entry)}><Copy size={13} /></button>
        <button aria-label={t('Rename {name}', { name: entry.name })} title={t('Rename…')} disabled={!canEdit} onClick={() => askRenameProject(entry)}><Pencil size={13} /></button>
      </div>}
      {!batchMode && <button className={`project-favorite ${entry.favorite ? 'active' : ''}`} aria-label={entry.favorite ? `Remove ${entry.name} from favorites` : `Add ${entry.name} to favorites`} aria-pressed={Boolean(entry.favorite)} onClick={() => void toggleProjectFavorite(entry)}><Star size={15} fill={entry.favorite ? 'currentColor' : 'none'} /></button>}
      {!batchMode && <button className="project-actions" data-project-actions={entry.id} aria-label={t('Actions for {name}', { name: entry.name })} aria-haspopup="menu" aria-expanded={projectMenu === entry.id} onClick={() => setProjectMenu(id => id === entry.id ? null : entry.id)}><MoreHorizontal size={16} /></button>}
      {projectMenu === entry.id && <div className="project-menu" data-project-menu={entry.id} role="menu" aria-label={t('{name} actions', { name: entry.name })}>
        <span className="project-menu-heading">{entry.name}</span>
        <button role="menuitem" onClick={() => void openLibraryProject(entry)}><FolderOpen size={14} /><span>{t('Open project')}</span></button>
        <button role="menuitem" disabled={!canEdit} onClick={() => askRenameProject(entry)}><Pencil size={14} /><span>{t('Rename…')}</span></button>
        <button role="menuitem" onClick={() => void toggleProjectFavorite(entry)}><Star size={14} /><span>{entry.favorite ? t('Remove from favorites') : t('Add to favorites')}</span></button>
        <button role="menuitem" disabled={!canEdit} onClick={() => askGroupProject(entry)}><Layers size={14} /><span>{entry.group ? t('Group: {name}', { name: entry.group }) : t('Move to group…')}</span></button>
        <button role="menuitem" disabled={!canEdit} onClick={() => void duplicateProject(entry)}><Copy size={14} /><span>{t('Duplicate')}</span></button>
        <button role="menuitem" onClick={() => void exportLibraryProject(entry)}><Download size={14} /><span>{t('Export project file')}</span></button>
        <button role="menuitem" className="danger" onClick={() => askDeleteProject(entry)}><Trash2 size={14} /><span>{t('Move to Recently deleted…')}</span></button>
      </div>}
    </div>;
}
