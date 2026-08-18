import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { PUBLISH_BLOCKED_MESSAGE as BLOCKED_MESSAGE } from './venue-subscription-state.utils';

import { appToast } from '@/components/AppToast';
import { trpc } from '@/utils/trpc';

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
 * Cooldowns are enforced server-side; the button reflects them so the venue is not
 * surprised by a rate-limit error.
 */

/** Seconds the resend button stays disabled, matching the server's cooldown. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Cooldown deadline, module-scoped so it survives the component unmounting.
 *
 * Navigating away from the profile tab and back used to reset the countdown and the
 * "check your inbox" copy, so the button read "Activate profile" again with no cooldown
 * while the server was still refusing. The server is authoritative either way; this
 * keeps the UI honest between mounts.
 */
let resendCooldownUntil = 0;

/**
 * Seconds left on the resend cooldown.
 *
 * Tracks an absolute deadline and derives the remaining time from it. The previous
 * version decremented a counter and depended on that counter, so the effect tore down
 * and recreated the interval on every tick — restarting the 1000ms window each time and
 * accumulating drift — and, because JS timers suspend when the app is backgrounded, it
 * still read "Resend in 43s" minutes after the server's cooldown had expired.
 */
function useCooldown(seconds: number) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((resendCooldownUntil - Date.now()) / 1000))
  );

  useEffect(() => {
    // One interval for the component's lifetime. It only reads the clock, so a
    // suspended timer self-corrects on the next tick instead of drifting.
    const timer = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((resendCooldownUntil - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return {
    remaining,
    start: () => {
      resendCooldownUntil = Date.now() + seconds * 1000;
      setRemaining(seconds);
    },
  };
}

/**
 * `inactive` / `cancelled` — the venue has no live subscription.
 *
 * Deliberately has no price and no link. The button asks the server to email a
 * secure link; everything after that happens outside the app (D-16, D-60).
 */
/**
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
  const { remaining, start } = useCooldown(RESEND_COOLDOWN_SECONDS);
  // Seeded from the shared deadline so returning to this screen mid-cooldown keeps the
  // "check your inbox" copy instead of inviting another tap the server will refuse.
  const [sent, setSent] = useState(() => resendCooldownUntil > Date.now());

  const requestActivation = useMutation(
    trpc.venues.requestActivation.mutationOptions({
      onSuccess: ({ sentTo }) => {
        setSent(true);
        start();
        appToast.success(`Activation email sent to ${sentTo}`);
      },
      onError: (err) => {
        // TOO_MANY_REQUESTS is expected if they tapped twice — reflect the cooldown
        // rather than presenting it as a failure.
        if (err.data?.code === 'TOO_MANY_REQUESTS') {
          start();
          appToast.info('Email already sent — please check your inbox.');
          return;
        }
        appToast.error(err.message || 'Could not send the activation email');
      },
    })
  );

  const disabled = requestActivation.isPending || remaining > 0;

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
        {sent
          ? 'Check your inbox to finish setting up your subscription. The link works for a limited time — if it expires, request a new one.'
          : variant === 'grandfathered'
            ? 'Your profile is live and artists can find you. Set up your subscription to keep it that way — we’ll email you a secure link.'
            : 'Artists can’t find you until your subscription is set up. We’ll email you a secure link to finish.'}
      </Text>

      <Pressable
        disabled={disabled}
        onPress={() => requestActivation.mutate()}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        className={`mt-0.5 self-start rounded-full px-4 py-2 ${
          disabled ? 'bg-white/10' : 'bg-[#C8FF2F]'
        }`}
      >
        {requestActivation.isPending ? (
          <ActivityIndicator size="small" color="#000" />
        ) : (
          <Text
            className={`text-xs font-bold uppercase tracking-[0.5px] font-urbanist ${
              disabled ? 'text-white/40' : 'text-black'
            }`}
          >
            {remaining > 0 ? `Resend in ${remaining}s` : sent ? 'Resend email' : 'Activate profile'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

interface TrialNoticeProps {
  /** ISO trial end date, when known. */
  trialEndsAt?: string | null;
}

/**
 * `trialing` — fully visible, so this is information rather than a warning.
 *
 * Surfaces the end date because the trial runs six months and the first charge is
 * otherwise a surprise. The emailed warning seven days out (D-30) is the real
 * safeguard; this is its in-app counterpart.
 */
export function VenueTrialNotice({ trialEndsAt }: TrialNoticeProps) {
  // Renders without a date rather than returning null.
  //
  // `users.me` LEFT JOINs venue_subscriptions, so `trialEndsAt` is null whenever the
  // billing row is absent — which is every seeded venue, because seed.ts inserts them
  // as `trialing` with no subscription row. Returning null meant the trial notice
  // silently never appeared on any dev or staging database, while `venueStateFor` still
  // said 'trial' so nothing else filled the gap and the wrapper kept its spacing.
  const ends = trialEndsAt ? new Date(trialEndsAt) : null;
  const formatted =
    ends && !Number.isNaN(ends.getTime())
      ? ends.toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

  return (
    <View className="flex-row items-start gap-2 rounded-xl bg-[#333335] px-3 py-2.5">
      <Ionicons
        name="time-outline"
        size={16}
        color="rgba(255,255,255,0.6)"
        style={{ marginTop: 1 }}
      />
      <Text className="shrink text-xs leading-[18px] text-white/60 font-urbanist">
        You&apos;re on a free trial until {formatted}. We&apos;ll email you before the first payment
        — no action needed until then.
      </Text>
    </View>
  );
}

/**
 * `past_due`, still inside the grace window (D-57 phase one).
 *
 * A banner, not a block. The grace period exists precisely to absorb the card that
 * merely expired, so freezing the account here would defeat its purpose — that was
 * the argument put to the client and accepted.
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

export function VenuePublishBlockedNotice() {
  return (
    <View className="flex-row items-start gap-2 rounded-xl bg-[#333335] px-3 py-2.5">
      <Ionicons
        name="lock-closed-outline"
        size={16}
        color="rgba(255,255,255,0.6)"
        style={{ marginTop: 1 }}
      />
      <Text className="shrink text-xs leading-[18px] text-white/60 font-urbanist">
        {BLOCKED_MESSAGE}
      </Text>
    </View>
  );
}
