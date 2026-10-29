import { t } from '../../i18n';
import { showUpdateNotice } from '../updates';
import { Keyboard, ArrowUpRight, Clapperboard, Download, FolderOpen, HardDrive, Home, Info, LayoutTemplate, Settings2 } from 'lucide-react';
import type { ProjectSummary } from '../../stores/library';
import { Brand } from '../../components/BrandLogo';
import type { Dispatch, SetStateAction } from 'react';
import * as bridge from "../bridge";

const TIPS = [
  'Press ⌘/Ctrl + 1–6 on Home to open a recent project.',
  'Drop photos anywhere on Home to start a photo movie.',
  'Star a project to keep it first on Home.',
  'Everything stays on this device. No account, no cloud.',
  'Use arrow keys to move through your projects, Enter to open.',
];

export function HomeSidebar({ storageLabel, projects, openProject, setHomeSection, homeSection, setModal, updateState, setSettingsTab, updateProgress, updateInfo, appVersion }: {
  storageLabel: string;
  projects: ProjectSummary[];
  openProject: (entry: ProjectSummary) => Promise<void> | void;
  setHomeSection: Dispatch<SetStateAction<"home" | "projects">>;
  homeSection: "home" | "projects";
  setModal: Dispatch<SetStateAction<"source" | "templates" | "export" | "new" | "shortcuts" | "palette" | "settings" | "delete" | "rename" | "group" | "groups" | "formats" | "missing" | null>>;
  updateState: "idle" | "checking" | "available" | "downloading" | "ready" | "error";
  setSettingsTab: Dispatch<SetStateAction<"shortcuts" | "general" | "appearance" | "editing" | "updates" | "privacy">>;
  updateProgress: number;
  updateInfo: bridge.UpdateInfo | null;
  appVersion: string;
}) {
  const tip = TIPS[Math.floor(Date.now() / 86_400_000) % TIPS.length];
  const recent = [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
  return (
    <>
      <aside className="home-sidebar">
        <button className="brand-button home-brand" aria-label={t('PixCut home')} onClick={() => setHomeSection('home')}><Brand /></button>
        <nav className="home-nav" aria-label={t('Main navigation')}>
          <button className={homeSection === 'home' ? 'active' : ''} onClick={() => setHomeSection('home')}><Home size={18} /><span>{t('Home')}</span></button>
          <button className={homeSection === 'projects' ? 'active' : ''} onClick={() => setHomeSection('projects')}><FolderOpen size={18} /><span>{t('Projects')}</span></button>
          <button onClick={() => setModal('templates')}><LayoutTemplate size={18} /><span>{t('Templates')}</span></button>
          <button onClick={() => setModal('settings')}><Settings2 size={18} /><span>{t('Settings')}</span></button>
        </nav>
        {recent.length > 0 && <div className="sidebar-recent" aria-label={t('Recent projects')}>
          <span className="sidebar-heading">{t('Recent')}</span>
          {recent.map(entry => <button key={entry.id} onClick={() => void openProject(entry)} title={entry.name}><Clapperboard size={13} /><span>{entry.name}</span></button>)}
        </div>}
        <div className="sidebar-card">
          <strong>{t('Tip')}</strong>
          <p>{t(tip)}</p>
          <span className="sidebar-storage"><HardDrive size={12} /> {storageLabel}</span>
        </div>
        <div className="sidebar-bottom">
          {showUpdateNotice(updateState) && <button className={`sidebar-update ${updateState}`} onClick={() => { setSettingsTab('updates'); setModal('settings'); }} aria-label={t('Open application updates')}>
            <Download size={18} />
            <span><strong>{updateState === 'ready' ? t('Ready to restart') : updateState === 'downloading' ? t('Downloading · {percent}%', { percent: updateProgress }) : t('PixCut {version} available', { version: updateInfo?.version ?? '' })}</strong><small>{updateState === 'ready' ? t('Restart to finish updating') : updateState === 'downloading' ? t('View progress') : t('View release notes & install')}</small></span>
            <ArrowUpRight size={14} />
          </button>}
          <button className="sidebar-link" onClick={() => setModal('shortcuts')}><Keyboard size={16} /><span>{t('Keyboard shortcuts')}</span></button>
          <button className="sidebar-link" onClick={() => { setSettingsTab('updates'); setModal('settings'); }}><Info size={16} /><span>{t('Version & build details')}</span></button>
          <div className="sidebar-version"><span>{t('PIXCUT DESKTOP')}</span><span>v{appVersion}</span></div>
        </div>
      </aside>
    </>
  );
}
