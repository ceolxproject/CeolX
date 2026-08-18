import { eq } from 'drizzle-orm';

import { buildActivationLinks } from '@CeolX/api/services/activation-links';
import { getPriceSummaries } from '@CeolX/api/services/stripe';
import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';
import { venueSubscriptions } from '@CeolX/db/schema/subscriptions';
import { venueProfiles } from '@CeolX/db/schema/users';
import { sendActivationReminderEmail, sendTrialEndingEmail } from '@CeolX/email';
import { env } from '@CeolX/env/server';
import { SubscriptionStatus } from '@CeolX/shared';

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

  // Read from Stripe, never from a local constant — see the sender's docblock.
  const prices = await getPriceSummaries();
  const summary = row.plan === 'annual' ? prices.annual : prices.monthly;

  await sendTrialEndingEmail({
    to: account.email,
    venueName: row.venueName,
    userName: account.name ?? '',
    amount: summary.formatted,
    chargeDate: new Intl.DateTimeFormat('en-IE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Dublin',
    }).format(row.trialEndsAt),
    interval: row.plan === 'annual' ? 'annual' : 'monthly',
    // The Portal link is minted on demand and emailed separately (D-45); pointing
    // at the app keeps this email free of a URL that could go stale in six months.
    manageUrl: `${env.BETTER_AUTH_URL.replace(/\/$/, '')}/r?to=/profile`,
  });
}
