# M3-T3 · Search Bar (County/Location Search) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement location search for the map screen — user types a county name, sees a filtered list of Irish counties, taps one, and the map animates to that county's centre. Pins reload automatically via the existing viewport query.

**Architecture:** Filter `IRISH_COUNTIES` locally as the user types (no external API). A county-centre coordinate map lives in shared constants. Tapping a result calls `mapRef.animateToRegion()`. The existing Typesense event search already handles text-based pin filtering via `onSearch`. 7 of 10 acceptance criteria are already met by prior M3-T1 work — this plan covers the 3 remaining.

**Tech Stack:** React Native, react-native-maps (`animateToRegion`), existing `IRISH_COUNTIES` + `@CeolX/shared`

**Task file:** `docs/project-management/M3-Map-Discovery/M3-T3-Pin-Clustering-Search-Bar.md`

---

## Already Done (no changes needed)

| #   | Criterion                                        | Evidence                                                          |
| --- | ------------------------------------------------ | ----------------------------------------------------------------- |
| 1   | Pins merge into cluster badge at low zoom        | `map/index.tsx` — `react-native-map-clustering` + `renderCluster` |
| 2   | Tapping cluster zooms in                         | `cluster.onPress` wired                                           |
| 3   | Cluster badge styled (green circle, white count) | `MapEventPin` — `bg-[#C8FF2F]`                                    |
| 4   | Search bar visible with correct placeholder      | `MapSearchBar` — "Search by county / artist / category"           |
| 8   | Category filter sheet opens and filters pins     | `MapFilterSheet` + `useMapEvents`                                 |
| 9   | Filter icon shows active indicator               | `MapSearchBar` — red badge + purple bg                            |
| 10  | Clearing filter restores all pins                | `clearAll` resets filters to `{}`                                 |

---

## Remaining Work (3 criteria)

| #   | Criterion                                        | Plan       |
| --- | ------------------------------------------------ | ---------- |
| 5   | Typing a county name shows suggestions           | Task 1 + 2 |
| 6   | Selecting location re-centres map + reloads pins | Task 2 + 3 |
| 7   | ~~Artist search~~ — **removed from scope**       | —          |

---

## File Structure

| Action | File                                                    | Responsibility                                               |
| ------ | ------------------------------------------------------- | ------------------------------------------------------------ |
| Modify | `packages/shared/src/constants.ts`                      | Add `COUNTY_CENTERS` map (lat/lng per county)                |
| Create | `apps/native/hooks/use-county-search.ts`                | Filter `IRISH_COUNTIES` locally, return matching results     |
| Create | `apps/native/components/CountySuggestionsDropdown.tsx`  | Render filtered county list below search bar                 |
| Create | `apps/native/hooks/__tests__/use-county-search.test.ts` | Unit tests for search/filter logic                           |
| Modify | `apps/native/app/(app)/(tabs)/map/index.tsx`            | Add `mapRef`, wire dropdown, `animateToRegion` on county tap |
| Modify | `apps/native/components/MapSearchBar.tsx`               | Expose `value` prop for controlled input                     |

---

## Task 1: Add County Centre Coordinates to Shared

**Files:**

- Modify: `packages/shared/src/constants.ts`

### Steps

- [ ] **Step 1: Add `COUNTY_CENTERS` to shared constants**

In `packages/shared/src/constants.ts`, append after the existing `CATEGORY_ICONS` block:

