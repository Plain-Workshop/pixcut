import { beforeEach, describe, expect, it, vi } from 'vitest';

// Each test gets a fresh i18n module, so nothing is loaded yet.
async function fresh() {
  vi.resetModules();
  return await import('../src/i18n');
}

describe('lazy locales', () => {
  beforeEach(() => vi.resetModules());

  it('starts with no dictionaries and falls back to English text', async () => {
    const i18n = await fresh();
    expect(Object.keys(i18n.DICTIONARIES)).toEqual([]);
    i18n.setLocale('de');
    expect(i18n.t('Settings')).toBe('Settings');
  });

  it('translates once a language is loaded, and only that language', async () => {
    const i18n = await fresh();
    await expect(i18n.loadLocale('de')).resolves.toBe(true);
    expect(Object.keys(i18n.DICTIONARIES)).toEqual(['de']);
    i18n.setLocale('de');
    expect(i18n.t('Settings')).toBe('Einstellungen');
    i18n.setLocale('fr');
    expect(i18n.t('Settings')).toBe('Settings');
  });

  it('needs nothing for English, and loads a language only once', async () => {
    const i18n = await fresh();
    await expect(i18n.loadLocale('en')).resolves.toBe(true);
    expect(Object.keys(i18n.DICTIONARIES)).toEqual([]);
    await i18n.loadLocale('ja');
    const first = i18n.DICTIONARIES.ja;
    await i18n.loadLocale('ja');
    expect(i18n.DICTIONARIES.ja).toBe(first);
  });

  it('lets a test register a dictionary directly', async () => {
    const i18n = await fresh();
    i18n.registerLocale('pl', { Settings: 'Ustawienia' });
    i18n.setLocale('pl');
    expect(i18n.t('Settings')).toBe('Ustawienia');
  });
});
