-- M7-T2: flatten notifications.payload jsonb into top-level columns.
-- Adds title/body/route/persona/is_read/archived_at, backfills from payload,
-- then enforces NOT NULL. Legacy columns (payload, read) stay temporarily;
-- a follow-up migration drops them once writers are updated and verified.

DROP INDEX "notifications_user_read_idx";--> statement-breakpoint

-- Step 1: drop NOT NULL on legacy columns so they coexist with new flat fields.
ALTER TABLE "notifications" ALTER COLUMN "payload" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "read" DROP DEFAULT;--> statement-breakpoint

-- Step 2: add new flat columns as NULLABLE so existing rows don't violate.
ALTER TABLE "notifications" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "body" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "route" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "persona" varchar(20);--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "is_read" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint

-- Step 3: backfill flat columns from JSONB payload for existing rows.
UPDATE "notifications" SET
  "title"   = COALESCE("payload"->>'title', ''),
  "body"    = COALESCE("payload"->>'body', ''),
  "route"   = COALESCE("payload"->>'route', '/'),
  "persona" = COALESCE("payload"->>'persona', 'spectator'),
  "is_read" = COALESCE("read", false)
WHERE "title" IS NULL;--> statement-breakpoint

-- Step 4: enforce NOT NULL on backfilled columns.
ALTER TABLE "notifications" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "body" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "route" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "persona" SET NOT NULL;--> statement-breakpoint

-- Step 5: indexes for inbox queries.
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","is_read");
