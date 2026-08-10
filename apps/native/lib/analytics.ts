import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';

import { env } from '@CeolX/env/native';

/**
 * PostHog client + the complete set of events CeolX emits.
 *
 * Created as a module singleton rather than consumed through `usePostHog()` so
 * non-component call sites (mutation callbacks, plain helpers) can emit without
 * hook plumbing. The same instance is handed to PostHogProvider in _layout so
 * autocapture and replay share it.
 *
 * Null — and every call below a no-op — when the key is unset or in dev. That is
 * what lets Expo Go and fresh clones boot with no PostHog config at all.
 */
// Off in dev so local work never pollutes the project — unless explicitly opted
// in via .env.development.local, which is the only way to verify a newly-wired
// event without cutting a release build.
const devCapture = env.EXPO_PUBLIC_POSTHOG_DEV_CAPTURE === 'true';
const enabled = (!__DEV__ || devCapture) && !!env.EXPO_PUBLIC_POSTHOG_KEY;

// A missing key must never break the app — but it must not be silent either, or
// the first sign of trouble is an empty dashboard weeks later. Loud in dev
// (console.error surfaces as a LogBox red box), no-op in production. Deliberately
// not a throw: this module is imported from the root layout, so throwing would
// stop the app booting without PostHog configured, which is worse than no events.
if (__DEV__ && !env.EXPO_PUBLIC_POSTHOG_KEY) {
  console.error(
    'EXPO_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once EXPO_PUBLIC_POSTHOG_KEY is configured'
  );
}

function createClient(): PostHog | null {
  if (!enabled) return null;
  try {
    return buildClient();
  } catch (err) {
    // This runs at import time from the root layout, i.e. before Sentry.init and
    // outside any ErrorBoundary — a throw here is a white screen at launch, not a
    // fallback screen, and it cannot be reported. The SDK can throw for reasons
    // that have nothing to do with us (no storage backend available if a native
    // dep failed to link), so it is caught and dropped: analytics is never worth
    // the app not booting. Visible in dev only; a production construction failure
    // is silent, which is the accepted trade for guaranteed boot.
    if (__DEV__) console.error('PostHog client construction failed', err);
    return null;
  }
}

function buildClient(): PostHog {
  const client = new PostHog(env.EXPO_PUBLIC_POSTHOG_KEY as string, {
    host: env.EXPO_PUBLIC_POSTHOG_HOST,
    // Send immediately in dev instead of batching at 20 events, so a single
    // tapped flow shows up in PostHog straight away rather than sitting in the
    // queue. Production keeps the default batching to save battery.
    ...(devCapture ? { flushAt: 1 } : {}),
    // Replay is gated separately from the key: masking is applied on-device
    // before upload and cannot be corrected afterwards, so anything captured
    // wrong is stored wrong permanently. Off until verified on a non-prod project.
    //
    // Turning this on ALSO requires installing @posthog/react-native-plugin
    // (native iOS/Android code — needs a rebuild and a fresh dev client) and
    // enabling "Record user sessions" in PostHog Project Settings. With the flag
    // off, this option is inert and the app stays pure JS.
    enableSessionReplay: env.EXPO_PUBLIC_POSTHOG_REPLAY === 'true',
    sessionReplayConfig: {
      // Record the screen as-is — decision 28/07/2026. Unmasked replay is the
      // point of the integration here: masked images make a visual app
      // (event covers, artist photos, the map) useless to review.
      // Passwords are the one exception and are masked at the input itself
      // via PostHogMaskView in AppTextField — AppTextField has an eye toggle
      // that renders the password as plaintext, which screenshot-mode replay
      // would otherwise capture.
      maskAllTextInputs: false,
      maskAllImages: false,
      maskAllSandboxedViews: false,
    },
  });

  // Verbose SDK logging when capturing from a dev client — without it there is no
  // way to tell "event sent" from "event silently dropped" locally. Never on in
  // production, where it would be noise on every capture.
  //
  // NOT a constructor option: `debug` is a PostHogProvider prop, so passing it in
  // the options object was accepted by the spread-widened literal and then ignored
  // — dev logging never actually turned on. `debug()` is the real switch.
  if (devCapture) client.debug(true);

  return client;
}

export const posthog = createClient();

/**
 * Analytics must never abort the caller. Every `track` site sits immediately
 * before the navigation, toast or state update it accompanies, so an SDK throw
 * would strand the user mid-flow — a failed capture on signup would leave the
 * account created but the user on a dead screen. `?.` only guards a null client,
 * not a throwing one, so the call itself is wrapped and reported instead.
 */
