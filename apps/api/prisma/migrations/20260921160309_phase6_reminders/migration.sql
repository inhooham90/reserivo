-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('EMAIL', 'SMS');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "smsConsentAt" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "salons" ADD COLUMN     "reminderHoursBefore" INTEGER[] DEFAULT ARRAY[24]::INTEGER[];

-- CreateTable
CREATE TABLE "appointment_reminders" (
    "id" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "hoursBefore" INTEGER NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "sentAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "appointment_reminders_appointmentId_hoursBefore_channel_key" ON "appointment_reminders"("appointmentId", "hoursBefore", "channel");

-- AddForeignKey
ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
