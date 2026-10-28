import { de } from './locales/de';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { it } from './locales/it';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { pl } from './locales/pl';
import { pt } from './locales/pt';
import { uk } from './locales/uk';
import { zh } from './locales/zh';

export type Locale = 'en' | 'pl' | 'uk' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ja' | 'ko' | 'zh';

/**
 * Ordered by how widely each language is spoken worldwide (total speakers,
 * native and second-language), leaving out Russian. The settings picker and
 * the native menu use this order.
 */
export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'zh', label: '简体中文' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'pt', label: 'Português (Brasil)' },
  { id: 'de', label: 'Deutsch' },
  { id: 'ja', label: '日本語' },
  { id: 'ko', label: '한국어' },
  { id: 'it', label: 'Italiano' },
  { id: 'pl', label: 'Polski' },
  { id: 'uk', label: 'Українська' },
];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALES.some(locale => locale.id === value);
}

/**
 * Dictionaries are keyed by the English source string. Untranslated strings
 * fall back to English instead of showing an empty label, so the interface is
 * always readable while a language is being filled in.
 */
export const DICTIONARIES: Record<Exclude<Locale, 'en'>, Record<string, string>> = { pl, uk, es, fr, de, pt, it, ja, ko, zh };

/** Plural categories used by `Intl.PluralRules`. */
type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
type PluralForms = Partial<Record<PluralCategory, string>>;
type CountNoun = 'project' | 'scene' | 'format' | 'file' | 'render' | 'video';

/**
 * Counted nouns per language, using `{count}` placeholders. Categories follow
 * CLDR, so Polish and Ukrainian get their few/many forms while Japanese,
 * Korean and Chinese need only one. A locale that omits a category falls back
 * to `other`.
 */
