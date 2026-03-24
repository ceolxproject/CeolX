# M3-T1 · Map Integration + Viewport Bounding Box Query

| Field          | Value                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M3 — Map & Discovery                                                                                        |
| **Status**     | 🔲 To Do                                                                                                    |
| **Depends on** | M1-T2 (events table + GIST index), M1-T3 (API scaffold), M1-T4 (mobile scaffold), M4-T1 (events must exist) |
| **PRD Ref**    | Section 9.2 (Map & Feed Discovery), Section 9.2.1 (Viewport Bounding Box Query)                             |

---

## Description

The main discovery surface of the CeolX app — the Map view. Users see event pins scattered across an interactive map showing nearby Irish music events in real-time. The map is performant and responsive: it only fetches events visible in the current viewport using a bounding box query (southwest and northeast lat/lng corners), with a hard limit of 50 pins per fetch to prevent payload bloat. As the user pans or zooms, re-fetch triggers on a ~400ms debounce after they stop moving — this prevents excessive backend load while keeping data fresh.

The map renders natively on each platform (Apple Maps on iOS via MapKit, Google Maps on Android). Both use the unified React Native Maps abstraction, so the mobile codebase is platform-agnostic. Event pins render at precise lat/lng with category labels (e.g. "Trad Session", "Ceili"). Tapping a pin opens an Event Detail bottom sheet with quick preview info (title, date, cover image, venue) and a "See full details" button to expand to the full Event Detail screen.

---

## Affected Apps / Packages

- `apps/api` — Viewport bounding box query, GIST spatial index usage, 50-pin limit enforcement
- `apps/mobile` — `react-native-maps` integration, pin rendering, debounced re-fetch on pan, bottom sheet for quick preview
- `packages/shared` — Event type definitions, category enum

---

## API Endpoints

### GET /events/map

Fetch active upcoming events within a map viewport bounding box.

**Query Parameters:**

```json
{
  "swLat": 52.5,
  "swLng": -6.8,
  "neLat": 53.5,
  "neLng": -5.2,
  "limit": 50
}
```

**Response (200 OK):**

```json
{
  "events": [
    {
      "id": "evt_123abc",
      "title": "Live at Temple Bar",
      "lat": 53.3432,
      "lng": -6.2545,
      "category": "trad_session",
      "date_start": "2026-03-28T19:00:00Z",
      "date_end": "2026-03-28T23:00:00Z",
      "cover_image": "https://d1234.cloudfront.net/evt_123.jpg",
      "venue_address": "Temple Bar, Dublin"
    },
    {
      "id": "evt_456def",
      "title": "Ceili Dance Night",
      "lat": 53.3298,
      "lng": -6.2571,
      "category": "ceili",
      "date_start": "2026-03-29T20:00:00Z",
      "date_end": "2026-03-29T23:30:00Z",
      "cover_image": "https://d1234.cloudfront.net/evt_456.jpg",
      "venue_address": "Copper Alley, Dublin"
    }
  ],
  "totalCount": 2
}
```

**Error Responses:**

- `400` — Invalid bounding box parameters `{ "error": "swLat, swLng, neLat, neLng required and must be valid floats" }`
- `401` — Unauthorized `{ "error": "Authentication required" }`
- `500` — Database or GIST index error `{ "error": "Failed to query events by location" }`

---

## Requirements

### Viewport Bounding Box Query

- The API accepts SW (southwest) and NE (northeast) corners as lat/lng floats
- Query returns only events where `status = active` and `date_start >= now()` — upcoming events only
- Results capped at 50 events per fetch to prevent payload bloat
- Results sorted by distance from the bounding box centre (closest first)
- Query uses the GIST spatial index on `events(lat, lng)` for sub-millisecond performance
- `EXPLAIN ANALYSE` must confirm index is used — no full table scan

### Mobile Map Rendering

