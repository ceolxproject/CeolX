# M3-T3 · Pin Clustering + Search Bar + Category Filter

| Field          | Value                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M3 — Map & Discovery                                                                                        |
| **Status**     | 🔲 To Do                                                                                                    |
| **Depends on** | M3-T1 (map viewport query + pins), M1-T3 (API scaffold), M1-T4 (mobile scaffold), M4-T1 (events must exist) |
| **PRD Ref**    | Section 9.1 (Search), Section 9.2.1 (Clustering)                                                            |

---

## Description

Map usability features built on top of M3-T1. **Pin clustering**: when the map is zoomed out, multiple nearby event pins merge into a single cluster badge (green circle, white count — e.g. "8", "25"). Zooming in or tapping a cluster separates the pins into individual cards.

**Location search**: a search bar at the top of the Map screen accepts county/city queries using Google Places Autocomplete (restricted to Ireland). Selecting a result re-centres the map on that location and reloads viewport pins via the M3-T1 endpoint — no separate search endpoint is needed.

**Category filter**: a filter icon button next to the search bar opens a category bottom sheet. Selecting a category filters the currently visible map pins. An active indicator on the filter icon shows when a filter is applied.

Search and filter operate independently of location permission — never blocked by M3-T2.

---

## Affected Apps / Packages

| App / Package     | Role                                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `apps/mobile`     | Clustering config, search bar + Google Places Autocomplete + embedded filter icon, category filter bottom sheet |
| `packages/shared` | Ireland default location constant                                                                               |

---

## API Endpoints

None specific to this task. Location search uses **Google Places Autocomplete** (client-side, restricted to Ireland). The result lat/lng feeds directly into the existing M3-T1 viewport query.

---

## Requirements

### Pin Clustering

- R1: Pin clustering enabled — nearby pins merge into a count badge when zoomed out
- R2: Tapping a cluster badge zooms in and separates the cluster into individual pins
- R3: Cluster badge styled as a **green circle with white count** (matching UI design)
- R4: Clustering is on by default and cannot be disabled by the user
- R5: Use `react-native-map-clustering` library or the built-in clustering prop depending on `react-native-maps` version compatibility — verify version compatibility before implementing

### Search Bar (Location Only)

- R6: Search bar at top of Map screen with placeholder: _"Search by county / location"_
- R7: A **filter icon is embedded inside the right side of the search bar** — not a separate button
- R8: Search uses **Google Places Autocomplete** restricted to Ireland (`componentRestrictions: { country: 'ie' }`)
- R9: Selecting a location result re-centres the map on that location and reloads viewport pins (calls M3-T1 endpoint with new bounding box)
- R10: Search does not filter event data server-side — it only re-centres the map; the viewport query handles pin loading

### Category Filter

- R11: Tapping the embedded filter icon opens a **category filter bottom sheet** listing all pre-seeded event categories
- R12: Selecting a category filters the currently visible map pins client-side
- R13: Active category filter shown as a visual indicator on the filter icon (e.g. green tint)
- R14: A **Clear filter** option removes the active category filter and restores all pins
- R15: Open Item #1 (default event categories from client) must be resolved before category filter is fully implemented — use placeholder categories in dev

### Gig Opportunity Visibility

- R16: Gig opportunity events (`is_gig_opportunity: true`) visible to Artist persona on the map
- R17: Gig opportunity events hidden from Spectator and Venue personas on the map (enforced by M3-T1 viewport query)

---

## Acceptance Criteria

- [ ] Multiple nearby pins at low zoom merge into a cluster badge
- [ ] Tapping a cluster zooms in and pins separate into individual markers
- [ ] Cluster badge matches design (green circle, white count)
- [ ] Search bar visible at top of Map screen with correct placeholder text
- [ ] Typing a county or city name shows Google Places Autocomplete suggestions restricted to Ireland
- [ ] Selecting a location result re-centres the map and reloads pins for that area
- [ ] Filter icon embedded inside the right side of the search bar
- [ ] Tapping filter icon opens category bottom sheet
- [ ] Selecting a category filters visible map pins
- [ ] Filter icon shows active indicator when a category filter is applied
- [ ] Clear filter restores all pins
- [ ] Search and filter work independently of location permission

---

## Dependencies

### Upstream

- **M3-T1** — Map viewport query and pin rendering; location search re-uses this endpoint
- **M1-T4** — React Native + Expo scaffold
- **M4-T1** — Events created by users; pins are sourced from the events table

### Downstream

- **M3-T4** — Feed view uses category filtering; filter logic should be consistent with map

### External Services

- **Google Places API** — Autocomplete restricted to Ireland (`componentRestrictions: { country: 'ie' }`). API key must have app bundle restrictions to avoid unexpected billing.
- **react-native-map-clustering** — Clustering library (verify `react-native-maps` version compatibility before use)

---

---

## Technical Notes

