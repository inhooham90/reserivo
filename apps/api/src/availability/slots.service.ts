import { Injectable, NotFoundException } from '@nestjs/common';
import {
  addDays,
  BLOCKING_STATUSES,
  daysBetween,
  localToUtc,
  todayIn,
  type AvailabilityResponse,
  type DaySlots,
} from '@reserivo/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { SalonHoursService } from '../salon-hours/salon-hours.service.js';
import { computeSlots, type BusyInterval, type EngineSlot } from './slot-engine.js';

export interface SlotsRequest {
  salon: { id: string; timezone: string; slotIntervalMin: number; leadTimeMin: number; maxAdvanceDays: number };
  designerId: string;
  service: { durationMin: number; bufferMin: number };
  from: string;
  days: number;
  /** public = customer rules (lead time, max advance, no past); staff = hours and conflicts only. */
  mode: 'public' | 'staff';
  /** Staff only: an appointment to leave out of the busy set, so it can be moved within its own span. */
  excludeAppointmentId?: string;
  now?: Date;
}

/** Loads what the engine needs and runs it for a range of dates. */
@Injectable()
export class SlotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salonHours: SalonHoursService,
  ) {}

  async compute(req: SlotsRequest): Promise<AvailabilityResponse> {
    const now = req.now ?? new Date();
    const tz = req.salon.timezone;
    const today = todayIn(tz, now);

    // Clamp the requested range to what a customer is allowed to see.
    let from = req.from;
    let last = addDays(req.from, req.days - 1);
    if (req.mode === 'public') {
      if (daysBetween(today, from) < 0) from = today;
      const maxDate = addDays(today, req.salon.maxAdvanceDays);
      if (daysBetween(maxDate, last) > 0) last = maxDate;
    }
    const dayCount = daysBetween(from, last) + 1;
    if (dayCount <= 0) return { timezone: tz, durationMin: req.service.durationMin, days: [] };

    const rangeStart = localToUtc(from, 0, tz);
    const rangeEnd = localToUtc(last, 1440, tz);

    const member = await this.prisma.salonMembership.findFirst({
      where: { id: req.designerId, salonId: req.salon.id, status: 'ACTIVE', roles: { has: 'DESIGNER' } },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('That member does not take appointments');

    const [salon, rules, exceptions, appointments] = await Promise.all([
      this.salonHours.forRange(req.salon.id, from, last),
      this.prisma.availabilityRule.findMany({ where: { designerId: req.designerId } }),
      this.prisma.availabilityException.findMany({
        where: {
          designerId: req.designerId,
          date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${last}T00:00:00Z`) },
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          designerId: req.designerId,
          status: { in: [...BLOCKING_STATUSES] },
          startAt: { lt: rangeEnd },
          blockEndAt: { gt: rangeStart },
          ...(req.mode === 'staff' && req.excludeAppointmentId ? { id: { not: req.excludeAppointmentId } } : {}),
        },
        select: { startAt: true, blockEndAt: true, allowsDoubleBooking: true },
      }),
    ]);

    const busy: BusyInterval[] = appointments.map((a) => ({
      startAt: a.startAt,
      endAt: a.blockEndAt,
      sharable: a.allowsDoubleBooking,
    }));
    const memberExceptions = exceptions.map((e) => ({
      date: e.date.toISOString().slice(0, 10),
      type: e.type,
      startMinutes: e.startMinutes,
      endMinutes: e.endMinutes,
    }));
    // Customers must also clear the salon's lead time. Staff may book right up
    // to this moment, but a slot that has already passed is never offered.
    const notBefore = req.mode === 'public' ? new Date(now.getTime() + req.salon.leadTimeMin * 60_000) : now;

    const days: DaySlots[] = [];
    for (let i = 0; i < dayCount; i++) {
      const date = addDays(from, i);
      const slots = computeSlots({
        date,
        timezone: tz,
        salonRules: salon.rules,
        salonExceptions: salon.exceptions,
        memberRules: rules,
        memberExceptions,
        busy,
        durationMin: req.service.durationMin,
        bufferMin: req.service.bufferMin,
        slotIntervalMin: req.salon.slotIntervalMin,
        notBefore,
      });
      days.push({ date, slots: slots.map(this.toSlot) });
    }

    return { timezone: tz, durationMin: req.service.durationMin, days };
  }

  private toSlot = (s: EngineSlot) => ({ startAt: s.startAt.toISOString(), startMinutes: s.startMinutes });
}
