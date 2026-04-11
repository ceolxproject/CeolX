ALTER TYPE "public"."event_status" ADD VALUE 'removed';--> statement-breakpoint
CREATE TABLE "event_collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"artist_profile_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "lat_range_check";--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "lng_range_check";--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "ticket_price" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "ad_title" varchar(100);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "ad_description" varchar(50);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "removal_reason" text;--> statement-breakpoint
ALTER TABLE "event_collaborators" ADD CONSTRAINT "event_collaborators_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_collaborators" ADD CONSTRAINT "event_collaborators_artist_profile_id_user_id_fk" FOREIGN KEY ("artist_profile_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_collaborators_event_artist_idx" ON "event_collaborators" USING btree ("event_id","artist_profile_id");--> statement-breakpoint
CREATE INDEX "event_collaborators_event_idx" ON "event_collaborators" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "lat_range_check" CHECK ("events"."lat" BETWEEN -90 AND 90);--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "lng_range_check" CHECK ("events"."lng" BETWEEN -180 AND 180);