```ts
// Geographic centre coordinates for each Irish county (Republic + Northern Ireland)
export const COUNTY_CENTERS: Record<string, { lat: number; lng: number }> = {
  Antrim: { lat: 54.7, lng: -6.2 },
  Armagh: { lat: 54.35, lng: -6.65 },
  Carlow: { lat: 52.72, lng: -6.93 },
  Cavan: { lat: 53.99, lng: -7.36 },
  Clare: { lat: 52.9, lng: -8.98 },
  Cork: { lat: 51.9, lng: -8.47 },
  Derry: { lat: 54.995, lng: -7.31 },
  Donegal: { lat: 54.655, lng: -8.1 },
  Down: { lat: 54.32, lng: -5.93 },
  Dublin: { lat: 53.3498, lng: -6.2603 },
  Fermanagh: { lat: 54.345, lng: -7.63 },
  Galway: { lat: 53.2707, lng: -9.0568 },
  Kerry: { lat: 52.15, lng: -9.57 },
  Kildare: { lat: 53.158, lng: -6.91 },
  Kilkenny: { lat: 52.654, lng: -7.244 },
  Laois: { lat: 52.994, lng: -7.332 },
  Leitrim: { lat: 54.124, lng: -8.0 },
  Limerick: { lat: 52.668, lng: -8.63 },
  Longford: { lat: 53.727, lng: -7.793 },
  Louth: { lat: 53.925, lng: -6.49 },
  Mayo: { lat: 53.847, lng: -9.3 },
  Meath: { lat: 53.607, lng: -6.656 },
  Monaghan: { lat: 54.249, lng: -6.968 },
  Offaly: { lat: 53.235, lng: -7.712 },
  Roscommon: { lat: 53.627, lng: -8.186 },
  Sligo: { lat: 54.27, lng: -8.47 },
  Tipperary: { lat: 52.473, lng: -8.162 },
  Tyrone: { lat: 54.6, lng: -7.3 },
  Waterford: { lat: 52.259, lng: -7.11 },
  Westmeath: { lat: 53.534, lng: -7.465 },
  Wexford: { lat: 52.336, lng: -6.463 },
  Wicklow: { lat: 52.98, lng: -6.36 },
};
```

- [ ] **Step 2: Export `COUNTY_CENTERS` from the shared package index**

Check `packages/shared/src/index.ts` (or wherever constants are re-exported). If `COUNTY_CENTERS` isn't picked up automatically, add it to the export:

```ts
export { COUNTY_CENTERS } from './constants.js';
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/index.ts
git commit -m "$(cat <<'EOF'
✨ feat(shared): add county centre coordinates for map search
EOF
)"
```

---

## Task 2: County Search Hook

**Files:**

- Create: `apps/native/hooks/use-county-search.ts`
- Create: `apps/native/hooks/__tests__/use-county-search.test.ts`

### Steps

- [ ] **Step 1: Write failing tests**

Create `apps/native/hooks/__tests__/use-county-search.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { filterCounties, type CountyResult } from '../use-county-search';

describe('filterCounties', () => {
  it('returns matching counties for a prefix', () => {
    const results = filterCounties('gal');
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('Galway');
    expect(results[0]!.centre).toEqual({ lat: 53.2707, lng: -9.0568 });
  });

  it('is case-insensitive', () => {
    const results = filterCounties('GAL');
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('Galway');
  });

  it('matches mid-word substring', () => {
    const results = filterCounties('ow');
    const names = results.map((r) => r.name);
    expect(names).toContain('Down');
    expect(names).toContain('Wicklow');
  });

  it('returns empty array for no match', () => {
    expect(filterCounties('zzz')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(filterCounties('')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(filterCounties('   ')).toEqual([]);
  });

  it('returns at most 5 results', () => {
    // 'a' matches Armagh, Cavan, Clare, Galway, Fermanagh, Mayo, Roscommon, Tipperary...
    const results = filterCounties('a');
    expect(results.length).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/native && pnpm vitest run hooks/__tests__/use-county-search.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement the hook**

Create `apps/native/hooks/use-county-search.ts`:

```ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { IRISH_COUNTIES, COUNTY_CENTERS } from '@CeolX/shared';

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
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onChangeText = useCallback((text: string) => {
    setQuery(text);
    if (timerRef.current) clearTimeout(timerRef.current);

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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/native && pnpm vitest run hooks/__tests__/use-county-search.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/native/hooks/use-county-search.ts apps/native/hooks/__tests__/use-county-search.test.ts
git commit -m "$(cat <<'EOF'
✨ feat(native): add county search hook with local filtering
EOF
)"
```

---

## Task 3: County Suggestions Dropdown Component

**Files:**

- Create: `apps/native/components/CountySuggestionsDropdown.tsx`

### Steps

- [ ] **Step 1: Create the component**

Create `apps/native/components/CountySuggestionsDropdown.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CountyResult } from '@/hooks/use-county-search';

