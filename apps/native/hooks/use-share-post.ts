import { useCallback } from 'react';

import { appToast } from '@/components/AppToast';
import { shareLink, shareUrlFor } from '@/utils/share';

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
    const url = shareUrlFor(`/post/${postId}`);
    try {
      await shareLink('post', postId, url, caption, 'Check out this post on CeolX');
    } catch {
      appToast.error('Unable to share', 'Please try again.');
    }
  }, []);
}
