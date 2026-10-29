import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import * as bridge from '../bridge';
import { messageFor } from '../errors';
import { shouldCheckForUpdates, type UpdateState } from '../updates';

const RELEASES_URL = 'https://github.com/Plain-Workshop/pixcut/releases/latest';

export function useUpdates({ automaticUpdates, home, exporting, setNotice }: {
  automaticUpdates: boolean;
  home: boolean;
  exporting: boolean;
  setNotice: Dispatch<SetStateAction<string>>;
}) {
  const [appVersion, setAppVersion] = useState(__APP_VERSION__);
  const lastUpdateCheck = useRef(0);
  const updateCheckInFlight = useRef(false);
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [updateInfo, setUpdateInfo] = useState<bridge.UpdateInfo | null>(null);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateMessage, setUpdateMessage] = useState('');

  useEffect(() => { bridge.appVersion().then(version => { if (version) setAppVersion(version); }).catch(() => { /* browser preview */ }); }, []);

  function updateErrorText(error: unknown) {
    const raw = error instanceof Error ? error.message : String(error ?? '');
    if (/fetch|network|connect|timeout|release json|status code|404|403|500/i.test(raw)) return 'Could not reach the release feed. Check your connection and try again.';
    if (/signature|public key|verify/i.test(raw)) return 'This update could not be verified, so PixCut did not install it.';
    return messageFor(error);
  }

  async function performUpdateCheck(silent: boolean) {
    if (updateCheckInFlight.current) return;
    updateCheckInFlight.current = true;
    lastUpdateCheck.current = Date.now();
    if (!silent) { setUpdateState('checking'); setUpdateMessage(''); }
    try {
      const info = await bridge.checkForUpdate();
      setUpdateInfo(info);
      setUpdateState(info ? 'available' : 'idle');
      if (!silent) setUpdateMessage(info ? '' : 'PixCut is up to date.');
    } catch (error) {
      if (!silent) { setUpdateState('error'); setUpdateMessage(updateErrorText(error)); }
    } finally { updateCheckInFlight.current = false; }
  }

  function checkForUpdates() { void performUpdateCheck(false); }

  useEffect(() => {
    const check = () => {
      if (shouldCheckForUpdates({ native: bridge.native, enabled: automaticUpdates, home: home && !exporting,
        visible: document.visibilityState === 'visible', online: navigator.onLine, state: updateState, lastCheck: lastUpdateCheck.current, now: Date.now() })) void performUpdateCheck(true);
    };
    const startup = window.setTimeout(check, 15_000);
    const interval = window.setInterval(check, 60_000);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    return () => { clearTimeout(startup); clearInterval(interval); window.removeEventListener('online', check); document.removeEventListener('visibilitychange', check); };
  }, [automaticUpdates, home, exporting, updateState]);

  function downloadUpdate() {
    setUpdateState('downloading'); setUpdateProgress(0); setUpdateMessage('');
    bridge.installUpdate(setUpdateProgress)
      .then(() => { setUpdateState('ready'); setUpdateMessage(''); setNotice('Update downloaded. Restart PixCut to finish.'); })
      .catch(error => { setUpdateState('error'); setUpdateMessage(updateErrorText(error)); });
  }

  function restartUpdate() {
    bridge.restartToUpdate().catch(error => { setUpdateState('error'); setUpdateMessage(updateErrorText(error)); });
  }

  function copyDownloadLink() {
    if (!navigator.clipboard) { setNotice(`Download the latest release from ${RELEASES_URL}`); return; }
    navigator.clipboard.writeText(RELEASES_URL).then(() => setNotice('Download link copied.')).catch(() => setNotice(`Download the latest release from ${RELEASES_URL}`));
  }

  return { appVersion, updateState, updateInfo, updateProgress, updateMessage, checkForUpdates, downloadUpdate, restartUpdate, copyDownloadLink };
}
