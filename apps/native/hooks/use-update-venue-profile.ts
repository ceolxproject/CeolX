import { useMutation, useQueryClient } from '@tanstack/react-query';

import { trpc } from '@/utils/trpc';

export function useUpdateVenueProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.venues.updateMe.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: trpc.users.me.queryKey() });
    },
  });
}
