ALTER TABLE "event_collaborators" ADD COLUMN "invite_token" text;--> statement-breakpoint
ALTER TABLE "event_collaborators" ADD COLUMN "invite_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "event_collaborators" ADD CONSTRAINT "event_collaborators_invite_token_unique" UNIQUE("invite_token");