# Feed Location Sheet (Search + Map Picker) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Discovery-feed user change the feed's location by tapping the header location chip, which opens a bottom sheet with place search + a fixed-centre-pin map picker; confirming re-queries the feed around the chosen point.

**Architecture:** The `discover` screen owns an optional `locationOverride`. The effective feed location is `override ?? gps-derived`, computed by a new pure `resolveFeedLocation()` helper. A new `FeedLocationSheet` (React Native `Modal`, matching `FilterSheet`) hosts a `react-native-maps` map with a fixed centre-pin overlay plus a search field backed by a new `usePlaceSearch()` hook (which calls the existing `/location/geocode` server endpoint via `geocodeAddress`). Confirming sets the override; `useFeedEvents` resets pagination whenever `lat`/`lng` change.

**Tech Stack:** React Native + Expo, TypeScript, `react-native-maps`, `expo-location`, TanStack Query + tRPC, Tailwind/uniwind (`className` + `cn`), vitest.

---

## Context the implementer needs

- **Spec:** `docs/superpowers/specs/2026-06-11-feed-location-sheet-design.md`.
- **Venue fallback (Asana scope item 1) is ALREADY implemented** — `applyVenueFallback` in `apps/native/hooks/use-gps-region.ts:130` + `useVenueFallback()` wired at `apps/native/app/(app)/(tabs)/discover/index.tsx:59-60`. Do **not** rebuild it. Task 7 only verifies it.
- **Existing search pattern to mirror:** `apps/native/hooks/use-county-search.ts` (debounce + `query`/`suggestions`/`isDropdownVisible`/`commitSelection`/`dismissDropdown`/`clearSearch`).
- **Existing geocode client:** `apps/native/utils/geocode.ts` — `geocodeAddress(query): Promise<GeocodeResult[]>` (throws on network/server error; `[]` = no match) and `reverseGeocode(lat,lng): Promise<string|null>`. `GeocodeResult = { lat; lng; address }`.
- **Sheet pattern to mirror:** `apps/native/components/FilterSheet.tsx` — `Modal` with `animationType="slide" presentationStyle="pageSheet"`, `useSafeAreaInsets()`, `cn()` classes. NEVER use `StyleSheet.create` (project rule — use `className` + `cn`).
- **Styling:** dark feed theme. Background `#080808`/`#1a1a1a`, accent `#C8FF2F`, font class `font-urbanist`.
- **Map usage reference:** `apps/native/app/(app)/(tabs)/map/index.tsx` — `MapView` from `react-native-maps`, `provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}`, `mapRef.current.animateToRegion(region, 800)`, `onRegionChangeComplete(region)` gives `region.latitude/longitude`. (The feed sheet uses plain `react-native-maps`, NOT `react-native-map-clustering`.)
- **Tests:** vitest, files in `apps/native/hooks/__tests__/` and (new) `apps/native/utils/__tests__/`. The repo unit-tests **pure functions only** and mocks `react`/`@CeolX/shared` (see `use-county-search.test.ts`). Do not write RN component-render tests.

### Verification commands (used throughout)

- Unit test a file: `cd apps/native && npx vitest run <relative/path.test.ts>`
- Type-check: `cd apps/native && pnpm check-types`
- Lint: `cd apps/native && pnpm lint`

### Commit conventions

Branch is already `feature/feed-location-sheet`. Commit subjects must be **fully lowercase** (including acronyms), gitmoji + conventional, scope `native`. Example: `:sparkles: feat(native): add feed location search sheet`. End every commit body with:

