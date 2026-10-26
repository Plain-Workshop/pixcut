export const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
export type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';
export function shouldCheckForUpdates(input: { native: boolean; enabled: boolean; home: boolean; visible: boolean; online: boolean; state: UpdateState; lastCheck: number; now: number }) {
  return input.native && input.enabled && input.home && input.visible && input.online &&
    (input.state === 'idle' || input.state === 'error') &&
    (input.lastCheck === 0 || input.now - input.lastCheck >= UPDATE_INTERVAL_MS);
}
export function showUpdateNotice(state: UpdateState) {
  return state === 'available' || state === 'downloading' || state === 'ready';
}
