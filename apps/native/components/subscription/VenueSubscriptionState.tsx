import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import {
  ACTIVATION_POLL_MS,
  PUBLISH_BLOCKED_REASON as BLOCKED_REASON,
  formatTrialEnd,
} from './venue-subscription-state.utils';

import { useActivationEmail } from '@/hooks/use-activation-email';
import { useBillingPortal } from '@/hooks/use-billing-portal';
import { useMe } from '@/hooks/use-me';
import { AnalyticsEvent, track } from '@/lib/analytics';

// Re-exported so existing importers keep working after the pure logic moved out into a
// module the node test environment can load.
export {
  PUBLISH_BLOCKED_MESSAGE,
  venueStateFor,
  type VenueSubscriptionStatusValue,
} from './venue-subscription-state.utils';

/**
 * Venue subscription states in the app (M8-T0 D-15, D-16, D-57).
 *
 * The hard constraint shaping all of this: **no price, payment URL or checkout
 * button may appear anywhere in the app** (D-16). That is the only approach
 * compliant on both stores in every country without a special entitlement, so
 * "Activate Profile" sends an email and says so — it never opens anything.
 *
 * Weight follows urgency, not uniformity. A state the venue must act on gets a card with
 * a button; a state that needs nothing from them gets a badge with the detail one tap
 * away. Rendering every state as a full-width card put a paragraph of billing prose in
 * the middle of a healthy venue's profile header, above their own address.
 */

/**
 * `inactive` / `cancelled` — the venue has no live subscription.
 *
 * Deliberately has no price and no link. The button asks the server to email a
 * secure link; everything after that happens outside the app (D-16, D-60).
 *
 * @param variant `hidden` — the profile is genuinely not live yet (a new venue that never
 * completed payment setup). `grandfathered` — the profile **is** live and working, but has
 * no subscription and will be hidden when the gate turns on (O-08).
 *
 * The distinction is not cosmetic. A venue that signed up before subscriptions existed
 * has a working profile today; telling it "your profile isn't live yet" is simply false,
 * and would read as us having broken something. It still needs prompting — it loses access
 * at cutover — but the ask is "keep it live", not "make it live".
 */