function safely(op: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    Sentry.captureException(err, { tags: { feature: 'analytics', op } });
  }
}

// ── Events ───────────────────────────────────────────────────────────
// The whole set. Nothing outside this object is emitted; referencing names from
// here rather than inline strings is what stops a typo becoming a silent
// second event in PostHog that nobody notices for a month.

export const AnalyticsEvent = {
  // Signup funnel
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_SUBMITTED: 'signup_submitted',
  EMAIL_VERIFICATION_OPENED: 'email_verification_opened',
  SIGNUP_COMPLETED: 'signup_completed',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  GUEST_MODE_ENTERED: 'guest_mode_entered',
  // Discovery
  MAP_EMPTY_STATE_SHOWN: 'map_empty_state_shown',
  // The visible map is empty but events were found just outside it. This is the
  // case map_empty_state_shown never measured: expansion succeeded, pins were
  // drawn off-screen, and the user was told nothing.
  MAP_POINTERS_SHOWN: 'map_pointers_shown',
  MAP_POINTER_TAPPED: 'map_pointer_tapped',
  SEARCH_PERFORMED: 'search_performed',
  // Creation
  EVENT_CREATED: 'event_created',
  ARTIST_INVITE_SENT: 'artist_invite_sent',
  // Engagement
  POST_LIKED: 'post_liked',
  CONTENT_SHARED: 'content_shared',
  // Booking
  PERFORMANCE_REQUEST_SENT: 'performance_request_sent',
  BOOKING_RESPONDED: 'booking_responded',
} as const;

// Deliberately NOT events:
//
// - map_viewed / event_detail_viewed / event_create_started — automatic screen
//   tracking already records these routes. A named duplicate adds volume and a
//   second number that can disagree with the first.
// - event_detail_viewed's `source` (map vs feed vs profile) is the one thing
//   screen tracking cannot give us, but capturing it means threading a param
//   through every navigation call site. Left out rather than half-done; revisit
//   if "which surface drives event views" becomes a live question.
// - subscription_notice_shown / activation_email_resent — no such UI exists.
//   Venues are on interim free access (FreeAccessNotice) and Stripe is stubbed
//   (M8-T1/T2), so there is no paywall notice and no resend button to hook.
//   These land with M8 alongside the conversion events.

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

/**
 * Property values are deliberately narrow. No PII leaves the device: ids, enums,
 * counts and booleans only — never an email, a name, or anything the user typed.
 */
type AnalyticsProperties = Record<string, string | number | boolean | null>;

export function track(event: AnalyticsEventName, properties?: AnalyticsProperties): void {
  safely(event, () => posthog?.capture(event, properties));
}

/**
 * Attach subsequent events to a real user. Only ever called for an authenticated
 * session — guests stay anonymous. PostHog merges the pre-signup anonymous
 * person into this one, which is what makes the signup funnel measurable.
 */
export function identify(userId: string): void {
  safely('identify', () => posthog?.identify(userId));
}

/**
 * Drop the current identity so the next account (or guest) on this device is not
 * attributed to the previous user. Belongs in every logout path.
 */
export function resetAnalytics(): void {
  safely('reset', () => posthog?.reset());
}

// ── Screen tracking ──────────────────────────────────────────────────

// Path segments that are record ids rather than route names: uuid, cuid/nanoid-ish
// (long opaque alphanumeric), or plain numeric.
const ID_SEGMENT =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9]+|[A-Za-z0-9_-]{16,})$/;

/**
 * Collapse record ids out of a pathname so PostHog's screen list stays readable
 * and carries no ids: `/events/0d5f.../analytics` → `/events/[id]/analytics`.
 *
 * Without this, every event detail view is its own distinct screen and the
 * screen report becomes thousands of one-visit rows instead of one funnel step.
 */
export function collapseRoute(pathname: string): string {
  return (
    pathname
      .split('/')
      .map((segment) => (ID_SEGMENT.test(segment) ? '[id]' : segment))
      .join('/') || '/'
  );
}

export function trackScreen(pathname: string): void {
  // Fire-and-forget: the SDK queues and retries internally, and a failed screen
  // event must never surface to the caller mid-navigation. `screen()` is async, so
  // the rejection needs an explicit catch — `void` alone only silences the lint
  // rule and would leave an unhandled rejection on every navigation.
  safely('screen', () => {
    posthog?.screen(collapseRoute(pathname)).catch(() => {});
  });
}
