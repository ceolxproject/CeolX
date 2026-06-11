# Map Place Search — Design

**Date:** 2026-06-11
**Author:** Priya Yadav
**Status:** Approved for planning
**Related:** Asana `1215453202861550` ([P1][Functional] Events disappear from Map view after searching a non-county location and returning from Discover)

## Problem

The Map view's search box only matches a hardcoded list of Irish counties (`useCountySearch` → `IRISH_COUNTIES`). Two failures result:

1. **No place navigation.** Typing a venue/landmark/town that is not a county name (e.g. "Leisureland" in Salthill, Galway) does nothing — the map never moves, because only a county _selection_ calls `animateToRegion` (`map/index.tsx:194` `handleCountySelect`).
2. **Pins vanish.** Every keystroke is _also_ fanned out to `onSearch(text)` → `useMapEvents`, which sets `searchQuery` and pushes it as a **Typesense full-text filter** on events within the current viewport. A non-matching term like "Leisureland" returns 0 events → all pins disappear. Navigating to Discover and back keeps the stale filter applied, so the map stays empty — the Asana P1 bug.

The search is effectively half-built: it filters event _content_ but cannot navigate to a _place_.

## Goal

Make the map search box a **place/location search**: typing a place, venue, town, or county shows live suggestions; selecting one flies the map there and loads events nearby. The box answers **"where"**. Content filtering (category, county) already lives in the Filter sheet and answers **"what"** — unchanged.

Selected by the user during brainstorming:

- **Search intent:** Place search (move map). The box drives map position only; it no longer sets a Typesense text filter.
- **Suggestions:** Live autocomplete dropdown as the user types.
- **Zoom on select:** Town/neighbourhood level (`latitudeDelta ≈ 0.15`) so nearby events are visible, not a tight street-level view.

## Chosen approach

**Reuse the existing `/location/geocode` endpoint, debounced as live autocomplete.**

The server endpoint (`apps/server/src/routes/location.ts:103`) already proxies **Google Places Text Search (New)**, biased to Ireland (`regionCode: 'IE'`), with the API key held server-side only. It already:

- Resolves venue/POI names like "Leisureland" (not just addresses).
- Returns **multiple** results, each `{ lat, lng, address }`, with a human label built by `buildLocationLabel` ("Leisureland, Upper Salthill Rd, Galway, Ireland").

Because each result already carries coordinates, there is **no second network call on selection** and **no new server endpoint** is needed. We debounce calls to this endpoint as the user types and render `results[]` as the dropdown.

### Rejected alternatives

- **Dedicated Places Autocomplete + Place Details endpoints (session tokens).** Cheaper per-call at scale but adds two server endpoints and a two-step selection flow. Overkill at the <1,000-user launch scale; revisit only if Google billing climbs.
- **Client-side Places SDK.** Rejected — would ship the Google key in the app, contradicting the deliberate server-side-key architecture in `utils/geocode.ts`.

## Components

### 1. `usePlaceSearch` hook (new — replaces `useCountySearch`)

Keeps the same public shape so the screen rewiring is minimal:

```ts
{
  query: string;
  suggestions: GeocodeResult[];   // { lat, lng, address }
  isDropdownVisible: boolean;
  isSearching: boolean;           // new — drives a small spinner in the dropdown
  onChangeText: (text: string) => void;
  dismissDropdown: () => void;
  clearSearch: () => void;
  commitSelection: (label: string) => void;
}
```

- `onChangeText` debounces (~300 ms; longer than county's 150 ms because each call is a network round-trip) then calls `geocodeAddress(text)` from `utils/geocode.ts`.
- **Stale-response guard:** track the latest request (incrementing id or AbortController); ignore results from a superseded request so a slow early response can't overwrite a newer one.
- Empty input clears suggestions and hides the dropdown immediately (no network call).
- `geocodeAddress` throws on network/timeout/server error and returns `[]` for "no match" — the hook distinguishes these: `[]` → show empty state; throw → set an error flag the screen surfaces as a non-blocking toast (pins are never cleared on a failed place search).

### 2. `map/index.tsx` rewiring

- **Remove the `onSearch(text)` fan-out** in `handleSearchChangeText`. The box no longer feeds `useMapEvents.searchQuery`. This eliminates the Typesense text filter that emptied the map (fixes the "pins vanish" symptom and Asana `1215453202861550`).
- Replace `useCountySearch` with `usePlaceSearch`.
- `handlePlaceSelect(result: GeocodeResult)`:
  - `mapRef.current.animateToRegion({ latitude: result.lat, longitude: result.lng, latitudeDelta: 0.15, longitudeDelta: 0.15 }, 800)`
  - `commitSelection(result.address)` (keep the chosen label in the box, close dropdown, cancel pending debounce).
  - Events load automatically: `animateToRegion` settles → existing `onRegionChangeComplete` → debounced viewport bbox query. Silent auto-expand (5/25/100 km) covers sparse areas.

### 3. Suggestions dropdown (generalise `CountySuggestionsDropdown`)

- Render the `address` label per row with a location-pin icon.
- Empty state: "No places found — try a town or county."
- Loading: small spinner / "Searching…" row while `isSearching`.
- Tapping a row → `handlePlaceSelect`.

### 4. Unchanged

- Filter sheet (`MAP_FILTER_SECTIONS`: Category, County) — county/category filtering stays here.
- `useMapEvents` viewport query and silent auto-expand — untouched (we only stop feeding it a text filter from the search box).
- Server endpoints (`/location/geocode`, etc.) — untouched.

## Data flow

```
type "Leisure…"
  → usePlaceSearch.onChangeText (debounce 300ms, stale-guard)
    → geocodeAddress() → GET /location/geocode?q=…
      → Google Places Text Search (New), regionCode IE
    → suggestions = [{lat,lng,address}, …]  → dropdown
tap "Leisureland, Salthill, Galway"
  → animateToRegion(lat,lng, delta 0.15)
  → commitSelection(label)
  → onRegionChangeComplete → useMapEvents viewport query → pins for nearby events
    → (0 results) silent auto-expand 5 → 25 → 100 km
```

## Error handling

| Case                         | Behaviour                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| Empty query                  | Clear suggestions, hide dropdown, no network call                                                       |
| No match (`results: []`)     | Dropdown empty state; map unchanged; pins unchanged                                                     |
| Network/timeout/server error | Non-blocking toast ("Couldn't search — check your connection"); dropdown hidden; **pins never cleared** |
| Rapid typing                 | Debounce + stale-response guard; only the latest query's results render                                 |
| Selection                    | No extra network call (coords already in the result)                                                    |

## Testing

- **`usePlaceSearch` unit tests** (mirror `use-county-search.test.ts`): debounce fires once; empty input short-circuits without a network call; stale response is ignored when a newer query has resolved; `[]` → empty state vs thrown error → error flag; `commitSelection` cancels pending debounce.
- **`map/index.tsx`:** selecting a suggestion calls `animateToRegion` with the result coords and `latitudeDelta 0.15`; the search box no longer calls `onSearch`/sets a Typesense text filter (regression guard for the disappearing-pins bug).
- **Manual:** reproduce the Asana steps — search "Leisureland", go to Discover, return → pins still present; selecting a venue flies the map and shows nearby events.

## Out of scope

- Dedicated Places Autocomplete API with session tokens (cost optimisation for later).
- Searching by artist or event title from this box (that is content filtering — stays in Discover / Filter sheet).
- Saving recent searches / search history.
