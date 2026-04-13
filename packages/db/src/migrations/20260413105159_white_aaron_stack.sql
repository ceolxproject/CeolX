ALTER TABLE "events" ALTER COLUMN "is_gig_opportunity" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "unregistered_collaborators" jsonb DEFAULT '[]'::jsonb;