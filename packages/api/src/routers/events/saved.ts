import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { collections, events, savedEvents } from '@CeolX/db/schema/events';
import { EventStatus } from '@CeolX/shared';
import { savedEventsQuerySchema } from '@CeolX/shared/validators';

import { protectedProcedure } from '../../index';

export const save = protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    await db
      .insert(savedEvents)
      .values({ userId: ctx.userId, eventId: input.id })
      .onConflictDoNothing({ target: [savedEvents.userId, savedEvents.eventId] });
    return { saved: true };
  });

export const unsave = protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    await db
      .delete(savedEvents)
      .where(and(eq(savedEvents.userId, ctx.userId), eq(savedEvents.eventId, input.id)));
    return { saved: false };
  });

// ─── Saved Events List ───────────────────────────────────────────────────────

/**
 * Which event statuses a saved-events view may surface. The default list shows
 * only live events; the "past / archived" view (`includeArchived`) additionally
 * shows the creator-archived ones. Admin-removed events — and the pre-publication
 * draft / pending_review / rejected states — are never returned in either view,
 * so a taken-down event drops out of a user's saved list. The `includeArchived`
 * branch previously applied no status filter at all, leaking removed events into
 * the saved list. Asana 1216029035679712.
 */
export function savedVisibleStatuses(includeArchived: boolean): EventStatus[] {
  return includeArchived ? [EventStatus.ACTIVE, EventStatus.ARCHIVED] : [EventStatus.ACTIVE];
}

export const getSavedEvents = protectedProcedure
  .input(savedEventsQuerySchema)
  .query(async ({ input, ctx }) => {
    const { limit, offset, includeArchived } = input;

    const conditions = [
      eq(savedEvents.userId, ctx.userId),
      inArray(events.status, savedVisibleStatuses(includeArchived)),
    ];

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
          venueAddress: events.venueAddress,
          savedAt: savedEvents.createdAt,
          creatorId: events.createdBy,
          creatorName: user.name,
          collectionName: collections.name,
        })
        .from(savedEvents)
        .innerJoin(events, eq(savedEvents.eventId, events.id))
        .leftJoin(user, eq(events.createdBy, user.id))
        .leftJoin(collections, eq(events.collectionId, collections.id))
        .where(and(...conditions))
        .orderBy(desc(savedEvents.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(savedEvents)
        .innerJoin(events, eq(savedEvents.eventId, events.id))
        .where(and(...conditions)),
    ]);

    const totalCount = countResult[0]?.count ?? 0;

    return {
      events: rows.map((r) => ({
        id: r.id,
        title: r.title,
        coverImage: r.coverImage ?? null,
        dateStart: r.dateStart.toISOString(),
        dateEnd: r.dateEnd?.toISOString() ?? null,
        category: r.category,
        status: r.status,
        venueAddress: r.venueAddress ?? null,
        savedAt: r.savedAt.toISOString(),
        creatorName: r.creatorName ?? 'Unknown',
        collectionName: r.collectionName ?? null,
      })),
      totalCount,
      hasNextPage: offset + limit < totalCount,
    };
  });

// Presigned S3 URL — stub until M10-T1 wires S3 integration
export const getPresignedUrl = protectedProcedure
  .input(z.object({ filename: z.string(), contentType: z.string() }))
  .query(() => {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Image upload not yet configured — complete M10-T1 first',
    });
  });
