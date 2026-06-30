import { useMutation } from '@tanstack/react-query';

import { appToast } from '@/components/AppToast';
import { trpc } from '@/utils/trpc';

/**
 * "Share Interest" — an artist or venue signals collaboration interest in the
 * profile they're viewing. The recipient gets a notification routed back to the
 * sender's profile. Feedback (success + cooldown) is handled here so the profile
 * screens just call `shareInterest(recipientUserId)`.
 */
export function useShareInterest() {
  const mutationOptions = trpc.collaboration.shareInterest.mutationOptions();

  const mutation = useMutation({
    ...mutationOptions,
    onSuccess: () => {
      appToast.success(
        'Interest shared',
        "They'll be notified that you're interested in collaborating."
      );
    },
    onError: (error) => {
      if (error.data?.code === 'TOO_MANY_REQUESTS') {
        appToast.info('Already sent', "You've shared interest recently — try again later.");
        return;
      }
      appToast.error('Something went wrong', 'Could not share interest. Please try again.');
    },
  });

  return {
    shareInterest: (recipientUserId: string) => mutation.mutate({ recipientUserId }),
    isSharing: mutation.isPending,
  };
}
