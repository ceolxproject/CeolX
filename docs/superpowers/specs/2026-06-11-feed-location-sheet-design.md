# Discovery Feed — Location Sheet (Search + Map Picker) + Venue Fallback

**Date:** 2026-06-11
**Asana:** [Discovery feed location fallback + location search/picker](https://app.asana.com/1/1194107417268910/project/1210959953917909/task/1215480182041114)
**Source MOM:** 05/06/26 CeolX DSM — "compact search-based approach" agreed.

## Problem

Events created far from the Ireland-centre fallback point are invisible on the Discovery feed because there is no way to change the feed's location on the feed screen. The feed always queries a 100 km radius around a location that, for a denied-GPS user, defaults to Ireland centre (53.1424, -7.6921).

## Scope

1. **Venue-saved location fallback** — when GPS permission is denied, a signed-in venue lands on their saved venue pin instead of Ireland centre.
2. **Location sheet in the feed header** — a bottom sheet with a Places search field and a map picker, opened from the existing location chip.
3. **Map picker** — set the feed's location by panning a map (fixed centre pin) or searching a place; on confirm, the feed re-queries around that point.

Out of scope: showing live event pins inside the sheet's map (the Map tab remains the pin-browsing surface); any backend schema/router changes; radius selection.

## Decisions (locked during brainstorm)

- **Trigger:** the existing location chip (`onLocationPress` — location text + chevron at `FeedHeader.tsx:45`). No new header UI.
- **Surface:** a slide-up React Native `Modal` (~88% screen height) matching the existing `FilterSheet` pattern — **not** `@gorhom/bottom-sheet`. Rationale: a draggable gorhom sheet's pan gesture conflicts with the map's own pan gesture. The sheet is dismissed via the grab handle, backdrop tap, or close — not by dragging over the map.
- **Map picker pattern:** **fixed centre pin** — the pin is locked to the screen centre and the user pans the _map_ underneath it. Confirm reads `region.center`. (Chosen over a draggable pin: easier one-handed, finger never occludes the target, simpler state.)
- **Pure picker, not an event map:** the sheet's map sets a point only. On confirm the **feed list** re-queries around it.
- **Search:** reuses the same `usePlaceSearch()` + `geocodeAddress()` stack the Map screen uses. Selecting a suggestion animates the map to the place.
- **Address label:** reuses the existing `reverseGeocode(lat, lng)` helper (`utils/geocode.ts:52`), debounced as the map region settles, for both the live in-map label and the post-confirm chip text.

## Architecture

### New component — `apps/native/components/FeedLocationSheet.tsx`

A controlled `Modal` sheet. Props:

```ts
interface FeedLocationSheetProps {
  visible: boolean;
  /** Map's initial centre when the sheet opens (current effective location). */
  initialLat: number;
  initialLng: number;
  /** Resolve the device's GPS location for the "Use my current location" action. */
  onUseCurrentLocation: () => Promise<{ lat: number; lng: number } | null>;
  /** User confirmed a location. */
  onConfirm: (loc: { lat: number; lng: number; label: string }) => void;
  onClose: () => void;
}
```

Internals:

- `react-native-maps` `MapView` with `onRegionChangeComplete` → store `region.center`.
- Fixed centre pin overlay (absolute-positioned `View`, not a map `Marker`) + centre dot.
- `usePlaceSearch()` drives the search field; `PlaceSuggestionsDropdown` (existing) renders suggestions over the map. On select → `animateToRegion(place)` + `commitSelection(place.address)`; the selected address becomes the pending label.
- Debounced `reverseGeocode(center)` on region settle → live address label. When the user pans away from a searched place, the label switches to the reverse-geocoded value.
- 🎯 recenter-to-GPS button → calls `onUseCurrentLocation()` → `animateToRegion`.
- Footer primary button "Set location · show events here" → `onConfirm({ lat, lng, label })` using the current map centre + best-known label, then `onClose()`.
- "Use my current location" link → recenter + (optionally) immediately confirm to GPS.

### Modified — `apps/native/hooks/use-feed-events.ts`

Make location reactive. Today `lat`/`lng` arrive as static opts. Change:

- Hold the effective location in state (seeded from the opt values).
- Add `setLocation(lat: number, lng: number)` that updates the location **and** resets `offset` + accumulated events — identical reset semantics to the existing `onSearch` / `onCategoryChange` / `onDateChange` callbacks.
- `queryInput` reads the reactive `lat`/`lng`.
- Return `setLocation` from the hook.

No change to `feedQuerySchema` or `getFeed` — they already accept and use `lat`/`lng`.

### Modified — `apps/native/app/(app)/(tabs)/discover/index.tsx`

- Own an **effective location** `{ lat, lng, label }` in screen state, seeded from `useGpsRegion`.
- Add `sheetVisible` state; `onLocationPress` → `setSheetVisible(true)`.
- Render `<FeedLocationSheet>` with the effective location.
- On sheet `onConfirm` → update effective location, call `feed.setLocation(lat, lng)`, set the chip label.
- Pass `effectiveLocation.label` to `FeedHeader` `locationText`.

### Modified (verify) — venue fallback

`useGpsRegion` already accepts a `venueFallback`. Verify the `discover` screen passes the signed-in venue's saved pin, so a denied-GPS venue resolves to their venue location rather than Ireland centre. If not wired, wire it.

## Data Flow

```
useGpsRegion (GPS → IP → venueFallback → Ireland)
        │  initial { lat, lng, label }
        ▼
discover screen: effectiveLocation state ──► useFeedEvents(lat, lng) ──► getFeed (100km radius)
        ▲                                                                      │
        │ onConfirm({lat,lng,label})                                           ▼
   FeedLocationSheet  ◄── search (geocodeAddress) / pan (region.center) / GPS  feed list
        │
        └─ reverseGeocode(center) → live label
```

## Reuse Map

| Need                                 | Existing asset                                                         |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Forward place search + debounce      | `usePlaceSearch()` (`hooks/use-place-search.ts`)                       |
| Geocode a query → coords             | `geocodeAddress()` (`utils/geocode.ts:30`)                             |
| Coords → address label               | `reverseGeocode()` (`utils/geocode.ts:52`)                             |
| Suggestions dropdown UI              | `PlaceSuggestionsDropdown` (`components/PlaceSuggestionsDropdown.tsx`) |
| Sheet-as-Modal pattern + theming     | `FilterSheet` (`components/FilterSheet.tsx`)                           |
| Location resolution + fallback chain | `useGpsRegion` (`hooks/use-gps-region.ts`)                             |
| Map view                             | `react-native-maps` (used by Map screen)                               |

## Edge Cases & Error Handling

- **Search throws / network error:** `usePlaceSearch` already surfaces `hasError`; show the existing "couldn't search places" state in the dropdown. The map + pan path still works.
- **`reverseGeocode` returns `null`:** fall back to a neutral label (e.g. "Selected location"); never block confirm.
- **GPS denied when "Use my current location" tapped:** `onUseCurrentLocation` resolves `null` → keep the current map centre, optionally show a brief "Location unavailable" note. Do not crash or silently no-op without feedback.
- **Confirm with no movement:** confirming the initial centre is valid (re-confirms current location).
- **Rapid pan:** debounce `reverseGeocode` (reuse the place-search debounce cadence) to avoid request spam; ignore stale responses.

## Testing

- `use-feed-events`: `setLocation` updates coords **and** resets `offset`/accumulated events; `queryInput` reflects new coords. (Unit, mirrors existing `onSearch` tests.)
- `FeedLocationSheet`: selecting a suggestion animates to its coords and sets the pending label; confirm emits the map-centre coords + label; reverse-geocode failure falls back to a neutral label; GPS-null keeps centre.
- Venue fallback: denied GPS + venue pin → effective location is the venue pin, not Ireland centre.

## Files

| File                                              | Change                                                         |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `apps/native/components/FeedLocationSheet.tsx`    | **new** — Modal sheet: search + map + centre pin + confirm     |
| `apps/native/hooks/use-feed-events.ts`            | reactive `lat`/`lng` + `setLocation()` (resets offset/events)  |
| `apps/native/app/(app)/(tabs)/discover/index.tsx` | effective-location state, sheet visibility, wiring, chip label |
| `apps/native/hooks/use-gps-region.ts` (verify)    | ensure venue fallback is passed from discover                  |
| `apps/native/components/FeedHeader.tsx`           | no structural change — receives `locationText` label           |
