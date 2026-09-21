-- Client ratings of designers, one to five stars.
--
-- The unique constraint is the feature, not an optimisation: a client holds a
-- single rating per designer and updating it overwrites. Per-visit ratings
-- would let one regular with twenty appointments outvote twenty separate
-- first-time clients, so "one client, one voice" is enforced here rather than
-- trusted to application code.
--
-- No comment column and no author is ever exposed. Designers see an aggregate
-- only, which keeps this in line with the rest of the product: a designer
-- never learns which client said what.
--
-- The displayed score is not the mean of these rows. It is weighted against a
-- prior of ten 4-star ratings, computed on read -- see bayesianStars() in
-- packages/shared/src/rating.ts. Nothing is denormalised, so nothing can drift.

CREATE TABLE "designer_ratings" (
  "id"         UUID NOT NULL,
  "salonId"    UUID NOT NULL,
  "designerId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "stars"      INTEGER NOT NULL,
  "createdAt"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "designer_ratings_pkey" PRIMARY KEY ("id"),
  -- Out-of-range stars are rejected by the database as well as by zod: the
  -- score is an average, so one bad row would quietly skew a designer's number
  -- with nothing to show it had happened.
  CONSTRAINT "designer_ratings_stars_range" CHECK ("stars" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "designer_ratings_designerId_customerId_key"
  ON "designer_ratings" ("designerId", "customerId");
CREATE INDEX "designer_ratings_designerId_idx" ON "designer_ratings" ("designerId");

ALTER TABLE "designer_ratings"
  ADD CONSTRAINT "designer_ratings_salonId_fkey"
  FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "designer_ratings"
  ADD CONSTRAINT "designer_ratings_designerId_fkey"
  FOREIGN KEY ("designerId") REFERENCES "salon_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "designer_ratings"
  ADD CONSTRAINT "designer_ratings_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
