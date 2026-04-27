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
        Alert.alert('Archived', 'Your event has been archived.');
        opts?.onSuccess?.();
      },
    })
  );
}
