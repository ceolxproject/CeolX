import { z } from 'zod';

import { BILLING_INTERVALS } from '../enums.js';

/**
 * Venue subscription schemas (M8). Single source of truth for both the client
 * and the tRPC `.input()` — never redefine any of these inline in a router.
 */

/** Billing interval as it travels on the wire (D-04, D-08). */
export const billingIntervalSchema = z.enum(BILLING_INTERVALS);

/**
 * Activation token as it arrives on `GET /activate?token=…`.
 *
 * The charset is restricted to base64url because that is exactly what the
 * generator emits, and the value must be validated at the boundary *before* it
 * reaches a query or any rendered output. The length floor rejects a truncated
 * or obviously guessed value without leaking how long a real token is.
 *
 * This is defence in depth, not the primary control: lookups are by hash and
 * comparison is constant-time. It exists so a malformed value fails as a clean
 * 400 rather than travelling further into the system.
 */
export const activationTokenSchema = z
  .string()
  .min(32, 'Malformed activation token')
  .max(256, 'Malformed activation token')
  .regex(/^[A-Za-z0-9_-]+$/, 'Malformed activation token');

/**
 * The full `GET /activate` query. `plan` is required: the venue chooses their
 * interval by which button they press in the activation email (D-08), and the
 * token itself carries no plan (D-63), so a link without one cannot be resolved
 * to a Price.
 */
export const activateQuerySchema = z.object({
  token: activationTokenSchema,
  plan: billingIntervalSchema,
});

/**
 * Input to the Checkout Session mutation. Only the interval crosses the
 * boundary — the venue is resolved from the authenticated session, never
 * supplied by the caller, so one venue can never open a checkout for another.
 */
export const createCheckoutSessionSchema = z.object({
  plan: billingIntervalSchema,
});

export type ActivateQuery = z.infer<typeof activateQuerySchema>;
export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;
