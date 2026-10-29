import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DICTIONARIES, beatMarkerCount, captionCount, clipCount, conflictCount, cueCount, cutCount, fileCount, fontCount, mediaFileCount, projectCount, sceneCount, setLocale, videoCount, type Locale } from '../src/i18n';

/** Every literal `t('…')` key in the source. Template strings and variables cannot be checked statically. */
function sourceKeys(): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) { if (name !== 'locales') walk(path); continue; }
      if (!/\.tsx?$/.test(name)) continue;
      const text = readFileSync(path, 'utf8');
      for (const match of text.matchAll(/\bt\('((?:[^'\\]|\\.)+)'/g)) found.set(match[1].replace(/\\'/g, "'"), path);
      // Labels that components translate themselves: tip('id', 'Label'), <IconButton|RangeField label="Label">
      for (const match of text.matchAll(/\btip\('[^']+',\s*'((?:[^'\\]|\\.)+)'/g)) found.set(match[1].replace(/\\'/g, "'"), path);
      for (const match of text.matchAll(/<(?:IconButton|RangeField)\b[^>]*?\blabel="([^"{}]+)"/g)) found.set(match[1], path);
    }
  };
  walk(join(__dirname, '..', 'src'));
  return found;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
const locales = Object.keys(DICTIONARIES) as (keyof typeof DICTIONARIES)[];

/** Keys still waiting for a translation. Keep it empty: add a key here only with a reason, and remove it when translated. */
const ALLOW_UNTRANSLATED = new Set<string>([]);

describe('translation coverage', () => {
  const keys = sourceKeys();

  it('finds the interface strings', () => {
    expect(keys.size).toBeGreaterThan(400);
  });

  it.each(locales)('%s translates every t() string in the source', locale => {
    const missing = [...keys.keys()].filter(key => !(key in DICTIONARIES[locale]) && !ALLOW_UNTRANSLATED.has(key));
    expect(missing, `untranslated in ${locale}:\n${missing.slice(0, 30).join('\n')}`).toEqual([]);
  });

  it('keeps {placeholders} identical in every translation', () => {
    const broken: string[] = [];
    for (const locale of locales) for (const [key, value] of Object.entries(DICTIONARIES[locale])) {
      if (JSON.stringify(placeholders(key)) !== JSON.stringify(placeholders(value))) broken.push(`${locale}: ${key}`);
    }
    expect(broken).toEqual([]);
  });

  it('has no allow-list entries that are already translated or no longer used', () => {
    for (const key of ALLOW_UNTRANSLATED) {
      expect(keys.has(key), `unused allow-list entry: ${key}`).toBe(true);
      expect(locales.some(locale => key in DICTIONARIES[locale]) && locales.every(locale => key in DICTIONARIES[locale]), `fully translated, remove from the allow-list: ${key}`).toBe(false);
    }
  });

  it('has no empty translations', () => {
    for (const locale of locales) for (const [key, value] of Object.entries(DICTIONARIES[locale])) expect(value.trim().length, `${locale}: ${key}`).toBeGreaterThan(0);
  });
});

function sourceFiles(): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) { if (name !== 'locales') walk(path); continue; }
      if (/\.tsx?$/.test(name)) out.push({ path, text: readFileSync(path, 'utf8') });
    }
  };
  walk(join(__dirname, '..', 'src'));
  return out;
}

describe('translatable source patterns', () => {
  it('has no hand-built English plurals', () => {
    const found = sourceFiles().flatMap(({ path, text }) => text.split('\n').flatMap((line, index) => /\? ''\s*:\s*'(?:s|es)'/.test(line) ? [`${path}:${index + 1}`] : []));
    expect(found, 'use the count helpers in i18n (clipCount, fileCount, …) instead of adding an "s"').toEqual([]);
  });

  it('keeps every t() key a literal so the coverage test can see it', () => {
    const found = sourceFiles().flatMap(({ path, text }) => text.split('\n').flatMap((line, index) => /(?<![\w.])t\([^()'"`]*\?\s*['"`]/.test(line) ? [`${path}:${index + 1}`] : []));
    expect(found, 'write cond ? t(\'a\') : t(\'b\') instead of t(cond ? \'a\' : \'b\')').toEqual([]);
  });
});

describe('counted nouns', () => {
  it.each(Object.keys(DICTIONARIES).concat('en'))('%s counts every noun and keeps the number', locale => {
    setLocale(locale as Locale);
    for (const count of [clipCount, captionCount, beatMarkerCount, cutCount, fontCount, conflictCount, cueCount, mediaFileCount, projectCount, sceneCount, fileCount, videoCount]) {
      for (const value of [0, 1, 2, 5, 22, 101]) expect(count(value), `${locale} ${count.name} ${value}`).toContain(String(value));
    }
    setLocale('en');
  });

  it('uses Polish few and many forms', () => {
    setLocale('pl');
    expect([clipCount(1), clipCount(3), clipCount(5), clipCount(22)]).toEqual(['1 klip', '3 klipy', '5 klipów', '22 klipy']);
    setLocale('en');
    expect([clipCount(1), clipCount(2)]).toEqual(['1 clip', '2 clips']);
  });
});
