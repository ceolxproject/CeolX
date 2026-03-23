# M3-T2 · Location Permission Fallback Chain

| Field | Value |
|-------|-------|
| **Milestone** | M3 — Map & Discovery |
| **Status** | 🔲 To Do |
| **Depends on** | M1-T4 (React Native + Expo scaffold), M3-T1 (Map screen), M2-T4 (onboarding flows) |
| **PRD Ref** | Section 9.2 (Map & Feed Discovery), Section 9.2.1 (Location Fallback Chain) |

---

## Description

Users must grant location permission for the Map view and Feed ranking to work optimally. CeolX implements a three-tier fallback chain to ensure the app is always usable, even if the user denies GPS access. First, request device GPS location via `expo-location`. If denied or times out (10s), resolve approximate location from the user's IP using ipapi.co. If IP geolocation fails, center the map on a default Ireland location (lat: 53.1424, lng: -7.6921, near Athenry, Galway). The user is **never blocked** — the search bar is always available as a manual override to refine discovery by county, artist name, or category.

| Field | Value |
|-------|-------|
| **Milestone** | M3 — Map & Discovery |
| **Status** | 🔲 To Do |
| **Depends on** | M1-T4 (mobile scaffold), M3-T1 (map screen), M2-T4 (onboarding flows) |
| **PRD Ref** | Section 9.2, Section 9.2.1 |

---

## Description

Users must grant location permission for the Map view to be useful. The CeolX app implements a three-tier fallback chain to ensure the app is always usable, even if the user denies GPS access. First, request device GPS location via `expo-location`. If denied or unavailable, resolve approximate location from the user's IP address using ipapi.co. If IP geolocation fails or returns no data, center the map on a default Ireland location (lat: 53.1424, lng: -7.6921). The user is never blocked — the search bar is always available as a manual override to refine results by county, artist name, or category.

---

## Affected Apps / Packages

- `apps/mobile` — Location permission request flow, GPS resolution, IP geolocation fallback, banner messaging
- `apps/api` — IP resolution endpoint (optional; can be client-side via ipapi.co)
- `packages/shared` — Constants for Ireland default location

---

## API Endpoints

### GET /location/resolve-ip

Resolve approximate location from client IP address (optional — can be done client-side).

**Query Parameters:**
```json
{}
```

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
- On app launch (during onboarding or on first Map tab visit), request location permission via `expo-location` with a clear, user-friendly prompt: "CeolX needs your location to show nearby events."
- If user grants: use device GPS (see GPS Resolution below)
- If user denies or dismisses: proceed to IP geolocation fallback (see IP Geolocation below)
- Permission prompt must be shown **once per install** — do not re-request on every app launch if already denied

### GPS Resolution
- Use `expo-location.getCurrentPositionAsync()` with `accuracy: Location.Accuracy.Balanced` to avoid excessive battery drain
- Timeout at 10 seconds — if GPS doesn't resolve within 10 seconds, fall back to IP geolocation rather than blocking the UI
- Store GPS coordinates in React Context or device storage so subsequent app launches can use cached location (with an expiry, e.g., 1 hour)
- Display a subtle "Using your location" indicator on the map header

### IP Geolocation Fallback
- If GPS is denied or times out, call ipapi.co (or equivalent service) to resolve approximate location from client IP
- ipapi.co is free tier, ~45 requests/minute limit — sufficient for this app
- Response includes lat/lng at city-level accuracy, city name, and region (county)
- Display a banner on the map: "Using approximate location (Dublin area) — search to refine." Include a dismiss button
- If IP geolocation also fails or returns no data, fall through to Ireland default (see below)

### Ireland Default Fallback
- If both GPS and IP geolocation fail or are unavailable, center the map on default Ireland location: lat: 53.1424, lng: -7.6921 (geographic centre of Ireland, near Athenry, Galway)
- Display a non-blocking floating card: "No location available. Try searching for Dublin, Galway, or Cork."
- This state is not treated as an error — the app remains fully functional via the search bar

### Search Bar Override
- The search bar is **always visible** on the Map screen, regardless of location resolution status
- Users can search by: county name (e.g. "Cork"), city (e.g. "Limerick"), artist name, or event category
- Search does not depend on location permission — it bypasses the location chain entirely
- Search results are shown in the Feed view or as map pins overlaid on the current viewport

### Permissions Lifecycle
- Store permission state in device storage (Async Storage) to avoid re-requesting on every app launch
- Provide a "Settings > Permissions" menu option to allow users to revoke or re-grant location permission after onboarding
- If user revokes location permission after granting it, detect the change and fall back to IP geolocation on next map visit

---

## Acceptance Criteria

- [ ] Location permission prompt shows once on first Map tab visit with clear messaging
- [ ] GPS resolves within 10 seconds; if timeout, falls back to IP geolocation without UI freeze
- [ ] IP geolocation resolves and returns lat/lng + city/region with accuracy label ("Approximate")
- [ ] Banner displayed when using IP geolocation, with dismiss button and option to search to refine
- [ ] Ireland default location (53.1424, -7.6921) is used when both GPS and IP geolocation fail
- [ ] Floating card shown on Ireland default with suggestions to search for major cities
- [ ] Search bar always visible and functional, independent of location resolution
- [ ] Permission state cached in device storage — no re-request on subsequent app launches if already answered
- [ ] User can revoke location permission in Settings and app gracefully falls back to IP geolocation
- [ ] Map re-centers correctly when location is resolved via any of the three tiers

