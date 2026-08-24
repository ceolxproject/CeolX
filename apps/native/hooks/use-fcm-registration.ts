import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { AnalyticsEvent, collapseRoute, track } from '@/lib/analytics';
import { requestNotificationPermission } from '@/lib/fcm-permission';
import { resolveNotificationRoute } from '@/lib/notification-route';
import { trpc } from '@/utils/trpc';

// ─────────────────────────────────────────────────────────────────────────────
// Wires the device into FCM once a session is active (M7-T1, mentor pattern).
//   1. Asks for notification permission via expo-notifications.
//   2. Fetches the native FCM token (iOS Firebase SDK provides it; RNFB/app
//      is what makes getDevicePushTokenAsync return FCM rather than APNs).
//   3. Calls deviceTokens.refresh — handles both first-time insert and the
//      "device already known, just touch lastUsedAt + reactivate" path.
//   4. Subscribes to: foreground notification (invalidate inbox), tap
//      response (deep-link), and the cold-start last response (deep-link
//      after auth resolves).
//
// Persona switching is intentionally NOT performed on tap — CeolX V1 has a
// fixed `current_role` per account (CLAUDE.md, MoM 03/04/2026 §2.1). The
// payload still carries `persona` for future analytics.
// ─────────────────────────────────────────────────────────────────────────────

const FCM_DATA_ROUTE_KEY = 'route';

// SDK 55 deprecated shouldShowAlert in favour of shouldShowBanner +
// shouldShowList. The handler runs on every received notification while
// the app is foregrounded; without it the OS won't display anything.
Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
});

function navigateFromRemoteData(data: unknown): void {
  if (typeof data !== 'object' || data === null) return;
  const route = (data as Record<string, unknown>)[FCM_DATA_ROUTE_KEY];
  // Every tap path (foreground, background, cold start) funnels through here, so
  // this is the one place push engagement can be measured. `persona` is the enum
  // the payload already carries; the route is collapsed rather than sent raw so a
  // deep link to /u/<username> can't smuggle an identifier into the property.
  const persona = (data as Record<string, unknown>).persona;
  track(AnalyticsEvent.NOTIFICATION_OPENED, {
    persona: typeof persona === 'string' ? persona : null,
    route: typeof route === 'string' ? collapseRoute(route) : null,
  });
  if (typeof route === 'string' && route.startsWith('/')) {
    // Normalise to a real screen — legacy/bare server routes would otherwise
    // hit +not-found ("Page Not Found"). Asana 1215279003641211.
    router.push(resolveNotificationRoute(route));
  }
}

export function useFcmRegistration(): void {
  const { user, isAuthenticated, isGuest } = useAuth();
  const queryClient = useQueryClient();
  const refreshMutation = useMutation(trpc.deviceTokens.refresh.mutationOptions());

  // mutateAsync is referentially stable; useMutation returns a new wrapper
  // each render, so we hold the method in a ref to keep effect deps narrow.
  const refreshAsyncRef = useRef(refreshMutation.mutateAsync);
  refreshAsyncRef.current = refreshMutation.mutateAsync;

  useEffect(() => {
    if (!isAuthenticated || isGuest || !user) return;

    let cancelled = false;
    const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

    // Foreground notification — handler at module init shows the banner;
    // we just refresh the inbox queries so the bell badge updates instantly.
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: [['notifications', 'list']] });
      void queryClient.invalidateQueries({ queryKey: [['notifications', 'unreadCount']] });
    });

    // Tap (background or foreground) — deep-link to the route.
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromRemoteData(response.notification.request.content.data);
    });

    void (async () => {
      try {
        const granted = await requestNotificationPermission();
        if (!granted || cancelled) return;

        const tokenData = await Notifications.getDevicePushTokenAsync();
        const token = typeof tokenData?.data === 'string' ? tokenData.data : null;
        if (cancelled || !token) return;

        await refreshAsyncRef.current({ token, platform });

        // Cold start — route the user where the tapped notification points.
        // expo-notifications doesn't have an onTokenRefresh equivalent; FCM
        // tokens rarely rotate, and any rotation is picked up on the next
        // launch by this same flow.
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          navigateFromRemoteData(lastResponse.notification.request.content.data);
        }
      } catch (error) {
        console.warn('[FCM] init failed:', error);
      }
    })();

    return () => {
      cancelled = true;
      receivedSub.remove();
      responseSub.remove();
    };
  }, [isAuthenticated, isGuest, user?.id, queryClient]);
}
