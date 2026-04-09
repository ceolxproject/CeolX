# M3-T2 · Location Permission + Fallback Chain + Empty State

| Field          | Value                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M3 — Map & Discovery                                                                                                                        |
| **Status**     | 🔲 To Do                                                                                                                                    |
| **Depends on** | M1-T4 (React Native + Expo scaffold), M2-T4 (onboarding flows), M3-T1 (map screen)                                                          |
| **PRD Ref**    | Section 9.2 (Map & Feed Discovery), Section 9.2.1 (Location Fallback Chain), Section 9.2.2 (Location Fallback), Section 9.2.3 (Empty State) |

---

## Description

Users are never blocked from the map regardless of their location permissions. CeolX implements a three-tier fallback chain to ensure the app is always usable, even if the user denies GPS access. First, request device GPS location via `expo-location`. If denied or times out (10s), resolve approximate location from the user's IP via the server-side `/location/ip` proxy. If IP geolocation fails (VPN / private relay), center the map on the Ireland default location (lat: 53.1424, lng: -7.6921, near Athenry, Galway). The search bar is always available as a manual override regardless of which tier resolves.

Empty state auto-expands silently — the radius concept is never exposed to users.

---

## Affected Apps / Packages

| App / Package     | Role                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `apps/api`        | `/location/ip` endpoint — server-side proxy to ipapi.co; never expose ipapi.co to client |
| `apps/mobile`     | Permission request, fallback chain logic, banner UI, empty state floating card           |
| `packages/shared` | Constants for Ireland default location                                                   |

---

## API Endpoints

| Method | Path           | Purpose                                                                                  |
| ------ | -------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/location/ip` | Server-side IP geolocation proxy (calls ipapi.co) — returns `{ lat, lng, city, county }` |

**Response (200 OK):**

```json
{
  "lat": 53.3298,
  "lng": -6.2571,
  "city": "Dublin",
  "region": "County Dublin",
  "country": "IE",
  "accuracy": "city"
}
```

**Error Responses:**

- `400` — IP geolocation unavailable `{ "error": "Unable to resolve location from IP" }`
- `500` — Service error `{ "error": "Geolocation service error" }`

---

## Requirements

### Location Permission Request

- R1: Location permission requested via `expo-location` on first Map tab visit with prompt: _"CeolX needs your location to show nearby events."_
- Permission shown **once per install** — do not re-request on every app launch if already denied

### Fallback Chain

- R2: **Fallback Step 1 — GPS**: permission granted → centre map on device GPS coordinates (`accuracy: Balanced`, 10s timeout). If timeout, fall through to Step 2.
- R3: **Fallback Step 2 — IP Geolocation**: permission denied or GPS timeout → call `GET /location/ip` → centre map on returned city/county; show banner: _"Using approximate location — search to refine."_
- R4: **Fallback Step 3 — Ireland Default**: IP geolocation fails (VPN / private relay) → centre on `lat: 53.1424, lng: -7.6921`; show same banner as Step 2
- R5: Banner is dismissible by tapping; non-blocking
- R6: `/location/ip` is a **server-side proxy** — client never calls ipapi.co directly (API key stays server-only)

### Permissions Lifecycle

- R7: Store permission state in device storage (AsyncStorage) to avoid re-requesting on every app launch
- R8: Provide a **Settings > Permissions** option for users to revoke or re-grant location permission after onboarding
- R9: If user revokes location permission after granting it, detect on next map visit and fall back to IP geolocation

### GPS Caching

- R10: Cache GPS coordinates in device storage with 1-hour TTL so subsequent app launches use the cached location without re-requesting GPS

### Empty State — Auto-Expand

- R11: If bounding box query returns 0 results, silently retry at ~5 km, then 25 km, then 100 km from map centre — all retries are silent with no loading indicator or message
- R12: If still 0 results after 100 km retry → show a non-blocking floating card over the map: _"No events near here. Try searching for Dublin, Galway, or Cork."_ + **Browse all upcoming events** button (switches to Discover tab)
- R13: Floating card is dismissible
- R14: The radius values (5 km, 25 km, 100 km) must **NEVER** appear in any UI label or message

---

## Acceptance Criteria

- [ ] Location permission prompt shows once on first Map tab visit with correct messaging
- [ ] GPS resolves within 10 seconds; if timeout, falls back to IP geolocation without UI freeze
- [ ] App with GPS granted centres map on device location; no banner shown
- [ ] App with GPS denied falls back to IP geolocation; banner shown: _"Using approximate location — search to refine."_
- [ ] App with GPS denied + VPN falls back to Ireland centre (lat: 53.1424, lng: -7.6921); banner shown
- [ ] Banner is dismissible and non-blocking
- [ ] `/location/ip` is called server-side — ipapi.co URL never exposed to the mobile client
- [ ] Permission state cached in device storage — no re-request on subsequent app launches if already answered
- [ ] User can revoke location permission in Settings; app gracefully falls back to IP geolocation
- [ ] GPS coordinates cached with 1-hour TTL; map re-centers correctly on resume
- [ ] Area with 0 events triggers silent retries — no visible loader, no messaging during retries
- [ ] After 100 km retry still 0 results → floating card shown with correct copy
- [ ] "Browse all upcoming events" on floating card switches to Discover tab
- [ ] No radius value is ever shown to the user in any UI element
- [ ] Search bar always visible and functional, independent of location resolution

---

## Dependencies

### Upstream

- **M1-T4** — React Native + Expo scaffold with navigation and context state management
- **M2-T4** — Onboarding flow determines when to request location permission
- **M3-T1** — Map screen infrastructure ready to receive initial lat/lng

### Downstream

- **M3-T3** — Pin clustering and search rely on correct initial map centre
- **M3-T4** — Feed ranking algorithm uses current location for distance-based sorting
- **M4-T1** — Event creation form embeds a mini-map that also uses location

### External Services

- **ipapi.co** — Free IP geolocation service (45 requests/minute, server-side only)
- **expo-location** — Expo native module for GPS access

---

## Technical Notes

- The `/location/ip` endpoint must be called server-side — the Hono backend calls ipapi.co using the incoming request IP. Never expose the ipapi.co API key or URL to the mobile client.
- The banner should be small text at the top of the map — not a modal or full-screen overlay
- The auto-expand retry sequence is purely client-side: issue a new bounding box query with an expanded radius; do not tell the user it is happening
- GPS timeout of 10 seconds may be too short in poor signal areas — consider extending to 15–20 seconds based on user feedback, but monitor battery impact
- When running on iOS Simulator or Android Emulator, IP geolocation resolves to the development machine's actual IP — use real devices for testing the full fallback chain

### GPS Resolution Hook

```typescript
// apps/native/src/hooks/useLocationPermission.ts

