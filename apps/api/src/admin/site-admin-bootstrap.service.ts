import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { siteAdminEmails, type Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Grants site admin to the accounts named in SITE_ADMIN_EMAILS that already
 * exist. Newcomers on the list are handled at registration instead.
 *
 * Grant-only and idempotent: it never demotes anyone, so removing an address
 * from the list — or promoting someone by hand in SQL — is not undone here.
 */
@Injectable()
export class SiteAdminBootstrap implements OnModuleInit {
  private readonly logger = new Logger(SiteAdminBootstrap.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    const emails = siteAdminEmails(this.config.get('SITE_ADMIN_EMAILS'));
    if (emails.length === 0) return;

    const { count } = await this.prisma.user.updateMany({
      where: { email: { in: emails }, isSiteAdmin: false },
      data: { isSiteAdmin: true },
    });
    if (count > 0) this.logger.log(`Granted site admin to ${count} configured account(s)`);
  }
}
