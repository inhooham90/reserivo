import { z } from 'zod';
import { weekdayOf } from './time';

/**
 * Working hours are stored as local wall-clock minutes from midnight in the
 * salon's timezone (540 = 09:00). No UTC conversion happens until Phase 2's
 * availability engine resolves a concrete date.
 */
const minutesOfDay = z.number().int().min(0).max(24 * 60);

/** 0 = Sunday … 6 = Saturday, matching Date#getDay(). */
export const weekdaySchema = z.number().int().min(0).max(6);

export const timeWindowSchema = z
  .object({ startMinutes: minutesOfDay, endMinutes: minutesOfDay })
  .refine((w) => w.endMinutes > w.startMinutes, { message: 'End must be after start', path: ['endMinutes'] });
export type TimeWindow = z.infer<typeof timeWindowSchema>;

export const availabilityRuleSchema = timeWindowSchema.safeExtend({
  id: z.string(),
  weekday: weekdaySchema,
});
export type AvailabilityRule = z.infer<typeof availabilityRuleSchema>;

export const availabilityRuleInputSchema = timeWindowSchema.safeExtend({ weekday: weekdaySchema });
export type AvailabilityRuleInput = z.infer<typeof availabilityRuleInputSchema>;

/** Returns the indices of any two windows on the same weekday that overlap. */
export function findOverlap(rules: AvailabilityRuleInput[]): [number, number] | null {
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i];
      const b = rules[j];
      if (a.weekday === b.weekday && a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes) {
        return [i, j];
      }
    }
  }
  return null;
}

/** Whole-week replacement. Windows on the same day must not overlap. */
export const replaceAvailabilityRulesSchema = z
  .object({ rules: z.array(availabilityRuleInputSchema).max(7 * 6) })
  .superRefine((v, ctx) => {
    const overlap = findOverlap(v.rules);
    if (overlap) {
      ctx.addIssue({ code: 'custom', message: 'Windows on the same day overlap', path: ['rules', overlap[1]] });
    }
  });
export type ReplaceAvailabilityRulesInput = z.infer<typeof replaceAvailabilityRulesSchema>;

export const ExceptionType = { OFF: 'OFF', CUSTOM: 'CUSTOM' } as const;
export type ExceptionType = (typeof ExceptionType)[keyof typeof ExceptionType];
export const exceptionTypeSchema = z.enum([ExceptionType.OFF, ExceptionType.CUSTOM]);

/** Calendar date in the salon's timezone, YYYY-MM-DD. */
export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const availabilityExceptionSchema = z.object({
  id: z.string(),
  date: localDateSchema,
  type: exceptionTypeSchema,
  startMinutes: z.number().int().nullable(),
  endMinutes: z.number().int().nullable(),
  note: z.string().nullable(),
});
export type AvailabilityException = z.infer<typeof availabilityExceptionSchema>;

export const createAvailabilityExceptionSchema = z
  .object({
    date: localDateSchema,
    type: exceptionTypeSchema,
    startMinutes: minutesOfDay.optional(),
    endMinutes: minutesOfDay.optional(),
    note: z.string().trim().max(200).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'CUSTOM') {
      if (v.startMinutes === undefined || v.endMinutes === undefined) {
        ctx.addIssue({ code: 'custom', message: 'Custom hours need a start and end', path: ['startMinutes'] });
      } else if (v.endMinutes <= v.startMinutes) {
        ctx.addIssue({ code: 'custom', message: 'End must be after start', path: ['endMinutes'] });
      }
    }
  });
export type CreateAvailabilityExceptionInput = z.infer<typeof createAvailabilityExceptionSchema>;

/** A bookable member's personal hours; always clamped to the salon's at booking time. */
export const availabilitySchema = z.object({
  rules: z.array(availabilityRuleSchema),
  exceptions: z.array(availabilityExceptionSchema),
});
export type Availability = z.infer<typeof availabilitySchema>;

/** The salon's opening hours use the same shapes as a member's availability. */
export const salonHoursSchema = z.object({
  rules: z.array(availabilityRuleSchema),
  exceptions: z.array(availabilityExceptionSchema),
});
export type SalonHours = z.infer<typeof salonHoursSchema>;

// ---------- Window arithmetic (shared by the API engine and the hours editor) ----------

export interface Window {
  startMinutes: number;
  endMinutes: number;
}

/** Overlap of two window lists, e.g. a designer's day ∩ the salon's day. Result is sorted and non-overlapping. */
export function intersectWindows(a: Window[], b: Window[]): Window[] {
  const out: Window[] = [];
  for (const x of a) {
    for (const y of b) {
      const start = Math.max(x.startMinutes, y.startMinutes);
      const end = Math.min(x.endMinutes, y.endMinutes);
      if (end > start) out.push({ startMinutes: start, endMinutes: end });
    }
  }
  return out.sort((p, q) => p.startMinutes - q.startMinutes);
}

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

/** True when `w` lies entirely inside one of `bounds`. */
export function windowWithin(w: Window, bounds: Window[]): boolean {
  return bounds.some((b) => w.startMinutes >= b.startMinutes && w.endMinutes <= b.endMinutes);
}

/** The first weekly rule that falls outside the salon's hours for its weekday, or null. */
export function findOutsideSalonHours(
  rules: AvailabilityRuleInput[],
  salonRules: AvailabilityRuleInput[],
): { index: number; rule: AvailabilityRuleInput; salonWindows: Window[] } | null {
  for (let i = 0; i < rules.length; i++) {
    const salonWindows = salonRules.filter((s) => s.weekday === rules[i].weekday);
    if (!windowWithin(rules[i], salonWindows)) return { index: i, rule: rules[i], salonWindows };
  }
  return null;
}

/** "09:00" ⇄ 540 helpers for forms. */
export function minutesToHHMM(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
export function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + (m || 0);
}
