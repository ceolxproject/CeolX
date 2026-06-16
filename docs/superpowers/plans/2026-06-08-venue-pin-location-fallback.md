# Venue-pin location fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** For the venue persona, default the Map and Feed to the venue's saved pin (instead of the Ireland centroid) when GPS and IP geolocation both fail.

**Architecture:** Keep the proven `resolveLocation` chain (GPS → IP → Ireland) untouched. Layer a post-resolution override on top: a new `useVenueFallback` hook surfaces the logged-in venue's validated pin from `useMe()`, and `useGpsRegion` accepts it as a second arg — when the chain lands on `'default'` and a pin exists, swap to the pin and tag the source `'venue-profile'`. All real logic lives in two pure, directly-tested functions (`selectVenueFallback`, `applyVenueFallback`); the hooks are thin wrappers, mirroring the existing `resolveLocation`/`useGpsRegion` split.

**Tech Stack:** React Native + Expo, TypeScript, vitest (node env), `@CeolX/shared` validators/enums.

**Spec:** `docs/superpowers/specs/2026-06-08-venue-pin-location-fallback-design.md`

---

## File Structure

| File                                                             | Responsibility                                                                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `apps/native/hooks/use-venue-fallback.ts` _(new)_                | Pure `selectVenueFallback(me)` + thin `useVenueFallback()` hook. Returns the venue's validated pin or `null`.                  |
| `apps/native/hooks/__tests__/use-venue-fallback.test.ts` _(new)_ | Unit tests for `selectVenueFallback`.                                                                                          |
| `apps/native/hooks/use-gps-region.ts` _(modify)_                 | Add `'venue-profile'` source, `venueFallback` param, pure `applyVenueFallback`, override effect, extend reverse-geocode guard. |
| `apps/native/hooks/__tests__/use-gps-region.test.ts` _(modify)_  | Add tests for `applyVenueFallback`; existing `resolveLocation` tests stay green.                                               |
| `apps/native/app/(app)/(tabs)/map/index.tsx` _(modify)_          | Pass `useVenueFallback()` into `useGpsRegion`.                                                                                 |
| `apps/native/app/(app)/(tabs)/discover/index.tsx` _(modify)_     | Pass `useVenueFallback()` into `useGpsRegion`; add `'venue-profile'` to `locationText`.                                        |

**Test command (run from `apps/native/`):** `npx vitest run <path>`

---

## Task 1: `useVenueFallback` hook + pure selector

**Files:**

- Create: `apps/native/hooks/use-venue-fallback.ts`
- Test: `apps/native/hooks/__tests__/use-venue-fallback.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/native/hooks/__tests__/use-venue-fallback.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

// UserRole is a pure const map — provide it directly.
vi.mock('@CeolX/shared/enums', () => ({
  UserRole: { SPECTATOR: 'spectator', ARTIST: 'artist', VENUE: 'venue', ADMIN: 'admin' },
}));

// Real coordinate validation (mirrors packages/shared/src/utils/geo.ts):
// rejects non-numbers, out-of-bounds, and null-island (0,0).
vi.mock('@CeolX/shared', () => ({
  isValidCoordinate: (lat: unknown, lng: unknown) =>
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0),
}));

// Hook depends on useMe — not exercised by the pure-selector tests, but the
// module imports it, so stub it to keep the import graph clean.
vi.mock('@/hooks/use-me', () => ({ useMe: vi.fn() }));

import { selectVenueFallback } from '../use-venue-fallback';

describe('selectVenueFallback', () => {
  it('returns null for a spectator', () => {
    expect(selectVenueFallback({ currentRole: 'spectator' })).toBeNull();
  });

  it('returns null for an artist (even with coords on some other profile)', () => {
    expect(selectVenueFallback({ currentRole: 'artist' })).toBeNull();
  });

  it('returns null for undefined/loading me', () => {
    expect(selectVenueFallback(undefined)).toBeNull();
    expect(selectVenueFallback(null)).toBeNull();
  });

  it('returns null for a venue with no venueProfile coords', () => {
    expect(selectVenueFallback({ currentRole: 'venue', venueProfile: null })).toBeNull();
    expect(
      selectVenueFallback({ currentRole: 'venue', venueProfile: { lat: null, lng: null } })
    ).toBeNull();
  });

  it('returns null for a venue at null-island (0,0)', () => {
    expect(
      selectVenueFallback({ currentRole: 'venue', venueProfile: { lat: 0, lng: 0 } })
    ).toBeNull();
  });

  it('returns the pin for a venue with valid coords', () => {
    expect(
      selectVenueFallback({ currentRole: 'venue', venueProfile: { lat: 53.27, lng: -9.05 } })
    ).toEqual({ latitude: 53.27, longitude: -9.05 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/native/`): `npx vitest run hooks/__tests__/use-venue-fallback.test.ts`
