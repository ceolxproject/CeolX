import { useMutation, useQueryClient } from '@tanstack/react-query';

import { appToast } from '@/components/AppToast';
import { trpc } from '@/utils/trpc';

type UseArchiveEventOpts = {
  onSuccess?: () => void;
};

export function useArchiveEvent(opts?: UseArchiveEventOpts) {
  const queryClient = useQueryClient();

  return useMutation(
    trpc.events.archive.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [['events', 'byId']] });
        // The event's promo post is hidden server-side on archive — drop it from
        // the cached posts feeds too so it doesn't linger as a dead card.
        void queryClient.invalidateQueries({ queryKey: [['posts']] });
        appToast.success('Deleted', 'Your event has been deleted.');
        opts?.onSuccess?.();
      },
      // Without this, a rejected delete (e.g. the event is no longer active) was
      // a silent no-op — the user tapped Delete and nothing happened.
      onError: (error) => {
        appToast.error(
          'Could not delete event',
          error.message || 'Something went wrong. Please try again.'
        );
      },
    })
  );
}
