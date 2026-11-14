import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isLiveSubscription, PLAN_PRICE_CENTS, type BillingRedirect, type BillingStatus, type StartCheckoutInput } from '@reserivo/shared';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { acceptsOnlineBookings, billingState, type SalonBillingFields } from './billing-state.js';
import { StripeClient, StripeRequestError, type StripeEvent, type StripeSubscription } from './stripe.client.js';
import { verifyStripeSignature } from './stripe-signature.js';

/** Every event that can change a subscription. Each one re-reads it from Stripe, so arrival order does not matter. */
const SUBSCRIPTION_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
]);

/**
 * One $29/month Stripe subscription per business. Stripe owns the money and
 * the truth; the Salon row mirrors the subscription, written only by the
 * webhook, so the public booking page can decide without a network call.
 *
 * The first subscription gets a discount: either the intro coupon ($1/month
 * for six months) applied automatically, or — when the manager types one — a
 * promotion code in its place. Stripe Checkout cannot both pre-apply a
 * discount and show its own code box, so the code is entered on our page and
 * looked up here.
 */
@Injectable()
export class BillingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BillingService.name);
  /**
   * Why payments cannot work right now, or null when they can. Set by
   * `checkSetup`, which runs at boot and again (at most once a minute) while
   * there is a problem, so fixing it in Stripe needs no restart.
   */
  private problem: string | null = null;
  private checkedAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeClient,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.checkSetup();
  }

  get configured(): boolean {
    return Boolean(this.config.get('STRIPE_SECRET_KEY'));
  }

  /**
   * Whether a business needs a live subscription (or grace) to take online
   * bookings. False without Stripe keys, and false while the setup is broken:
   * if nobody can pay, pausing everybody would punish businesses for our
   * mistake, so a misconfiguration fails open and logs loudly instead.
   */
  get enforced(): boolean {
    return this.configured && this.problem === null;
  }

  /**
   * Confirms the configured price and coupon exist for this key. The usual
   * failure is a live key with test-mode IDs (or the reverse): Stripe keeps
   * the two modes apart, so every checkout would fail with "No such price".
   */
  async checkSetup(now = Date.now()): Promise<string | null> {
    if (!this.configured) return (this.problem = null);
    this.checkedAt = now;
    const key = this.config.get('STRIPE_SECRET_KEY');
    const mode = key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'live' : 'test';
    const missing = (what: string, id: string) =>
      `${what} ${id} does not exist for this ${mode}-mode key. Test-mode and live-mode objects are separate: create it in ${mode} mode or use the matching key.`;
    try {
      const priceId = this.config.get('STRIPE_PRICE_ID');
      const price = await this.stripe.getPrice(priceId).catch((err) => {
        if (err instanceof StripeRequestError && err.status === 404) throw new Error(missing('STRIPE_PRICE_ID', priceId));
        throw err;
      });
      if (!price.active) throw new Error(`STRIPE_PRICE_ID ${priceId} is archived in Stripe.`);
      if (price.unit_amount !== PLAN_PRICE_CENTS || price.currency !== 'usd' || price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1) {
        // The page would promise one amount while Stripe charges another. Worth shouting about, not worth blocking payments.
        this.logger.warn(`STRIPE_PRICE_ID ${priceId} is not $${PLAN_PRICE_CENTS / 100}/month USD; update PLAN_PRICE_CENTS in packages/shared/src/billing.ts or the price.`);
      }
      const couponId = this.config.get('STRIPE_INTRO_COUPON_ID');
      if (couponId) {
        const coupon = await this.stripe.getCoupon(couponId).catch((err) => {
          if (err instanceof StripeRequestError && err.status === 404) throw new Error(missing('STRIPE_INTRO_COUPON_ID', couponId));
          throw err;
        });
        if (!coupon.valid) throw new Error(`STRIPE_INTRO_COUPON_ID ${couponId} is no longer valid (expired or fully redeemed).`);
      }
      if (this.problem) this.logger.log('Stripe setup is fine again; online booking enforcement is back on.');
      this.problem = null;
    } catch (err) {
      this.problem =
        err instanceof StripeRequestError
          ? `Stripe refused the setup check: ${err.message}`
          : err instanceof Error && err.message
            ? err.message
            : `Stripe could not be reached (${String(err)}).`;
      this.logger.error(`Billing is unavailable: ${this.problem} Online booking is not being paused for anyone until this is fixed.`);
    }
    return this.problem;
  }

  /** Re-checks a broken setup at most once a minute, so a fix in Stripe or a transient outage recovers on its own. */
  private async recheckIfStale(now = Date.now()) {
    if (this.problem && now - this.checkedAt > 60_000) await this.checkSetup(now);
  }

  acceptsBookings(salon: SalonBillingFields, now = new Date()): boolean {
    return acceptsOnlineBookings(salon, now, this.enforced);
  }

  async status(salonId: string, now = new Date()): Promise<BillingStatus> {
    await this.recheckIfStale(now.getTime());
    const salon = await this.salon(salonId);
    return {
      setup: !this.configured ? 'off' : this.problem ? 'unavailable' : 'ready',
      enforced: this.enforced,
      acceptingBookings: this.acceptsBookings(salon, now),
      state: billingState(salon, now),
      graceUntil: salon.billingGraceUntil?.toISOString() ?? null,
      currentPeriodEnd: salon.subscriptionPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: salon.subscriptionCancelAtPeriodEnd,
      hasBillingAccount: Boolean(salon.stripeCustomerId),
      introOffer: !salon.introOfferUsedAt && Boolean(this.config.get('STRIPE_INTRO_COUPON_ID')),
    };
  }

  async startCheckout(salonId: string, input: StartCheckoutInput, manager: { email: string }): Promise<BillingRedirect> {
    await this.assertEnabled();
    const salon = await this.salon(salonId);
    if (isLiveSubscription(salon.subscriptionStatus)) {
      throw new ConflictException('This business already has a subscription. Manage it from Billing.');
    }

    const firstSubscription = !salon.introOfferUsedAt;
    let discount: Record<string, string> = {};
    if (input.promoCode) {
      if (!firstSubscription) throw new BadRequestException('Promo codes apply to a business’s first subscription only');
      const promotionCode = await this.stripe.findPromotionCode(input.promoCode);
      if (!promotionCode) throw new BadRequestException('That promo code isn’t valid');
      discount = { 'discounts[0][promotion_code]': promotionCode };
    } else if (firstSubscription && this.config.get('STRIPE_INTRO_COUPON_ID')) {
      discount = { 'discounts[0][coupon]': this.config.get('STRIPE_INTRO_COUPON_ID') };
    }

    const back = `${this.config.get('WEB_URL')}/s/${salonId}/settings/billing`;
    try {
      const session = await this.stripe.createCheckoutSession({
        mode: 'subscription',
        'line_items[0][price]': this.config.get('STRIPE_PRICE_ID'),
        'line_items[0][quantity]': '1',
        ...discount,
        // Reuse the business's Stripe customer on a re-subscribe, so its invoices stay in one place.
        ...(salon.stripeCustomerId ? { customer: salon.stripeCustomerId } : { customer_email: manager.email }),
        client_reference_id: salonId,
        // The webhook finds the business through this, on every later event too.
        'subscription_data[metadata][salonId]': salonId,
        'metadata[salonId]': salonId,
        // A free promo still collects a card (Stripe's default), so month seven bills without a second sign-up.
        success_url: `${back}?checkout=done`,
        cancel_url: back,
        locale: 'auto',
      });
      return { url: session.url };
    } catch (err) {
      if (err instanceof StripeRequestError) {
        // Our configuration (price, coupon) or Stripe's restrictions on the code; logged by the client.
        if (input.promoCode) throw new BadRequestException(err.message);
        throw new BadGatewayException('Checkout could not be started. Please try again or contact support.');
      }
      throw err;
    }
  }

  /** Stripe's hosted portal: change card, see invoices, cancel. */
  async openPortal(salonId: string): Promise<BillingRedirect> {
    await this.assertEnabled();
    const salon = await this.salon(salonId);
    if (!salon.stripeCustomerId) throw new ConflictException('This business has no billing account yet');
    try {
      return await this.stripe.createPortalSession(
        salon.stripeCustomerId,
        `${this.config.get('WEB_URL')}/s/${salonId}/settings/billing`,
      );
    } catch (err) {
      if (err instanceof StripeRequestError) throw new BadGatewayException('Billing could not be opened. Please try again or contact support.');
      throw err;
    }
  }

  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
    const secret = this.config.get('STRIPE_WEBHOOK_SECRET');
    if (!secret || !rawBody) throw new ServiceUnavailableException();
    if (!verifyStripeSignature(rawBody, signature, secret, Math.floor(Date.now() / 1000))) {
      throw new UnauthorizedException('Bad signature');
    }

    const event = JSON.parse(rawBody.toString('utf8')) as StripeEvent;
    if (!SUBSCRIPTION_EVENTS.has(event.type)) return;
    const obj = event.data.object;
    const subscriptionId =
      obj.object === 'subscription' ? obj.id : typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id;
    if (!subscriptionId) return;
    // Re-read rather than trust the payload: events arrive out of order, and the
    // subscription as it is now is the only state worth writing.
    await this.syncSubscription(await this.stripe.getSubscription(subscriptionId));
  }

  async syncSubscription(sub: StripeSubscription, now = new Date()): Promise<void> {
    const salonId = sub.metadata?.salonId;
    const salon = salonId
      ? await this.prisma.salon.findUnique({ where: { id: salonId } })
      : await this.prisma.salon.findUnique({ where: { stripeSubscriptionId: sub.id } });
    if (!salon) {
      this.logger.warn(`subscription ${sub.id} matches no business; ignored`);
      return;
    }
    // Two checkouts opened in two tabs can both complete. The live one wins;
    // a dead subscription never overwrites a live one.
    if (salon.stripeSubscriptionId && salon.stripeSubscriptionId !== sub.id && isLiveSubscription(salon.subscriptionStatus) && !isLiveSubscription(sub.status)) {
      return;
    }

    const periodEnd = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end;
    await this.prisma.salon.update({
      where: { id: salon.id },
      data: {
        stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
        stripeSubscriptionId: sub.id,
        subscriptionStatus: sub.status,
        subscriptionPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        subscriptionCancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at),
        introOfferUsedAt: salon.introOfferUsedAt ?? now,
      },
    });
    this.logger.log(`business ${salon.id}: subscription ${sub.id} is ${sub.status}`);
  }

  private async assertEnabled() {
    if (!this.configured) throw new ServiceUnavailableException('Billing is not set up on this server');
    await this.recheckIfStale();
    // The detail is in the server log; a manager can do nothing with "No such price".
    if (this.problem) throw new ServiceUnavailableException('Payments aren’t available right now. Please try again later or contact support.');
  }

  private async salon(id: string) {
    const salon = await this.prisma.salon.findUnique({ where: { id } });
    if (!salon) throw new NotFoundException('Business not found');
    return salon;
  }
}
