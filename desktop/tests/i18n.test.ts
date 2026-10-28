import { afterEach, describe, expect, it } from 'vitest';
import { DICTIONARIES, fileCount, formatCount, isLocale, LOCALES, projectCount, sceneCount, setLocale, t } from '../src/i18n';
import { TEMPLATES } from '../src/templates/catalog';

afterEach(() => setLocale('en'));

const TRANSLATED = Object.keys(DICTIONARIES) as (keyof typeof DICTIONARIES)[];

describe('interface language', () => {
  it('accepts the shipped locales only', () => {
    for (const { id } of LOCALES) expect(isLocale(id)).toBe(true);
    expect(isLocale('ru')).toBe(false);
    expect(isLocale('sv')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });

  it('labels every shipped locale', () => {
    expect(LOCALES.every(locale => locale.label.trim().length > 0)).toBe(true);
    expect(LOCALES.map(locale => locale.id)).toEqual(['en', 'zh', 'es', 'fr', 'pt', 'de', 'ja', 'ko', 'it', 'pl', 'uk']);
  });

  it('falls back to English for untranslated strings', () => {
    setLocale('pl');
    expect(t('Home')).toBe('Start');
    expect(t('This string is not translated')).toBe('This string is not translated');
    setLocale('en');
    expect(t('Home')).toBe('Home');
  });

  it('translates into each locale and keeps placeholders', () => {
    expect(t('Projects')).toBe('Projects');
    setLocale('uk');
    expect(t('Projects')).toBe('Проєкти');
    expect(t('Exported {count} files', { count: 3 })).toBe('Exported 3 files');
    const expected: Record<string, string> = {
      es: 'Proyectos',
      fr: 'Projets',
      de: 'Projekte',
      pt: 'Projetos',
      it: 'Progetti',
      ja: 'プロジェクト',
      ko: '프로젝트',
      zh: '项目',
    };
    for (const [locale, label] of Object.entries(expected)) {
      setLocale(locale as keyof typeof DICTIONARIES);
      expect(t('Projects'), locale).toBe(label);
      expect(t('Search {count} elements…', { count: 5 }), locale).toContain('5');
    }
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
    setLocale('es');
    expect(projectCount(1)).toBe('1 proyecto');
    expect(projectCount(3)).toBe('3 proyectos');
    setLocale('fr');
    expect(projectCount(1)).toBe('1 projet');
    expect(projectCount(3)).toBe('3 projets');
    setLocale('de');
    expect(projectCount(1)).toBe('1 Projekt');
    expect(projectCount(3)).toBe('3 Projekte');
    setLocale('pt');
    expect(projectCount(1)).toBe('1 projeto');
    expect(projectCount(3)).toBe('3 projetos');
    setLocale('it');
    expect(projectCount(1)).toBe('1 progetto');
    expect(projectCount(3)).toBe('3 progetti');
    setLocale('ja');
    expect(projectCount(1)).toBe('1件のプロジェクト');
    setLocale('ko');
    expect(projectCount(1)).toBe('프로젝트 1개');
    setLocale('zh');
    expect(projectCount(1)).toBe('1 个项目');
    expect(projectCount(3)).toBe('3 个项目');
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
    setLocale('de');
    expect(sceneCount(2)).toBe('2 Szenen');
    expect(formatCount(3)).toBe('3 Formate');
    setLocale('zh');
    expect(sceneCount(3)).toBe('3 个场景');
    expect(formatCount(3)).toBe('3 种格式');
  });

  it('translates every template name, description and category', () => {
    for (const locale of TRANSLATED) {
      for (const template of TEMPLATES) {
        for (const text of [template.name, template.description, template.category]) {
          const translated = DICTIONARIES[locale][text];
          expect(translated, `${locale}: ${text}`).toBeTruthy();
          expect(translated.trim().length).toBeGreaterThan(0);
        }
      }
    }
    // Gallery chrome that the picker renders around the cards.
    for (const text of ['Start from a story.', 'Use template', 'Media credits', 'Search templates…', 'Nature', 'Food']) {
      for (const locale of TRANSLATED) expect(DICTIONARIES[locale][text], `${locale}: ${text}`).toBeTruthy();
    }
  });

  it('keeps every translation in sync with the English source', () => {
    const english = Object.keys(DICTIONARIES.pl).sort();
    for (const locale of TRANSLATED) {
      expect(Object.keys(DICTIONARIES[locale]).sort(), locale).toEqual(english);
      for (const key of english) {
        expect(DICTIONARIES[locale][key].trim().length, `${locale}: ${key}`).toBeGreaterThan(0);
      }
    }
  });
});
