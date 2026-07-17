import { useCallback } from 'react';
import { Share } from 'react-native';

import { env } from '@CeolX/env/native';

import { appToast } from '@/components/AppToast';

// Must stay in sync with app.config.js associatedDomains/intentFilters host and
// the server /u/:username route. Mirrors use-share-event / use-share-post.
const SHARE_BASE_URL = env.EXPO_PUBLIC_SHARE_BASE_URL ?? 'https://ceolx.com';

/**
 * Opens the native Share sheet for a profile handle (ceolx.com/u/<username>).
 * Shared by the owner's ShareProfileButton and the artist/venue detail screens
 * (sharing someone else's profile). The caller is responsible for only invoking
 * this when a handle exists.
 */
export function useShareProfile() {
  return useCallback(async (username: string, displayName: string) => {
    const url = `${SHARE_BASE_URL}/u/${username}`;
    try {
      await Share.share({
        url,
        message: `Check out ${displayName} on CeolX\n${url}`,
        title: 'Check out this profile on CeolX',
      });
    } catch {
      appToast.error('Unable to share', 'Please try again.');
    }
  }, []);
}
