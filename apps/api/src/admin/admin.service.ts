import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BLOCKING_STATUSES,
  type AdminSalon,
  type AdminSalonDetail,
  type AdminSearch,
  type AdminUser,
  type AdminUserDetail,
  type AuditEntry,
  type AuditPage,
  type AuditQuery,
  type AuthResponse,
  type PlatformStats,
} from '@reserivo/shared';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

const insensitive = { mode: 'insensitive' } as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  async stats(): Promise<PlatformStats> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const [users, salons, bookableMembers, customers, appointments, upcomingAppointments, bookedLast7Days] =
      await this.prisma.$transaction([
        this.prisma.user.count(),
        this.prisma.salon.count(),
        this.prisma.salonMembership.count({ where: { status: 'ACTIVE', roles: { has: 'DESIGNER' } } }),
        this.prisma.customer.count(),
        this.prisma.appointment.count(),
        this.prisma.appointment.count({ where: { status: { in: [...BLOCKING_STATUSES] }, startAt: { gte: now } } }),
        this.prisma.appointment.count({ where: { createdAt: { gte: weekAgo } } }),
      ]);
    return { users, salons, bookableMembers, customers, appointments, upcomingAppointments, bookedLast7Days };
  }

  // ---------- Users ----------

  async searchUsers({ q, limit }: AdminSearch): Promise<AdminUser[]> {
    const rows = await this.prisma.user.findMany({
      where: q ? { OR: [{ email: { contains: q, ...insensitive } }, { name: { contains: q, ...insensitive } }] } : {},
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isSiteAdmin: true,
        createdAt: true,
        _count: { select: { memberships: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      phone: r.phone,
      isSiteAdmin: r.isSiteAdmin,
      createdAt: r.createdAt.toISOString(),
      salonCount: r._count.memberships,
    }));
  }

  async userDetail(admin: AuthenticatedUser, id: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        memberships: {
          include: { salon: { select: { id: true, name: true, slug: true } } },
          orderBy: { createdAt: 'asc' },
        },
        customerOf: {
          include: { salon: { select: { id: true, name: true } }, _count: { select: { appointments: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      isSiteAdmin: user.isSiteAdmin,
      createdAt: user.createdAt.toISOString(),
      salonCount: user.memberships.length,
      memberships: user.memberships.map((m) => ({
        id: m.id,
        salonId: m.salonId,
        salonName: m.salon.name,
        salonSlug: m.salon.slug,
        roles: m.roles,
        status: m.status,
        displayName: m.displayName,
      })),
      customerOf: user.customerOf.map((c) => ({
        id: c.id,
        salonId: c.salonId,
        salonName: c.salon.name,
        appointments: c._count.appointments,
      })),
      canImpersonate: !user.isSiteAdmin && user.id !== admin.id,
    };
  }

  // ---------- Salons ----------

  async searchSalons({ q, limit }: AdminSearch): Promise<AdminSalon[]> {
    const rows = await this.prisma.salon.findMany({
      where: q ? { OR: [{ name: { contains: q, ...insensitive } }, { slug: { contains: q, ...insensitive } }] } : {},
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        createdAt: true,
        _count: { select: { memberships: true, customers: true, appointments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      timezone: r.timezone,
      createdAt: r.createdAt.toISOString(),
      memberCount: r._count.memberships,
      customerCount: r._count.customers,
      appointmentCount: r._count.appointments,
    }));
  }

  async salonDetail(id: string): Promise<AdminSalonDetail> {
    const salon = await this.prisma.salon.findUnique({
      where: { id },
      include: {
        memberships: { include: { user: { select: { email: true } } }, orderBy: { displayName: 'asc' } },
        _count: { select: { memberships: true, customers: true, appointments: true, services: true } },
      },
    });
    if (!salon) throw new NotFoundException('Business not found');

    const upcomingAppointments = await this.prisma.appointment.count({
      where: { salonId: id, status: { in: [...BLOCKING_STATUSES] }, startAt: { gte: new Date() } },
    });

    return {
      id: salon.id,
      name: salon.name,
      slug: salon.slug,
      timezone: salon.timezone,
      createdAt: salon.createdAt.toISOString(),
      memberCount: salon._count.memberships,
      customerCount: salon._count.customers,
      appointmentCount: salon._count.appointments,
      serviceCount: salon._count.services,
      upcomingAppointments,
      policies: {
        slotIntervalMin: salon.slotIntervalMin,
        leadTimeMin: salon.leadTimeMin,
        maxAdvanceDays: salon.maxAdvanceDays,
        cancelWindowHours: salon.cancelWindowHours,
      },
      members: salon.memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        displayName: m.displayName,
        email: m.user.email,
        roles: m.roles,
        status: m.status,
      })),
    };
  }

  // ---------- Acting as ----------

  /**
   * Hands back an access token that behaves as `userId`. The admin's own
   * refresh cookie is untouched, so refreshing ends the impersonation — it can
   * never outlive one access-token lifetime.
   */
  async impersonate(admin: AuthenticatedUser, userId: string, meta: { ip?: string; userAgent?: string }): Promise<AuthResponse> {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, isSiteAdmin: true, emailVerifiedAt: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.id === admin.id) throw new ConflictException('You are already yourself');
    if (target.isSiteAdmin) throw new ForbiddenException('Site admins cannot act as one another');

    const accessToken = await this.auth.impersonationToken(target.id, admin.id);

    // The most sensitive action in the product gets its own labelled row.
    await this.audit.record({
      user: admin,
      action: 'admin.impersonate.start',
      entityType: 'users',
      entityId: target.id,
      after: { email: target.email, name: target.name },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      accessToken,
      user: {
        id: target.id,
        email: target.email,
        name: target.name,
        isSiteAdmin: false,
        emailVerified: target.emailVerifiedAt !== null,
        actorUserId: admin.id,
      },
    };
  }

  // ---------- Audit log ----------

  async audits(query: AuditQuery): Promise<AuditPage> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
        ...(query.salonId ? { salonId: query.salonId } : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.impersonatedOnly ? { impersonatedUserId: { not: null } } : {}),
      },
      include: {
        actor: { select: { id: true, name: true, email: true } },
        impersonated: { select: { id: true, name: true, email: true } },
        salon: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1, // one extra tells us whether another page exists
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const page = rows.slice(0, query.limit);
    return {
      entries: page.map(
        (r): AuditEntry => ({
          id: r.id,
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId,
          createdAt: r.createdAt.toISOString(),
          ip: r.ip,
          actor: r.actor,
          impersonated: r.impersonated,
          salon: r.salon,
          after: r.after ?? null,
        }),
      ),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }
}
