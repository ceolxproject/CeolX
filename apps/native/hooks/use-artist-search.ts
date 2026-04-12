import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { MAP_DEBOUNCE_MS } from '@CeolX/shared';

import { trpc } from '@/utils/trpc';

export function useArtistSearch() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      setDebouncedQuery('');
      return;
    }
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, MAP_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

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
