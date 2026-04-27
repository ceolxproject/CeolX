import { useMutation, useQueryClient } from '@tanstack/react-query';

import { trpc } from '@/utils/trpc';

export function useUpdateArtistProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.artists.updateMe.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: trpc.users.me.queryKey() });
    },
  });
}
