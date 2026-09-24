-- Address-level email opt-outs: "every salon's promotions" and "everything".
-- Purely additive. The per-salon opt-out stays on customers.emailOptOutAt.

CREATE TYPE "EmailSuppressionScope" AS ENUM ('MARKETING', 'ALL');

CREATE TABLE "email_suppressions" (
    "email" TEXT NOT NULL,
    "scope" "EmailSuppressionScope" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("email")
);