Expected: FAIL — `Failed to resolve import "../use-venue-fallback"` (module does not exist yet).

- [ ] **Step 3: Write the hook + pure selector**

Create `apps/native/hooks/use-venue-fallback.ts`:

```ts
import { useMemo } from 'react';

import { isValidCoordinate } from '@CeolX/shared';
import { UserRole } from '@CeolX/shared/enums';

import { useMe } from '@/hooks/use-me';

export type VenueFallback = { latitude: number; longitude: number } | null;

type MeLike =
  | {
      currentRole?: string | null;
      venueProfile?: { lat?: number | null; lng?: number | null } | null;
    }
  | null
  | undefined;

/**
 * Pure selector — exported for direct testing.
 *
 * Returns the logged-in venue's saved pin, or null. Only the venue persona has
 * a canonical pin; spectators/artists/guests always get null. The coordinate is
 * validated (bounds + null-island rejection) so a bad pin can never drag the
 * map into the Atlantic — it just falls through to the Ireland default.
 */
export function selectVenueFallback(me: MeLike): VenueFallback {
  if (me?.currentRole !== UserRole.VENUE) return null;
  const lat = me.venueProfile?.lat;
  const lng = me.venueProfile?.lng;
  // typeof guard narrows for TS; isValidCoordinate adds bounds + null-island checks.
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!isValidCoordinate(lat, lng)) return null;
  return { latitude: lat, longitude: lng };
}

/**
 * Surfaces the venue's saved pin as a location fallback for the map/feed.
 * Reads the shared `users.me` query cache (no extra request). Stable identity
 * via useMemo so it can sit safely in effect dependency arrays.
 */
export function useVenueFallback(): VenueFallback {
  const { data: me } = useMe();
  return useMemo(
    () => selectVenueFallback(me),
    [me?.currentRole, me?.venueProfile?.lat, me?.venueProfile?.lng]
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `apps/native/`): `npx vitest run hooks/__tests__/use-venue-fallback.test.ts`
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/native/hooks/use-venue-fallback.ts apps/native/hooks/__tests__/use-venue-fallback.test.ts
git commit -m ":sparkles: feat(native): add use-venue-fallback hook for venue pin default"
```

(commit-msg hook requires the gitmoji prefix + fully-lowercase subject + a workspace scope.)

---

## Task 2: `applyVenueFallback` + override in `useGpsRegion`

**Files:**

- Modify: `apps/native/hooks/use-gps-region.ts`
- Test: `apps/native/hooks/__tests__/use-gps-region.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/native/hooks/__tests__/use-gps-region.test.ts` (after the existing `describe('resolveLocation', ...)` block). Note `applyVenueFallback` is added to the existing import on line 42:

Change line 42 from:

```ts
import { resolveLocation } from '../use-gps-region';
```

to:

```ts
import { applyVenueFallback, resolveLocation } from '../use-gps-region';
```

Then append:

