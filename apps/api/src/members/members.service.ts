import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Member, UpdateMemberInput } from '@reserivo/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertManager, isManager } from '../tenancy/access.js';
import type { TenantContext } from '../tenancy/tenant.types.js';

type MemberRow = {
  id: string;
  userId: string;
  role: 'MANAGER' | 'DESIGNER';
  displayName: string;
  bio: string | null;
  photoUrl: string | null;
  acceptsBookings: boolean;
  createdAt: Date;
  user: { email: string };
};

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenant: TenantContext): Promise<Member[]> {
    const rows = await this.prisma.salonMembership.findMany({
      where: { salonId: tenant.salonId, status: 'ACTIVE' },
      include: { user: { select: { email: true } } },
      orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
    });
    return rows.map((r) => this.toMember(r, isManager(tenant)));
  }

  async get(tenant: TenantContext, memberId: string): Promise<Member> {
    const row = await this.findActive(tenant.salonId, memberId);
    return this.toMember(row, isManager(tenant));
  }

  async update(tenant: TenantContext, memberId: string, input: UpdateMemberInput): Promise<Member> {
    const row = await this.findActive(tenant.salonId, memberId);

    if (input.role !== undefined && input.role !== row.role) {
      assertManager(tenant);
      if (row.role === 'MANAGER' && (await this.activeManagerCount(tenant.salonId)) <= 1) {
        throw new ConflictException('A salon needs at least one manager');
      }
    }

    const updated = await this.prisma.salonMembership.update({
      where: { id: memberId },
      data: {
        displayName: input.displayName,
        bio: input.bio,
        photoUrl: input.photoUrl,
        acceptsBookings: input.acceptsBookings,
        role: input.role,
      },
      include: { user: { select: { email: true } } },
    });
    return this.toMember(updated, isManager(tenant));
  }

  /** Soft-removes so appointments and audit rows keep their references. */
  async remove(tenant: TenantContext, memberId: string): Promise<void> {
    const row = await this.findActive(tenant.salonId, memberId);
    if (row.role === 'MANAGER' && (await this.activeManagerCount(tenant.salonId)) <= 1) {
      throw new ConflictException('A salon needs at least one manager');
    }
    await this.prisma.salonMembership.update({ where: { id: memberId }, data: { status: 'REMOVED' } });
  }

  /** Throws 404 unless the member is active in this salon. Used by other modules too. */
  async findActive(salonId: string, memberId: string): Promise<MemberRow> {
    const row = await this.prisma.salonMembership.findFirst({
      where: { id: memberId, salonId, status: 'ACTIVE' },
      include: { user: { select: { email: true } } },
    });
    if (!row) throw new NotFoundException('Member not found');
    return row;
  }

  private activeManagerCount(salonId: string): Promise<number> {
    return this.prisma.salonMembership.count({ where: { salonId, status: 'ACTIVE', role: 'MANAGER' } });
  }

  private toMember(r: MemberRow, includeEmail: boolean): Member {
    return {
      id: r.id,
      userId: r.userId,
      role: r.role,
      displayName: r.displayName,
      bio: r.bio,
      photoUrl: r.photoUrl,
      acceptsBookings: r.acceptsBookings,
      createdAt: r.createdAt.toISOString(),
      ...(includeEmail ? { email: r.user.email } : {}),
    };
  }
}
