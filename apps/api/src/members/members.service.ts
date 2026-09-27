import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BLOCKING_STATUSES, type Member, type SalonRole, type UpdateMemberInput } from '@reserivo/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { SalonHoursService } from '../salon-hours/salon-hours.service.js';
import { assertManager, isManager } from '../tenancy/access.js';
import type { TenantContext } from '../tenancy/tenant.types.js';

export type MemberRow = {
  id: string;
  userId: string;
  roles: SalonRole[];
  displayName: string;
  bio: string | null;
  photoUrl: string | null;
  createdAt: Date;
  user: { email: string };
};

const WITH_EMAIL = { user: { select: { email: true } } } as const;

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salonHours: SalonHoursService,
  ) {}

  async list(tenant: TenantContext): Promise<Member[]> {
    const rows = await this.prisma.salonMembership.findMany({
      where: { salonId: tenant.salonId, status: 'ACTIVE' },
      include: WITH_EMAIL,
      orderBy: { displayName: 'asc' },
    });
    return rows.map((r) => this.toMember(r, isManager(tenant)));
  }

  async get(tenant: TenantContext, memberId: string): Promise<Member> {
    const row = await this.findActive(tenant.salonId, memberId);
    return this.toMember(row, isManager(tenant));
  }

  async update(tenant: TenantContext, memberId: string, input: UpdateMemberInput): Promise<Member> {
    const row = await this.findActive(tenant.salonId, memberId);
    let gainsDesigner = false;

    if (input.roles) {
      assertManager(tenant);
      const had = (r: SalonRole) => row.roles.includes(r);
      const will = (r: SalonRole) => input.roles!.includes(r);

      if (had('MANAGER') && !will('MANAGER') && (await this.activeManagerCount(tenant.salonId)) <= 1) {
        throw new ConflictException('A business needs at least one manager');
      }
      if (had('DESIGNER') && !will('DESIGNER')) {
        const upcoming = await this.upcomingAppointments(memberId);
        if (upcoming > 0) {
          throw new ConflictException(`${row.displayName} has ${upcoming} upcoming appointment(s). Cancel or move them first.`);
        }
      }
      gainsDesigner = !had('DESIGNER') && will('DESIGNER');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const m = await tx.salonMembership.update({
        where: { id: memberId },
        data: { displayName: input.displayName, bio: input.bio, photoUrl: input.photoUrl, roles: input.roles },
        include: WITH_EMAIL,
      });
      if (gainsDesigner) await this.salonHours.seedMemberHours(tx, tenant.salonId, memberId);
      return m;
    });
    return this.toMember(updated, isManager(tenant));
  }

  /** Soft-removes so appointments and audit rows keep their references. */
  async remove(tenant: TenantContext, memberId: string): Promise<void> {
    const row = await this.findActive(tenant.salonId, memberId);
    if (row.roles.includes('MANAGER') && (await this.activeManagerCount(tenant.salonId)) <= 1) {
      throw new ConflictException('A business needs at least one manager');
    }
    const upcoming = await this.upcomingAppointments(memberId);
    if (upcoming > 0) {
      throw new ConflictException(`${row.displayName} has ${upcoming} upcoming appointment(s). Cancel or move them first.`);
    }
    await this.prisma.salonMembership.update({ where: { id: memberId }, data: { status: 'REMOVED' } });
  }

  /** Throws 404 unless the member is active in this salon. Used by other modules too. */
  async findActive(salonId: string, memberId: string): Promise<MemberRow> {
    const row = await this.prisma.salonMembership.findFirst({
      where: { id: memberId, salonId, status: 'ACTIVE' },
      include: WITH_EMAIL,
    });
    if (!row) throw new NotFoundException('Member not found');
    return row;
  }

  /** 404 unless active *and* bookable. Services, hours and bookings all require this. */
  async findDesigner(salonId: string, memberId: string): Promise<MemberRow> {
    const row = await this.findActive(salonId, memberId);
    if (!row.roles.includes('DESIGNER')) throw new ConflictException(`${row.displayName} does not take appointments`);
    return row;
  }

  private activeManagerCount(salonId: string): Promise<number> {
    return this.prisma.salonMembership.count({ where: { salonId, status: 'ACTIVE', roles: { has: 'MANAGER' } } });
  }

  private upcomingAppointments(memberId: string): Promise<number> {
    return this.prisma.appointment.count({
      where: { designerId: memberId, status: { in: [...BLOCKING_STATUSES] }, startAt: { gte: new Date() } },
    });
  }

  private toMember(r: MemberRow, includeEmail: boolean): Member {
    return {
      id: r.id,
      userId: r.userId,
      roles: r.roles,
      displayName: r.displayName,
      bio: r.bio,
      photoUrl: r.photoUrl,
      createdAt: r.createdAt.toISOString(),
      ...(includeEmail ? { email: r.user.email } : {}),
    };
  }
}
