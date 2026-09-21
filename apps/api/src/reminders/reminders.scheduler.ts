import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../config/env.js';
import { RemindersService } from './reminders.service.js';

/**
 * Runs the sweep on a timer.
 *
 * A cron plus a unique index beats a queue of delayed jobs here: reschedules
 * and cancellations need no bookkeeping, a restart loses nothing, and two
 * instances racing is settled by the database rather than by a lock. If
 * reminders ever need retry backoff or their own workers, this is the seam to
 * swap for BullMQ — Redis is already in compose.
 */
@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name);
  private running = false;

  constructor(
    private readonly reminders: RemindersService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'appointment-reminders' })
  async run(): Promise<void> {
    if (this.config.get('NODE_ENV') === 'test') return;
    // A slow sweep must not overlap itself.
    if (this.running) {
      this.logger.warn('previous reminder sweep still running; skipping this tick');
      return;
    }
    this.running = true;
    try {
      await this.reminders.sweep();
    } catch (err) {
      this.logger.error('reminder sweep failed', err instanceof Error ? err.stack : String(err));
    } finally {
      this.running = false;
    }
  }
}
