import { useCallback, useEffect, useRef, useState } from 'react';

import { COUNTY_CENTERS, IRISH_COUNTIES } from '@CeolX/shared';

const SEARCH_DEBOUNCE_MS = 150;
const MAX_RESULTS = 5;

export type CountyResult = {
  name: string;
  centre: { lat: number; lng: number };
};

export function filterCounties(query: string): CountyResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const lower = trimmed.toLowerCase();
  const matches: CountyResult[] = [];

  for (const county of IRISH_COUNTIES) {
    if (county.toLowerCase().includes(lower)) {
      const centre = COUNTY_CENTERS[county];
      if (centre) matches.push({ name: county, centre });
    }
    if (matches.length >= MAX_RESULTS) break;
  }

  return matches;
}

export function useCountySearch() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CountyResult[]>([]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const onChangeText = useCallback((text: string) => {
    setQuery(text);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!text.trim()) {
      setSuggestions([]);
      setIsDropdownVisible(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      const results = filterCounties(text);
      setSuggestions(results);
      setIsDropdownVisible(results.length > 0);
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const dismissDropdown = useCallback(() => {
    setIsDropdownVisible(false);
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setSuggestions([]);
    setIsDropdownVisible(false);
  }, []);

  return {
    query,
    suggestions,
    isDropdownVisible,
    onChangeText,
    dismissDropdown,
    clearSearch,
  };
}
