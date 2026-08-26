import { and, eq, gt, isNull, lt, lte, or } from 'drizzle-orm';

import { buildActivationLinks } from '@CeolX/api/services/activation-links';
import { ServerAnalyticsEvent, captureServerEvent } from '@CeolX/api/services/analytics';
import { getNextInvoicePreview, getPriceSummaries } from '@CeolX/api/services/stripe';
import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { venueSubscriptions } from '@CeolX/db/schema/subscriptions';
import { venueProfiles } from '@CeolX/db/schema/users';
import { sendActivationReminderEmail, sendTrialEndingEmail } from '@CeolX/email';
import { env } from '@CeolX/env/server';
import {
  NotificationTrigger,
  SubscriptionStatus,
  VENUE_BILLING_RETURN_ROUTE,
  buildAppRedirectUrl,
} from '@CeolX/shared';

import { dispatchNotification } from '../../services/notifications-dispatcher.js';
import type { JobPayload } from '../types.js';

/**
 * Activation reminder for a venue who signed up but never subscribed
 * (M8-T0 D-26 — one at 24 h, 3 days and 7 days).
 *
 * Every send re-checks state first and no-ops if the venue has moved on. That
 * matters more than it looks: three jobs are queued at once when the first
 * activation email goes out, so without this check a venue who activates an hour
 * later would still receive all three nudges telling them to do something they
 * have already done.
 */
export async function handleSubscriptionActivationReminder(
  payload: JobPayload<'subscription.activation-reminder'>
): Promise<void> {
  const { userId, attempt } = payload;

  const [profile] = await db
    .select({
      id: venueProfiles.id,
      venueName: venueProfiles.venueName,
      subscriptionStatus: venueProfiles.subscriptionStatus,
    })
    .from(venueProfiles)
    .where(eq(venueProfiles.userId, userId))
    .limit(1);

  // Profile deleted, or the account is no longer a venue.
  if (!profile) return;

  // Anything other than `inactive` means they either subscribed or cancelled
  // deliberately — neither wants a nudge.
  if (profile.subscriptionStatus !== SubscriptionStatus.INACTIVE) {
    console.warn(
      `[subscription] activation reminder ${attempt} skipped for ${userId} — status is ${profile.subscriptionStatus}`
    );
    return;
  }

  const [subscription] = await db
    .select({ billingBlocked: venueSubscriptions.billingBlocked })
    .from(venueSubscriptions)
    .where(eq(venueSubscriptions.venueId, profile.id))
    .limit(1);

  // Never invite a disputed account back in (D-51).
  if (subscription?.billingBlocked) return;

  const [account] = await db
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!account?.email) return;

  // Claim this nudge before sending it.
  //
  // QStash is at-least-once, and the status check above does not cover a redelivery:
  // the venue is still `inactive`, which is exactly who this email is for, so a second
  // delivery of the same job used to send the same nudge twice. The AC is explicit —
  // "none duplicated on a job re-run".
  //
  // `lt(attempt)` rather than equality, so a stale redelivery of nudge 1 arriving after
  // nudge 2 has gone out is also dropped rather than re-sending an older message.
  //
  // Conditional UPDATE, so two concurrent deliveries cannot both pass the same read.
  // Stamped BEFORE the send, which trades one direction of failure for the other: a
  // Postmark blip now loses that nudge instead of risking a duplicate. That is the
  // direction the AC asks for, and there are two more nudges behind it.
  const [claimed] = await db
    .update(venueProfiles)
    .set({ activationReminderLastAttempt: attempt })
    .where(
      and(
        eq(venueProfiles.id, profile.id),
        or(
          isNull(venueProfiles.activationReminderLastAttempt),
          lt(venueProfiles.activationReminderLastAttempt, attempt)
        )
      )
    )
    .returning({ id: venueProfiles.id });

  if (!claimed) {
    console.warn(
      `[subscription] activation reminder ${attempt} skipped for ${userId} — already sent`
    );
    return;
  }

  // Fresh token per reminder: by the second nudge the original is days expired.
  const links = await buildActivationLinks(userId);

  // Best effort, as in venues.requestActivation — a Stripe outage should degrade
  // the button labels rather than suppress the reminder entirely.
  let prices: Awaited<ReturnType<typeof getPriceSummaries>> | null = null;
  try {
    prices = await getPriceSummaries();
  } catch (err) {
    console.warn('[subscription] reminder: could not read Stripe prices:', err);
  }

  await sendActivationReminderEmail({
    to: account.email,
    venueName: profile.venueName,
    userName: account.name ?? '',
    monthlyUrl: links.monthlyUrl,
    annualUrl: links.annualUrl,
    monthlyPrice: prices?.monthly.formatted,
    annualPrice: prices?.annual.formatted,
    expiresInMinutes: env.ACTIVATION_TOKEN_TTL_MINUTES,
  });
}

