# Map ↔ Feed Location Sync — Design

**Date:** 2026-06-12
**Author:** Priya Yadav
**Status:** Approved (design)
**Related:** spun off Asana 1215649892152253 (manual-location UX on permission screen)

## Problem

The Map and Feed (Discover) tabs each resolve location independently:

- **Feed** owns `locationOverride: FeedLocation | null` as local `useState` in
  `app/(app)/(tabs)/discover/index.tsx`, layered over the GPS/IP fallback by
  `resolveFeedLocation()`. The `FeedLocationSheet` confirm writes it.
- **Map** (`app/(app)/(tabs)/map/index.tsx`) has **no persistent location state**.
  A place-search selection imperatively `animateToRegion`s; the "current" location
  is the live, ephemeral `region` produced by panning. GPS drives `initialRegion`.

Result: searching a place on the Map does not affect the Feed, and setting a
location on the Feed does not move the Map. Users expect "I searched Galway on the
Map → my Feed shows Galway," and the reverse.

## Decisions (locked)

1. **Sync trigger — intentional picks only.** The shared location updates only on a
   deliberate choice: a place-search selection on the Map, or the Feed sheet's
   confirm / "use current location". **Free map panning never updates it** (no Feed
   refetch churn while exploring the map).
2. **Persistence — session only.** The shared location lives in memory for the app
   session. A cold start clears it and returns to the GPS/IP fallback. Matches the
   map's existing "ask for permission once per session" model and avoids stranding a
   user on a stale city.

## Approach

A small **`LocationOverride` React Context** — matches the existing context pattern
(`auth-context`, `tab-bar-visibility-context`, `app-theme-context`) and is
session-scoped by construction (in-memory `useState`).

We are **promoting the Feed's existing `locationOverride` state out of the screen
into a shared context** that the Map also reads and writes. The Feed barely changes;
the Map gains one read and one write.

Why the nullable override is the right shape: `null` = "no manual choice, use GPS/IP."
A cold start = fresh context = `null` = back to GPS, for free — no clear logic, no
stale-location cleanup. (Persistence would have required an explicit GPS escape hatch;
session-scope gets it by construction.)

Alternatives rejected:

- **React Query cache** — not server data; wrong semantics, fights invalidation.
- **Module singleton + subscribe hook** — more custom plumbing than Context for no gain.

## Components

### New: `contexts/location-override-context.tsx`

- State: `override: FeedLocation | null` via `useState` (in-memory, session-scoped).
- API: `useLocationOverride()` → `{ override, setOverride }`.
- Single purpose: be the source of the user's chosen location. Knows nothing about
  maps, feeds, or GPS.
- Reuses the existing `FeedLocation = { lat; lng; label }` type from
  `utils/feed-location.ts`.
- Mounted in `app/(app)/_layout.tsx` (scoped to the authenticated tabs).

### New: `resolveMapInitialRegion(override, gpsRegion)` helper

- Pure function: returns an initial `Region` centred on `override` (with a default
  zoom delta) when present, else `gpsRegion`. The one easily unit-testable seam.
- Lives alongside the map hooks (e.g. `hooks/use-gps-region.ts` or a small util).

### Edit: `app/(app)/(tabs)/discover/index.tsx`

- Remove `const [locationOverride, setLocationOverride] = useState(null)`.
- `const { override, setOverride } = useLocationOverride()`.
- `handleLocationConfirm(loc)` → `setOverride(loc)`.
- `resolveFeedLocation(override, …)` and `FeedLocationSheet` unchanged.

### Edit: `app/(app)/(tabs)/map/index.tsx`

- **Write (Map → store):** in `handlePlaceSelect`, after `animateToRegion`, call
  `setOverride({ lat: result.lat, lng: result.lng, label: result.address })`.
  Free panning (`handleRegionChangeComplete`) does **not** write — it keeps driving
  local `region` for clustering only.
- **Read (store → Map):**
  - _Cold mount:_ `initialRegion = resolveMapInitialRegion(override, gpsRegion)`.
  - _Already-mounted map regains focus:_ a `useFocusEffect` animates to `override`
    when it differs from the last-applied value (tracked via a ref). The place-select
    write updates that same ref so it does not double-animate. This is what makes the
    Feed→Map direction work while the map tab is already mounted (tabs keep it
    mounted, so `initialRegion` alone won't re-apply).

## Data flow

```
   Map place-select ──setOverride──┐
                                   ▼
   Feed sheet confirm ─setOverride─►  LocationOverrideContext
   Feed "use current" ─setOverride─►   override:{lat,lng,label}|null
                                   │     (in-memory, session)
   Map focus/mount ◄─center to─────┤
   Feed query lat/lng ◄─resolve────┘
```

## Error / edge handling

- `override === null` → both screens fall back to GPS/IP exactly as today.
- Map free-pan keeps driving local `region` (clustering); it never writes the override.
- Reverse-geocode / label failures are already handled per-screen; the label is
  best-effort and never blocks a location choice.
- Focus-animate is guarded by a last-applied ref so re-focusing the Map without a
  location change does not re-animate or fight the user's panning.

## Testing

- **Unit:** `resolveMapInitialRegion` (override-wins vs gps-fallback).
  `resolveFeedLocation` already covered by `utils/__tests__/feed-location.test.ts`.
- **Manual / on-device:** Map search → Feed reflects it; Feed sheet set → Map centers
  on tab switch; cold start returns to GPS; map panning does not move the Feed.

## Scope / shipping

- No backend, schema, or native-module changes. **OTA-shippable** via `eas update`.
- New feature → its own `feature/` branch, PR base `development`.
