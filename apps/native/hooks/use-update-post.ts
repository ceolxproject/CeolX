import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { UpdatePostInput } from '@CeolX/shared/validators';

import { trpc } from '@/utils/trpc';

export function useUpdatePost() {
  const queryClient = useQueryClient();
  const mutationOptions = trpc.posts.update.mutationOptions();

  return useMutation({
    ...mutationOptions,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [['posts']] });
    },
  });
}

export type { UpdatePostInput };
