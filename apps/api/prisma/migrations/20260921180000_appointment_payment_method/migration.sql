-- How the customer settled up, recorded when staff complete an appointment.
--
-- Purely a bookkeeping note: nothing here moves money, and the column is
-- nullable because recording it is optional. Null means "nobody wrote it
-- down", never "unpaid", so existing rows need no backfill.

CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'CASH', 'GIFT_CARD', 'MOBILE_PAY', 'OTHER');

ALTER TABLE "appointments" ADD COLUMN "paymentMethod" "PaymentMethod";
