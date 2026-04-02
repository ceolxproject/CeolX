import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@CeolX/db';
import { users } from '@CeolX/db/schema/users';

import { protectedProcedure, router } from '../index';

const completeRegistrationInput = z.object({
  currentRole: z.enum(['spectator', 'artist', 'venue']),
  marketingConsent: z.boolean(),
});

export const usersRouter = router({
  /**
   * Returns the app-level user row for the authenticated session user.
   * Returns null if the row hasn't been created yet (triggers client-side retry).
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db.select().from(users).where(eq(users.id, ctx.session.user.id)).limit(1);

    return user ?? null;
  }),

  /**
   * Creates the app-level user row after a successful BetterAuth sign-up.
   * Idempotent: silently no-ops if the row already exists (safe to retry).
   */
  completeRegistration: protectedProcedure
    .input(completeRegistrationInput)
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(users)
        .values({
          id: ctx.session.user.id,
          email: ctx.session.user.email,
          name: ctx.session.user.name ?? undefined,
          currentRole: input.currentRole,
          marketingConsent: input.marketingConsent,
          consentAt: new Date(),
        })
        .onConflictDoNothing();

      return { ok: true };
    }),
});
