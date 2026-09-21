import { formatInTimeZone } from "date-fns-tz";

/** USD for now; currency becomes a salon setting when we leave the US. */
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m} min`;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Formats a YYYY-MM-DD local date without shifting it through the browser's zone. */
export function formatLocalDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function roleLabel(role: "MANAGER" | "DESIGNER"): string {
  return role === "MANAGER" ? "Manager" : "Designer";
}

/** "Owner" reads better than "Manager · Designer" for the both-roles case. */
export function rolesLabel(roles: readonly ("MANAGER" | "DESIGNER")[]): string {
  if (roles.includes("MANAGER") && roles.includes("DESIGNER")) return "Owner-stylist";
  return roles.map(roleLabel).join(" · ");
}

/** Renders a UTC instant as wall-clock time in the salon's zone. */
export function formatInTz(iso: string | Date, timeZone: string, pattern = "EEE, MMM d · h:mm a"): string {
  return formatInTimeZone(typeof iso === "string" ? new Date(iso) : iso, timeZone, pattern);
}

/** 540 → "9:00 AM". For local minutes-from-midnight values that never left the salon's zone. */
export function minutesLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/**
 * "Mon–Fri 9:00 AM–6:00 PM · Sat 10:00 AM–4:00 PM". Consecutive days with the
 * same windows collapse into a range; days with no rules are omitted.
 */
export function summarizeHours(rules: { weekday: number; startMinutes: number; endMinutes: number }[]): string {
  const byDay = new Map<number, string>();
  for (let wd = 0; wd < 7; wd++) {
    const wins = rules
      .filter((r) => r.weekday === wd)
      .sort((a, b) => a.startMinutes - b.startMinutes)
      .map((r) => `${minutesLabel(r.startMinutes)}–${minutesLabel(r.endMinutes)}`)
      .join(", ");
    if (wins) byDay.set(wd, wins);
  }
  const order = [1, 2, 3, 4, 5, 6, 0]; // Mon…Sun
  const parts: string[] = [];
  let i = 0;
  while (i < order.length) {
    const wins = byDay.get(order[i]);
    if (!wins) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < order.length && byDay.get(order[j + 1]) === wins) j++;
    const label = j > i ? `${WEEKDAYS_SHORT[order[i]]}–${WEEKDAYS_SHORT[order[j]]}` : WEEKDAYS_SHORT[order[i]];
    parts.push(`${label} ${wins}`);
    i = j + 1;
  }
  return parts.join(" · ");
}

export function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase().replace("_", "-");
}
