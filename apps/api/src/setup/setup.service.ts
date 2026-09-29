import { Injectable, NotFoundException } from '@nestjs/common';
import { setupStepsFor, type SetupProgress, type SetupStep, type UpdateSetupInput } from '@reserivo/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { TenantContext } from '../tenancy/tenant.types.js';

/** Stored steps that describe the business rather than the person. */
const BUSINESS_STEPS = ['business', 'businessHours', 'team'] as const;

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The caller's own guide. Stored steps come off the membership; the rest are
   * read from the rows they describe, so deleting every service puts that step
   * back rather than leaving a stale tick.
   */
  async progress(tenant: TenantContext): Promise<SetupProgress> {
    // A site admin looking at a business they do not belong to has nothing to set up.
    if (!tenant.membership) return { steps: [], hidden: true };
    const member = await this.prisma.salonMembership.findUnique({
      where: { id: tenant.membership.id },
      select: { id: true, roles: true, bio: true, setupSteps: true, setupHiddenAt: true },
    });
    if (!member) throw new NotFoundException('Membership not found');

    const keys = setupStepsFor(member.roles);
    const [services, members, invitations, colleagues] = await Promise.all([
      keys.includes('services') ? this.prisma.service.count({ where: { designerId: member.id } }) : 0,
      keys.includes('team') ? this.prisma.salonMembership.count({ where: { salonId: tenant.salonId, status: 'ACTIVE' } }) : 0,
      keys.includes('team')
        ? this.prisma.invitation.count({
            where: { salonId: tenant.salonId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
          })
        : 0,
      this.prisma.salonMembership.findMany({
        where: { salonId: tenant.salonId, setupSteps: { hasSome: [...BUSINESS_STEPS] } },
        select: { setupSteps: true },
      }),
    ]);
    // The business's own steps are done once anyone has done them: a second
    // manager should not be sent to re-check hours the owner already set.
    const stored = new Set([
      ...member.setupSteps,
      ...colleagues.flatMap((c) => c.setupSteps.filter((s) => (BUSINESS_STEPS as readonly string[]).includes(s))),
    ]);
    const done: Record<SetupStep, boolean> = {
      business: stored.has('business'),
      businessHours: stored.has('businessHours'),
      myHours: stored.has('myHours'),
      services: services > 0,
      profile: Boolean(member.bio?.trim()),
      // An invitation sent counts: the owner has done their part.
      team: stored.has('team') || members > 1 || invitations > 0,
      share: stored.has('share'),
    };
    return { steps: keys.map((key) => ({ key, done: done[key] })), hidden: member.setupHiddenAt !== null };
  }

  async update(tenant: TenantContext, input: UpdateSetupInput): Promise<SetupProgress> {
    if (!tenant.membership) throw new NotFoundException('You are not a member of this business');
    const member = await this.prisma.salonMembership.findUniqueOrThrow({
      where: { id: tenant.membership.id },
      select: { setupSteps: true },
    });
    await this.prisma.salonMembership.update({
      where: { id: tenant.membership.id },
      data: {
        ...(input.done ? { setupSteps: [...new Set([...member.setupSteps, ...input.done])] } : {}),
        ...(input.hidden !== undefined ? { setupHiddenAt: input.hidden ? new Date() : null } : {}),
      },
    });
    return this.progress(tenant);
  }
}
