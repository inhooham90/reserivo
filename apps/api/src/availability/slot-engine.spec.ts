import { intersectWindows, localToUtc, utcToLocal } from '@reserivo/shared';
import { describe, expect, it } from 'vitest';
import { computeSlots, effectiveWindows, windowsForDate } from './slot-engine.js';

const LA = 'America/Los_Angeles';
const nineToFive = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinutes: 540, endMinutes: 1020 }));
const off = (date: string) => [{ date, type: 'OFF' as const, startMinutes: null, endMinutes: null }];
const custom = (date: string, s: number, e: number) => [{ date, type: 'CUSTOM' as const, startMinutes: s, endMinutes: e }];

/** A manager-like input: the salon is open 9–17 on weekdays and the member works those hours. */
const base = {
  timezone: LA,
  salonRules: nineToFive,
  salonExceptions: [],
  busy: [],
  durationMin: 60,
  bufferMin: 0,
  slotIntervalMin: 60,
};
const mins = (slots: { startMinutes: number }[]) => slots.map((s) => s.startMinutes);

describe('windowsForDate', () => {
  it('uses the weekday rules by default', () => {
    // 2026-03-10 is a Tuesday
    expect(windowsForDate('2026-03-10', nineToFive, [])).toEqual([{ startMinutes: 540, endMinutes: 1020 }]);
  });

  it('returns nothing on a weekday with no rules', () => {
    expect(windowsForDate('2026-03-08', nineToFive, [])).toEqual([]); // Sunday
  });

  it('OFF beats everything, CUSTOM replaces the rules', () => {
    expect(windowsForDate('2026-03-10', nineToFive, off('2026-03-10'))).toEqual([]);
    expect(windowsForDate('2026-03-10', nineToFive, custom('2026-03-10', 720, 900))).toEqual([{ startMinutes: 720, endMinutes: 900 }]);
  });
});

describe('intersectWindows', () => {
  it('clips to the overlap and drops disjoint pairs', () => {
    expect(intersectWindows([{ startMinutes: 480, endMinutes: 780 }], [{ startMinutes: 540, endMinutes: 1020 }])).toEqual([
      { startMinutes: 540, endMinutes: 780 },
    ]);
    expect(intersectWindows([{ startMinutes: 1080, endMinutes: 1200 }], [{ startMinutes: 540, endMinutes: 1020 }])).toEqual([]);
  });

  it('handles split shifts on either side', () => {
    const member = [
      { startMinutes: 540, endMinutes: 720 },
      { startMinutes: 840, endMinutes: 1140 },
    ];
    const salon = [{ startMinutes: 600, endMinutes: 1080 }];
    expect(intersectWindows(member, salon)).toEqual([
      { startMinutes: 600, endMinutes: 720 },
      { startMinutes: 840, endMinutes: 1080 },
    ]);
  });
});

describe('effectiveWindows', () => {
  it('a manager (no personal rules) gets the salon windows', () => {
    expect(effectiveWindows({ date: '2026-03-10', salonRules: nineToFive, salonExceptions: [] })).toEqual([
      { startMinutes: 540, endMinutes: 1020 },
    ]);
  });

  it('a designer’s hours are narrowed to the salon’s', () => {
    const memberRules = [{ weekday: 2, startMinutes: 480, endMinutes: 780 }]; // 8–13, but salon opens at 9
    expect(effectiveWindows({ date: '2026-03-10', salonRules: nineToFive, salonExceptions: [], memberRules, memberExceptions: [] })).toEqual([
      { startMinutes: 540, endMinutes: 780 },
    ]);
  });

  it('a salon closure empties the day even if the designer is scheduled', () => {
    const memberRules = [{ weekday: 2, startMinutes: 600, endMinutes: 900 }];
    expect(
      effectiveWindows({ date: '2026-03-10', salonRules: nineToFive, salonExceptions: off('2026-03-10'), memberRules, memberExceptions: [] }),
    ).toEqual([]);
  });

  it('a designer with no rules for the day is unavailable even though the salon is open', () => {
    expect(effectiveWindows({ date: '2026-03-10', salonRules: nineToFive, salonExceptions: [], memberRules: [], memberExceptions: [] })).toEqual([]);
  });

  it('a salon early close clips the designer’s custom day', () => {
    const memberRules = [{ weekday: 2, startMinutes: 540, endMinutes: 1020 }];
    expect(
      effectiveWindows({
        date: '2026-03-10',
        salonRules: nineToFive,
        salonExceptions: custom('2026-03-10', 540, 780),
        memberRules,
        memberExceptions: custom('2026-03-10', 600, 1020),
      }),
    ).toEqual([{ startMinutes: 600, endMinutes: 780 }]);
  });
});

