import { z } from 'zod';

/*
 * One subscription per business. Stripe holds the authoritative Price and
 * Coupon; these constants are what the copy promises, so a change in the
 * Stripe dashboard has to be mirrored here or the page says the wrong amount.
 */

/** The plan: $29 a month. */
export const PLAN_PRICE_CENTS = 2900;
/** The introductory offer: $1 a month for the first six months (a $28-off repeating coupon). */
export const INTRO_PRICE_CENTS = 100;
export const INTRO_MONTHS = 6;
/**
 * Whether the public site advertises the intro offer (the promo banner and
 * the pricing page). Turn it off together with removing STRIPE_INTRO_COUPON_ID
 * when the promotion ends, so nothing promises a price checkout won't give.
 */
export const INTRO_OFFER_ADVERTISED = true;

/**
 * Stripe subscription statuses during which the business is paid up enough to
 * take online bookings. `past_due` is included on purpose: Stripe is still
 * retrying the card, and pausing a business on the first decline would punish
 * an expired card harder than a cancellation. When the retries run out Stripe
 * moves it to `canceled` or `unpaid` (per the dashboard's dunning settings).
 */
export const LIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'] as const;

export function isLiveSubscription(status: string | null | undefined): boolean {
  return (LIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status ?? '');
}

/**
 * What the billing pane shows.
 *   active   — subscribed and paid.
 *   pastDue  — subscribed, last charge failed, Stripe still retrying. Still bookable.
 *   grace    — no subscription yet, inside the rollout grace period. Still bookable.
 *   inactive — had a subscription; it ended. Online booking paused.
 *   none     — never subscribed. Online booking paused.
 */
export const billingStateSchema = z.enum(['active', 'pastDue', 'grace', 'inactive', 'none']);
export type BillingState = z.infer<typeof billingStateSchema>;

export const billingStatusSchema = z.object({
  /**
   * off         — no Stripe keys on this server (development): nothing charged, nothing paused.
   * ready       — payments work.
   * unavailable — keys are set but the Stripe setup is broken (see the API log). Nothing is paused meanwhile.
   */
  setup: z.enum(['off', 'ready', 'unavailable']),
  /** True only when `setup` is ready: a business then needs a subscription (or grace) to take online bookings. */
  enforced: z.boolean(),
  acceptingBookings: z.boolean(),
  state: billingStateSchema,
  graceUntil: z.string().nullable(),
  /** When the current period ends: the next charge, or the last day if cancelling. */
  currentPeriodEnd: z.string().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  /** A Stripe customer exists, so the billing portal can open. */
  hasBillingAccount: z.boolean(),
  /** The first subscription gets the intro discount, or a promo code instead. Later ones pay full price. */
  introOffer: z.boolean(),
});
export type BillingStatus = z.infer<typeof billingStatusSchema>;

export const startCheckoutSchema = z.object({
  /** A Stripe promotion code (e.g. a free six months) used *instead of* the intro discount. */
  promoCode: z
    .string()
    .trim()
    .max(64)
    .transform((v) => v || undefined)
    .optional(),
});
export type StartCheckoutInput = z.infer<typeof startCheckoutSchema>;

/** Both checkout and the billing portal answer with a Stripe-hosted URL to send the browser to. */
export const billingRedirectSchema = z.object({ url: z.string() });
export type BillingRedirect = z.infer<typeof billingRedirectSchema>;
