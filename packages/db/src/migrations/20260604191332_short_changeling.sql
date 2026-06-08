ALTER TYPE "public"."booking_direction" ADD VALUE IF NOT EXISTS 'artist_to_artist';--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "venue_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "inviter_artist_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_inviter_artist_id_artist_profiles_id_fk" FOREIGN KEY ("inviter_artist_id") REFERENCES "public"."artist_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_inviter_status_idx" ON "bookings" USING btree ("inviter_artist_id","status");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_participants_chk" CHECK (
  ("direction"::text IN ('venue_to_artist','artist_to_venue') AND "venue_id" IS NOT NULL AND "inviter_artist_id" IS NULL)
  OR
  ("direction"::text = 'artist_to_artist' AND "venue_id" IS NULL AND "inviter_artist_id" IS NOT NULL)
);