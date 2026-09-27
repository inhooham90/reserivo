import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Approves an account to create businesses, as a site admin would. Freshly
 * registered accounts are personal, so every spec that creates a salon calls
 * this first. Registration trims and lowercases the address; so does this.
 */
export async function approveBusiness(app: INestApplication, email: string): Promise<void> {
  await app
    .get(PrismaService)
    .user.update({ where: { email: email.trim().toLowerCase() }, data: { businessApprovedAt: new Date() } });
}
