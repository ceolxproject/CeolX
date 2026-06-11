import { useCallback, useEffect, useRef, useState } from 'react';

import { type GeocodeResult, geocodeAddress } from '@/utils/geocode';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Debounced free-text place search via the CeolX server's Google-geocoding proxy
 * (`geocodeAddress`). Returns town/city/venue matches with coordinates.
 *
 * Mirrors `useCountySearch`'s surface (`query`/`suggestions`/`isDropdownVisible`/
 * `onChangeText`/`dismissDropdown`/`commitSelection`/`clearSearch`) and adds
 * `isSearching`/`hasError`. A monotonically-increasing request id guards against
 * a slow earlier response overwriting a newer one.
 */
export function usePlaceSearch() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasError, setHasError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const runSearch = useCallback((text: string) => {
    const requestId = ++requestIdRef.current;
    setIsSearching(true);
    setHasError(false);
    geocodeAddress(text)
      .then((results) => {
        if (requestId !== requestIdRef.current) return; // stale — a newer search started
        setSuggestions(results);
        setIsDropdownVisible(true);
        setIsSearching(false);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setSuggestions([]);
        setHasError(true);
        setIsDropdownVisible(true);
        setIsSearching(false);
      });
  }, []);

  const onChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      if (timerRef.current) clearTimeout(timerRef.current);

      if (!text.trim()) {
        requestIdRef.current++; // cancel any in-flight result
        setSuggestions([]);
        setIsDropdownVisible(false);
        setIsSearching(false);
        setHasError(false);
        return;
      }

      timerRef.current = setTimeout(() => runSearch(text.trim()), SEARCH_DEBOUNCE_MS);
    },
    [runSearch]
  );

  const dismissDropdown = useCallback(() => setIsDropdownVisible(false), []);

  const clearSearch = useCallback(() => {
    requestIdRef.current++;
    if (timerRef.current) clearTimeout(timerRef.current);
    setQuery('');
    setSuggestions([]);
    setIsDropdownVisible(false);
    setIsSearching(false);
    setHasError(false);
  }, []);

  // Keep the chosen place's text in the field, close the dropdown, and cancel any
  // pending debounce / in-flight request so a late result can't reopen it.
  const commitSelection = useCallback((label: string) => {
    requestIdRef.current++;
    if (timerRef.current) clearTimeout(timerRef.current);
    setQuery(label);
    setSuggestions([]);
    setIsDropdownVisible(false);
    setIsSearching(false);
  }, []);

  return {
    query,
    suggestions,
    isDropdownVisible,
    isSearching,
    hasError,
    onChangeText,
    dismissDropdown,
    clearSearch,
    commitSelection,
  };
}
