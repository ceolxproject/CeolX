import { useCallback } from 'react';
import { Share } from 'react-native';

import { appToast } from '@/components/AppToast';
import { buildShareContent, shareUrlFor } from '@/utils/share';

/**
 * Opens the native Share sheet for a profile handle (ceolx.com/u/<username>).
 * Shared by the owner's ShareProfileButton and the artist/venue detail screens
 * (sharing someone else's profile). The caller is responsible for only invoking
 * this when a handle exists.
 */
export function useShareProfile() {
  return useCallback(async (username: string, displayName: string) => {
    const url = shareUrlFor(`/u/${username}`);
    try {
      await Share.share(
        buildShareContent(
          url,
          `Check out ${displayName} on CeolX`,
          'Check out this profile on CeolX'
        )
      );
    } catch {
      appToast.error('Unable to share', 'Please try again.');
    }
  }, []);
}
