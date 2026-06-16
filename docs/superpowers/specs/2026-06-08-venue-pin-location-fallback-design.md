# Venue-pin location fallback — Design

**Date:** 2026-06-08
**Branch:** `feature/venue-pin-location-fallback`
**Scope:** Native app (Map + Discover default-center logic)

## Problem

The location resolution chain ends in the Ireland centroid (`53.1424, -7.6921`) — a
geographically central but meaningless fallback. For the **venue** persona we hold a
reliable, mandatory coordinate (the venue map pin captured at onboarding), which is a
strictly better "home base" than the country centroid.

## Behavior (approved)

For the **venue** persona only, the fallback chain becomes:

```
GPS (granted + cached pos)  →  IP geolocation  →  VENUE PIN  →  Ireland centroid
```

- The venue pin replaces the Ireland centroid as the terminal fallback — reached only
  when both live signals (GPS, IP) fail.
- Spectators, artists, and guests are unaffected: they have no venue pin, so the chain
  is byte-for-byte identical to today.
- Applies to **both** Map (`map/index.tsx`) and Discover (`discover/index.tsx`), since
  both consume `useGpsRegion`.
- When centered on the pin, the location badge **reverse-geocodes** the pin (reusing the
  existing effect) so the venue sees e.g. "Galway", consistent with the GPS/IP labels.

### Decisions

- **Chain order:** venue pin sits _after_ IP (replaces Ireland), not before IP.
  Conservative — live signals always win; the pin only beats the meaningless centroid.
- **Pin label:** reverse-geocode the pin (reuse existing `reverseGeocodeAsync` effect),
  not a static "Your venue" string.

## Architecture — Option A: post-resolution override

`resolveLocation()` is a standalone, unit-tested async function taking setters. Venue
coords come from `useMe()` (React Query) and may not be loaded when the chain runs on
mount. Option A keeps `resolveLocation()` **untouched** and layers the venue logic on top:

- Add `'venue-profile'` to the `LocationSource` union.
- `useGpsRegion(enabled, venueFallback?: { latitude: number; longitude: number } | null)`.
- New effect in `useGpsRegion`: when `locationSource === 'default'` **and** `venueFallback`
  is present, swap region → pin (`+ GPS_ZOOM`), source → `'venue-profile'`, bump `mapKey`.
  This self-heals when `useMe()` resolves late (Ireland → pin upgrade).
- Extend the reverse-geocode effect guard to include `'venue-profile'`.

**Trade-off accepted:** a venue with no GPS + failed IP may see a sub-second Ireland frame
before the upgrade. Harmless — the map query is gated on `locationSource !== 'pending'`,
and the swap is an in-memory state update. Worth it to keep `resolveLocation` pure and its
tests green.

Rejected **Option B** (pass fallback into the resolver): no flash, but complicates the pure
function, forces `venueFallback` into effect deps (risking a full GPS/IP re-run on late
`useMe` load), and disturbs the existing test surface.

## Components & changes

| File                                  | Change                                                                                                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks/use-gps-region.ts`             | Add `'venue-profile'` to `LocationSource`; new `venueFallback` param; override effect; extend reverse-geocode guard.                                                    |
| `hooks/use-venue-fallback.ts` _(new)_ | Reads `useMe()`; returns `{ latitude, longitude } \| null`. Coerces string coords via `Number()`, validates with `isValidCoordinate`, gates on `currentRole === venue`. |
| `app/(app)/(tabs)/map/index.tsx`      | Read `useVenueFallback()`, pass into `useGpsRegion`.                                                                                                                    |
| `app/(app)/(tabs)/discover/index.tsx` | Same; add `'venue-profile'` to the `locationText` mapping (falls through to `placeLabel`).                                                                              |

### Coercion note

`venueProfile.lat/lng` originate from Postgres numeric columns, which Drizzle returns as
**strings**. They MUST be `Number()`-coerced and validated with the existing
`isValidCoordinate` (rejects null-island `0,0`) before use, or the map jumps to the ocean.

## Data flow

```
useMe() ──► use-venue-fallback ──► { lat, lng } | null
                                         │
              useGpsRegion(enabled, venueFallback)
                                         │
   resolveLocation (untouched): GPS → IP → 'default'
                                         │
   override effect: source==='default' && venueFallback
                          ├─ yes → region = pin, source = 'venue-profile'
                          └─ no  → stays Ireland 'default'
                                         │
              reverse-geocode (gps|ip|venue-profile) → placeLabel
                                         │
                   Map center / Feed geopoint + label badge
```

## Testing

- **`resolveLocation`** — unchanged; existing tests stay green (proof Option A didn't
  disturb the chain).
- **`use-venue-fallback`** — null for spectator/artist/guest; coerced numbers for venue
  with string coords; null for invalid / null-island coords.
- **`useGpsRegion` override** — `'default'` + `venueFallback` → region becomes pin, source
  becomes `'venue-profile'`; GPS/IP success → pin ignored; late-arriving fallback upgrades
  Ireland → pin.

## Out of scope

- Venue pin overriding GPS (live "where am I now" still wins). Could revisit if requested.
- Any change to spectator/artist/guest behavior.
- Server-side `getFeed` radius logic (unchanged).
