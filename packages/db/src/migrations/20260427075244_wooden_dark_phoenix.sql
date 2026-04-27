CREATE TABLE "notification_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "notifications_user_created_idx";--> statement-breakpoint
DROP INDEX "notifications_user_unread_idx";--> statement-breakpoint
ALTER TABLE "notification_users" ADD CONSTRAINT "notification_users_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_users" ADD CONSTRAINT "notification_users_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_users_user_created_idx" ON "notification_users" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_users_user_unread_idx" ON "notification_users" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_users_unique_idx" ON "notification_users" USING btree ("notification_id","user_id");--> statement-breakpoint
-- M7-T1 backfill: preserve existing per-user state before we drop the columns
-- it lives in. One notification_users row per existing notification.
INSERT INTO "notification_users" ("notification_id", "user_id", "is_read", "archived_at", "created_at")
SELECT "id", "user_id", "is_read", "archived_at", "created_at"
FROM "notifications";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "is_read";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "archived_at";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "payload";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "read";