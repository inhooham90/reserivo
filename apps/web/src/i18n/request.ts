import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * Loads the message table for the request's locale. An unknown or missing
 * locale falls back to English rather than failing: a bad URL should show the
 * page in the wrong language, not a 500.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: ((await import(`../../messages/${locale}.json`)) as { default: Record<string, unknown> }).default,
  };
});
