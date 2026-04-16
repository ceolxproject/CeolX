import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useDebouncedValue } from './use-debounced-value';

import { trpc } from '@/utils/trpc';

export function useArtistSearch() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);

  const queryOptions = trpc.bookings.searchArtists.queryOptions({ q: debouncedQuery, limit: 10 });

  const { data, isLoading } = useQuery({
    ...queryOptions,
    enabled: debouncedQuery.length >= 1,
  });

  return {
    query,
    setQuery,
    artists: data?.artists ?? [],
    isLoading: isLoading && debouncedQuery.length >= 1,
  };
}
