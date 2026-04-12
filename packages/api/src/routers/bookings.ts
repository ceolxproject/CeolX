import { TRPCError } from '@trpc/server';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { bookings } from '@CeolX/db/schema/bookings';
import { eventCollaborators, events } from '@CeolX/db/schema/events';
import { notifications } from '@CeolX/db/schema/notifications';
import { artistProfiles, venueProfiles } from '@CeolX/db/schema/users';
import {
  createBookingSchema,
  inviteExternalArtistSchema,
  listBookingsSchema,
  searchArtistsSchema,
  updateBookingSchema,
} from '@CeolX/shared/validators';

import { protectedProcedure, router, venueProcedure } from '../index';

// ─── Valid state transitions (enforced at application layer) ──────────────────
//   pending  → accepted  (artist only)
//   pending  → rejected  (artist only)
//   pending  → cancelled (venue only — "withdraw")
//   accepted → cancelled (either party)
// ──────────────────────────────────────────────────────────────────────────────

type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['cancelled'],
  rejected: [],
  cancelled: [],
};

export const bookingsRouter = router({
  // ─── Create booking (venue adds collaborator → booking auto-created) ────────
  create: venueProcedure.input(createBookingSchema).mutation(async ({ input, ctx }) => {
    // 1. Look up venue profile
    const venueProfile = await db.query.venueProfiles.findFirst({
      where: eq(venueProfiles.userId, ctx.userId),
    });
    if (!venueProfile) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Venue profile not found' });
    }

    // 2. Look up artist profile + user record
    const artistProfile = await db.query.artistProfiles.findFirst({
      where: eq(artistProfiles.id, input.artistId),
    });
    if (!artistProfile || !artistProfile.isActive) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Artist not found or inactive' });
    }

    // 3. Validate event exists and is owned by this venue
    const event = await db.query.events.findFirst({
      where: eq(events.id, input.eventId),
    });
    if (!event) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }
    if (event.createdBy !== ctx.userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You can only add collaborators to your own events',
      });
    }

    // 4. Dedup: no active booking (pending/accepted) for same artist+event
    const existingBooking = await db.query.bookings.findFirst({
      where: and(
        eq(bookings.artistId, input.artistId),
        eq(bookings.eventId, input.eventId),
        inArray(bookings.status, ['pending', 'accepted'])
      ),
    });
    if (existingBooking) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'An active booking already exists for this artist and event',
      });
    }

    // 5. Transaction: insert booking + eventCollaborator
    const result = await db.transaction(async (tx) => {
      const [booking] = await tx
        .insert(bookings)
        .values({
          artistId: input.artistId,
          venueId: venueProfile.id,
          eventId: input.eventId,
          status: 'pending',
          direction: 'venue_to_artist',
        })
        .returning();

      if (!booking)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Booking insert failed' });

      await tx.insert(eventCollaborators).values({
        eventId: input.eventId,
        artistProfileId: artistProfile.userId,
        bookingId: booking.id,
      });

      return booking;
    });

    // 6. Create in-app notification for the artist
    await db.insert(notifications).values({
      userId: artistProfile.userId,
      type: 'booking_invitation',
      payload: {
        title: 'New Booking Invitation',
        body: `${venueProfile.venueName} invited you to perform at "${event.title}"`,
        persona: 'artist',
        route: `/bookings/${result.id}`,
      },
    });

    // 7. Return BookingSummary
    const artistUser = await db.query.user.findFirst({
      where: eq(user.id, artistProfile.userId),
      columns: { image: true },
    });
    const venueUser = await db.query.user.findFirst({
      where: eq(user.id, venueProfile.userId),
      columns: { image: true },
    });

    return {
      id: result.id,
      status: result.status,
      direction: result.direction,
      artistId: artistProfile.id,
      artistName: artistProfile.stageName,
      artistImage: artistUser?.image ?? undefined,
      venueId: venueProfile.id,
      venueName: venueProfile.venueName,
      venueImage: venueUser?.image ?? undefined,
      eventId: event.id,
      eventTitle: event.title,
      eventCoverImage: event.coverImage ?? undefined,
      eventCategory: event.category,
      eventDateStart: event.dateStart.toISOString(),
      eventDateEnd: event.dateEnd?.toISOString() ?? undefined,
      eventVenueAddress: event.venueAddress ?? undefined,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }),

  // ─── Update booking status (accept / reject / withdraw / cancel) ────────────
  update: protectedProcedure.input(updateBookingSchema).mutation(async ({ input, ctx }) => {
    // 1. Fetch booking with artist + venue profiles
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, input.id),
      with: {
        artist: true,
        venue: true,
        event: true,
      },
    });

    if (!booking) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
    }

    // 2. Auth: caller must be artist or venue on this booking
    const isArtist = booking.artist.userId === ctx.userId;
    const isVenue = booking.venue.userId === ctx.userId;

    if (!isArtist && !isVenue) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not a party to this booking' });
    }

    // 3. State machine validation
    const currentStatus = booking.status as BookingStatus;
    const newStatus = input.status as BookingStatus;

    if (!VALID_TRANSITIONS[currentStatus]?.includes(newStatus)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot transition from "${currentStatus}" to "${newStatus}"`,
      });
    }

    // Role-specific transition restrictions:
    // - accept/reject: artist only
    // - cancel from pending (withdraw): venue only
    // - cancel from accepted: either party
    if ((newStatus === 'accepted' || newStatus === 'rejected') && !isArtist) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only the artist can accept or reject a booking',
      });
    }
    if (newStatus === 'cancelled' && currentStatus === 'pending' && !isVenue) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only the venue can withdraw a pending booking',
      });
    }

    // 4. Update status
    const [updated] = await db
      .update(bookings)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(bookings.id, input.id))
      .returning();

    if (!updated) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Update failed' });

    // 5. Side effect: on rejected/cancelled → remove eventCollaborator row
    if (newStatus === 'rejected' || newStatus === 'cancelled') {
      await db.delete(eventCollaborators).where(eq(eventCollaborators.bookingId, input.id));
    }

    // 6. Create notification for other party
    const recipientUserId = isArtist ? booking.venue.userId : booking.artist.userId;
    const recipientPersona = isArtist ? 'venue' : 'artist';
    const actionLabel =
      newStatus === 'accepted'
        ? 'accepted'
        : newStatus === 'rejected'
          ? 'declined'
          : currentStatus === 'pending'
            ? 'withdrew'
            : 'cancelled';

    const actorName = isArtist ? booking.artist.stageName : booking.venue.venueName;

    await db.insert(notifications).values({
      userId: recipientUserId,
      type: 'booking_update',
      payload: {
        title: 'Booking Update',
        body: `${actorName} ${actionLabel} the booking for "${booking.event?.title ?? 'event'}"`,
        persona: recipientPersona,
        route: `/bookings/${booking.id}`,
      },
    });

    return { id: updated.id, status: updated.status };
  }),

  // ─── List bookings (sent / received tabs) ──────────────────────────────────
  list: protectedProcedure.input(listBookingsSchema).query(async ({ input, ctx }) => {
    const role = ctx.currentRole;

    // Look up the user's profile ID to match against bookings
    let profileId: string | null = null;
    let profileType: 'artist' | 'venue' | null = null;

    if (role === 'venue') {
      const vp = await db.query.venueProfiles.findFirst({
        where: eq(venueProfiles.userId, ctx.userId),
        columns: { id: true },
      });
      profileId = vp?.id ?? null;
      profileType = 'venue';
    } else if (role === 'artist') {
      const ap = await db.query.artistProfiles.findFirst({
        where: eq(artistProfiles.userId, ctx.userId),
        columns: { id: true },
      });
      profileId = ap?.id ?? null;
      profileType = 'artist';
    }

    if (!profileId || !profileType) {
      return { bookings: [], total: 0 };
    }

    // Build where clause based on tab
    // Sent = bookings I initiated. Received = bookings sent to me.
    const conditions = [];

    if (input.tab === 'sent') {
      if (profileType === 'venue') {
        // Venue sent invitations to artists
        conditions.push(eq(bookings.venueId, profileId), eq(bookings.direction, 'venue_to_artist'));
      } else {
        // Artist sent applications to venues
        conditions.push(
          eq(bookings.artistId, profileId),
          eq(bookings.direction, 'artist_to_venue')
        );
      }
    } else {
      // received
      if (profileType === 'venue') {
        // Venue receives applications from artists
        conditions.push(eq(bookings.venueId, profileId), eq(bookings.direction, 'artist_to_venue'));
      } else {
        // Artist receives invitations from venues
        conditions.push(
          eq(bookings.artistId, profileId),
          eq(bookings.direction, 'venue_to_artist')
        );
      }
    }

    if (input.status) {
      conditions.push(eq(bookings.status, input.status));
    }
    if (input.direction) {
      conditions.push(eq(bookings.direction, input.direction));
    }

    const whereClause = and(...conditions);

    // Count + fetch in parallel
    const [countResult, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(bookings)
        .where(whereClause)
        .then((r) => r[0]?.count ?? 0),
      db.query.bookings.findMany({
        where: whereClause,
        with: {
          artist: true,
          venue: true,
          event: true,
        },
        orderBy: (b, { desc }) => [desc(b.createdAt)],
        limit: input.limit,
        offset: input.offset,
      }),
    ]);

    // Batch-fetch user images for all artists + venues in results
    const artistUserIds = rows.map((r) => r.artist.userId);
    const venueUserIds = rows.map((r) => r.venue.userId);
    const allUserIds = [...new Set([...artistUserIds, ...venueUserIds])];

    const userImages =
      allUserIds.length > 0
        ? await db
            .select({ id: user.id, image: user.image })
            .from(user)
            .where(inArray(user.id, allUserIds))
        : [];

    const imageMap = new Map(userImages.map((u) => [u.id, u.image]));

    return {
      bookings: rows.map((row) => ({
        id: row.id,
        status: row.status,
        direction: row.direction,
        artistId: row.artist.id,
        artistName: row.artist.stageName,
        artistImage: imageMap.get(row.artist.userId) ?? undefined,
        venueId: row.venue.id,
        venueName: row.venue.venueName,
        venueImage: imageMap.get(row.venue.userId) ?? undefined,
        eventId: row.event?.id ?? '',
        eventTitle: row.event?.title ?? '',
        eventCoverImage: row.event?.coverImage ?? undefined,
        eventCategory: row.event?.category ?? '',
        eventDateStart: row.event?.dateStart?.toISOString() ?? '',
        eventDateEnd: row.event?.dateEnd?.toISOString() ?? undefined,
        eventVenueAddress: row.event?.venueAddress ?? undefined,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      total: countResult,
    };
  }),

  // ─── Get booking by ID ──────────────────────────────────────────────────────
  byId: protectedProcedure
    .input(updateBookingSchema.pick({ id: true }))
    .query(async ({ input, ctx }) => {
      const booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, input.id),
        with: {
          artist: true,
          venue: true,
          event: true,
        },
      });

      if (!booking) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
      }

      // Auth: caller must be a party to this booking
      const isParty = booking.artist.userId === ctx.userId || booking.venue.userId === ctx.userId;
      if (!isParty) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not a party to this booking' });
      }

      const [artistUser, venueUser] = await Promise.all([
        db.query.user.findFirst({
          where: eq(user.id, booking.artist.userId),
          columns: { image: true },
        }),
        db.query.user.findFirst({
          where: eq(user.id, booking.venue.userId),
          columns: { image: true },
        }),
      ]);

      return {
        id: booking.id,
        status: booking.status,
        direction: booking.direction,
        artistId: booking.artist.id,
        artistName: booking.artist.stageName,
        artistImage: artistUser?.image ?? undefined,
        venueId: booking.venue.id,
        venueName: booking.venue.venueName,
        venueImage: venueUser?.image ?? undefined,
        eventId: booking.event?.id ?? '',
        eventTitle: booking.event?.title ?? '',
        eventCoverImage: booking.event?.coverImage ?? undefined,
        eventCategory: booking.event?.category ?? '',
        eventDateStart: booking.event?.dateStart?.toISOString() ?? '',
        eventDateEnd: booking.event?.dateEnd?.toISOString() ?? undefined,
        eventVenueAddress: booking.event?.venueAddress ?? undefined,
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
      };
    }),

  // ─── Search artists (for collaborator field) ───────────────────────────────
  searchArtists: protectedProcedure.input(searchArtistsSchema).query(async ({ input }) => {
    const results = await db
      .select({
        id: artistProfiles.id,
        stageName: artistProfiles.stageName,
        genre: artistProfiles.genre,
        userId: artistProfiles.userId,
      })
      .from(artistProfiles)
      .where(
        and(
          eq(artistProfiles.isActive, true),
          sql`${artistProfiles.stageName} ILIKE ${'%' + input.q + '%'}`
        )
      )
      .limit(input.limit);

    // Batch-fetch user images
    const userIds = results.map((r) => r.userId);
    const userImages =
      userIds.length > 0
        ? await db
            .select({ id: user.id, image: user.image })
            .from(user)
            .where(inArray(user.id, userIds))
        : [];

    const imageMap = new Map(userImages.map((u) => [u.id, u.image]));

    return {
      artists: results.map((r) => ({
        id: r.id,
        stageName: r.stageName,
        genre: r.genre,
        profileImageUrl: imageMap.get(r.userId) ?? null,
      })),
    };
  }),

  // ─── Invite non-platform artist ─────────────────────────────────────────────
  inviteExternal: venueProcedure
    .input(inviteExternalArtistSchema)
    .mutation(async ({ input, ctx }) => {
      // Validate event ownership
      const event = await db.query.events.findFirst({
        where: eq(events.id, input.eventId),
      });

      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }
      if (event.createdBy !== ctx.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only add collaborators to your own events',
        });
      }

      // Dedup by email for this event
      const existing = await db.query.eventCollaborators.findFirst({
        where: and(
          eq(eventCollaborators.eventId, input.eventId),
          eq(eventCollaborators.invitedEmail, input.email)
        ),
      });
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This artist has already been invited to this event',
        });
      }

      // Insert collaborator with invitedName/invitedEmail, no booking (non-platform)
      const [collaborator] = await db
        .insert(eventCollaborators)
        .values({
          eventId: input.eventId,
          invitedName: input.name,
          invitedEmail: input.email,
          // artistProfileId = null (non-platform), bookingId = null (no booking until signup)
        })
        .returning();

      if (!collaborator) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Insert failed' });
      }

      return {
        id: collaborator.id,
        eventId: collaborator.eventId,
        invitedName: collaborator.invitedName,
        invitedEmail: collaborator.invitedEmail,
      };
    }),
});