describe('computeSlots', () => {
  it('produces one slot per interval that fits the service inside the window', () => {
    expect(mins(computeSlots({ ...base, date: '2026-03-10' }))).toEqual([540, 600, 660, 720, 780, 840, 900, 960]);
    // A 60-min service cannot start at 17:00 when the window closes at 17:00.
  });

  it('lets the buffer spill past closing but not the service itself', () => {
    const slots = computeSlots({ ...base, date: '2026-03-10', bufferMin: 30 });
    expect(slots.at(-1)?.startMinutes).toBe(960); // 16:00 + 60 fits; buffer to 17:30 is fine
  });

  it('respects the lead time', () => {
    const notBefore = localToUtc('2026-03-10', 750, LA); // 12:30 local
    expect(computeSlots({ ...base, date: '2026-03-10', notBefore })[0].startMinutes).toBe(780);
  });

  it('removes slots that clash with busy intervals, including the new slot’s buffer', () => {
    const busy = [{ startAt: localToUtc('2026-03-10', 720, LA), endAt: localToUtc('2026-03-10', 780, LA) }]; // 12:00–13:00
    const plain = mins(computeSlots({ ...base, date: '2026-03-10', busy }));
    expect(plain).not.toContain(720);
    expect(plain).toContain(660); // 11:00–12:00 touches but does not overlap

    // With a 15-min buffer, 11:00 would block until 12:15 and clash.
    const buffered = mins(computeSlots({ ...base, date: '2026-03-10', busy, bufferMin: 15, slotIntervalMin: 15 }));
    expect(buffered).not.toContain(660);
    expect(buffered).toContain(645); // 10:45 → 11:45 + 15 = 12:00, touches only
  });

  it('a designer never gets slots outside salon hours, whatever their own rules say', () => {
    const memberRules = [{ weekday: 2, startMinutes: 420, endMinutes: 1260 }]; // 7–21
    expect(mins(computeSlots({ ...base, date: '2026-03-10', memberRules, memberExceptions: [] }))).toEqual([540, 600, 660, 720, 780, 840, 900, 960]);
  });

  it('spring forward: 9:00 local is one UTC hour earlier than the day before', () => {
    // US DST begins 2026-03-08. Monday 03-09 is PDT; Friday 03-06 is PST.
    const before = computeSlots({ ...base, date: '2026-03-06' })[0].startAt;
    const after = computeSlots({ ...base, date: '2026-03-09' })[0].startAt;
    expect(before.toISOString()).toBe('2026-03-06T17:00:00.000Z');
    expect(after.toISOString()).toBe('2026-03-09T16:00:00.000Z');
    expect(utcToLocal(before, LA).minutes).toBe(540);
    expect(utcToLocal(after, LA).minutes).toBe(540);
  });

  it('fall back: the local day is 25 hours long but the slot grid is unaffected', () => {
    // US DST ends 2026-11-01 (Sunday). Salon opens 01:00–04:00 that day by exception.
    const slots = computeSlots({ ...base, date: '2026-11-01', salonRules: [], salonExceptions: custom('2026-11-01', 60, 240) });
    expect(mins(slots)).toEqual([60, 120, 180]);
    expect(slots.map((s) => s.startAt.toISOString())).toEqual([
      '2026-11-01T08:00:00.000Z', // 01:00 PDT
      '2026-11-01T10:00:00.000Z', // 02:00 PST (01:00 repeated, then 02:00)
      '2026-11-01T11:00:00.000Z', // 03:00 PST
    ]);
  });

  it('sorts slots chronologically across multiple windows', () => {
    const salonRules = [
      { weekday: 2, startMinutes: 840, endMinutes: 1020 },
      { weekday: 2, startMinutes: 540, endMinutes: 720 },
    ];
    expect(mins(computeSlots({ ...base, date: '2026-03-10', salonRules }))).toEqual([540, 600, 660, 840, 900, 960]);
  });
});

describe('fitting a service into the gap before an existing appointment', () => {
  // Salon open 9:00–18:00 on a 15-minute grid, with 10:15–10:45 already booked.
  const cfg = {
    date: '2026-03-10',
    timezone: LA,
    salonRules: [{ weekday: 2, startMinutes: 540, endMinutes: 1080 }],
    salonExceptions: [],
    busy: [{ startAt: localToUtc('2026-03-10', 615, LA), endAt: localToUtc('2026-03-10', 645, LA) }],
    slotIntervalMin: 15,
  };
  const before1015 = (durationMin: number, bufferMin: number) =>
    mins(computeSlots({ ...cfg, durationMin, bufferMin })).filter((m) => m < 615);

  it('a 20-minute cut with a 10-minute buffer cannot start at 10:00', () => {
    // 10:00 + 20 + 10 = 10:30, which runs into the 10:15 booking.
    expect(before1015(20, 10)).toEqual([540, 555, 570, 585]);
    // 9:45 is the last that fits: 9:45 + 20 + 10 lands exactly on 10:15.
  });

  it('a 60-minute perm with a 15-minute buffer can only start at 9:00', () => {
    expect(before1015(60, 15)).toEqual([540]);
  });

  it('the buffer alone can decide it: the same perm without one also fits at 9:15', () => {
    expect(before1015(60, 0)).toEqual([540, 555]);
  });
});
