import { TRPCError } from '@trpc/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { events, savedEvents } from '@CeolX/db/schema/events';
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

export const getSavedEvents = protectedProcedure
  .input(savedEventsQuerySchema)
  .query(async ({ input, ctx }) => {
    const { limit, offset, includeArchived } = input;

    const conditions = [eq(savedEvents.userId, ctx.userId)];
    if (!includeArchived) {
      conditions.push(eq(events.status, EventStatus.ACTIVE));
    }

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
        })
        .from(savedEvents)
        .innerJoin(events, eq(savedEvents.eventId, events.id))
        .leftJoin(user, eq(events.createdBy, user.id))
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
