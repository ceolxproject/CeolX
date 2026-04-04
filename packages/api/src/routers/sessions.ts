import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { auth } from '@CeolX/auth';

import { protectedProcedure, router } from '../index';
import { parseUserAgent } from '../utils/parse-user-agent';

export const sessionsRouter = router({
  /**
   * List all active sessions for the authenticated user.
   * The current session is identified by matching the request token.
   * Sessions are sorted: current first, then newest-first.
   * The session token is never returned to the client.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const rawSessions = await auth.api.listSessions({ headers: ctx.headers });

    const currentToken = ctx.session.session.token;

    const sessions = rawSessions
      .map((s) => {
        const { deviceLabel, browser, os } = parseUserAgent(s.userAgent);
        return {
          id: s.id,
          isCurrent: s.token === currentToken,
          deviceLabel,
          browser,
          os,
          ipAddress: s.ipAddress ?? null,
          createdAt: s.createdAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
        };
      })
      .sort((a, b) => {
        // Current session always first
        if (a.isCurrent) return -1;
        if (b.isCurrent) return 1;
        // Then newest-first by createdAt
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    return { sessions };
  }),

  /**
   * Revoke a specific session by its database ID.
   * Cannot revoke the currently active session — use logout instead.
   */
  revoke: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rawSessions = await auth.api.listSessions({ headers: ctx.headers });

      const target = rawSessions.find((s) => s.id === input.sessionId);

      if (!target) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Session not found.',
        });
      }

      if (target.token === ctx.session.session.token) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot revoke your active session. Use logout instead.',
        });
      }

      await auth.api.revokeSession({
        headers: ctx.headers,
        body: { token: target.token },
      });

      return { success: true };
    }),

  /**
   * Revoke all sessions for the authenticated user except the current one.
   */
  revokeAll: protectedProcedure.mutation(async ({ ctx }) => {
    await auth.api.revokeOtherSessions({ headers: ctx.headers });
    return { success: true };
  }),
});
