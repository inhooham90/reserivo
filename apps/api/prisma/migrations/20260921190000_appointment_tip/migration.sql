-- Tip in integer cents, recorded alongside the payment method when staff
-- complete an appointment.
--
-- Nullable on purpose, and the distinction matters: NULL means nobody wrote a
-- tip down, 0 means they wrote down that there was none. Averages must count
-- only the rows that have one, so existing rows are correctly left NULL.

ALTER TABLE "appointments" ADD COLUMN "tipCents" INTEGER;
