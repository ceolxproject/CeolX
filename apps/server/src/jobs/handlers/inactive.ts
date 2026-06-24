import { and, eq, inArray, lt } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { sendNotificationEmail } from '@CeolX/email';
import { buildInactivityWarningEmail } from '@CeolX/shared';

import type { JobPayload } from '../types.js';

const INACTIVITY_YEARS = 2;

/**
 * GDPR R6 — flag accounts idle for 24 months and send a one-time re-engagement
 * warning (matrix S-08). Run daily as a QStash cron.
 *
 * Flow: select due rows → flag them → email each. Order is flag-then-send, so a
 * mail failure is never retried (at-most-once warning) and the same user is not
 * re-warned on the next run. Each send is non-blocking; one failure does not
 * abort the sweep. Flagging is a manual-review trigger only — we never
 * auto-anonymise here.
 */
export async function handleAccountFlagInactive(
  _payload: JobPayload<'account.flag-inactive'>
): Promise<void> {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - INACTIVITY_YEARS);

  const due = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(
      and(
        lt(user.lastLoginAt, cutoff),
        eq(user.flaggedInactive, false),
        eq(user.isAnonymized, false)
      )
    );

  if (due.length === 0) return;

  await db
    .update(user)
    .set({ flaggedInactive: true })
    .where(
      inArray(
        user.id,
        due.map((u) => u.id)
      )
    );

  const copy = buildInactivityWarningEmail();
  for (const u of due) {
    if (!u.email) continue;
    try {
      await sendNotificationEmail({
        to: u.email,
        userName: u.name ?? '',
        subject: copy.subject,
        body: copy.body,
        ctaUrl: copy.ctaUrl,
      });
    } catch (err) {
      console.error('[inactive] inactivity-warning email failed', u.id, err);
    }
  }
}
