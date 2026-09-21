import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

export interface SmsTransport {
  send(to: string, body: string): Promise<void>;
}

export const SMS_TRANSPORT = Symbol('SMS_TRANSPORT');

/** Twilio's code for a recipient who has replied STOP. */
export const SMS_UNSUBSCRIBED = 21610;

/**
 * The provider rejected the message for a reason that will not change —
 * a blocked recipient, an invalid or non-mobile number. Retrying it every
 * five minutes until the appointment passes helps nobody.
 */
export class SmsPermanentError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = 'SmsPermanentError';
  }
}

/** Development and tests: prints instead of spending money. */
@Injectable()
export class LogSmsTransport implements SmsTransport {
  private readonly logger = new Logger('Sms');

  async send(to: string, body: string): Promise<void> {
    this.logger.log(`sms → ${to}: ${body}`);
  }
}

/**
 * Twilio's REST API is a single form POST, so this calls it directly rather
 * than pulling in the SDK — one less dependency in the runtime image.
 *
 * US delivery also needs the sending number registered for A2P 10DLC, or
 * carriers filter the messages. That is account setup, not code.
 */
@Injectable()
export class TwilioSmsTransport implements SmsTransport {
  private readonly logger = new Logger('Sms');

  constructor(private readonly config: ConfigService<Env, true>) {}

  async send(to: string, body: string): Promise<void> {
    const sid = this.config.get('TWILIO_ACCOUNT_SID');
    const auth = Buffer.from(`${sid}:${this.config.get('TWILIO_AUTH_TOKEN')}`).toString('base64');

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: this.config.get('TWILIO_FROM_NUMBER'), Body: body }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { code?: number; message?: string } | null;
      const message = body?.message ?? `HTTP ${res.status}`;
      // 4xx is about this request or this recipient and will not fix itself;
      // 5xx is Twilio having a moment, so let the next sweep try again.
      if (res.status < 500) throw new SmsPermanentError(body?.code ?? 0, message);
      throw new Error(`Twilio ${res.status}: ${message}`);
    }
    this.logger.log(`sms sent → ${to.slice(0, 6)}…`);
  }
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    @Inject(SMS_TRANSPORT) private readonly transport: SmsTransport,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** False until Twilio is configured, so the reminder sweep skips SMS entirely. */
  get enabled(): boolean {
    return Boolean(this.config.get('TWILIO_ACCOUNT_SID') && this.config.get('TWILIO_FROM_NUMBER'));
  }

  /** Throws on failure: the caller decides whether to retry, unlike fire-and-forget email. */
  send(to: string, body: string): Promise<void> {
    return this.transport.send(to, body);
  }

  logSkip(reason: string): void {
    this.logger.debug(`sms skipped: ${reason}`);
  }
}
