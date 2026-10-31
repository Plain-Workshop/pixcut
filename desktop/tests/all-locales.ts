// Registers every language so tests can switch locale synchronously.
import { registerLocale } from '../src/i18n';
import { de } from '../src/i18n/locales/de';
import { es } from '../src/i18n/locales/es';
import { fr } from '../src/i18n/locales/fr';
import { it } from '../src/i18n/locales/it';
import { ja } from '../src/i18n/locales/ja';
import { ko } from '../src/i18n/locales/ko';
import { pl } from '../src/i18n/locales/pl';
import { pt } from '../src/i18n/locales/pt';
import { uk } from '../src/i18n/locales/uk';
import { zh } from '../src/i18n/locales/zh';

Object.entries({ de, es, fr, it, ja, ko, pl, pt, uk, zh }).forEach(([locale, dictionary]) => registerLocale(locale as Parameters<typeof registerLocale>[0], dictionary));
