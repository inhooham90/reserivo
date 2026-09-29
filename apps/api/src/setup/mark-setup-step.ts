import type { StoredSetupStep } from '@reserivo/shared';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * Records that a member finished a setup step by saving the screen it points
 * at. A plain function over Prisma rather than a service, so the salon, hours
 * and availability services can call it without importing each other's modules.
 * The `NOT has` filter keeps the array a set, and a missing member is a no-op.
 */
export async function markSetupStep(prisma: PrismaService, membershipId: string | undefined, step: StoredSetupStep): Promise<void> {
  if (!membershipId) return;
  await prisma.salonMembership.updateMany({
    where: { id: membershipId, NOT: { setupSteps: { has: step } } },
    data: { setupSteps: { push: step } },
  });
}
