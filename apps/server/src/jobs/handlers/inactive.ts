import { and, eq, lt } from 'drizzle-orm';

import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';

import type { JobPayload } from '../types.js';

const INACTIVITY_YEARS = 2;

/**
 * GDPR R6 — flag accounts that haven't logged in for 24 months.
 *
 * Run daily as a QStash cron. Skips already-flagged and already-anonymised
 * rows so the predicate is small and idempotent. Flagging is a manual-review
 * trigger only; we do not automatically anonymise.
 */
export async function handleAccountFlagInactive(
  _payload: JobPayload<'account.flag-inactive'>
): Promise<void> {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - INACTIVITY_YEARS);

  await db
    .update(user)
    .set({ flaggedInactive: true })
    .where(
      and(
        lt(user.lastLoginAt, cutoff),
        eq(user.flaggedInactive, false),
        eq(user.isAnonymized, false)
      )
    );
}
