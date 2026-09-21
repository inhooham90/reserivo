-- Double booking, opt-in per service.
--
-- A long service has processing time in it — colour developing, a perm
-- setting — during which the designer is free to start someone else. The
-- flag says "this appointment may share its time"; it is snapshotted onto
-- the appointment so editing the service later never rewrites history.
--
-- The exclusion constraint below keeps its old meaning for ordinary rows by
-- simply not indexing the double-bookable ones. Two ordinary appointments
-- still cannot overlap; anything may overlap a double-bookable one. Both
-- existing columns default to false, so every current row keeps blocking.

ALTER TABLE "services" ADD COLUMN "allowsDoubleBooking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "appointments" ADD COLUMN "allowsDoubleBooking" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "appointments" DROP CONSTRAINT "appointments_no_double_booking";

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_double_booking"
  EXCLUDE USING gist (
    "designerId" WITH =,
    tstzrange("startAt", "blockEndAt", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'CONFIRMED') AND "allowsDoubleBooking" = false);
