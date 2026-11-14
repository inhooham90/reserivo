import { createHmac } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { acceptsOnlineBookings, billingState, type SalonBillingFields } from './billing-state.js';
import { BillingService } from './billing.service.js';
import { StripeRequestError, type StripeClient } from './stripe.client.js';
import { verifyStripeSignature } from './stripe-signature.js';

const NOW = new Date('2026-11-13T12:00:00Z');
const blank: SalonBillingFields = { stripeSubscriptionId: null, subscriptionStatus: null, billingGraceUntil: null };

describe('billingState / acceptsOnlineBookings', () => {
  const cases: [string, Partial<SalonBillingFields>, string, boolean][] = [
    ['never subscribed', {}, 'none', false],
    ['inside grace', { billingGraceUntil: new Date('2026-11-20T00:00:00Z') }, 'grace', true],
    ['grace over', { billingGraceUntil: new Date('2026-11-01T00:00:00Z') }, 'none', false],
    ['active', { stripeSubscriptionId: 'sub_1', subscriptionStatus: 'active' }, 'active', true],
    ['trialing', { stripeSubscriptionId: 'sub_1', subscriptionStatus: 'trialing' }, 'active', true],
    // Stripe is still retrying the card; pausing on the first decline would be harsher than a cancellation.
    ['past due', { stripeSubscriptionId: 'sub_1', subscriptionStatus: 'past_due' }, 'pastDue', true],
    ['retries exhausted', { stripeSubscriptionId: 'sub_1', subscriptionStatus: 'unpaid' }, 'inactive', false],
    ['cancelled', { stripeSubscriptionId: 'sub_1', subscriptionStatus: 'canceled' }, 'inactive', false],
    ['cancelled, still in grace', { stripeSubscriptionId: 'sub_1', subscriptionStatus: 'canceled', billingGraceUntil: new Date('2026-12-01') }, 'grace', true],
  ];
  it.each(cases)('%s', (_, fields, state, accepts) => {
    const salon = { ...blank, ...fields };
    expect(billingState(salon, NOW)).toBe(state);
    expect(acceptsOnlineBookings(salon, NOW, true)).toBe(accepts);
  });

  it('never pauses anyone while billing is off', () => {
    expect(acceptsOnlineBookings(blank, NOW, false)).toBe(true);
  });
});

describe('verifyStripeSignature', () => {
  const secret = 'whsec_test';
  const body = Buffer.from('{"id":"evt_1","type":"customer.subscription.updated"}');
  const t = 1_700_000_000;
  const sign = (ts: number, b = body, s = secret) => createHmac('sha256', s).update(`${ts}.`).update(b).digest('hex');

  it('accepts a correct signature', () => {
    expect(verifyStripeSignature(body, `t=${t},v1=${sign(t)}`, secret, t + 10)).toBe(true);
  });
  it('accepts when any v1 matches, as while a secret is being rolled', () => {
    expect(verifyStripeSignature(body, `t=${t},v1=${sign(t, body, 'old')},v1=${sign(t)}`, secret, t)).toBe(true);
  });
  it('refuses a tampered body', () => {
    expect(verifyStripeSignature(Buffer.from('{"id":"evt_2"}'), `t=${t},v1=${sign(t)}`, secret, t)).toBe(false);
  });
  it('refuses a replay older than five minutes', () => {
    expect(verifyStripeSignature(body, `t=${t},v1=${sign(t)}`, secret, t + 301)).toBe(false);
  });
  it('refuses a missing or malformed header', () => {
    expect(verifyStripeSignature(body, undefined, secret, t)).toBe(false);
    expect(verifyStripeSignature(body, 'garbage', secret, t)).toBe(false);
    expect(verifyStripeSignature(body, `t=${t},v1=zz`, secret, t)).toBe(false);
  });
});

