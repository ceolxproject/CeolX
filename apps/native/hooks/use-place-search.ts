import { useEffect, useRef, useState } from 'react';

import { geocodeAddress, type GeocodeResult } from '@/utils/geocode';

// Longer than the county filter's 150ms — each keystroke-burst here is a billed
// Google Places call, so we wait a touch longer for the user to stop typing.
export const PLACE_SEARCH_DEBOUNCE_MS = 300;

export type PlaceSearchSnapshot = {
  query: string;
  suggestions: GeocodeResult[];
  isSearching: boolean;
  isDropdownVisible: boolean;
  hasError: boolean;
};

const INITIAL_SNAPSHOT: PlaceSearchSnapshot = {
  query: '',
  suggestions: [],
  isSearching: false,
  isDropdownVisible: false,
  hasError: false,
};

type PlaceSearchDeps = {
  geocode: (q: string) => Promise<GeocodeResult[]>;
  onChange: (snapshot: PlaceSearchSnapshot) => void;
  debounceMs?: number;
};

export type PlaceSearchController = {
  getSnapshot: () => PlaceSearchSnapshot;
  setQuery: (text: string) => void;
  commitSelection: (label: string) => void;
  dismissDropdown: () => void;
  clear: () => void;
  destroy: () => void;
};

/**
 * Framework-agnostic controller behind {@link usePlaceSearch}. Holds all the
 * debounce + stale-response logic so it can be unit-tested without a React
 * renderer (the native test env is `node`, no jsdom). The hook is a thin
 * subscriber that mirrors each snapshot into React state.
 *
 * Place search drives map *position* only — it never feeds a Typesense text
 * filter, so a non-matching query can't empty the map.
 */
export function createPlaceSearch({
  geocode,
  onChange,
  debounceMs = PLACE_SEARCH_DEBOUNCE_MS,
}: PlaceSearchDeps): PlaceSearchController {
  let snapshot: PlaceSearchSnapshot = INITIAL_SNAPSHOT;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Monotonic id: every search (and every cancel) bumps it. A resolved geocode
  // whose id is no longer current is stale and must be ignored, so a slow early
  // request can't clobber a newer query's results.
  let requestId = 0;

  function emit(patch: Partial<PlaceSearchSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    onChange(snapshot);
  }

  function cancelPending() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    // Invalidate any in-flight request so its late resolution is dropped.
    requestId += 1;
  }

  function setQuery(text: string) {
    cancelPending();
    emit({ query: text });

    if (!text.trim()) {
      emit({ suggestions: [], isSearching: false, isDropdownVisible: false, hasError: false });
      return;
    }

    timer = setTimeout(() => {
      timer = null;
      const id = requestId;
      emit({ isSearching: true, isDropdownVisible: true, hasError: false });
      void geocode(text.trim())
        .then((results) => {
          if (id !== requestId) return; // superseded by a newer query
          emit({ suggestions: results, isSearching: false, isDropdownVisible: true });
        })
        .catch((err: unknown) => {
          if (id !== requestId) return;
          console.error('[usePlaceSearch] geocode failed:', err);
          // Hide the dropdown and flag the error — the screen surfaces a
          // non-blocking toast. Pins are never cleared on a failed place search.
          emit({ suggestions: [], isSearching: false, isDropdownVisible: false, hasError: true });
        });
    }, debounceMs);
  }

  function commitSelection(label: string) {
    cancelPending();
    emit({
      query: label,
      suggestions: [],
      isSearching: false,
      isDropdownVisible: false,
      hasError: false,
    });
  }

  function dismissDropdown() {
    emit({ isDropdownVisible: false });
  }

  function clear() {
    cancelPending();
    emit({ ...INITIAL_SNAPSHOT });
  }

  return {
    getSnapshot: () => snapshot,
    setQuery,
    commitSelection,
    dismissDropdown,
    clear,
    destroy: cancelPending,
  };
}

/**
 * Live place/venue autocomplete for the map search bar. Typing queries Google
 * Places (via the server geocode proxy); selecting a result flies the map there.
 */
export function usePlaceSearch() {
  const [snapshot, setSnapshot] = useState<PlaceSearchSnapshot>(INITIAL_SNAPSHOT);
  const controllerRef = useRef<PlaceSearchController | null>(null);

  if (controllerRef.current === null) {
    controllerRef.current = createPlaceSearch({ geocode: geocodeAddress, onChange: setSnapshot });
  }

  useEffect(() => {
    const controller = controllerRef.current;
    return () => controller?.destroy();
  }, []);

  const controller = controllerRef.current;

  return {
    query: snapshot.query,
    suggestions: snapshot.suggestions,
    isSearching: snapshot.isSearching,
    isDropdownVisible: snapshot.isDropdownVisible,
    hasError: snapshot.hasError,
    onChangeText: controller.setQuery,
    commitSelection: controller.commitSelection,
    dismissDropdown: controller.dismissDropdown,
    clearSearch: controller.clear,
  };
}
