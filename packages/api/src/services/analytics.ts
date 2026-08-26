import { env } from '@CeolX/env/server';

// Server-side PostHog capture (M8 §9).
//
// The subscription funnel is mostly invisible to the app. The venue pays in a
// browser — usually on another device (D-16) — and every transition after that
// arrives on a Stripe webhook hours or months later. So conversion, renewal,
// failure and recovery can only be measured from here; `apps/native/lib/analytics`
// covers our side of the funnel and deliberately stops at the browser hand-off.
//
// ponytail: a plain POST to the capture endpoint rather than `posthog-node`. The
// SDK's value is batching, retries and a flush lifecycle, all of which are wrong
// shapes for a Lambda that may freeze immediately after responding — an unflushed
// queue is a dropped event. One fetch per event is the honest version. Swap to the
// SDK only if event volume ever makes per-event requests measurable, which at
// launch scale (<1,000 users) it will not.

/**
 * Every server-emitted event name, in one place.
 *
 * Names are fixed by the M8 stories' §9 sections and are what the PostHog funnels
 * and insights are built on — renaming one silently breaks a saved insight rather
 * than erroring, so treat these as an external contract, not internal identifiers.
 */
export const ServerAnalyticsEvent = {
  // Activation funnel
  ACTIVATION_STARTED: 'activation_started',
  ACTIVATION_EMAIL_SENT: 'activation_email_sent',
  ACTIVATION_LINK_OPENED: 'activation_link_opened',
  CHECKOUT_SESSION_CREATED: 'checkout_session_created',
  SUBSCRIPTION_ACTIVATED: 'subscription_activated',
  ACTIVATION_FAILED: 'activation_failed',

  // Trial → paid
  TRIAL_REMINDER_SENT: 'trial_reminder_sent',
  TRIAL_CONVERTED: 'trial_converted',
  TRIAL_CONVERSION_FAILED: 'trial_conversion_failed',
  RENEWAL_SUCCEEDED: 'renewal_succeeded',
  RENEWAL_FAILED: 'renewal_failed',

  // Dunning
  SUBSCRIPTION_PAST_DUE: 'subscription_past_due',
  PAYMENT_RECOVERED: 'payment_recovered',
  VENUE_HIDDEN_NONPAYMENT: 'venue_hidden_nonpayment',

  // Customer Portal
  PORTAL_SESSION_REQUESTED: 'portal_session_requested',
  PLAN_UPGRADED: 'plan_upgraded',
  PLAN_DOWNGRADED: 'plan_downgraded',
  SUBSCRIPTION_CANCELLED_BY_USER: 'subscription_cancelled_by_user',

  // Content visibility
  VENUE_CONTENT_HIDDEN: 'venue_content_hidden',
  VENUE_CONTENT_RESTORED: 'venue_content_restored',
} as const;

export type ServerAnalyticsEventName =
  (typeof ServerAnalyticsEvent)[keyof typeof ServerAnalyticsEvent];

/** Ids, enums, amounts and dates only. Never an email, name or Stripe secret. */
type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

/**
 * Emit one event to PostHog.
 *
 * Fire-and-forget and never throws. Analytics failing must not fail a webhook —
 * a 500 from this path would make Stripe retry a subscription event that was
 * already applied, and an unreachable PostHog is not a reason to stop collecting
 * money.
 *
 * `distinctId` MUST be the BetterAuth user id. The app calls `identify(session.user.id)`
 * with the same value (`apps/native/contexts/auth-context.tsx`), so client and server
 * events land on one PostHog person and the funnel spans the browser hand-off. Passing
 * a venue-profile id here instead would split every venue into two people.
 */
export function captureServerEvent(
  event: ServerAnalyticsEventName,
  distinctId: string,
  properties: AnalyticsProperties = {}
): void {
  const { POSTHOG_KEY, POSTHOG_HOST } = env;
  // Unset key means analytics is off — the same contract the app uses. Keeps tests
  // and a bare local server working with no project configured.
  if (!POSTHOG_KEY) return;

  void fetch(`${POSTHOG_HOST.replace(/\/$/, '')}/i/v0/e/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: POSTHOG_KEY,
      event,
      distinct_id: distinctId,
      properties: {
        ...properties,
        // Staging and production share one PostHog project and one key, so without
        // this every staging webhook pollutes the launch numbers. Mirrors the
        // `$app_namespace` filter the mobile events are separated by.
        environment: env.NODE_ENV,
        // Marks the event as server-emitted so it is distinguishable from the
        // three client-side activation events, which measure a different thing.
        source: 'server',
      },
      timestamp: new Date().toISOString(),
    }),
  }).catch((err: unknown) => {
    console.warn(`[analytics] could not capture ${event}:`, err);
  });
}
