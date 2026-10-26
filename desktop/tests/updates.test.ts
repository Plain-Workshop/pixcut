import { describe, expect, it } from 'vitest';
import { shouldCheckForUpdates, showUpdateNotice, UPDATE_INTERVAL_MS, type UpdateState } from '../src/app/updates';
const eligible = { native: true, enabled: true, home: true, visible: true, online: true, state: 'idle' as UpdateState, lastCheck: 0, now: UPDATE_INTERVAL_MS * 2 };
describe('quiet periodic update checks', () => {
  it('checks on launch and once per day, with manual checks resetting the schedule', () => {
    expect(shouldCheckForUpdates(eligible)).toBe(true);
    expect(shouldCheckForUpdates({ ...eligible, lastCheck: eligible.now - 60_000 })).toBe(false);
    expect(shouldCheckForUpdates({ ...eligible, lastCheck: eligible.now - UPDATE_INTERVAL_MS })).toBe(true);
  });
  it('defers browser, editing, hidden, offline, disabled and in-progress sessions', () => {
    for (const key of ['native', 'enabled', 'home', 'visible', 'online'] as const) expect(shouldCheckForUpdates({ ...eligible, [key]: false })).toBe(false);
    for (const state of ['checking', 'available', 'downloading', 'ready'] as const) expect(shouldCheckForUpdates({ ...eligible, state })).toBe(false);
  });
  it('only shows the sidebar card for an available update or installation in progress', () => {
    for (const state of ['idle', 'checking', 'error'] as const) expect(showUpdateNotice(state)).toBe(false);
    for (const state of ['available', 'downloading', 'ready'] as const) expect(showUpdateNotice(state)).toBe(true);
  });
});
