import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { bookings } from '@CeolX/db/schema/bookings';
import { eventCollaborators, events } from '@CeolX/db/schema/events';
import { notifications } from '@CeolX/db/schema/notifications';
import { artistProfiles, venueProfiles } from '@CeolX/db/schema/users';
import {
  BookingDirection,
  BookingStatus,
  type BookingStatus as BookingStatusType,
  UserRole,
} from '@CeolX/shared';
import {
  confirmedEventsSchema,
  createBookingSchema,
  inviteExternalArtistSchema,
  listBookingsSchema,
  requestToPerformSchema,
  searchArtistsSchema,
  updateBookingSchema,
} from '@CeolX/shared/validators';

import {
  artistProcedure,
  creatorProcedure,
  protectedProcedure,
  router,
  venueProcedure,
} from '../index';

// ─── Valid state transitions (enforced at application layer) ──────────────────
//   pending  → accepted  (artist only)
//   pending  → rejected  (artist only)
//   pending  → cancelled (venue only — "withdraw")
//   accepted → cancelled (either party)
// ──────────────────────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<BookingStatusType, BookingStatusType[]> = {
  [BookingStatus.PENDING]: [
    BookingStatus.ACCEPTED,
    BookingStatus.REJECTED,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.ACCEPTED]: [BookingStatus.CANCELLED],
  [BookingStatus.REJECTED]: [],
  [BookingStatus.CANCELLED]: [],
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
        inArray(bookings.status, [BookingStatus.PENDING, BookingStatus.ACCEPTED])
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
          status: BookingStatus.PENDING,
          direction: BookingDirection.VENUE_TO_ARTIST,
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
        persona: UserRole.ARTIST,
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

  // ─── Artist requests to perform at a venue event ─────────────────────────────
  requestToPerform: artistProcedure
    .input(requestToPerformSchema)
    .mutation(async ({ input, ctx }) => {
      // 1. Look up artist profile
      const artistProfile = await db.query.artistProfiles.findFirst({
        where: eq(artistProfiles.userId, ctx.userId),
      });
      if (!artistProfile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Artist profile not found' });
      }

      // 2. Fetch event
      const event = await db.query.events.findFirst({
        where: eq(events.id, input.eventId),
      });
      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }

      // 3. Resolve venue — prefer event.venueId, fallback to creator's venue profile
      let venueProfile = event.venueId
        ? await db.query.venueProfiles.findFirst({
            where: eq(venueProfiles.id, event.venueId),
          })
        : null;

      if (!venueProfile) {
        venueProfile = await db.query.venueProfiles.findFirst({
          where: eq(venueProfiles.userId, event.createdBy),
        });
      }

      if (!venueProfile) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This event is not associated with a venue',
        });
      }

      // 4. Dedup: no active booking (pending/accepted) for same artist+event
      const existingBooking = await db.query.bookings.findFirst({
        where: and(
          eq(bookings.artistId, artistProfile.id),
          eq(bookings.eventId, input.eventId),
          inArray(bookings.status, [BookingStatus.PENDING, BookingStatus.ACCEPTED])
        ),
      });
      if (existingBooking) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: "You've already applied to this event",
        });
      }

      // 5. Collaborator check: artist not already a collaborator
      const existingCollab = await db.query.eventCollaborators.findFirst({
        where: and(
          eq(eventCollaborators.eventId, input.eventId),
          eq(eventCollaborators.artistProfileId, ctx.userId)
        ),
      });
      if (existingCollab) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'You are already a collaborator on this event',
        });
      }

      // 6. Transaction: insert booking + eventCollaborator
      const result = await db.transaction(async (tx) => {
        const [booking] = await tx
          .insert(bookings)
          .values({
            artistId: artistProfile.id,
            venueId: venueProfile.id,
            eventId: input.eventId,
            status: BookingStatus.PENDING,
            direction: BookingDirection.ARTIST_TO_VENUE,
          })
          .returning();

        if (!booking)
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Booking insert failed',
          });

        await tx.insert(eventCollaborators).values({
          eventId: input.eventId,
          artistProfileId: ctx.userId,
          bookingId: booking.id,
        });

        return booking;
      });

      // 7. Notify venue
      await db.insert(notifications).values({
        userId: venueProfile.userId,
        type: 'booking_request',
        payload: {
          title: 'New Performance Request',
          body: `${artistProfile.stageName} requested to perform at "${event.title}"`,
          persona: UserRole.VENUE,
          route: `/bookings/${result.id}`,
        },
      });

      // 8. Return BookingSummary
      const [artistUser, venueUser] = await Promise.all([
        db.query.user.findFirst({
          where: eq(user.id, artistProfile.userId),
          columns: { image: true },
        }),
        db.query.user.findFirst({
          where: eq(user.id, venueProfile.userId),
          columns: { image: true },
        }),
      ]);

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
    const currentStatus = booking.status;
    const newStatus = input.status as BookingStatusType;

    if (!VALID_TRANSITIONS[currentStatus]?.includes(newStatus)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot transition from "${currentStatus}" to "${newStatus}"`,
      });
    }

    // Direction-aware transition restrictions:
    // The RECIPIENT of the booking can accept/reject.
    // The SENDER of the booking can withdraw from pending.
    // Either party can cancel from accepted.
    const isRecipient =
      (booking.direction === BookingDirection.VENUE_TO_ARTIST && isArtist) ||
      (booking.direction === BookingDirection.ARTIST_TO_VENUE && isVenue);
    const isSender =
      (booking.direction === BookingDirection.VENUE_TO_ARTIST && isVenue) ||
      (booking.direction === BookingDirection.ARTIST_TO_VENUE && isArtist);

    if (
      (newStatus === BookingStatus.ACCEPTED || newStatus === BookingStatus.REJECTED) &&
      !isRecipient
    ) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only the recipient can accept or reject a booking',
      });
    }
    if (
      newStatus === BookingStatus.CANCELLED &&
      currentStatus === BookingStatus.PENDING &&
      !isSender
    ) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only the sender can withdraw a pending booking',
      });
    }

    // 4. Update status (track who cancelled if cancelling)
    const [updated] = await db
      .update(bookings)
      .set({
        status: newStatus,
        updatedAt: new Date(),
        ...(newStatus === BookingStatus.CANCELLED ? { cancelledBy: ctx.userId } : {}),
      })
      .where(eq(bookings.id, input.id))
      .returning();

    if (!updated) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Update failed' });

    // 5. Side effect: on rejected/cancelled → remove eventCollaborator row
    if (newStatus === BookingStatus.REJECTED || newStatus === BookingStatus.CANCELLED) {
      await db.delete(eventCollaborators).where(eq(eventCollaborators.bookingId, input.id));
    }

    // 6. Create notification for other party
    const recipientUserId = isArtist ? booking.venue.userId : booking.artist.userId;
    const recipientPersona = isArtist ? UserRole.VENUE : UserRole.ARTIST;
    const actionLabel =
      newStatus === BookingStatus.ACCEPTED
        ? 'accepted'
        : newStatus === BookingStatus.REJECTED
          ? 'declined'
          : currentStatus === BookingStatus.PENDING
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
    let profileType: typeof UserRole.ARTIST | typeof UserRole.VENUE | null = null;

    if (role === UserRole.VENUE) {
      const vp = await db.query.venueProfiles.findFirst({
        where: eq(venueProfiles.userId, ctx.userId),
        columns: { id: true },
      });
      profileId = vp?.id ?? null;
      profileType = UserRole.VENUE;
    } else if (role === UserRole.ARTIST) {
      const ap = await db.query.artistProfiles.findFirst({
        where: eq(artistProfiles.userId, ctx.userId),
        columns: { id: true },
      });
      profileId = ap?.id ?? null;
      profileType = UserRole.ARTIST;
    }

    if (!profileId || !profileType) {
      return { bookings: [], total: 0 };
    }

    // Build where clause based on tab
    // Sent = bookings I initiated. Received = bookings sent to me.
    const conditions = [];

    if (input.tab === 'sent') {
      if (profileType === UserRole.VENUE) {
        // Venue sent invitations to artists
        conditions.push(
          eq(bookings.venueId, profileId),
          eq(bookings.direction, BookingDirection.VENUE_TO_ARTIST)
        );
      } else {
        // Artist sent applications to venues
        conditions.push(
          eq(bookings.artistId, profileId),
          eq(bookings.direction, BookingDirection.ARTIST_TO_VENUE)
        );
      }
    } else {
      // received
      if (profileType === UserRole.VENUE) {
        // Venue receives applications from artists
        conditions.push(
          eq(bookings.venueId, profileId),
          eq(bookings.direction, BookingDirection.ARTIST_TO_VENUE)
        );
      } else {
        // Artist receives invitations from venues
        conditions.push(
          eq(bookings.artistId, profileId),
          eq(bookings.direction, BookingDirection.VENUE_TO_ARTIST)
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
          cancelledByUser: { columns: { name: true } },
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
        cancelledByName: booking.cancelledByUser?.name ?? null,
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
        userId: r.userId,
        stageName: r.stageName,
        genre: r.genre,
        image: imageMap.get(r.userId) ?? null,
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

  // ─── Confirmed events (profile Bookings tab) ──────────────────────────────
  confirmedEvents: creatorProcedure.input(confirmedEventsSchema).query(async ({ input, ctx }) => {
    const role = ctx.currentRole;

    if (role === UserRole.ARTIST) {
      // Artist: events where I'm a collaborator with an accepted booking or direct add (no booking)
      const whereClause = and(
        eq(eventCollaborators.artistProfileId, ctx.userId),
        or(
          isNull(eventCollaborators.bookingId),
          sql`EXISTS (
              SELECT 1 FROM bookings b
              WHERE b.id = ${eventCollaborators.bookingId}
              AND b.status = 'accepted'
            )`
        )
      );

      const [countResult, rows] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(eventCollaborators)
          .where(whereClause)
          .then((r) => r[0]?.count ?? 0),
        db
          .select({
            id: events.id,
            title: events.title,
            coverImage: events.coverImage,
            dateStart: events.dateStart,
            dateEnd: events.dateEnd,
            category: events.category,
            venueAddress: events.venueAddress,
            status: events.status,
            bookingId: eventCollaborators.bookingId,
          })
          .from(eventCollaborators)
          .innerJoin(events, eq(events.id, eventCollaborators.eventId))
          .where(whereClause)
          .orderBy(desc(events.dateStart))
          .limit(input.limit)
          .offset(input.offset),
      ]);

      return {
        events: rows.map((e) => ({
          id: e.id,
          title: e.title,
          coverImage: e.coverImage ?? null,
          dateStart: e.dateStart.toISOString(),
          dateEnd: e.dateEnd?.toISOString() ?? null,
          category: e.category,
          venueAddress: e.venueAddress ?? null,
          status: e.status,
          bookingId: e.bookingId ?? null,
        })),
        total: countResult,
        hasNextPage: input.offset + input.limit < countResult,
      };
    }

    // Venue Bookings tab: events where I'm the tagged venue but NOT the creator.
    // Venue-created events belong in the Events tab instead.
    const vp = await db.query.venueProfiles.findFirst({
      where: eq(venueProfiles.userId, ctx.userId),
      columns: { id: true },
    });

    if (!vp) {
      return { events: [], total: 0, hasNextPage: false };
    }

    const whereClause = and(
      eq(events.venueId, vp.id),
      sql`${events.createdBy} != ${ctx.userId}`,
      sql`EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.event_id = ${events.id}
          AND b.venue_id = ${vp.id}
          AND b.direction = 'artist_to_venue'
          AND b.status = 'accepted'
        )`
    );

    const [countResult, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(events)
        .where(whereClause)
        .then((r) => r[0]?.count ?? 0),
      db
        .select({
          id: events.id,
          title: events.title,
          coverImage: events.coverImage,
          dateStart: events.dateStart,
          dateEnd: events.dateEnd,
          category: events.category,
          venueAddress: events.venueAddress,
          status: events.status,
          bookingId: sql<string | null>`(
            SELECT b.id FROM bookings b
            WHERE b.event_id = ${events.id}
            AND b.venue_id = ${vp.id}
            AND b.direction = 'artist_to_venue'
            AND b.status = 'accepted'
            LIMIT 1
          )`,
        })
        .from(events)
        .where(whereClause)
        .orderBy(desc(events.dateStart))
        .limit(input.limit)
        .offset(input.offset),
    ]);

    return {
      events: rows.map((e) => ({
        id: e.id,
        title: e.title,
        coverImage: e.coverImage ?? null,
        dateStart: e.dateStart.toISOString(),
        dateEnd: e.dateEnd?.toISOString() ?? null,
        category: e.category,
        venueAddress: e.venueAddress ?? null,
        status: e.status,
        bookingId: e.bookingId ?? null,
      })),
      total: countResult,
      hasNextPage: input.offset + input.limit < countResult,
    };
  }),
});
