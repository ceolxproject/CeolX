import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { appToast } from '@/components/AppToast';
import { trpc } from '@/utils/trpc';

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

/** Mirrors `venue_profiles.subscription_status`. */
export type VenueSubscriptionStatusValue =
  | 'inactive'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled';

/** Seconds the resend button stays disabled, matching the server's cooldown. */
const RESEND_COOLDOWN_SECONDS = 60;

function useCooldown(seconds: number) {
  const [remaining, setRemaining] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (remaining <= 0) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      return;
    }
    timer.current = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [remaining]);

  return { remaining, start: () => setRemaining(seconds) };
}

interface ActivationPromptProps {
  /** True once an email has been sent this session, so copy shifts to "check inbox". */
  hasRequested?: boolean;
  onRequested?: () => void;
}

/**
 * `inactive` / `cancelled` — the venue has no live subscription.
 *
 * Deliberately has no price and no link. The button asks the server to email a
 * secure link; everything after that happens outside the app (D-16, D-60).
 */
export function VenueActivationPrompt({ hasRequested, onRequested }: ActivationPromptProps) {
  const { remaining, start } = useCooldown(RESEND_COOLDOWN_SECONDS);
  const [sent, setSent] = useState(hasRequested ?? false);

  const requestActivation = useMutation(
    trpc.venues.requestActivation.mutationOptions({
      onSuccess: ({ sentTo }) => {
        setSent(true);
        start();
        onRequested?.();
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
          Your profile isn&apos;t live yet
        </Text>
      </View>

      <Text className="text-xs leading-[18px] text-white/60 font-urbanist">
        {sent
          ? 'Check your inbox to finish setting up your subscription. The link works for a limited time — if it expires, request a new one.'
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
  if (!trialEndsAt) return null;

  const ends = new Date(trialEndsAt);
  if (Number.isNaN(ends.getTime())) return null;

  const formatted = ends.toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

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

/**
 * Copy for the disabled create actions (V-14).
 *
 * Creating public content is part of the paid service. The server refuses it too
 * (`assertVenueMayPublish`) — this only explains why the button is dim, because a
 * disabled control with no reason reads as a bug.
 */
export const PUBLISH_BLOCKED_MESSAGE =
  'An active subscription is needed to publish. Check your email to reactivate.';

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
        {PUBLISH_BLOCKED_MESSAGE}
      </Text>
    </View>
  );
}

/** Which surface a venue's own subscription status should show. */
export function venueStateFor(status: VenueSubscriptionStatusValue | null | undefined) {
  switch (status) {
    case 'trialing':
      return 'trial' as const;
    case 'active':
      return 'none' as const;
    case 'past_due':
      return 'past_due' as const;
    // `cancelled` is treated the same as `inactive`: both mean "no live
    // subscription", and both are recoverable by the same activation flow. The one
    // difference — no second free trial (D-42) — is enforced server-side, so the
    // app needs no separate state for it.
    case 'inactive':
    case 'cancelled':
    default:
      return 'activate' as const;
  }
}

/**
 * Can this venue publish? (V-14.)
 *
 * A venue inside the grace window still can: they are visible and still a paying
 * customer whose card expired. Mirrors the server-side rule exactly.
 */
export function venueMayPublish(status: VenueSubscriptionStatusValue | null | undefined): boolean {
  return status === 'trialing' || status === 'active' || status === 'past_due';
}
