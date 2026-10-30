
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
export type Dictionary = Record<string, string>;
type Translated = Exclude<Locale, 'en'>;

/**
 * Filled as languages load, so the first screen does not ship ten dictionaries
 * (about 900 KB of source) for a language nobody picked. Typed as complete for
 * callers that only read it after `loadLocale` has run.
 */
export const DICTIONARIES = {} as Record<Translated, Dictionary>;

const LOADERS: Record<Translated, () => Promise<Dictionary>> = {
  pl: () => import('./locales/pl').then(module => module.pl),
  uk: () => import('./locales/uk').then(module => module.uk),
  es: () => import('./locales/es').then(module => module.es),
  fr: () => import('./locales/fr').then(module => module.fr),
  de: () => import('./locales/de').then(module => module.de),
  pt: () => import('./locales/pt').then(module => module.pt),
  it: () => import('./locales/it').then(module => module.it),
  ja: () => import('./locales/ja').then(module => module.ja),
  ko: () => import('./locales/ko').then(module => module.ko),
  zh: () => import('./locales/zh').then(module => module.zh),
};

/** Makes a dictionary available to `t`. Used by `loadLocale` and by tests that load every language. */
export function registerLocale(locale: Translated, dictionary: Dictionary): void {
  DICTIONARIES[locale] = dictionary;
}

/** Loads a language's dictionary once. English needs none; a failed load leaves the interface in English. */
export async function loadLocale(locale: Locale): Promise<boolean> {
  if (locale === 'en' || DICTIONARIES[locale]) return true;
  try {
    registerLocale(locale, await LOADERS[locale]());
    return true;
  } catch {
    return false;
  }
}

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
type ExtraNoun = 'clip' | 'caption' | 'marker' | 'cut' | 'font' | 'conflict' | 'cue' | 'mediaFile';

