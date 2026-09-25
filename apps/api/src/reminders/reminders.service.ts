import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BLOCKING_STATUSES } from '@reserivo/shared';
import type { Env } from '../config/env.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SMS_UNSUBSCRIBED, SmsPermanentError, SmsService } from '../notifications/sms.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ReminderChannel } from '../generated/prisma/enums.js';

export interface SweepResult {
  considered: number;
  sent: number;
  failed: number;
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly sms: SmsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Finds appointments whose reminder time has arrived and sends what is still
   * owed. The database is the source of truth — there is no queue of scheduled
   * jobs to keep in step with reschedules, and nothing is lost if the process
   * restarts. Safe to run as often as you like.
   */
  async sweep(now: Date = new Date()): Promise<SweepResult> {
    // Only look as far ahead as the most generous salon needs.
    const leads = await this.prisma.salon.findMany({ select: { reminderHoursBefore: true } });
    const maxLead = Math.max(0, ...leads.flatMap((s) => s.reminderHoursBefore));
    if (maxLead === 0) return { considered: 0, sent: 0, failed: 0 };

    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: { in: [...BLOCKING_STATUSES] },
        startAt: { gt: now, lte: new Date(now.getTime() + maxLead * 3_600_000) },
      },
      include: {
        salon: { select: { id: true, name: true, slug: true, timezone: true, reminderHoursBefore: true } },
        designer: { select: { displayName: true } },
        customer: { select: { name: true, email: true, phone: true, smsConsentAt: true } },
        reminders: { select: { hoursBefore: true, channel: true } },
      },
    });

    const result: SweepResult = { considered: appointments.length, sent: 0, failed: 0 };

    for (const appt of appointments) {
      for (const hoursBefore of appt.salon.reminderHoursBefore) {
        const dueAt = new Date(appt.startAt.getTime() - hoursBefore * 3_600_000);
        if (dueAt > now) continue;
        // Booked after this reminder would have gone out — they already know.
        if (appt.createdAt >= dueAt) continue;

        for (const channel of ['EMAIL', 'SMS'] as const) {
          if (appt.reminders.some((r) => r.hoursBefore === hoursBefore && r.channel === channel)) continue;
          if (!this.canSend(channel, appt.customer)) continue;

          const ok = await this.deliver(channel, hoursBefore, appt);
          if (ok) result.sent++;
          else result.failed++;
        }
      }
    }

    if (result.sent || result.failed) {
      this.logger.log(`reminders: ${result.sent} sent, ${result.failed} failed, ${result.considered} considered`);
    }
    return result;
  }

  private canSend(
    channel: ReminderChannel,
    customer: { email: string | null; phone: string | null; smsConsentAt: Date | null },
  ): boolean {
    if (channel === 'EMAIL') return Boolean(customer.email);
    // No consent, no number, or no provider configured — never text.
    return this.sms.enabled && Boolean(customer.phone) && customer.smsConsentAt !== null;
  }

  /**
   * Claims the reminder row first, then sends. The unique index makes the
   * claim the lock, so a second sweep — or a second instance — silently loses
   * the race instead of sending twice. A failed send releases the claim so the
   * next sweep can try again.
   */
  private async deliver(
    channel: ReminderChannel,
    hoursBefore: number,
    appt: {
      id: string;
      customerId: string;
      startAt: Date;
      serviceNameSnapshot: string;
      salon: { id: string; name: string; slug: string; timezone: string };
      designer: { displayName: string };
      customer: { name: string; email: string | null; phone: string | null };
    },
  ): Promise<boolean> {
    let claimId: string;
    try {
      const claim = await this.prisma.appointmentReminder.create({
        data: { appointmentId: appt.id, hoursBefore, channel },
      });
      claimId = claim.id;
    } catch {
      return false; // Someone else already has it; not an error.
    }

    const link = `${this.config.get('WEB_URL')}/appointments`;
    try {
      if (channel === 'EMAIL') {
        this.notifications.emit({
          type: 'appointment.reminder',
          to: { email: appt.customer.email, name: appt.customer.name },
          data: {
            appointmentId: appt.id,
            salonName: appt.salon.name,
            designerName: appt.designer.displayName,
            serviceName: appt.serviceNameSnapshot,
            startAt: appt.startAt.toISOString(),
            timezone: appt.salon.timezone,
            hoursBefore,
            link,
          },
        });
      } else {
        await this.sms.send(appt.customer.phone!, this.smsBody(appt, hoursBefore));
      }
      return true;
    } catch (err) {
      if (err instanceof SmsPermanentError) {
        // Keep the claim: this will never succeed, so stop asking. When they
        // replied STOP, drop the consent too — the carrier has already blocked
        // us, and our record should say the same thing.
        if (err.code === SMS_UNSUBSCRIBED) {
          await this.prisma.customer.update({ where: { id: appt.customerId }, data: { smsConsentAt: null } });
          this.logger.log(`customer ${appt.customerId} has opted out of texts; consent cleared`);
        } else {
          this.logger.warn(`sms for ${appt.id} rejected permanently (${err.code}): ${err.message}`);
        }
        return false;
      }
      // Transient: release the claim so the next sweep retries.
      await this.prisma.appointmentReminder.delete({ where: { id: claimId } }).catch(() => undefined);
      this.logger.error(
        `reminder ${channel} for ${appt.id} failed`,
        err instanceof Error ? err.message : String(err),
      );
      return false;
    }
  }

  /**
   * Kept short: one segment is 160 characters, and every segment is billed.
   *
   * "(via Morrri)" is not branding. The A2P 10DLC campaign is registered to
   * Morrri, while the message announces the salon, and a carrier comparing a
   * sample message against the registered brand has to find the brand in it.
   * Change this and change the samples filed with Twilio (deploy/A2P-10DLC.md).
   */
  private smsBody(
    appt: { startAt: Date; serviceNameSnapshot: string; salon: { name: string; timezone: string }; designer: { displayName: string } },
    hoursBefore: number,
  ): string {
    const at = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: appt.salon.timezone,
    }).format(appt.startAt);
    const lead = hoursBefore >= 24 ? 'tomorrow' : `in ${hoursBefore}h`;
    return `${appt.salon.name} (via Morrri): reminder, your ${appt.serviceNameSnapshot} with ${appt.designer.displayName} is ${lead} (${at}). Reply STOP to opt out.`;
  }
}
