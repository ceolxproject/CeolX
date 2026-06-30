ALTER TABLE "user" ADD COLUMN "welcome_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "welcome_push_sent_at" timestamp;--> statement-breakpoint
-- ONB-01 backfill: treat all pre-existing accounts as already welcomed so the
-- new login-hook welcome (in-app + email) and the device-token welcome push do
-- NOT fire for users who signed up before this feature shipped. New rows keep
-- the NULL default and get welcomed on their first authenticated session.
UPDATE "user" SET "welcome_sent_at" = now(), "welcome_push_sent_at" = now() WHERE "welcome_sent_at" IS NULL;