import { useCallback } from 'react';
import { Alert, Share } from 'react-native';

import { env } from '@CeolX/env/native';

// Prod marketing domain by default; staging overrides via env to point at the
// staging server's Vercel URL. Must stay in sync with the associatedDomains /
// intentFilters host in app.config.js and the server's /event route.
const SHARE_BASE_URL = env.EXPO_PUBLIC_SHARE_BASE_URL ?? 'https://ceolx.ie';

/**
 * Opens the native Share sheet for an event.
 *
 * The URL points to ceolx.ie — on devices with the app installed, iOS
 * Universal Links / Android App Links route the tap back into the app at
 * `/event/<id>` (apps/native/app/(app)/event/[eventId].tsx), which redirects to
 * the discover event detail screen. On devices without the app,
 * ceolx.ie/event/<id> rewrites to the server's event-share page
 * (apps/server/src/routes/event-share.ts), which unfurls the event and offers
 * App Store / Play Store buttons.
 */
export function useShareEvent() {
  return useCallback(async (eventId: string, title: string, dateLabel: string) => {
    const url = `${SHARE_BASE_URL}/event/${eventId}`;
    try {
      await Share.share({
        url,
        message: `Check out ${title} on CeolX\n${dateLabel}\n${url}`,
        title: 'Check out this event on CeolX',
      });
    } catch {
      Alert.alert('Unable to share', 'Please try again.');
    }
  }, []);
}
