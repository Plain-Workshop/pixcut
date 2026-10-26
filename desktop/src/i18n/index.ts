export type Locale = 'en' | 'pl' | 'uk';

export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'pl', label: 'Polski' },
  { id: 'uk', label: 'Українська' },
];

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'pl' || value === 'uk';
}

/**
 * The dictionary is keyed by the English source string. Untranslated strings
 * fall back to English instead of showing an empty label, so the interface is
 * always readable while a language is being filled in.
 */
const pl: Record<string, string> = {
  'Home': 'Start',
  'Projects': 'Projekty',
  'Templates': 'Szablony',
  'Settings': 'Ustawienia',
  'Your media stays with you.': 'Twoje media zostają z Tobą.',
  'No account. No cloud. Just your stories.': 'Bez konta. Bez chmury. Tylko Twoje historie.',
  'Keyboard shortcuts': 'Skróty klawiszowe',
  'Version & build details': 'Wersja i szczegóły kompilacji',
  'A LITTLE MOMENT. A GREAT STORY.': 'MAŁA CHWILA. WIELKA HISTORIA.',
  'YOUR LOCAL LIBRARY': 'TWOJA LOKALNA BIBLIOTEKA',
  'What would you like': 'Co chcesz',
  'to create?': 'stworzyć?',
  'Your stories,': 'Twoje historie,',
  'kept close.': 'zawsze blisko.',
  'Your photos, your pace, your point of view.': 'Twoje zdjęcia, Twoje tempo, Twój punkt widzenia.',
  'Bring them together in a place that’s entirely yours.': 'Połącz je w miejscu, które należy wyłącznie do Ciebie.',
  'Everything lives on this device. Open a recent story or start a new one whenever inspiration arrives.': 'Wszystko jest na tym urządzeniu. Otwórz ostatnią historię lub zacznij nową, gdy pojawi się inspiracja.',
  'Open project': 'Otwórz projekt',
  'New project': 'Nowy projekt',
  'New Video': 'Nowy film',
  'Start with an empty timeline.': 'Zacznij od pustej osi czasu.',
  'Photo Movie': 'Film ze zdjęć',
  'Turn photos into a story.': 'Zamień zdjęcia w historię.',
  'Start with a ready-made design.': 'Zacznij od gotowego projektu.',
  'Recent projects': 'Ostatnie projekty',
  'Your projects': 'Twoje projekty',
  'Pick up where you left off.': 'Wróć tam, gdzie skończyłeś.',
  'Stored locally, recovered automatically.': 'Przechowywane lokalnie, odzyskiwane automatycznie.',
  'Nothing yet': 'Jeszcze nic',
  'Video Editor': 'Edytor wideo',
  'Save': 'Zapisz',
  'Export': 'Eksportuj',
  'Media': 'Media',
  'Titles': 'Tytuły',
  'Elements': 'Elementy',
  'Audio': 'Dźwięk',
  'Your media': 'Twoje media',
  'Transitions': 'Przejścia',
  'Effects': 'Efekty',
  'New project defaults': 'Domyślne ustawienia nowego projektu',
  'Local media store': 'Lokalny magazyn mediów',
  'Language': 'Język',
  'Interface language': 'Język interfejsu',
  'Theme': 'Motyw',
  'App theme': 'Motyw aplikacji',
  'Editor comfort': 'Komfort edycji',
  'Editing behavior': 'Zachowanie edycji',
  'Autosave delay': 'Opóźnienie autozapisu',
  'Language selection is stored locally and applies to the main screens; some editor panels are still being translated.': 'Wybór języka jest zapisywany lokalnie i obejmuje główne ekrany; część paneli edytora jest wciąż tłumaczona.',
  'Back to home': 'Powrót do startu',
  'project': 'projekt',
  'projects': 'projektów',
};

