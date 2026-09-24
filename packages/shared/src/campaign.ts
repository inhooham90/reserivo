import { z } from 'zod';
import { tagSchema } from './customer';

/**
 * How many clients one salon may email in a rolling 24 hours.
 *
 * Every salon sends from the same subdomain, so one salon's complaint rate is
 * everyone's deliverability. This is the blast radius, not a billing limit. It
 * doubles as the per-campaign cap: a campaign larger than what is left of the
 * day's allowance is refused outright rather than half-sent.
 */
export const CAMPAIGN_DAILY_RECIPIENT_CAP = 1000;

/** How many recipients one sweep tick sends. Bounded so a big campaign cannot monopolise the timer. */
export const CAMPAIGN_BATCH_SIZE = 100;

/**
 * Who a campaign goes to. Stored on the campaign as a snapshot, so a sent
 * campaign can always explain who it reached even after the tags move on.
 *
 * "Has an email address and has not unsubscribed" is not expressible here on
 * purpose — it is not a choice the sender gets to make.
 */
export const campaignAudienceSchema = z.object({
  /** Only clients carrying this tag. */
  tag: tagSchema.optional(),
  /** Only clients with a completed visit in the last N days. */
  visitedWithinDays: z.coerce.number().int().min(1).max(3650).optional(),
});
export type CampaignAudience = z.infer<typeof campaignAudienceSchema>;

export const campaignStatusSchema = z.enum(['QUEUED', 'SENDING', 'SENT']);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

export const createCampaignSchema = z.object({
  subject: z.string().trim().min(1).max(150),
  /** Plain text. The template adds the footer, the unsubscribe link and the postal address. */
  body: z.string().trim().min(1).max(5000),
  audience: campaignAudienceSchema.default({}),
});
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const campaignSchema = z.object({
  id: z.string(),
  subject: z.string(),
  body: z.string(),
  audience: campaignAudienceSchema,
  status: campaignStatusSchema,
  recipientCount: z.number().int(),
  sentCount: z.number().int(),
  failedCount: z.number().int(),
  sentByName: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});
export type Campaign = z.infer<typeof campaignSchema>;

/**
 * What the composer shows before sending: how many people, and a few names to
 * make the number real. Never the addresses — there is no reason to ship a
 * salon's client list into a browser to display a count.
 */
export const audiencePreviewSchema = z.object({
  total: z.number().int(),
  sampleNames: z.array(z.string()),
  /** What is left of today's allowance, so the UI can warn before the API refuses. */
  remainingToday: z.number().int(),
});
export type AudiencePreview = z.infer<typeof audiencePreviewSchema>;

/**
 * How much email someone has turned off, from narrowest to widest. Each scope
 * includes the ones before it.
 *
 *   NONE       nothing: they are on the salon's list
 *   SALON      this one salon's promotions (the one-click default)
 *   MARKETING  promotions from every salon, including ones booked with later
 *   ALL        every email, booking confirmations and reminders included
 *
 * Sign-in and password-reset links are sent whatever this says. The person
 * asked for those, and withholding them would lock them out of their account.
 * Text reminders are separate: STOP is how those end.
 */
export const UNSUBSCRIBE_SCOPES = ['NONE', 'SALON', 'MARKETING', 'ALL'] as const;
export const unsubscribeScopeSchema = z.enum(UNSUBSCRIBE_SCOPES);
export type UnsubscribeScope = z.infer<typeof unsubscribeScopeSchema>;

/** What the unsubscribe page shows. The salon's name and the current scope, nothing about the person. */
export const unsubscribeStateSchema = z.object({
  salonName: z.string(),
  scope: unsubscribeScopeSchema,
});
export type UnsubscribeState = z.infer<typeof unsubscribeStateSchema>;

export const setUnsubscribeScopeSchema = z.object({ scope: unsubscribeScopeSchema });
export type SetUnsubscribeScopeInput = z.infer<typeof setUnsubscribeScopeSchema>;
