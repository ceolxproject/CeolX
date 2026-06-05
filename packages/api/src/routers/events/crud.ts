import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { bookings } from '@CeolX/db/schema/bookings';
import { eventCollaborators, events, savedEvents } from '@CeolX/db/schema/events';
import { artistProfiles, venueProfiles } from '@CeolX/db/schema/users';
import {
  BookingDirection,
  BookingStatus,
  EventStatus,
  formatNotificationDate,
  NotificationTrigger,
  UserRole,
} from '@CeolX/shared';
import {
  createEventSchema,
  myEventsQuerySchema,
  updateEventSchema,
} from '@CeolX/shared/validators';

import type { DispatchNotificationInput } from '../../context';
import { creatorProcedure, protectedProcedure, publicProcedure } from '../../index';
import { syncEventToTypesense, removeEventFromTypesense } from '../../services/event-sync';

import { resolveEventCoordinates, resolveProfileImageUrl } from './helpers';
import { recordEventView } from './view-tracking';

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Withdraw the current pending artist→venue request for an event (if any) and
 * detach its collaborator rows. Used when an artist switches or drops the
 * registered venue on edit, so a stale request can't linger. (Asana 1215189395180422)
 */
async function cancelPendingVenueRequest(tx: DbTransaction, eventId: string, userId: string) {
  const prior = await tx.query.bookings.findFirst({
    where: and(
      eq(bookings.eventId, eventId),
      eq(bookings.direction, BookingDirection.ARTIST_TO_VENUE),
      eq(bookings.status, BookingStatus.PENDING)
    ),
  });
  if (!prior) return;
  await tx
    .update(bookings)
    .set({ status: BookingStatus.CANCELLED, cancelledBy: userId, updatedAt: new Date() })
    .where(eq(bookings.id, prior.id));
  await tx.delete(eventCollaborators).where(eq(eventCollaborators.bookingId, prior.id));
}

/** Look up a registered venue's stored pin so events can inherit it. */
const lookupVenueCoords = async (venueId: string) => {
  const [venue] = await db
    .select({ lat: venueProfiles.lat, lng: venueProfiles.lng })
    .from(venueProfiles)
    .where(eq(venueProfiles.id, venueId))
    .limit(1);
  return venue ?? null;
};

/**
 * A row in `event_collaborators` only counts as a *confirmed performer* — i.e.
 * something the event detail screen should surface in its Artist / Performing
 * Artist sections — when it is a real platform artist (so `artistProfileId` is
 * set, which excludes venue-participant rows and unregistered email invites)
 * AND it either has no booking (legacy auto-confirmed direct-add) or a booking
 * the artist has accepted. Pending invites, external email invites, and venue
 * rows are intentionally hidden until accepted. Mirrors the rule in
 * `bookings.confirmedEvents`. See CLAUDE.md (confirmed collaborator = ACCEPTED).
 */
export function isConfirmedPerformer(
  collaborator: { artistProfileId: string | null; bookingId: string | null },
  acceptedBookingIds: Set<string>
): boolean {
  if (collaborator.artistProfileId === null) return false;
  return collaborator.bookingId === null || acceptedBookingIds.has(collaborator.bookingId);
}

/**
 * An *external invitee* is an outside-platform performer added by name/email:
 * `artistProfileId` is null (no account), `venueProfileId` is null (not a venue
 * participant row), and an `invitedName` was supplied. These can't accept an
 * invite in-app, so we surface them as confirmed-looking, **non-tappable** cards
 * (placeholder image, no /artist/:id link). Excludes venue-participant rows,
 * which are also account-less but carry a `venueProfileId`.
 */
export function isExternalInvitee(collaborator: {
  artistProfileId: string | null;
  venueProfileId: string | null;
  invitedName: string | null;
}): boolean {
  return (
    collaborator.artistProfileId === null &&
    collaborator.venueProfileId === null &&
    collaborator.invitedName !== null
  );
}

