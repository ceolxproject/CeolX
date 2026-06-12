import React, { createContext, useContext, useMemo, useState } from 'react';

import type { FeedLocation } from '@/utils/feed-location';

type LocationOverrideContextType = {
  /**
   * The user's manually chosen location, shared between the Map and Feed tabs.
   * `null` means no manual choice — both screens fall back to the GPS/IP chain.
   */
  override: FeedLocation | null;
  setOverride: (loc: FeedLocation) => void;
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
 * Mounted in (tabs)/_layout so both the map and discover screens reach it.
 */
export const LocationOverrideProvider = ({ children }: { children: React.ReactNode }) => {
  const [override, setOverride] = useState<FeedLocation | null>(null);

  const value = useMemo(() => ({ override, setOverride }), [override]);

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
