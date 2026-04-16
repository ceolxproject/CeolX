ALTER TABLE "artist_profiles" ADD COLUMN "genres" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "location" varchar(255);--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "profile_image_url" text;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "cover_image_url" text;