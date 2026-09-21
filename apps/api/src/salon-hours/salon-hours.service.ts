import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AvailabilityException,
  AvailabilityRule,
  CreateAvailabilityExceptionInput,
  ReplaceAvailabilityRulesInput,
  SalonHours,
} from '@reserivo/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

/** Mon–Sat 9:00–18:00. Applied to new salons so the booking page is never silently empty. */
export const DEFAULT_SALON_HOURS = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinutes: 540, endMinutes: 1080 }));

type Tx = Prisma.TransactionClient;

@Injectable()
export class SalonHoursService {
  constructor(private readonly prisma: PrismaService) {}

  /** Weekly hours plus closures/special days from today onward. */
  async get(salonId: string): Promise<SalonHours> {
    const [rules, exceptions] = await Promise.all([
      this.prisma.salonHours.findMany({ where: { salonId }, orderBy: [{ weekday: 'asc' }, { startMinutes: 'asc' }] }),
      this.prisma.salonHoursException.findMany({ where: { salonId, date: { gte: todayUtcDate() } }, orderBy: { date: 'asc' } }),
    ]);
    return { rules: rules.map(toRule), exceptions: exceptions.map(toException) };
  }

  /** Just the weekly rules — what the validators and the public page need. */
  rules(salonId: string) {
    return this.prisma.salonHours.findMany({ where: { salonId }, orderBy: [{ weekday: 'asc' }, { startMinutes: 'asc' }] });
  }

  /** Rules and exceptions for a date range, for the slot engine. */
  async forRange(salonId: string, from: string, to: string) {
    const [rules, exceptions] = await Promise.all([
      this.rules(salonId),
      this.prisma.salonHoursException.findMany({
        where: { salonId, date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) } },
      }),
    ]);
    return {
      rules,
      exceptions: exceptions.map((e) => ({
        date: e.date.toISOString().slice(0, 10),
        type: e.type,
        startMinutes: e.startMinutes,
        endMinutes: e.endMinutes,
      })),
    };
  }

  async replaceRules(salonId: string, input: ReplaceAvailabilityRulesInput): Promise<AvailabilityRule[]> {
    await this.prisma.$transaction([
      this.prisma.salonHours.deleteMany({ where: { salonId } }),
      this.prisma.salonHours.createMany({ data: input.rules.map((r) => ({ ...r, salonId })) }),
    ]);
    return (await this.rules(salonId)).map(toRule);
  }

  async addException(salonId: string, input: CreateAvailabilityExceptionInput): Promise<AvailabilityException> {
    const row = await this.prisma.salonHoursException.create({
      data: {
        salonId,
        date: new Date(`${input.date}T00:00:00Z`),
        type: input.type,
        startMinutes: input.type === 'CUSTOM' ? input.startMinutes : null,
        endMinutes: input.type === 'CUSTOM' ? input.endMinutes : null,
        note: input.note ?? null,
      },
    });
    return toException(row);
  }

  async removeException(salonId: string, id: string): Promise<void> {
    const result = await this.prisma.salonHoursException.deleteMany({ where: { id, salonId } });
    if (result.count === 0) throw new NotFoundException('Exception not found');
  }

  /** Called inside salon creation so a new salon opens with sensible hours. */
  async seedDefaults(tx: Tx, salonId: string): Promise<void> {
    await tx.salonHours.createMany({ data: DEFAULT_SALON_HOURS.map((r) => ({ ...r, salonId })) });
  }

  /**
   * When a member becomes a DESIGNER, start them on the salon's hours so they
   * are bookable immediately and can trim from there. No-op if they already
   * have personal hours (e.g. the role was removed and re-added).
   */
  async seedMemberHours(tx: Tx, salonId: string, memberId: string): Promise<void> {
    const existing = await tx.availabilityRule.count({ where: { designerId: memberId } });
    if (existing > 0) return;
    const hours = await tx.salonHours.findMany({ where: { salonId } });
    if (hours.length === 0) return;
    await tx.availabilityRule.createMany({
      data: hours.map((h) => ({ salonId, designerId: memberId, weekday: h.weekday, startMinutes: h.startMinutes, endMinutes: h.endMinutes })),
    });
  }
}

function todayUtcDate(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const toRule = (r: { id: string; weekday: number; startMinutes: number; endMinutes: number }): AvailabilityRule => ({
  id: r.id,
  weekday: r.weekday,
  startMinutes: r.startMinutes,
  endMinutes: r.endMinutes,
});

const toException = (r: {
  id: string;
  date: Date;
  type: 'OFF' | 'CUSTOM';
  startMinutes: number | null;
  endMinutes: number | null;
  note: string | null;
}): AvailabilityException => ({
  id: r.id,
  date: r.date.toISOString().slice(0, 10),
  type: r.type,
  startMinutes: r.startMinutes,
  endMinutes: r.endMinutes,
  note: r.note,
});
