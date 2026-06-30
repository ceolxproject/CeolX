import { useMutation, useQueryClient } from '@tanstack/react-query';

import { trpc } from '@/utils/trpc';

/**
 * Updates the current user's account-level name/avatar (the spectator
 * "Update Profile" screen). Invalidates `users.me` on success so the profile
 * tab re-renders with the new name/image. Mirrors use-update-artist-profile.
 */
export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.users.updateMe.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: trpc.users.me.queryKey() });
    },
  });
}