export const byId = publicProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input, ctx }) => {
    const userId = ctx.session?.user?.id ?? null;

    const event = await db.query.events.findFirst({
      where: eq(events.id, input.id),
      with: {
        collaborators: true,
        creator: true,
        venue: true,
        collection: true,
      },
    });

    if (!event) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    // Archived events only visible to the creator
    if (event.status === EventStatus.ARCHIVED && event.createdBy !== ctx.session?.user?.id) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    // Fire-and-forget per-event view tracking (M11-T3). Helper is best-effort
    // and skips anonymous viewers + the creator themselves.
    void recordEventView({
      eventId: event.id,
      viewerUserId: userId,
      eventCreatorId: event.createdBy,
    });

    const collaboratorUserIds = event.collaborators
      .map((c) => c.artistProfileId)
      .filter((id): id is string => id !== null);

    const collaboratorBookingIds = event.collaborators
      .map((c) => c.bookingId)
      .filter((id): id is string => id !== null);

    const [
      collaboratorProfiles,
      collaboratorUsers,
      collaboratorEventCounts,
      attendeeCount,
      savedRow,
      relatedEvents,
      creatorArtistProfile,
      creatorVenueProfile,
      acceptedBookings,
    ] = await Promise.all([
      // stageName + genre for each collaborator
      collaboratorUserIds.length > 0
        ? db
            .select()
            .from(artistProfiles)
            .where(inArray(artistProfiles.userId, collaboratorUserIds))
        : Promise.resolve([]),

      // user.image for each collaborator — only a fallback; the uploaded
      // profile picture in artist_profiles.profileImageUrl takes precedence
      // (see resolveProfileImageUrl). Asana 1215429148917917
      collaboratorUserIds.length > 0
        ? db
            .select({ id: user.id, image: user.image })
            .from(user)
            .where(inArray(user.id, collaboratorUserIds))
        : Promise.resolve([]),

      // event count per collaborator across all events they're on
      collaboratorUserIds.length > 0
        ? db
            .select({
              artistProfileId: eventCollaborators.artistProfileId,
              count: sql<number>`count(*)::int`,
            })
            .from(eventCollaborators)
            .where(inArray(eventCollaborators.artistProfileId, collaboratorUserIds))
            .groupBy(eventCollaborators.artistProfileId)
        : Promise.resolve([]),

      // total saves == "attending" proxy
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(savedEvents)
        .where(eq(savedEvents.eventId, input.id))
        .then((rows) => rows[0]?.count ?? 0),

      // has current user saved this event?
      userId
        ? db.query.savedEvents.findFirst({
            where: and(eq(savedEvents.userId, userId), eq(savedEvents.eventId, input.id)),
          })
        : Promise.resolve(null),

      // related events from same collection (up to 5)
      event.collectionId
        ? db.query.events.findMany({
            where: and(
              eq(events.collectionId, event.collectionId),
              eq(events.status, EventStatus.ACTIVE),
              ne(events.id, input.id)
            ),
            columns: {
              id: true,
              title: true,
              dateStart: true,
              category: true,
              coverImage: true,
              venueAddress: true,
            },
            limit: 5,
          })
        : Promise.resolve([]),

      // creator profile — try artist first
      db.query.artistProfiles.findFirst({
        where: eq(artistProfiles.userId, event.createdBy),
      }),

      // creator profile — try venue
      db.query.venueProfiles.findFirst({
        where: eq(venueProfiles.userId, event.createdBy),
      }),

      // which of this event's collaborator bookings are accepted — drives the
      // confirmed-performer filter so pending invites stay hidden
      collaboratorBookingIds.length > 0
        ? db
            .select({ id: bookings.id })
            .from(bookings)
            .where(
              and(
                inArray(bookings.id, collaboratorBookingIds),
                eq(bookings.status, BookingStatus.ACCEPTED)
              )
            )
        : Promise.resolve([]),
    ]);

    const profileByUserId = new Map(collaboratorProfiles.map((p) => [p.userId, p]));
    const userImageById = new Map(collaboratorUsers.map((u) => [u.id, u.image]));
    const countByUserId = new Map(collaboratorEventCounts.map((r) => [r.artistProfileId, r.count]));

    const acceptedBookingIds = new Set(acceptedBookings.map((b) => b.id));

    // Rows the UI may show: confirmed performers (accepted bookings + legacy
    // auto-confirmed direct-adds) and outside-platform invitees (shown as
    // non-tappable name cards). Excludes pending platform invites and
    // venue-participant rows. (Asana — event detail showed broken "Invited
    // Artist" cards that navigated nowhere.)
    const displayCollaborators = event.collaborators.filter(
      (c) => isConfirmedPerformer(c, acceptedBookingIds) || isExternalInvitee(c)
    );

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      dateStart: event.dateStart.toISOString(),
      dateEnd: event.dateEnd?.toISOString() ?? null,
      lat: parseFloat(event.lat),
      lng: parseFloat(event.lng),
      venueAddress: event.venueAddress ?? null,
      category: event.category,
      coverImage: event.coverImage ?? null,
      coverImageUrl: event.coverImage ?? null,
      ticketLink: event.ticketLink ?? null,
      ticketPrice: event.ticketPrice ?? null,
      adTitle: event.adTitle ?? null,
      adDescription: event.adDescription ?? null,
      venueId: event.venueId ?? null,
      venueUserId: event.venue?.userId ?? null,
      collectionId: event.collectionId ?? null,
      status: event.status,
      removalReason: event.removalReason ?? null,
      creator: {
        id: event.createdBy,
        name:
          creatorArtistProfile?.stageName ??
          creatorVenueProfile?.venueName ??
          event.creator?.name ??
          'Unknown',
        imageUrl: resolveProfileImageUrl(
          creatorArtistProfile ?? creatorVenueProfile,
          event.creator?.image
        ),
        type: creatorArtistProfile ? UserRole.ARTIST : UserRole.VENUE,
      },
      // Confirmed performers + external invitees. Platform rows carry the
      // artist's user id as `id` (a valid /artist/:id target); external rows
      // carry the collaborator row id and `isExternal: true` so the client
      // renders a non-tappable placeholder card.
      collaborators: displayCollaborators.map((c) => {
        if (!c.artistProfileId) {
          // Outside-platform invitee — name only, no account/profile to link to.
          return {
            id: c.id,
            stageName: c.invitedName ?? 'Invited Artist',
            genre: null,
            profileImageUrl: null,
            eventCount: 0,
            isExternal: true,
          };
        }
        const artistUserId = c.artistProfileId;
        const profile = profileByUserId.get(artistUserId);
        return {
          id: artistUserId,
          stageName: profile?.stageName ?? 'Unknown Artist',
          // `genres` (text[]) is the live field; fall back to the deprecated
          // singular `genre` column for legacy profiles.
          genre: profile?.genres?.[0] ?? profile?.genre ?? null,
          profileImageUrl: resolveProfileImageUrl(profile, userImageById.get(artistUserId)),
          eventCount: countByUserId.get(artistUserId) ?? 0,
          isExternal: false,
        };
      }),
      unregisteredCollaborators: event.collaborators
        .filter((c) => !c.artistProfileId)
        .map((c) => ({ name: c.invitedName ?? '', email: c.invitedEmail ?? '' })),
      collection: event.collection
        ? { id: event.collection.id, name: event.collection.name }
        : null,
      isSaved: !!savedRow,
      attendeeCount,
      relatedEvents: relatedEvents.map((e) => ({
        id: e.id,
        title: e.title,
        dateStart: e.dateStart.toISOString(),
        category: e.category,
        coverImageUrl: e.coverImage ?? null,
        venueAddress: e.venueAddress ?? null,
      })),
    };
  });

