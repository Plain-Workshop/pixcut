import * as bridge from '../bridge';
import { isLocale, LOCALES, t, type Locale } from '../../i18n';
import { Ban, Check, Copy, Download, HardDrive, Info, Keyboard, Monitor, Moon, Palette, RefreshCw, Scissors, Settings2, ShieldCheck, Sun, WifiOff } from 'lucide-react';
import { ShortcutSettings } from '../../components/shortcuts/ShortcutSettings';
import { type Project, type Scene } from '../../stores/model';
import { formatBytes } from '../helpers';
import { type Preferences } from '../../stores/preferences';
import { type ShortcutPlatform, type ShortcutSettings as ShortcutSettingsData } from '../../shortcuts/registry';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { HINTS_KEY } from '../export-options';

export type SettingsTab = 'general' | 'appearance' | 'editing' | 'shortcuts' | 'privacy' | 'updates';

const SECTIONS: { id: SettingsTab; label: string; blurb: string; icon: typeof Settings2 }[] = [
  { id: 'general', label: 'General', blurb: 'Language and the starting point for new projects.', icon: Settings2 },
  { id: 'appearance', label: 'Appearance', blurb: 'Theme, density and motion.', icon: Palette },
  { id: 'editing', label: 'Editing', blurb: 'How the editor saves and snaps while you work.', icon: Scissors },
  { id: 'shortcuts', label: 'Shortcuts', blurb: 'Rebind any action to the keys you prefer.', icon: Keyboard },
  { id: 'privacy', label: 'Storage & privacy', blurb: 'What PixCut keeps on this device, and how to tidy it.', icon: ShieldCheck },
  { id: 'updates', label: 'Updates & about', blurb: 'Signed updates, version details and diagnostics.', icon: Info },
];

const THEMES: { id: Preferences['theme']; label: string; note: string; icon: typeof Moon }[] = [
  { id: 'dark', label: 'Dark gray', note: 'Default', icon: Moon },
  { id: 'light', label: 'Light', note: 'Bright home, navy editor', icon: Sun },
  { id: 'system', label: 'System', note: 'Follows your OS', icon: Monitor },
];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <section className="settings-group"><h4 className="settings-section-title">{title}</h4><div className="settings-card">{children}</div></section>;
}

