# Manual Base Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a user-chosen base location so it survives cold starts and is used whenever live GPS is unavailable, and add the Figma "Add your Location" screen reached from "Select location manually".

**Architecture:** A new SecureStore-backed `base-location` module stores `{ lat, lng, label }`. The GPS resolution chain (`use-gps-region`) gains a `'saved'` tier between GPS and IP. The permission priming decision becomes services-aware so a saved location suppresses re-prompts unless device location services are on (a chance to upgrade to GPS). A new `/add-location` route reuses the feed sheet's map/search logic (extracted into a shared `useLocationPickerMap` hook) and on SAVE both persists the base location and sets the in-memory override for instant effect. `LocationOverrideProvider` lifts to `(app)/_layout` so the new screen can reach it.

**Tech Stack:** React Native + Expo Router, expo-location, expo-secure-store, react-native-maps, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-13-manual-base-location-design.md`

**Conventions:**

- Run a test file: from `apps/native/` → `npx vitest run <relative/path.test.ts>`
- Typecheck: from `apps/native/` → `npx tsc --noEmit`
- Lint a file: from `apps/native/` → `npx eslint <path>`
- Commits: emoji + conventional, subject **fully lowercase** (incl. acronyms — gps, ip, ui). Scope `native`. Example: `✨ feat(native): add base location persistence`.
- Styling: Tailwind classes via `className` + `cn()` only — never `StyleSheet.create`.

---

## File Structure

| File                                                                 | Responsibility                                              | Action |
| -------------------------------------------------------------------- | ----------------------------------------------------------- | ------ |
| `apps/native/utils/base-location.ts`                                 | SecureStore persistence of `{ lat, lng, label }`            | Create |
| `apps/native/utils/__tests__/base-location.test.ts`                  | Round-trip + corrupt-data tests                             | Create |
| `apps/native/hooks/use-gps-region.ts`                                | Insert `'saved'` tier into the resolution chain             | Modify |
| `apps/native/hooks/__tests__/use-gps-region.test.ts`                 | Tests for the `'saved'` tier                                | Modify |
| `apps/native/utils/feed-location.ts`                                 | `'saved'` source label fallback                             | Modify |
| `apps/native/utils/__tests__/feed-location.test.ts`                  | `'saved'` label test                                        | Modify |
| `apps/native/hooks/use-location-permission-prompt.ts`                | Services-aware reprompt decision                            | Modify |
| `apps/native/hooks/__tests__/use-location-permission-prompt.test.ts` | Services-aware decision tests                               | Modify |
| `apps/native/hooks/use-location-picker-map.ts`                       | Shared map/search/reverse-geocode picker logic              | Create |
| `apps/native/components/FeedLocationSheet.tsx`                       | Refactor to consume the shared hook (no visual change)      | Modify |
| `apps/native/app/(app)/_layout.tsx`                                  | Lift override provider here; register `add-location` screen | Modify |
| `apps/native/app/(app)/(tabs)/_layout.tsx`                           | Remove the provider (now lifted)                            | Modify |
| `apps/native/app/(app)/add-location.tsx`                             | The "Add your Location" screen                              | Create |
| `apps/native/app/(app)/(tabs)/map/index.tsx`                         | Route "Select location manually" → `/add-location`          | Modify |

---

## Task 1: Base location persistence module

**Files:**

- Create: `apps/native/utils/base-location.ts`
- Test: `apps/native/utils/__tests__/base-location.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/native/utils/__tests__/base-location.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
const mockGetItemAsync = vi.fn((key: string) => Promise.resolve(store.get(key) ?? null));
const mockSetItemAsync = vi.fn((key: string, value: string) => {
  store.set(key, value);
  return Promise.resolve();
});
const mockDeleteItemAsync = vi.fn((key: string) => {
  store.delete(key);
  return Promise.resolve();
});

vi.mock('expo-secure-store', () => ({
  getItemAsync: (...a: unknown[]) => mockGetItemAsync(...(a as [string])),
  setItemAsync: (...a: unknown[]) => mockSetItemAsync(...(a as [string, string])),
  deleteItemAsync: (...a: unknown[]) => mockDeleteItemAsync(...(a as [string])),
}));

import { clearBaseLocation, getBaseLocation, setBaseLocation } from '../base-location';

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});
afterEach(() => vi.restoreAllMocks());

