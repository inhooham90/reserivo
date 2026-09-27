import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  findOutsideSalonHours,
  minutesToHHMM,
  windowWithin,
  type Availability,
  type AvailabilityException,
  type AvailabilityRule,
  type CreateAvailabilityExceptionInput,
  type ReplaceAvailabilityRulesInput,
} from '@reserivo/shared';
import { MembersService } from '../members/members.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SalonHoursService } from '../salon-hours/salon-hours.service.js';
import { assertCanManageMember } from '../tenancy/access.js';
import type { TenantContext } from '../tenancy/tenant.types.js';
import { windowsForDate } from './slot-engine.js';

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * A bookable member's personal working hours, bounded by the salon's opening
 * hours. Only members with the DESIGNER role have them.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
    private readonly salonHours: SalonHoursService,
  ) {}

  /** Weekly rules plus exceptions from today onward. */
  async get(tenant: TenantContext, designerId: string): Promise<Availability> {
    await this.members.findDesigner(tenant.salonId, designerId);
    const [rules, exceptions] = await Promise.all([
      this.prisma.availabilityRule.findMany({
        where: { designerId },
        orderBy: [{ weekday: 'asc' }, { startMinutes: 'asc' }],
      }),
      this.prisma.availabilityException.findMany({
        where: { designerId, date: { gte: this.todayUtcDate() } },
        orderBy: { date: 'asc' },
      }),
    ]);
    return { rules: rules.map(this.toRule), exceptions: exceptions.map(this.toException) };
  }

  /** Replaces the whole week atomically. Every window must sit inside the salon's hours for that weekday. */
  async replaceRules(tenant: TenantContext, designerId: string, input: ReplaceAvailabilityRulesInput): Promise<AvailabilityRule[]> {
    assertCanManageMember(tenant, designerId);
    await this.members.findDesigner(tenant.salonId, designerId);

    const salonRules = await this.salonHours.rules(tenant.salonId);
    const outside = findOutsideSalonHours(input.rules, salonRules);
    if (outside) {
      const { rule, salonWindows } = outside;
      const bounds = salonWindows.length
        ? salonWindows.map((w) => `${minutesToHHMM(w.startMinutes)}–${minutesToHHMM(w.endMinutes)}`).join(', ')
        : 'closed';
      throw new BadRequestException(
        `${WEEKDAY[rule.weekday]} ${minutesToHHMM(rule.startMinutes)}–${minutesToHHMM(rule.endMinutes)} is outside business hours (${bounds}).`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.availabilityRule.deleteMany({ where: { designerId } }),
      this.prisma.availabilityRule.createMany({
        data: input.rules.map((r) => ({ ...r, salonId: tenant.salonId, designerId })),
      }),
    ]);

    const rows = await this.prisma.availabilityRule.findMany({
      where: { designerId },
      orderBy: [{ weekday: 'asc' }, { startMinutes: 'asc' }],
    });
    return rows.map(this.toRule);
  }

  async addException(
    tenant: TenantContext,
    designerId: string,
    input: CreateAvailabilityExceptionInput,
  ): Promise<AvailabilityException> {
    assertCanManageMember(tenant, designerId);
    await this.members.findDesigner(tenant.salonId, designerId);

    if (input.type === 'CUSTOM') {
      const salon = await this.salonHours.forRange(tenant.salonId, input.date, input.date);
      const open = windowsForDate(input.date, salon.rules, salon.exceptions);
      if (!windowWithin({ startMinutes: input.startMinutes!, endMinutes: input.endMinutes! }, open)) {
        const bounds = open.length
          ? open.map((w) => `${minutesToHHMM(w.startMinutes)}–${minutesToHHMM(w.endMinutes)}`).join(', ')
          : 'closed that day';
        throw new BadRequestException(`Those hours are outside business hours on ${input.date} (${bounds}).`);
      }
    }

    const row = await this.prisma.availabilityException.create({
      data: {
        salonId: tenant.salonId,
        designerId,
        date: new Date(`${input.date}T00:00:00Z`),
        type: input.type,
        startMinutes: input.type === 'CUSTOM' ? input.startMinutes : null,
        endMinutes: input.type === 'CUSTOM' ? input.endMinutes : null,
        note: input.note ?? null,
      },
    });
    return this.toException(row);
  }

  async removeException(tenant: TenantContext, designerId: string, id: string): Promise<void> {
    assertCanManageMember(tenant, designerId);
    const result = await this.prisma.availabilityException.deleteMany({
      where: { id, designerId, salonId: tenant.salonId },
    });
    if (result.count === 0) throw new NotFoundException('Exception not found');
  }

  private todayUtcDate(): Date {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private toRule = (r: { id: string; weekday: number; startMinutes: number; endMinutes: number }): AvailabilityRule => ({
    id: r.id,
    weekday: r.weekday,
    startMinutes: r.startMinutes,
    endMinutes: r.endMinutes,
  });

  private toException = (r: {
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
}
