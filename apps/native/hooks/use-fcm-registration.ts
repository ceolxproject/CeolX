import messaging from '@react-native-firebase/messaging';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { appToast } from '@/components/AppToast';
import { useAuth } from '@/contexts/auth-context';
import { requestNotificationPermission } from '@/lib/fcm-permission';
import { trpc } from '@/utils/trpc';

// ─────────────────────────────────────────────────────────────────────────────
// Wires the device into FCM once a session is active (M7-T1).
//   1. Asks for notification permission (iOS dialog / Android 13+ runtime)
//   2. Fetches the FCM token and posts it to /trpc/deviceTokens.register
//   3. Subscribes to: foreground messages (toast + invalidate inbox),
//      background taps (deep-link), token refresh (re-register), and the
//      cold-start initial notification (deep-link after auth resolves).
//
// Persona switching is intentionally NOT performed on tap — CeolX V1 has a
// fixed `current_role` per account (CLAUDE.md, MoM 03/04/2026 §2.1). The
// payload still carries `persona` for future analytics.
// ─────────────────────────────────────────────────────────────────────────────

const FCM_DATA_ROUTE_KEY = 'route';

function navigateFromRemoteData(data: Record<string, string | object> | undefined) {
  const route = data?.[FCM_DATA_ROUTE_KEY];
  if (typeof route === 'string' && route.startsWith('/')) {
    // expo-router accepts any string path; routes are typed at render time.
    router.push(route);
  }
}

export function useFcmRegistration() {
  const { user, isAuthenticated, isGuest } = useAuth();
  const queryClient = useQueryClient();
  const registerMutation = useMutation(trpc.deviceTokens.register.mutationOptions());

  // mutate / mutateAsync are referentially stable across renders; useMutation
  // returns a new wrapper object each render, so we hold the methods in refs
  // to keep the effect's deps narrow.
  const registerAsyncRef = useRef(registerMutation.mutateAsync);
  registerAsyncRef.current = registerMutation.mutateAsync;
  const registerSyncRef = useRef(registerMutation.mutate);
  registerSyncRef.current = registerMutation.mutate;

  useEffect(() => {
    if (!isAuthenticated || isGuest || !user) return;

    let cancelled = false;
    const platform = Platform.OS as 'ios' | 'android';

    // Foreground push: surface a toast and refetch the inbox + badge so the
    // bell updates instantly. FCM does NOT auto-display when app is in fg.
    const unsubscribeOnMessage = messaging().onMessage(async (remoteMessage) => {
      const title = remoteMessage.notification?.title ?? 'New notification';
      const body = remoteMessage.notification?.body ?? '';
      appToast.info(title, body);
      await queryClient.invalidateQueries({ queryKey: [['notifications', 'list']] });
      await queryClient.invalidateQueries({ queryKey: [['notifications', 'unreadCount']] });
    });

    // Background tap: deep-link to the route.
    const unsubscribeOnOpenedApp = messaging().onNotificationOpenedApp((remoteMessage) => {
      navigateFromRemoteData(remoteMessage?.data);
    });

    // Firebase rotates tokens occasionally — re-register so the new one
    // replaces the stale row (upsert on user_id + fcm_token).
    const unsubscribeOnTokenRefresh = messaging().onTokenRefresh((newToken) => {
      registerSyncRef.current({ token: newToken, platform });
    });

    void (async () => {
      try {
        const granted = await requestNotificationPermission();
        if (!granted || cancelled) return;

        const token = await messaging().getToken();
        if (cancelled || !token) return;

        await registerAsyncRef.current({ token, platform });

        // Cold start: route the user where the tapped notification points.
        const initial = await messaging().getInitialNotification();
        if (initial?.data) navigateFromRemoteData(initial.data);
      } catch (error) {
        // Don't toast here — failure is non-blocking; the user just won't
        // get push until the next launch.
        console.warn('[FCM] init failed:', error);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribeOnMessage();
      unsubscribeOnOpenedApp();
      unsubscribeOnTokenRefresh();
    };
  }, [isAuthenticated, isGuest, user?.id, queryClient]);
}
