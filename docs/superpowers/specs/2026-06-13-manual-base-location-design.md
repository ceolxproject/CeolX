# Persisted manual base location + "Add your Location" screen

**Date:** 2026-06-13
**Branch:** `feature/event-share-button` (work will move to a dedicated branch)
**Figma:** `Add your Location` — node `1:4479` (file `sIBHy8w0VESlY7O9eEGZos`)
**App:** `apps/native` (React Native + Expo)

## Problem

When a user denies GPS permission and chooses **"Select location manually"** on the
location priming screen, the app today just dismisses the priming screen and focuses
the map's search bar. The manually chosen location is held only in
`LocationOverrideContext`, which is **in-memory and cleared on every cold start**. So a
user who hand-picks their area has to re-pick it every single launch, and is re-prompted
with the priming screen each session.

We want a **persisted base location**: the place a user explicitly sets becomes their
main location and survives app restarts. GPS still wins when it's available, but when GPS
is off we silently use the saved location instead of falling back to coarse IP / Ireland.
Once a base location is saved, the user is not re-prompted — except a single optional
"allow your location?" ask when device location _services_ are on and the OS still permits
a prompt (a chance to upgrade to live GPS); if services are off, we never ask.

## Goals

- "Select location manually" routes the user to a dedicated **"Add your Location"** screen
  matching the Figma design.
- The location chosen there is **persisted** (survives cold start) and used as the base
  location.
- Resolution priority on every launch: **GPS → saved manual → IP → Ireland default**.
- Once a base location is saved, the priming screen is suppressed **unless device
  location _services_ are on and the OS still permits a prompt** — in which case we may
  ask "allow your location?" once per launch to try to upgrade to live GPS. If services
  are off (or app permission is hard-denied), we never ask and silently use the saved
  location.
- Feed/map place-search remains **session-only** (unchanged) — searching elsewhere does
  not overwrite the saved base location.

## Non-goals

- No change to the feed/map place-search UX or to the feed location sheet's visual design.
- No place-photo / Google Places Photos integration (the result card uses a glyph, not a
  photo).
- No change to the venue-profile fallback, IP fallback, or Ireland default behavior.
- No GDPR erasure wiring beyond providing a `clearBaseLocation()` helper for future use.

## Decisions (confirmed)

| Decision                 | Choice                                                                                                                                                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolution priority      | **GPS > saved manual > IP > Ireland** (GPS always wins when a fix is available)                                                                                                                                                                                         |
| Scope of the new UI      | **New dedicated screen** for the permission "Select manually" path only; feed/map keep their current UI                                                                                                                                                                 |
| Centre pin & result card | **User avatar** centre pin (glyph fallback for spectators); **no place photo** — glyph in the card                                                                                                                                                                      |
| Reprompt after save      | Suppress the priming screen once a base location exists, **except** when device location _services_ are on and the OS still allows a prompt — then ask "allow your location?" once per launch to try to upgrade to GPS. Services off / hard-denied → silent (use saved) |
| Override provider        | **Lift `LocationOverrideProvider` to `(app)/_layout`** so the new screen can set the override instantly                                                                                                                                                                 |
| Shared map logic         | **Extract `useLocationPickerMap` hook**; both the new screen and `FeedLocationSheet` consume it (behavior-preserving)                                                                                                                                                   |
| Persistence store        | **`expo-secure-store`** (only persistence lib installed; matches the existing guest-flag pattern)                                                                                                                                                                       |

## Behavior model

### Resolution priority (every launch)

1. **Session override** — a feed/map place-search pick. In-memory, wins for the session,
   never persisted. _Unchanged._
2. **GPS** — permission granted **and** a position is available.
3. **Saved manual base location** (NEW) — from SecureStore.
4. **IP geolocation** — server `/location/ip` proxy.
5. **Ireland default** (53.1424, -7.6921) → optional venue-profile upgrade. _Unchanged._

### Reprompt suppression (services-aware)

Two device toggles matter and are read separately:

- **Device location services** — `Location.hasServicesEnabledAsync()` (no permission
  required). The system-wide on/off.
- **App foreground permission** — `getForegroundPermissionsAsync()` (`status` +
  `canAskAgain`).

A GPS fix needs **both** services on _and_ permission granted. So when a base location is
already saved, the priming decision is:

```
status GRANTED                                          → 'done'  (GPS resolves silently)
not granted AND hasSavedLocation:
    servicesEnabled && canAskAgain && !shownThisSession → 'show'  ("allow your location?")
    else (services off, hard-denied, already asked)     → 'done'  (silent → saved)
not granted AND no saved location                       → existing matrix (unchanged)
```