import * as Location from 'expo-location';
import { useState, useEffect } from 'react';
import { getCachedLocation, cacheLocation } from '../utils/locationStorage';
import { api } from '../services/api';

interface LocationResult {
  lat: number;
  lng: number;
  source: 'gps' | 'ip' | 'default';
  accuracy?: string;
}

export const useLocationPermission = () => {
  const [location, setLocation] = useState<LocationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const requestLocation = async () => {
      try {
        // Check cache first
        const cached = await getCachedLocation();
        if (cached) {
          setLocation({ ...cached, source: 'gps', accuracy: 'precise' });
          setLoading(false);
          return;
        }

        // Step 1: Request GPS permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          try {
            const gpsPromise = Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('GPS timeout')), 10000)
            );
            const gpsResult = await Promise.race([gpsPromise, timeoutPromise]);
            const coords = {
              lat: gpsResult.coords.latitude,
              lng: gpsResult.coords.longitude,
            };
            await cacheLocation(coords.lat, coords.lng);
            setLocation({ ...coords, source: 'gps', accuracy: 'precise' });
            return;
          } catch {
            // GPS timed out — fall through to IP geolocation
          }
        }

        // Step 2: IP geolocation via server-side proxy
        try {
          const { data } = await api.get('/location/ip');
          if (data.lat && data.lng) {
            setLocation({ lat: data.lat, lng: data.lng, source: 'ip', accuracy: 'city' });
            return;
          }
        } catch {
          // IP geolocation failed — fall through to Ireland default
        }

        // Step 3: Ireland default
        setLocation({ lat: 53.1424, lng: -7.6921, source: 'default', accuracy: 'country' });
      } catch {
        setLocation({ lat: 53.1424, lng: -7.6921, source: 'default', accuracy: 'country' });
      } finally {
        setLoading(false);
      }
    };

    requestLocation();
  }, []);

  return { location, loading };
};
```

### Location Cache Utility

```typescript
// apps/native/src/utils/locationStorage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_CACHE_KEY = 'ceolx_location_cache';
const LOCATION_CACHE_TTL_MS = 3_600_000; // 1 hour

export async function cacheLocation(lat: number, lng: number) {
  await AsyncStorage.setItem(
    LOCATION_CACHE_KEY,
    JSON.stringify({ lat, lng, timestamp: Date.now() })
  );
}

export async function getCachedLocation(): Promise<{ lat: number; lng: number } | null> {
  const cached = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
  if (!cached) return null;
  const { lat, lng, timestamp } = JSON.parse(cached);
  if (Date.now() - timestamp > LOCATION_CACHE_TTL_MS) {
    await AsyncStorage.removeItem(LOCATION_CACHE_KEY);
    return null;
  }
  return { lat, lng };
}
```

### Location Banner Component

```typescript
// apps/native/src/components/LocationBanner.tsx

import { View, Text, TouchableOpacity } from 'react-native';

interface LocationBannerProps {
  onDismiss: () => void;
}

export const LocationBanner = ({ onDismiss }: LocationBannerProps) => (
  <View className="flex-row bg-yellow-50 px-3 py-2 items-center justify-between">
    <Text className="flex-1 text-sm text-gray-700 mr-2">
      Using approximate location — search to refine.
    </Text>
    <TouchableOpacity onPress={onDismiss}>
      <Text className="text-sm text-blue-600 font-semibold">Dismiss</Text>
    </TouchableOpacity>
  </View>
);
```

### Hono `/location/ip` Handler

```typescript
// apps/api/src/routes/location.ts

import { Hono } from 'hono';

const app = new Hono();

app.get('/location/ip', async (c) => {
  const clientIp =
    c.req.header('x-forwarded-for')?.split(',')[0].trim() || c.req.header('x-real-ip') || 'unknown';

  try {
    const response = await fetch(`https://ipapi.co/${clientIp}/json/`);
    const data = await response.json();

    if (!data.latitude || !data.longitude) {
      return c.json({ error: 'Unable to resolve location from IP' }, 400);
    }

    return c.json({
      lat: data.latitude,
      lng: data.longitude,
      city: data.city,
      region: data.region,
      country: data.country_code,
      accuracy: 'city',
    });
  } catch {
    return c.json({ error: 'Geolocation service error' }, 500);
  }
});

export default app;
```

### Environment Variables Required

```
# apps/api/.env.local
IPAPI_CO_KEY=  # optional — free tier works without a key up to 1,000 requests/day
```
