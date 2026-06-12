import { type QueryClient, useQuery } from '@tanstack/react-query';

/**
 * Shared "tombstone" set of post ids the current session has deleted.
 *
 * Every accumulating post-list hook (feed, my posts, user posts) keeps its rows
 * in local `accumulated` state that React Query's cache can't reach — so a
 * delete that only invalidates the query leaves the row on screen until the app
 * restarts (and, when scrolled past page 0, the append-only merge guard can't
 * express a removal at all). Recording the deleted id here and filtering every
 * list against it removes the post from ALL mounted surfaces at once, at any
 * scroll offset, without a refetch or a scroll reset.
 *
 * The set is stored in the query cache (not React context) so each list hook
 * subscribes to it as an observer: one `markPostDeleted` re-renders them all.
 */
const DELETED_POST_IDS_KEY = ['deletedPostIds'] as const;

/**
 * Drop any row whose id has been tombstoned. Pure and side-effect free so it can
 * be unit-tested without React. Returns the SAME array reference when there are
 * no deletions, so consumers don't re-render needlessly.
 */
export function excludeDeletedPosts<T extends { id: string }>(
  rows: T[],
  deletedIds: ReadonlySet<string>
): T[] {
  if (deletedIds.size === 0) return rows;
  return rows.filter((row) => !deletedIds.has(row.id));
}

/**
 * Read the shared tombstone set. Subscribing via `useQuery` means any list using
 * this hook re-renders the instant `markPostDeleted` writes a new set.
 */
export function useDeletedPostIds(): ReadonlySet<string> {
  const { data } = useQuery<Set<string>>({
    queryKey: DELETED_POST_IDS_KEY,
    queryFn: () => new Set<string>(),
    initialData: () => new Set<string>(),
    staleTime: Infinity,
    gcTime: Infinity,
    // A Set isn't a plain object/array; skip React Query's structural sharing so
    // a freshly-written set is handed to observers as-is (and triggers a render).
    structuralSharing: false,
  });
  return data;
}

/**
 * Tombstone a post id so every mounted post list drops it immediately.
 *
 * Returns a NEW Set rather than mutating `prev` in place: React Query re-renders
 * observers by reference comparison, so `prev.add(id); return prev` would change
 * the cached value without changing its reference — no list would re-render and
 * the deleted post would stay on screen (the exact bug this fixes).
 */
export function markPostDeleted(queryClient: QueryClient, id: string): void {
  queryClient.setQueryData<Set<string>>(DELETED_POST_IDS_KEY, (prev) => {
    const next = new Set(prev ?? []);
    next.add(id);
    return next;
  });
}