- `react-native-maps` component renders full-screen on the Map tab
- Platform-specific provider: Apple Maps on iOS (via MapKit), Google Maps on Android
- Both are abstracted by a single `<MapView>` component — no platform-specific code in mobile app
- Event pins render at exact lat/lng coordinates with a category icon or label
- Multiple nearby pins merge into a cluster badge when map is zoomed out (handled by built-in clustering)
- Tapping a pin shows a brief bottom sheet preview (title, date, location, cover image thumbnail)
- A "See full details" link in the bottom sheet navigates to the full Event Detail screen

### Debouncing & Pan Performance

- `onRegionChangeComplete` fires when user finishes panning
- Convert the region object to a bounding box: `swLat = latitude - latitudeDelta/2`, `neLat = latitude + latitudeDelta/2`, same for longitude
- API calls debounced ~400ms after `onRegionChangeComplete` — rapid pan sequences don't fire requests for each intermediate frame
- Re-fetch triggered each time user stops panning with updated bounding box
- Network requests logged for verification in Xcode / Android Studio network inspector

---

## Acceptance Criteria

- [ ] Map renders full-screen with correct provider (Apple Maps on iOS, Google Maps on Android)
- [ ] Event pins appear at correct lat/lng coordinates on map load
- [ ] Panning map triggers re-fetch only after user stops moving (~400ms debounce confirmed in network logs)
- [ ] `EXPLAIN ANALYSE` on the bounding box query confirms GIST index is used, not sequential scan
- [ ] Max 50 pins returned per fetch — verified in response payload and network tab
- [ ] Tapping a pin opens Event Detail bottom sheet with cover image, title, date, and location
- [ ] Pin labels display category (e.g. "Trad Session", "Ceili") matching UI designs
- [ ] Empty map (no events in viewport) does not crash the app — bottom sheet shows "No events in this area"
- [ ] Map continues to render smoothly during pan (60fps target) — no jank or visible lag
- [ ] Zooming in/out does not cause duplicate pins or stale data

---

## Dependencies

### Upstream

- **M1-T2** — Neon database and events table with GIST spatial index must be created and deployed
- **M1-T3** — Hono API scaffold with TypeScript, middleware, and error handling set up
- **M1-T4** — React Native + Expo project scaffold with navigation stack for tabs
- **M4-T1** — Events must be created by users (via Create Event form) so there is test data on the map

### Downstream

- **M3-T2** — Location permission fallback chain relies on map being the default home screen
- **M3-T4** — Feed view algorithm references the same events as the map — must maintain data consistency
- **M4-T2** — Event Detail screen is accessed by tapping a map pin (this task)

### External Services

- **Neon PostgreSQL** — Serverless DB with GIST spatial indexes
- **Apple Maps (iOS)** / **Google Maps (Android)** — via `react-native-maps`

---

## Technical Notes

### Bounding Box Query — Drizzle + Neon

The core query uses SQL `BETWEEN` with the GIST index:

```typescript
// apps/api/src/routes/events.ts

import { drizzle } from "drizzle-orm/postgres-js";
import { events } from "@ceolx/shared/schema";
import { sql } from "drizzle-orm";

export async function getEventsInViewport(
  db: ReturnType<typeof drizzle>,
  swLat: number,
  swLng: number,
  neLat: number,
  neLng: number,
  limit: number = 50,
) {
  const now = new Date().toISOString();

  const result = await db
    .select({
      id: events.id,
      title: events.title,
      lat: events.lat,
      lng: events.lng,
      category: events.category,
      date_start: events.date_start,
      date_end: events.date_end,
      cover_image: events.cover_image,
      venue_address: events.venue_address,
    })
    .from(events)
    .where(
      sql`
        ${events.status} = 'active'
        AND ${events.date_start} >= ${now}
        AND ${events.lat} BETWEEN ${swLat} AND ${neLat}
        AND ${events.lng} BETWEEN ${swLng} AND ${neLng}
      `,
    )
    .orderBy(
      sql`
      SQRT(
        POW(${events.lat} - ${(swLat + neLat) / 2}, 2) +
        POW(${events.lng} - ${(swLng + neLng) / 2}, 2)
      )
    `,
    )
    .limit(limit);

  return result;
}
```

