import { describe, expect, it, vi } from 'vitest';

// Mock the hook's runtime dependencies so importing the module in a plain
// Node env doesn't pull in React Native / tRPC. We only exercise the pure
// pagination helper, which touches none of these.
vi.mock('react', () => ({
  useCallback: (fn: unknown) => fn,
}));
vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: vi.fn(),
}));
vi.mock('@/utils/trpc', () => ({
  trpcClient: { bookings: { list: { query: vi.fn() } } },
}));

import { getNextBookingsOffset } from '../use-bookings';

const page = (count: number, total: number) => ({
  bookings: Array.from({ length: count }, (_, i) => ({ id: String(i) })),
  total,
});

describe('getNextBookingsOffset', () => {
  it('returns the loaded count as the next offset when more bookings remain', () => {
    // 20 of 50 loaded → next page starts at offset 20
    expect(getNextBookingsOffset(page(20, 50), [page(20, 50)])).toBe(20);
  });

  it('accumulates the loaded count across all fetched pages', () => {
    // 20 + 20 = 40 of 50 loaded → next page starts at offset 40
    const secondPage = page(20, 50);
    expect(getNextBookingsOffset(secondPage, [page(20, 50), secondPage])).toBe(40);
  });

  it('returns undefined when every booking is loaded', () => {
    // 20 + 10 = 30 of 30 → no more pages
    expect(getNextBookingsOffset(page(10, 30), [page(20, 30), page(10, 30)])).toBeUndefined();
  });

  it('returns undefined when the last page came back empty', () => {
    expect(getNextBookingsOffset(page(0, 20), [page(20, 20), page(0, 20)])).toBeUndefined();
  });
});
