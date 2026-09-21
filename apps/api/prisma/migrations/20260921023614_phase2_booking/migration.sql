-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('ONLINE', 'STAFF');

-- AlterTable
ALTER TABLE "salons" ADD COLUMN     "cancelWindowHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "leadTimeMin" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "maxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "slotIntervalMin" INTEGER NOT NULL DEFAULT 15;

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "userId" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "designerId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "serviceId" UUID,
    "startAt" TIMESTAMPTZ(6) NOT NULL,
    "endAt" TIMESTAMPTZ(6) NOT NULL,
    "blockEndAt" TIMESTAMPTZ(6) NOT NULL,
    "bufferMin" INTEGER NOT NULL DEFAULT 0,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" "AppointmentSource" NOT NULL,
    "serviceNameSnapshot" TEXT NOT NULL,
    "priceCentsSnapshot" INTEGER NOT NULL,
    "durationMinSnapshot" INTEGER NOT NULL,
    "notes" TEXT,
    "internalNotes" TEXT,
    "createdByUserId" UUID,
    "cancelledAt" TIMESTAMPTZ(6),
    "cancelledByUserId" UUID,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_salonId_email_idx" ON "customers"("salonId", "email");

-- CreateIndex
CREATE INDEX "customers_salonId_phone_idx" ON "customers"("salonId", "phone");

-- CreateIndex
CREATE INDEX "customers_salonId_name_idx" ON "customers"("salonId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_salonId_userId_key" ON "customers"("salonId", "userId");

-- CreateIndex
CREATE INDEX "appointments_designerId_startAt_idx" ON "appointments"("designerId", "startAt");

-- CreateIndex
CREATE INDEX "appointments_salonId_startAt_idx" ON "appointments"("salonId", "startAt");

-- CreateIndex
CREATE INDEX "appointments_customerId_startAt_idx" ON "appointments"("customerId", "startAt");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "salon_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Double-booking guarantee. Two PENDING/CONFIRMED appointments for the same
-- designer may not overlap, where an appointment occupies
-- [startAt, blockEndAt). blockEndAt is a stored column (= endAt + buffer)
-- because index expressions must be IMMUTABLE and timestamptz + interval is
-- only STABLE. Application code computes availability for the UX; this
-- constraint is what makes it true under concurrency. btree_gist lets a GiST
-- index combine uuid equality with range overlap.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_double_booking"
  EXCLUDE USING gist (
    "designerId" WITH =,
    tstzrange("startAt", "blockEndAt", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'CONFIRMED'));
