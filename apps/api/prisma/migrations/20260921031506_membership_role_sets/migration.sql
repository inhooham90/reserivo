-- Membership roles become a set. Hand-written so existing rows keep their data:
-- Prisma's generated version would drop `role` and add an empty `roles`.

-- 1. Add the set columns, backfilled from the single role.
ALTER TABLE "salon_memberships" ADD COLUMN "roles" "SalonRole"[] NOT NULL DEFAULT ARRAY[]::"SalonRole"[];
UPDATE "salon_memberships" SET "roles" = ARRAY["role"];

ALTER TABLE "invitations" ADD COLUMN "roles" "SalonRole"[] NOT NULL DEFAULT ARRAY[]::"SalonRole"[];
UPDATE "invitations" SET "roles" = ARRAY["role"];

-- 2. Managers who already own services were owner-stylists: they are designers too.
UPDATE "salon_memberships" m
SET "roles" = array_append(m."roles", 'DESIGNER'::"SalonRole")
WHERE NOT ('DESIGNER'::"SalonRole" = ANY (m."roles"))
  AND EXISTS (SELECT 1 FROM "services" s WHERE s."designerId" = m."id");

-- 3. Those owner-stylists used to work the salon hours implicitly; make that
--    explicit as personal hours so nothing changes for them.
INSERT INTO "availability_rules" ("id", "salonId", "designerId", "weekday", "startMinutes", "endMinutes")
SELECT gen_random_uuid(), m."salonId", m."id", h."weekday", h."startMinutes", h."endMinutes"
FROM "salon_memberships" m
JOIN "salon_hours" h ON h."salonId" = m."salonId"
WHERE 'MANAGER'::"SalonRole" = ANY (m."roles")
  AND 'DESIGNER'::"SalonRole" = ANY (m."roles")
  AND NOT EXISTS (SELECT 1 FROM "availability_rules" r WHERE r."designerId" = m."id");

-- 4. Drop the old columns and the temporary defaults.
ALTER TABLE "salon_memberships" DROP COLUMN "role", DROP COLUMN "acceptsBookings";
ALTER TABLE "salon_memberships" ALTER COLUMN "roles" DROP DEFAULT;
ALTER TABLE "invitations" DROP COLUMN "role";
ALTER TABLE "invitations" ALTER COLUMN "roles" DROP DEFAULT;
