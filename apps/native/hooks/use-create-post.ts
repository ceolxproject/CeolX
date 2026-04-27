import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { CreatePostInput } from '@CeolX/shared/validators';

import { trpc } from '@/utils/trpc';

export function useCreatePost() {
  const queryClient = useQueryClient();
  const mutationOptions = trpc.posts.create.mutationOptions();

  return useMutation({
    ...mutationOptions,
    onSuccess: async () => {
      // Invalidate any cached posts queries: my posts, user posts, feed.
      await queryClient.invalidateQueries({ queryKey: [['posts']] });
    },
  });
}

export type { CreatePostInput };
