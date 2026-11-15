/**
 * Translation of the site. Texts are written in English in the pages and looked up in
 * `src/locales/<language>.json`; a text with no translation is shown in English.
 * `test/i18n.test.ts` keeps the catalogs complete.
 *
 * The language of a visit is, in order: `?lang=` in the address, the `lang` cookie left by an
 * earlier choice, the browser's Accept-Language header, then English.
 */
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import hi from '../locales/hi.json';
import zh from '../locales/zh.json';

export const LOCALES = ['en', 'fr', 'es', 'zh', 'hi'] as const;
export type Locale = (typeof LOCALES)[number];

/** Each language named in itself, for the language menu. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  zh: '中文',
  hi: 'हिन्दी',
};

/** Value of the HTML `lang` attribute. */
export const HTML_LANG: Record<Locale, string> = { en: 'en', fr: 'fr', es: 'es', zh: 'zh-Hans', hi: 'hi' };

const CATALOGS: Record<Exclude<Locale, 'en'>, Record<string, string>> = { fr, es, zh, hi };

export function parseLocale(value: string | null | undefined): Locale | undefined {
  if (!value) return undefined;
  const language = value.trim().toLowerCase().split(/[_-]/)[0] ?? '';
  return (LOCALES as readonly string[]).includes(language) ? (language as Locale) : undefined;
}

/** First supported language of an Accept-Language header, by decreasing preference. */
export function negotiateLocale(header: string | null | undefined): Locale | undefined {
  if (!header) return undefined;
  const ranked = header
    .slice(0, 500)
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => /^\s*q=([0-9.]+)\s*$/.exec(p)?.[1]).find(Boolean);
      const weight = q === undefined ? 1 : Number(q);
      return { tag: tag ?? '', weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((x) => x.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (const { tag } of ranked) {
    const locale = parseLocale(tag);
    if (locale) return locale;
  }
  return undefined;
}

export function pickLocale(sources: {
  query?: string | null;
  cookie?: string | null;
  header?: string | null;
}): Locale {
  return parseLocale(sources.query) ?? parseLocale(sources.cookie) ?? negotiateLocale(sources.header) ?? 'en';
}

function format(message: string, args: readonly unknown[]): string {
  return message.replace(/\{(\d+)\}/g, (placeholder, index: string) => {
    const i = Number(index);
    return i < args.length ? String(args[i]) : placeholder;
  });
}

export interface I18n {
  locale: Locale;
  /** Translate `message`, replacing `{0}`, `{1}`… with `args`. */
  t(message: string, args?: readonly unknown[]): string;
  /**
   * Translate a text that depends on a count. `forms` is "singular|plural"; `{0}` is the count,
   * further values start at `{1}`. A language with a single form gives just one.
   */
  plural(count: number, forms: string, args?: readonly unknown[]): string;
}

export function createI18n(locale: Locale): I18n {
  const catalog = locale === 'en' ? undefined : CATALOGS[locale];
  const rules = new Intl.PluralRules(HTML_LANG[locale]);
  const numbers = new Intl.NumberFormat(HTML_LANG[locale]);
  return {
    locale,
    t: (message, args = []) => format(catalog?.[message] ?? message, args),
    plural: (count, forms, args = []) => {
      const variants = (catalog?.[forms] ?? forms).split('|');
      const variant = rules.select(count) === 'one' ? variants[0] : variants[variants.length - 1];
      return format(variant ?? '', [numbers.format(count), ...args]);
    },
  };
}
