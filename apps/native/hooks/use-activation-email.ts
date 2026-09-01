import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { appToast } from '@/components/AppToast';
import { AnalyticsEvent, track } from '@/lib/analytics';
import { queryClient, trpc } from '@/utils/trpc';

/**
 * Requesting the venue activation email (M8-T0 D-16, D-26).
 *
 * Two surfaces ask for the same email — the onboarding hand-off screen and the
 * profile prompt — so the cooldown, the "already sent" reading of a 429 and the
 * funnel events live here rather than being written twice. The first copy of this
 * logic lived inside the profile prompt; the second surface is exactly the point at
 * which the two would start disagreeing about whether an email is already in flight.
 *
 * Never returns a URL or a token. The app must not be able to surface a payment link
 * even accidentally (D-16); the server enforces that too.
 */

/** Seconds the resend button stays disabled, matching the server's cooldown. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Cooldown deadline, module-scoped so it survives the component unmounting.
 *
 * Navigating away from the profile tab and back used to reset the countdown and the
 * "check your inbox" copy, so the button read "Activate profile" again with no cooldown
 * while the server was still refusing. Module scope also makes the two surfaces share
 * one deadline: closing the onboarding screen and opening the profile must not offer a
 * tap the server will reject.
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

/** Which surface asked, so the two are separable in the funnel. */
export type ActivationEmailSource = 'onboarding' | 'profile' | 'publish_blocked';

interface UseActivationEmailOptions {
  source: ActivationEmailSource;
  /**
   * Send one automatically on mount, once.
   *
   * The onboarding screen tells the venue an email is already on its way, so it has to
   * actually be on its way — the claim is made by this call, not by the copy.
   */
  sendOnMount?: boolean;
  /**
   * Show toasts for the outcome. Off where the surface renders the outcome itself; a
   * toast reading "sent to x@y" on top of a screen already saying so is noise.
   */
  notify?: boolean;
}

export function useActivationEmail({
  source,
  sendOnMount = false,
  notify = true,
}: UseActivationEmailOptions) {
  const { remaining, start } = useCooldown(RESEND_COOLDOWN_SECONDS);
  // Seeded from the shared deadline so arriving mid-cooldown keeps the "check your
  // inbox" reading instead of inviting another tap the server will refuse.
  const [sent, setSent] = useState(() => resendCooldownUntil > Date.now());
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation(
    trpc.venues.requestActivation.mutationOptions({
      onSuccess: ({ sentTo: address }) => {
        // On success only. A rate-limited tap sends nothing, so counting it here would
        // overstate how many links the venue actually received.
        track(AnalyticsEvent.VENUE_ACTIVATION_EMAIL_REQUESTED, { resend: sent, source });
        setSent(true);
        setSentTo(address);
        setError(null);
        start();
        if (notify) appToast.success(`Activation email sent to ${address}`);
      },
      onError: (err) => {
        // TOO_MANY_REQUESTS means an email went out moments ago — from the venue's point
        // of view that is a success with nothing left to do, so reflect the cooldown
        // rather than presenting it as a failure. Reachable on this screen without any
        // tapping: a remount re-runs the mount send while the first is still in cooldown.
        if (err.data?.code === 'TOO_MANY_REQUESTS') {
          setSent(true);
          setError(null);
          start();
          if (notify) appToast.info('Email already sent — please check your inbox.');
          return;
        }
        // CONFLICT — the server sees live billing on this venue, so it is the app that is
        // wrong, not the venue. Activation completes in a browser (D-16) and nothing pushes
        // the result back, so a screen mounted across that moment keeps a `users.me` from
        // before the webhook: the create button stays dim while the server reports the
        // subscription is already active (QA, 01/09/2026). Showing that sentence as an error
        // left the venue holding a message saying they had paid and no control that worked.
        // Refetching is the remedy — the gate re-resolves and the blocked surface releases
        // itself.
        if (err.data?.code === 'CONFLICT') {
          setError(null);
          void queryClient.invalidateQueries({ queryKey: trpc.users.me.queryKey() });
          if (notify) appToast.info('Your subscription is already active.');
          return;
        }

        const message = err.message || 'Could not send the activation email';
        setError(message);
        if (notify) appToast.error(message);
      },
    })
  );

  // Destructured because `mutate` is referentially stable while the result object is
  // not — depending on the object would re-run the mount effect on every status change.
  const { mutate } = mutation;

  const request = () => {
    if (mutation.isPending || remaining > 0) return;
    mutate();
  };

  // Ref-guarded rather than relying on the dep array alone: fast refresh and StrictMode
  // both double-invoke effects, and a second send would revoke the first token —
  // invalidating the very link the venue is about to open (D-18).
  const autoSent = useRef(false);
  useEffect(() => {
    if (!sendOnMount || autoSent.current) return;
    autoSent.current = true;
    mutate();
  }, [sendOnMount, mutate]);

  return {
    /** Ask for an email. No-ops while one is in flight or the cooldown is running. */
    request,
    isPending: mutation.isPending,
    /** An email is out — either just sent, or the server said one already was. */
    sent,
    /** Address the server actually sent to. Null when only the 429 path was taken. */
    sentTo,
    /** Set only for genuine failures; a 429 is not one. */
    error,
    /** Seconds until another request is allowed. */
    remaining,
    disabled: mutation.isPending || remaining > 0,
  };
}
