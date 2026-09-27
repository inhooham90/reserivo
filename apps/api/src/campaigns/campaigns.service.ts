import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CAMPAIGN_BATCH_SIZE,
  CAMPAIGN_DAILY_RECIPIENT_CAP,
  campaignAudienceSchema,
  type AudiencePreview,
  type Campaign,
  type CampaignAudience,
  type CreateCampaignInput,
  type UnsubscribeScope,
  type UnsubscribeState,
} from '@reserivo/shared';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertManager } from '../tenancy/access.js';
import type { TenantContext } from '../tenancy/tenant.types.js';
import type { Prisma } from '../generated/prisma/client.js';
import { renderCampaign } from './campaign-template.js';
import { MarketingMailer } from './marketing-mailer.js';

export interface CampaignSweepResult {
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MarketingMailer,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Who a campaign would reach, as a count and a few names.
   *
   * Never the addresses: a count does not need the salon's client list shipped
   * into a browser, and the fewer places contact fields travel the better.
   */
  async preview(tenant: TenantContext, audience: CampaignAudience): Promise<AudiencePreview> {
    assertManager(tenant);
    const where = await this.audienceWhere(tenant.salonId, audience);
    const [total, sample, usedToday] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({ where, select: { name: true }, orderBy: { name: 'asc' }, take: 5 }),
      this.usedToday(tenant.salonId),
    ]);
    return {
      total,
      sampleNames: sample.map((c) => c.name),
      remainingToday: Math.max(0, CAMPAIGN_DAILY_RECIPIENT_CAP - usedToday),
    };
  }

  /**
   * Writes the campaign and every recipient row, then returns. Nothing is sent
   * here — a blast to five hundred people must not happen inside a request.
   * The sweep picks it up within the minute.
   */
  async create(tenant: TenantContext, userId: string | null, input: CreateCampaignInput): Promise<Campaign> {
    assertManager(tenant);
    const where = await this.audienceWhere(tenant.salonId, input.audience);
    const recipients = await this.prisma.customer.findMany({ where, select: { id: true, email: true } });
    if (recipients.length === 0) {
      throw new BadRequestException('Nobody matches that audience — nothing would be sent');
    }

    const remaining = CAMPAIGN_DAILY_RECIPIENT_CAP - (await this.usedToday(tenant.salonId));
    if (recipients.length > remaining) {
      throw new ConflictException(
        `That would email ${recipients.length} people, and only ${Math.max(0, remaining)} of today's allowance is left. Try again tomorrow or narrow the audience.`,
      );
    }

    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.emailCampaign.create({
        data: {
          salonId: tenant.salonId,
          createdByUserId: userId,
          subject: input.subject,
          body: input.body,
          audience: input.audience,
          recipientCount: recipients.length,
        },
        include: { createdBy: { select: { name: true } } },
      });
      await tx.emailCampaignRecipient.createMany({
        data: recipients.map((r) => ({ campaignId: created.id, customerId: r.id, email: r.email! })),
      });
      return created;
    });

    this.logger.log(`campaign ${campaign.id} queued for ${recipients.length} recipients`);
    return this.toCampaign(campaign);
  }

  async list(tenant: TenantContext): Promise<Campaign[]> {
    assertManager(tenant);
    const rows = await this.prisma.emailCampaign.findMany({
      where: { salonId: tenant.salonId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { createdBy: { select: { name: true } } },
    });
    return rows.map((r) => this.toCampaign(r));
  }

  /**
   * Sends what is owed. The claim is an UPDATE from PENDING to SENDING, which
   * only one caller can win, so a second tick — or a second dyno — silently
   * loses the race rather than emailing someone twice.
   *
   * Unlike the reminder sweep this awaits a mailer that throws, so a failure is
   * recorded as a failure instead of vanishing into a logger.
   */
  async sweep(now: Date = new Date()): Promise<CampaignSweepResult> {
    const result: CampaignSweepResult = { claimed: 0, sent: 0, failed: 0, skipped: 0 };

    const pending = await this.prisma.emailCampaignRecipient.findMany({
      where: { status: 'PENDING' },
      take: CAMPAIGN_BATCH_SIZE,
      include: {
        customer: { select: { emailOptOutAt: true, email: true, unsubscribeToken: true } },
        campaign: {
          select: {
            id: true,
            subject: true,
            body: true,
            salon: { select: { name: true } },
            createdBy: { select: { email: true } },
          },
        },
      },
    });
    if (pending.length === 0) return result;

    // Address-level opt-outs for this batch, fetched once. Either scope stops a
    // campaign: MARKETING is exactly this, and ALL is a superset of it.
    const addresses = [...new Set(pending.flatMap((r) => (r.customer.email ? [r.customer.email.toLowerCase()] : [])))];
    const suppressed = new Set(
      (await this.prisma.emailSuppression.findMany({ where: { email: { in: addresses } }, select: { email: true } })).map(
        (s) => s.email,
      ),
    );

    const touched = new Set<string>();
    for (const row of pending) {
      const claim = await this.prisma.emailCampaignRecipient.updateMany({
        where: { id: row.id, status: 'PENDING' },
        data: { status: 'SENDING' },
      });
      if (claim.count === 0) continue; // Someone else has it.
      result.claimed++;
      touched.add(row.campaign.id);

      // Checked again at send time, not only when the audience was resolved —
      // somebody may have unsubscribed between composing and sending.
      if (row.customer.emailOptOutAt !== null || !row.customer.email || suppressed.has(row.customer.email.toLowerCase())) {
        await this.prisma.emailCampaignRecipient.update({
          where: { id: row.id },
          data: { status: 'SKIPPED', error: 'Unsubscribed before this was sent' },
        });
        result.skipped++;
        continue;
      }

      try {
        await this.mailer.send({
          to: row.customer.email,
          salonName: row.campaign.salon.name,
          replyTo: row.campaign.createdBy?.email,
          unsubscribeUrl: this.unsubscribeUrl(row.customer.unsubscribeToken),
          oneClickUrl: this.oneClickUrl(row.customer.unsubscribeToken),
          mail: renderCampaign({
            salonName: row.campaign.salon.name,
            subject: row.campaign.subject,
            body: row.campaign.body,
            unsubscribeUrl: this.unsubscribeUrl(row.customer.unsubscribeToken),
          }),
        });
        await this.prisma.emailCampaignRecipient.update({
          where: { id: row.id },
          data: { status: 'SENT', sentAt: now, error: null },
        });
        result.sent++;
      } catch (err) {
        // Recorded against the recipient rather than retried. A campaign is a
        // one-shot send; silently re-mailing someone later is worse than a
        // visible failure the manager can act on.
        await this.prisma.emailCampaignRecipient.update({
          where: { id: row.id },
          data: { status: 'FAILED', error: err instanceof Error ? err.message.slice(0, 500) : String(err) },
        });
        result.failed++;
      }
    }

    for (const campaignId of touched) await this.settle(campaignId, now);

    if (result.claimed) {
      this.logger.log(`campaigns: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
    }
    return result;
  }

  /** Rolls the per-recipient outcomes up onto the campaign once nothing is left in flight. */
  private async settle(campaignId: string, now: Date): Promise<void> {
    const counts = await this.prisma.emailCampaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { _all: true },
    });
    const by = (status: string) => counts.find((c) => c.status === status)?._count._all ?? 0;
    const inFlight = by('PENDING') + by('SENDING');
    await this.prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        sentCount: by('SENT'),
        failedCount: by('FAILED'),
        status: inFlight === 0 ? 'SENT' : 'SENDING',
        completedAt: inFlight === 0 ? now : null,
      },
    });
  }

  /**
   * One-click unsubscribe (RFC 8058), and what the page does on arrival.
   * Idempotent, and it only ever widens: this salon at least, never less than
   * the person already chose. A mail client re-posting the header, or someone
   * reopening an old email, must not quietly undo "stop everything".
   */
  async unsubscribe(token: string): Promise<UnsubscribeState> {
    const customer = await this.byToken(token);
    let optedOutAt = customer.emailOptOutAt;
    if (optedOutAt === null) {
      optedOutAt = new Date();
      await this.prisma.customer.update({ where: { id: customer.id }, data: { emailOptOutAt: optedOutAt } });
    }
    return this.stateOf({ ...customer, emailOptOutAt: optedOutAt });
  }

  /**
   * The page's explicit choice, which may be narrower than what is on file —
   * NONE is the undo for an accidental click. Sets exactly what was asked.
   *
   * MARKETING and ALL are written against the address, so they reach this
   * person at every salon. That is safe to do from a token: it was delivered
   * to this inbox, which proves control of the address. Narrowing back clears
   * the address-level row, since the same person set it.
   */
  async setScope(token: string, scope: UnsubscribeScope): Promise<UnsubscribeState> {
    const customer = await this.byToken(token);
    const address = customer.email?.trim().toLowerCase() || null;
    const wide = scope === 'MARKETING' || scope === 'ALL';
    if (wide && !address) {
      // No address on file any more, so there is nothing to suppress, and
      // nothing is being sent to it either.
      throw new BadRequestException('This business no longer has an email address on file for you');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customer.id },
        data: { emailOptOutAt: scope === 'NONE' ? null : (customer.emailOptOutAt ?? new Date()) },
      });
      if (!address) return;
      if (wide) {
        await tx.emailSuppression.upsert({ where: { email: address }, create: { email: address, scope }, update: { scope } });
      } else {
        await tx.emailSuppression.deleteMany({ where: { email: address } });
      }
    });
    return { salonName: customer.salon.name, scope };
  }

  private async byToken(token: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { unsubscribeToken: token },
      select: { id: true, email: true, emailOptOutAt: true, salon: { select: { name: true } } },
    });
    if (!customer) throw new NotFoundException('That unsubscribe link is not valid');
    return customer;
  }

  /** The widest opt-out in force: an address-level row wins over this salon's flag. */
  private async stateOf(customer: {
    email: string | null;
    emailOptOutAt: Date | null;
    salon: { name: string };
  }): Promise<UnsubscribeState> {
    const address = customer.email?.trim().toLowerCase();
    const row = address ? await this.prisma.emailSuppression.findUnique({ where: { email: address } }) : null;
    return { salonName: customer.salon.name, scope: row?.scope ?? (customer.emailOptOutAt ? 'SALON' : 'NONE') };
  }

  /**
   * The audience, plus the conditions a sender does not get to choose: there
   * must be an address, and they must not have unsubscribed, either from this
   * salon or platform-wide.
   */
  private async audienceWhere(salonId: string, audience: CampaignAudience): Promise<Prisma.CustomerWhereInput> {
    const suppressed = await this.suppressedAt(salonId);
    return {
      salonId,
      email: { not: null, ...(suppressed.length ? { notIn: suppressed } : {}) },
      emailOptOutAt: null,
      ...(audience.tag ? { tags: { has: audience.tag } } : {}),
      ...(audience.visitedWithinDays
        ? {
            appointments: {
              some: {
                status: 'COMPLETED',
                startAt: { gte: new Date(Date.now() - audience.visitedWithinDays * DAY_MS) },
              },
            },
          }
        : {}),
    };
  }

  /** Recipients this salon has already queued in the last rolling 24 hours. */
  private async usedToday(salonId: string): Promise<number> {
    const agg = await this.prisma.emailCampaign.aggregate({
      where: { salonId, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
      _sum: { recipientCount: true },
    });
    return agg._sum.recipientCount ?? 0;
  }

  /**
   * This salon's client addresses that opted out platform-wide, in the exact
   * spelling stored on the customer row so that notIn matches them. The join
   * is on the lowercased address because suppressions are stored lowercased.
   */
  private async suppressedAt(salonId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ email: string }[]>`
      SELECT c.email FROM customers c
      JOIN email_suppressions s ON s.email = lower(c.email)
      WHERE c."salonId" = ${salonId}::uuid`;
    return rows.map((r) => r.email);
  }

  /** The visible link in the footer: a page that can explain and offer the wider choices. */
  private unsubscribeUrl(token: string): string {
    return `${this.config.get('WEB_URL')}/u/${token}`;
  }

  /** The List-Unsubscribe header: the API route a mail client POSTs to, no page involved. */
  private oneClickUrl(token: string): string {
    return `${this.config.get('PUBLIC_API_URL')}/public/unsubscribe/${token}`;
  }

  private toCampaign(row: {
    id: string;
    subject: string;
    body: string;
    audience: Prisma.JsonValue;
    status: string;
    recipientCount: number;
    sentCount: number;
    failedCount: number;
    createdAt: Date;
    completedAt: Date | null;
    createdBy: { name: string } | null;
  }): Campaign {
    return {
      id: row.id,
      subject: row.subject,
      body: row.body,
      // Parsed rather than cast: the column is JSON, and an old row written by
      // an earlier shape should degrade to "everyone" rather than crash a list.
      audience: campaignAudienceSchema.catch({}).parse(row.audience),
      status: row.status as Campaign['status'],
      recipientCount: row.recipientCount,
      sentCount: row.sentCount,
      failedCount: row.failedCount,
      sentByName: row.createdBy?.name ?? null,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }
}
