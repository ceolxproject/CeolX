import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { savedEvents } from '@CeolX/db/schema/events';

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

// Presigned S3 URL — stub until M10-T1 wires S3 integration
export const getPresignedUrl = protectedProcedure
  .input(z.object({ filename: z.string(), contentType: z.string() }))
  .query(() => {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Image upload not yet configured — complete M10-T1 first',
    });
  });
