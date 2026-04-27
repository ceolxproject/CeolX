ALTER TABLE "event_collaborators" ALTER COLUMN "artist_profile_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "event_collaborators" ADD COLUMN "invited_name" varchar(150);--> statement-breakpoint
ALTER TABLE "event_collaborators" ADD COLUMN "invited_email" varchar(255);--> statement-breakpoint
ALTER TABLE "event_collaborators" ADD COLUMN "booking_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_user_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_collaborators" ADD CONSTRAINT "event_collaborators_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_collaborators_booking_idx" ON "event_collaborators" USING btree ("booking_id");