import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

// Admin role guard — always throws until M9-T1 wires the BetterAuth admin plugin.
// TODO M9-T1: replace the FORBIDDEN throw with:
//   if (ctx.session.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
//   return next({ ctx: { ...ctx, session: ctx.session } });
export const adminProcedure = t.procedure.use(({ ctx }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Admin access not yet configured — complete M9-T1 first",
  });
});