const uk: Record<string, string> = {
  'Home': 'Головна',
  'Projects': 'Проєкти',
  'Templates': 'Шаблони',
  'Settings': 'Налаштування',
  'Your media stays with you.': 'Ваші медіа залишаються з вами.',
  'No account. No cloud. Just your stories.': 'Без акаунта. Без хмари. Лише ваші історії.',
  'Keyboard shortcuts': 'Клавіатурні скорочення',
  'Version & build details': 'Версія та відомості про збірку',
  'A LITTLE MOMENT. A GREAT STORY.': 'МАЛЕНЬКА МИТЬ. ВЕЛИКА ІСТОРІЯ.',
  'YOUR LOCAL LIBRARY': 'ВАША ЛОКАЛЬНА БІБЛІОТЕКА',
  'What would you like': 'Що ви хочете',
  'to create?': 'створити?',
  'Your stories,': 'Ваші історії,',
  'kept close.': 'завжди поруч.',
  'Your photos, your pace, your point of view.': 'Ваші світлини, ваш темп, ваш погляд.',
  'Bring them together in a place that’s entirely yours.': 'Зберіть їх у місці, яке належить лише вам.',
  'Everything lives on this device. Open a recent story or start a new one whenever inspiration arrives.': 'Усе зберігається на цьому пристрої. Відкрийте останню історію або почніть нову, коли з’явиться натхнення.',
  'Open project': 'Відкрити проєкт',
  'New project': 'Новий проєкт',
  'New Video': 'Нове відео',
  'Start with an empty timeline.': 'Почніть із порожньої шкали часу.',
  'Photo Movie': 'Фільм зі світлин',
  'Turn photos into a story.': 'Перетворіть світлини на історію.',
  'Start with a ready-made design.': 'Почніть із готового дизайну.',
  'Recent projects': 'Останні проєкти',
  'Your projects': 'Ваші проєкти',
  'Pick up where you left off.': 'Продовжте з того місця, де зупинилися.',
  'Stored locally, recovered automatically.': 'Зберігається локально, відновлюється автоматично.',
  'Nothing yet': 'Поки нічого',
  'Video Editor': 'Відеоредактор',
  'Save': 'Зберегти',
  'Export': 'Експортувати',
  'Media': 'Медіа',
  'Titles': 'Титри',
  'Elements': 'Елементи',
  'Audio': 'Аудіо',
  'Your media': 'Ваші медіа',
  'Transitions': 'Переходи',
  'Effects': 'Ефекти',
  'New project defaults': 'Типові налаштування нового проєкту',
  'Local media store': 'Локальне сховище медіа',
  'Language': 'Мова',
  'Interface language': 'Мова інтерфейсу',
  'Theme': 'Тема',
  'App theme': 'Тема застосунку',
  'Editor comfort': 'Зручність редактора',
  'Editing behavior': 'Поведінка редагування',
  'Autosave delay': 'Затримка автозбереження',
  'Language selection is stored locally and applies to the main screens; some editor panels are still being translated.': 'Вибір мови зберігається локально й застосовується до головних екранів; частина панелей редактора ще перекладається.',
  'Back to home': 'Повернутися на головну',
  'project': 'проєкт',
  'projects': 'проєктів',
};

export const DICTIONARIES: Record<Exclude<Locale, 'en'>, Record<string, string>> = { pl, uk };

let activeLocale: Locale = 'en';

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

/** Locale-aware project count, including Polish and Ukrainian plurals. */
export function projectCount(count: number): string {
  if (activeLocale === 'en') return `${count} project${count === 1 ? '' : 's'}`;
  const mod10 = count % 10;
  const mod100 = count % 100;
  const few = mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14);
  if (activeLocale === 'pl') return `${count} ${count === 1 ? 'projekt' : few ? 'projekty' : 'projektów'}`;
  return `${count} ${mod10 === 1 && mod100 !== 11 ? 'проєкт' : few ? 'проєкти' : 'проєктів'}`;
}