const HEADER_HEIGHT = 52;
const SEARCH_BAR_GAP = 8;
const SEARCH_BAR_HEIGHT = 44;
const DROPDOWN_GAP = 4;

interface CountySuggestionsDropdownProps {
  suggestions: CountyResult[];
  onSelect: (result: CountyResult) => void;
}

export function CountySuggestionsDropdown({
  suggestions,
  onSelect,
}: CountySuggestionsDropdownProps) {
  const insets = useSafeAreaInsets();
  const top = insets.top + HEADER_HEIGHT + SEARCH_BAR_GAP + SEARCH_BAR_HEIGHT + DROPDOWN_GAP;

  if (suggestions.length === 0) return null;

  return (
    <View
      className="absolute left-4 right-4 bg-white rounded-2xl overflow-hidden"
      style={{
        top,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      {suggestions.map((result) => (
        <Pressable
          key={result.name}
          className="flex-row items-center px-4 py-3 gap-3 active:bg-[#F5F5F5]"
          onPress={() => onSelect(result)}
        >
          <View className="w-9 h-9 rounded-full bg-[#F0F0F0] items-center justify-center">
            <Ionicons name="location-outline" size={20} color="#666" />
          </View>
          <View className="flex-1">
            <Text className="text-[14px] text-[#1A1A1A] font-medium">{result.name}</Text>
            <Text className="text-[12px] text-[#8D8D8D]">County, Ireland</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/native/components/CountySuggestionsDropdown.tsx
git commit -m "$(cat <<'EOF'
✨ feat(native): add county suggestions dropdown component
EOF
)"
```

---

## Task 4: Wire Into Map Screen

**Files:**

- Modify: `apps/native/components/MapSearchBar.tsx` — add `value` prop
- Modify: `apps/native/app/(app)/(tabs)/map/index.tsx` — add `mapRef`, `useCountySearch`, dropdown, `animateToRegion`

### Steps

- [ ] **Step 1: Add `value` prop to MapSearchBar**

In `apps/native/components/MapSearchBar.tsx`, add `value` to the props interface and pass it to `TextInput`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { cn } from 'heroui-native';
import { useRef } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HEADER_HEIGHT = 52;
const SEARCH_BAR_GAP = 8;

interface MapSearchBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onFilterPress?: () => void;
  activeFilterCount?: number;
}

export function MapSearchBar({
  placeholder = 'Search by county / artist / category',
  value,
  onChangeText,
  onFilterPress,
  activeFilterCount = 0,
}: MapSearchBarProps) {
  const insets = useSafeAreaInsets();
  const top = insets.top + HEADER_HEIGHT + SEARCH_BAR_GAP;
  const inputRef = useRef<TextInput>(null);

  return (
    <View className="absolute left-4 right-4" style={{ top }}>
      <Pressable
        className="flex-row items-center bg-white rounded-full h-11 px-4 gap-2"
        onPress={() => inputRef.current?.focus()}
      >
        <Ionicons name="search" size={20} color="#8D8D8D" />
        <TextInput
          ref={inputRef}
          className="flex-1 text-[#1A1A1A] text-[14px]"
          style={{ padding: 0 }}
          placeholder={placeholder}
          placeholderTextColor="#8D8D8D"
          value={value}
          onChangeText={onChangeText}
          returnKeyType="search"
          autoCorrect={false}
        />
        <Pressable
          className={cn(
            'w-8 h-8 rounded-full items-center justify-center',
            activeFilterCount > 0 ? 'bg-[#662FFF]' : 'bg-[#F0F0F0]'
          )}
          onPress={onFilterPress}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={activeFilterCount > 0 ? '#FFFFFF' : '#8D8D8D'}
          />
          {activeFilterCount > 0 && (
            <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF3B30] items-center justify-center">
              <Text className="text-[10px] font-bold text-white">{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Update MapScreen**

Replace `apps/native/app/(app)/(tabs)/map/index.tsx` with:

```tsx
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, Text, View } from 'react-native';
import MapView from 'react-native-map-clustering';
import type { Region } from 'react-native-maps';
import { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type RNMapView from 'react-native-maps';

import { CATEGORY_ICONS, CATEGORY_LABELS } from '@CeolX/shared';

import { CountySuggestionsDropdown } from '@/components/CountySuggestionsDropdown';
import { EventPreviewCard } from '@/components/EventPreviewCard';
import { MapEventPin } from '@/components/MapEventPin';
import { MapFilterSheet } from '@/components/MapFilterSheet';
import { MapHeader } from '@/components/MapHeader';
import { MapSearchBar } from '@/components/MapSearchBar';
import { useCountySearch } from '@/hooks/use-county-search';
import { useGpsRegion } from '@/hooks/use-gps-region';
import { useMapEvents } from '@/hooks/use-map-events';
import { usePanelAnimation } from '@/hooks/use-panel-animation';
import type { CountyResult } from '@/hooks/use-county-search';

type MapEvent = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  category: string;
  dateStart: string;
  dateEnd?: string;
  venueAddress?: string;
  coverImageUrl?: string;
  isGigOpportunity: boolean;
  distanceMeters?: number;
};

type ClusterObject = {
  id: string | number;
  geometry: { coordinates: [number, number] };
  properties: { point_count: number };
  onPress: () => void;
};

export default function MapScreen() {
  const mapRef = useRef<RNMapView>(null);
  const {
    events,
    isLoading,
    onRegionChangeComplete,
    onSearch,
    filters,
    setFilters,
    activeFilterCount,
  } = useMapEvents();
  const { initialRegion, gpsGranted, mapKey } = useGpsRegion();
  const {
    selectedItem: selectedEvent,
    panelAnim,
    markerJustPressedRef,
    selectItem,
    dismissPanel,
  } = usePanelAnimation<MapEvent>();
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);

  const {
    query: searchText,
    suggestions,
    isDropdownVisible,
    onChangeText: onCountyChangeText,
    dismissDropdown,
    clearSearch,
  } = useCountySearch();

  const handleSearchChangeText = useCallback(
    (text: string) => {
      onCountyChangeText(text);
      onSearch(text);
    },
    [onCountyChangeText, onSearch]
  );

  const handleCountySelect = useCallback(
    (result: CountyResult) => {
      dismissDropdown();
      clearSearch();
      mapRef.current?.animateToRegion(
        {
          latitude: result.centre.lat,
          longitude: result.centre.lng,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        },
        800
      );
    },
    [dismissDropdown, clearSearch]
  );

  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      if (!markerJustPressedRef.current) dismissPanel();
      onRegionChangeComplete(region);
    },
    [onRegionChangeComplete, dismissPanel, markerJustPressedRef]
  );

  const handleMapPress = useCallback(() => {
    dismissDropdown();
  }, [dismissDropdown]);

  const renderCluster = useCallback(
    (cluster: ClusterObject) => (
      <Marker
        key={`cluster-${cluster.id}`}
        coordinate={{
          latitude: cluster.geometry.coordinates[1],
          longitude: cluster.geometry.coordinates[0],
        }}
        onPress={cluster.onPress}
      >
        <MapEventPin type="cluster" count={cluster.properties.point_count} />
      </Marker>
    ),
    []
  );

  return (
    <View className="flex-1 bg-[#080808]">
      <MapView
        ref={mapRef}
        key={mapKey}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChangeComplete}
        onPress={handleMapPress}
        showsUserLocation={gpsGranted}
        userInterfaceStyle={'dark' as const}
        clusterColor="#6155F5"
        clusterTextColor="#ffffff"
        renderCluster={renderCluster}
      >
        {events.map((event) => (
          <Marker
            key={event.id}
            coordinate={{ latitude: event.lat, longitude: event.lng }}
            tracksViewChanges={selectedEvent?.id === event.id}
          >
            <Pressable onPress={() => selectItem(event)}>
              <View className="items-center">
                <MapEventPin
                  type="single"
                  coverImageUrl={event.coverImageUrl}
                  category={CATEGORY_LABELS[event.category] ?? event.category}
                  categoryIcon={CATEGORY_ICONS[event.category]}
                  isSelected={selectedEvent?.id === event.id}
                />
                {selectedEvent?.id === event.id ? (
                  <View className="mt-1 bg-[rgba(255,255,255,0.92)] px-2 py-[3px] rounded-[10px] max-w-[140px]">
                    <Text className="text-[11px] text-[#080808] font-semibold" numberOfLines={1}>
                      {event.title}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          </Marker>
        ))}
      </MapView>

      <MapHeader />
      <MapSearchBar
        value={searchText}
        onChangeText={handleSearchChangeText}
        onFilterPress={() => setFilterSheetVisible(true)}
        activeFilterCount={activeFilterCount}
      />

      {isDropdownVisible && (
        <CountySuggestionsDropdown suggestions={suggestions} onSelect={handleCountySelect} />
      )}

      {isLoading && (
        <ActivityIndicator
          style={{ position: 'absolute', alignSelf: 'center', top: 24 }}
          size="large"
          color="#6155F5"
        />
      )}

      {!isLoading && events.length === 0 && !isDropdownVisible && (
        <View className="absolute bottom-[100px] self-center bg-[rgba(43,43,43,0.92)] px-5 py-[10px] rounded-[20px] max-w-[280px]">
          <Text className="text-white text-[14px] text-center">
            No events near here. Try searching for Dublin, Galway, or Cork.
          </Text>
        </View>
      )}

      {selectedEvent && !isDropdownVisible && (
        <Animated.View
          className="absolute bottom-[90px] left-4 right-4"
          style={{ transform: [{ translateY: panelAnim }] }}
        >
          <EventPreviewCard event={selectedEvent} onDismiss={dismissPanel} />
        </Animated.View>
      )}

      <MapFilterSheet
        visible={filterSheetVisible}
        filters={filters}
        onApply={setFilters}
        onClose={() => setFilterSheetVisible(false)}
      />
    </View>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/native/components/MapSearchBar.tsx apps/native/app/'(app)'/'(tabs)'/map/index.tsx apps/native/components/CountySuggestionsDropdown.tsx
git commit -m "$(cat <<'EOF'
✨ feat(native): wire county search dropdown and map re-centering into map screen
EOF
)"
```

---

## Task 5: Verification

- [ ] **Step 1: Run lint**

```bash
pnpm lint
```

- [ ] **Step 2: Run type check**

```bash
pnpm check-types
```

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

- [ ] **Step 4: Build**

```bash
pnpm build
```

- [ ] **Step 5: Final acceptance criteria audit**

| #   | Criterion                                        | Status                                                                       |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| 1   | Pins merge into cluster badge                    | Done (pre-existing)                                                          |
| 2   | Tapping cluster zooms in                         | Done (pre-existing)                                                          |
| 3   | Cluster badge styled correctly                   | Done (pre-existing)                                                          |
| 4   | Search bar visible with correct placeholder      | Done (pre-existing)                                                          |
| 5   | Typing county name shows suggestions             | Done (Task 2 + 3)                                                            |
| 6   | Selecting location re-centres map + reloads pins | Done (Task 4 — `animateToRegion` + `onRegionChangeComplete` triggers reload) |
| 7   | ~~Artist search~~                                | Removed from scope                                                           |
| 8   | Category filter sheet opens and filters pins     | Done (pre-existing)                                                          |
| 9   | Filter icon shows active indicator               | Done (pre-existing)                                                          |
| 10  | Clearing filter restores all pins                | Done (pre-existing)                                                          |

---

## Libraries & Verified APIs

| Library           | Version         | API/Pattern                                        | Verified Via      |
| ----------------- | --------------- | -------------------------------------------------- | ----------------- |
| react-native-maps | 1.27.2          | `mapRef.current.animateToRegion(region, duration)` | Context7          |
| IRISH_COUNTIES    | `@CeolX/shared` | Static array, local filter                         | Existing codebase |
