ALTER TABLE "posts" ADD COLUMN "mux_upload_id" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "mux_asset_id" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "mux_playback_id" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "mux_status" text;--> statement-breakpoint
CREATE INDEX "posts_mux_upload_id_idx" ON "posts" USING btree ("mux_upload_id");--> statement-breakpoint
CREATE INDEX "posts_mux_asset_id_idx" ON "posts" USING btree ("mux_asset_id");