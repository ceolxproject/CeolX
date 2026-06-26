import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { FeedLocation } from '@/utils/feed-location';

/**
 * How the current override was chosen:
 * - `saved`  — the user's persisted base location (set on the "Add your Location"
 *   screen). Reads as the default/current location, not a temporary search.
 * - `search` — a one-off place pick on the Map or in the Feed's location sheet.
 *   Shown as a temporary search with a reset-to-default affordance.
 */
export type OverrideKind = 'saved' | 'search';

type LocationOverrideContextType = {
  /**
   * The user's manually chosen location, shared between the Map and Feed tabs.
   * `null` means no manual choice — both screens fall back to the GPS/IP chain.
   */
  override: FeedLocation | null;
  /** Origin of the current override (`null` when there is no override). */
  overrideKind: OverrideKind | null;
  setOverride: (loc: FeedLocation, kind: OverrideKind) => void;
  /** Drop the override → both screens return to the GPS/saved/IP chain. */
  clearOverride: () => void;
};

const LocationOverrideContext = createContext<LocationOverrideContextType | undefined>(undefined);

/**
 * Holds the user's manually selected location so the Map and Feed stay in sync:
 * a place-search pick on the Map, or a confirm in the Feed's location sheet, sets
 * it; the other screen reads it. Deliberately in-memory (session-scoped) — a cold
 * start clears it and returns to the GPS/IP fallback, matching the map's
 * "ask for permission once per session" model. Knows nothing about maps, feeds,
 * or GPS; it is just the shared source of the chosen location.
 *
 * Mounted in (app)/_layout so the map, discover, and the add-location modal
 * (a sibling of the tabs in the (app) Stack) all reach it.
 */
export const LocationOverrideProvider = ({ children }: { children: React.ReactNode }) => {
  // Both fields move together (a pick sets both; a clear nulls both), so they
  // live in one state object to keep updates atomic.
  const [state, setState] = useState<{ override: FeedLocation | null; kind: OverrideKind | null }>({
    override: null,
    kind: null,
  });

  const setOverride = useCallback((loc: FeedLocation, kind: OverrideKind) => {
    setState({ override: loc, kind });
  }, []);

  const clearOverride = useCallback(() => {
    setState({ override: null, kind: null });
  }, []);

  const value = useMemo(
    () => ({ override: state.override, overrideKind: state.kind, setOverride, clearOverride }),
    [state, setOverride, clearOverride]
  );

  return (
    <LocationOverrideContext.Provider value={value}>{children}</LocationOverrideContext.Provider>
  );
};

export function useLocationOverride() {
  const context = useContext(LocationOverrideContext);
  if (!context) {
    throw new Error('useLocationOverride must be used within LocationOverrideProvider');
  }
  return context;
}
