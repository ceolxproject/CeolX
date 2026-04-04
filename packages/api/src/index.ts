import { initTRPC, TRPCError } from '@trpc/server';

import type { UserRole } from '@CeolX/shared';

import type { Context } from './context';

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

// ─── Auth: session required ───────────────────────────────────────────────────

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      userId: ctx.session.user.id,
      currentRole: (ctx.session.user.currentRole ?? 'spectator') as UserRole,
    },
  });
});

// ─── Role enforcement (private factory) ──────────────────────────────────────

const requireRole = (...roles: UserRole[]) =>
  t.middleware(async ({ ctx, next }) => {
    const currentRole = (ctx as { currentRole: UserRole }).currentRole;

    if (currentRole === 'admin') return next();

    if (!roles.includes(currentRole)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `This action requires one of the following roles: ${roles.join(', ')}`,
      });
    }

    return next();
  });

// ─── Role-specific procedures ─────────────────────────────────────────────────

/** Any authenticated user with the artist persona. Admin bypasses. */
export const artistProcedure = protectedProcedure.use(requireRole('artist'));

/** Any authenticated user with the venue persona. Admin bypasses. */
export const venueProcedure = protectedProcedure.use(requireRole('venue'));

/** Artists or venues (event creators). Admin bypasses. */
export const creatorProcedure = protectedProcedure.use(requireRole('artist', 'venue'));

/** CeolX super-admin only. */
export const adminProcedure = protectedProcedure.use(requireRole('admin'));
