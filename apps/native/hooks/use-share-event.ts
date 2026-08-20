import { useCallback } from 'react';

import { appToast } from '@/components/AppToast';
import { shareLink, shareUrlFor } from '@/utils/share';

/**
 * Opens the native Share sheet for an event.
 *
 * The URL points to ceolx.com — on devices with the app installed, iOS
 * Universal Links / Android App Links route the tap back into the app at
 * `/event/<id>`, which app/+native-intent rewrites to the discover event detail
 * screen so the tab bar is present and back reaches the feed. On devices
 * without the app,
 * ceolx.com/event/<id> rewrites to the server's event-share page
 * (apps/server/src/routes/event-share.ts), which unfurls the event and offers
 * App Store / Play Store buttons.
 */
export function useShareEvent() {
  return useCallback(async (eventId: string, title: string, dateLabel: string) => {
    const url = shareUrlFor(`/event/${eventId}`);
    try {
      await shareLink(
        'event',
        url,
        `Check out ${title} on CeolX\n${dateLabel}`,
        'Check out this event on CeolX'
      );
    } catch {
      appToast.error('Unable to share', 'Please try again.');
    }
  }, []);
}
