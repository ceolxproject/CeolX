import { z } from "zod";

import { adminProcedure, router } from "../index";

export const adminRouter = router({
  // TODO M9-T2: return events with status = pending_review
  pendingEvents: adminProcedure.query(() => {
    return { events: [] };
  }),

  // TODO M9-T2: approve event → status = active, notify creator
  approveEvent: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(() => {
      return { message: "not implemented" };
    }),

  // TODO M9-T2: reject event → status = rejected, populate rejection_reason, notify creator
  rejectEvent: adminProcedure
    .input(z.object({ id: z.string(), reason: z.string().min(1) }))
    .mutation(() => {
      return { message: "not implemented" };
    }),
});
