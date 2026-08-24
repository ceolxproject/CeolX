import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { appToast } from '@/components/AppToast';
import { trpc } from '@/utils/trpc';

/**
 * Requesting the Stripe Customer Portal link (M8-T0 D-45).
 *
 * Cancelling, switching plan, changing a card and downloading invoices all happen on
 * Stripe's own hosted page — we build no billing screens. The app cannot link to it
 * either (D-16), so the only route is an emailed link, exactly like activation.
 *
 * The backend for this shipped with M8-T4 and nothing ever called it, so a subscribed
 * venue had no way to cancel or even see their plan. This is the missing half.
 *
 * Each tap mints a **fresh** Portal session server-side rather than reusing a stored URL
 * — Stripe's sessions are short-lived, so a cached one would be a link that silently
 * stops working.
 */

/**
 * Seconds the button stays disabled, matching the server's own throttle.
 *
 * The server arms its cooldown *before* sending, deliberately: a Postmark outage used to
 * throw before the throttle was recorded, so a client retrying on error minted unbounded
 * real Stripe sessions. The UI mirrors the window so a venue is not invited into a tap
 * the server will refuse.
 */
const PORTAL_COOLDOWN_SECONDS = 60;

/** Module-scoped so the countdown survives the settings sheet being dismissed. */
let cooldownUntil = 0;

export function useBillingPortal() {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))
  );
  const [sent, setSent] = useState(() => cooldownUntil > Date.now());

  useEffect(() => {
    // Reads the clock rather than decrementing, so a timer suspended by backgrounding
    // self-corrects instead of showing a stale countdown.
    const timer = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const mutation = useMutation(
    trpc.venues.requestBillingPortal.mutationOptions({
      onSuccess: ({ sentTo }) => {
        cooldownUntil = Date.now() + PORTAL_COOLDOWN_SECONDS * 1000;
        setRemaining(PORTAL_COOLDOWN_SECONDS);
        setSent(true);
        appToast.success('Check your inbox', `We've emailed your billing link to ${sentTo}.`);
      },
      onError: (err) => {
        const code = err.data?.code;
        // An email is already on its way — nothing for the venue to do, so this is not
        // presented as a failure.
        if (code === 'TOO_MANY_REQUESTS') {
          cooldownUntil = Date.now() + PORTAL_COOLDOWN_SECONDS * 1000;
          setRemaining(PORTAL_COOLDOWN_SECONDS);
          setSent(true);
          appToast.info('Billing link already sent — please check your inbox.');
          return;
        }
        // PRECONDITION_FAILED is the never-subscribed case. The server's wording already
        // says what to do ("activate your profile first"), so it is surfaced as-is
        // rather than replaced with something vaguer.
        appToast.error(err.message || 'Could not send the billing link');
      },
    })
  );

  return {
    request: () => {
      if (mutation.isPending || remaining > 0) return;
      mutation.mutate();
    },
    isPending: mutation.isPending,
    sent,
    remaining,
    disabled: mutation.isPending || remaining > 0,
  };
}
