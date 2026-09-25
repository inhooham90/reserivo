import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { Env } from '../config/env.js';
import type { RenderedEmail } from '../notifications/templates.js';

export interface CampaignSend {
  to: string;
  salonName: string;
  /** Where replies go: the manager who sent the campaign. */
  replyTo?: string;
  /** The footer link a person clicks. Opens the unsubscribe page. */
  unsubscribeUrl: string;
  /** RFC 8058: the API route a mail client POSTs to. Must not be a page. */
  oneClickUrl: string;
  mail: RenderedEmail;
}

/**
 * Sends campaign email, and — unlike NotificationsService.emit — **throws**.
 *
 * emit is fire-and-forget by design: a delivery problem must never fail the
 * booking that triggered it. That is exactly wrong here. A campaign claims a
 * recipient row before sending, so if the send cannot report failure the claim
 * can never be released and the person is recorded as mailed when they were
 * not. Anything that awaits this gets a real answer.
 *
 * It is also a separate Resend client on a separate key and a separate
 * verified subdomain, so a salon's complaint rate cannot reach the reputation
 * that carries password resets.
 */
@Injectable()
export class MarketingMailer {
  private readonly logger = new Logger(MarketingMailer.name);
  private readonly client: Resend | null;
  private readonly from: string | undefined;

  constructor(private readonly config: ConfigService<Env, true>) {
    const key = this.config.get('RESEND_MARKETING_API_KEY');
    this.from = this.config.get('EMAIL_MARKETING_FROM');
    this.client = key && this.from ? new Resend(key) : null;
    // Same bargain NotificationsModule strikes for transactional mail: without
    // a key the feature still works end to end and writes a line per send, so
    // the flow is exercisable in development. The boot log is how an operator
    // tells the two apart.
    this.logger.log(
      this.client ? `Campaign email via Resend as ${this.from}` : 'No RESEND_MARKETING_API_KEY — campaigns are logged only',
    );
  }

  async send(send: CampaignSend): Promise<void> {
    if (!this.client || !this.from) {
      // Development and tests: one line, never the address.
      this.logger.log(`campaign → ${send.salonName} recipient (${send.mail.subject})`);
      return;
    }

    const { error } = await this.client.emails.send({
      // The display name is the salon because that is who the client knows;
      // the address is ours because ours is the verified domain.
      from: `${send.salonName} via Morrri <${this.from}>`,
      to: send.to,
      replyTo: send.replyTo,
      subject: send.mail.subject,
      text: send.mail.text,
      html: send.mail.html,
      headers: {
        // RFC 8058 one-click. Gmail and Yahoo require both of these from bulk
        // senders, and the URL must accept a POST with no confirmation step.
        'List-Unsubscribe': `<${send.oneClickUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    if (error) throw new Error(`${error.name}: ${error.message}`);
  }
}
