import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import { useUpdates } from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { shouldApplyOnResume } from '@/lib/check-for-update';

/**
 * Applies a downloaded OTA bundle when the user comes back after being away.
 *
 * The cold-start check in `_layout` only runs once per JS process, and on iOS
 * that process survives backgrounding for days — so a user who never swipes the
 * app out of the switcher could sit on a stale bundle indefinitely, even though
 * expo-updates had already downloaded the new one. That gap is why updates were
 * only landing when someone tapped "Check for updates" in About and restarted
 * by hand.
 *
 * The common path costs no network at all: `checkAutomatically` (default
 * ON_LOAD) has usually already staged a bundle, so `isUpdatePending` is true and
 * all that's missing is the restart. When nothing is staged we only start the
 * download — no reload — so a slow connection can never restart the app at an
 * arbitrary moment. It applies on the next qualifying resume instead.
 *
 * Deliberately does NOT reuse `applyPendingUpdate`: that one skips its reload
 * when `Linking.getInitialURL()` is set, which protects cold-start deep-link
 * restoration but stays set for the life of the process — so on a resume it
 * would suppress the reload forever for anyone who opened the app from a link.
 */
export function useApplyUpdateOnResume(): void {
  const { isUpdatePending } = useUpdates();

  // Read inside the listener, which is installed once — a ref keeps it current
  // without tearing down and re-adding the subscription on every state change.
  const pendingRef = useRef(isUpdatePending);
  pendingRef.current = isUpdatePending;

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    // null until the app has actually been backgrounded. iOS passes through
    // 'inactive' for a notification shade or a control-centre pull; only
    // 'background' counts as the user leaving.
    let backgroundedAt: number | null = null;

    // A link arriving is what brings the app forward, and the 'url' event fires
    // before the resume settles — so record it and let shouldApplyOnResume hold
    // the reload back rather than restarting on top of the incoming route.
    let lastDeepLinkAt: number | null = null;
    const linkSubscription = Linking.addEventListener('url', () => {
      lastDeepLinkAt = Date.now();
    });

    const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'background') {
        backgroundedAt = Date.now();
        return;
      }
      if (status !== 'active') return;

      const awaySince = backgroundedAt;
      backgroundedAt = null;
      if (!shouldApplyOnResume(awaySince, Date.now(), lastDeepLinkAt)) return;

      if (pendingRef.current) {
        // Already on the device — this is just the restart that was missing.
        void Updates.reloadAsync().catch(() => {});
        return;
      }

      // Nothing staged yet. Fetch it for the next resume rather than restarting
      // the user mid-session once a download happens to finish.
      void Updates.checkForUpdateAsync()
        .then((check) => (check.isAvailable ? Updates.fetchUpdateAsync() : null))
        .catch(() => {});
    });

    return () => {
      subscription.remove();
      linkSubscription.remove();
    };
  }, []);
}
