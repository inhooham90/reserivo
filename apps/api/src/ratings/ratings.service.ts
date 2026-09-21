import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { toDesignerRating, type DesignerRating, type MyRating } from '@reserivo/shared';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Client ratings of designers.
 *
 * Two rules hold this together, and both are enforced rather than trusted:
 *
 * 1. **You can only rate a designer who has actually finished a service for
 *    you.** Without that the score is a comment box anyone can stuff. The
 *    check is a COMPLETED appointment, which is the only record that says the
 *    service really happened.
 * 2. **One client, one rating per designer.** A unique index does this, so
 *    rating again overwrites instead of stacking. Per-visit ratings would let
 *    one regular with twenty appointments outvote twenty first-time clients.
 *
 * Nothing is denormalised onto the membership. The score is a weighted mean
 * computed from an aggregate query on read, so it can never drift out of step
 * with the rows behind it.
 */
@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Scores for a set of designers, keyed by membership id.
   *
   * Every designer gets an entry even with no ratings at all — the prior means
   * a score always exists — so callers never have to special-case a missing key.
   */
  async forDesigners(designerIds: string[]): Promise<Map<string, DesignerRating>> {
    const scores = new Map<string, DesignerRating>();
    if (designerIds.length === 0) return scores;

    for (const id of designerIds) scores.set(id, toDesignerRating(0, 0));

    // One grouped query for the whole page rather than one per designer.
    const rows = await this.prisma.designerRating.groupBy({
      by: ['designerId'],
      where: { designerId: { in: designerIds } },
      _count: { stars: true },
      _sum: { stars: true },
    });
    for (const row of rows) {
      scores.set(row.designerId, toDesignerRating(row._count.stars, row._sum.stars ?? 0));
    }
    return scores;
  }

  /** What this client has already said, so the UI can show it back to them. */
  async listMine(user: AuthenticatedUser): Promise<MyRating[]> {
    const rows = await this.prisma.designerRating.findMany({
      where: { customer: { userId: user.id } },
      select: { designerId: true, stars: true },
    });
    return rows;
  }

  /**
   * Records or replaces this client's rating of one designer.
   *
   * The customer is resolved through `userId` only, never by matching an email
   * address: an unconfirmed address proves nothing about who owns it, and
   * letting it through here would let someone rate using a stranger's history.
   */
  async rate(user: AuthenticatedUser, designerId: string, stars: number): Promise<MyRating> {
    const designer = await this.prisma.salonMembership.findFirst({
      where: { id: designerId, status: 'ACTIVE', roles: { has: 'DESIGNER' } },
      select: { id: true, salonId: true },
    });
    if (!designer) throw new NotFoundException('That designer does not take appointments');

    const customer = await this.prisma.customer.findFirst({
      where: { salonId: designer.salonId, userId: user.id },
      select: { id: true },
    });
    if (!customer) throw new ForbiddenException('You can rate a designer once they have finished a service for you');

    const completed = await this.prisma.appointment.count({
      where: { customerId: customer.id, designerId: designer.id, status: 'COMPLETED' },
    });
    if (completed === 0) {
      throw new ForbiddenException('You can rate a designer once they have finished a service for you');
    }

    const row = await this.prisma.designerRating.upsert({
      where: { designerId_customerId: { designerId: designer.id, customerId: customer.id } },
      create: { salonId: designer.salonId, designerId: designer.id, customerId: customer.id, stars },
      update: { stars },
      select: { designerId: true, stars: true },
    });
    return row;
  }
}
