-- Billing: one Stripe subscription per business. Additive only.

ALTER TABLE "salons"
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT,
  ADD COLUMN "subscriptionStatus" TEXT,
  ADD COLUMN "subscriptionPeriodEnd" TIMESTAMPTZ(6),
  ADD COLUMN "subscriptionCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "introOfferUsedAt" TIMESTAMPTZ(6),
  ADD COLUMN "billingGraceUntil" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "salons_stripeCustomerId_key" ON "salons"("stripeCustomerId");
CREATE UNIQUE INDEX "salons_stripeSubscriptionId_key" ON "salons"("stripeSubscriptionId");

-- Businesses that predate billing keep taking bookings for 30 days, time to
-- subscribe without their booking page going dark the day this ships.
UPDATE "salons" SET "billingGraceUntil" = CURRENT_TIMESTAMP + INTERVAL '30 days';
