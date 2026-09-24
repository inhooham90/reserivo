-- Salon email campaigns.
--
-- Two columns on customers and two new tables. Nothing here drops data, so it
-- is additive, but the unsubscribeToken backfill matters: the column is NOT
-- NULL and UNIQUE, so existing rows need a value before the constraint lands.

-- emailOptOutAt is the inverse of smsConsentAt on purpose. Texting is opt-in
-- (TCPA); marketing email is opt-out (CAN-SPAM). NULL here means mailable.
ALTER TABLE "customers" ADD COLUMN "emailOptOutAt" TIMESTAMPTZ(6);
ALTER TABLE "customers" ADD COLUMN "unsubscribeToken" TEXT;

-- Backfill before the constraints. gen_random_uuid() is in core Postgres from
-- 13 on, so no extension is needed.
UPDATE "customers" SET "unsubscribeToken" = gen_random_uuid()::text WHERE "unsubscribeToken" IS NULL;

ALTER TABLE "customers" ALTER COLUMN "unsubscribeToken" SET NOT NULL;
CREATE UNIQUE INDEX "customers_unsubscribeToken_key" ON "customers"("unsubscribeToken");

CREATE TYPE "EmailCampaignStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT');
CREATE TYPE "EmailCampaignRecipientStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "email_campaigns" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "createdByUserId" UUID,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" JSONB NOT NULL,
    "status" "EmailCampaignStatus" NOT NULL DEFAULT 'QUEUED',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_campaigns_salonId_createdAt_idx" ON "email_campaigns"("salonId", "createdAt");

CREATE TABLE "email_campaign_recipients" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "status" "EmailCampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sentAt" TIMESTAMPTZ(6),

    CONSTRAINT "email_campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- The idempotency guarantee: one row per person per campaign, claimed by
-- moving it out of PENDING before anything is sent.
CREATE UNIQUE INDEX "email_campaign_recipients_campaignId_customerId_key" ON "email_campaign_recipients"("campaignId", "customerId");
CREATE INDEX "email_campaign_recipients_status_idx" ON "email_campaign_recipients"("status");

ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "email_campaign_recipients" ADD CONSTRAINT "email_campaign_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_campaign_recipients" ADD CONSTRAINT "email_campaign_recipients_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
