import { describe, expect, it } from 'vitest';
import { checkOutcome, shouldCheckForUpdates, showUpdateNotice, updateBlockedReason, UPDATE_INTERVAL_MS, UPDATE_RETRY_MS, type UpdateState } from '../src/app/updates';
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
  it('retries a failed quiet check after an hour instead of waiting a day', () => {
    const failedAt = eligible.now - UPDATE_RETRY_MS;
    expect(shouldCheckForUpdates({ ...eligible, lastCheck: failedAt, lastFailed: true })).toBe(true);
    expect(shouldCheckForUpdates({ ...eligible, lastCheck: failedAt + 1, lastFailed: true })).toBe(false);
    expect(shouldCheckForUpdates({ ...eligible, lastCheck: failedAt, lastFailed: false })).toBe(false);
  });
});

describe('update check outcomes', () => {
  it('announces a version found by a quiet check exactly once', () => {
    const first = checkOutcome({ silent: true, version: '0.3.0', announced: '' });
    expect(first).toMatchObject({ state: 'available', announce: true, announced: '0.3.0', message: null });
    expect(checkOutcome({ silent: true, version: '0.3.0', announced: first.announced }).announce).toBe(false);
    expect(checkOutcome({ silent: true, version: '0.3.1', announced: first.announced }).announce).toBe(true);
  });
  it('does not announce what the user just checked for, but remembers it', () => {
    expect(checkOutcome({ silent: false, version: '0.3.0', announced: '' })).toMatchObject({ announce: false, announced: '0.3.0' });
  });
  it('reports up to date only for manual checks and clears stale errors on quiet ones', () => {
    expect(checkOutcome({ silent: false, version: null, announced: '' })).toMatchObject({ state: 'idle', message: 'up-to-date' });
    expect(checkOutcome({ silent: true, version: null, announced: '0.3.0' })).toMatchObject({ state: 'idle', message: null, announce: false, announced: '0.3.0' });
  });
});

describe('installing updates', () => {
  it('waits for an export to finish before installing or restarting', () => {
    expect(updateBlockedReason(true)).toMatch(/export/);
    expect(updateBlockedReason(false)).toBeNull();
  });
});
