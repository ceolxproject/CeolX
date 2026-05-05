ALTER TABLE "device_tokens" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD COLUMN "last_used_at" timestamp;--> statement-breakpoint
CREATE INDEX "device_tokens_user_active_idx" ON "device_tokens" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "device_tokens_updated_at_idx" ON "device_tokens" USING btree ("updated_at");