const COUNT_FORMS: Record<Locale, Record<CountNoun, PluralForms>> = {
  en: {
    project: { one: '{count} project', other: '{count} projects' },
    scene: { one: '{count} scene', other: '{count} scenes' },
    format: { one: '{count} format', other: '{count} formats' },
    file: { one: '{count} file', other: '{count} files' },
    render: { one: '{count} render', other: '{count} renders' },
    video: { one: '{count} video', other: '{count} videos' },
  },
  pl: {
    project: { one: '{count} projekt', few: '{count} projekty', many: '{count} projektów', other: '{count} projektu' },
    scene: { one: '{count} scena', few: '{count} sceny', many: '{count} scen', other: '{count} sceny' },
    format: { one: '{count} format', few: '{count} formaty', many: '{count} formatów', other: '{count} formatu' },
    file: { one: '{count} plik', few: '{count} pliki', many: '{count} plików', other: '{count} pliku' },
    render: { one: '{count} render', few: '{count} rendery', many: '{count} renderów', other: '{count} renderu' },
    video: { one: '{count} film', few: '{count} filmy', many: '{count} filmów', other: '{count} filmu' },
  },
  uk: {
    project: { one: '{count} проєкт', few: '{count} проєкти', many: '{count} проєктів', other: '{count} проєкту' },
    scene: { one: '{count} сцена', few: '{count} сцени', many: '{count} сцен', other: '{count} сцени' },
    format: { one: '{count} формат', few: '{count} формати', many: '{count} форматів', other: '{count} формату' },
    file: { one: '{count} файл', few: '{count} файли', many: '{count} файлів', other: '{count} файлу' },
    render: { one: '{count} рендер', few: '{count} рендери', many: '{count} рендерів', other: '{count} рендеру' },
    video: { one: '{count} відео', few: '{count} відео', many: '{count} відео', other: '{count} відео' },
  },
  es: {
    project: { one: '{count} proyecto', other: '{count} proyectos' },
    scene: { one: '{count} escena', other: '{count} escenas' },
    format: { one: '{count} formato', other: '{count} formatos' },
    file: { one: '{count} archivo', other: '{count} archivos' },
    render: { one: '{count} render', other: '{count} renders' },
    video: { one: '{count} vídeo', other: '{count} vídeos' },
  },
  fr: {
    project: { one: '{count} projet', other: '{count} projets' },
    scene: { one: '{count} scène', other: '{count} scènes' },
    format: { one: '{count} format', other: '{count} formats' },
    file: { one: '{count} fichier', other: '{count} fichiers' },
    render: { one: '{count} rendu', other: '{count} rendus' },
    video: { one: '{count} vidéo', other: '{count} vidéos' },
  },
  de: {
    project: { one: '{count} Projekt', other: '{count} Projekte' },
    scene: { one: '{count} Szene', other: '{count} Szenen' },
    format: { one: '{count} Format', other: '{count} Formate' },
    file: { one: '{count} Datei', other: '{count} Dateien' },
    render: { one: '{count} Render', other: '{count} Render' },
    video: { one: '{count} Video', other: '{count} Videos' },
  },
  pt: {
    project: { one: '{count} projeto', other: '{count} projetos' },
    scene: { one: '{count} cena', other: '{count} cenas' },
    format: { one: '{count} formato', other: '{count} formatos' },
    file: { one: '{count} arquivo', other: '{count} arquivos' },
    render: { one: '{count} render', other: '{count} renders' },
    video: { one: '{count} vídeo', other: '{count} vídeos' },
  },
  it: {
    project: { one: '{count} progetto', other: '{count} progetti' },
    scene: { one: '{count} scena', other: '{count} scene' },
    format: { one: '{count} formato', other: '{count} formati' },
    file: { one: '{count} file', other: '{count} file' },
    render: { one: '{count} render', other: '{count} render' },
    video: { one: '{count} video', other: '{count} video' },
  },
  ja: {
    project: { other: '{count}件のプロジェクト' },
    scene: { other: '{count}シーン' },
    format: { other: '{count}フォーマット' },
    file: { other: '{count}ファイル' },
    render: { other: '{count}本の出力' },
    video: { other: '{count}本の動画' },
  },
  ko: {
    project: { other: '프로젝트 {count}개' },
    scene: { other: '장면 {count}개' },
    format: { other: '포맷 {count}개' },
    file: { other: '파일 {count}개' },
    render: { other: '출력 {count}개' },
    video: { other: '동영상 {count}개' },
  },
  zh: {
    project: { other: '{count} 个项目' },
    scene: { other: '{count} 个场景' },
    format: { other: '{count} 种格式' },
    file: { other: '{count} 个文件' },
    render: { other: '{count} 次渲染' },
    video: { other: '{count} 个视频' },
  },
};

let activeLocale: Locale = 'en';
const pluralRules = new Map<Locale, Intl.PluralRules>();

export function setLocale(next: Locale): void {
  activeLocale = next;
}

export function getLocale(): Locale {
  return activeLocale;
}

/** Translate an English source string, with optional `{name}` placeholders. */
export function t(text: string, vars?: Record<string, string | number>): string {
  const template = activeLocale === 'en' ? text : DICTIONARIES[activeLocale]?.[text] ?? text;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

function count(noun: CountNoun, value: number): string {
  let rules = pluralRules.get(activeLocale);
  if (!rules) {
    rules = new Intl.PluralRules(activeLocale);
    pluralRules.set(activeLocale, rules);
  }
  const forms = COUNT_FORMS[activeLocale][noun];
  const template = forms[rules.select(value)] ?? forms.other ?? '{count}';
  return template.replace('{count}', String(value));
}

/** Locale-aware project count for project cards. */
export function projectCount(value: number): string {
  return count('project', value);
}

/** Locale-aware scene count for project cards. */
export function sceneCount(value: number): string {
  return count('scene', value);
}

/** Locale-aware format count for project cards. */
export function formatCount(value: number): string {
  return count('format', value);
}

/** Locale-aware file count for the number of videos an export will write. */
export function fileCount(value: number): string {
  return count('file', value);
}

/** Locale-aware render count for combined deliverables. */
export function renderCount(value: number): string {
  return count('render', value);
}

/** Locale-aware video count for the export button and notes. */
export function videoCount(value: number): string {
  return count('video', value);
}
