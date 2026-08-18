import { env } from '@CeolX/env/server';
import { BillingInterval, type BillingInterval as Interval } from '@CeolX/shared';

import { issueActivationToken } from './activation-token';

export interface ActivationLinks {
  /** Checkout link for the monthly interval. */
  monthlyUrl: string;
  /** Checkout link for the annual interval. */
  annualUrl: string;
  expiresAt: Date;
  /** Row id, so a caller can revoke the token if the email fails to send. */
  tokenId: string;
}

/**
 * Issue a token and build the pair of activation links for a user.
 *
 * Shared by `venues.requestActivation` and the activation-reminder job so the URL
 * shape lives in exactly one place. That matters because these URLs are the only
 * route into billing (M8-T0 D-16) and are constructed nowhere else — a second copy
 * would be a second thing to get wrong, and a wrong one is unrecoverable from the
 * venue's side.
 *
 * Two links, one token (D-63): the venue chooses their interval by which button
 * they press (D-08), so the token carries no plan and stays valid for either.
 *
 * Served from our own API origin, not a marketing page (D-60).
 */
export async function buildActivationLinks(userId: string): Promise<ActivationLinks> {
  const { token, expiresAt, tokenId } = await issueActivationToken(userId);

  const origin = env.BETTER_AUTH_URL.replace(/\/$/, '');
  const linkFor = (plan: Interval) =>
    `${origin}/activate?token=${encodeURIComponent(token)}&plan=${plan}`;

  return {
    monthlyUrl: linkFor(BillingInterval.MONTHLY),
    annualUrl: linkFor(BillingInterval.ANNUAL),
    expiresAt,
    tokenId,
  };
}
