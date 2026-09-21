import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BLOCKING_STATUSES, type CreateServiceInput, type Service, type UpdateServiceInput } from '@reserivo/shared';
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

  async update(tenant: TenantContext, id: string, input: UpdateServiceInput): Promise<Service> {
    const existing = await this.findInSalon(tenant.salonId, id);
    assertCanManageMember(tenant, existing.designerId);
    const row = await this.prisma.service.update({ where: { id }, data: input });
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
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): Service => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  });
}
