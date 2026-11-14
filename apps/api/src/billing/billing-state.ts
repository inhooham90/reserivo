import { isLiveSubscription, type BillingState } from '@reserivo/shared';

/** The Salon columns that decide whether a business can take online bookings. */
export interface SalonBillingFields {
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  billingGraceUntil: Date | null;
}

export function billingState(salon: SalonBillingFields, now: Date): BillingState {
  if (isLiveSubscription(salon.subscriptionStatus)) return salon.subscriptionStatus === 'past_due' ? 'pastDue' : 'active';
  if (salon.billingGraceUntil && salon.billingGraceUntil > now) return 'grace';
  return salon.stripeSubscriptionId ? 'inactive' : 'none';
}

/**
 * Whether the public booking page takes new bookings. With billing off (no
 * Stripe keys: development, tests) every business does. Staff bookings never
 * go through this: a paused business can still record walk-ins.
 */
export function acceptsOnlineBookings(salon: SalonBillingFields, now: Date, enforced: boolean): boolean {
  if (!enforced) return true;
  const state = billingState(salon, now);
  return state === 'active' || state === 'pastDue' || state === 'grace';
}
