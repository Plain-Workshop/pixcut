export const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** A quiet check that could not reach the release feed is retried sooner than the daily schedule. */
export const UPDATE_RETRY_MS = 60 * 60 * 1000;
export type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';
export function shouldCheckForUpdates(input: { native: boolean; enabled: boolean; home: boolean; visible: boolean; online: boolean; state: UpdateState; lastCheck: number; now: number; lastFailed?: boolean }) {
  const interval = input.lastFailed ? UPDATE_RETRY_MS : UPDATE_INTERVAL_MS;
  return input.native && input.enabled && input.home && input.visible && input.online &&
    (input.state === 'idle' || input.state === 'error') &&
    (input.lastCheck === 0 || input.now - input.lastCheck >= interval);
}
export function showUpdateNotice(state: UpdateState) {
  return state === 'available' || state === 'downloading' || state === 'ready';
}
/** Installing or restarting must wait for exports to finish; the open project is saved first. */
export function updateBlockedReason(exporting: boolean): string | null {
  return exporting ? 'Finish or cancel the export before updating PixCut.' : null;
}

/** What a successful check shows: quiet checks announce each new version once and never leave a stale message. */
export function checkOutcome(input: { silent: boolean; version: string | null; announced: string }): { state: UpdateState; message: 'up-to-date' | null; announce: boolean; announced: string } {
  const { silent, version, announced } = input;
  return {
    state: version ? 'available' : 'idle',
    message: !version && !silent ? 'up-to-date' : null,
    announce: Boolean(version && silent && version !== announced),
    announced: version ?? announced,
  };
}
