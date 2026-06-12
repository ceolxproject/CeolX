import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { excludeDeletedPosts, markPostDeleted } from '../use-deleted-posts';

const DELETED_POST_IDS_KEY = ['deletedPostIds'] as const;

type Row = { id: string; caption: string };

describe('excludeDeletedPosts', () => {
  it('drops rows whose id has been tombstoned', () => {
    // The regression: a creator deleted post p2, but the accumulated list still
    // holds it. Filtering against the tombstone set removes it from every
    // mounted surface (feed + profile) at once, regardless of scroll offset.
    const rows: Row[] = [
      { id: 'p1', caption: 'one' },
      { id: 'p2', caption: 'two' },
      { id: 'p3', caption: 'three' },
    ];

    const next = excludeDeletedPosts(rows, new Set(['p2']));

    expect(next.map((r) => r.id)).toEqual(['p1', 'p3']);
  });

  it('returns the same array reference when nothing is tombstoned', () => {
    // No deletions → no new array, so React Query consumers don't re-render or
    // re-run the list needlessly.
    const rows: Row[] = [{ id: 'p1', caption: 'one' }];

    expect(excludeDeletedPosts(rows, new Set())).toBe(rows);
  });

  it('removes every matching row when several are tombstoned', () => {
    const rows: Row[] = [
      { id: 'p1', caption: 'one' },
      { id: 'p2', caption: 'two' },
      { id: 'p3', caption: 'three' },
    ];

    const next = excludeDeletedPosts(rows, new Set(['p1', 'p3']));

    expect(next.map((r) => r.id)).toEqual(['p2']);
  });
});

describe('markPostDeleted', () => {
  it('writes a fresh Set reference on every call so React Query re-renders observers', () => {
    // The load-bearing decision: mutating the cached Set in place would keep the
    // same reference, React Query would skip the re-render, and the deleted post
    // would linger on screen — the very bug this fixes. Each call must replace it.
    const queryClient = new QueryClient();

    markPostDeleted(queryClient, 'p1');
    const first = queryClient.getQueryData<Set<string>>(DELETED_POST_IDS_KEY);

    markPostDeleted(queryClient, 'p2');
    const second = queryClient.getQueryData<Set<string>>(DELETED_POST_IDS_KEY);

    expect(second).not.toBe(first);
    expect(second && [...second]).toEqual(['p1', 'p2']);
  });
});
