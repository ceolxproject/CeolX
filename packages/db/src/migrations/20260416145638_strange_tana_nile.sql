ALTER TABLE "venue_profiles" ADD COLUMN "county" varchar(100);--> statement-breakpoint
ALTER TABLE "venue_profiles" ADD COLUMN "lat" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "venue_profiles" ADD COLUMN "lng" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "venue_profiles" ADD COLUMN "profile_image_url" text;--> statement-breakpoint
ALTER TABLE "venue_profiles" ADD COLUMN "cover_image_url" text;--> statement-breakpoint
ALTER TABLE "venue_profiles" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "venue_profiles" ADD COLUMN "phone" varchar(30);