import { describe, expect, it } from 'vitest';

import { mergePaginatedEvents } from '../merge-paginated-events';

type Row = { id: string; coverImage: string | null };

describe('mergePaginatedEvents', () => {
  it('reflects an in-place edit on the first page even when the list shape is unchanged', () => {
    // The regression: same row id + order, only the cover image changed. The
    // old length/first-id guard skipped this, leaving a stale image until the
    // app restarted.
    const prev: Row[] = [
      { id: 'e1', coverImage: 'https://cdn/events/u1/old.jpg' },
      { id: 'e2', coverImage: null },
    ];
    const incoming: Row[] = [
      { id: 'e1', coverImage: 'https://cdn/events/u1/new.jpg' },
      { id: 'e2', coverImage: null },
    ];

    const next = mergePaginatedEvents({ offset: 0, prev, incoming });

    expect(next).toEqual(incoming);
    expect(next?.[0]?.coverImage).toBe('https://cdn/events/u1/new.jpg');
  });

  it('seeds the first page from an empty list', () => {
    const incoming: Row[] = [{ id: 'e1', coverImage: null }];
    expect(mergePaginatedEvents({ offset: 0, prev: [], incoming })).toEqual(incoming);
  });

  it('appends the next page when paginating', () => {
    const prev: Row[] = Array.from({ length: 20 }, (_, i) => ({ id: `e${i}`, coverImage: null }));
    const incoming: Row[] = [
      { id: 'e20', coverImage: null },
      { id: 'e21', coverImage: null },
    ];

    const next = mergePaginatedEvents({ offset: 20, prev, incoming });

    expect(next).toHaveLength(22);
    expect(next?.[21]?.id).toBe('e21');
  });

  it('returns null (no change) when a page has already been appended', () => {
    const prev: Row[] = Array.from({ length: 40 }, (_, i) => ({ id: `e${i}`, coverImage: null }));
    const incoming: Row[] = Array.from({ length: 20 }, (_, i) => ({
      id: `e${i + 20}`,
      coverImage: null,
    }));

    expect(mergePaginatedEvents({ offset: 20, prev, incoming })).toBeNull();
  });
});
