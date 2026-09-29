import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  assertDoubleBookingAllowed,
  BLOCKING_STATUSES,
  canAllowDoubleBooking,
  type CreateServiceInput,
  type CreateServicesInput,
  type Service,
  type UpdateServiceInput,
} from '@reserivo/shared';
import { MembersService } from '../members/members.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertCanManageMember } from '../tenancy/access.js';
import type { TenantContext } from '../tenancy/tenant.types.js';

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
  ) {}

  async list(tenant: TenantContext, designerId?: string): Promise<Service[]> {
    const rows = await this.prisma.service.findMany({
      where: { salonId: tenant.salonId, ...(designerId ? { designerId } : {}) },
      orderBy: [{ designerId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(this.toService);
  }

  /**
   * Designers create for themselves; managers may name any active member.
   * Either way the owner must be an active member of this salon.
   */
  async create(tenant: TenantContext, input: CreateServiceInput): Promise<Service> {
    const designerId = input.designerId ?? tenant.membership?.id;
    if (!designerId) throw new BadRequestException('designerId is required');
    assertCanManageMember(tenant, designerId);
    await this.members.findDesigner(tenant.salonId, designerId);

    const { designerId: _ignored, ...data } = input;
    const row = await this.prisma.service.create({ data: { ...data, salonId: tenant.salonId, designerId } });
    return this.toService(row);
  }

  /**
   * Same ownership rules as `create`, for a whole menu. The rows go in after
   * the member's existing services, in the order they were given, and in one
   * statement, so a failure leaves nothing half-added.
   */
  async createMany(tenant: TenantContext, input: CreateServicesInput): Promise<Service[]> {
    const designerId = input.designerId ?? tenant.membership?.id;
    if (!designerId) throw new BadRequestException('designerId is required');
    assertCanManageMember(tenant, designerId);
    await this.members.findDesigner(tenant.salonId, designerId);

    const last = await this.prisma.service.aggregate({ where: { designerId }, _max: { sortOrder: true } });
    const start = (last._max.sortOrder ?? -1) + 1;
    const rows = await this.prisma.service.createManyAndReturn({
      data: input.services.map((s, i) => ({ ...s, salonId: tenant.salonId, designerId, sortOrder: start + i })),
    });
    return rows.sort((a, b) => a.sortOrder - b.sortOrder).map(this.toService);
  }

  async update(tenant: TenantContext, id: string, input: UpdateServiceInput): Promise<Service> {
    const existing = await this.findInSalon(tenant.salonId, id);
    assertCanManageMember(tenant, existing.designerId);

    // The update is partial, so validate the *resulting* service, not the patch.
    const durationMin = input.durationMin ?? existing.durationMin;
    const data: UpdateServiceInput = { ...input };
    if (input.allowsDoubleBooking !== undefined) {
      const problem = assertDoubleBookingAllowed(durationMin, input.allowsDoubleBooking);
      if (problem) throw new BadRequestException(problem);
    } else if (existing.allowsDoubleBooking && !canAllowDoubleBooking(durationMin)) {
      // Shortening a service past the threshold leaves the flag meaningless
      // rather than wrong, so drop it instead of refusing the edit.
      data.allowsDoubleBooking = false;
    }

    const row = await this.prisma.service.update({ where: { id }, data });
    return this.toService(row);
  }

  /**
   * Deleting is refused while upcoming appointments reference the service —
   * deactivate instead. Past appointments keep their snapshots (FK is SetNull).
   */
  async remove(tenant: TenantContext, id: string): Promise<void> {
    const existing = await this.findInSalon(tenant.salonId, id);
    assertCanManageMember(tenant, existing.designerId);
    const upcoming = await this.prisma.appointment.count({
      where: { serviceId: id, status: { in: [...BLOCKING_STATUSES] }, startAt: { gte: new Date() } },
    });
    if (upcoming > 0) {
      throw new ConflictException(`This service has ${upcoming} upcoming appointment(s). Deactivate it instead.`);
    }
    await this.prisma.service.delete({ where: { id } });
  }

  private async findInSalon(salonId: string, id: string) {
    const row = await this.prisma.service.findFirst({ where: { id, salonId } });
    if (!row) throw new NotFoundException('Service not found');
    return row;
  }

  private toService = (r: {
    id: string;
    salonId: string;
    designerId: string;
    name: string;
    category: string | null;
    description: string | null;
    priceCents: number;
    durationMin: number;
    bufferMin: number;
    active: boolean;
    allowsDoubleBooking: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): Service => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  });
}
