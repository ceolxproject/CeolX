import { useMutation, useQueryClient } from '@tanstack/react-query';

import { trpc } from '@/utils/trpc';

export function useDeletePost() {
  const queryClient = useQueryClient();
  const mutationOptions = trpc.posts.delete.mutationOptions();

  return useMutation({
    ...mutationOptions,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [['posts']] });
    },
  });
}
