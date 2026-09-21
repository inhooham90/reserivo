import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  Availability,
  AvailabilityException,
  AvailabilityRule,
  CreateAvailabilityExceptionInput,
  ReplaceAvailabilityRulesInput,
} from '@reserivo/shared';
import { MembersService } from '../members/members.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertCanManageMember } from '../tenancy/access.js';
import type { TenantContext } from '../tenancy/tenant.types.js';

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
  ) {}

  /** Weekly rules plus exceptions from today onward. */
  async get(tenant: TenantContext, designerId: string): Promise<Availability> {
    await this.members.findActive(tenant.salonId, designerId);
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

  /** Replaces the whole week atomically; the shared schema already rejected overlaps. */
  async replaceRules(tenant: TenantContext, designerId: string, input: ReplaceAvailabilityRulesInput): Promise<AvailabilityRule[]> {
    assertCanManageMember(tenant, designerId);
    await this.members.findActive(tenant.salonId, designerId);

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
    await this.members.findActive(tenant.salonId, designerId);

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
