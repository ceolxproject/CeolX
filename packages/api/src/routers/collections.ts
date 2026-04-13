import { TRPCError } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { collections } from '@CeolX/db/schema/events';
import { venueProfiles } from '@CeolX/db/schema/users';

import { router, venueProcedure } from '../index';

export const collectionsRouter = router({
  /** List all collections owned by the current venue. */
  list: venueProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({ id: collections.id, name: collections.name })
      .from(collections)
      .innerJoin(venueProfiles, eq(venueProfiles.id, collections.createdBy))
      .where(eq(venueProfiles.userId, ctx.userId))
      .orderBy(desc(collections.createdAt));
    return rows;
  }),

  /** Create a new collection under the current venue. */
  create: venueProcedure
    .input(z.object({ name: z.string().min(1).max(255).trim() }))
    .mutation(async ({ input, ctx }) => {
      const venueProfile = await db.query.venueProfiles.findFirst({
        where: eq(venueProfiles.userId, ctx.userId),
        columns: { id: true },
      });
      if (!venueProfile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Venue profile not found' });
      }
      const rows = await db
        .insert(collections)
        .values({ name: input.name, createdBy: venueProfile.id })
        .returning({ id: collections.id, name: collections.name });
      const created = rows[0];
      if (!created)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Insert failed' });
      return created;
    }),
});
