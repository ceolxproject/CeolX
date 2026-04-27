import { useQuery } from '@tanstack/react-query';

import { trpc } from '@/utils/trpc';

/** Fetch a single post — backs the deep-link detail screen. */
export function usePostById(id: string | null | undefined) {
  const queryOptions = trpc.posts.byId.queryOptions({ id: id ?? '' });
  return useQuery({
    ...queryOptions,
    enabled: !!id,
  });
}
