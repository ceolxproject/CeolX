ALTER TABLE "venue_subscriptions" ALTER COLUMN "stripe_customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_subscriptions" ALTER COLUMN "stripe_subscription_id" DROP NOT NULL;--> statement-breakpoint
-- Hand-added guard (M8-T1). `plan` previously defaulted to the varchar 'lite' from
-- the abandoned Lite/Pro tier model (D-07). 'lite' is not a billing_interval label,
-- so the cast below would abort the whole migration on any surviving row. No code
-- path has ever written this table -- the Stripe webhook is still a stub -- so every
-- environment should be empty, but a failed deploy is a poor way to discover
-- otherwise. Relabelling a row that was never a real subscription is harmless.
UPDATE "venue_subscriptions" SET "plan" = 'monthly' WHERE "plan" NOT IN ('monthly', 'annual');--> statement-breakpoint
-- DROP DEFAULT must precede SET DATA TYPE. drizzle-kit generated them the other way
-- round, which aborts with 'default for column "plan" cannot be cast automatically
-- to type billing_interval': Postgres tries to coerce the existing 'lite'::varchar
-- default into the new enum before the column data itself. Dropping the default
-- first leaves nothing to coerce. Reordered by hand, verified against local.
ALTER TABLE "venue_subscriptions" ALTER COLUMN "plan" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "venue_subscriptions" ALTER COLUMN "plan" SET DATA TYPE "public"."billing_interval" USING "plan"::"public"."billing_interval";--> statement-breakpoint
ALTER TABLE "venue_subscriptions" ALTER COLUMN "current_period_start" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "venue_subscriptions" ALTER COLUMN "current_period_end" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "venue_subscriptions" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "venue_subscriptions" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "venue_subscriptions" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "venue_subscriptions" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "venue_subscriptions" ADD COLUMN "trial_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "venue_subscriptions" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "venue_subscriptions" ADD COLUMN "past_due_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "venue_subscriptions" ADD COLUMN "billing_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "venue_subscriptions_stripe_subscription_id_idx" ON "venue_subscriptions" USING btree ("stripe_subscription_id");