/** Counted nouns added after the first table; same rules. Languages without grammatical number keep one form. */
const MORE_COUNT_FORMS: Record<Locale, Record<ExtraNoun, PluralForms>> = {
  en: {
    clip: { one: '{count} clip', other: '{count} clips' }, caption: { one: '{count} caption', other: '{count} captions' },
    marker: { one: '{count} beat marker', other: '{count} beat markers' }, cut: { one: '{count} cut', other: '{count} cuts' },
    font: { one: '{count} custom font', other: '{count} custom fonts' }, conflict: { one: '{count} shortcut conflict', other: '{count} shortcut conflicts' },
    cue: { one: '{count} long cue', other: '{count} long cues' }, mediaFile: { one: '{count} media file', other: '{count} media files' },
  },
  de: {
    clip: { one: '{count} Clip', other: '{count} Clips' }, caption: { one: '{count} Untertitel', other: '{count} Untertitel' },
    marker: { one: '{count} Beat-Markierung', other: '{count} Beat-Markierungen' }, cut: { one: '{count} Schnitt', other: '{count} Schnitte' },
    font: { one: '{count} eigene Schriftart', other: '{count} eigene Schriftarten' }, conflict: { one: '{count} Tastenkürzel-Konflikt', other: '{count} Tastenkürzel-Konflikte' },
    cue: { one: '{count} langer Untertitelblock', other: '{count} lange Untertitelblöcke' }, mediaFile: { one: '{count} Mediendatei', other: '{count} Mediendateien' },
  },
  es: {
    clip: { one: '{count} clip', other: '{count} clips' }, caption: { one: '{count} subtítulo', other: '{count} subtítulos' },
    marker: { one: '{count} marcador de ritmo', other: '{count} marcadores de ritmo' }, cut: { one: '{count} corte', other: '{count} cortes' },
    font: { one: '{count} fuente propia', other: '{count} fuentes propias' }, conflict: { one: '{count} conflicto de atajos', other: '{count} conflictos de atajos' },
    cue: { one: '{count} bloque largo', other: '{count} bloques largos' }, mediaFile: { one: '{count} archivo multimedia', other: '{count} archivos multimedia' },
  },
  fr: {
    clip: { one: '{count} clip', other: '{count} clips' }, caption: { one: '{count} sous-titre', other: '{count} sous-titres' },
    marker: { one: '{count} repère de rythme', other: '{count} repères de rythme' }, cut: { one: '{count} coupe', other: '{count} coupes' },
    font: { one: '{count} police personnalisée', other: '{count} polices personnalisées' }, conflict: { one: '{count} conflit de raccourcis', other: '{count} conflits de raccourcis' },
    cue: { one: '{count} long segment', other: '{count} longs segments' }, mediaFile: { one: '{count} fichier multimédia', other: '{count} fichiers multimédias' },
  },
  it: {
    clip: { one: '{count} clip', other: '{count} clip' }, caption: { one: '{count} sottotitolo', other: '{count} sottotitoli' },
    marker: { one: '{count} marcatore di ritmo', other: '{count} marcatori di ritmo' }, cut: { one: '{count} taglio', other: '{count} tagli' },
    font: { one: '{count} font personalizzato', other: '{count} font personalizzati' }, conflict: { one: '{count} conflitto di scorciatoie', other: '{count} conflitti di scorciatoie' },
    cue: { one: '{count} blocco lungo', other: '{count} blocchi lunghi' }, mediaFile: { one: '{count} file multimediale', other: '{count} file multimediali' },
  },
  pt: {
    clip: { one: '{count} clipe', other: '{count} clipes' }, caption: { one: '{count} legenda', other: '{count} legendas' },
    marker: { one: '{count} marcador de batida', other: '{count} marcadores de batida' }, cut: { one: '{count} corte', other: '{count} cortes' },
    font: { one: '{count} fonte própria', other: '{count} fontes próprias' }, conflict: { one: '{count} conflito de atalhos', other: '{count} conflitos de atalhos' },
    cue: { one: '{count} bloco longo', other: '{count} blocos longos' }, mediaFile: { one: '{count} arquivo de mídia', other: '{count} arquivos de mídia' },
  },
  pl: {
    clip: { one: '{count} klip', few: '{count} klipy', many: '{count} klipów', other: '{count} klipu' }, caption: { one: '{count} napis', few: '{count} napisy', many: '{count} napisów', other: '{count} napisu' },
    marker: { one: '{count} znacznik rytmu', few: '{count} znaczniki rytmu', many: '{count} znaczników rytmu', other: '{count} znacznika rytmu' }, cut: { one: '{count} cięcie', few: '{count} cięcia', many: '{count} cięć', other: '{count} cięcia' },
    font: { one: '{count} własna czcionka', few: '{count} własne czcionki', many: '{count} własnych czcionek', other: '{count} własnej czcionki' }, conflict: { one: '{count} konflikt skrótów', few: '{count} konflikty skrótów', many: '{count} konfliktów skrótów', other: '{count} konfliktu skrótów' },
    cue: { one: '{count} długi blok', few: '{count} długie bloki', many: '{count} długich bloków', other: '{count} długiego bloku' }, mediaFile: { one: '{count} plik multimedialny', few: '{count} pliki multimedialne', many: '{count} plików multimedialnych', other: '{count} pliku multimedialnego' },
  },
  uk: {
    clip: { one: '{count} кліп', few: '{count} кліпи', many: '{count} кліпів', other: '{count} кліпу' }, caption: { one: '{count} субтитр', few: '{count} субтитри', many: '{count} субтитрів', other: '{count} субтитру' },
    marker: { one: '{count} маркер ритму', few: '{count} маркери ритму', many: '{count} маркерів ритму', other: '{count} маркера ритму' }, cut: { one: '{count} склейка', few: '{count} склейки', many: '{count} склейок', other: '{count} склейки' },
    font: { one: '{count} власний шрифт', few: '{count} власні шрифти', many: '{count} власних шрифтів', other: '{count} власного шрифту' }, conflict: { one: '{count} конфлікт скорочень', few: '{count} конфлікти скорочень', many: '{count} конфліктів скорочень', other: '{count} конфлікту скорочень' },
    cue: { one: '{count} довгий блок', few: '{count} довгі блоки', many: '{count} довгих блоків', other: '{count} довгого блоку' }, mediaFile: { one: '{count} медіафайл', few: '{count} медіафайли', many: '{count} медіафайлів', other: '{count} медіафайла' },
  },
  ja: {
    clip: { other: '{count} 個のクリップ' }, caption: { other: '{count} 件の字幕' }, marker: { other: '{count} 個のビートマーカー' }, cut: { other: '{count} か所のカット' },
    font: { other: '{count} 個のカスタムフォント' }, conflict: { other: '{count} 件のショートカットの競合' }, cue: { other: '{count} 件の長い字幕ブロック' }, mediaFile: { other: '{count} 個のメディアファイル' },
  },
  ko: {
    clip: { other: '클립 {count}개' }, caption: { other: '자막 {count}개' }, marker: { other: '비트 마커 {count}개' }, cut: { other: '컷 {count}개' },
    font: { other: '사용자 글꼴 {count}개' }, conflict: { other: '단축키 충돌 {count}건' }, cue: { other: '긴 자막 블록 {count}개' }, mediaFile: { other: '미디어 파일 {count}개' },
  },
  zh: {
    clip: { other: '{count} 个片段' }, caption: { other: '{count} 条字幕' }, marker: { other: '{count} 个节拍标记' }, cut: { other: '{count} 处剪辑点' },
    font: { other: '{count} 种自定义字体' }, conflict: { other: '{count} 个快捷键冲突' }, cue: { other: '{count} 段较长字幕' }, mediaFile: { other: '{count} 个媒体文件' },
  },
};

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

function count(noun: CountNoun | ExtraNoun, value: number): string {
  let rules = pluralRules.get(activeLocale);
  if (!rules) {
    rules = new Intl.PluralRules(activeLocale);
    pluralRules.set(activeLocale, rules);
  }
  const forms = (COUNT_FORMS[activeLocale] as Record<string, PluralForms>)[noun] ?? (MORE_COUNT_FORMS[activeLocale] as Record<string, PluralForms>)[noun];
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

/** Locale-aware counts for notices that used to glue an English "s" onto the noun. */
export const clipCount = (value: number) => count('clip', value);
export const captionCount = (value: number) => count('caption', value);
export const beatMarkerCount = (value: number) => count('marker', value);
export const cutCount = (value: number) => count('cut', value);
export const fontCount = (value: number) => count('font', value);
export const conflictCount = (value: number) => count('conflict', value);
export const cueCount = (value: number) => count('cue', value);
export const mediaFileCount = (value: number) => count('mediaFile', value);
