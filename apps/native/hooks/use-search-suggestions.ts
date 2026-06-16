import { useQuery } from '@tanstack/react-query';

import { useDebouncedValue } from './use-debounced-value';

import { trpc } from '@/utils/trpc';

const EMPTY: { label: string; sublabel?: string }[] = [];

/**
 * Drives the Discover search autocomplete dropdown.
 *
 * Debounces the raw search text, then fetches grouped name suggestions
 * (`discovery.suggest`). `scope` follows the active tab — `events` returns
 * artist/venue/event hints, `posts` returns artist/venue only. The query stays
 * disabled until the box is focused and at least one character is typed, so it
 * never fires while the dropdown is hidden.
 */
export function useSearchSuggestions(query: string, scope: 'events' | 'posts', enabled: boolean) {
  const debouncedQuery = useDebouncedValue(query, 250);
  const active = enabled && debouncedQuery.length >= 1;

  const { data, isLoading } = useQuery({
    ...trpc.discovery.suggest.queryOptions({ q: debouncedQuery, scope }),
    enabled: active,
  });

  const artists = data?.artists ?? EMPTY;
  const venues = data?.venues ?? EMPTY;
  const events = data?.events ?? EMPTY;

  return {
    artists,
    venues,
    events,
    isLoading: isLoading && active,
    isEmpty: artists.length === 0 && venues.length === 0 && events.length === 0,
  };
}
