import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { user } from './auth';
import { bookingDirectionEnum, bookingStatusEnum } from './enums';
import { events } from './events';
import { artistProfiles, venueProfiles } from './users';

// ---------------------------------------------------------------------------
// bookings — bidirectional Artist ↔ Venue engagement.
// direction disambiguates who initiated:
//   venue_to_artist = venue sent an invitation to an artist
//   artist_to_venue = artist applied to a gig opportunity (is_gig_opportunity=true)
//
// event_id is nullable — a venue can send a general inquiry without attaching
// it to a specific event.
//
// State machine (enforced at application layer, not DB):
//   pending → accepted | rejected | cancelled
//   accepted → cancelled (either party)
//   cancelled_by tracks the user who initiated cancellation
// ---------------------------------------------------------------------------
export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    artistId: uuid('artist_id')
      .notNull()
      .references(() => artistProfiles.id, { onDelete: 'cascade' }),
    // Nullable: artist_to_artist rows have no venue. venue_to_artist /
    // artist_to_venue rows still require it (enforced by a DB CHECK in the
    // migration). (Artist co-artist invites — spec 2026-06-05)
    venueId: uuid('venue_id').references(() => venueProfiles.id, { onDelete: 'cascade' }),
    // Inviting artist for artist_to_artist rows; NULL for venue directions.
    inviterArtistId: uuid('inviter_artist_id').references(() => artistProfiles.id, {
      onDelete: 'cascade',
    }),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
    status: bookingStatusEnum('status').notNull().default('pending'),
    direction: bookingDirectionEnum('direction').notNull(),
    cancelledBy: text('cancelled_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('bookings_artist_status_idx').on(t.artistId, t.status),
    index('bookings_venue_status_idx').on(t.venueId, t.status),
    index('bookings_inviter_status_idx').on(t.inviterArtistId, t.status),
  ]
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const bookingsRelations = relations(bookings, ({ one }) => ({
  artist: one(artistProfiles, {
    fields: [bookings.artistId],
    references: [artistProfiles.id],
    relationName: 'booking_invited_artist',
  }),
  inviterArtist: one(artistProfiles, {
    fields: [bookings.inviterArtistId],
    references: [artistProfiles.id],
    relationName: 'booking_inviter_artist',
  }),
  venue: one(venueProfiles, {
    fields: [bookings.venueId],
    references: [venueProfiles.id],
  }),
  event: one(events, {
    fields: [bookings.eventId],
    references: [events.id],
  }),
  cancelledByUser: one(user, {
    fields: [bookings.cancelledBy],
    references: [user.id],
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
