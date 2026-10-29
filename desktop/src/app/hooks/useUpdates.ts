import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import * as bridge from '../bridge';
import { messageFor } from '../errors';
import { t } from '../../i18n';
import { checkOutcome, shouldCheckForUpdates, updateBlockedReason, type UpdateState } from '../updates';

const RELEASES_URL = 'https://github.com/Plain-Workshop/pixcut/releases/latest';

export function useUpdates({ automaticUpdates, home, exporting, setNotice, saveBeforeUpdate }: {
  automaticUpdates: boolean;
  home: boolean;
  exporting: boolean;
  setNotice: Dispatch<SetStateAction<string>>;
  /** Saves the open project; the Windows installer and relaunch both quit PixCut. */
  saveBeforeUpdate: () => Promise<void>;
}) {
  const [appVersion, setAppVersion] = useState(__APP_VERSION__);
  const lastUpdateCheck = useRef(0);
  const lastCheckFailed = useRef(false);
  const announcedVersion = useRef('');
  const updateCheckInFlight = useRef(false);
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [updateInfo, setUpdateInfo] = useState<bridge.UpdateInfo | null>(null);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateMessage, setUpdateMessage] = useState('');

  useEffect(() => { bridge.appVersion().then(version => { if (version) setAppVersion(version); }).catch(() => { /* browser preview */ }); }, []);

  function updateErrorText(error: unknown) {
    const raw = error instanceof Error ? error.message : String(error ?? '');
    if (/fetch|network|connect|timeout|dns|release json|status code|404|403|500|502|503/i.test(raw)) return t('Could not reach the release feed. Check your connection and try again.');
    if (/signature|public key|verify/i.test(raw)) return t('This update could not be verified, so PixCut did not install it.');
    return messageFor(error);
  }

  async function performUpdateCheck(silent: boolean) {
    if (updateCheckInFlight.current) return;
    updateCheckInFlight.current = true;
    lastUpdateCheck.current = Date.now();
    if (!silent) { setUpdateState('checking'); setUpdateMessage(''); }
    try {
      const info = await bridge.checkForUpdate();
      lastCheckFailed.current = false;
      const outcome = checkOutcome({ silent, version: info?.version ?? null, announced: announcedVersion.current });
      announcedVersion.current = outcome.announced;
      setUpdateInfo(info);
      setUpdateState(outcome.state);
      setUpdateMessage(outcome.message ? t('PixCut is up to date.') : '');
      if (outcome.announce && info) setNotice(t('PixCut {version} is available. Open Settings → Updates to install it.', { version: info.version }));
    } catch (error) {
      lastCheckFailed.current = true;
      if (!silent) { setUpdateState('error'); setUpdateMessage(updateErrorText(error)); }
    } finally { updateCheckInFlight.current = false; }
  }

  function checkForUpdates() { void performUpdateCheck(false); }

  useEffect(() => {
    const check = () => {
      if (shouldCheckForUpdates({ native: bridge.native, enabled: automaticUpdates, home: home && !exporting,
        visible: document.visibilityState === 'visible', online: navigator.onLine, state: updateState, lastCheck: lastUpdateCheck.current, lastFailed: lastCheckFailed.current, now: Date.now() })) void performUpdateCheck(true);
    };
    const startup = window.setTimeout(check, 15_000);
    const interval = window.setInterval(check, 60_000);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    return () => { clearTimeout(startup); clearInterval(interval); window.removeEventListener('online', check); document.removeEventListener('visibilitychange', check); };
  }, [automaticUpdates, home, exporting, updateState]);

  async function downloadUpdate() {
    const blocked = updateBlockedReason(exporting);
    if (blocked) { setNotice(t(blocked)); return; }
    setUpdateState('downloading'); setUpdateProgress(0); setUpdateMessage('');
    try {
      await saveBeforeUpdate();
      await bridge.installUpdate(setUpdateProgress);
      setUpdateState('ready'); setUpdateMessage('');
      setNotice(t('Update downloaded. Restart PixCut to finish.'));
    } catch (error) {
      setUpdateState('error'); setUpdateMessage(updateErrorText(error));
    }
  }

  async function restartUpdate() {
    const blocked = updateBlockedReason(exporting);
    if (blocked) { setNotice(t(blocked)); return; }
    try {
      await saveBeforeUpdate();
      await bridge.restartToUpdate();
    } catch (error) {
      setUpdateState('error'); setUpdateMessage(updateErrorText(error));
    }
  }

  function copyDownloadLink() {
    const fallback = t('Download the latest release from {url}', { url: RELEASES_URL });
    if (!navigator.clipboard) { setNotice(fallback); return; }
    navigator.clipboard.writeText(RELEASES_URL).then(() => setNotice(t('Download link copied.'))).catch(() => setNotice(fallback));
  }

  return { appVersion, updateState, updateInfo, updateProgress, updateMessage, checkForUpdates, downloadUpdate: () => void downloadUpdate(), restartUpdate: () => void restartUpdate(), copyDownloadLink };
}
