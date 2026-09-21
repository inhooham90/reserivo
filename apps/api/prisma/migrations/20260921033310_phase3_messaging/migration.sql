-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('CUSTOMER', 'STAFF');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "designerId" UUID NOT NULL,
    "lastMessageAt" TIMESTAMPTZ(6),
    "customerLastReadAt" TIMESTAMPTZ(6),
    "staffLastReadAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "sender" "MessageSender" NOT NULL,
    "body" TEXT NOT NULL,
    "actorUserId" UUID,
    "sentAsMembershipId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_salonId_lastMessageAt_idx" ON "conversations"("salonId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "conversations_designerId_lastMessageAt_idx" ON "conversations"("designerId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_customerId_designerId_key" ON "conversations"("customerId", "designerId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "salon_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
