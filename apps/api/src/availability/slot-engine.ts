import { intersectWindows, localToUtc, windowsForDate, type ExceptionLike, type RuleLike, type Window } from '@reserivo/shared';

/**
 * Pure slot computation. No I/O, no clock reads — everything comes in through
 * the input so it can be tested exhaustively (including DST transitions).
 */

// Day windows moved to @reserivo/shared so the staff calendar draws closed hours
// with exactly the rule the engine books by.
export { windowsForDate, type RuleLike, type ExceptionLike } from '@reserivo/shared';

/** An occupied interval on the designer's timeline; endAt already includes any buffer. */
export interface BusyInterval {
  startAt: Date;
  endAt: Date;
  /**
   * The appointment may share its time — a long service with processing in it.
   * Hands-on appointments (false) block the slot outright.
   */
  sharable: boolean;
}

/**
 * How many appointments a designer may hold at one moment through *public*
 * booking. Two is the real-world ceiling: one client processing, one in the
 * chair. Staff can still stack further by hand, deliberately.
 */
export const MAX_CONCURRENT_APPOINTMENTS = 2;

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
  /** Concurrency ceiling; defaults to MAX_CONCURRENT_APPOINTMENTS. */
  maxConcurrent?: number;
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

/** Salon windows, narrowed by the member's own windows when they have any. */
export function effectiveWindows(input: Pick<SlotEngineInput, 'date' | 'salonRules' | 'salonExceptions' | 'memberRules' | 'memberExceptions'>): Window[] {
  const salon = windowsForDate(input.date, input.salonRules, input.salonExceptions);
  if (input.memberRules === undefined) return salon;
  const own = windowsForDate(input.date, input.memberRules, input.memberExceptions ?? []);
  return intersectWindows(own, salon);
}

export function computeSlots(input: SlotEngineInput): EngineSlot[] {
  const { date, timezone, durationMin, bufferMin, slotIntervalMin, notBefore } = input;
  const maxConcurrent = input.maxConcurrent ?? MAX_CONCURRENT_APPOINTMENTS;
  const blockMs = (durationMin + bufferMin) * 60_000;
  const slots: EngineSlot[] = [];

  for (const w of effectiveWindows(input)) {
    // The service itself must finish inside the window; cleanup buffer may spill past closing.
    for (let t = w.startMinutes; t + durationMin <= w.endMinutes; t += slotIntervalMin) {
      const startAt = localToUtc(date, t, timezone);
      if (notBefore && startAt < notBefore) continue;

      const blockEnd = new Date(startAt.getTime() + blockMs);
      const overlapping = input.busy.filter((b) => b.startAt < blockEnd && startAt < b.endAt);
      // A hands-on appointment blocks the slot whatever we are trying to book:
      // the engine is deliberately stricter than the database here, so nobody
      // stacks a long service on top of an hour the designer is already working.
      if (overlapping.some((b) => !b.sharable)) continue;
      // Otherwise every overlap is sharable, but the stack still has a ceiling.
      if (overlapping.length + 1 > maxConcurrent) continue;

      slots.push({ startAt, startMinutes: t });
    }
  }

  // Windows may be listed out of order; customers expect chronological slots.
  slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return slots;
}
