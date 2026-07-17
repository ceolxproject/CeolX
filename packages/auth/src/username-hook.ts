import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';

/**
 * Enforces the one-time-permanent handle invariant server-side.
 *
 * The app never offers a way to change a handle (ShareProfileButton only ever
 * *sets* one; there is no edit UI), but `/update-user` would otherwise let a
 * user reassign their own `username` freely. That frees the old handle for a
 * stale-link hijack — someone else claims it and every previously-shared
 * `ceolx.com/u/<old>` link now resolves to them. So we lock it:
 *
 * - setting a handle while none is set (null → value) is allowed;
 * - re-sending the SAME value is a no-op (a half-finished onboarding can retry);
 * - changing to a DIFFERENT value is rejected.
 *
 * Note: the better-auth username plugin copies `displayUsername` → `username`
 * when only `displayUsername` is sent, so we check whichever the request carries
 * (normalized the same way the plugin normalizes: trim + lowercase).
 */
export async function assertUsernameImmutable(
  userId: string | undefined,
  rawNewHandle: unknown
): Promise<void> {
  if (!userId || typeof rawNewHandle !== 'string') return;
  const next = rawNewHandle.trim().toLowerCase();

  const [row] = await db
    .select({ username: user.username })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (row?.username && row.username !== next) {
    throw new APIError('BAD_REQUEST', {
      message: 'Your username is permanent and cannot be changed.',
    });
  }
}
