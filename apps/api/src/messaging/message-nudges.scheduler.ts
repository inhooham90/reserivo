import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../config/env.js';
import { MessagingService } from './messaging.service.js';

/** Runs the unread-message email sweep every minute. Same shape as RemindersScheduler. */
@Injectable()
export class MessageNudgesScheduler {
  private readonly logger = new Logger(MessageNudgesScheduler.name);
  private running = false;

  constructor(
    private readonly messaging: MessagingService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'message-nudges' })
  async run(): Promise<void> {
    if (this.config.get('NODE_ENV') === 'test') return;
    if (this.running) return;
    this.running = true;
    try {
      const sent = await this.messaging.sweepNudges();
      if (sent) this.logger.log(`emailed ${sent} unread-message nudge(s)`);
    } catch (err) {
      this.logger.error('message nudge sweep failed', err instanceof Error ? err.stack : String(err));
    } finally {
      this.running = false;
    }
  }
}
