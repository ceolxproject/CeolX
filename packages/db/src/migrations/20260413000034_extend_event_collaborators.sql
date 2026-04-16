-- M5-T1: Extend event_collaborators for booking flow + non-platform artist invites

-- Make artist_profile_id nullable (non-platform artists have no user account)
ALTER TABLE "event_collaborators" ALTER COLUMN "artist_profile_id" DROP NOT NULL;

-- Add columns for non-platform artist invites
ALTER TABLE "event_collaborators" ADD COLUMN "invited_name" varchar(150);
ALTER TABLE "event_collaborators" ADD COLUMN "invited_email" varchar(255);

-- Add booking reference (links collaborator to booking state machine)
ALTER TABLE "event_collaborators" ADD COLUMN "booking_id" uuid;

-- Foreign key for booking_id
ALTER TABLE "event_collaborators"
  ADD CONSTRAINT "event_collaborators_booking_id_bookings_id_fk"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

-- Index for booking lookups (used when booking is rejected/cancelled to find and remove collaborator)
CREATE INDEX "event_collaborators_booking_idx" ON "event_collaborators" ("booking_id");