- Google Places API key must be restricted to Ireland and have domain/app bundle restrictions to avoid unexpected billing
- Open Item #1 (default event categories) must be resolved before category filter is fully implemented — use placeholder categories in dev

### Clustering Configuration

```typescript
// apps/native/src/screens/MapScreen.tsx

import ClusteredMapView from 'react-native-map-clustering';
import { Marker } from 'react-native-maps';

export const MapScreen = () => {
  return (
    <ClusteredMapView
      className="flex-1"
      maxZoom={16}
      minZoom={5}
      minPoints={2}
      radius={40}
      renderCluster={(cluster) => (
        <Marker
          key={`cluster-${cluster.id}`}
          coordinate={cluster.geometry.coordinates}
        >
          <View className="w-10 h-10 rounded-full bg-green-600 items-center justify-center">
            <Text className="text-white text-sm font-bold">
              {cluster.properties.point_count}
            </Text>
          </View>
        </Marker>
      )}
      initialRegion={{
        latitude: 53.1424,
        longitude: -7.6921,
        latitudeDelta: 3,
        longitudeDelta: 3,
      }}
    >
      {events.map((event) => (
        <Marker
          key={event.id}
          coordinate={{ latitude: event.lat, longitude: event.lng }}
          title={event.title}
          description={event.category}
        />
      ))}
    </ClusteredMapView>
  );
};
```

### Map Search Bar Component (filter icon embedded inside)

```typescript
// apps/native/src/components/MapSearchBar.tsx

import { View, TouchableOpacity } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Ionicons } from '@expo/vector-icons';

interface MapSearchBarProps {
  onLocationSelect: (lat: number, lng: number) => void;
  onFilterPress: () => void;
  hasActiveFilter: boolean;
}

export const MapSearchBar = ({
  onLocationSelect,
  onFilterPress,
  hasActiveFilter,
}: MapSearchBarProps) => (
  <View className="mx-3 my-2 flex-row items-center bg-white rounded-lg border border-gray-200 overflow-hidden">
    <View className="flex-1">
      <GooglePlacesAutocomplete
        placeholder="Search by county / location"
        onPress={(data, details) => {
          if (details?.geometry?.location) {
            onLocationSelect(
              details.geometry.location.lat,
              details.geometry.location.lng
            );
          }
        }}
        query={{
          key: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
          language: 'en',
          components: 'country:ie',
        }}
        fetchDetails
        styles={{
          textInputContainer: { backgroundColor: 'transparent' },
          textInput: { height: 44, fontSize: 14, marginBottom: 0 },
        }}
      />
    </View>

    {/* Filter icon embedded inside the right side of the search bar */}
    <TouchableOpacity
      onPress={onFilterPress}
      className="px-3 h-full items-center justify-center border-l border-gray-200"
    >
      <Ionicons
        name={hasActiveFilter ? 'filter' : 'filter-outline'}
        size={20}
        color={hasActiveFilter ? '#16a34a' : '#6b7280'}
      />
    </TouchableOpacity>
  </View>
);
```

### Category Filter Bottom Sheet

```typescript
// apps/native/src/components/CategoryFilterSheet.tsx

import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';

interface CategoryFilterSheetProps {
  categories: string[];
  activeCategory: string | null;
  onSelect: (category: string | null) => void;
}

export const CategoryFilterSheet = ({
  categories,
  activeCategory,
  onSelect,
}: CategoryFilterSheetProps) => (
  <BottomSheet snapPoints={['40%', '60%']}>
    <View className="px-4 pt-2 pb-4">
      <Text className="text-base font-semibold mb-3">Filter by Category</Text>

      {activeCategory && (
        <TouchableOpacity
          onPress={() => onSelect(null)}
          className="mb-2 py-2"
        >
          <Text className="text-green-600 font-medium">Clear filter</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={categories}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onSelect(item)}
            className={`py-3 border-b border-gray-100 ${activeCategory === item ? 'opacity-100' : 'opacity-70'}`}
          >
            <Text className={`text-sm ${activeCategory === item ? 'text-green-600 font-semibold' : 'text-gray-700'}`}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  </BottomSheet>
);
```

### Environment Variables Required

```
# apps/native/.env
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIza...
```

---

## Common Gotchas

- **Clustering distance too large**: If cluster radius is >60 pixels, distinct pins may merge prematurely. Test at multiple zoom levels before finalising cluster config.
- **Google Places billing**: Restrict the API key to the app bundle ID (iOS) and package name (Android) in Google Cloud Console to prevent abuse. Monitor usage in the GCP dashboard.
- **Category filter state after map re-centre**: When the user selects a new location via search, preserve any active category filter — don't reset it on map re-centre.
- **Open Item #1**: Category list must come from the client before the filter sheet can be fully populated. Use placeholder categories ("Trad Session", "Céilí", "Concert", "Festival") in development.
- **Viewport pins vs search**: When a user selects a location from Places Autocomplete, the map re-centres and the M3-T1 viewport query fires automatically — no separate search endpoint call needed.
