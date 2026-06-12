import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';

/**
 * Wired into `hooks.before` in the Better Auth config, scoped to
 * `POST /sign-up/email`.
 *
 * Why this exists: with `requireEmailVerification` enabled, Better Auth
 * deliberately returns a *success* response when you sign up with an
 * already-registered email — it suppresses the "user already exists" error to
 * prevent account enumeration. For CeolX that produced a real bug: a user who
 * registered (e.g. as Artist) and then tried to sign up again under a different
 * role saw "verification email sent" and a dead-end verify screen instead of
 * being told the email is taken (Asana 1215616181509943).
 *
 * We intentionally trade a sliver of enumeration protection for a clear,
 * client-mandated UX: pre-check the email and throw an explicit error *before*
 * Better Auth reaches its silent-success branch. Any existing row counts —
 * verified or not, regardless of role — so a half-finished signup is treated as
 * taken (recovery happens via sign-in / resend, not re-registration).
 *
 * Throwing `APIError` (not a plain `Error`) is what makes the message reach the
 * client verbatim as `error.message`; `sign-up.tsx` keys off it to surface the
 * error next to the email field.
 */
export async function assertEmailAvailable(rawEmail: unknown): Promise<void> {
  // Malformed/empty bodies are not our concern — let Better Auth's own input
  // validation produce its standard error rather than masking it here.
  if (typeof rawEmail !== 'string') return;
  const email = rawEmail.trim().toLowerCase();
  if (!email) return;

  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existing) {
    throw new APIError('UNPROCESSABLE_ENTITY', {
      message:
        'An account with this email address already exists. Please sign in using your existing account.',
    });
  }
}