```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

---

## File Structure

| File                                                       | Responsibility                                                                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `apps/native/utils/feed-location.ts` (new)                 | Pure `resolveFeedLocation()` — effective `{lat,lng,label}` from override + gps region.                         |
| `apps/native/utils/__tests__/feed-location.test.ts` (new)  | Unit tests for `resolveFeedLocation`.                                                                          |
| `apps/native/utils/device-location.ts` (new)               | `getDeviceLocation()` — best-effort current GPS coords via expo-location.                                      |
| `apps/native/hooks/use-place-search.ts` (new)              | `usePlaceSearch()` — debounced free-text place search via `geocodeAddress`, with loading/error/stale handling. |
| `apps/native/components/FeedLocationSheet.tsx` (new)       | The `Modal` sheet: map + centre pin + search field + suggestions + recenter + confirm.                         |
| `apps/native/hooks/use-feed-events.ts` (modify)            | Reset pagination when `lat`/`lng` change.                                                                      |
| `apps/native/app/(app)/(tabs)/discover/index.tsx` (modify) | Own `locationOverride`, compute effective location, open/confirm the sheet, drive `locationText`.              |

---

### Task 1: `resolveFeedLocation` pure helper (TDD)

Extracts the location-label logic currently inlined at `discover/index.tsx:155-163` into a tested, reusable pure function that also accounts for a manual override.

**Files:**

- Create: `apps/native/utils/feed-location.ts`
- Test: `apps/native/utils/__tests__/feed-location.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/native/utils/__tests__/feed-location.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

import { resolveFeedLocation } from '../feed-location';

const region = { latitude: 53.5, longitude: -6.2 };

