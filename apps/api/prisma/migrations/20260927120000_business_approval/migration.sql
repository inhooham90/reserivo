-- Business accounts are approved by a site admin. Additive: a nullable column,
-- backfilled so everyone who already belongs to a business keeps being able to
-- create one (the rollout decision was to approve every existing member).

ALTER TABLE "users" ADD COLUMN "businessApprovedAt" TIMESTAMPTZ(6);

UPDATE "users" u
SET "businessApprovedAt" = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM "salon_memberships" m
  WHERE m."userId" = u."id" AND m."status" = 'ACTIVE'
);
