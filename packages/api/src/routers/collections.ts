import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { collections } from '@CeolX/db/schema/events';
import { venueProfiles } from '@CeolX/db/schema/users';
import { EventStatus } from '@CeolX/shared/enums';
import { createCollectionSchema, updateCollectionSchema } from '@CeolX/shared/validators';

import { protectedProcedure, router, venueProcedure } from '../index';
import { isEventNotFinished } from '../lib/event-window';
import { onHoldVenueIds } from '../services/venue-gate';

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

// Non-throwing variant for read paths where the caller may not be a venue at all
// (spectators/artists). Returns null instead of erroring so callers can treat
// "not a venue" as simply "not the owner".
async function findVenueProfileId(userId: string): Promise<string | null> {
  const profile = await db.query.venueProfiles.findFirst({
    where: eq(venueProfiles.userId, userId),
    columns: { id: true },
  });
  return profile?.id ?? null;
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
        // Mirror what the owner sees in byId: exclude deleted (archived) events and
        // count only upcoming ones, so the list badge matches the collection screen.
        // "Upcoming" is has-not-finished (see lib/event-window) — while this read
        // date_start alone the badge said 0 for a collection holding a festival that
        // was mid-run, and opening it showed 1.
        eventCount: sql<number>`(
          SELECT count(*)::int FROM events
          WHERE events.collection_id = ${collections.id}
            AND events.status <> 'archived'
            AND (events.date_start >= now() OR (events.date_end IS NOT NULL AND events.date_end >= now()))
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

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const collection = await db.query.collections.findFirst({
        where: eq(collections.id, input.id),
        with: {
          events: {
            columns: {
              id: true,
              title: true,
              dateStart: true,
              // Read by isUpcomingEvent — a multi-day event stays in the collection
              // until it actually ends, not from the moment it starts.
              dateEnd: true,
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

      // byId is callable by any signed-in user (owner management screen + the public
      // discover/collection view). A creator-deleted event soft-archives to
      // status='archived' and must vanish from EVERY surface for EVERY persona — the
      // owner included (Asana 1216029058657584). So archived events are filtered out
      // for everyone. The owner additionally sees their other non-active events
      // (draft/removed) so they can manage/resubmit; everyone else gets ACTIVE-only.
      // Enforced here because the screen-side filter is presentation, not access
      // control — a direct tRPC call would otherwise leak unpublished events.
      const callerVenueProfileId = await findVenueProfileId(ctx.userId);
      const isOwner = !!callerVenueProfileId && callerVenueProfileId === collection.createdBy;

      // V-08: a collection follows the events inside it, so an on-hold venue's
      // collections are hidden from everyone except the owner — who still needs to
      // reach their own content to manage it and fix payment.
      //
      // NOT_FOUND rather than an on-hold state: unlike a venue profile or a saved
      // event, nobody arrives at a collection by a shared link they are waiting on,
      // so there is no expectation to explain away. `collections.list` needs no gate
      // at all — it is venueProcedure and therefore owner-only by construction.
      if (!isOwner) {
        const onHold = await onHoldVenueIds([collection.createdBy]);
        if (onHold.has(collection.createdBy)) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Collection not found' });
        }
      }
      const byStatus = isOwner
        ? collection.events.filter((e) => e.status !== EventStatus.ARCHIVED)
        : collection.events.filter((e) => e.status === EventStatus.ACTIVE);

      // Collections surface only UPCOMING events (Asana 1216029058776470). A "past"
      // event is still status='active' — it has simply slipped behind `now` — so the
      // status filter above does not catch it. Drop anything that isn't upcoming.
      const now = new Date();
      const visibleEvents = byStatus.filter((e) => isEventNotFinished(e, now));

      return {
        id: collection.id,
        name: collection.name,
        description: collection.description ?? null,
        logo: collection.logo ?? null,
        createdBy: collection.createdBy,
        createdAt: collection.createdAt.toISOString(),
        eventCount: visibleEvents.length,
        events: visibleEvents.map((e) => ({
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
