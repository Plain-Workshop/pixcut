import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_PREFERENCES, loadPreferences, resolveTheme } from '../src/stores/preferences';
import { SettingsModal } from '../src/app/modals/SettingsModal';
import { setLocale } from '../src/i18n';

let store: Record<string, string> = {};

beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
  });
  vi.stubGlobal('__BUILD_SHA__', 'dev');
  vi.stubGlobal('__BUILD_DATE__', '2026-10-29T00:00:00Z');
});

afterEach(() => {
  vi.unstubAllGlobals();
  setLocale('en');
});

describe('theme preference', () => {
  it('keeps dark as the default and accepts light and system', () => {
    expect(loadPreferences().theme).toBe('dark');
    for (const theme of ['light', 'system', 'dark'] as const) {
      store['pixcut-preferences'] = JSON.stringify({ theme });
      expect(loadPreferences().theme).toBe(theme);
    }
  });

  it('falls back to dark for unknown or malformed themes', () => {
    store['pixcut-preferences'] = JSON.stringify({ theme: 'neon' });
    expect(loadPreferences().theme).toBe('dark');
    store['pixcut-preferences'] = '{not json';
    expect(loadPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('resolves system to the operating system appearance', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('settings dialog', () => {
  const noop = () => {};
  const render = (settingsTab: 'general' | 'appearance' = 'general') => renderToStaticMarkup(createElement(SettingsModal, {
    settingsTab, shortcutDirty: false, setNotice: noop, setSettingsTab: noop, preferences: { ...DEFAULT_PREFERENCES, theme: 'system' }, updatePreferences: noop,
    storageUsage: null, refreshAssetUsage: async () => {}, storageBusy: false, cleanStorage: async () => {}, storageConfirm: false, storageNote: null,
    language: 'en', setLanguage: noop, resetPreferences: noop, showHints: true, setShowHints: noop, setSnapping: noop, resetLayout: noop,
    shortcuts: { version: 1, preset: 'pixcut', overrides: {} } as never, platform: 'macos', applyShortcuts: () => true, setShortcutDirty: noop, closeShortcutSettings: noop,
    appVersion: '0.0.0', updateState: 'idle', updateInfo: null, updateMessage: '', checkForUpdates: noop, downloadUpdate: noop, updateProgress: 0, restartUpdate: noop, copyDownloadLink: noop,
    exporter: false, diagnostics: () => '', copyDiagnostics: noop, recheckExporter: noop, storageLabel: '', refreshStorage: noop,
  }));

  it('translates the section navigation', () => {
    setLocale('de');
    const html = render();
    expect(html).toContain('Einstellungen');
    expect(html).toContain('Allgemein');
    expect(html).toContain('Darstellung');
    expect(html).not.toContain('>General<');
  });

  it('marks the chosen theme card as checked', () => {
    const html = render('appearance');
    expect(html).toMatch(/role="radio" aria-label="System" aria-checked="true"/);
    expect(html).toMatch(/role="radio" aria-label="Dark gray" aria-checked="false"/);
  });
});
