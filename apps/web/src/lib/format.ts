import type { Locale } from "@/i18n/routing";

/**
 * Locale-aware formatting. Every function takes the locale explicitly so it
 * stays pure and testable; components get them pre-bound from `useFormat()`.
 *
 * Two rules this file exists to enforce:
 *
 * 1. **Never build a date or time by concatenating strings.** Word order,
 *    separators and whether there is an AM/PM at all differ by language.
 *    Everything here goes through `Intl`, which knows.
 * 2. **Never parse a formatted string back apart.** The old version formatted
 *    a date then split it on a comma to get the weekday; Korean and Chinese
 *    short dates have no comma there, so it silently produced nonsense. Where
 *    a caller needs the pieces separately, it gets a parts object instead.
 */

/** USD for now; currency becomes a salon setting when we leave the US. */
const CURRENCY = "USD";

export function formatCents(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: CURRENCY }).format(cents / 100);
}

/**
 * 90 → "1 hr 30 min" / "1시간 30분" / "1小时30分钟" / "1 h 30 min".
 *
 * Built from `Intl` unit formatting rather than a translated "h"/"m" pair so
 * the number and its unit stay correctly joined in each language.
 */
export function formatDuration(min: number, locale: Locale): string {
  const hours = Math.floor(min / 60);
  const minutes = min % 60;
  const unit = (value: number, u: "hour" | "minute") =>
    new Intl.NumberFormat(locale, { style: "unit", unit: u, unitDisplay: "short" }).format(value);

  if (hours && minutes) return `${unit(hours, "hour")} ${unit(minutes, "minute")}`;
  if (hours) return unit(hours, "hour");
  return unit(minutes, "minute");
}

/**
 * Weekday names for the locale, indexed 0 = Sunday to match `Date.getDay()`
 * and the `weekday` column in the database.
 *
 * Derived from a week that is known to start on a Sunday rather than a hand
 * written list, so adding a language needs no new array.
 */
export function weekdayNames(locale: Locale, width: "long" | "short" = "long"): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" });
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => format.format(new Date(Date.UTC(2023, 0, 1 + i))));
}

/** The presets every screen formats through. Named so no caller invents a pattern. */
const DATE_STYLES = {
  /** "Mon, Jan 5, 9:00 AM" */
  dateTimeShort: { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  /** "Monday, January 5 at 9:00 AM" */
  dateTimeLong: { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" },
  /** "Mon, Jan 5, 2026, 9:00 AM" */
  dateTimeWithYear: {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
  /** "9:00 AM" */
  time: { hour: "numeric", minute: "2-digit" },
  /** "Jan 5, 2026" — a date with no clock, for things like a signup date. */
  dateWithYear: { year: "numeric", month: "short", day: "numeric" },
  /** "Jan 2026" */
  monthYear: { year: "numeric", month: "short" },
  /** "Mon, Jan 5" */
  dayMonth: { weekday: "short", month: "short", day: "numeric" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateStyle = keyof typeof DATE_STYLES;

/**
 * Renders a UTC instant as wall-clock time in the salon's zone.
 *
 * Replaces the old date-fns pattern strings: a pattern like `h:mm a` bakes in
 * a 12-hour clock with an AM/PM marker, which is simply wrong in locales that
 * write time differently. `Intl` picks the right shape per language.
 */
export function formatInTz(iso: string | Date, timeZone: string, locale: Locale, style: DateStyle = "dateTimeShort"): string {
  const at = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale, { ...DATE_STYLES[style], timeZone }).format(at);
}

/** Formats a plain YYYY-MM-DD without shifting it through the browser's zone. */
export function formatLocalDate(ymd: string, locale: Locale, style: DateStyle = "dayMonth"): string {
  return new Intl.DateTimeFormat(locale, { ...DATE_STYLES[style], timeZone: "UTC" }).format(utcNoon(ymd));
}

/**
 * The weekday and the rest of a plain date, separately.
 *
 * The booking page stacks the weekday above the date in each day tab. It used
 * to get them by splitting the formatted string on its comma, which only ever
 * worked in English. `formatToParts` is the supported way to take a date
 * apart, and it keeps working when a language orders the pieces differently.
 */
export function formatLocalDateParts(ymd: string, locale: Locale): { weekday: string; rest: string } {
  const parts = new Intl.DateTimeFormat(locale, { ...DATE_STYLES.dayMonth, timeZone: "UTC" }).formatToParts(
    utcNoon(ymd),
  );
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const rest = parts
    .filter((p) => p.type !== "weekday")
    // Drop the separator left stranded where the weekday was removed.
    .map((p) => p.value)
    .join("")
    .replace(/^[\s,、·]+|[\s,、·]+$/g, "");
  return { weekday, rest };
}

/** Midday UTC, so no time zone can nudge a plain date onto the day before. */
function utcNoon(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/**
 * 540 → "9:00 AM" / "오전 9:00" / "上午9:00" / "9:00", for local
 * minutes-from-midnight values that never left the salon's zone.
 */
export function minutesLabel(minutes: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { ...DATE_STYLES.time, timeZone: "UTC" }).format(minutesAsUtc(minutes));
}

/**
 * The same, but on the hour and without the minutes — the calendar's hour
 * gutter. Callers used to get this by string-replacing ":00" out of a time,
 * which assumes a format only some languages use.
 */
export function hourLabel(minutes: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", timeZone: "UTC" }).format(minutesAsUtc(minutes));
}

function minutesAsUtc(minutes: number): Date {
  return new Date(Date.UTC(2023, 0, 1, Math.floor(minutes / 60) % 24, minutes % 60));
}

/**
 * "Mon–Fri 9:00 AM–6:00 PM · Sat 10:00 AM–4:00 PM". Consecutive days with the
 * same windows collapse into a range; days with no rules are omitted.
 *
 * The week is ordered Monday-first because that is how opening hours are read
 * in all four markets. Day names and times come from the locale.
 */
export function summarizeHours(
  rules: { weekday: number; startMinutes: number; endMinutes: number }[],
  locale: Locale,
): string {
  const short = weekdayNames(locale, "short");
  const byDay = new Map<number, string>();

  for (let wd = 0; wd < 7; wd++) {
    const windows = rules
      .filter((r) => r.weekday === wd)
      .sort((a, b) => a.startMinutes - b.startMinutes)
      .map((r) => `${minutesLabel(r.startMinutes, locale)}–${minutesLabel(r.endMinutes, locale)}`)
      .join(", ");
    if (windows) byDay.set(wd, windows);
  }

  const order = [1, 2, 3, 4, 5, 6, 0]; // Mon…Sun
  const parts: string[] = [];
  let i = 0;
  while (i < order.length) {
    const windows = byDay.get(order[i]);
    if (!windows) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < order.length && byDay.get(order[j + 1]) === windows) j++;
    const label = j > i ? `${short[order[i]]}–${short[order[j]]}` : short[order[i]];
    parts.push(`${label} ${windows}`);
    i = j + 1;
  }
  return parts.join(" · ");
}

/**
 * The display name of a time zone, e.g. "Los Angeles Time".
 *
 * The booking page used to show the raw IANA id with its underscore swapped
 * for a space, which reads as "America/Los Angeles" and is English-only.
 */
export function timezoneLabel(timeZone: string, locale: Locale): string {
  const parts = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "long" }).formatToParts(new Date());
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone.replaceAll("_", " ");
}
