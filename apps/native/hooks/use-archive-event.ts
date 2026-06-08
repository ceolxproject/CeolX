import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

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
        Alert.alert('Deleted', 'Your event has been deleted.');
        opts?.onSuccess?.();
      },
      // Without this, a rejected delete (e.g. the event is no longer active) was
      // a silent no-op — the user tapped Delete and nothing happened.
      onError: (error) => {
        Alert.alert(
          'Could not delete event',
          error.message || 'Something went wrong. Please try again.'
        );
      },
    })
  );
}
