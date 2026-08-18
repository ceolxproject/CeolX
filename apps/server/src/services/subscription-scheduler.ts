import type { ScheduleActivationReminderFn } from '@CeolX/api/context';

import { publishJob } from '../jobs/publish.js';

/**
 * Queue one activation nudge (M8-T0 D-26).
 *
 * The real implementation behind `ctx.scheduleActivationReminder`. Lives here
 * because the QStash publisher is an apps/server concern — packages/api declares
 * the shape it needs and this supplies it.
 *
 * The payload carries the user id and nothing else: the handler mints a fresh
 * token at send time, so no live credential is ever handed to Upstash.
 */
export const scheduleActivationReminder: ScheduleActivationReminderFn = async (
  userId,
  attempt,
  delay
) => {
  await publishJob('subscription.activation-reminder', { userId, attempt }, { delay });
};

/**
 * Queue the trial-ending warning for a venue (D-30).
 *
 * `delaySeconds` is computed by the caller from the stored trial end date minus
 * seven days, because only the caller knows when the trial actually ends.
 */
export async function scheduleTrialEndingReminder(
  venueId: string,
  delaySeconds: number
): Promise<void> {
  await publishJob(
    'subscription.trial-ending',
    { venueId },
    { delay: `${Math.max(0, Math.floor(delaySeconds))}s` }
  );
}