export function VenueActivationPrompt({
  variant = 'hidden',
}: {
  variant?: 'hidden' | 'grandfathered';
}) {
  const activation = useActivationEmail({ source: 'profile' });

  // Poll `users.me` while this prompt is on screen, so the card gives way to the trial
  // badge on its own once the webhook lands.
  //
  // Payment happens in a browser, usually on a laptop (D-16), so the app gets no signal at
  // all — and the three things a venue would try instead did not work: the profile tab
  // stays mounted so switching tabs refetches nothing, pull-to-refresh only reloaded the
  // events list, and `staleTime` is 0 but a refetch still needs a *trigger*. The only one
  // that worked was backgrounding the app and coming back, which nobody thinks to do.
  //
  // Scoped tightly by where it lives: this component only renders for a venue with no live
  // subscription, so the poll starts when the wait starts and stops the moment the state
  // changes and this unmounts. Shares the `users.me` cache entry, so it costs one small
  // request per interval and nothing else re-fetches.
  const me = useMe({ refetchInterval: ACTIVATION_POLL_MS });

  // Funnel entry. Fired on mount rather than on render, so re-renders from the cooldown
  // ticking every second do not each count as another impression.
  //
  // Deliberately not deduped across mounts: "how many times did we have to show this
  // before they acted" is the useful number, and PostHog can collapse to unique users
  // when the question is reach instead. `sent` is carried so a prompt that is already
  // waiting on an email is distinguishable from a first sighting.
  const promptSeen = useRef(false);
  useEffect(() => {
    if (promptSeen.current) return;
    promptSeen.current = true;
    track(AnalyticsEvent.VENUE_ACTIVATION_PROMPT_SHOWN, {
      already_requested: activation.sent,
      source: 'profile',
    });
    // `sent` is read once at mount on purpose — this is an impression, not a subscription
    // to its later changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="rounded-xl bg-[#333335] px-4 py-3.5 gap-2.5">
      <View className="flex-row items-start gap-2">
        <Ionicons name="lock-closed-outline" size={16} color="#C8FF2F" style={{ marginTop: 1 }} />
        <Text className="shrink text-sm font-bold text-white font-urbanist">
          {variant === 'grandfathered'
            ? 'Action needed to keep your profile live'
            : "Your profile isn't live yet"}
        </Text>
      </View>

      <Text className="text-xs leading-[18px] text-white/60 font-urbanist">
        {activation.sent
          ? 'Check your inbox to finish setting up your subscription. The link works for a limited time — if it expires, request a new one.'
          : variant === 'grandfathered'
            ? 'Your profile is live and artists can find you. Set up your subscription to keep it that way — we’ll email you a secure link.'
            : 'Artists can’t find you until your subscription is set up. We’ll email you a secure link to finish.'}
      </Text>

      <Pressable
        disabled={activation.disabled}
        onPress={activation.request}
        accessibilityRole="button"
        accessibilityState={{ disabled: activation.disabled }}
        className={`mt-0.5 self-start rounded-full px-4 py-2 ${
          activation.disabled ? 'bg-white/10' : 'bg-[#C8FF2F]'
        }`}
      >
        {activation.isPending ? (
          <ActivityIndicator size="small" color="#000" />
        ) : (
          <Text
            className={`text-xs font-bold uppercase tracking-[0.5px] font-urbanist ${
              activation.disabled ? 'text-white/40' : 'text-black'
            }`}
          >
            {activation.remaining > 0
              ? `Resend in ${activation.remaining}s`
              : activation.sent
                ? 'Resend email'
                : 'Activate profile'}
          </Text>
        )}
      </Pressable>

      {/* Refresh Status — the story's §8 secondary action, shown once an email is out.
          The screen already polls every 10s, so this is not the mechanism that makes
          activation appear; it is the affordance. A venue who has just paid in a browser
          on another device has no way of knowing anything is being checked, and will
          otherwise sit there or force-quit. Hidden before the first send, when there is
          nothing to refresh toward. */}
      {activation.sent && (
        <Pressable
          onPress={() => void me.refetch()}
          disabled={me.isFetching}
          accessibilityRole="button"
          accessibilityLabel="Refresh status"
          accessibilityState={{ disabled: me.isFetching }}
          hitSlop={8}
          className="flex-row items-center gap-1.5 self-start active:opacity-60"
        >
          {me.isFetching ? (
            <ActivityIndicator size="small" color="#8D8D8D" />
          ) : (
            <Ionicons name="refresh-outline" size={13} color="#8D8D8D" />
          )}
          <Text className="text-xs font-bold uppercase tracking-[0.5px] text-[#8D8D8D] font-urbanist">
            {me.isFetching ? 'Checking…' : 'Refresh status'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

interface TrialBadgeProps {
  /** ISO trial end date, when known. */
  trialEndsAt?: string | null;
}

/**
 * `trialing` — a badge, not a card.
 *
 * The venue is fully visible and owes us nothing until the first charge, so this is the
 * one subscription state with no action attached. It was a full-width card carrying two
 * sentences, which pushed the venue's address and stats down the header and read as a
 * warning on a profile where nothing was wrong. The end date still matters — six months
 * is long enough for the first charge to be a surprise — so it moves one tap away
 * instead of disappearing. The emailed warning seven days out (D-30) remains the real
 * safeguard; this is its in-app counterpart.
 *
 * `Alert.alert` rather than a bottom sheet on purpose: two sentences, no interaction, and
 * the platform dialog is already this app's idiom for exactly that (it is what the badge
 * this replaces used, and what a dozen other screens use).
 */
export function VenueTrialBadge({ trialEndsAt }: TrialBadgeProps) {
  // Renders without a date rather than returning null.
  //
  // `users.me` LEFT JOINs venue_subscriptions, so `trialEndsAt` is null whenever the
  // billing row is absent — which is every seeded venue, because seed.ts inserts them
  // as `trialing` with no subscription row. Returning null meant the trial state
  // silently never appeared on any dev or staging database, while `venueStateFor` still
  // said 'trial' so nothing else filled the gap.
  const ends = trialEndsAt ? new Date(trialEndsAt) : null;
  const formatted =
    ends && !Number.isNaN(ends.getTime())
      ? ends.toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

  const detail = formatted
    ? `Your free trial runs until ${formatted}. We'll email you before the first payment — there's nothing you need to do until then.`
    : "You're on a free trial. We'll email you before the first payment — there's nothing you need to do until then.";

  return (
    <Pressable
      onPress={() => Alert.alert('Free trial', detail)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Trial period. ${detail}`}
      className="flex-row items-center gap-1 rounded-[6px] border border-green-4 px-1.5 py-px active:opacity-60"
    >
      <Text className="text-[10px] font-bold uppercase tracking-[0.2px] text-green-10 font-urbanist">
        Trial period
      </Text>
      <Ionicons name="information-circle-outline" size={11} color="#C8FF2F" />
    </Pressable>
  );
}

/**
 * `past_due`, on the venue's own profile — the quiet half of the past-due state.
 *
 * A banner, not a block, because the profile screen is where the venue goes to FIX the
 * problem: Settings → Manage Subscription is two taps from here, and covering that with
 * an overlay would trap them. The holding block lives on the map tab instead
 * (`VenuePastDueHoldingBlock`), which is what the client asked for on 15 Aug.
 */
export function VenuePastDueBanner() {
  return (
    <View className="flex-row items-start gap-2 rounded-xl bg-[#3A2A15] px-3 py-2.5">
      <Ionicons name="alert-circle-outline" size={16} color="#F5A524" style={{ marginTop: 1 }} />
      <Text className="shrink text-xs leading-[18px] text-[#F5C88A] font-urbanist">
        Your last payment didn&apos;t go through. Your profile is still live for now — check the
        email from us to update your card.
      </Text>
    </View>
  );
}

/**
 * `past_due` — the holding block over the map (client decision, 15 Aug 2026).
 *
 * "I think if we could have a holding block on the home screen with the active map in
 * the background but the account is frozen to use." The map renders behind it and keeps
 * animating; this sits on top and swallows every touch, so the tab is genuinely frozen
 * rather than merely covered.
 *
 * Scope of the freeze — the story left this open (§10) and it contradicts its own rule
 * 13, which says a lapsed venue may still view content, edit its profile and fix payment.
 * Resolved as: the MAP tab only. Discover, Bookings and Profile stay usable, so rule 13
 * holds and the venue always has a route to billing. Freezing everything would leave the
 * fix-payment path behind the very block complaining about payment — the trap §10 warns
 * about in as many words. Confirm with Pratiksha before widening it.
 *
 * `inset-0`, not `h-full w-full`: over a flex-sized parent the latter collapses to 0×0
 * and the overlay silently never appears.
 *
 * No payment UI and no URL (D-16) — the button emails a Stripe link, exactly like every
 * other billing action in the app.
 */
export function VenuePastDueHoldingBlock({ hideAt }: { hideAt: string | null }) {
  const portal = useBillingPortal();

  // Absent only if `past_due_since` is somehow missing. Better a block with no date than
  // one reading "hidden on Invalid Date" — and the sentence still works without it.
  const hideDate = hideAt ? formatTrialEnd(hideAt) : null;

  return (
    <View
      // Not `pointerEvents="box-none"` — swallowing touches IS the freeze. The map keeps
      // rendering behind, which is the point of the client's "active map in the background".
      accessibilityViewIsModal
      className="absolute inset-0 items-center justify-center bg-black/70 px-6"
    >
      <View className="w-full max-w-[340px] rounded-2xl bg-[#1C1C1E] px-5 py-6 gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-[#3A2A15]">
          <Ionicons name="alert-circle-outline" size={22} color="#F5A524" />
        </View>

        <Text className="text-lg font-bold text-white font-urbanist">
          Your payment didn&apos;t go through
        </Text>

        <Text className="text-sm leading-[21px] text-white/60 font-urbanist">
          {hideDate
            ? `We couldn't take your subscription payment. Your profile stays visible until ${hideDate} — after that it's hidden until payment succeeds.`
            : "We couldn't take your subscription payment. Your profile stays visible for now — after that it's hidden until payment succeeds."}{' '}
          Nothing is deleted.
        </Text>

        <Pressable
          disabled={portal.disabled}
          onPress={portal.request}
          accessibilityRole="button"
          accessibilityState={{ disabled: portal.disabled }}
          className={`mt-1 items-center rounded-full px-4 py-3 ${
            portal.disabled ? 'bg-white/10' : 'bg-[#C8FF2F]'
          }`}
        >
          {portal.isPending ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text
              className={`text-xs font-bold uppercase tracking-[0.5px] font-urbanist ${
                portal.disabled ? 'text-white/40' : 'text-black'
              }`}
            >
              {portal.remaining > 0
                ? `Resend in ${portal.remaining}s`
                : portal.sent
                  ? 'Resend billing link'
                  : 'Email me a billing link'}
            </Text>
          )}
        </Pressable>

        <Text className="text-center text-[11px] leading-4 text-white/40 font-urbanist">
          {portal.sent
            ? 'Check your inbox — the link opens your billing page.'
            : 'We’ll email a secure link to update your card.'}
        </Text>
      </View>
    </View>
  );
}

/**
 * Why the publish button is dim, and a way out of it.
 *
 * Tappable, because the dead end it replaces was worse than the block itself. The copy
 * used to read "check your email to reactivate" — but a venue reading this notice is by
 * definition someone the email did not reach: it expired after 45 minutes (D-17), went to
 * spam, or was never opened. Sending them back to an inbox that has nothing useful in it
 * leaves them stuck with no way to progress. The profile can always mint a fresh link, so
 * this navigates straight there instead of describing where to go.
 *
 * `replace`, not `push`: the venue cannot publish, so there is nothing to come back to,
 * and leaving the composer on the stack invites them to return to a screen that still
 * refuses them.
 *
 * @param surface Which create flow was blocked, so the two are separable in the funnel.
 */
export function VenuePublishBlockedNotice({ surface }: { surface: 'post' | 'event' }) {
  // Requests the activation email in place rather than navigating anywhere.
  //
  // This used to open the profile. On the event form that was destructive: the notice sits
  // on step 3 of 3, the form keeps no draft, and leaving unmounted it — so three steps of
  // typing and an uploaded cover image were gone, and the device back button landed on the
  // event list rather than the form (QA, 19/08/2026). Whichever way that navigation was
  // written, push or replace, the venue still had to leave a form they had just filled in
  // to reach a button that only sends an email. So the button comes here instead: the form
  // survives, and a venue who then activates can publish the very event they were writing.
  const activation = useActivationEmail({ source: 'publish_blocked', notify: false });

  // Fired here rather than at each call site: this component is the single point where
  // a venue is actually told publishing is blocked, so wiring it once cannot drift out
  // of step with the screens that render it.
  const reported = useRef(false);
  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    track(AnalyticsEvent.VENUE_PUBLISH_BLOCKED, { surface });
  }, [surface]);

  const label = activation.error
    ? activation.error
    : activation.sent
      ? 'Activation link sent — check your inbox to finish setting up.'
      : `${BLOCKED_REASON} Tap to get an activation link by email.`;

  return (
    <Pressable
      disabled={activation.disabled}
      onPress={activation.request}
      accessibilityRole="button"
      accessibilityState={{ disabled: activation.disabled }}
      accessibilityLabel={label}
      className="flex-row items-center gap-2 rounded-xl bg-[#333335] px-3 py-2.5 active:opacity-60"
    >
      <Ionicons
        name={activation.sent ? 'mail-unread-outline' : 'lock-closed-outline'}
        size={16}
        color="rgba(255,255,255,0.6)"
      />
      <Text className="shrink text-xs leading-[18px] text-white/60 font-urbanist">{label}</Text>
      {activation.isPending ? (
        <ActivityIndicator size="small" color="#C8FF2F" />
      ) : activation.remaining > 0 ? (
        <Text className="text-xs font-bold text-white/40 font-urbanist">
          {activation.remaining}s
        </Text>
      ) : (
        /* The affordance. Without it the row reads as static text and nobody taps it. */
        <Ionicons name="chevron-forward" size={16} color="#C8FF2F" />
      )}
    </Pressable>
  );
}