```ts
describe('applyVenueFallback', () => {
  const pin = { latitude: 53.27, longitude: -9.05 };

  it('upgrades the Ireland default to the venue pin', () => {
    expect(applyVenueFallback('default', pin)).toEqual({
      region: { latitude: 53.27, longitude: -9.05, latitudeDelta: 0.5, longitudeDelta: 0.5 },
      source: 'venue-profile',
    });
  });

  it('does not override a live GPS fix', () => {
    expect(applyVenueFallback('gps', pin)).toBeNull();
  });

  it('does not override an IP fix', () => {
    expect(applyVenueFallback('ip', pin)).toBeNull();
  });

  it('does nothing while resolution is pending', () => {
    expect(applyVenueFallback('pending', pin)).toBeNull();
  });

  it('does nothing once already on the venue pin (no re-fire loop)', () => {
    expect(applyVenueFallback('venue-profile', pin)).toBeNull();
  });

  it('returns null when there is no venue pin', () => {
    expect(applyVenueFallback('default', null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `apps/native/`): `npx vitest run hooks/__tests__/use-gps-region.test.ts`
Expected: FAIL — `applyVenueFallback` is not exported (`"applyVenueFallback" is not exported by "../use-gps-region.ts"`).

- [ ] **Step 3: Add the type, pure function, and override effect**

In `apps/native/hooks/use-gps-region.ts`:

(a) Extend the `LocationSource` union (line 14):

```ts
export type LocationSource = 'gps' | 'ip' | 'default' | 'pending' | 'venue-profile';
```

(b) Add the pure function immediately after the `resolveViaIp` function (after line 119, before the `useGpsRegion` jsdoc). `GPS_ZOOM` and `MapRegion` are already defined above in the file:

```ts
/**
 * Decide whether a resolved location should be upgraded to the venue pin.
 * Pure — exported for testing.
 *
 * Only fires when the chain landed on the Ireland `'default'` (both GPS and IP
 * failed) AND a venue pin is available. GPS/IP/pending are never overridden, and
 * once the source is already `'venue-profile'` it returns null so the override
 * effect can't loop.
 */
