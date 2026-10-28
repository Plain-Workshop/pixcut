import * as bridge from '../bridge';
import { isLocale, LOCALES, t, type Locale } from '../../i18n';
import { Ban, Copy, Download, HardDrive, RefreshCw, WifiOff } from 'lucide-react';
import { ShortcutSettings } from '../../components/shortcuts/ShortcutSettings';
import { type Project, type Scene } from '../../stores/model';
import { formatBytes } from '../helpers';
import { type Preferences } from '../../stores/preferences';
import { type ShortcutPlatform, type ShortcutSettings as ShortcutSettingsData } from '../../shortcuts/registry';
import type { Dispatch, SetStateAction } from 'react';
import { HINTS_KEY } from '../export-options';

export function SettingsModal({ settingsTab, shortcutDirty, setNotice, setSettingsTab, preferences, updatePreferences, storageUsage, refreshAssetUsage, storageBusy, cleanStorage, storageConfirm, storageNote, language, setLanguage, resetPreferences, showHints, setShowHints, setSnapping, setLayout, shortcuts, platform, applyShortcuts, setShortcutDirty, closeShortcutSettings, appVersion, updateState, updateInfo, updateMessage, checkForUpdates, downloadUpdate, updateProgress, restartUpdate, copyDownloadLink, exporter, diagnostics, copyDiagnostics, recheckExporter, storageLabel, refreshStorage }: {
  settingsTab: "general" | "appearance" | "editing" | "shortcuts" | "updates" | "privacy";
  shortcutDirty: boolean;
  setNotice: Dispatch<SetStateAction<string>>;
  setSettingsTab: Dispatch<SetStateAction<"general" | "appearance" | "editing" | "shortcuts" | "updates" | "privacy">>;
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
  return (
    <>
      <h2 id="modal-title">{t('Settings')}</h2>
      <div className="settings-tabs">{(['general', 'appearance', 'editing', 'shortcuts', 'updates', 'privacy'] as const).map(t => <button key={t} className={settingsTab === t ? 'active' : ''} onClick={() => { if (shortcutDirty && settingsTab === 'shortcuts' && t !== 'shortcuts') { setNotice('Apply or cancel your shortcut changes before leaving Shortcuts.'); return; } setSettingsTab(t); }}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
      {settingsTab === 'general' && <div className="settings-panel">
        <div className="settings-section-title">{t('New project defaults')}</div>
        <div className="settings-grid">
          <label className="field">{t('Canvas format')}<select value={preferences.defaultAspect} onChange={event => updatePreferences({ defaultAspect: event.target.value as Project['aspect'] })}><option value="16:9">{t('16:9 · Landscape')}</option><option value="9:16">{t('9:16 · Vertical')}</option><option value="1:1">{t('1:1 · Square')}</option><option value="4:5">{t('4:5 · Portrait')}</option></select></label>
          <label className="field">{t('Photo duration')}<input type="number" min="1" max="10" step="0.5" value={preferences.defaultSceneSeconds} onChange={event => updatePreferences({ defaultSceneSeconds: Math.min(10, Math.max(1, Number(event.target.value) || 4)) })} /></label>
          <label className="field">{t('Image scaling')}<select value={preferences.defaultFit} onChange={event => updatePreferences({ defaultFit: event.target.value as Scene['fit'] })}><option value="cover">{t('Fill frame')}</option><option value="contain">{t('Fit whole image')}</option><option value="blur">{t('Blur fill')}</option></select></label>
        </div>
        {bridge.native && <div className="settings-section storage-section">
          <div className="settings-section-title">{t('Local media store')}</div>
          <p className="storage-usage">{storageUsage ? `${storageUsage.files} file${storageUsage.files === 1 ? '' : 's'} · ${formatBytes(storageUsage.bytes)}` : 'Checking…'}</p>
          <p className="note">Imported photos, video and audio live in PixCut's local store. Cleanup keeps anything used by an open project, its undo steps, or a saved project.</p>
          <div className="settings-actions">
            <button className="button" onClick={() => void refreshAssetUsage()} disabled={storageBusy}>{t('Refresh')}</button>
            <button className="button" onClick={() => void cleanStorage()} disabled={storageBusy}>{storageBusy ? 'Cleaning…' : storageConfirm ? 'Confirm cleanup' : 'Remove unused media'}</button>
          </div>
          {storageNote && <p className="note" role="status">{storageNote}</p>}
        </div>}
        <div className="settings-section-title">{t('Language')}</div>
        <label className="field">{t('Interface language')}<select value={language} onChange={e => { const next = isLocale(e.target.value) ? e.target.value : 'en'; setLanguage(next); try { localStorage.setItem('pixcut-language', next); } catch {} }}>{LOCALES.map(locale => <option key={locale.id} value={locale.id}>{locale.label}</option>)}</select></label>
        <p className="note">{t('Language selection is stored locally and applies to the main screens; some editor panels are still being translated.')}</p>
        <div className="settings-footer"><button className="button subtle" onClick={resetPreferences}><RefreshCw size={14} /> {t('Reset preferences')}</button></div>
      </div>}
      {settingsTab === 'appearance' && <div className="settings-panel">
        <div className="settings-section-title">{t('Theme')}</div>
        <label className="field">{t('App theme')}<select value={preferences.theme} onChange={event => updatePreferences({ theme: event.target.value as 'dark' | 'light' })}><option value="dark">{t('Dark gray · default')}</option><option value="light">{t('Light')}</option></select></label>
        <p className="note">{t('Dark gray is the default. The light theme keeps the original bright home and navy editor.')}</p>
        <div className="settings-section-title">{t('Editor comfort')}</div>
        <label className="checkbox-field settings-toggle"><input type="checkbox" checked={preferences.compact} onChange={event => updatePreferences({ compact: event.target.checked })} /><span><strong>{t('Compact editor')}</strong><small>{t('Tighter panels and controls, more timeline space.')}</small></span></label>
        <label className="checkbox-field settings-toggle"><input type="checkbox" checked={preferences.reduceMotion} onChange={event => updatePreferences({ reduceMotion: event.target.checked })} /><span><strong>{t('Reduce motion')}</strong><small>{t('Disable interface animations and transitions.')}</small></span></label>
        <label className="checkbox-field settings-toggle"><input type="checkbox" checked={showHints && preferences.showHints} onChange={event => { setShowHints(event.target.checked); updatePreferences({ showHints: event.target.checked }); if (!event.target.checked) { try { localStorage.setItem(HINTS_KEY, '1'); } catch { /* optional */ } } else { try { localStorage.removeItem(HINTS_KEY); } catch { /* optional */ } } }} /><span><strong>{t('Quick-start hints')}</strong><small>{t('Show the shortcut strip the first time you edit.')}</small></span></label>
        <div className="settings-preview"><span className="settings-preview-frame"><span /></span><div><strong>{t('Home stays light. Editing stays focused.')}</strong><p>{t('PixCut uses a light library for browsing and a deep navy workspace for editing. Media never leaves this device.')}</p></div></div>
      </div>}
      {settingsTab === 'editing' && <div className="settings-panel">
        <div className="settings-section-title">{t('Editing behavior')}</div>
        <label className="field">{t('Autosave delay')}<select value={preferences.autosaveMs} onChange={event => updatePreferences({ autosaveMs: Number(event.target.value) })}><option value={300}>Fast · 0.3 s</option><option value={700}>Balanced · 0.7 s</option><option value={1500}>Relaxed · 1.5 s</option><option value={3000}>Battery saver · 3 s</option></select></label>
        <label className="checkbox-field settings-toggle"><input type="checkbox" checked={preferences.snapping} onChange={event => { setSnapping(event.target.checked); updatePreferences({ snapping: event.target.checked }); }} /><span><strong>{t('Snap timeline by default')}</strong><small>{t('New sessions start with snapping enabled.')}</small></span></label>
        <p className="note">Undo history is session-only and keeps up to 30 edits. Duration, speed, text, and audio edits commit as undo steps.</p>
        <div className="settings-footer"><button className="button" onClick={() => { setLayout({}); try { localStorage.removeItem('pixcut-layout'); } catch {} setNotice('Editor layout reset.'); }}><RefreshCw size={14} /> {t('Reset panel layout')}</button></div>
      </div>}
      {settingsTab === 'shortcuts' && <ShortcutSettings settings={shortcuts} platform={platform} onApply={applyShortcuts} onDirtyChange={setShortcutDirty} onClose={closeShortcutSettings} />}
      {settingsTab === 'updates' && <div className="settings-panel">
        <div className="settings-section-title">{t('Application updates')}</div>
        <label className="checkbox-field settings-toggle"><input type="checkbox" checked={preferences.automaticUpdates} onChange={event => updatePreferences({ automaticUpdates: event.target.checked })} /><span><strong>{t('Automatically check for updates')}</strong><small>{t('On launch and daily while Home is open. Downloads require your approval.')}</small></span></label>
        <div className="update-card">
          <div className="update-head">
            <div>
              <strong>PixCut {appVersion}</strong>
              <small>{updateState === 'checking' ? 'Checking the release feed…' : updateState === 'available' ? `Version ${updateInfo?.version ?? ''} is available.` : updateState === 'downloading' ? 'Downloading and verifying the update…' : updateState === 'ready' ? 'The update is ready to install.' : updateState === 'error' ? updateMessage : updateMessage || (preferences.automaticUpdates ? 'Checks on launch and once a day while Home is open.' : 'Automatic checks are off.')}</small>
            </div>
            <button className="button subtle" disabled={!bridge.native || updateState === 'checking' || updateState === 'downloading' || updateState === 'ready'} onClick={checkForUpdates}><RefreshCw size={14} className={updateState === 'checking' ? 'spin' : ''} /> {t('Check for updates')}</button>
          </div>
          {updateState === 'available' && updateInfo && <div className="update-body">
            <div className="update-version"><span>Version {updateInfo.version}</span>{updateInfo.date && <span>{new Date(updateInfo.date).toLocaleDateString()}</span>}</div>
            {updateInfo.notes && <p className="update-notes">{updateInfo.notes}</p>}
            <button className="button" onClick={downloadUpdate}><Download size={14} /> Download and install</button>
          </div>}
          {updateState === 'downloading' && <div className="export-progress"><div><span style={{ width: `${updateProgress}%` }} /></div><span>{updateProgress}%</span></div>}
          {updateState === 'ready' && <div className="update-body"><p className="note">Restart PixCut to finish installing version {updateInfo?.version ?? 'the update'}.</p><button className="button" onClick={restartUpdate}><RefreshCw size={14} /> {t('Restart to update')}</button></div>}
          {updateState === 'error' && <div className="update-body"><button className="button subtle" onClick={copyDownloadLink}><Copy size={14} /> Copy download link</button></div>}
          {!bridge.native && <p className="note">Updates are available in the installed desktop app, not the browser preview.</p>}
          <p className="note">Updates are signed and verified. Automatic checks wait until you return Home.</p>
        </div>
        <div className="settings-section-title">Version & build details</div>
        <div className="build-summary"><div><span>Version</span><strong>{appVersion}</strong></div><div><span>Running as</span><strong>{bridge.native ? 'Desktop app' : 'Browser preview'}</strong></div><div><span>Build</span><strong>{__BUILD_SHA__ === 'dev' ? 'Local development' : __BUILD_SHA__.slice(0, 8)}</strong></div><div><span>Built on</span><strong>{new Date(__BUILD_DATE__).toLocaleDateString()}</strong></div><div><span>Video export</span><strong>{!bridge.native ? 'Desktop app only' : exporter ? 'FFmpeg ready' : 'FFmpeg not found'}</strong></div></div>
        <p className="note">These details identify your installed copy. Include the diagnostics below when reporting a problem.</p>
        <pre className="diagnostics">{diagnostics()}</pre>
        <div className="settings-footer"><button className="button" onClick={copyDiagnostics}><Copy size={14} /> {t('Copy diagnostics')}</button><button className="button subtle" onClick={recheckExporter}><RefreshCw size={14} /> {t('Recheck FFmpeg')}</button></div>
      </div>}
      {settingsTab === 'privacy' && <div className="settings-panel">
        <div className="settings-section-title">Local storage</div>
        <div className="storage-card"><HardDrive size={18} /><div><strong>{storageLabel}</strong><small>{t('Projects, recovery, thumbnails, and preferences are stored on this device.')}</small></div><button className="text-button" onClick={refreshStorage}>Refresh</button></div>
        <div className="privacy-grid"><div><WifiOff size={16} /><strong>{t('No account')}</strong><span>{t('No sign-in, cloud sync, or profile.')}</span></div><div><Ban size={16} /><strong>{t('No trackers')}</strong><span>{t('No analytics or remote requests while editing.')}</span></div><div><HardDrive size={16} /><strong>{t('Your files')}</strong><span>{t('Original photos and audio are never modified.')}</span></div></div>
        <p className="note">Deleting a project removes its local library record and media assets. Exported videos and downloaded project backups are not touched.</p>
      </div>}
    </>
  );
}
