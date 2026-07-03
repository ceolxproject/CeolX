import { useCallback } from 'react';
import { Share } from 'react-native';

import { env } from '@CeolX/env/native';

import { appToast } from '@/components/AppToast';

// Prod marketing domain by default; staging overrides via env to point at the
// staging server's Vercel URL (no custom domain off prod). Must stay in sync
// with the associatedDomains / intentFilters host in app.config.js.
const SHARE_BASE_URL = env.EXPO_PUBLIC_SHARE_BASE_URL ?? 'https://ceolx.com';

/**
 * Opens the native Share sheet for a post.
 *
 * The URL points to ceolx.com — on devices with the app installed, iOS
 * Universal Links / Android App Links route the tap back into the app at
 * `/post/<id>` (ownership verified by apps/server/src/routes/app-links.ts). On
 * devices without the app, ceolx.com/post/<id> rewrites to the server's
 * post-share page (apps/server/src/routes/post-share.ts), which unfurls the
 * post and offers App Store / Play Store buttons.
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
      appToast.error('Unable to share', 'Please try again.');
    }
  }, []);
}
