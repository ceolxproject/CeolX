import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { collections } from '@CeolX/db/schema/events';
import { venueProfiles } from '@CeolX/db/schema/users';
import { createCollectionSchema, updateCollectionSchema } from '@CeolX/shared/validators';

import { protectedProcedure, router, venueProcedure } from '../index';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getVenueProfileId(userId: string): Promise<string> {
  const profile = await db.query.venueProfiles.findFirst({
    where: eq(venueProfiles.userId, userId),
    columns: { id: true },
  });
  if (!profile) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Venue profile not found' });
  }
  return profile.id;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const collectionsRouter = router({
  create: venueProcedure.input(createCollectionSchema).mutation(async ({ input, ctx }) => {
    const venueProfileId = await getVenueProfileId(ctx.userId);

    const [collection] = await db
      .insert(collections)
      .values({
        name: input.name,
        description: input.description ?? null,
        logo: input.logo ?? null,
        createdBy: venueProfileId,
      })
      .returning();

    return collection;
  }),

  list: venueProcedure.query(async ({ ctx }) => {
    const venueProfileId = await getVenueProfileId(ctx.userId);

    const rows = await db
      .select({
        id: collections.id,
        name: collections.name,
        description: collections.description,
        logo: collections.logo,
        createdAt: collections.createdAt,
        eventCount: sql<number>`(
          SELECT count(*)::int FROM events WHERE events.collection_id = ${collections.id}
        )`,
      })
      .from(collections)
      .where(eq(collections.createdBy, venueProfileId))
      .orderBy(collections.createdAt);

    return rows.map((r) => ({
      ...r,
      description: r.description ?? null,
      logo: r.logo ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }),

  byId: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ input }) => {
    const collection = await db.query.collections.findFirst({
      where: eq(collections.id, input.id),
      with: {
        events: {
          columns: {
            id: true,
            title: true,
            dateStart: true,
            coverImage: true,
            status: true,
            category: true,
            venueAddress: true,
          },
        },
      },
    });

    if (!collection) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Collection not found' });
    }

    return {
      id: collection.id,
      name: collection.name,
      description: collection.description ?? null,
      logo: collection.logo ?? null,
      createdBy: collection.createdBy,
      createdAt: collection.createdAt.toISOString(),
      eventCount: collection.events.length,
      events: collection.events.map((e) => ({
        id: e.id,
        title: e.title,
        dateStart: e.dateStart.toISOString(),
        coverImage: e.coverImage ?? null,
        status: e.status,
        category: e.category,
        venueAddress: e.venueAddress ?? null,
      })),
    };
  }),

  update: venueProcedure.input(updateCollectionSchema).mutation(async ({ input, ctx }) => {
    const venueProfileId = await getVenueProfileId(ctx.userId);

    const collection = await db.query.collections.findFirst({
      where: eq(collections.id, input.id),
    });

    if (!collection) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Collection not found' });
    }

    if (collection.createdBy !== venueProfileId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only edit your own collections' });
    }

    const [updated] = await db
      .update(collections)
      .set({ ...input.data, updatedAt: new Date() })
      .where(eq(collections.id, input.id))
      .returning();

    return updated;
  }),

  delete: venueProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const venueProfileId = await getVenueProfileId(ctx.userId);

      const collection = await db.query.collections.findFirst({
        where: eq(collections.id, input.id),
      });

      if (!collection) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Collection not found' });
      }

      if (collection.createdBy !== venueProfileId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete your own collections',
        });
      }

      // Events auto-nullify collectionId via onDelete: 'set null' in schema
      await db.delete(collections).where(eq(collections.id, input.id));

      return { deleted: true };
    }),
});
