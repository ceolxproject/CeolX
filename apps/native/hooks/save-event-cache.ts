import type { QueryClient, QueryKey } from '@tanstack/react-query';

import type { FeedResponse } from '@CeolX/shared';

import type { RouterOutputs } from '@/utils/trpc';

type EventById = RouterOutputs['events']['byId'];

// Partial tRPC query-key prefixes — match every cached page/instance of each
// procedure regardless of its input. Kept here (not inline) so the mutation and
// its tests reference the exact same keys.
const FEED_KEY = [['events', 'getFeed']];
const BY_ID_KEY = [['events', 'byId']];
const SAVED_EVENTS_KEY = [['events', 'getSavedEvents']];

/** Pre-mutation cache snapshots, returned by the optimistic update for rollback. */
export type SaveOptimisticSnapshot = {
  feed: [QueryKey, FeedResponse | undefined][];
  byId: [QueryKey, EventById | undefined][];
};

/**
 * Optimistically reflect a save/unsave across EVERY cache that renders the saved
 * state: the feed list and the event-detail (`byId`) entry.
 *
 * The detail header derives its bookmark from `byId.isSaved`, so a mutation that
 * only patched the feed left the detail screen showing a stale empty bookmark —
 * and because the screen's toggle reads that stale value, the next tap flipped
 * from the wrong baseline and needed an extra press to converge (Asana
 * 1216024548331967). Patching `byId` here keeps the one source of truth correct.
 *
 * Returns snapshots of both caches so a failed mutation can roll back exactly.
 */
export function applySaveOptimisticUpdate(
  queryClient: QueryClient,
  eventId: string,
  saved: boolean
): SaveOptimisticSnapshot {
  const snapshot: SaveOptimisticSnapshot = {
    feed: queryClient.getQueriesData<FeedResponse>({ queryKey: FEED_KEY }),
    byId: queryClient.getQueriesData<EventById>({ queryKey: BY_ID_KEY }),
  };

  queryClient.setQueriesData<FeedResponse>({ queryKey: FEED_KEY }, (old) => {
    if (!old) return old;
    return {
      ...old,
      events: old.events.map((event) =>
        event.id === eventId
          ? { ...event, isSaved: saved, joinedCount: event.joinedCount + (saved ? 1 : -1) }
          : event
      ),
    };
  });

  queryClient.setQueriesData<EventById>({ queryKey: BY_ID_KEY }, (old) => {
    if (!old || old.id !== eventId) return old;
    // `attendeeCount` is the server's "total saves == attending" proxy
    // (crud.ts), so it moves in lockstep with the bookmark.
    return { ...old, isSaved: saved, attendeeCount: old.attendeeCount + (saved ? 1 : -1) };
  });

  return snapshot;
}

/** Restore both caches to their pre-mutation state after a failed save/unsave. */
export function rollbackSaveOptimisticUpdate(
  queryClient: QueryClient,
  snapshot: SaveOptimisticSnapshot
): void {
  for (const [key, data] of snapshot.feed) queryClient.setQueryData(key, data);
  for (const [key, data] of snapshot.byId) queryClient.setQueryData(key, data);
}

/**
 * Invalidate every cache whose contents depend on saved state, so the optimistic
 * values are reconciled against the server. Includes `byId` — the detail entry
 * the feed-only invalidation used to miss.
 */
export function invalidateSaveQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: FEED_KEY });
  void queryClient.invalidateQueries({ queryKey: SAVED_EVENTS_KEY });
  void queryClient.invalidateQueries({ queryKey: BY_ID_KEY });
}
