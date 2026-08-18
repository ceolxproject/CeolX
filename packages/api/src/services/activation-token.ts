import { createHash, randomBytes } from 'node:crypto';

import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { activationTokens } from '@CeolX/db/schema/subscriptions';
import { env } from '@CeolX/env/server';

// One-time activation tokens (M8-T0 D-17, D-18, D-19, D-24, D-63).
//
// This token is the only credential on the activation path. The emailed link is
// the sole route to payment (D-16) and it must work for Google/Apple accounts
// that have no password at all (D-19), so possession of the link *is* the proof
// of identity. It is handled accordingly:
//
//   - 32 bytes from the CSPRNG, base64url. Node's crypto is stdlib; no wrapper
//     library earns a place on a path this short.
//   - Only the SHA-256 hash is persisted. A database dump or backup leak must not
//     hand anyone a working activation link.
//   - Lookup is BY hash, so no application-level secret comparison happens at all
//     and there is no timing side channel to protect against.
//   - Plain SHA-256 rather than a password KDF: the input is 256 bits of entropy
//     we generated, not a human-chosen secret, so there is nothing to brute-force
//     and key stretching would buy nothing.

/** Bytes of entropy per token. 32 → 43 base64url characters. */
const TOKEN_BYTES = 32;

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('base64url');
}

export interface IssuedActivationToken {
  /** The raw token. Goes into the emailed URL and is never persisted or logged. */
  token: string;
  expiresAt: Date;
  /**
   * Row id. Returned so the caller can revoke this exact token if the activation
   * email fails to send — see `revokeActivationToken`.
   */
  tokenId: string;
}

/**
 * Issue a fresh activation token for a user, invalidating any earlier one.
 *
 * D-18: issuing a new link kills every older link, so a venue with three emails
 * in their inbox can only ever use the newest. Prior unconsumed rows are deleted
 * rather than flagged — a superseded link should resolve to `invalid`, and
 * keeping dead credential hashes around serves no purpose.
 *
 * Already-consumed rows are deliberately left in place so a venue who pays and
 * then re-opens their link still gets the accurate `consumed` state instead of a
 * bare `invalid`.
 */
export async function issueActivationToken(userId: string): Promise<IssuedActivationToken> {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const expiresAt = new Date(Date.now() + env.ACTIVATION_TOKEN_TTL_MINUTES * 60_000);

  const tokenId = await db.transaction(async (tx) => {
    await tx
      .delete(activationTokens)
      .where(and(eq(activationTokens.userId, userId), isNull(activationTokens.consumedAt)));

    const [inserted] = await tx
      .insert(activationTokens)
      .values({ userId, tokenHash: hashToken(token), expiresAt })
      .returning({ id: activationTokens.id });

    // A single-row INSERT ... RETURNING that yields nothing means the driver or
    // the transaction is misbehaving. Fail loudly rather than handing the caller
    // an activation URL whose token has no row behind it — that would look to the
    // venue like a link that simply never works.
    if (!inserted) {
      throw new Error('activation token insert returned no row');
    }

    return inserted.id;
  });

  return { token, expiresAt, tokenId };
}

export type ActivationTokenResolution =
  | { status: 'valid'; tokenId: string; userId: string }
  | { status: 'expired' }
  | { status: 'consumed' }
  | { status: 'invalid' };

/**
 * Resolve a raw token to the account it activates.
 *
 * The four outcomes are distinct on purpose (D-24): a venue whose link expired
 * needs to be told so and offered a fresh one, which is impossible if expiry is
 * flattened into "invalid". `invalid` covers both a token that never existed and
 * one superseded by a newer issue — indistinguishable by design, since telling
 * an attacker which of the two they hit leaks whether a hash is present.
 */
export async function resolveActivationToken(
  rawToken: string,
  now: Date = new Date()
): Promise<ActivationTokenResolution> {
  const [row] = await db
    .select({
      id: activationTokens.id,
      userId: activationTokens.userId,
      expiresAt: activationTokens.expiresAt,
      consumedAt: activationTokens.consumedAt,
    })
    .from(activationTokens)
    .where(eq(activationTokens.tokenHash, hashToken(rawToken)))
    .limit(1);

  if (!row) return { status: 'invalid' };
  // Consumed is checked before expiry: a token that was used and has since aged
  // past its window is more usefully reported as consumed.
  if (row.consumedAt) return { status: 'consumed' };
  if (row.expiresAt <= now) return { status: 'expired' };

  return { status: 'valid', tokenId: row.id, userId: row.userId };
}

/**
 * Mark a token consumed. Called once payment has actually succeeded (D-17), not
 * when the link is opened — D-24 requires a venue who opens the page and closes
 * the tab to be able to come back to it.
 *
 * The token id travels to Stripe in the Checkout Session metadata so the webhook
 * can call this without holding the raw token. An id is passed rather than the
 * hash so no credential-derived material leaves our system at all.
 *
 * Idempotent: a redelivered webhook re-stamps an already-consumed row with the
 * same effect, so the `consumedAt` filter guards against overwriting the original
 * timestamp rather than against double-processing.
 */
export async function markActivationTokenConsumed(
  tokenId: string,
  now: Date = new Date()
): Promise<void> {
  await db
    .update(activationTokens)
    .set({ consumedAt: now })
    .where(and(eq(activationTokens.id, tokenId), isNull(activationTokens.consumedAt)));
}

/**
 * Delete a token outright.
 *
 * Used to unwind an issue whose activation email then failed to send. Without it
 * the venue would hold a token they never received, and the resend cooldown —
 * which is anchored on the newest token's age — would lock them out of retrying
 * for the length of the window. Deleting restores the state they were in.
 */
export async function revokeActivationToken(tokenId: string): Promise<void> {
  await db.delete(activationTokens).where(eq(activationTokens.id, tokenId));
}

/**
 * Age of the newest token for a user, in milliseconds, or null if they have none.
 *
 * Backs the resend cooldown. A DB timestamp rather than a Redis counter: the
 * repo's rate limiter is unconfigured locally and disabled entirely under
 * NODE_ENV=test, so a Redis-based limit could never be verified — whereas this
 * works identically in local, test and production, and is the same mechanism
 * bookings.resend already uses.
 */
export async function millisSinceNewestActivationToken(userId: string): Promise<number | null> {
  const [row] = await db
    .select({ createdAt: activationTokens.createdAt })
    .from(activationTokens)
    .where(eq(activationTokens.userId, userId))
    .orderBy(desc(activationTokens.createdAt))
    .limit(1);

  return row ? Date.now() - row.createdAt.getTime() : null;
}

/** Exposed for tests only — asserts a stored hash is not the raw token. */
export const __hashActivationTokenForTests = hashToken;