export const create = creatorProcedure.input(createEventSchema).mutation(async ({ input, ctx }) => {
  const { platformInvites, unregisteredCollaborators, ...eventData } = input;

  const isVenue = ctx.session.user.currentRole === UserRole.VENUE;

  // Ad fields are venue-only — strip them for non-venue creators
  if (!isVenue) {
    eventData.adTitle = undefined;
    eventData.adDescription = undefined;
  }

  // An artist tagging a registered venue must get the venue's consent first: the
  // event is held at pending_review (off map/feed) until the venue accepts the
  // request. A venue creating its own event, or an artist using a free-text
  // address (no profile to consent), goes live immediately. (Asana 1215189395180422)
  const heldForVenueApproval = !isVenue && !!eventData.venueId;

  // Resolve real coordinates before persisting — explicit pin first, else the
  // selected venue's stored pin. Throws if neither resolves, so we never write
  // the (0,0) fallback that made events vanish from the map and feed.
  const { lat, lng } = await resolveEventCoordinates(eventData, lookupVenueCoords);

  // Collected inside the transaction; fired after commit so a rollback
  // doesn't leave us with phantom notifications. See M7-T1 dispatcher.
  const pendingDispatches: DispatchNotificationInput[] = [];

  const event = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(events)
      .values({
        title: eventData.title,
        description: eventData.description,
        coverImage: eventData.coverImage ?? null,
        dateStart: new Date(eventData.dateStart),
        dateEnd: eventData.dateEnd ? new Date(eventData.dateEnd) : null,
        lat,
        lng,
        venueId: eventData.venueId ?? null,
        venueAddress: eventData.venueAddress ?? null,
        category: eventData.category,
        ticketLink: eventData.ticketLink ?? null,
        ticketPrice: eventData.ticketPrice ?? null,
        collectionId: eventData.collectionId ?? null,
        adTitle: eventData.adTitle ?? null,
        adDescription: eventData.adDescription ?? null,
        createdBy: ctx.userId,
        status: heldForVenueApproval ? EventStatus.PENDING_REVIEW : EventStatus.ACTIVE,
      })
      .returning();

    const inserted = rows[0];
    if (!inserted) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Insert failed' });

    // Insert non-platform (invited) artists as eventCollaborators rows
    if (unregisteredCollaborators && unregisteredCollaborators.length > 0) {
      await tx.insert(eventCollaborators).values(
        unregisteredCollaborators.map((invite) => ({
          eventId: inserted.id,
          invitedName: invite.name,
          invitedEmail: invite.email,
        }))
      );
    }

    // Platform invites (venue only) — create pending bookings for invited artists
    if (platformInvites && platformInvites.length > 0 && isVenue) {
      const inviteUserIds = platformInvites;

      if (inviteUserIds.length > 0) {
        const venueProfile = await tx.query.venueProfiles.findFirst({
          where: eq(venueProfiles.userId, ctx.userId),
          columns: { id: true, venueName: true },
        });

        const inviteProfiles = await tx
          .select({
            id: artistProfiles.id,
            userId: artistProfiles.userId,
            stageName: artistProfiles.stageName,
          })
          .from(artistProfiles)
          .where(inArray(artistProfiles.userId, inviteUserIds));

        if (venueProfile) {
          for (const ap of inviteProfiles) {
            const [booking] = await tx
              .insert(bookings)
              .values({
                artistId: ap.id,
                venueId: venueProfile.id,
                eventId: inserted.id,
                status: BookingStatus.PENDING,
                direction: BookingDirection.VENUE_TO_ARTIST,
              })
              .returning();

            if (booking) {
              await tx.insert(eventCollaborators).values({
                eventId: inserted.id,
                artistProfileId: ap.userId,
                bookingId: booking.id,
              });

              // Matrix A-09 — Venue invited Artist (booking is PENDING here).
              pendingDispatches.push({
                trigger: NotificationTrigger.BOOKING_INVITE_TO_ARTIST,
                recipientUserId: ap.userId,
                vars: {
                  bookingId: booking.id,
                  venueName: venueProfile.venueName,
                  artistName: ap.stageName,
                  eventTitle: inserted.title,
                  date: formatNotificationDate(inserted.dateStart),
                },
              });
            }
          }
        }
      }
    }

    // Artist tags a registered venue → create a PENDING request the venue must
    // accept. The event stays pending_review until then; the venue sees the
    // request under Requests, and accepting it (bookings.update) flips the event
    // live. Mirrors the venue→artist invite rule. (Asana 1215189395180422)
    if (!isVenue && eventData.venueId) {
      const venueProfile = await tx.query.venueProfiles.findFirst({
        where: eq(venueProfiles.id, eventData.venueId),
        columns: { id: true, userId: true, venueName: true },
      });

      const artistProfile = await tx.query.artistProfiles.findFirst({
        where: eq(artistProfiles.userId, ctx.userId),
        columns: { id: true, stageName: true },
      });

      if (venueProfile && artistProfile) {
        const [booking] = await tx
          .insert(bookings)
          .values({
            artistId: artistProfile.id,
            venueId: venueProfile.id,
            eventId: inserted.id,
            status: BookingStatus.PENDING,
            direction: BookingDirection.ARTIST_TO_VENUE,
          })
          .returning();

        if (booking) {
          // Link both participants to the pending booking. confirmedEvents only
          // surfaces rows whose booking is accepted, so neither side shows this
          // as confirmed until the venue accepts.
          await tx.insert(eventCollaborators).values([
            {
              eventId: inserted.id,
              artistProfileId: ctx.userId,
              bookingId: booking.id,
            },
            {
              eventId: inserted.id,
              venueProfileId: venueProfile.id,
              bookingId: booking.id,
            },
          ]);

          // V-09 — Venue received a booking request from the artist.
          pendingDispatches.push({
            trigger: NotificationTrigger.BOOKING_REQUEST_TO_VENUE,
            recipientUserId: venueProfile.userId,
            vars: {
              bookingId: booking.id,
              venueName: venueProfile.venueName,
              artistName: artistProfile.stageName,
              eventTitle: inserted.title,
              date: formatNotificationDate(inserted.dateStart),
            },
          });
        }
      }
    }

    return inserted;
  });

  // Fire all collected dispatches after the transaction commits — a rollback
  // would leave us with phantom inbox rows + push notifications otherwise.
  await Promise.all(pendingDispatches.map((d) => ctx.dispatchNotification(d)));

  // Sync to Typesense so the event appears on map/feed immediately. Skip while
  // held for venue approval — a pending_review event must stay off the map/feed
  // until the venue accepts (bookings.update syncs it then). Non-blocking, but
  // we must NOT swallow the error silently: a failed sync means a live event is
  // invisible, so the cause needs to surface in logs for ops to act on.
  if (event.status === EventStatus.ACTIVE) {
    await syncEventToTypesense(event).catch((err: unknown) => {
      console.warn(
        `[events.create] Typesense sync failed for event ${event.id} — it will not appear on map/feed until re-synced:`,
        err instanceof Error ? `${err.name}: ${err.message}` : err
      );
    });
  }

  return event;
});

