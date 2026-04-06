CREATE TYPE "public"."social_platform" AS ENUM('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'WEBSITE', 'TWITTER');--> statement-breakpoint
CREATE TABLE "profile_social_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" "social_platform" NOT NULL,
	"url" varchar(500) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profile_social_links_user_platform_uniq" UNIQUE("user_id","platform")
);
--> statement-breakpoint
ALTER TABLE "venue_profiles" ADD COLUMN "contact_email" varchar(255);--> statement-breakpoint
ALTER TABLE "profile_social_links" ADD CONSTRAINT "profile_social_links_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_social_links_user_id_idx" ON "profile_social_links" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "artist_profiles" DROP COLUMN "links";