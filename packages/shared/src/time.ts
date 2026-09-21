import { fromZonedTime, toZonedTime } from 'date-fns-tz';

/**
 * Wall-clock ⇄ instant conversion for one IANA zone. Everything the booking
 * engine does with "9:00 on Tuesday" goes through these two functions so DST
 * is handled in exactly one place.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date (YYYY-MM-DD) + minutes from midnight → UTC instant. */
export function localToUtc(date: string, minutes: number, timeZone: string): Date {
  // 1440 = midnight at the end of the day; express it as 00:00 of the next day.
  const dayShift = Math.floor(minutes / 1440);
  const m = minutes - dayShift * 1440;
  const d = dayShift ? addDays(date, dayShift) : date;
  return fromZonedTime(`${d}T${pad(Math.floor(m / 60))}:${pad(m % 60)}:00`, timeZone);
}

export interface LocalTime {
  date: string;
  minutes: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

/** UTC instant → local calendar date, minutes from midnight, and weekday in the zone. */
export function utcToLocal(instant: Date, timeZone: string): LocalTime {
  const z = toZonedTime(instant, timeZone);
  return {
    date: `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}`,
    minutes: z.getHours() * 60 + z.getMinutes(),
    weekday: z.getDay(),
  };
}

/** Pure calendar arithmetic on YYYY-MM-DD strings; no zone involved. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function todayIn(timeZone: string, now: Date = new Date()): string {
  return utcToLocal(now, timeZone).date;
}

/** Days from `from` to `to` (both YYYY-MM-DD); negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}
