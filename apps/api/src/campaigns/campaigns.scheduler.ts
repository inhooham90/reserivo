import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../config/env.js';
import { CampaignsService } from './campaigns.service.js';

/**
 * Drains queued campaign recipients on a timer.
 *
 * Same shape as RemindersScheduler — cron plus a database claim, no queue.
 * Every minute rather than every five, because a manager who just pressed Send
 * is watching the screen, and each tick is bounded to CAMPAIGN_BATCH_SIZE so a
 * thousand-person campaign drains over several ticks instead of blocking one.
 */
@Injectable()
export class CampaignsScheduler {
  private readonly logger = new Logger(CampaignsScheduler.name);
  private running = false;

  constructor(
    private readonly campaigns: CampaignsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'email-campaigns' })
  async run(): Promise<void> {
    if (this.config.get('NODE_ENV') === 'test') return;
    // A slow sweep must not overlap itself.
    if (this.running) {
      this.logger.warn('previous campaign sweep still running; skipping this tick');
      return;
    }
    this.running = true;
    try {
      await this.campaigns.sweep();
    } catch (err) {
      this.logger.error('campaign sweep failed', err instanceof Error ? err.stack : String(err));
    } finally {
      this.running = false;
    }
  }
}