export const update = protectedProcedure
  .input(updateEventSchema)
  .mutation(async ({ input, ctx }) => {
    const event = await db.query.events.findFirst({
      where: eq(events.id, input.id),
    });

    if (!event) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    if (event.createdBy !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only edit your own events' });
    }

    if (event.status === EventStatus.ARCHIVED) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot edit an archived event' });
    }

    const { platformInvites, unregisteredCollaborators, ...updateData } = input.data;
    const isVenue = ctx.session.user.currentRole === UserRole.VENUE;

    // Ad fields are venue-only — strip them for non-venue creators
    if (!isVenue) {
      updateData.adTitle = undefined;
      updateData.adDescription = undefined;
    }

    // An artist adding/switching to a registered venue on edit must get that
    // venue's consent, exactly like create: hold the event at pending_review and
    // raise a pending request. Dropping the venue from a held event releases it
    // back to active. (Asana 1215189395180422)
    const addsRegisteredVenue =
      !isVenue &&
      updateData.venueId !== undefined &&
      updateData.venueId !== null &&
      updateData.venueId !== event.venueId;
    const releasesHeldVenue =
      !isVenue &&
      !addsRegisteredVenue &&
      event.status === EventStatus.PENDING_REVIEW &&
      updateData.venueId !== undefined &&
      updateData.venueId !== event.venueId;

    // Resolve coordinates: an explicit pin always wins; otherwise, if the
    // creator switches to a different registered venue, inherit that venue's
    // stored pin so the event's location stays consistent. Never write (0,0).
    let resolvedCoords: { lat: string; lng: string } | null = null;
    if (updateData.lat !== undefined && updateData.lng !== undefined) {
      resolvedCoords = { lat: updateData.lat.toString(), lng: updateData.lng.toString() };
    } else if (updateData.venueId !== undefined && updateData.venueId !== event.venueId) {
      const venue = await lookupVenueCoords(updateData.venueId);
      if (venue && venue.lat !== null && venue.lng !== null) {
        resolvedCoords = { lat: venue.lat, lng: venue.lng };
      }
    }

    // Collected inside the transaction; fired after commit so a rollback
    // doesn't leave us with phantom notifications.
    const pendingDispatches: DispatchNotificationInput[] = [];

    const updated = await db.transaction(async (tx) => {
      // Build the update object — only set provided fields
      const setValues: Record<string, unknown> = { updatedAt: new Date() };
      if (updateData.title !== undefined) setValues.title = updateData.title;
      if (updateData.description !== undefined) setValues.description = updateData.description;
      if (updateData.coverImage !== undefined) setValues.coverImage = updateData.coverImage;
      if (updateData.dateStart !== undefined) setValues.dateStart = new Date(updateData.dateStart);
      if (updateData.dateEnd !== undefined) setValues.dateEnd = new Date(updateData.dateEnd);
      if (resolvedCoords) {
        setValues.lat = resolvedCoords.lat;
        setValues.lng = resolvedCoords.lng;
      }
      if (updateData.venueId !== undefined) setValues.venueId = updateData.venueId;
      if (updateData.venueAddress !== undefined) setValues.venueAddress = updateData.venueAddress;
      if (updateData.category !== undefined) setValues.category = updateData.category;
      if (updateData.ticketLink !== undefined) setValues.ticketLink = updateData.ticketLink;
      if (updateData.ticketPrice !== undefined) setValues.ticketPrice = updateData.ticketPrice;
      if (updateData.collectionId !== undefined) setValues.collectionId = updateData.collectionId;
      if (updateData.adTitle !== undefined) setValues.adTitle = updateData.adTitle;
      if (updateData.adDescription !== undefined)
        setValues.adDescription = updateData.adDescription;

      // If event was removed by admin and creator is resubmitting, re-activate
      const isResubmit = event.status === EventStatus.REMOVED;
      if (isResubmit) {
        setValues.status = EventStatus.ACTIVE;
        setValues.removalReason = null;
      }

      // Hold for venue approval / release back to live based on the venue change.
      if (addsRegisteredVenue) {
        setValues.status = EventStatus.PENDING_REVIEW;
      } else if (releasesHeldVenue) {
        setValues.status = EventStatus.ACTIVE;
      }

      const rows = await tx
        .update(events)
        .set(setValues)
        .where(eq(events.id, input.id))
        .returning();

      const result = rows[0];
      if (!result) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Update failed' });

      if (isResubmit) {
        // Matrix A-16 / V-15 — confirm resubmission to the creator. Queued
        // here, fired post-commit alongside any collaborator dispatches.
        pendingDispatches.push({
          trigger: isVenue
            ? NotificationTrigger.EVENT_RESUBMITTED_TO_VENUE
            : NotificationTrigger.EVENT_RESUBMITTED_TO_ARTIST,
          recipientUserId: ctx.userId,
          vars: {
            eventId: result.id,
            eventTitle: result.title,
          },
        });
      }

      // Artist added/switched a registered venue → cancel any prior pending venue
      // request and raise a fresh one. The event is already held at pending_review
      // (setValues above); accepting the request later flips it live.
      if (addsRegisteredVenue && updateData.venueId) {
        const venueProfile = await tx.query.venueProfiles.findFirst({
          where: eq(venueProfiles.id, updateData.venueId),
          columns: { id: true, userId: true, venueName: true },
        });
        const artistProfile = await tx.query.artistProfiles.findFirst({
          where: eq(artistProfiles.userId, ctx.userId),
          columns: { id: true, stageName: true },
        });

        if (venueProfile && artistProfile) {
          await cancelPendingVenueRequest(tx, input.id, ctx.userId);

          const [booking] = await tx
            .insert(bookings)
            .values({
              artistId: artistProfile.id,
              venueId: venueProfile.id,
              eventId: input.id,
              status: BookingStatus.PENDING,
              direction: BookingDirection.ARTIST_TO_VENUE,
            })
            .returning();

          if (booking) {
            await tx.insert(eventCollaborators).values([
              { eventId: input.id, artistProfileId: ctx.userId, bookingId: booking.id },
              { eventId: input.id, venueProfileId: venueProfile.id, bookingId: booking.id },
            ]);

            pendingDispatches.push({
              trigger: NotificationTrigger.BOOKING_REQUEST_TO_VENUE,
              recipientUserId: venueProfile.userId,
              vars: {
                bookingId: booking.id,
                venueName: venueProfile.venueName,
                artistName: artistProfile.stageName,
                eventTitle: result.title,
                date: formatNotificationDate(result.dateStart),
              },
            });
          }
        }
      } else if (releasesHeldVenue) {
        // Venue dropped from a held event → withdraw the pending request; the
        // event is released to active by setValues above + Typesense sync below.
        await cancelPendingVenueRequest(tx, input.id, ctx.userId);
      }

      // Confirmed collaborators are no longer set from the event form — a venue
      // performer becomes confirmed only by accepting a pending invite through
      // the booking flow. Edits therefore never touch confirmed collaborator
      // rows; existing ones (incl. legacy auto-confirmed performers) are left
      // intact. Only the invite paths below are managed here.

      // Update non-platform (invited) collaborators — replace all on edit
      if (unregisteredCollaborators !== undefined) {
        // Remove existing invited-only rows (artistProfileId IS NULL)
        const existingInvited = await tx.query.eventCollaborators.findMany({
          where: and(
            eq(eventCollaborators.eventId, input.id),
            sql`${eventCollaborators.artistProfileId} IS NULL`
          ),
          columns: { id: true },
        });
        if (existingInvited.length > 0) {
          await tx.delete(eventCollaborators).where(
            inArray(
              eventCollaborators.id,
              existingInvited.map((r) => r.id)
            )
          );
        }

        if (unregisteredCollaborators.length > 0) {
          await tx.insert(eventCollaborators).values(
            unregisteredCollaborators.map((invite) => ({
              eventId: input.id,
              invitedName: invite.name,
              invitedEmail: invite.email,
            }))
          );
        }
      }

      // Platform invites (venue only) — create pending bookings for newly invited artists
      if (platformInvites !== undefined && platformInvites.length > 0 && isVenue) {
        const existingCollabs = await tx.query.eventCollaborators.findMany({
          where: eq(eventCollaborators.eventId, input.id),
          columns: { artistProfileId: true },
        });
        const existingArtistUserIds = new Set(
          existingCollabs.map((c) => c.artistProfileId).filter((id): id is string => id !== null)
        );

        const newInviteUserIds = platformInvites.filter((id) => !existingArtistUserIds.has(id));

        if (newInviteUserIds.length > 0) {
          const venueProfile = await tx.query.venueProfiles.findFirst({
            where: eq(venueProfiles.userId, ctx.userId),
            columns: { id: true, venueName: true },
          });

          const inviteProfiles = await tx
            .select({
              id: artistProfiles.id,
              userId: artistProfiles.userId,
              stageName: artistProfiles.stageName,
            })
            .from(artistProfiles)
            .where(inArray(artistProfiles.userId, newInviteUserIds));

          if (venueProfile) {
            for (const ap of inviteProfiles) {
              const [booking] = await tx
                .insert(bookings)
                .values({
                  artistId: ap.id,
                  venueId: venueProfile.id,
                  eventId: input.id,
                  status: BookingStatus.PENDING,
                  direction: BookingDirection.VENUE_TO_ARTIST,
                })
                .returning();

              if (booking) {
                await tx.insert(eventCollaborators).values({
                  eventId: input.id,
                  artistProfileId: ap.userId,
                  bookingId: booking.id,
                });

                // Matrix A-09 — Venue invited Artist (booking is PENDING here).
                pendingDispatches.push({
                  trigger: NotificationTrigger.BOOKING_INVITE_TO_ARTIST,
                  recipientUserId: ap.userId,
                  vars: {
                    bookingId: booking.id,
                    venueName: venueProfile.venueName,
                    artistName: ap.stageName,
                    eventTitle: result.title,
                    date: formatNotificationDate(result.dateStart),
                  },
                });
              }
            }
          }
        }
      }

      return result;
    });

    // Sync to Typesense if event is active. Non-blocking, but log failures —
    // a silently failed sync leaves the event out of the map/feed.
    if (updated.status === EventStatus.ACTIVE) {
      await syncEventToTypesense(updated).catch((err: unknown) => {
        console.warn(
          `[events.update] Typesense sync failed for event ${updated.id}:`,
          err instanceof Error ? `${err.name}: ${err.message}` : err
        );
      });
    } else {
      await removeEventFromTypesense(updated.id).catch((err: unknown) => {
        console.warn(
          `[events.update] Typesense removal failed for event ${updated.id}:`,
          err instanceof Error ? `${err.name}: ${err.message}` : err
        );
      });
    }

    // Fire collected dispatches after the transaction commits.
    await Promise.all(pendingDispatches.map((d) => ctx.dispatchNotification(d)));

    return updated;
  });

