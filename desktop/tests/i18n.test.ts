import { afterEach, describe, expect, it } from 'vitest';
import { DICTIONARIES, fileCount, formatCount, isLocale, projectCount, sceneCount, setLocale, t } from '../src/i18n';

afterEach(() => setLocale('en'));

describe('interface language', () => {
  it('accepts the three shipped locales only', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('pl')).toBe(true);
    expect(isLocale('uk')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('falls back to English for untranslated strings', () => {
    setLocale('pl');
    expect(t('Home')).toBe('Start');
    expect(t('This string is not translated')).toBe('This string is not translated');
    setLocale('en');
    expect(t('Home')).toBe('Home');
  });

  it('translates into Ukrainian and keeps placeholders', () => {
    setLocale('uk');
    expect(t('Projects')).toBe('Проєкти');
    expect(t('Exported {count} files', { count: 3 })).toBe('Exported 3 files');
  });

  it('uses the right plural for project counts', () => {
    expect(projectCount(1)).toBe('1 project');
    expect(projectCount(4)).toBe('4 projects');
    setLocale('pl');
    expect(projectCount(1)).toBe('1 projekt');
    expect(projectCount(3)).toBe('3 projekty');
    expect(projectCount(12)).toBe('12 projektów');
    setLocale('uk');
    expect(projectCount(2)).toBe('2 проєкти');
    expect(projectCount(21)).toBe('21 проєкт');
  });

  it('uses locale-aware scene and format counts', () => {
    expect(sceneCount(1)).toBe('1 scene');
    expect(sceneCount(3)).toBe('3 scenes');
    setLocale('pl');
    expect(sceneCount(1)).toBe('1 scena');
    expect(sceneCount(3)).toBe('3 sceny');
    expect(sceneCount(5)).toBe('5 scen');
    expect(formatCount(2)).toBe('2 formaty');
    expect(formatCount(12)).toBe('12 formatów');
    expect(fileCount(5)).toBe('5 plików');
    setLocale('uk');
    expect(sceneCount(2)).toBe('2 сцени');
    expect(formatCount(2)).toBe('2 формати');
    expect(fileCount(1)).toBe('1 файл');
    expect(fileCount(3)).toBe('3 файли');
    expect(fileCount(11)).toBe('11 файлів');
  });

  it('keeps the two translations in sync', () => {
    const polish = Object.keys(DICTIONARIES.pl).sort();
    const ukrainian = Object.keys(DICTIONARIES.uk).sort();
    expect(ukrainian).toEqual(polish);
    for (const key of polish) {
      expect(DICTIONARIES.pl[key].trim().length).toBeGreaterThan(0);
      expect(DICTIONARIES.uk[key].trim().length).toBeGreaterThan(0);
    }
  });
});
