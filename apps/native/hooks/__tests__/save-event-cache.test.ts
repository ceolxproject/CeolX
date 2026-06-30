import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import {
  applySaveOptimisticUpdate,
  invalidateSaveQueries,
  rollbackSaveOptimisticUpdate,
} from '../save-event-cache';

// Mirrors the real tRPC tanstack-query cache keys so partial-key matching in the
// helpers is exercised exactly as it runs in the app.
const byIdKey = (id: string) => [['events', 'byId'], { input: { id }, type: 'query' }];
const feedKey = [['events', 'getFeed'], { input: {}, type: 'query' }];

describe('applySaveOptimisticUpdate — event detail (byId) cache', () => {
  // This is the regression: the detail header reads `byId.isSaved`, so a save
  // that never patched the byId cache left the bookmark empty and made the next
  // tap toggle from the wrong baseline (the extra-tap bug).
  it('fills the bookmark and bumps attendeeCount when saving', () => {
    const qc = new QueryClient();
    qc.setQueryData(byIdKey('e1'), { id: 'e1', isSaved: false, attendeeCount: 3 });

    applySaveOptimisticUpdate(qc, 'e1', true);

    expect(qc.getQueryData(byIdKey('e1'))).toMatchObject({ isSaved: true, attendeeCount: 4 });
  });

  it('clears the bookmark and decrements attendeeCount when unsaving', () => {
    const qc = new QueryClient();
    qc.setQueryData(byIdKey('e1'), { id: 'e1', isSaved: true, attendeeCount: 4 });

    applySaveOptimisticUpdate(qc, 'e1', false);

    expect(qc.getQueryData(byIdKey('e1'))).toMatchObject({ isSaved: false, attendeeCount: 3 });
  });

  it('leaves a different event untouched', () => {
    const qc = new QueryClient();
    qc.setQueryData(byIdKey('e1'), { id: 'e1', isSaved: false, attendeeCount: 3 });
    qc.setQueryData(byIdKey('e2'), { id: 'e2', isSaved: false, attendeeCount: 7 });

    applySaveOptimisticUpdate(qc, 'e1', true);

    expect(qc.getQueryData(byIdKey('e2'))).toMatchObject({ isSaved: false, attendeeCount: 7 });
  });

  it('rolls back to the pre-save snapshot when the mutation fails', () => {
    const qc = new QueryClient();
    qc.setQueryData(byIdKey('e1'), { id: 'e1', isSaved: false, attendeeCount: 3 });

    const snapshot = applySaveOptimisticUpdate(qc, 'e1', true);
    rollbackSaveOptimisticUpdate(qc, snapshot);

    expect(qc.getQueryData(byIdKey('e1'))).toMatchObject({ isSaved: false, attendeeCount: 3 });
  });
});

describe('applySaveOptimisticUpdate — feed cache', () => {
  it('patches isSaved and joinedCount for the matching feed event only', () => {
    const qc = new QueryClient();
    qc.setQueryData(feedKey, {
      events: [
        { id: 'e1', isSaved: false, joinedCount: 2 },
        { id: 'e2', isSaved: false, joinedCount: 5 },
      ],
    });

    applySaveOptimisticUpdate(qc, 'e1', true);

    const feed = qc.getQueryData(feedKey) as {
      events: { isSaved: boolean; joinedCount: number }[];
    };
    expect(feed.events[0]).toMatchObject({ isSaved: true, joinedCount: 3 });
    expect(feed.events[1]).toMatchObject({ isSaved: false, joinedCount: 5 });
  });

  it('rolls back the feed cache on failure', () => {
    const qc = new QueryClient();
    qc.setQueryData(feedKey, { events: [{ id: 'e1', isSaved: false, joinedCount: 2 }] });

    const snapshot = applySaveOptimisticUpdate(qc, 'e1', true);
    rollbackSaveOptimisticUpdate(qc, snapshot);

    const feed = qc.getQueryData(feedKey) as {
      events: { isSaved: boolean; joinedCount: number }[];
    };
    expect(feed.events[0]).toMatchObject({ isSaved: false, joinedCount: 2 });
  });
});

describe('invalidateSaveQueries', () => {
  it('marks feed, saved-events and byId caches stale so every surface refetches', () => {
    const qc = new QueryClient();
    qc.setQueryData(byIdKey('e1'), { id: 'e1', isSaved: true, attendeeCount: 4 });
    qc.setQueryData(feedKey, { events: [] });
    qc.setQueryData([['events', 'getSavedEvents'], { input: {}, type: 'query' }], {
      events: [],
    });

    invalidateSaveQueries(qc);

    expect(qc.getQueryState(byIdKey('e1'))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(feedKey)?.isInvalidated).toBe(true);
    expect(
      qc.getQueryState([['events', 'getSavedEvents'], { input: {}, type: 'query' }])?.isInvalidated
    ).toBe(true);
  });
});
