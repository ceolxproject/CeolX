import * as Sentry from '@sentry/react-native';
import * as Linking from 'expo-linking';
import { router, usePathname, useRootNavigationState } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { decideInitialUrl } from '@/lib/initial-url-guard';

/**
 * Opens the screen a launch URL asked for when Expo Router didn't.
 *
 * Android delivers a link to an already-running process in two different ways.
 * If the Activity is alive it arrives as a url event and the router handles it.
 * If the Activity was destroyed while the JS process survived — which is what
 * backing out of the app does — the link instead launches a new Activity, and
 * on that path the router restores the navigation state it kept in module scope
 * in preference to the state the launch URL produced. The link is dropped
 * without a warning and the app opens on the previous screen, so a second
 * shared event link showed the first event.
 *
 * Anchoring the stacks stops the app from being backed out of in the first
 * place, which is the real fix; this covers the ways an Activity can still die
 * with the process intact — the task being reclaimed, "Don't keep activities".
 *
 * Runs once per Activity: the ref lives with the React tree, which is rebuilt
 * for a new Activity even though module state survives — the same asymmetry the
 * bug itself depends on. Deliberately not remembered across Activities, so
 * someone re-sending themselves the same link still gets it opened.
 */
export function useInitialUrlGuard(): void {
  const navigationState = useRootNavigationState();
  const isReady = !!navigationState?.key;
  const pathname = usePathname();
  const checked = useRef(false);

  // Read at decision time rather than closed over. The root layout renders
  // before the focused screen reports its route, and getInitialURL is a native
  // call, so by the time it resolves this ref holds the settled pathname —
  // reading `pathname` directly here would compare against the placeholder.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    // Android-only: this is the platform whose launch path drops the URL.
    if (Platform.OS !== 'android') return;
    if (!isReady || checked.current) return;
    checked.current = true;

    let cancelled = false;

    void Linking.getInitialURL()
      .then((initialUrl) => {
        if (cancelled) return;

        const decision = decideInitialUrl({
          initialUrl,
          currentPath: pathnameRef.current,
        });
        if (decision.action === 'ignore') return;

        Sentry.addBreadcrumb({
          category: 'navigation',
          level: 'info',
          message: 'initial url recovered',
          data: { href: decision.href, landedOn: pathnameRef.current },
        });

        router.navigate(decision.href as Href);
      })
      .catch(() => {
        // A launch URL we cannot read is not worth crashing a cold start over.
      });

    return () => {
      cancelled = true;
    };
  }, [isReady]);
}
