-- Language preference, for the UI and for outgoing messages.
--
-- Two columns because they answer different questions:
--   users.locale     what language to render the app in for this account
--   customers.locale what language to write this client's confirmations and
--                    reminders in
--
-- The client one cannot be read off the request: a reminder goes out days
-- later from a cron sweep with no browser to ask, so the choice has to be
-- recorded at booking time.
--
-- Plain text rather than an enum so adding a language never needs a migration.
-- Existing rows default to English, which is what they were already getting.

ALTER TABLE "users" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "customers" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
