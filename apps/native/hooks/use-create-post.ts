import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { CreatePostInput } from '@CeolX/shared/validators';

import { AnalyticsEvent, track } from '@/lib/analytics';
import { trpc } from '@/utils/trpc';

export function useCreatePost() {
  const queryClient = useQueryClient();
  const mutationOptions = trpc.posts.create.mutationOptions();

  return useMutation({
    ...mutationOptions,
    onSuccess: async (_data, variables) => {
      // media_type carries the enum, not the URL — which kind of post people
      // actually make is the question; the caption never leaves the device.
      track(AnalyticsEvent.POST_CREATED, { media_type: variables.mediaType });
      // Invalidate any cached posts queries: my posts, user posts, feed.
      await queryClient.invalidateQueries({ queryKey: [['posts']] });
    },
  });
}

export type { CreatePostInput };
