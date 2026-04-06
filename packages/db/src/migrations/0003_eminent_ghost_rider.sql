ALTER TABLE "artist_profiles" ALTER COLUMN "genre" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD COLUMN "contact_email" varchar(255);