describe('base-location', () => {
  it('returns null when nothing is stored', async () => {
    expect(await getBaseLocation()).toBeNull();
  });

  it('round-trips a saved location', async () => {
    const loc = { lat: 53.35, lng: -6.26, label: 'Dublin' };
    await setBaseLocation(loc);
    expect(await getBaseLocation()).toEqual(loc);
  });

  it('returns null for corrupt JSON', async () => {
    store.set('ceolx.base-location', '{not json');
    expect(await getBaseLocation()).toBeNull();
  });

  it('returns null when the stored shape is invalid', async () => {
    store.set('ceolx.base-location', JSON.stringify({ lat: 'x', lng: -6, label: 'Dublin' }));
    expect(await getBaseLocation()).toBeNull();
  });

  it('returns null when lat/lng are not finite', async () => {
    store.set('ceolx.base-location', JSON.stringify({ lat: NaN, lng: -6, label: 'Dublin' }));
    expect(await getBaseLocation()).toBeNull();
  });

  it('clears a saved location', async () => {
    await setBaseLocation({ lat: 53.35, lng: -6.26, label: 'Dublin' });
    await clearBaseLocation();
    expect(await getBaseLocation()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run utils/__tests__/base-location.test.ts`
Expected: FAIL — cannot resolve `../base-location`.

- [ ] **Step 3: Write the implementation**

Create `apps/native/utils/base-location.ts`:

```ts
import * as SecureStore from 'expo-secure-store';

/**
 * The user's persisted base location — the place they explicitly set via the
 * "Add your Location" screen. Used by the GPS resolution chain when no live GPS
 * fix is available, in preference to coarse IP / Ireland. Survives cold starts.
 *
 * Same shape as `FeedLocation` (kept structural to avoid a cross-module import).
 */
export type BaseLocation = { lat: number; lng: number; label: string };

const KEY = 'ceolx.base-location';

function isValid(value: unknown): value is BaseLocation {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.lat === 'number' &&
    Number.isFinite(v.lat) &&
    typeof v.lng === 'number' &&
    Number.isFinite(v.lng) &&
    typeof v.label === 'string'
  );
}

/**
 * Read the saved base location. Returns null when nothing is stored or the
 * stored value is corrupt/legacy — never throws to callers.
 */
export async function getBaseLocation(): Promise<BaseLocation | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setBaseLocation(loc: BaseLocation): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(loc));
}

export async function clearBaseLocation(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run utils/__tests__/base-location.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/native/utils/base-location.ts apps/native/utils/__tests__/base-location.test.ts
git commit -m "✨ feat(native): persist manual base location in securestore"
```

---

## Task 2: Add the `'saved'` tier to the resolution chain

**Files:**

- Modify: `apps/native/hooks/use-gps-region.ts`
- Test: `apps/native/hooks/__tests__/use-gps-region.test.ts`

The `Setters` type gains `setPlaceLabel` (so `resolveLocation` can seed the saved label), `LocationSource` gains `'saved'`, and `resolveLocation` takes a `baseLocation` argument that beats IP when no GPS fix is produced.

- [ ] **Step 1: Update the test setup + add failing tests**

In `apps/native/hooks/__tests__/use-gps-region.test.ts`, update `createSetters` to include the new setter:

```ts
function createSetters() {
  return {
    setInitialRegion: vi.fn(),
    setGpsPermissionGranted: vi.fn(),
    setLocationSource: vi.fn(),
    setMapKey: vi.fn(),
    setPlaceLabel: vi.fn(),
  };
}
```

Then add these tests inside the `describe('resolveLocation', ...)` block:

```ts
it('uses the saved base location when permission denied and a base location exists', async () => {
  mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
  const setters = createSetters();

  await resolveLocation(setters, { lat: 51.9, lng: -8.47, label: 'Cork City' });

  expect(setters.setLocationSource).toHaveBeenCalledWith('saved');
  expect(setters.setInitialRegion).toHaveBeenCalledWith(
    expect.objectContaining({ latitude: 51.9, longitude: -8.47 })
  );
  expect(setters.setPlaceLabel).toHaveBeenCalledWith('Cork City');
  expect(fetchSpy).not.toHaveBeenCalled(); // saved beats IP
});

it('prefers a live GPS fix over the saved base location', async () => {
  mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockGetLastKnownPositionAsync.mockResolvedValue({
    coords: { latitude: 53.35, longitude: -6.26 },
  });
  const setters = createSetters();

  await resolveLocation(setters, { lat: 51.9, lng: -8.47, label: 'Cork City' });

  expect(setters.setLocationSource).toHaveBeenCalledWith('gps');
  expect(setters.setLocationSource).not.toHaveBeenCalledWith('saved');
});

it('falls back to IP when there is no GPS fix and no saved location', async () => {
  mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
  fetchSpy.mockResolvedValueOnce(
    new Response(JSON.stringify({ ok: true, latitude: 51.9, longitude: -8.47 }), { status: 200 })
  );
  const setters = createSetters();

  await resolveLocation(setters, null);

  expect(setters.setLocationSource).toHaveBeenCalledWith('ip');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run hooks/__tests__/use-gps-region.test.ts`
Expected: FAIL — `resolveLocation` ignores the second arg / never emits `'saved'`.

- [ ] **Step 3: Edit `use-gps-region.ts`**

a) Add the import at the top (after the existing imports):

```ts
import { type BaseLocation, getBaseLocation } from '@/utils/base-location';
```

b) Add `'saved'` to the union:

```ts
export type LocationSource = 'gps' | 'ip' | 'default' | 'pending' | 'venue-profile' | 'saved';
```

c) Add `setPlaceLabel` to the `Setters` type:

```ts
type Setters = {
  setInitialRegion: (r: MapRegion) => void;
  setGpsPermissionGranted: (v: boolean) => void;
  setLocationSource: (s: LocationSource) => void;
  setMapKey: (fn: (k: number) => number) => void;
  setPlaceLabel: (label: string | null) => void;
};
```

d) Replace the body of `resolveLocation` with the version below (adds the `baseLocation` param and the `'saved'` branch between the GPS branch and IP):

```ts
export async function resolveLocation(
  setters: Setters,
  baseLocation: BaseLocation | null = null
): Promise<void> {
  const { setInitialRegion, setGpsPermissionGranted, setLocationSource, setMapKey, setPlaceLabel } =
    setters;

  try {
    const { status } = await Location.getForegroundPermissionsAsync();

    if (status === Location.PermissionStatus.GRANTED) {
      setGpsPermissionGranted(true);

      try {
        const pos = await Location.getLastKnownPositionAsync();
        if (pos) {
          setInitialRegion({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            ...GPS_ZOOM,
          });
          setLocationSource('gps');
          setMapKey((k) => k + 1);
          return;
        }
        // Permission granted but no cached position — fall through.
      } catch (err: unknown) {
        console.error('[resolveLocation] getLastKnownPositionAsync failed:', err);
        // Fall through.
      }
    }

    // No live GPS fix → the saved manual base location beats coarse IP / Ireland.
    if (baseLocation) {
      setInitialRegion({
        latitude: baseLocation.lat,
        longitude: baseLocation.lng,
        ...OVERRIDE_ZOOM,
      });
      setPlaceLabel(baseLocation.label);
      setLocationSource('saved');
      setMapKey((k) => k + 1);
      return;
    }

    await resolveViaIp(setInitialRegion, setLocationSource, setMapKey);
  } catch (err: unknown) {
    console.error('[resolveLocation] Permission check failed:', err);
    setInitialRegion(IRELAND_INITIAL_REGION);
    setLocationSource('default');
  }
}
```

e) Add the `'saved'` case to `sourceLabel` — **this lives in `feed-location.ts`, handled in Task 3.** (No change here.)

f) In the `useGpsRegion` hook, load the base location and pass `setPlaceLabel` into the resolution effect. Replace the existing resolution effect:

```ts
useEffect(() => {
  if (!enabled) return;
  void (async () => {
    const base = await getBaseLocation();
    await resolveLocation(
      { setInitialRegion, setGpsPermissionGranted, setLocationSource, setMapKey, setPlaceLabel },
      base
    );
  })();
}, [enabled]);
```

g) Make the reverse-geocode effect **not clobber** the seeded saved label. Replace the guard at the top of that effect:

```ts
  useEffect(() => {
    // 'saved' carries its stored label — never reverse-geocode or null it.
    if (locationSource === 'saved') return;
    if (locationSource !== 'gps' && locationSource !== 'ip' && locationSource !== 'venue-profile') {
      setPlaceLabel(null);
      return;
    }
    // ...existing reverseGeocodeAsync body unchanged...
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run hooks/__tests__/use-gps-region.test.ts`
Expected: PASS (existing + 3 new tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `feed-location.ts`'s `sourceLabel` switch is now non-exhaustive over `'saved'`, that's fixed in Task 3 — typecheck fully after Task 3.)

- [ ] **Step 6: Commit**

```bash
git add apps/native/hooks/use-gps-region.ts apps/native/hooks/__tests__/use-gps-region.test.ts
git commit -m "✨ feat(native): use saved base location when gps is unavailable"
```

---

## Task 3: `'saved'` source label in feed-location

**Files:**

- Modify: `apps/native/utils/feed-location.ts`
- Test: `apps/native/utils/__tests__/feed-location.test.ts`

- [ ] **Step 1: Add the failing test**

In `apps/native/utils/__tests__/feed-location.test.ts`, add to the "falls back to a source label" test (or as a new `it`):

```ts
it('surfaces the seeded place label for a saved location, with a fallback', () => {
  const region = { latitude: 53.5, longitude: -6.2 };
  // The stored label is passed through placeLabel.
  expect(resolveFeedLocation(null, region, 'Cork City', 'saved').label).toBe('Cork City');
  // Fallback string when no label is available.
  expect(resolveFeedLocation(null, region, null, 'saved').label).toBe('Saved location');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run utils/__tests__/feed-location.test.ts`
Expected: FAIL — `sourceLabel` has no `'saved'` case (TS non-exhaustive / returns wrong value).

- [ ] **Step 3: Add the `'saved'` case**

In `apps/native/utils/feed-location.ts`, add the case to `sourceLabel`:

```ts
    case 'saved':
      return 'Saved location';
```

Place it before the `default:` exhaustiveness branch so the `switch` stays exhaustive over `LocationSource`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run utils/__tests__/feed-location.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors now (Task 2 + Task 3 complete the `'saved'` union usage).

- [ ] **Step 6: Commit**

```bash
git add apps/native/utils/feed-location.ts apps/native/utils/__tests__/feed-location.test.ts
git commit -m "✨ feat(native): add saved source label fallback for feed location"
```

---

## Task 4: Services-aware reprompt decision

**Files:**

- Modify: `apps/native/hooks/use-location-permission-prompt.ts`
- Test: `apps/native/hooks/__tests__/use-location-permission-prompt.test.ts`

`resolvePromptState` gains `canAskAgain`, `hasSavedLocation`, and `servicesEnabled` params. The hook awaits permission (status + canAskAgain), `getBaseLocation()`, and `hasServicesEnabledAsync()` before deciding.

- [ ] **Step 1: Rewrite the test file**

Replace `apps/native/hooks/__tests__/use-location-permission-prompt.test.ts` with:

```ts
import * as Location from 'expo-location';
import { describe, expect, it, vi } from 'vitest';

import { resolvePromptState } from '../use-location-permission-prompt';

vi.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
}));

const GRANTED = Location.PermissionStatus.GRANTED;
const DENIED = Location.PermissionStatus.DENIED;
const UNDETERMINED = Location.PermissionStatus.UNDETERMINED;

describe('resolvePromptState', () => {
  // signature: (status, canAskAgain, shownThisSession, hasSavedLocation, servicesEnabled)

  it('never prompts when permission is granted', () => {
    expect(resolvePromptState(GRANTED, true, false, false, true)).toBe('done');
    expect(resolvePromptState(GRANTED, true, true, true, true)).toBe('done');
  });

  describe('no saved location (existing matrix)', () => {
    it('prompts on first ask', () => {
      expect(resolvePromptState(UNDETERMINED, true, false, false, true)).toBe('show');
      expect(resolvePromptState(DENIED, false, false, false, true)).toBe('show');
    });
    it('does not re-show within the same session', () => {
      expect(resolvePromptState(UNDETERMINED, true, true, false, true)).toBe('done');
      expect(resolvePromptState(DENIED, false, true, false, true)).toBe('done');
    });
  });

  describe('saved location exists (services-aware upgrade ask)', () => {
    it('asks once when services on, can ask again, not yet shown', () => {
      expect(resolvePromptState(UNDETERMINED, true, false, true, true)).toBe('show');
      expect(resolvePromptState(DENIED, true, false, true, true)).toBe('show');
    });
    it('stays silent when device services are off', () => {
      expect(resolvePromptState(DENIED, true, false, true, false)).toBe('done');
    });
    it('stays silent when hard-denied (cannot ask again)', () => {
      expect(resolvePromptState(DENIED, false, false, true, true)).toBe('done');
    });
    it('stays silent once already shown this session', () => {
      expect(resolvePromptState(UNDETERMINED, true, true, true, true)).toBe('done');
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run hooks/__tests__/use-location-permission-prompt.test.ts`
Expected: FAIL — `resolvePromptState` has the old 2-arg signature.

- [ ] **Step 3: Edit the hook**

In `apps/native/hooks/use-location-permission-prompt.ts`:

a) Add the import:

```ts
import { getBaseLocation } from '@/utils/base-location';
```

b) Replace `resolvePromptState` with:

```ts
/**
 * Pure decision for whether to show the priming screen.
 *
 * - GRANTED → never prompt (GPS resolves silently).
 * - A saved base location exists → suppress, EXCEPT a one-per-launch "allow your
 *   location?" upgrade ask when device location services are on AND the OS still
 *   allows a prompt. Services off / hard-denied → stay silent (use the saved location).
 * - No saved location → prompt at most once per launch (re-ask denied users each
 *   cold start so they always have a path to set a location).
 */
export function resolvePromptState(
  status: Location.PermissionStatus,
  canAskAgain: boolean,
  shownThisSession: boolean,
  hasSavedLocation: boolean,
  servicesEnabled: boolean
): LocationPromptState {
  if (status === Location.PermissionStatus.GRANTED) return 'done';

  if (hasSavedLocation) {
    if (servicesEnabled && canAskAgain && !shownThisSession) return 'show';
    return 'done';
  }

  return shownThisSession ? 'done' : 'show';
}
```

c) Replace the `check()` body inside the hook's `useEffect` so it reads all three inputs:

```ts
async function check() {
  try {
    const [{ status, canAskAgain }, base, servicesEnabled] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      getBaseLocation(),
      Location.hasServicesEnabledAsync(),
    ]);
    setPromptState(
      resolvePromptState(status, canAskAgain, shownThisSession, base !== null, servicesEnabled)
    );
  } catch {
    // Permission read failed → don't block the map.
    setPromptState('done');
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run hooks/__tests__/use-location-permission-prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/native/hooks/use-location-permission-prompt.ts apps/native/hooks/__tests__/use-location-permission-prompt.test.ts
git commit -m "✨ feat(native): make location reprompt services-aware after a saved pick"
```

---

## Task 5: Extract the shared `useLocationPickerMap` hook

**Files:**

- Create: `apps/native/hooks/use-location-picker-map.ts`
- Modify: `apps/native/components/FeedLocationSheet.tsx`

This is a **behavior-preserving** extraction of the map/search/reverse-geocode logic currently inline in `FeedLocationSheet`. There is no existing test for the sheet; verification is typecheck + manual confirmation that the feed sheet behaves identically.

- [ ] **Step 1: Create the hook**

Create `apps/native/hooks/use-location-picker-map.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type RNMapView from 'react-native-maps';
import type { Region } from 'react-native-maps';

import { usePlaceSearch } from '@/hooks/use-place-search';
import { getDeviceLocation } from '@/utils/device-location';
import { type GeocodeResult, reverseGeocode } from '@/utils/geocode';

const ZOOM = { latitudeDelta: 0.5, longitudeDelta: 0.5 };
const REVERSE_GEOCODE_DEBOUNCE_MS = 400;
export const PICKER_FALLBACK_LABEL = 'Selected location';

/**
 * Map-picker state shared by the Feed location sheet and the Add Location screen:
 * a draggable map whose centre is reverse-geocoded into a label, plus place
 * search that recenters the map. Extracted verbatim from FeedLocationSheet so the
 * two surfaces can't drift. Pan → debounced reverse-geocode; programmatic
 * recenters lock the label for one region-change so the animation can't clobber it.
 */
export function useLocationPickerMap(initialLat: number, initialLng: number) {
  const mapRef = useRef<RNMapView>(null);
  const centreRef = useRef({ lat: initialLat, lng: initialLng });
  const [label, setLabel] = useState(PICKER_FALLBACK_LABEL);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labelLockedRef = useRef(false);
  const reverseReqIdRef = useRef(0);

  const search = usePlaceSearch();
  const { commitSelection, clearSearch, dismissDropdown } = search;

  useEffect(() => {
    return () => {
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
    };
  }, []);

  const scheduleReverseGeocode = useCallback((lat: number, lng: number) => {
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    const reqId = ++reverseReqIdRef.current;
    reverseTimer.current = setTimeout(() => {
      void reverseGeocode(lat, lng).then((addr) => {
        if (addr && reqId === reverseReqIdRef.current) setLabel(addr);
      });
    }, REVERSE_GEOCODE_DEBOUNCE_MS);
  }, []);

  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      centreRef.current = { lat: region.latitude, lng: region.longitude };
      if (labelLockedRef.current) {
        labelLockedRef.current = false;
        return;
      }
      dismissDropdown();
      scheduleReverseGeocode(region.latitude, region.longitude);
    },
    [dismissDropdown, scheduleReverseGeocode]
  );

  const recentreTo = useCallback((lat: number, lng: number, nextLabel: string) => {
    reverseReqIdRef.current++;
    if (reverseTimer.current) clearTimeout(reverseTimer.current);
    centreRef.current = { lat, lng };
    setLabel(nextLabel);
    if (!mapRef.current) return;
    labelLockedRef.current = true;
    mapRef.current.animateToRegion({ latitude: lat, longitude: lng, ...ZOOM }, 600);
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

  /** Reset the pin + label to a fresh location (sheet re-open). */
  const reset = useCallback(
    (lat: number, lng: number) => {
      centreRef.current = { lat, lng };
      setLabel(PICKER_FALLBACK_LABEL);
      labelLockedRef.current = false;
      clearSearch();
    },
    [clearSearch]
  );

  const getCentre = useCallback(() => centreRef.current, []);

  return {
    mapRef,
    label,
    search,
    handleRegionChangeComplete,
    handleSelect,
    handleUseCurrentLocation,
    recentreTo,
    reset,
    getCentre,
    ZOOM,
  };
}
```

- [ ] **Step 2: Refactor `FeedLocationSheet.tsx` to consume the hook**

Replace everything from the top-of-component refs/state down through `handleConfirm` with the hook usage. The new component body:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocationPickerMap } from '@/hooks/use-location-picker-map';

export interface FeedLocationSheetProps {
  visible: boolean;
  initialLat: number;
  initialLng: number;
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
  const {
    mapRef,
    label,
    search,
    handleRegionChangeComplete,
    handleSelect,
    handleUseCurrentLocation,
    reset,
    getCentre,
    ZOOM,
  } = useLocationPickerMap(initialLat, initialLng);

  const { query, suggestions, isDropdownVisible, isSearching, hasError, onChangeText } = search;

  // Reset the pin + label to the incoming location each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    reset(initialLat, initialLng);
  }, [visible, initialLat, initialLng, reset]);

  const handleConfirm = useCallback(() => {
    const { lat, lng } = getCentre();
    onConfirm({ lat, lng, label });
    onClose();
  }, [getCentre, label, onConfirm, onClose]);

  return (
    // ...the existing JSX below `return (` is UNCHANGED, except:
    //  - <MapView ... initialRegion={{ latitude: initialLat, longitude: initialLng, ...ZOOM }} />
    //  - the suggestions list maps over `suggestions` and calls handleSelect (unchanged)
    //  - the footer button calls handleConfirm (unchanged)
    // Keep the entire <Modal>…</Modal> markup exactly as it is today.
  );
}
```

**Note:** keep the existing JSX inside `return ( … )` byte-for-byte (header, search field, dropdown, MapView, centre pin, label pill, recenter FAB, footer). Only the imports, the hook wiring, the `reset` effect, and `handleConfirm` change. Delete the now-unused local `ZOOM`/`REVERSE_GEOCODE_DEBOUNCE_MS`/`FALLBACK_LABEL` constants and the inline refs/callbacks that moved into the hook.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `npx eslint hooks/use-location-picker-map.ts components/FeedLocationSheet.tsx`
Expected: no errors.

- [ ] **Step 5: Manual sanity check (feed sheet unchanged)**

Open the app → Discover → tap the location header → the sheet opens, search recenters the map, panning updates the label after ~400ms, "Set location" confirms. Behavior identical to before.

- [ ] **Step 6: Commit**

```bash
git add apps/native/hooks/use-location-picker-map.ts apps/native/components/FeedLocationSheet.tsx
git commit -m "♻️ refactor(native): extract shared location picker map hook"
```

---

## Task 6: Lift `LocationOverrideProvider` to `(app)/_layout` and register the route

**Files:**

- Modify: `apps/native/app/(app)/_layout.tsx`
- Modify: `apps/native/app/(app)/(tabs)/_layout.tsx`

- [ ] **Step 1: Remove the provider from `(tabs)/_layout.tsx`**

In `apps/native/app/(app)/(tabs)/_layout.tsx`, delete the `LocationOverrideProvider` import and unwrap it, leaving `TabBarVisibilityProvider` as the outer wrapper:

```tsx
// remove: import { LocationOverrideProvider } from '@/contexts/location-override-context';

export default function TabsLayout() {
  // ...
  return (
    <TabBarVisibilityProvider>
      <Tabs /* …unchanged… */>{/* …unchanged Tabs.Screen list… */}</Tabs>
    </TabBarVisibilityProvider>
  );
}
```

- [ ] **Step 2: Wrap the Stack in `(app)/_layout.tsx`**

In `apps/native/app/(app)/_layout.tsx`, add the import and wrap the returned `<Stack>` with the provider, and register the new screen:

```tsx
import { LocationOverrideProvider } from '@/contexts/location-override-context';
```

```tsx
return (
  <LocationOverrideProvider>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add-location" options={{ presentation: 'modal' }} />
      <Stack.Screen name="events/create" />
      {/* …rest of the existing Stack.Screen list unchanged… */}
    </Stack>
  </LocationOverrideProvider>
);
```

(Keep every other `Stack.Screen` exactly as it is; only add the `add-location` line and the wrapper.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`add-location` route type is generated on next `expo start`; until then the screen name may show a type warning — acceptable, it regenerates.)

- [ ] **Step 4: Manual sanity check (override still works)**

Open the app → Map and Discover both still read the location override (search a town on the map, switch to Discover — same location). The provider move is transparent.

- [ ] **Step 5: Commit**

```bash
git add "apps/native/app/(app)/_layout.tsx" "apps/native/app/(app)/(tabs)/_layout.tsx"
git commit -m "♻️ refactor(native): lift location override provider to app layout"
```

---

## Task 7: Build the "Add your Location" screen

**Files:**

- Create: `apps/native/app/(app)/add-location.tsx`

Reuses `useLocationPickerMap`. SAVE persists the base location **and** sets the session override for instant reflection, then pops. The centre pin shows the user's avatar (glyph fallback).

- [ ] **Step 1: Create the screen**

Create `apps/native/app/(app)/add-location.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, Text, TextInput, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocationOverride } from '@/contexts/location-override-context';
import { useLocationPickerMap } from '@/hooks/use-location-picker-map';
import { useMe } from '@/hooks/use-me';
import { setBaseLocation } from '@/utils/base-location';
import { IRELAND_INITIAL_REGION } from '@CeolX/shared';

/**
 * "Add your Location" (Figma 1:4479). Reached from the location priming screen's
 * "Select location manually" link. The chosen place becomes the user's persisted
 * base location (used when GPS is unavailable) and is also set as the session
 * override for instant effect on the map/feed.
 */
export default function AddLocationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setOverride } = useLocationOverride();
  const { data: me } = useMe();

  const initialLat = IRELAND_INITIAL_REGION.latitude;
  const initialLng = IRELAND_INITIAL_REGION.longitude;

  const { mapRef, label, search, handleRegionChangeComplete, handleSelect, getCentre, ZOOM } =
    useLocationPickerMap(initialLat, initialLng);

  const { query, suggestions, isDropdownVisible, isSearching, hasError, onChangeText } = search;

  // user.image is OAuth-only; uploaded avatars live on the profile tables. Use
  // whichever is present, else fall back to a pin glyph (spectators have none).
  const avatarUrl = me?.image ?? null;

  const handleSave = useCallback(async () => {
    const { lat, lng } = getCentre();
    const loc = { lat, lng, label };
    await setBaseLocation(loc);
    setOverride(loc);
    router.back();
  }, [getCentre, label, setOverride, router]);

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        className="absolute left-1 z-20 w-12 h-12 rounded-full bg-black/60 items-center justify-center"
        style={{ top: insets.top + 6 }}
      >
        <Ionicons name="arrow-back" size={24} color="#ffffff" />
      </Pressable>

      {/* Title */}
      <Text className="text-white text-[32px] font-semibold font-urbanist mt-12 ml-5">
        Add your Location
      </Text>

      {/* Search field */}
      <View className="px-4 pt-4 z-10">
        <View className="flex-row items-center bg-white rounded-full h-12 px-4 gap-3">
          <Ionicons name="search" size={20} color="#8D8D8D" />
          <TextInput
            className="flex-1 text-black text-[14px] font-urbanist"
            style={{ padding: 0 }}
            placeholder="Search for province or county"
            placeholderTextColor="#8D8D8D"
            value={query}
            onChangeText={onChangeText}
            returnKeyType="search"
            autoCorrect={false}
          />
          {isSearching && <ActivityIndicator size="small" color="#8D8D8D" />}
        </View>

        {isDropdownVisible && (
          <View
            className="absolute left-4 right-4 top-[64px] bg-white rounded-2xl overflow-hidden shadow-lg"
            style={{ elevation: 8 }}
          >
            {hasError ? (
              <Text className="px-4 py-3 text-[13px] text-[#8D8D8D] font-urbanist">
                Couldn't search places. Check your connection.
              </Text>
            ) : suggestions.length === 0 ? (
              <Text className="px-4 py-3 text-[13px] text-[#8D8D8D] font-urbanist">
                No places found.
              </Text>
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
                  <Text className="flex-1 text-[14px] text-black font-urbanist" numberOfLines={2}>
                    {result.address}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        )}
      </View>

      {/* Map + avatar centre pin */}
      <View className="flex-1 mt-4 overflow-hidden">
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{ latitude: initialLat, longitude: initialLng, ...ZOOM }}
          onRegionChangeComplete={handleRegionChangeComplete}
          userInterfaceStyle="dark"
        />

        {/* Fixed centre overlay — non-interactive so map gestures pass through. */}
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          {avatarUrl ? (
            <View className="w-12 h-12 rounded-full border-2 border-[#6155F5] overflow-hidden bg-black">
              <Image source={{ uri: avatarUrl }} className="w-full h-full" resizeMode="cover" />
            </View>
          ) : (
            <Ionicons
              name="location-sharp"
              size={40}
              color="#6155F5"
              style={{ marginBottom: 40 }}
            />
          )}
        </View>
      </View>

      {/* Result card */}
      <View
        className="absolute left-6 right-6 bg-white rounded-xl p-4"
        style={{ bottom: insets.bottom + 16, elevation: 8 }}
      >
        <View className="flex-row items-center gap-3 mb-4">
          <View className="w-9 h-9 rounded bg-[#F0F0F0] items-center justify-center">
            <Ionicons name="location" size={20} color="#6155F5" />
          </View>
          <Text className="flex-1 text-[16px] text-black font-urbanist-medium" numberOfLines={1}>
            {label}
          </Text>
          <Ionicons name="location-outline" size={20} color="#6155F5" />
        </View>

        <View className="flex-row gap-3">
          <Pressable
            onPress={() => router.back()}
            className="flex-1 h-10 rounded-full border border-black items-center justify-center"
          >
            <Text className="text-black text-[14px] font-semibold font-urbanist">CANCEL</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            className="flex-1 h-10 rounded-full bg-[#6155F5] items-center justify-center"
          >
            <Text className="text-white text-[14px] font-semibold font-urbanist">SAVE</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
```

**Implementation notes for the engineer:**

- `useMe()` returns the current user; the avatar field may be `me.image` (OAuth) or a profile-table `profileImageUrl`. Use whichever the `useMe` shape exposes; fall back to the pin glyph when neither is set. Do **not** block the screen on `useMe` loading.
- `font-urbanist-medium` — if that exact class isn't configured, use `font-urbanist` with `font-medium`. Match the project's existing font utility names (grep an existing screen).
- The screen opens centred on Ireland; the user searches or pans to their place. (If you prefer it to open on the current effective location, that coordinate isn't readily available here without the override context value — Ireland-default is the simplest correct starting point and matches "no location yet".)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (route type regenerates on `expo start`).

- [ ] **Step 3: Lint**

Run: `npx eslint "app/(app)/add-location.tsx"`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "apps/native/app/(app)/add-location.tsx"
git commit -m "✨ feat(native): add the add-location screen for manual base location"
```

---

## Task 8: Route "Select location manually" → `/add-location`

**Files:**

- Modify: `apps/native/app/(app)/(tabs)/map/index.tsx`

- [ ] **Step 1: Update the priming `onDone` handler**

In `apps/native/app/(app)/(tabs)/map/index.tsx`, ensure `useRouter` is imported (it likely already is — check the top imports; if not, add `import { useRouter } from 'expo-router';` and `const router = useRouter();` in the component).

Replace the `LocationPermissionScreen` usage:

```tsx
<LocationPermissionScreen onDone={markSeen} insets={insets} />
```

with:

```tsx
<LocationPermissionScreen
  onDone={async (opts) => {
    await markSeen();
    if (opts?.viaManualSelection) router.push('/add-location');
  }}
  insets={insets}
/>
```

This dismisses the priming screen (via `markSeen`, which sets `shownThisSession`) and, on the manual path, opens the Add Location modal instead of the old "focus the map search bar" behavior.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint "app/(app)/(tabs)/map/index.tsx"`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "apps/native/app/(app)/(tabs)/map/index.tsx"
git commit -m "✨ feat(native): route manual location select to the add-location screen"
```

---

## Task 9: Full verification

- [ ] **Step 1: Run the whole native test suite**

Run (from `apps/native/`): `npx vitest run`
Expected: all tests pass, including the new base-location, gps-region, feed-location, and permission-prompt tests.

- [ ] **Step 2: Typecheck + lint the whole app**

Run: `npx tsc --noEmit`
Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 3: Manual QA on a device/simulator**

With the app running (deny GPS when first asked):

1. Map tab → priming screen → "Select location manually" → **Add your Location** screen opens.
2. Search a town (e.g. "Galway") or pan the map → the result card label updates.
3. Tap **SAVE** → returns to the map, now centred on the chosen location (instant, via override).
4. Switch to Discover → same location is reflected.
5. **Kill the app**, then relaunch with **location services OFF** → no priming screen, map opens on the saved location.
6. Relaunch with **location services ON but app permission not granted** → priming screen shows once ("allow your location?"); decline → saved location; grant → live GPS.
7. Relaunch with **app permission granted** → live GPS, no priming.
8. **CANCEL / back** from Add Location persists nothing.
9. Regression: Discover location sheet still works (search, pan, set) exactly as before.

- [ ] **Step 4: Final commit (if any QA fixups were needed)**

```bash
git add -A
git commit -m "✅ test(native): verify manual base location flow end to end"
```

---

## Notes / risks

- **Route type generation:** `add-location` becomes a typed route only after `expo start` regenerates `expo-router`'s types. `router.push('/add-location')` and the `Stack.Screen name="add-location"` may show a transient type complaint before that — acceptable, documented in the spec.
- **`useLocationPickerMap` extraction (Task 5)** has no automated test (the sheet never had one). The risk is the subtle label-lock / stale-request-guard logic; Step 5's manual check is the guard. Keep the extracted code byte-identical to the original logic.
- **Avatar source:** `useMe`'s avatar field name should be confirmed against the hook's actual shape (`image` vs a profile `profileImageUrl`) — the glyph fallback makes a wrong guess degrade gracefully rather than crash.
- **Starting centre of Add Location** is the Ireland default (no location known yet). If product wants it to open on the current IP-resolved point, that's a follow-up — it needs the resolved region threaded into the route.

```

```
