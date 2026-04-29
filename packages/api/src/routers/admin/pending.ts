import { z } from 'zod';

import { adminProcedure } from '../../index';

// M9-T2 — content moderation. These stubs are preserved here so the dashboard
// can reference them and the next task wires the real implementations.

export const pendingEvents = adminProcedure.query(() => {
  return { events: [] };
});

export const approveEvent = adminProcedure.input(z.object({ id: z.string() })).mutation(() => {
  return { message: 'not implemented' };
});

export const rejectEvent = adminProcedure
  .input(z.object({ id: z.string(), reason: z.string().min(1) }))
  .mutation(() => {
    return { message: 'not implemented' };
  });