export function applyVenueFallback(
  locationSource: LocationSource,
  venueFallback: { latitude: number; longitude: number } | null
): { region: MapRegion; source: LocationSource } | null {
  if (locationSource !== 'default' || !venueFallback) return null;
  return {
    region: { ...venueFallback, ...GPS_ZOOM },
    source: 'venue-profile',
  };
}
```

(c) Change the `useGpsRegion` signature to accept the fallback. Replace the signature line (currently `export function useGpsRegion(enabled = true): GpsRegionResult {` near line 127) with:

```ts
export function useGpsRegion(
  enabled = true,
  venueFallback: { latitude: number; longitude: number } | null = null
): GpsRegionResult {
```

(d) Add the override effect. Insert it directly AFTER the first `useEffect` (the one that calls `resolveLocation`, ending at line 142) and BEFORE the reverse-geocode `useEffect`:

```ts
// Venue-only upgrade: if the chain bottomed out at the Ireland default and we
// have the venue's saved pin, recenter on it. Self-heals if `useMe()` resolves
// after the chain (Ireland → pin). Keyed on the pin's coords, not object
// identity, so a fresh-but-equal fallback object won't re-fire.
useEffect(() => {
  const upgrade = applyVenueFallback(locationSource, venueFallback);
  if (!upgrade) return;
  setInitialRegion(upgrade.region);
  setLocationSource(upgrade.source);
  setMapKey((k) => k + 1);
}, [locationSource, venueFallback?.latitude, venueFallback?.longitude]);
```

(e) Extend the reverse-geocode guard so the venue pin also gets a place label. Replace the guard at the top of the reverse-geocode effect (currently `if (locationSource !== 'gps' && locationSource !== 'ip') {`) with:

```ts
    if (
      locationSource !== 'gps' &&
      locationSource !== 'ip' &&
      locationSource !== 'venue-profile'
    ) {
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `apps/native/`): `npx vitest run hooks/__tests__/use-gps-region.test.ts`
Expected: PASS — all original `resolveLocation` tests plus the 6 new `applyVenueFallback` tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/native/hooks/use-gps-region.ts apps/native/hooks/__tests__/use-gps-region.test.ts
git commit -m ":sparkles: feat(native): upgrade ireland default to venue pin in location chain"
```

---

## Task 3: Wire the Map screen

**Files:**

- Modify: `apps/native/app/(app)/(tabs)/map/index.tsx`

- [ ] **Step 1: Add the import**

After the existing `useGpsRegion` import (line 29), add:

```ts
import { useVenueFallback } from '@/hooks/use-venue-fallback';
```

- [ ] **Step 2: Pass the fallback into `useGpsRegion`**

Replace the current call (lines 47-50):

```ts
const { promptState, markSeen } = useLocationPermissionPrompt();
const { initialRegion, gpsPermissionGranted, locationSource, mapKey } = useGpsRegion(
  promptState === 'done'
);
```

with:

```ts
const { promptState, markSeen } = useLocationPermissionPrompt();
const venueFallback = useVenueFallback();
const { initialRegion, gpsPermissionGranted, locationSource, mapKey } = useGpsRegion(
  promptState === 'done',
  venueFallback
);
```

- [ ] **Step 3: Type-check**

Run (from `apps/native/`): `npx tsc --noEmit`
Expected: PASS — no type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/native/app/\(app\)/\(tabs\)/map/index.tsx
git commit -m ":sparkles: feat(native): default venue map to venue pin"
```

---

## Task 4: Wire the Discover/Feed screen

**Files:**

- Modify: `apps/native/app/(app)/(tabs)/discover/index.tsx`

- [ ] **Step 1: Add the import**

Near the other `@/hooks` imports, add:

```ts
import { useVenueFallback } from '@/hooks/use-venue-fallback';
```

- [ ] **Step 2: Pass the fallback into `useGpsRegion`**

Replace the current call (line 58):

```ts
const { initialRegion, locationSource, placeLabel } = useGpsRegion();
```

with:

```ts
const venueFallback = useVenueFallback();
const { initialRegion, locationSource, placeLabel } = useGpsRegion(true, venueFallback);
```

(`true` keeps the existing always-enabled behavior; Discover has no permission-priming gate.)

- [ ] **Step 3: Add the venue-profile label**

Replace the `locationText` block (the `placeLabel ?? (...)` expression):

```ts
const locationText =
  placeLabel ??
  (locationSource === 'gps'
    ? 'Current Location'
    : locationSource === 'ip'
      ? 'Approximate Location'
      : 'Ireland');
```

with:

```ts
const locationText =
  placeLabel ??
  (locationSource === 'gps'
    ? 'Current Location'
    : locationSource === 'ip'
      ? 'Approximate Location'
      : locationSource === 'venue-profile'
        ? 'Your venue'
        : 'Ireland');
```

(`placeLabel` — the reverse-geocoded town — wins once it resolves; `'Your venue'` is the brief interim before that.)

- [ ] **Step 4: Type-check**

Run (from `apps/native/`): `npx tsc --noEmit`
Expected: PASS — no type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/native/app/\(app\)/\(tabs\)/discover/index.tsx
git commit -m ":sparkles: feat(native): default venue feed to venue pin"
```

---

## Task 5: Final verification

- [ ] **Step 1: Run the full hooks test suite**

Run (from `apps/native/`): `npx vitest run hooks/`
Expected: PASS — entire hooks suite green (new tests + untouched `resolveLocation` tests prove the chain wasn't disturbed).

- [ ] **Step 2: Type-check the whole app**

Run (from `apps/native/`): `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Lint the touched files**

Run (from `apps/native/`): `npx eslint hooks/use-venue-fallback.ts hooks/use-gps-region.ts "app/(app)/(tabs)/map/index.tsx" "app/(app)/(tabs)/discover/index.tsx"`
Expected: PASS — no lint errors.

---

## Manual smoke test (device — not automatable here)

Logged in as a **venue** whose profile pin is e.g. Galway, with location permission **denied** (forces IP→default path; if IP also resolves to Ireland-wide, the pin still wins over the centroid):

1. Open **Map** → it centers on the venue's town, not the midlands centroid; the events fetch/auto-expand is anchored there.
2. Open **Discover/Feed** → the location chip shows the venue's town (briefly "Your venue" before reverse-geocode resolves); feed results are anchored to the pin.
3. Log in as a **spectator/artist** with permission denied → behavior unchanged (Ireland default).
4. Grant GPS → live location wins for all personas (pin is ignored).

## Out of scope (per spec)

- Venue pin overriding a live GPS fix.
- Any change to spectator/artist/guest behavior.
- Server-side `getFeed` radius logic.
