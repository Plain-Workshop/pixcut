import { t } from '../../i18n';
import { showUpdateNotice } from '../updates';
import { Keyboard, ArrowUpRight, Download, FolderOpen, Home, Info, LayoutTemplate, Settings2 } from 'lucide-react';
import { Brand } from '../../components/BrandLogo';
import type { Dispatch, SetStateAction } from 'react';
import * as bridge from "../bridge";

export function HomeSidebar({ setHomeSection, homeSection, setModal, updateState, setSettingsTab, updateProgress, updateInfo, appVersion }: {
  setHomeSection: Dispatch<SetStateAction<"home" | "projects">>;
  homeSection: "home" | "projects";
  setModal: Dispatch<SetStateAction<"source" | "templates" | "export" | "new" | "shortcuts" | "palette" | "settings" | "delete" | "rename" | "group" | "groups" | "formats" | "missing" | null>>;
  updateState: "idle" | "checking" | "available" | "downloading" | "ready" | "error";
  setSettingsTab: Dispatch<SetStateAction<"shortcuts" | "general" | "appearance" | "editing" | "updates" | "privacy">>;
  updateProgress: number;
  updateInfo: bridge.UpdateInfo | null;
  appVersion: string;
}) {
  return (
    <>
      <aside className="home-sidebar">
        <button className="brand-button home-brand" aria-label="PixCut home" onClick={() => setHomeSection('home')}><Brand /></button>
        <nav className="home-nav" aria-label="Main navigation">
          <button className={homeSection === 'home' ? 'active' : ''} onClick={() => setHomeSection('home')}><Home size={18} /><span>{t('Home')}</span></button>
          <button className={homeSection === 'projects' ? 'active' : ''} onClick={() => setHomeSection('projects')}><FolderOpen size={18} /><span>{t('Projects')}</span></button>
          <button onClick={() => setModal('templates')}><LayoutTemplate size={18} /><span>{t('Templates')}</span></button>
          <button onClick={() => setModal('settings')}><Settings2 size={18} /><span>{t('Settings')}</span></button>
        </nav>
        <div className="sidebar-card">
          <strong>{t('Your media stays with you.')}</strong>
          <p>{t('No account. No cloud. Just your stories.')}</p>
        </div>
        <div className="sidebar-bottom">
          {showUpdateNotice(updateState) && <button className={`sidebar-update ${updateState}`} onClick={() => { setSettingsTab('updates'); setModal('settings'); }} aria-label="Open application updates">
            <Download size={18} />
            <span><strong>{updateState === 'ready' ? 'Ready to restart' : updateState === 'downloading' ? `Downloading · ${updateProgress}%` : `PixCut ${updateInfo?.version} available`}</strong><small>{updateState === 'ready' ? 'Restart to finish updating' : updateState === 'downloading' ? 'View progress' : 'View release notes & install'}</small></span>
            <ArrowUpRight size={14} />
          </button>}
          <button className="sidebar-link" onClick={() => setModal('shortcuts')}><Keyboard size={16} /><span>{t('Keyboard shortcuts')}</span></button>
          <button className="sidebar-link" onClick={() => { setSettingsTab('updates'); setModal('settings'); }}><Info size={16} /><span>{t('Version & build details')}</span></button>
          <div className="sidebar-version"><span>PIXCUT DESKTOP</span><span>v{appVersion}</span></div>
        </div>
      </aside>
    </>
  );
}
