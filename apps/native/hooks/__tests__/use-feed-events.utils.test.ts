import { describe, expect, it, vi } from 'vitest';

// Mock React and the hook's dependencies so a pure exported function can be tested
// without a React Native / tRPC environment — same approach as use-map-events.test.
// Importing the real @/lib/analytics pulls in posthog-react-native, @sentry/react-native
// and @CeolX/env/native, none of which resolve under vitest.
vi.mock('react', () => ({
  useCallback: (fn: unknown) => fn,
  useEffect: vi.fn(),
  useLayoutEffect: vi.fn(),
  useRef: () => ({ current: null }),
  useState: (initial: unknown) => [initial, vi.fn()],
}));
vi.mock('@tanstack/react-query', () => ({
  keepPreviousData: Symbol('keepPreviousData'),
  useQuery: vi.fn(),
  useQueryClient: vi.fn(),
}));
vi.mock('@/utils/trpc', () => ({
  trpc: { events: { getFeed: { queryOptions: vi.fn(() => ({})) } } },
}));
vi.mock('@/lib/analytics', () => ({
  AnalyticsEvent: { SEARCH_PERFORMED: 'search_performed' },
  track: vi.fn(),
}));
vi.mock('@CeolX/shared', () => ({ MAP_DEBOUNCE_MS: 400 }));

const { shouldReportSearch } = await import('../use-feed-events');

// A settled first-page search that has not been reported yet — the one case that
// should emit. Each test below changes exactly one field away from this.
const settled = {
  settledQuery: 'trad session',
  isFetching: false,
  hasData: true,
  offset: 0,
  searchKey: 'trad session||',
  lastReported: null,
};

describe('shouldReportSearch', () => {
  it('reports a settled first-page search', () => {
    expect(shouldReportSearch(settled)).toBe(true);
  });

  it('does not report while the query is still fetching', () => {
    expect(shouldReportSearch({ ...settled, isFetching: true })).toBe(false);
  });

  it('does not report an empty term', () => {
    expect(shouldReportSearch({ ...settled, settledQuery: '' })).toBe(false);
  });

  it('does not report before any data has arrived', () => {
    expect(shouldReportSearch({ ...settled, hasData: false })).toBe(false);
  });

  // The regression this guard exists for: `offset` is part of the feed query key,
  // so each scrolled page arrives as a fresh result with the term unchanged.
  it('does not report a paginated page of the same search', () => {
    expect(shouldReportSearch({ ...settled, offset: 20 })).toBe(false);
    expect(shouldReportSearch({ ...settled, offset: 40 })).toBe(false);
  });

  // Second guard: a refetch at offset 0 (pull-to-refresh) must not re-report.
  it('does not report the same search twice', () => {
    expect(shouldReportSearch({ ...settled, lastReported: settled.searchKey })).toBe(false);
  });

  it('reports again when a filter changes the search', () => {
    expect(
      shouldReportSearch({
        ...settled,
        searchKey: 'trad session|Open Trad Sessions|',
        lastReported: 'trad session||',
      })
    ).toBe(true);
  });

  it('reports a different term after one was already reported', () => {
    expect(shouldReportSearch({ ...settled, settledQuery: 'fiddle', searchKey: 'fiddle||' })).toBe(
      true
    );
  });
});