/**
 * Trial-ending warning, 7 days before the first charge (D-30).
 *
 * Everything is re-read at send time. The job was queued up to six months earlier,
 * so the amount, the date and even whether the venue still wants the subscription
 * may all have changed since — and this is the email where a wrong figure turns
 * into a chargeback.
 */
export async function handleSubscriptionTrialEnding(
  payload: JobPayload<'subscription.trial-ending'>
): Promise<void> {
  const [row] = await db
    .select({
      venueName: venueProfiles.venueName,
      userId: venueProfiles.userId,
      subscriptionStatus: venueProfiles.subscriptionStatus,
      trialEndsAt: venueSubscriptions.trialEndsAt,
      cancelAtPeriodEnd: venueSubscriptions.cancelAtPeriodEnd,
      plan: venueSubscriptions.plan,
      // Needed to preview the real next invoice rather than pricing `plan`.
      stripeSubscriptionId: venueSubscriptions.stripeSubscriptionId,
    })
    .from(venueSubscriptions)
    .innerJoin(venueProfiles, eq(venueProfiles.id, venueSubscriptions.venueId))
    .where(eq(venueSubscriptions.venueId, payload.venueId))
    .limit(1);

  if (!row) return;

  // Only a venue still ON trial gets this. If they already converted, cancelled,
  // or the trial was removed, the email would be actively wrong.
  if (row.subscriptionStatus !== SubscriptionStatus.TRIALING) {
    console.warn(
      `[subscription] trial-ending skipped for venue ${payload.venueId} — status is ${row.subscriptionStatus}`
    );
    return;
  }

  // Cancelled during the trial: they keep access to the end date (D-29) but are
  // never charged, so warning them about a charge would be false.
  if (row.cancelAtPeriodEnd) return;

  if (!row.trialEndsAt) return;

  // The date moved (extended in the Dashboard, say) and this job is no longer 7
  // days out. The scheduler re-arms on the new date; sending now would misstate it.
  const daysUntilCharge = Math.round(
    (row.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  );
  if (daysUntilCharge < 0) return;

  const [account] = await db
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, row.userId))
    .limit(1);

  if (!account?.email) return;

  // Ask Stripe what the next invoice actually is, rather than pricing our stored plan.
  //
  // `plan` stopped being a safe basis the moment plan switching was enabled (D-70): a
  // deferred downgrade leaves the subscription on annual while the next charge is monthly,
  // so pricing `plan` promised €199 and took €19.99 — a wrong figure in the one email
  // whose whole purpose is preventing a chargeback. A preview accounts for the schedule.
  //
  // Falls back to the catalogue when the preview is unavailable: wrong only in the rare
  // scheduled case, and far better than sending no warning at all.
  const preview = row.stripeSubscriptionId
    ? await getNextInvoicePreview(row.stripeSubscriptionId)
    : null;
  const prices = await getPriceSummaries();
  const fallback = row.plan === 'annual' ? prices.annual : prices.monthly;
  const amount = preview?.formatted ?? fallback.formatted;
  const interval = preview?.interval ?? row.plan;

  const chargeDate = new Intl.DateTimeFormat('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Dublin',
  }).format(row.trialEndsAt);

  await sendTrialEndingEmail({
    to: account.email,
    venueName: row.venueName,
    userName: account.name ?? '',
    amount,
    chargeDate,
    interval: interval === 'annual' ? 'annual' : 'monthly',
    // The Portal link is minted on demand and emailed separately (D-45); pointing
    // at the app keeps this email free of a URL that could go stale in six months.
    manageUrl: buildAppRedirectUrl(env.BETTER_AUTH_URL, VENUE_BILLING_RETURN_ROUTE),
  });

  // Push alongside the email, carrying the same amount and date (M8 trial story §9).
  //
  // Both surfaces, not one: six months is long enough that the venue has forgotten
  // signing up, and an unannounced debit is how chargebacks start (D-30). The email
  // is the record; the push is the one they will actually see.
  //
  // Deliberately after the email and non-fatal. The email is the deliverable — a push
  // failure must not lose it, and must not stop the sweep stamping its sent marker,
  // which would re-send the email tomorrow.
  await dispatchNotification({
    trigger: NotificationTrigger.TRIAL_ENDING_TO_VENUE,
    recipientUserId: row.userId,
    vars: { amount, chargeDate },
  }).catch((err: unknown) => {
    console.error('[subscription] trial-ending push failed:', err);
  });

  captureServerEvent(ServerAnalyticsEvent.TRIAL_REMINDER_SENT, row.userId, {
    venue_id: payload.venueId,
    plan: interval,
    days_ahead: daysUntilCharge,
  });
}

