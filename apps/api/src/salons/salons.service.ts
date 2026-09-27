import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateSalonInput, MySalon, PublicSalon, Salon, SalonRole, UpdateSalonInput } from '@reserivo/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RatingsService } from '../ratings/ratings.service.js';
import { SalonHoursService } from '../salon-hours/salon-hours.service.js';

@Injectable()
export class SalonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salonHours: SalonHoursService,
    private readonly ratings: RatingsService,
  ) {}

  /**
   * Creates the salon with default opening hours and makes the creator its
   * first MANAGER — and a DESIGNER too when they take appointments themselves
   * (solo operators, owner-stylists), seeded with the salon's hours.
   */
  async create(input: CreateSalonInput, creator: { id: string; name: string; canCreateBusiness: boolean }): Promise<MySalon> {
    // Business accounts are approved by a site admin (see auth/business-account.ts); the web hides the form too.
    if (!creator.canCreateBusiness) throw new ForbiddenException('This account is not approved to create a business yet');
    const taken = await this.prisma.salon.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (taken) throw new ConflictException('That URL is already taken');

    const roles: SalonRole[] = input.takesAppointments ? ['MANAGER', 'DESIGNER'] : ['MANAGER'];

    const salon = await this.prisma.$transaction(async (tx) => {
      const created = await tx.salon.create({
        data: { name: input.name, slug: input.slug, timezone: input.timezone },
      });
      const membership = await tx.salonMembership.create({
        data: { salonId: created.id, userId: creator.id, roles, displayName: creator.name },
      });
      await this.salonHours.seedDefaults(tx, created.id);
      if (input.takesAppointments) await this.salonHours.seedMemberHours(tx, created.id, membership.id);
      return created;
    });
    return { ...this.toSalon(salon), roles };
  }

  /** Salons the user belongs to, with their roles in each — powers the salon switcher. */
  async listMine(userId: string): Promise<MySalon[]> {
    const memberships = await this.prisma.salonMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { salon: true },
      orderBy: { salon: { name: 'asc' } },
    });
    return memberships.map((m) => ({ ...this.toSalon(m.salon), roles: m.roles }));
  }

  async getById(id: string): Promise<Salon> {
    const salon = await this.prisma.salon.findUnique({ where: { id } });
    if (!salon) throw new NotFoundException();
    return this.toSalon(salon);
  }

  /**
   * Public lookup for the booking page at /{slug}: the salon, its opening
   * hours, its bookable members (DESIGNER role) and their active services.
   * Deliberately selects no user fields, so an email or phone can never ride along.
   */
  async getBySlug(slug: string): Promise<PublicSalon> {
    const salon = await this.prisma.salon.findUnique({
      where: { slug },
      include: {
        hours: { orderBy: [{ weekday: 'asc' }, { startMinutes: 'asc' }], select: { weekday: true, startMinutes: true, endMinutes: true } },
        memberships: {
          where: { status: 'ACTIVE', roles: { has: 'DESIGNER' } },
          orderBy: { displayName: 'asc' },
          select: {
            id: true,
            displayName: true,
            bio: true,
            photoUrl: true,
            services: {
              where: { active: true },
              orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
              select: { id: true, name: true, category: true, description: true, priceCents: true, durationMin: true },
            },
          },
        },
      },
    });
    if (!salon) throw new NotFoundException();

    // One grouped query for the whole page. Every designer gets a score even
    // with no ratings, because the prior means one always exists.
    const scores = await this.ratings.forDesigners(salon.memberships.map((m) => m.id));
    const designers = salon.memberships.map((m) => ({ ...m, rating: scores.get(m.id)! }));

    return { ...this.toSalon(salon), hours: salon.hours, designers };
  }

  /** Managers edit identity and booking policies. */
  async update(salonId: string, input: UpdateSalonInput): Promise<Salon> {
    const salon = await this.prisma.salon.update({ where: { id: salonId }, data: input });
    return this.toSalon(salon);
  }

  private toSalon(s: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    slotIntervalMin: number;
    leadTimeMin: number;
    maxAdvanceDays: number;
    cancelWindowHours: number;
    reminderHoursBefore: number[];
    createdAt: Date;
  }): Salon {
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      timezone: s.timezone,
      slotIntervalMin: s.slotIntervalMin,
      leadTimeMin: s.leadTimeMin,
      maxAdvanceDays: s.maxAdvanceDays,
      cancelWindowHours: s.cancelWindowHours,
      reminderHoursBefore: s.reminderHoursBefore,
      createdAt: s.createdAt.toISOString(),
    };
  }
}
