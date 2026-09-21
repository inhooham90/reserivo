import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateSalonInput, MySalon, Salon } from '@reserivo/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SalonsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates the salon and makes the creator its first MANAGER, atomically. */
  async create(input: CreateSalonInput, creator: { id: string; name: string }): Promise<MySalon> {
    const taken = await this.prisma.salon.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (taken) throw new ConflictException('That URL is already taken');

    const salon = await this.prisma.salon.create({
      data: {
        name: input.name,
        slug: input.slug,
        timezone: input.timezone,
        memberships: {
          create: { userId: creator.id, role: 'MANAGER', displayName: creator.name },
        },
      },
    });
    return { ...this.toSalon(salon), role: 'MANAGER' };
  }

  /** Salons the user belongs to, with their role in each — powers the salon switcher. */
  async listMine(userId: string): Promise<MySalon[]> {
    const memberships = await this.prisma.salonMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { salon: true },
      orderBy: { salon: { name: 'asc' } },
    });
    return memberships.map((m) => ({ ...this.toSalon(m.salon), role: m.role }));
  }

  async getById(id: string): Promise<Salon> {
    const salon = await this.prisma.salon.findUnique({ where: { id } });
    if (!salon) throw new NotFoundException();
    return this.toSalon(salon);
  }

  /** Public lookup for the booking page at /{slug}. */
  async getBySlug(slug: string): Promise<Salon> {
    const salon = await this.prisma.salon.findUnique({ where: { slug } });
    if (!salon) throw new NotFoundException();
    return this.toSalon(salon);
  }

  private toSalon(s: { id: string; name: string; slug: string; timezone: string; createdAt: Date }): Salon {
    return { id: s.id, name: s.name, slug: s.slug, timezone: s.timezone, createdAt: s.createdAt.toISOString() };
  }
}
