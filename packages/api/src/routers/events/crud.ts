import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { eventCollaborators, events } from '@CeolX/db/schema/events';
import { createEventSchema, updateEventSchema } from '@CeolX/shared/validators';

import { creatorProcedure, protectedProcedure, publicProcedure } from '../../index';
import { syncEventToTypesense, removeEventFromTypesense } from '../../services/event-sync';

export const byId = publicProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input, ctx }) => {
    const event = await db.query.events.findFirst({
      where: eq(events.id, input.id),
      with: { collaborators: true },
    });

    if (!event) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    // Archived events only visible to the creator
    if (event.status === 'archived' && event.createdBy !== ctx.session?.user?.id) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
    }

    return event;
  });

export const create = creatorProcedure.input(createEventSchema).mutation(async ({ input, ctx }) => {
  // Only venues can create gig opportunities
  if (input.isGigOpportunity && ctx.session.user.currentRole !== 'venue') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only venues can create gig opportunities',
    });
  }

  const { collaborators, ...eventData } = input;

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
        isGigOpportunity: eventData.isGigOpportunity,
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

    // Only venues can set gig opportunity flag
    if (input.data.isGigOpportunity && ctx.session.user.currentRole !== 'venue') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only venues can create gig opportunities',
      });
    }

    const { collaborators, ...updateData } = input.data;

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
      if (updateData.isGigOpportunity !== undefined)
        setValues.isGigOpportunity = updateData.isGigOpportunity;
      if (updateData.collectionId !== undefined) setValues.collectionId = updateData.collectionId;
      if (updateData.adTitle !== undefined) setValues.adTitle = updateData.adTitle;
      if (updateData.adDescription !== undefined)
        setValues.adDescription = updateData.adDescription;

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
