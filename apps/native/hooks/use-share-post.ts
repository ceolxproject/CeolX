import { useCallback } from 'react';
import { Alert, Share } from 'react-native';

const SHARE_BASE_URL = 'https://ceolx.ie';

/**
 * Opens the native Share sheet for a post.
 *
 * The URL points to ceolx.ie — on devices with the app installed, iOS
 * Universal Links / Android App Links route the tap back into the app at
 * `/post/<id>`. On devices without the app, the web redirect at ceolx.ie
 * handles fallback to the App Store / Play Store.
 *
 * The web redirect page lives in apps/admin (pending — see PR notes).
 */
export function useSharePost() {
  return useCallback(async (postId: string, caption: string) => {
    const url = `${SHARE_BASE_URL}/post/${postId}`;
    try {
      await Share.share({
        url,
        message: `${caption}\n\n${url}`,
        title: 'Check out this post on CeolX',
      });
    } catch {
      Alert.alert('Unable to share', 'Please try again.');
    }
  }, []);
}