export const archive = protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    const event = await db.query.events.findFirst({
      where: eq(events.id, input.id),
    });

    if (!event) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    if (event.createdBy !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only archive your own events' });
    }

    if (event.status !== EventStatus.ACTIVE) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only active events can be archived',
      });
    }

    const [updated] = await db
      .update(events)
      .set({ status: EventStatus.ARCHIVED, updatedAt: new Date() })
      .where(eq(events.id, input.id))
      .returning();

    await removeEventFromTypesense(input.id).catch(() => {});

    return updated;
  });

// ─── My Events ───────────────────────────────────────────────────────────────

export const getMyEvents = creatorProcedure
  .input(myEventsQuerySchema)
  .query(async ({ input, ctx }) => {
    const { limit, offset } = input;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: events.id,
          title: events.title,
          coverImage: events.coverImage,
          dateStart: events.dateStart,
          dateEnd: events.dateEnd,
          category: events.category,
          status: events.status,
          rejectionReason: events.rejectionReason,
          removalReason: events.removalReason,
          venueAddress: events.venueAddress,
          createdAt: events.createdAt,
          // M11-T3 — saves count for the "X Joined" badge
          joinedCount: sql<number>`(SELECT count(*)::int FROM ${savedEvents} WHERE ${savedEvents.eventId} = ${events.id})`,
        })
        .from(events)
        .where(eq(events.createdBy, ctx.userId))
        .orderBy(desc(events.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(events)
        .where(eq(events.createdBy, ctx.userId)),
    ]);

    const totalCount = countResult[0]?.count ?? 0;

    return {
      events: rows.map((e) => ({
        ...e,
        dateStart: e.dateStart.toISOString(),
        dateEnd: e.dateEnd?.toISOString() ?? null,
        coverImage: e.coverImage ?? null,
        rejectionReason: e.rejectionReason ?? null,
        removalReason: e.removalReason ?? null,
        venueAddress: e.venueAddress ?? null,
      })),
      totalCount,
      hasNextPage: offset + limit < totalCount,
    };
  });