Rationale: only ask when granting could actually yield a live GPS fix (services on, OS
still allows a prompt). If services are off, asking is pointless — we silently use the
saved location instead. `shownThisSession` caps it at one ask per launch. Whatever the
user does, the resolution chain copes: grant → GPS wins (tier 2); decline → saved (tier
3).

**Denied GPS with no saved location (confirmed: keep status quo).** If the user denies
"Detect my location" and never saves a manual location, there is no stored preference to
honor, so the existing matrix applies: the priming screen re-appears **once per cold
start** (`shownThisSession` resets each launch). The CTA adapts to "Open settings" on a
hard-denial (`canAskAgain === false`), and the "Select location manually" link is always
present. Suppression is deliberately tied to a _positive_ choice (granted permission or a
saved manual location), never to a denial — this preserves a recurring path to set a
location instead of stranding the user on coarse IP/Ireland with no prompt.

## Components

### 1. `utils/base-location.ts` (new) — persistence

```ts
export type BaseLocation = { lat: number; lng: number; label: string };

export async function getBaseLocation(): Promise<BaseLocation | null>;
export async function setBaseLocation(loc: BaseLocation): Promise<void>;
export async function clearBaseLocation(): Promise<void>;
```

- Backed by `expo-secure-store`, key `ceolx.base-location`, value `JSON.stringify(loc)`.
- `getBaseLocation` validates the parsed shape (`lat`/`lng` finite numbers, `label`
  string). Corrupt or legacy data → `null` (never throws to callers).
- Pure persistence; no React. Unit-testable by mocking `expo-secure-store`.

### 2. `hooks/use-gps-region.ts` (edit) — insert the saved tier

- `LocationSource` gains `'saved'`.
- `resolveLocation(setters, baseLocation: BaseLocation | null)`:
  - GPS branch unchanged: granted + `getLastKnownPositionAsync()` returns a fix → `'gps'`.
  - **New:** when no GPS fix is produced (denied, undetermined, or granted-but-no-fix),
    **if `baseLocation` is non-null → set region to its coords, `source = 'saved'`, and
    seed the label**, returning before IP.
  - Otherwise → `resolveViaIp` (unchanged) → Ireland default (unchanged).
- `useGpsRegion` loads the base location once inside the resolution effect:
  `const base = await getBaseLocation(); await resolveLocation(setters, base);`
- The reverse-geocode effect **skips `'saved'`** (the stored label is authoritative); for
  `'saved'`, `placeLabel` is seeded from the stored label so the existing
  `placeLabel ?? sourceLabel()` path surfaces the real place name.
- `applyVenueFallback` still only fires on `'default'` — unaffected.

### 3. `utils/feed-location.ts` (edit)

- `sourceLabel()` gains a `'saved'` case (fallback string only; the real label comes from
  the seeded `placeLabel`). Keeps the `switch` exhaustive over `LocationSource`.

### 4. `hooks/use-location-permission-prompt.ts` (edit) — services-aware reprompt

- `resolvePromptState(status, canAskAgain, shownThisSession, hasSavedLocation, servicesEnabled)`:
  - `status GRANTED` → `'done'`.
  - not granted **and** `hasSavedLocation`:
    `servicesEnabled && canAskAgain && !shownThisSession` → `'show'`, else `'done'`.
  - not granted **and** no saved location → existing matrix.
- The hook awaits `getForegroundPermissionsAsync()` (status + `canAskAgain`),
  `getBaseLocation()`, and `Location.hasServicesEnabledAsync()` before deciding. Render
  `'checking'` until all resolve, to avoid a flash of the priming screen.
- The priming screen, when shown in the saved-location "upgrade" case, may use a softer
  subtitle (e.g. "Allow your location to use live GPS?") — copy detail, non-blocking.

### 5. `hooks/use-location-picker-map.ts` (new) — extracted shared logic

Behavior-preserving extraction of the map+search+reverse-geocode logic currently inline in
`FeedLocationSheet`:

- centre tracking (`centreRef`), live `label` state, 400ms reverse-geocode debounce,
  label-lock (`labelLockedRef`), stale-request guard (`reverseReqIdRef`),
  `handleRegionChangeComplete`, `recentreTo`, `handleSelect` (place pick),
  `handleUseCurrentLocation`, and the `usePlaceSearch` wiring.
- Returns the state + handlers + `mapRef` both surfaces need.
- `FeedLocationSheet` is refactored to consume it — **no visual change**, same behavior.

### 6. New screen `app/(app)/add-location.tsx` — Figma "Add your Location"