/** How far ahead of the first charge the warning goes out (D-30). */
const TRIAL_WARNING_LEAD_DAYS = 7;

/**
 * Daily sweep that sends the trial-ending warning (D-30).
 *
 * This replaces a QStash job delayed until 7 days before the charge. For the default
 * 183-day trial that delay is ~176 days, and `handleAccountAnonymizeSweep` records
 * that a *30-day* delay already exceeded the plan cap and failed silently
 * (Asana 1215276188230541). The failure mode there was a missed deletion; here it
 * would be a €199 charge with no warning, which is the chargeback D-30 exists to
 * prevent — so the same cron-sweep remedy applies.
 *
 * Idempotent by `trialEndingSentAt`. A venue whose trial date moves gets the marker
 * cleared in `subscription-sync`, so they are warned again against the new date.
 */
export async function handleSubscriptionTrialEndingSweep(
  _payload: JobPayload<'subscription.trial-ending-sweep'>
): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + TRIAL_WARNING_LEAD_DAYS * 24 * 60 * 60 * 1000);

  const due = await db
    .select({ venueId: venueSubscriptions.venueId })
    .from(venueSubscriptions)
    .innerJoin(venueProfiles, eq(venueProfiles.id, venueSubscriptions.venueId))
    .where(
      and(
        eq(venueProfiles.subscriptionStatus, SubscriptionStatus.TRIALING),
        isNull(venueSubscriptions.trialEndingSentAt),
        // Inside the warning window but not already past — a lapsed date means the
        // charge has happened and the warning would only confuse.
        lte(venueSubscriptions.trialEndsAt, cutoff),
        gt(venueSubscriptions.trialEndsAt, now),
        eq(venueSubscriptions.cancelAtPeriodEnd, false),
        eq(venueSubscriptions.billingBlocked, false)
      )
    );

  if (due.length === 0) return;

  for (const { venueId } of due) {
    try {
      // Delegates to the single-venue handler, which re-reads state and re-reads the
      // price from Stripe before sending. Nothing about the amount is trusted here.
      await handleSubscriptionTrialEnding({ venueId });

      await db
        .update(venueSubscriptions)
        .set({ trialEndingSentAt: new Date(), updatedAt: new Date() })
        .where(eq(venueSubscriptions.venueId, venueId));
    } catch (err) {
      // One venue's failure must not strand the rest of the batch. The marker is only
      // stamped on success, so tomorrow's run retries this venue.
      console.error(`[subscription] trial-ending sweep failed for venue ${venueId}:`, err);
    }
  }
}