describe('resolveFeedLocation', () => {
  it('uses the override verbatim when present', () => {
    const override = { lat: 51.9, lng: -8.47, label: 'Cork City Centre' };
    expect(resolveFeedLocation(override, region, 'Dublin', 'gps')).toEqual(override);
  });

  it('uses the reverse-geocoded place label when there is no override', () => {
    expect(resolveFeedLocation(null, region, 'Swords', 'gps')).toEqual({
      lat: 53.5,
      lng: -6.2,
      label: 'Swords',
    });
  });

  it('falls back to a source label when no place label is available', () => {
    expect(resolveFeedLocation(null, region, null, 'gps').label).toBe('Current Location');
    expect(resolveFeedLocation(null, region, null, 'ip').label).toBe('Approximate Location');
    expect(resolveFeedLocation(null, region, null, 'venue-profile').label).toBe('Your venue');
    expect(resolveFeedLocation(null, region, null, 'default').label).toBe('Ireland');
    expect(resolveFeedLocation(null, region, null, 'pending').label).toBe('Ireland');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/native && npx vitest run utils/__tests__/feed-location.test.ts`
Expected: FAIL — `Cannot find module '../feed-location'`.

- [ ] **Step 3: Write the implementation**

Create `apps/native/utils/feed-location.ts`:

```ts
import type { LocationSource } from '@/hooks/use-gps-region';

export type FeedLocation = { lat: number; lng: number; label: string };

/** Human-readable fallback label when reverse-geocoding produced nothing. */
function sourceLabel(source: LocationSource): string {
  switch (source) {
    case 'gps':
      return 'Current Location';
    case 'ip':
      return 'Approximate Location';
    case 'venue-profile':
      return 'Your venue';
    default:
      return 'Ireland';
  }
}

/**
 * Resolve the feed's effective location. A manual override (set from the
 * location sheet) always wins; otherwise we use the GPS/IP/venue region plus the
 * best available label (reverse-geocoded place name, then a source-based label).
 */
export function resolveFeedLocation(
  override: FeedLocation | null,
  region: { latitude: number; longitude: number },
  placeLabel: string | null,
  locationSource: LocationSource
): FeedLocation {
  if (override) return override;
  return {
    lat: region.latitude,
    lng: region.longitude,
    label: placeLabel ?? sourceLabel(locationSource),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/native && npx vitest run utils/__tests__/feed-location.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/native/utils/feed-location.ts apps/native/utils/__tests__/feed-location.test.ts
git commit -m ":sparkles: feat(native): add resolvefeedlocation helper for feed location label

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Reset feed pagination when location changes

Today `useFeedEvents` re-queries when `lat`/`lng` change (they feed `queryInput`) but does NOT reset `offset`/`accumulatedEvents`, so a location change can append onto a stale page. Add a reset effect mirroring `onSearch`/`onCategoryChange`/`onDateChange`.

**Files:**

- Modify: `apps/native/hooks/use-feed-events.ts`

- [ ] **Step 1: Add the reset effect**

In `apps/native/hooks/use-feed-events.ts`, immediately AFTER the existing data-sync `useEffect` that ends at line 88 (the one with `}, [data, isFetching]);`), insert:

```ts
// Reset pagination whenever the feed's location changes — the user picked a new
// point in the location sheet, or GPS/IP resolved after the Ireland default.
// Without this, a location change would append new events onto the previous
// location's accumulated list. Mirrors the reset in onSearch/onCategory/onDate.
useEffect(() => {
  setOffset(0);
  setAccumulatedEvents([]);
  setHasNextPage(true);
}, [lat, lng]);
```

(`useEffect` is already imported at line 2.)

- [ ] **Step 2: Type-check**

Run: `cd apps/native && pnpm check-types`
Expected: PASS (no new errors).

- [ ] **Step 3: Lint**

Run: `cd apps/native && pnpm lint`
Expected: PASS. (If lint complains about `react-hooks/exhaustive-deps` wanting the setters, they are stable `useState` setters — add them to the dep array if required: `[lat, lng]` is the intent; setters are referentially stable so either is fine. Match whatever the existing effects do — the file's other effect uses a narrow dep array, so keep `[lat, lng]`.)

- [ ] **Step 4: Commit**

```bash
git add apps/native/hooks/use-feed-events.ts
git commit -m ":bug: fix(native): reset feed pagination when the feed location changes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `usePlaceSearch` hook (free-text place search)

A debounced place-search hook backed by the existing `/location/geocode` endpoint. Mirrors `useCountySearch`'s return shape so the sheet can consume it the same way the map consumes county search, but adds async loading/error state and stale-response guarding (a slow earlier request must not overwrite a newer one).

**Files:**

- Create: `apps/native/hooks/use-place-search.ts`

- [ ] **Step 1: Write the hook**

Create `apps/native/hooks/use-place-search.ts`:

```ts
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
```

> **Note on testing:** This hook is async orchestration over `geocodeAddress`, which is already covered by `apps/server/src/__tests__/location.test.ts` (the `/location/geocode` endpoint) and the `geocode.ts` util. Following the repo convention (pure-function unit tests only; async hooks are not render-tested here), there is no separate unit test for this hook — it is exercised manually in Task 7.

- [ ] **Step 2: Type-check**

Run: `cd apps/native && pnpm check-types`
Expected: PASS.

- [ ] **Step 3: Lint**

Run: `cd apps/native && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/native/hooks/use-place-search.ts
git commit -m ":sparkles: feat(native): add useplacesearch hook backed by geocode endpoint

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `getDeviceLocation` util

Best-effort current GPS coordinates for the sheet's "Use my current location" action. Thin wrapper over `expo-location`; returns `null` rather than throwing so callers degrade gracefully.

**Files:**

- Create: `apps/native/utils/device-location.ts`

- [ ] **Step 1: Write the util**

Create `apps/native/utils/device-location.ts`:

```ts
import * as Location from 'expo-location';

/**
 * Best-effort current device coordinates. Requests foreground permission if not
 * already granted. Returns null on denial or any failure so the caller can keep
 * the current map centre instead of crashing.
 */
export async function getDeviceLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      ({ status } = await Location.requestForegroundPermissionsAsync());
    }
    if (status !== Location.PermissionStatus.GRANTED) return null;

    const pos =
      (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync());
    if (!pos) return null;
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (err: unknown) {
    console.warn('[getDeviceLocation] failed:', err);
    return null;
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/native && pnpm check-types`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/native/utils/device-location.ts
git commit -m ":sparkles: feat(native): add getdevicelocation util for current gps coords

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `FeedLocationSheet` component

The bottom sheet: a `Modal` (matching `FilterSheet`) containing a search field, a `react-native-maps` map with a fixed centre-pin overlay, a live address label, a recenter-to-GPS button, and a confirm button. Panning the map moves the (always-centred) pin; the centre coordinate is what gets confirmed.

**Files:**

- Create: `apps/native/components/FeedLocationSheet.tsx`

- [ ] **Step 1: Write the component**

Create `apps/native/components/FeedLocationSheet.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlaceSearch } from '@/hooks/use-place-search';
import { getDeviceLocation } from '@/utils/device-location';
import { type GeocodeResult, reverseGeocode } from '@/utils/geocode';

const ZOOM = { latitudeDelta: 0.5, longitudeDelta: 0.5 };
const REVERSE_GEOCODE_DEBOUNCE_MS = 400;
const FALLBACK_LABEL = 'Selected location';

export interface FeedLocationSheetProps {
  visible: boolean;
  /** Map centre when the sheet opens — the feed's current effective location. */
  initialLat: number;
  initialLng: number;
  /** User confirmed a location. */
  onConfirm: (loc: { lat: number; lng: number; label: string }) => void;
  onClose: () => void;
}

export function FeedLocationSheet({
  visible,
  initialLat,
  initialLng,
  onConfirm,
  onClose,
}: FeedLocationSheetProps) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const centreRef = useRef({ lat: initialLat, lng: initialLng });
  const [label, setLabel] = useState(FALLBACK_LABEL);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // When a search/recenter sets the centre programmatically we keep that label and
  // skip the next reverse-geocode pass (the animation also fires onRegionChange).
  const labelLockedRef = useRef(false);

  const {
    query,
    suggestions,
    isDropdownVisible,
    isSearching,
    hasError,
    onChangeText,
    commitSelection,
  } = usePlaceSearch();

  // Reset the pin + label to the incoming location each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    centreRef.current = { lat: initialLat, lng: initialLng };
    setLabel(FALLBACK_LABEL);
    labelLockedRef.current = false;
  }, [visible, initialLat, initialLng]);

  useEffect(() => {
    return () => {
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
    };
  }, []);

  const scheduleReverseGeocode = useCallback((lat: number, lng: number) => {
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    reverseTimer.current = setTimeout(() => {
      void reverseGeocode(lat, lng).then((addr) => {
        if (addr) setLabel(addr);
      });
    }, REVERSE_GEOCODE_DEBOUNCE_MS);
  }, []);

  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      centreRef.current = { lat: region.latitude, lng: region.longitude };
      if (labelLockedRef.current) {
        // This change came from a programmatic animate (search/recenter); keep the
        // label we already set and re-enable reverse-geocoding for the next pan.
        labelLockedRef.current = false;
        return;
      }
      scheduleReverseGeocode(region.latitude, region.longitude);
    },
    [scheduleReverseGeocode]
  );

  const recentreTo = useCallback((lat: number, lng: number, nextLabel: string) => {
    labelLockedRef.current = true;
    centreRef.current = { lat, lng };
    setLabel(nextLabel);
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, ...ZOOM }, 600);
  }, []);

  const handleSelect = useCallback(
    (result: GeocodeResult) => {
      commitSelection(result.address);
      recentreTo(result.lat, result.lng, result.address);
    },
    [commitSelection, recentreTo]
  );

  const handleUseCurrentLocation = useCallback(async () => {
    const loc = await getDeviceLocation();
    if (loc) recentreTo(loc.lat, loc.lng, 'Current Location');
  }, [recentreTo]);

  const handleConfirm = useCallback(() => {
    const { lat, lng } = centreRef.current;
    onConfirm({ lat, lng, label });
    onClose();
  }, [label, onConfirm, onClose /* label is read here */]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-[#1a1a1a]" style={{ paddingTop: insets.top + 8 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-white/10">
          <Text className="text-lg font-bold text-white font-urbanist">
            Search events by location
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </Pressable>
        </View>

        {/* Search field */}
        <View className="px-5 pt-3 z-10">
          <View className="flex-row items-center bg-white rounded-xl h-12 px-4 gap-2">
            <Ionicons name="search" size={20} color="#8D8D8D" />
            <TextInput
              className="flex-1 text-[#1A1A1A] text-[14px]"
              style={{ padding: 0 }}
              placeholder="Search a town, city or venue…"
              placeholderTextColor="#8D8D8D"
              value={query}
              onChangeText={onChangeText}
              returnKeyType="search"
              autoCorrect={false}
            />
            {isSearching && <ActivityIndicator size="small" color="#8D8D8D" />}
          </View>

          {/* Suggestions dropdown */}
          {isDropdownVisible && (
            <View
              className="absolute left-5 right-5 top-[60px] bg-white rounded-2xl overflow-hidden shadow-lg"
              style={{ elevation: 8 }}
            >
              {hasError ? (
                <Text className="px-4 py-3 text-[13px] text-[#8D8D8D]">
                  Couldn’t search places. Check your connection.
                </Text>
              ) : suggestions.length === 0 ? (
                <Text className="px-4 py-3 text-[13px] text-[#8D8D8D]">No places found.</Text>
              ) : (
                suggestions.map((result) => (
                  <Pressable
                    key={`${result.lat},${result.lng}`}
                    className="flex-row items-center px-4 py-3 gap-3 active:bg-[#F5F5F5]"
                    onPress={() => handleSelect(result)}
                  >
                    <View className="w-9 h-9 rounded-full bg-[#F0F0F0] items-center justify-center">
                      <Ionicons name="location-outline" size={20} color="#666" />
                    </View>
                    <Text className="flex-1 text-[14px] text-[#1A1A1A]" numberOfLines={2}>
                      {result.address}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          )}
        </View>

        {/* Map + centre pin */}
        <View className="flex-1 mt-3 overflow-hidden">
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={{ latitude: initialLat, longitude: initialLng, ...ZOOM }}
            onRegionChangeComplete={handleRegionChangeComplete}
            userInterfaceStyle="dark"
          />

          {/* Fixed centre pin overlay — non-interactive so map gestures pass through. */}
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <Ionicons
              name="location-sharp"
              size={40}
              color="#662FFF"
              style={{ marginBottom: 40 }}
            />
          </View>

          {/* Live address label */}
          <View pointerEvents="none" className="absolute top-3 left-4 right-4 items-center">
            <View className="bg-black/75 rounded-full px-3 py-1.5">
              <Text className="text-white text-[12px] font-urbanist" numberOfLines={1}>
                {label}
              </Text>
            </View>
          </View>

          {/* Recenter to GPS */}
          <Pressable
            onPress={handleUseCurrentLocation}
            className="absolute right-4 bottom-4 w-11 h-11 rounded-full bg-white items-center justify-center shadow-lg"
            style={{ elevation: 6 }}
          >
            <Ionicons name="locate" size={22} color="#1A1A1A" />
          </Pressable>
        </View>

        {/* Footer */}
        <View className="px-5 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          <Pressable
            onPress={handleConfirm}
            className="h-12 rounded-full bg-[#C8FF2F] items-center justify-center"
          >
            <Text className="text-black text-[15px] font-semibold font-urbanist">
              Set location · show events here
            </Text>
          </Pressable>
          <Pressable
            onPress={handleUseCurrentLocation}
            className="h-10 items-center justify-center mt-1"
          >
            <Text className="text-[#C8FF2F] text-[13px] font-semibold font-urbanist">
              Use my current location
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
```

> Remove the trailing `/* label is read here */` comment inside the `handleConfirm` dep array before saving — it's only there to flag that `label` must stay in the deps. Final deps: `[label, onConfirm, onClose]`.

- [ ] **Step 2: Type-check**

Run: `cd apps/native && pnpm check-types`
Expected: PASS. (If `react-native-maps` types complain about `MapView` ref typing, the map screen already refs it as `RNMapView` from `react-native-maps` — import `type { default as MapViewType }` is unnecessary; `useRef<MapView>(null)` matches the default export used here.)

- [ ] **Step 3: Lint**

Run: `cd apps/native && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/native/components/FeedLocationSheet.tsx
git commit -m ":sparkles: feat(native): add feedlocationsheet with map picker and place search

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Wire the sheet into the Discovery screen

Replace the inline location-label logic with `resolveFeedLocation`, own a `locationOverride`, open the sheet from the header chip, and apply the confirmed location to the feed.

**Files:**

- Modify: `apps/native/app/(app)/(tabs)/discover/index.tsx`

- [ ] **Step 1: Add imports**

In `apps/native/app/(app)/(tabs)/discover/index.tsx`, add to the existing `@/components` / `@/hooks` / `@/utils` import groups:

```ts
import { FeedLocationSheet } from '@/components/FeedLocationSheet';
import { resolveFeedLocation, type FeedLocation } from '@/utils/feed-location';
```

- [ ] **Step 2: Add override + sheet state and compute effective location**

After the existing `const [searchText, setSearchText] = useState('');` (line 66), add:

```ts
const [locationOverride, setLocationOverride] = useState<FeedLocation | null>(null);
const [locationSheetVisible, setLocationSheetVisible] = useState(false);

const effectiveLocation = resolveFeedLocation(
  locationOverride,
  initialRegion,
  placeLabel,
  locationSource
);
```

- [ ] **Step 3: Feed the effective location into `useFeedEvents`**

Change the `useFeedEvents({ ... })` call (lines 87-91) from:

```ts
  } = useFeedEvents({
    lat: initialRegion.latitude,
    lng: initialRegion.longitude,
    enabled: activeSegment === 0,
  });
```

to:

```ts
  } = useFeedEvents({
    lat: effectiveLocation.lat,
    lng: effectiveLocation.lng,
    enabled: activeSegment === 0,
  });
```

- [ ] **Step 4: Replace the inline `locationText` with the resolved label**

Delete the `const locationText = ...` block (lines 155-163) and replace it with:

```ts
const locationText = effectiveLocation.label;
```

- [ ] **Step 5: Add the confirm handler**

Add near the other `useCallback` handlers (e.g. after `handleDateClear`):

```ts
const handleLocationConfirm = useCallback((loc: FeedLocation) => {
  setLocationOverride(loc);
  setLocationSheetVisible(false);
}, []);
```

- [ ] **Step 6: Open the sheet from the header chip**

In the `<FeedHeader ... />` element (line 183), add the `onLocationPress` prop:

```tsx
<FeedHeader
  locationText={locationText}
  onLocationPress={() => setLocationSheetVisible(true)}
  onCalendarPress={() => setDatePickerVisible(true)}
  onFilterPress={() => setFilterSheetVisible(true)}
  onNotificationPress={() => router.push('/notifications')}
  calendarActive={activeSegment === 0 && !!date}
  filterActive={activeSegment === 0 && !!category}
/>
```

- [ ] **Step 7: Render the sheet**

Immediately before the closing `</SafeAreaView>` (after the `<DatePickerSheet ... />` element, line 380), add:

```tsx
<FeedLocationSheet
  visible={locationSheetVisible}
  initialLat={effectiveLocation.lat}
  initialLng={effectiveLocation.lng}
  onConfirm={handleLocationConfirm}
  onClose={() => setLocationSheetVisible(false)}
/>
```

- [ ] **Step 8: Type-check**

Run: `cd apps/native && pnpm check-types`
Expected: PASS.

- [ ] **Step 9: Lint**

Run: `cd apps/native && pnpm lint`
Expected: PASS.

- [ ] **Step 10: Run the full feed-related unit tests**

Run: `cd apps/native && npx vitest run utils/__tests__/feed-location.test.ts hooks/__tests__/use-gps-region.test.ts`
Expected: PASS (the gps-region suite still passes — venue fallback untouched).

- [ ] **Step 11: Commit**

```bash
git add apps/native/app/(app)/(tabs)/discover/index.tsx
git commit -m ":sparkles: feat(native): open location sheet from feed header and apply chosen location

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Verify end-to-end (venue fallback + UI)

No code unless a defect is found. Confirm the three Asana scope items behave correctly.

**Files:** none (verification).

- [ ] **Step 1: Confirm venue fallback is intact**

Run: `cd apps/native && npx vitest run hooks/__tests__/use-gps-region.test.ts`
Expected: PASS. Confirms `applyVenueFallback` (Asana scope item 1) still resolves a denied-GPS venue to its saved pin — already implemented, untouched by this work.

- [ ] **Step 2: Type-check + lint the whole native app**

Run: `cd apps/native && pnpm check-types && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Manual UI verification (use the `mobile-dev` skill)**

Launch the app on the connected device and verify, screenshotting before/after:

1. Open the Discovery feed → tap the location chip (text + ▾) in the header → the `FeedLocationSheet` slides up with a map centred on the current feed location.
2. Type a town in the search field (e.g. "Cork") → suggestions appear → tap one → the map animates there and the address label updates.
3. Pan the map → the centre pin stays centred and the address label reverse-geocodes to the new centre.
4. Tap 🎯 / "Use my current location" → map recenters on GPS (or, if denied, stays put with no crash).
5. Tap "Set location · show events here" → sheet closes, the header chip shows the chosen place, and the feed list reloads with events around that point.
6. Confirm an empty area shows the existing "No events found" empty state (not a crash).

- [ ] **Step 4: Finalize**

Use the `superpowers:finishing-a-development-branch` skill to decide how to integrate (PR to `development`, per project convention — base `development`, push to BOTH `client` and `raftlabs` remotes so Vercel/CI fire).

---

## Self-Review

**Spec coverage:**

- Venue-saved fallback (scope 1) → Task 7 Step 1 verifies the existing implementation. ✓
- Location sheet in header (scope 2) → Tasks 4 (sheet) + 6 (header wiring). ✓
- Map picker (scope 3) → Task 4 (fixed-centre-pin map + search + recenter + confirm). ✓
- Reactive feed location + pagination reset → Tasks 2 + 6. ✓
- Reuse `usePlaceSearch`/`geocodeAddress`/`reverseGeocode`/`FilterSheet` pattern → Tasks 3, 4. ✓
- Edge cases (search error, reverse-geocode null → `FALLBACK_LABEL`/keep label, GPS null keeps centre, confirm-without-moving) → handled in Tasks 3, 4. ✓

**Spec delta (intentional, from reading the real code):** the spec proposed a `setLocation` setter on `useFeedEvents`; the actual hook already reads `lat`/`lng` reactively from props, so the screen owns the override and the hook only needs a pagination-reset effect (Task 2). The map's existing search is county-based (`useCountySearch`), so this plan adds a new `usePlaceSearch` over the existing `geocodeAddress` endpoint rather than reusing a (non-existent) shared place-search hook. Net behaviour matches the spec.

**Placeholder scan:** No TBD/TODO. The one inline `/* label is read here */` marker in Task 5 is explicitly called out to be removed, with the final dep array given. ✓

**Type consistency:** `FeedLocation = {lat,lng,label}` is defined in Task 1 and used identically in Tasks 4 (`onConfirm` shape), 6 (`locationOverride`, `handleLocationConfirm`). `GeocodeResult = {lat,lng,address}` (existing) is the suggestion type throughout Tasks 3–5. `usePlaceSearch` return shape consumed in Task 5 matches its definition in Task 3 (`query`, `suggestions`, `isDropdownVisible`, `isSearching`, `hasError`, `onChangeText`, `commitSelection`). `LocationSource` imported from `use-gps-region` in Task 1 matches its export. ✓