### React Native Maps Integration

```typescript
// apps/mobile/src/screens/MapScreen.tsx

import React, { useState, useCallback } from 'react';
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_APPLE } from 'react-native-maps';
import { Platform, View, ActivityIndicator } from 'react-native';
import { debounce } from 'lodash';
import { api } from '../services/api';

interface Event {
  id: string;
  title: string;
  lat: number;
  lng: number;
  category: string;
  cover_image: string;
}

export const MapScreen: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEventsForViewport = useCallback(
    debounce(async (swLat: number, swLng: number, neLat: number, neLng: number) => {
      setLoading(true);
      try {
        const response = await api.get('/events/map', {
          params: { swLat, swLng, neLat, neLng, limit: 50 },
        });
        setEvents(response.data.events);
      } catch (error) {
        console.error('Failed to fetch events:', error);
      } finally {
        setLoading(false);
      }
    }, 400),
    []
  );

  const handleRegionChangeComplete = (region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => {
    const swLat = region.latitude - region.latitudeDelta / 2;
    const neLat = region.latitude + region.latitudeDelta / 2;
    const swLng = region.longitude - region.longitudeDelta / 2;
    const neLng = region.longitude + region.longitudeDelta / 2;

    fetchEventsForViewport(swLat, swLng, neLat, neLng);
  };

  const provider =
    Platform.OS === 'ios' ? PROVIDER_APPLE : PROVIDER_GOOGLE;

  return (
    <View style={{ flex: 1 }}>
      <MapView
        provider={provider}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 53.1424,
          longitude: -7.6921,
          latitudeDelta: 3,
          longitudeDelta: 3,
        }}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation={true}
        maxDelta={30}
        minDelta={0.0922}
      >
        {events.map((event) => (
          <Marker
            key={event.id}
            coordinate={{ latitude: event.lat, longitude: event.lng }}
            title={event.title}
            description={event.category}
          />
        ))}
      </MapView>
      {loading && (
        <ActivityIndicator
          style={{ position: 'absolute', alignSelf: 'center', top: 20 }}
          size="large"
          color="#0000ff"
        />
      )}
    </View>
  );
};
```

### Verify GIST Index Usage

In Neon console or via `psql`, run:

```sql
EXPLAIN ANALYSE
SELECT id, title, lat, lng, category, date_start, cover_image, venue_address
FROM events
WHERE status = 'active'
  AND date_start >= NOW()
  AND lat BETWEEN 52.5 AND 53.5
  AND lng BETWEEN -6.8 AND -5.2
ORDER BY SQRT(POW(lat - 53.0, 2) + POW(lng - -6.0, 2))
LIMIT 50;
```

The plan should show `Index Scan using events_lat_lng_gist_idx` — not `Seq Scan`.

### Environment Variables Required

```
# apps/api/.env.local
DATABASE_URL=postgresql://user:password@ep-xxxxx.neon.tech/ceolx_db

# apps/mobile/.env
REACT_APP_API_BASE_URL=https://api.ceolx.ie
```

---

## Common Gotchas

- **Bounding box reversal**: Easy to swap swLng/neLng if not careful. Verify: `swLng` should always be **west** (more negative) and `neLng` should be **east** (less negative).
- **Region delta calculation**: `latitudeDelta` and `longitudeDelta` from `react-native-maps` are **total spans**, not half-spans. Divide by 2 before using as offsets.
- **Stale state in debounce**: If user pans very quickly, an old debounced call might fire after a newer region. Cache the latest request ID or timestamp to discard stale results.
- **iOS vs Android clustering**: `react-native-maps` clustering works on both platforms but may render differently. Test both before shipping.
- **GIST performance at scale**: With 10,000+ events, ensure the GIST index is analyzed regularly. Run `ANALYSE events;` after bulk inserts.