- Full-screen black. Layout per Figma node `1:4479`:
  - circular blurred **back button** (top-left) → `router.back()`.
  - **"Add your Location"** title (Urbanist SemiBold ~32px).
  - white **search pill** "Search for province or county" → drives `useLocationPickerMap`
    place search; suggestions dropdown reused from the existing pattern.
  - full-bleed **map** with a fixed centre overlay showing the **user's avatar**
    (`useMe()` profile image) in a purple ring; **fallback to a pin glyph** when no image
    (spectators).
  - bottom white **result card**: place name (the live `label`), sub-label
    (region/country if available), map-pin glyph, and **CANCEL** (outlined) / **SAVE**
    (filled `#6155F5`) buttons.
- **SAVE** → `await setBaseLocation(loc)` + `setOverride(loc)` (instant reflection) →
  `router.back()`.
- **CANCEL / back** → `router.back()`, nothing persisted.
- `loc = { lat, lng, label }` from the picker's current centre + label.

### 7. Wiring

- **Lift** `LocationOverrideProvider` from `(tabs)/_layout` to `(app)/_layout` (wrap the
  `Stack`). All consumers (`map`, `discover`) remain below it; the new `/add-location`
  modal is now also below it.
- Register `add-location` as a `Stack.Screen` in `(app)/_layout` with modal presentation.
- `map/index.tsx`: change the priming `onDone` handler so that on
  `{ viaManualSelection: true }` it calls `markSeen()` and then
  `router.push('/add-location')` — replacing the old "focus the map search bar" behavior
  for the manual path. (`focusSearchOnMount` may be retired for this path.)

## What does not change

- Feed/map place search remains session-only (`setOverride` without persisting).
- `FeedLocationSheet` visual design and the feed header entry point.
- Venue-profile fallback, IP fallback, Ireland default.
- The priming screen's "Detect my location" path.

## Data flow

```
Priming screen (map tab) ── "Select location manually" ──▶ /add-location (modal)
                                                              │
                                          pick place / pan map / use current location
                                                              │  SAVE
                                          setBaseLocation(loc)  +  setOverride(loc)
                                                              │
                                                          router.back()
                                                              ▼
                          map + feed read override immediately (instant)

Next cold start:
  getBaseLocation() ─┐
  GPS permission ────┤─▶ resolveLocation:  GPS fix? ──yes──▶ gps
                     │                         │no
                     │                         ▼
                     └────────────────▶  baseLocation? ──yes──▶ saved (stored label)
                                               │no
                                               ▼
                                          IP ─▶ Ireland default ─▶ (venue upgrade)

  Priming screen (saved location exists):
     GRANTED                                          → done
     services on  + canAskAgain + not-asked-this-run  → show ("allow your location?")
     services off / hard-denied / already-asked       → done (silent → saved)
  Priming screen (no saved location): existing matrix
```

## Testing

- `resolveLocation` (unit): GPS-fix → `gps`; no-fix + saved → `saved`; no-fix + no-saved →
  IP; saved present never overrides a real GPS fix (priority GPS > saved).
- `resolvePromptState` (services-aware): saved present + GRANTED → `'done'`; saved present
  - not-granted + services on + canAskAgain + not-shown → `'show'`; saved present +
    services off → `'done'`; saved present + hard-denied → `'done'`; saved absent → existing
    matrix (granted → done, not-granted + not-shown → show, etc.).
- `base-location`: round-trip set/get; corrupt/legacy JSON → `null`; clear → `null`.
- `resolveFeedLocation` / `sourceLabel`: `'saved'` source surfaces the seeded label, with
  the `'saved'` fallback string when no label.
- Manual QA: deny GPS → manual select → SAVE → kill app →
  - relaunch with **location services OFF** → saved location used, **no priming**.
  - relaunch with **services ON but app permission not granted** → priming "allow your
    location?" shown once; decline → saved location used; grant → live GPS used.
  - relaunch with **app permission granted** → GPS used, no priming.

## Risks / notes

- **Provider lift** changes where `LocationOverrideProvider` mounts. Risk is low — it is a
  pure context provider and every consumer sits under `(app)`. Verify both tabs still read
  the override after the move.
- **`useLocationPickerMap` extraction** must be behavior-preserving for the feed sheet;
  the label-lock / stale-request-guard logic is subtle. Refactor and confirm the feed
  sheet behaves identically before building the new screen on top of it.
- Reaching the new screen requires being on the **map tab** (where the priming screen is
  hosted). That matches today's priming entry point; no new entry surface is introduced.
