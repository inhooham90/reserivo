import { LOCALES, type Locale } from "@reserivo/shared";
import { defineRouting } from "next-intl/routing";

/**
 * The locale list lives in `packages/shared` because the API needs the same
 * one: a client's language is stored on their record and decides which
 * language their confirmation and reminders are written in. Adding a language
 * in two places would eventually mean sending someone a booking page they can
 * read and a reminder they cannot.
 */
export { LOCALES, type Locale };

/** What the switcher shows. Each language is named in itself, never translated. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  ko: "한국어",
  zh: "简体中文",
  es: "Español",
};

/**
 * `as-needed` keeps English on the bare path, so every salon booking link
 * already printed on a card or shared in a message keeps working. The other
 * languages are prefixed, which is what makes a Korean link shareable as
 * Korean and lets search engines index each language separately.
 *
 * The prefixes are reserved slugs (see RESERVED_SLUGS in packages/shared), so
 * `/ko` can never be ambiguous between a locale and a salon named "ko".
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: "en",
  localePrefix: "as-needed",
});
