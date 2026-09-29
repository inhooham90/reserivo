-- The setup guide on the schedule. Additive: an array of confirmed steps and a
-- nullable "put away" timestamp. Every membership that exists today belongs to
-- a business that is already running, so it starts hidden rather than greeting
-- working teams with a checklist; the header link still reopens it.

ALTER TABLE "salon_memberships" ADD COLUMN "setupSteps" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "salon_memberships" ADD COLUMN "setupHiddenAt" TIMESTAMPTZ(6);

UPDATE "salon_memberships" SET "setupHiddenAt" = CURRENT_TIMESTAMP;