describe('BillingService checkout discounts', () => {
  const env: Partial<Env> = {
    STRIPE_SECRET_KEY: 'sk_test',
    STRIPE_PRICE_ID: 'price_29',
    STRIPE_INTRO_COUPON_ID: 'coupon_intro',
    STRIPE_WEBHOOK_SECRET: 'whsec',
    WEB_URL: 'https://morrri.com',
  };
  const config = { get: (k: keyof Env) => env[k] } as unknown as ConfigService<Env, true>;

  function setup(salon: Record<string, unknown>, promo: string | null = 'promo_free6') {
    const prisma = { salon: { findUnique: vi.fn().mockResolvedValue({ id: 's1', ...blank, stripeCustomerId: null, introOfferUsedAt: null, ...salon }) } };
    const stripe = {
      createCheckoutSession: vi.fn().mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/x' }),
      findPromotionCode: vi.fn().mockResolvedValue(promo),
    };
    const service = new BillingService(prisma as unknown as PrismaService, stripe as unknown as StripeClient, config);
    return { service, stripe };
  }

  it('applies the $1 × 6 coupon to a first subscription automatically', async () => {
    const { service, stripe } = setup({});
    await service.startCheckout('s1', {}, { email: 'o@x.test' });
    const params = stripe.createCheckoutSession.mock.calls[0][0];
    expect(params['discounts[0][coupon]']).toBe('coupon_intro');
    expect(params['line_items[0][price]']).toBe('price_29');
    expect(params['subscription_data[metadata][salonId]']).toBe('s1');
    expect(params.customer_email).toBe('o@x.test');
  });

  it('uses a promo code instead of the coupon, never both', async () => {
    const { service, stripe } = setup({});
    await service.startCheckout('s1', { promoCode: 'FREE6' }, { email: 'o@x.test' });
    const params = stripe.createCheckoutSession.mock.calls[0][0];
    expect(stripe.findPromotionCode).toHaveBeenCalledWith('FREE6');
    expect(params['discounts[0][promotion_code]']).toBe('promo_free6');
    expect(params['discounts[0][coupon]']).toBeUndefined();
  });

  it('refuses an unknown promo code', async () => {
    const { service } = setup({}, null);
    await expect(service.startCheckout('s1', { promoCode: 'NOPE' }, { email: 'o@x.test' })).rejects.toThrow('isn’t valid');
  });

  it('charges full price when re-subscribing, and reuses the Stripe customer', async () => {
    const { service, stripe } = setup({ introOfferUsedAt: new Date(), stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_old', subscriptionStatus: 'canceled' });
    await service.startCheckout('s1', {}, { email: 'o@x.test' });
    const params = stripe.createCheckoutSession.mock.calls[0][0];
    expect(Object.keys(params).some((k) => k.startsWith('discounts'))).toBe(false);
    expect(params.customer).toBe('cus_1');
  });

  it('refuses a promo code on a re-subscribe', async () => {
    const { service } = setup({ introOfferUsedAt: new Date() });
    await expect(service.startCheckout('s1', { promoCode: 'FREE6' }, { email: 'o@x.test' })).rejects.toThrow('first subscription');
  });

  it('refuses a second subscription while one is live', async () => {
    const { service } = setup({ stripeSubscriptionId: 'sub_1', subscriptionStatus: 'active' });
    await expect(service.startCheckout('s1', {}, { email: 'o@x.test' })).rejects.toThrow('already has a subscription');
  });
});

describe('BillingService setup check', () => {
  const base: Partial<Env> = { STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_PRICE_ID: 'price_test', STRIPE_INTRO_COUPON_ID: 'intro-6mo', STRIPE_WEBHOOK_SECRET: 'whsec' };
  const price = { id: 'price_test', active: true, currency: 'usd', unit_amount: 2900, recurring: { interval: 'month', interval_count: 1 } };

  function make(stripe: Partial<Record<keyof StripeClient, unknown>>, env = base) {
    const config = { get: (k: keyof Env) => env[k] } as unknown as ConfigService<Env, true>;
    const prisma = { salon: { findUnique: vi.fn().mockResolvedValue({ id: 's1', ...blank, stripeCustomerId: null, introOfferUsedAt: null, subscriptionPeriodEnd: null, subscriptionCancelAtPeriodEnd: false }) } };
    return new BillingService(prisma as unknown as PrismaService, stripe as unknown as StripeClient, config);
  }
  const notFound = () => Promise.reject(new StripeRequestError(404, 'resource_missing', 'No such price'));

  it('a live key with a test-mode price is unavailable, and fails open rather than pausing everyone', async () => {
    const service = make({ getPrice: vi.fn(notFound), getCoupon: vi.fn() });
    expect(await service.checkSetup()).toMatch(/does not exist for this live-mode key/);
    expect(service.enforced).toBe(false);
    expect(service.acceptsBookings(blank)).toBe(true);
    expect((await service.status('s1')).setup).toBe('unavailable');
    await expect(service.startCheckout('s1', {}, { email: 'o@x.test' })).rejects.toThrow('aren’t available right now');
  });

  it('flags a missing intro coupon', async () => {
    const service = make({ getPrice: vi.fn().mockResolvedValue(price), getCoupon: vi.fn(notFound) });
    expect(await service.checkSetup()).toMatch(/STRIPE_INTRO_COUPON_ID intro-6mo does not exist/);
  });

  it('recovers on its own once Stripe is fixed, re-checking at most once a minute', async () => {
    const getPrice = vi.fn().mockImplementationOnce(notFound).mockResolvedValue(price);
    const service = make({ getPrice, getCoupon: vi.fn().mockResolvedValue({ id: 'intro-6mo', valid: true }) });
    await service.checkSetup(0);
    expect(service.enforced).toBe(false);
    await service.status('s1', new Date(30_000));
    expect(getPrice).toHaveBeenCalledTimes(1);
    const s = await service.status('s1', new Date(61_000));
    expect(s.setup).toBe('ready');
    expect(service.enforced).toBe(true);
  });

  it('is off without a key and never calls Stripe', async () => {
    const getPrice = vi.fn();
    const service = make({ getPrice }, {});
    expect(await service.checkSetup()).toBeNull();
    expect(getPrice).not.toHaveBeenCalled();
    expect(service.enforced).toBe(false);
  });
});