---

## Dependencies

### Upstream
- **M1-T4** — React Native + Expo scaffold with navigation and context state management
- **M2-T4** — Onboarding flow determines when to request location permission (before or during Map tab first visit)
- **M3-T1** — Map screen infrastructure ready to receive initial lat/lng

### Downstream
- **M3-T3** — Pin clustering and search rely on correct initial map center
- **M3-T4** — Feed view algorithm uses current location for distance-based sorting
- **M4-T1** — Event creation form embeds a mini-map that also uses location

### External Services
- **ipapi.co** — Free IP geolocation service (45 requests/minute)
- **expo-location** — Expo native module for GPS access

---

## Technical Notes

### GPS Resolution with Timeout

```typescript
// apps/mobile/src/hooks/useLocationPermission.ts

import * as Location from 'expo-location';
import { useState, useEffect } from 'react';

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
        // Step 1: Request permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          // Step 2: GPS resolution with 10-second timeout
          try {
            const gpsPromise = Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('GPS timeout')), 10000)
            );
            const gpsResult = await Promise.race([gpsPromise, timeoutPromise]);

            setLocation({
              lat: gpsResult.coords.latitude,
              lng: gpsResult.coords.longitude,
              source: 'gps',
              accuracy: 'precise',
            });
          } catch (gpsError) {
            console.warn('GPS failed, falling back to IP geolocation:', gpsError);
            const ipResult = await resolveIPGeolocation();
            if (ipResult) {
              setLocation({
                lat: ipResult.lat,
                lng: ipResult.lng,
                source: 'ip',
                accuracy: 'city',
              });
            } else {
              // Ireland default
              setLocation({
                lat: 53.1424,
                lng: -7.6921,
                source: 'default',
                accuracy: 'country',
              });
            }
          }
        } else {
          // Permission denied, use IP geolocation
          const ipResult = await resolveIPGeolocation();
          if (ipResult) {
            setLocation({
              lat: ipResult.lat,
              lng: ipResult.lng,
              source: 'ip',
              accuracy: 'city',
            });
          } else {
            setLocation({
              lat: 53.1424,
              lng: -7.6921,
              source: 'default',
              accuracy: 'country',
            });
          }
        }
      } catch (error) {
        console.error('Location resolution failed:', error);
        // Final fallback
        setLocation({
          lat: 53.1424,
          lng: -7.6921,
          source: 'default',
          accuracy: 'country',
        });
      } finally {
        setLoading(false);
      }
    };

    requestLocation();
  }, []);

  return { location, loading };
};

async function resolveIPGeolocation() {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    if (data.latitude && data.longitude) {
      return {
        lat: data.latitude,
        lng: data.longitude,
        city: data.city,
        region: data.region,
      };
    }
    return null;
  } catch (error) {
    console.error('IP geolocation failed:', error);
    return null;
  }
}
```

### Location Banner Component

```typescript
// apps/mobile/src/components/LocationBanner.tsx

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface LocationBannerProps {
  source: 'ip' | 'default';
  city?: string;
  onDismiss: () => void;
}

export const LocationBanner: React.FC<LocationBannerProps> = ({
  source,
  city,
  onDismiss,
}) => {
  let message = '';

  if (source === 'ip') {
    message = `Using approximate location (${city} area) — search to refine.`;
  } else if (source === 'default') {
    message = 'No location available. Try searching for Dublin, Galway, or Cork.';
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{message}</Text>
      <TouchableOpacity onPress={onDismiss}>
        <Text style={styles.dismiss}>Dismiss</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    backgroundColor: '#FFF3CD',
    padding: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  dismiss: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
});
```

### Permissions Caching in Device Storage

```typescript
// apps/mobile/src/utils/locationStorage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_CACHE_KEY = 'ceolx_location_cache';
const LOCATION_CACHE_TTL_MS = 3600000; // 1 hour

export async function cacheLocation(lat: number, lng: number) {
  const cacheData = {
    lat,
    lng,
    timestamp: Date.now(),
  };
  await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(cacheData));
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

### Environment Variables Required

```
# apps/mobile/.env
IPAPI_ENDPOINT=https://ipapi.co/json/
```

---

## Common Gotchas

- **Permission prompt timing**: Showing the permission prompt too early (during splash screen) may confuse users. Best practice: show it when user first tries to access the Map tab.
- **IP geolocation in development**: When running on iOS Simulator or Android Emulator with spoofed location, IP geolocation will resolve to your actual development machine's location (or a default), not the simulated location. Use real devices for testing location fallback.
- **GPS timeout too short**: 10 seconds may be too short in poor signal areas. Consider extending to 15-20 seconds for better UX, but monitor battery impact.
- **Cache expiry logic**: If caching GPS location for 1 hour, users who move (e.g., traveling between cities) won't see updated location. Consider reducing cache TTL or adding a "Refresh Location" button.
- **ipapi.co rate limits**: 45 requests/minute is sufficient for the launch scale (<1,000 users), but monitor request volume as the app grows.
- **Search bar not using location**: Ensure search functionality is completely independent of location permission — it should work even with the Ireland default fallback.
