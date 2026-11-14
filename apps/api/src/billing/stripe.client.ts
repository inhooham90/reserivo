import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

/** The fields of a Stripe Subscription this app reads. */
export interface StripeSubscription {
  id: string;
  status: string;
  customer: string | { id: string };
  metadata?: Record<string, string>;
  cancel_at_period_end?: boolean;
  cancel_at?: number | null;
  /** Older API versions put the period on the subscription… */
  current_period_end?: number;
  /** …newer ones on each item. Both are read. */
  items?: { data?: { current_period_end?: number }[] };
}

export interface StripePrice {
  id: string;
  active: boolean;
  currency: string;
  unit_amount: number | null;
  recurring: { interval: string; interval_count: number } | null;
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: { id?: string; object?: string; subscription?: string | { id: string } | null } };
}

/** A 4xx from Stripe about the request itself (a bad promo code, an unknown customer). */
export class StripeRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'StripeRequestError';
  }
}

/**
 * Stripe's REST API, called over fetch like Twilio is: the app makes four
 * calls (checkout, portal, promo lookup, subscription read), all form-encoded,
 * and that does not justify an SDK in the runtime image. Nested parameters use
 * Stripe's bracket syntax, e.g. `line_items[0][price]`.
 */
@Injectable()
export class StripeClient {
  private readonly logger = new Logger('Stripe');

  constructor(private readonly config: ConfigService<Env, true>) {}

  createCheckoutSession(params: Record<string, string>): Promise<{ id: string; url: string }> {
    return this.request('POST', '/v1/checkout/sessions', params);
  }

  createPortalSession(customer: string, returnUrl: string): Promise<{ url: string }> {
    return this.request('POST', '/v1/billing_portal/sessions', { customer, return_url: returnUrl });
  }

  /** The promotion-code id for a code a customer typed, or null when there is no active one. */
  async findPromotionCode(code: string): Promise<string | null> {
    const res = await this.request<{ data: { id: string }[] }>('GET', '/v1/promotion_codes', { code, active: 'true', limit: '1' });
    return res.data[0]?.id ?? null;
  }

  getPrice(id: string): Promise<StripePrice> {
    return this.request('GET', `/v1/prices/${encodeURIComponent(id)}`);
  }

  getCoupon(id: string): Promise<{ id: string; valid: boolean }> {
    return this.request('GET', `/v1/coupons/${encodeURIComponent(id)}`);
  }

  getSubscription(id: string): Promise<StripeSubscription> {
    return this.request('GET', `/v1/subscriptions/${encodeURIComponent(id)}`);
  }

  private async request<T>(method: 'GET' | 'POST', path: string, params?: Record<string, string>): Promise<T> {
    const form = new URLSearchParams(params);
    const auth = { Authorization: `Bearer ${this.config.get('STRIPE_SECRET_KEY')}` };
    const res =
      method === 'GET'
        ? await fetch(`https://api.stripe.com${path}${params ? `?${form}` : ''}`, { headers: auth })
        : await fetch(`https://api.stripe.com${path}`, {
            method: 'POST',
            headers: { ...auth, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form,
          });
    const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string; code?: string } }) | null;
    if (!res.ok || !body) {
      const message = body?.error?.message ?? `HTTP ${res.status}`;
      this.logger.warn(`${method} ${path} → ${res.status}: ${message}`);
      if (res.status >= 400 && res.status < 500) throw new StripeRequestError(res.status, body?.error?.code, message);
      // Never surface Stripe's internals to the browser.
      throw new BadGatewayException('The payment provider is not responding. Please try again in a minute.');
    }
    return body;
  }
}
