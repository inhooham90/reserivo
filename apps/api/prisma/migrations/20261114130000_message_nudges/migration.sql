-- Message emails move from "on every message" to "once a message has sat unread".
ALTER TABLE "conversations"
  ADD COLUMN "customerNotifiedAt" TIMESTAMPTZ(6),
  ADD COLUMN "staffNotifiedAt" TIMESTAMPTZ(6);

-- Every existing message was already emailed when it was sent, so mark all
-- conversations as notified; otherwise the first sweep after deploy would email
-- everyone again about anything still unread.
UPDATE "conversations" SET "customerNotifiedAt" = CURRENT_TIMESTAMP, "staffNotifiedAt" = CURRENT_TIMESTAMP;
