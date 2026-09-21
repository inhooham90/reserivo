import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { Env } from '../config/env.js';
import { NOTIFICATION_TRANSPORT, type NotificationEvent, type NotificationTransport } from './notifications.types.js';
import { render } from './templates.js';

export type { NotificationEvent, NotificationTransport } from './notifications.types.js';

/** Development transport: one line per event, never the recipient address. */
@Injectable()
export class LogTransport implements NotificationTransport {
  private readonly logger = new Logger('Notifications');

  async send(event: NotificationEvent): Promise<void> {
    // This transport is only chosen when no Resend key is set — development
    // and tests — so printing the link is safe here and is the only way to
    // follow a confirmation or reset locally. Production uses ResendTransport.
    const ref = 'link' in event.data ? event.data.link : event.data.appointmentId;
    this.logger.log(`${event.type} → ${event.to.name} ${ref}`);
  }
}

/** Production transport. Skips recipients without an email address. */
@Injectable()
export class ResendTransport implements NotificationTransport {
  private readonly logger = new Logger('Notifications');
  private readonly client: Resend;
  private readonly from: string;
  private readonly webUrl: string;

  constructor(config: ConfigService<Env, true>) {
    this.client = new Resend(config.get('RESEND_API_KEY'));
    this.from = config.get('EMAIL_FROM');
    this.webUrl = config.get('WEB_URL');
  }

  async send(event: NotificationEvent): Promise<void> {
    if (!event.to.email) return;
    const mail = render(event, this.webUrl);
    const { error } = await this.client.emails.send({ from: this.from, to: event.to.email, ...mail });
    if (error) throw new Error(`${error.name}: ${error.message}`);
    this.logger.log(`${event.type} emailed → ${event.to.name}`);
  }
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@Inject(NOTIFICATION_TRANSPORT) private readonly transport: NotificationTransport) {}

  /** Fire-and-forget: a delivery problem must never fail the action that triggered it. */
  emit(event: NotificationEvent): void {
    void this.transport.send(event).catch((err: unknown) => {
      this.logger.error(`Failed to send ${event.type}`, err instanceof Error ? err.stack : String(err));
    });
  }
}
