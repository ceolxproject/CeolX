import { TRPCError } from '@trpc/server';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { eventCollaborators, events, savedEvents } from '@CeolX/db/schema/events';
import { artistProfiles, venueProfiles } from '@CeolX/db/schema/users';
import { createEventSchema, updateEventSchema } from '@CeolX/shared/validators';

import { creatorProcedure, protectedProcedure, publicProcedure } from '../../index';
import { syncEventToTypesense, removeEventFromTypesense } from '../../services/event-sync';

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
    if (event.status === 'archived' && event.createdBy !== ctx.session?.user?.id) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    const collaboratorUserIds = event.collaborators.map((c) => c.artistProfileId);

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
              eq(events.status, 'active'),
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
      isGigOpportunity: event.isGigOpportunity ?? false,
      adTitle: event.adTitle ?? null,
      adDescription: event.adDescription ?? null,
      venueId: event.venueId ?? null,
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
        type: creatorArtistProfile ? ('artist' as const) : ('venue' as const),
      },
      collaborators: event.collaborators.map((c) => {
        const profile = profileByUserId.get(c.artistProfileId);
        return {
          id: c.artistProfileId,
          stageName: profile?.stageName ?? 'Unknown Artist',
          genre: profile?.genre ?? null,
          profileImageUrl: userImageById.get(c.artistProfileId) ?? null,
          eventCount: countByUserId.get(c.artistProfileId) ?? 0,
        };
      }),
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
  const { collaborators, ...eventData } = input;

  // A venue event with no collaborators is automatically a gig opportunity —
  // artists can discover it and request to perform.
  const isVenue = ctx.session.user.currentRole === 'venue';
  const isGigOpportunity = isVenue && (!collaborators || collaborators.length === 0);

  // Ad fields are venue-only — strip them for non-venue creators
  if (!isVenue) {
    eventData.adTitle = undefined;
    eventData.adDescription = undefined;
  }

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
        isGigOpportunity,
        collectionId: eventData.collectionId ?? null,
        adTitle: eventData.adTitle ?? null,
        adDescription: eventData.adDescription ?? null,
        createdBy: ctx.userId,
        status: 'active',
      })
      .returning();

    const inserted = rows[0];
    if (!inserted) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Insert failed' });

    if (collaborators && collaborators.length > 0) {
      await tx.insert(eventCollaborators).values(
        collaborators.map((artistId) => ({
          eventId: inserted.id,
          artistProfileId: artistId,
        }))
      );
    }

    return inserted;
  });

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

    if (event.status === 'archived') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot edit an archived event' });
    }

    const { collaborators, ...updateData } = input.data;
    const isVenue = ctx.session.user.currentRole === 'venue';

    // Ad fields are venue-only — strip them for non-venue creators
    if (!isVenue) {
      updateData.adTitle = undefined;
      updateData.adDescription = undefined;
    }

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

      // Recompute isGigOpportunity when collaborators are explicitly updated:
      // a venue event with no collaborators becomes a gig opportunity, and one
      // with collaborators reverts to a normal event.
      if (collaborators !== undefined) {
        setValues.isGigOpportunity = isVenue && collaborators.length === 0;
      }

      // If event was removed by admin and creator is resubmitting, re-activate
      if (event.status === 'removed') {
        setValues.status = 'active';
        setValues.removalReason = null;
      }

      const rows = await tx
        .update(events)
        .set(setValues)
        .where(eq(events.id, input.id))
        .returning();

      const result = rows[0];
      if (!result) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Update failed' });

      // Replace collaborators if provided
      if (collaborators !== undefined) {
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

      return result;
    });

    // Sync to Typesense if event is active
    if (updated.status === 'active') {
      await syncEventToTypesense(updated).catch(() => {});
    } else {
      await removeEventFromTypesense(updated.id).catch(() => {});
    }

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

    if (event.status !== 'active') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only active events can be archived',
      });
    }

    const [updated] = await db
      .update(events)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(events.id, input.id))
      .returning();

    await removeEventFromTypesense(input.id).catch(() => {});

    return updated;
  });
