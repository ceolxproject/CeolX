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

import { recordEventView } from './view-tracking';

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

    const [
      collaboratorProfiles,
      collaboratorUsers,
      collaboratorEventCounts,
      attendeeCount,
      savedRow,
      relatedEvents,
      creatorArtistProfile,
      creatorVenueProfile,
    ] = await Promise.all([
      // stageName + genre for each collaborator
      collaboratorUserIds.length > 0
        ? db
            .select()
            .from(artistProfiles)
            .where(inArray(artistProfiles.userId, collaboratorUserIds))
        : Promise.resolve([]),

      // profile image (user.image) for each collaborator
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
    ]);

    const profileByUserId = new Map(collaboratorProfiles.map((p) => [p.userId, p]));
    const userImageById = new Map(collaboratorUsers.map((u) => [u.id, u.image]));
    const countByUserId = new Map(collaboratorEventCounts.map((r) => [r.artistProfileId, r.count]));

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
        imageUrl: event.creator?.image ?? null,
        type: creatorArtistProfile ? UserRole.ARTIST : UserRole.VENUE,
      },
      collaborators: event.collaborators.map((c) => {
        if (!c.artistProfileId) {
          // Non-platform artist (invited by name/email, no user account yet)
          return {
            id: c.id,
            stageName: c.invitedName ?? 'Invited Artist',
            genre: null,
            profileImageUrl: null,
            eventCount: 0,
            isExternal: true,
          };
        }
        const profile = profileByUserId.get(c.artistProfileId);
        return {
          id: c.artistProfileId,
          stageName: profile?.stageName ?? 'Unknown Artist',
          genre: profile?.genre ?? null,
          profileImageUrl: userImageById.get(c.artistProfileId) ?? null,
          eventCount: countByUserId.get(c.artistProfileId) ?? 0,
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
  const { collaborators, platformInvites, unregisteredCollaborators, ...eventData } = input;

  const isVenue = ctx.session.user.currentRole === UserRole.VENUE;

  // Venue events must have at least one confirmed platform collaborator
  if (isVenue && (!collaborators || collaborators.length === 0)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Venue events must have at least one confirmed collaborator',
    });
  }

  // Ad fields are venue-only — strip them for non-venue creators
  if (!isVenue) {
    eventData.adTitle = undefined;
    eventData.adDescription = undefined;
  }

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
        lat: eventData.lat?.toString() ?? '0',
        lng: eventData.lng?.toString() ?? '0',
        venueId: eventData.venueId ?? null,
        venueAddress: eventData.venueAddress ?? null,
        category: eventData.category,
        ticketLink: eventData.ticketLink ?? null,
        ticketPrice: eventData.ticketPrice ?? null,
        collectionId: eventData.collectionId ?? null,
        adTitle: eventData.adTitle ?? null,
        adDescription: eventData.adDescription ?? null,
        createdBy: ctx.userId,
        status: EventStatus.ACTIVE,
      })
      .returning();

    const inserted = rows[0];
    if (!inserted) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Insert failed' });

    // For venue events: create bookings + collaborator rows in the same transaction
    // For artist events: insert collaborators directly (no booking needed for own performance)
    if (collaborators && collaborators.length > 0) {
      if (isVenue) {
        // Look up venue profile for booking FK
        const venueProfile = await tx.query.venueProfiles.findFirst({
          where: eq(venueProfiles.userId, ctx.userId),
          columns: { id: true, venueName: true },
        });

        // Look up artist profiles by userId (collaborators array contains user IDs from artists.search)
        const artistProfileRows = await tx
          .select({
            id: artistProfiles.id,
            userId: artistProfiles.userId,
            stageName: artistProfiles.stageName,
          })
          .from(artistProfiles)
          .where(inArray(artistProfiles.userId, collaborators));

        if (!venueProfile)
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Venue profile not found' });

        for (const ap of artistProfileRows) {
          // Collaborators are confirmed performers — booking is auto-accepted
          const [booking] = await tx
            .insert(bookings)
            .values({
              artistId: ap.id,
              venueId: venueProfile.id,
              eventId: inserted.id,
              status: BookingStatus.ACCEPTED,
              direction: BookingDirection.VENUE_TO_ARTIST,
            })
            .returning();

          if (!booking)
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Booking insert failed',
            });

          await tx.insert(eventCollaborators).values({
            eventId: inserted.id,
            artistProfileId: ap.userId,
            bookingId: booking.id,
          });

          // Matrix A-13 — Artist auto-confirmed as a Venue's collaborator.
          pendingDispatches.push({
            trigger: NotificationTrigger.ADDED_AS_COLLABORATOR_TO_ARTIST,
            recipientUserId: ap.userId,
            vars: {
              eventId: inserted.id,
              eventTitle: inserted.title,
              venueName: venueProfile.venueName,
              date: formatNotificationDate(inserted.dateStart),
            },
          });
        }
      } else {
        // Artist adding collaborators to own event — no booking, direct insert
        await tx.insert(eventCollaborators).values(
          collaborators.map((artistId) => ({
            eventId: inserted.id,
            artistProfileId: artistId,
          }))
        );
      }
    }

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
      const confirmedSet = new Set(collaborators ?? []);
      const inviteUserIds = platformInvites.filter((id) => !confirmedSet.has(id));

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

    // Artist creates event with a venue → auto-create confirmed booking
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
            status: BookingStatus.ACCEPTED,
            direction: BookingDirection.ARTIST_TO_VENUE,
          })
          .returning();

        if (booking) {
          // Add artist as collaborator with booking link (for confirmedEvents query)
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

          // Off-matrix — Artist creating an event at this Venue's space
          // auto-confirms the booking. Flag for Pratiksha's matrix audit.
          pendingDispatches.push({
            trigger: NotificationTrigger.EVENT_HOSTED_AT_VENUE_TO_VENUE,
            recipientUserId: venueProfile.userId,
            vars: {
              eventId: inserted.id,
              eventTitle: inserted.title,
              artistName: artistProfile.stageName,
              venueName: venueProfile.venueName,
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

  // Sync to Typesense so event appears on map/feed immediately
  await syncEventToTypesense(event).catch(() => {
    // Non-blocking — event is in DB, Typesense sync can be retried
  });

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

    const { collaborators, platformInvites, unregisteredCollaborators, ...updateData } = input.data;
    const isVenue = ctx.session.user.currentRole === UserRole.VENUE;

    // Ad fields are venue-only — strip them for non-venue creators
    if (!isVenue) {
      updateData.adTitle = undefined;
      updateData.adDescription = undefined;
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
      if (updateData.lat !== undefined) setValues.lat = updateData.lat.toString();
      if (updateData.lng !== undefined) setValues.lng = updateData.lng.toString();
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

      // Update collaborators if provided — for venues, create bookings for new additions
      // Removal is handled through the booking flow (reject/withdraw/cancel), not event edit
      if (collaborators !== undefined) {
        if (isVenue) {
          // Get existing collaborator artist profile IDs (via their booking artist IDs)
          const existingCollabs = await tx.query.eventCollaborators.findMany({
            where: eq(eventCollaborators.eventId, input.id),
            columns: { artistProfileId: true, bookingId: true },
          });

          // Find which artist profile IDs already have collaborator rows
          // artistProfileId is user.id; collaborators array has artistProfiles.id
          // Look up artist profiles to map between the two
          const existingArtistUserIds = new Set(
            existingCollabs.map((c) => c.artistProfileId).filter((id): id is string => id !== null)
          );

          // Look up all requested artist profiles by userId (collaborators array contains user IDs)
          const requestedProfiles =
            collaborators.length > 0
              ? await tx
                  .select({
                    id: artistProfiles.id,
                    userId: artistProfiles.userId,
                    stageName: artistProfiles.stageName,
                  })
                  .from(artistProfiles)
                  .where(inArray(artistProfiles.userId, collaborators))
              : [];

          // Only create bookings for truly new collaborators
          const newProfiles = requestedProfiles.filter(
            (ap) => !existingArtistUserIds.has(ap.userId)
          );

          if (newProfiles.length > 0) {
            const venueProfile = await tx.query.venueProfiles.findFirst({
              where: eq(venueProfiles.userId, ctx.userId),
              columns: { id: true, venueName: true },
            });
            if (!venueProfile)
              throw new TRPCError({ code: 'NOT_FOUND', message: 'Venue profile not found' });

            for (const ap of newProfiles) {
              // Collaborators are confirmed performers — booking is auto-accepted
              const [booking] = await tx
                .insert(bookings)
                .values({
                  artistId: ap.id,
                  venueId: venueProfile.id,
                  eventId: input.id,
                  status: BookingStatus.ACCEPTED,
                  direction: BookingDirection.VENUE_TO_ARTIST,
                })
                .returning();

              if (!booking)
                throw new TRPCError({
                  code: 'INTERNAL_SERVER_ERROR',
                  message: 'Booking insert failed',
                });

              await tx.insert(eventCollaborators).values({
                eventId: input.id,
                artistProfileId: ap.userId,
                bookingId: booking.id,
              });

              // Matrix A-13 — Artist auto-confirmed as a Venue's collaborator.
              pendingDispatches.push({
                trigger: NotificationTrigger.ADDED_AS_COLLABORATOR_TO_ARTIST,
                recipientUserId: ap.userId,
                vars: {
                  eventId: input.id,
                  eventTitle: result.title,
                  venueName: venueProfile.venueName,
                  date: formatNotificationDate(result.dateStart),
                },
              });
            }
          }
        } else {
          // Artist editing own event — simple replace (no booking flow)
          await tx.delete(eventCollaborators).where(eq(eventCollaborators.eventId, input.id));
          if (collaborators.length > 0) {
            await tx.insert(eventCollaborators).values(
              collaborators.map((artistId) => ({
                eventId: input.id,
                artistProfileId: artistId,
              }))
            );
          }
        }
      }

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

    // Sync to Typesense if event is active
    if (updated.status === EventStatus.ACTIVE) {
      await syncEventToTypesense(updated).catch(() => {});
    } else {
      await removeEventFromTypesense(updated.id).catch(() => {});
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
