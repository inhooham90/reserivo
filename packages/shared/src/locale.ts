import { z } from 'zod';

/**
 * The languages the product ships in. Lives here rather than in the web app
 * because the API needs the same list: a client's language is stored on their
 * record and decides which language their confirmation and reminders are
 * written in.
 *
 * `zh` is Simplified Chinese. Traditional would be a separate locale
 * (`zh-TW`), never a variant of this one — the two are not interchangeable in
 * writing.
 */
export const LOCALES = ['en', 'ko', 'zh', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const localeSchema = z.enum(LOCALES);

/** Narrows an unknown value, falling back to English rather than throwing. */
export function toLocale(value: unknown): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

/**
 * Picks the best supported language from an `Accept-Language` header.
 *
 * Deliberately simple: match on the primary subtag only, in the order the
 * browser ranked them, ignoring q-weights. Getting this exactly right is not
 * worth the code — the header is a hint, and every surface that uses it also
 * lets the person choose explicitly.
 */
export function localeFromAcceptLanguage(header: string | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  for (const part of header.split(',')) {
    const tag = part.split(';')[0]?.trim().toLowerCase();
    if (!tag) continue;
    const primary = tag.split('-')[0];
    const match = LOCALES.find((l) => l === primary);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}
