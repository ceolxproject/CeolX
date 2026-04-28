ALTER TABLE "user" ADD COLUMN "deletion_requested_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "deletion_scheduled_for" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "deletion_cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_anonymized" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "anonymized_at" timestamp;