function Row({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return <label className="settings-row"><span className="settings-row-text"><strong>{title}</strong>{description && <small>{description}</small>}</span><span className="settings-row-control">{children}</span></label>;
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return <input type="checkbox" role="switch" className="settings-switch" checked={checked} onChange={event => onChange(event.target.checked)} />;
}

export function SettingsModal({ settingsTab, shortcutDirty, setNotice, setSettingsTab, preferences, updatePreferences, storageUsage, refreshAssetUsage, storageBusy, cleanStorage, storageConfirm, storageNote, language, setLanguage, resetPreferences, showHints, setShowHints, setSnapping, setLayout, shortcuts, platform, applyShortcuts, setShortcutDirty, closeShortcutSettings, appVersion, updateState, updateInfo, updateMessage, checkForUpdates, downloadUpdate, updateProgress, restartUpdate, copyDownloadLink, exporter, diagnostics, copyDiagnostics, recheckExporter, storageLabel, refreshStorage }: {
  settingsTab: SettingsTab;
  shortcutDirty: boolean;
  setNotice: Dispatch<SetStateAction<string>>;
  setSettingsTab: Dispatch<SetStateAction<SettingsTab>>;
  preferences: Preferences;
  updatePreferences: (patch: Partial<Preferences>) => void;
  storageUsage: bridge.AssetUsage | null;
  refreshAssetUsage: () => Promise<void>;
  storageBusy: boolean;
  cleanStorage: () => Promise<void>;
  storageConfirm: boolean;
  storageNote: string | null;
  language: Locale;
  setLanguage: Dispatch<SetStateAction<Locale>>;
  resetPreferences: () => void;
  showHints: boolean;
  setShowHints: Dispatch<SetStateAction<boolean>>;
  setSnapping: Dispatch<SetStateAction<boolean>>;
  setLayout: Dispatch<any>;
  shortcuts: ShortcutSettingsData;
  platform: ShortcutPlatform;
  applyShortcuts: (next: ShortcutSettingsData) => boolean;
  setShortcutDirty: Dispatch<SetStateAction<boolean>>;
  closeShortcutSettings: () => void;
  appVersion: string;
  updateState: "idle" | "checking" | "available" | "downloading" | "ready" | "error";
  updateInfo: bridge.UpdateInfo | null;
  updateMessage: string;
  checkForUpdates: () => void;
  downloadUpdate: () => void;
  updateProgress: number;
  restartUpdate: () => void;
  copyDownloadLink: () => void;
  exporter: boolean;
  diagnostics: () => string;
  copyDiagnostics: () => void;
  recheckExporter: () => void;
  storageLabel: string;
  refreshStorage: () => void;
}) {
  const section = SECTIONS.find(item => item.id === settingsTab) ?? SECTIONS[0];
  const select = (next: SettingsTab) => {
    if (shortcutDirty && settingsTab === 'shortcuts' && next !== 'shortcuts') { setNotice(t('Apply or cancel your shortcut changes before leaving Shortcuts.')); return; }
    setSettingsTab(next);
  };
  const setHints = (next: boolean) => {
    setShowHints(next);
    updatePreferences({ showHints: next });
    try { if (next) localStorage.removeItem(HINTS_KEY); else localStorage.setItem(HINTS_KEY, '1'); } catch { /* optional */ }
  };
  const updateStatus = updateState === 'checking' ? t('Checking the release feed…')
    : updateState === 'available' ? t('Version {version} is available.', { version: updateInfo?.version ?? '' })
    : updateState === 'downloading' ? t('Downloading and verifying the update…')
    : updateState === 'ready' ? t('The update is ready to install.')
    : updateState === 'error' ? updateMessage
    : updateMessage || (preferences.automaticUpdates ? t('Checks on launch and once a day while Home is open.') : t('Automatic checks are off.'));

  return (
    <>
      <h2 id="modal-title">{t('Settings')}</h2>
      <div className="settings-shell">
        <nav className="settings-nav" role="tablist" aria-orientation="vertical" aria-label={t('Settings')}>
          {SECTIONS.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={settingsTab === id} className={settingsTab === id ? 'active' : ''} onClick={() => select(id)}><Icon size={15} /><span>{t(label)}</span>{id === 'updates' && (updateState === 'available' || updateState === 'ready') && <i className="settings-nav-dot" aria-label={t('Update available')} />}</button>)}
          <div className="settings-nav-footer">
            <button className="button subtle" onClick={resetPreferences}><RefreshCw size={13} /> {t('Reset preferences')}</button>
            <small>{t('Saved automatically on this device.')}</small>
          </div>
        </nav>

        <div className="settings-content" role="tabpanel">
          {settingsTab !== 'shortcuts' && <header className="settings-content-head"><h3>{t(section.label)}</h3><p>{t(section.blurb)}</p></header>}

          {settingsTab === 'general' && <>
            <Group title={t('Language')}>
              <Row title={t('Interface language')} description={t('Some editor panels are still being translated.')}>
                <select value={language} onChange={e => { const next = isLocale(e.target.value) ? e.target.value : 'en'; setLanguage(next); try { localStorage.setItem('pixcut-language', next); } catch { /* optional */ } }}>{LOCALES.map(locale => <option key={locale.id} value={locale.id}>{locale.label}</option>)}</select>
              </Row>
            </Group>
            <Group title={t('New project defaults')}>
              <Row title={t('Canvas format')} description={t('Aspect ratio for blank projects. You can change it per project.')}>
                <select value={preferences.defaultAspect} onChange={event => updatePreferences({ defaultAspect: event.target.value as Project['aspect'] })}><option value="16:9">{t('16:9 · Landscape')}</option><option value="9:16">{t('9:16 · Vertical')}</option><option value="1:1">{t('1:1 · Square')}</option><option value="4:5">{t('4:5 · Portrait')}</option></select>
              </Row>
              <Row title={t('Photo duration')} description={t('How long each imported photo stays on screen.')}>
                <span className="settings-number"><input type="number" min="1" max="10" step="0.5" value={preferences.defaultSceneSeconds} onChange={event => updatePreferences({ defaultSceneSeconds: Math.min(10, Math.max(1, Number(event.target.value) || 4)) })} /><em>s</em></span>
              </Row>
              <Row title={t('Image scaling')} description={t('How photos that do not match the canvas are framed.')}>
                <select value={preferences.defaultFit} onChange={event => updatePreferences({ defaultFit: event.target.value as Scene['fit'] })}><option value="cover">{t('Fill frame')}</option><option value="contain">{t('Fit whole image')}</option><option value="blur">{t('Blur fill')}</option></select>
              </Row>
            </Group>
          </>}

          {settingsTab === 'appearance' && <>
            <section className="settings-group">
              <h4 className="settings-section-title">{t('Theme')}</h4>
              <div className="settings-themes" role="radiogroup" aria-label={t('App theme')}>
                {THEMES.map(({ id, label, note, icon: Icon }) => <button key={id} role="radio" aria-label={t(label)} aria-checked={preferences.theme === id} className={`settings-theme ${id} ${preferences.theme === id ? 'active' : ''}`} onClick={() => updatePreferences({ theme: id })}>
                  <span className="settings-theme-swatch"><span /><span /></span>
                  <span className="settings-theme-label"><Icon size={13} /> {t(label)}{preferences.theme === id && <Check size={13} className="settings-theme-check" />}</span>
                  <small>{t(note)}</small>
                </button>)}
              </div>
            </section>
            <Group title={t('Editor comfort')}>
              <Row title={t('Compact editor')} description={t('Tighter panels and controls, more timeline space.')}><Switch checked={preferences.compact} onChange={compact => updatePreferences({ compact })} /></Row>
              <Row title={t('Reduce motion')} description={t('Disable interface animations and transitions.')}><Switch checked={preferences.reduceMotion} onChange={reduceMotion => updatePreferences({ reduceMotion })} /></Row>
              <Row title={t('Quick-start hints')} description={t('Show the shortcut strip the first time you edit.')}><Switch checked={showHints && preferences.showHints} onChange={setHints} /></Row>
            </Group>
          </>}

          {settingsTab === 'editing' && <>
            <Group title={t('Saving')}>
              <Row title={t('Autosave delay')} description={t('How long PixCut waits after an edit before saving. Longer saves battery.')}>
                <select value={preferences.autosaveMs} onChange={event => updatePreferences({ autosaveMs: Number(event.target.value) })}><option value={300}>{t('Fast')} · 0.3 s</option><option value={700}>{t('Balanced')} · 0.7 s</option><option value={1500}>{t('Relaxed')} · 1.5 s</option><option value={3000}>{t('Battery saver')} · 3 s</option></select>
              </Row>
            </Group>
            <Group title={t('Timeline')}>
              <Row title={t('Snap timeline by default')} description={t('New sessions start with snapping enabled.')}><Switch checked={preferences.snapping} onChange={snapping => { setSnapping(snapping); updatePreferences({ snapping }); }} /></Row>
              <div className="settings-row">
                <span className="settings-row-text"><strong>{t('Panel layout')}</strong><small>{t('Restore the default panel sizes and positions.')}</small></span>
                <span className="settings-row-control"><button className="button subtle" onClick={() => { setLayout({}); try { localStorage.removeItem('pixcut-layout'); } catch { /* optional */ } setNotice(t('Editor layout reset.')); }}><RefreshCw size={13} /> {t('Reset panel layout')}</button></span>
              </div>
            </Group>
            <p className="note">{t('Undo history is session-only and keeps up to 30 edits. Duration, speed, text, and audio edits commit as undo steps.')}</p>
          </>}

          {settingsTab === 'shortcuts' && <ShortcutSettings settings={shortcuts} platform={platform} onApply={applyShortcuts} onDirtyChange={setShortcutDirty} onClose={closeShortcutSettings} />}

          {settingsTab === 'privacy' && <>
            <div className="privacy-grid"><div><WifiOff size={16} /><strong>{t('No account')}</strong><span>{t('No sign-in, cloud sync, or profile.')}</span></div><div><Ban size={16} /><strong>{t('No trackers')}</strong><span>{t('No analytics or remote requests while editing.')}</span></div><div><HardDrive size={16} /><strong>{t('Your files')}</strong><span>{t('Original photos and audio are never modified.')}</span></div></div>
            <Group title={t('Local storage')}>
              <div className="settings-row">
                <span className="settings-row-text"><strong>{storageLabel}</strong><small>{t('Projects, recovery, thumbnails, and preferences are stored on this device.')}</small></span>
                <span className="settings-row-control"><button className="button subtle" onClick={refreshStorage}><RefreshCw size={13} /> {t('Refresh')}</button></span>
              </div>
              {bridge.native && <div className="settings-row">
                <span className="settings-row-text"><strong>{t('Media store')} · {storageUsage ? `${storageUsage.files} ${storageUsage.files === 1 ? t('file') : t('files')} · ${formatBytes(storageUsage.bytes)}` : t('Checking…')}</strong><small>{t('Cleanup keeps anything used by an open project, its undo steps, or a saved project.')}</small>{storageNote && <small role="status" className="settings-status">{storageNote}</small>}</span>
                <span className="settings-row-control settings-row-actions">
                  <button className="button subtle" onClick={() => void refreshAssetUsage()} disabled={storageBusy} aria-label={t('Refresh media store usage')}><RefreshCw size={13} /></button>
                  <button className={`button ${storageConfirm ? 'danger' : 'subtle'}`} onClick={() => void cleanStorage()} disabled={storageBusy}>{storageBusy ? t('Cleaning…') : storageConfirm ? t('Confirm cleanup') : t('Remove unused media')}</button>
                </span>
              </div>}
            </Group>
            <p className="note">{t('Deleting a project removes its local library record and media assets. Exported videos and downloaded project backups are not touched.')}</p>
          </>}

          {settingsTab === 'updates' && <>
            <Group title={t('Application updates')}>
              <Row title={t('Automatically check for updates')} description={t('On launch and daily while Home is open. Downloads require your approval.')}><Switch checked={preferences.automaticUpdates} onChange={automaticUpdates => updatePreferences({ automaticUpdates })} /></Row>
              <div className="settings-row">
                <span className="settings-row-text"><strong>PixCut {appVersion}</strong><small>{updateStatus}</small></span>
                <span className="settings-row-control"><button className="button subtle" disabled={!bridge.native || updateState === 'checking' || updateState === 'downloading' || updateState === 'ready'} onClick={checkForUpdates}><RefreshCw size={13} className={updateState === 'checking' ? 'spin' : ''} /> {t('Check for updates')}</button></span>
              </div>
              {updateState === 'available' && updateInfo && <div className="settings-row update-body">
                <span className="settings-row-text"><strong>{t('Version {version}', { version: updateInfo.version })}{updateInfo.date && ` · ${new Date(updateInfo.date).toLocaleDateString()}`}</strong>{updateInfo.notes && <small className="update-notes">{updateInfo.notes}</small>}</span>
                <span className="settings-row-control"><button className="button" onClick={downloadUpdate}><Download size={13} /> {t('Download and install')}</button></span>
              </div>}
              {updateState === 'downloading' && <div className="settings-row"><div className="export-progress"><div><span style={{ width: `${updateProgress}%` }} /></div><span>{updateProgress}%</span></div></div>}
              {updateState === 'ready' && <div className="settings-row">
                <span className="settings-row-text"><small>{t('Restart PixCut to finish installing version {version}.', { version: updateInfo?.version ?? '' })}</small></span>
                <span className="settings-row-control"><button className="button" onClick={restartUpdate}><RefreshCw size={13} /> {t('Restart to update')}</button></span>
              </div>}
              {updateState === 'error' && <div className="settings-row"><span className="settings-row-text"><small>{t('You can download the latest version manually.')}</small></span><span className="settings-row-control"><button className="button subtle" onClick={copyDownloadLink}><Copy size={13} /> {t('Copy download link')}</button></span></div>}
            </Group>
            <p className="note">{bridge.native ? t('Updates are signed and verified. Automatic checks wait until you return Home.') : t('Updates are available in the installed desktop app, not the browser preview.')}</p>
            <section className="settings-group">
              <h4 className="settings-section-title">{t('Version & build details')}</h4>
              <div className="build-summary"><div><span>{t('Version')}</span><strong>{appVersion}</strong></div><div><span>{t('Running as')}</span><strong>{bridge.native ? t('Desktop app') : t('Browser preview')}</strong></div><div><span>{t('Build')}</span><strong>{__BUILD_SHA__ === 'dev' ? t('Local development') : __BUILD_SHA__.slice(0, 8)}</strong></div><div><span>{t('Built on')}</span><strong>{new Date(__BUILD_DATE__).toLocaleDateString()}</strong></div><div><span>{t('Video export')}</span><strong>{!bridge.native ? t('Desktop app only') : exporter ? t('FFmpeg ready') : t('FFmpeg not found')}</strong></div></div>
            </section>
            <section className="settings-group">
              <h4 className="settings-section-title">{t('Diagnostics')}</h4>
              <pre className="diagnostics">{diagnostics()}</pre>
              <div className="settings-footer"><button className="button" onClick={copyDiagnostics}><Copy size={13} /> {t('Copy diagnostics')}</button><button className="button subtle" onClick={recheckExporter}><RefreshCw size={13} /> {t('Recheck FFmpeg')}</button></div>
              <p className="note">{t('Include these details when reporting a problem.')}</p>
            </section>
          </>}
        </div>
      </div>
    </>
  );
}
