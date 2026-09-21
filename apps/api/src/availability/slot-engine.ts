import { intersectWindows, localToUtc, weekdayOf, type Window } from '@reserivo/shared';

/**
 * Pure slot computation. No I/O, no clock reads — everything comes in through
 * the input so it can be tested exhaustively (including DST transitions).
 */

export interface RuleLike {
  weekday: number;
  startMinutes: number;
  endMinutes: number;
}

export interface ExceptionLike {
  date: string;
  type: 'OFF' | 'CUSTOM';
  startMinutes: number | null;
  endMinutes: number | null;
}

/** A blocked interval on the designer's timeline; endAt already includes any buffer. */
export interface BusyInterval {
  startAt: Date;
  endAt: Date;
}

export type { Window };

export interface SlotEngineInput {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  timezone: string;
  /** The salon's opening hours. Nothing is ever offered outside these. */
  salonRules: RuleLike[];
  salonExceptions: ExceptionLike[];
  /**
   * The member's personal hours. Omit (undefined) for members who work the
   * salon hours outright — managers. When present, the day's windows are the
   * intersection of personal and salon windows.
   */
  memberRules?: RuleLike[];
  memberExceptions?: ExceptionLike[];
  busy: BusyInterval[];
  durationMin: number;
  bufferMin: number;
  slotIntervalMin: number;
  /** Earliest permissible start (now + lead time). Omit for staff bookings. */
  notBefore?: Date;
}

export interface EngineSlot {
  startAt: Date;
  startMinutes: number;
}

/**
 * The working windows for one date: an OFF exception wins, then CUSTOM windows
 * replace the weekly rules, otherwise the weekday's rules apply.
 */
export function windowsForDate(date: string, rules: RuleLike[], exceptions: ExceptionLike[]): Window[] {
  const todays = exceptions.filter((e) => e.date === date);
  if (todays.some((e) => e.type === 'OFF')) return [];

  const custom = todays.filter((e) => e.type === 'CUSTOM' && e.startMinutes !== null && e.endMinutes !== null);
  if (custom.length) {
    return custom.map((e) => ({ startMinutes: e.startMinutes!, endMinutes: e.endMinutes! }));
  }

  const weekday = weekdayOf(date);
  return rules.filter((r) => r.weekday === weekday).map((r) => ({ startMinutes: r.startMinutes, endMinutes: r.endMinutes }));
}

/** Salon windows, narrowed by the member's own windows when they have any. */
export function effectiveWindows(input: Pick<SlotEngineInput, 'date' | 'salonRules' | 'salonExceptions' | 'memberRules' | 'memberExceptions'>): Window[] {
  const salon = windowsForDate(input.date, input.salonRules, input.salonExceptions);
  if (input.memberRules === undefined) return salon;
  const own = windowsForDate(input.date, input.memberRules, input.memberExceptions ?? []);
  return intersectWindows(own, salon);
}

export function computeSlots(input: SlotEngineInput): EngineSlot[] {
  const { date, timezone, durationMin, bufferMin, slotIntervalMin, notBefore } = input;
  const blockMs = (durationMin + bufferMin) * 60_000;
  const slots: EngineSlot[] = [];

  for (const w of effectiveWindows(input)) {
    // The service itself must finish inside the window; cleanup buffer may spill past closing.
    for (let t = w.startMinutes; t + durationMin <= w.endMinutes; t += slotIntervalMin) {
      const startAt = localToUtc(date, t, timezone);
      if (notBefore && startAt < notBefore) continue;

      const blockEnd = new Date(startAt.getTime() + blockMs);
      const clashes = input.busy.some((b) => b.startAt < blockEnd && startAt < b.endAt);
      if (clashes) continue;

      slots.push({ startAt, startMinutes: t });
    }
  }

  // Windows may be listed out of order; customers expect chronological slots.
  slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return slots;
}
