import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';

import { protectedProcedure, router } from '../index';

const completeRegistrationInput = z.object({
  currentRole: z.enum(['spectator', 'artist', 'venue']),
  marketingConsent: z.boolean(),
});

export const usersRouter = router({
  /**
   * Returns the authenticated user row (includes domain fields set at registration).
   * Falls back to null if consentAt is not yet set (registration not complete).
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await db.select().from(user).where(eq(user.id, ctx.session.user.id)).limit(1);

    return row ?? null;
  }),

  /**
   * Sets domain fields on the BetterAuth user row after a successful sign-up.
   * Idempotent: safe to retry — always overwrites with the latest values.
   */
  completeRegistration: protectedProcedure
    .input(completeRegistrationInput)
    .mutation(async ({ ctx, input }) => {
      await db
        .update(user)
        .set({
          currentRole: input.currentRole,
          marketingConsent: input.marketingConsent,
          consentAt: new Date(),
        })
        .where(eq(user.id, ctx.session.user.id));

      return { ok: true };
    }),
});
