# M3-T3 · Pin Clustering + Search on Map

| Field          | Value                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| **Milestone**  | M3 — Map & Discovery                                                                                 |
| **Status**     | 🔲 To Do                                                                                             |
| **Depends on** | M3-T1 (map viewport query), M1-T3 (API scaffold), M1-T4 (mobile scaffold), M4-T1 (events must exist) |
| **PRD Ref**    | Section 9.2.1 (Map Clustering), Section 9.2.2 (Search Functionality)                                 |

---

## Description

Two overlapping features on the Map screen. First, **pin clustering**: when the map is zoomed out, multiple nearby event pins visually merge into a single cluster badge showing a count (e.g. "8 events", "25 events"). Zooming in or tapping a cluster separates the pins into individual cards. This improves readability and reduces visual clutter at low zoom levels. Second, **search on map**: users can search for events by county, city, artist name, or category without leaving the Map view. A search bar at the top of the screen accepts queries; results render as overlay pins on the current viewport. Search is always available and operates independently of location permission (never blocked by M3-T2).

---

## Affected Apps / Packages

- `apps/api` — Search endpoint returning events filtered by text + optional spatial bounds
- `apps/mobile` — Pin clustering logic (via `react-native-maps`), search input component, search results rendering on map
- `packages/shared` — Search query types

---

## API Endpoints

### GET /events/search

Search events by text (county, city, artist name, category) with optional spatial filtering.

**Query Parameters:**

```json
{
  "query": "dublin",
  "type": "county|city|artist|category",
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
      "id": "evt_789ghi",
      "title": "Trad Session at the Brazen Head",
      "lat": 53.3432,
      "lng": -6.2545,
      "category": "trad_session",
      "date_start": "2026-03-30T19:00:00Z",
      "date_end": "2026-03-30T23:00:00Z",
      "cover_image": "https://d1234.cloudfront.net/evt_789.jpg",
      "venue_address": "The Brazen Head, Dublin",
      "created_by_artist_name": "Padraig O'Brien"
    }
  ],
  "totalCount": 1,
  "searchType": "county"
}
```

**Error Responses:**

- `400` — Invalid query or type `{ "error": "query and type are required" }`
- `401` — Unauthorized `{ "error": "Authentication required" }`
- `500` — Search error `{ "error": "Failed to search events" }`

---

## Requirements

### Pin Clustering

- **Built-in clustering** via `react-native-maps` automatic clustering
- Pins within ~40 pixels of each other (at the current zoom level) merge into a single cluster badge
- Cluster badge displays a count (e.g., "8", "25")
- Tapping a cluster badge zooms in and separates the cluster into individual pins
- Individual pins show category label or icon (matching M3-T1)
- Clustering is **on by default** and cannot be disabled by the user

### Search Functionality

- Search bar renders at the top of the Map screen, below the map title
- Placeholder text: "Search by county, city, artist, or event..."
- On text input, suggest search types: "Search for Dublin (county)", "Search for Padraig O'Brien (artist)", etc. (optional autocomplete)
- On search submission or completion, overlay search results as pins on the current map view
- Search results remain visible until user clears the search bar
- Search does not change the map center or zoom — results are shown in-place on the current viewport
- Tapping a search result pin shows Event Detail bottom sheet (same as M3-T1)
- Search is **always available** and does not depend on location permission

### Search Types

- **County**: Filter events in the specified Irish county (e.g., "Cork", "Galway")
- **City**: Filter events in the specified city (e.g., "Dublin", "Limerick")
- **Artist**: Filter events created by or collaborating with an artist whose name matches (case-insensitive partial match)
- **Category**: Filter events in the specified category (e.g., "trad_session", "ceili", "concert")
- If user enters ambiguous text, the app **doesn't auto-select** a type — the search bar shows suggestions for each type

### Search Results Display

- Results render as pins on the map at the same coordinates as the viewport query (M3-T1)
- Up to 50 search results per query (same limit as viewport query)
- Results sorted by recency (newest events first)
- If search returns 0 results, show a non-blocking toast: "No events found for [query]"
- User can clear search by tapping an X button in the search bar or dismissing the keyboard

### Gig Opportunity Visibility

- Gig opportunity events (`is_gig_opportunity: true`) are visible to Artist persona in search results
- Gig opportunity events are **hidden from Spectator persona** in search results and on the map
- Gig opportunity events are **hidden from Venue persona** (they don't apply for gigs, they create them)

---

## Acceptance Criteria

- [ ] Multiple nearby pins merge into a cluster badge when zoomed out
- [ ] Cluster badge shows accurate count (verified for 5, 10, 25+ pin clusters)
- [ ] Tapping a cluster badge zooms in and separates the cluster
- [ ] Search bar renders at top of Map screen and accepts text input
- [ ] Pressing Enter or tapping Search button triggers search query
- [ ] Search results render as pins on map without changing map center/zoom
- [ ] Tapping a search result pin opens Event Detail bottom sheet
- [ ] Search works for county names (e.g., "Cork" returns events in Cork county)
- [ ] Search works for artist names (case-insensitive partial match)
- [ ] Search works for category (e.g., "trad_session" returns all trad sessions)
- [ ] Gig opportunity events visible in Artist search results but hidden in Spectator search results
- [ ] Clearing search bar removes search result pins and returns to viewport query pins
- [ ] Zero results show non-blocking toast message
- [ ] Search works offline if data is cached (optional, but preferred for UX)

---

## Dependencies

### Upstream

- **M3-T1** — Map viewport query and pin rendering infrastructure
- **M1-T3** — API scaffold with search endpoint
- **M4-T1** — Events created by users; search queries events from the events table

### Downstream

- **M3-T4** — Feed view uses similar search/filter logic; results should be consistent between Map and Feed

### External Services

- **react-native-maps** — Native clustering implementation

---

## Technical Notes

### Clustering Configuration

```typescript
// apps/native/src/screens/MapScreen.tsx

import MapView, { Marker, Cluster } from 'react-native-maps';
import React from 'react';

export const MapScreen: React.FC = () => {
  return (
    <MapView
      provider="google" // or PROVIDER_APPLE on iOS
      style={{ flex: 1 }}
      initialRegion={{
        latitude: 53.1424,
        longitude: -7.6921,
        latitudeDelta: 3,
        longitudeDelta: 3,
      }}
      // Built-in clustering enabled
      // Cluster distance is ~40 pixels; configure via clusteringEnabled prop
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
  );
};
```

For custom clustering control or advanced options, use `react-native-maps-clustering`:

```typescript
import ClusteredMapView from 'react-native-maps-clustering';

<ClusteredMapView
  maxZoom={16}
  minZoom={5}
  minPoints={2}
  extent={256}
  radius={40}
  // ... other props
>
  {/* Markers go here */}
</ClusteredMapView>
```

### Search Implementation with Text Parsing

```typescript
// apps/native/src/hooks/useEventSearch.ts

import { useState, useCallback } from 'react';
import { api } from '../services/api';

interface SearchQuery {
  query: string;
  type: 'county' | 'city' | 'artist' | 'category';
  swLat?: number;
  swLng?: number;
  neLat?: number;
  neLng?: number;
}

export const useEventSearch = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (searchQuery: SearchQuery) => {
    if (!searchQuery.query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get('/events/search', {
        params: searchQuery,
      });
      setResults(response.data.events);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, search };
};
```

### Search Bar Component with Suggestions

```typescript
// apps/native/src/components/MapSearchBar.tsx

import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  FlatList,
} from 'react-native';
import { useEventSearch } from '../hooks/useEventSearch';

const SEARCH_TYPES = ['county', 'city', 'artist', 'category'];

export const MapSearchBar: React.FC<{ onSearch: (events: any[]) => void }> = ({
  onSearch,
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<typeof SEARCH_TYPES>([]);
  const { search, results } = useEventSearch();

  const handleTextChange = (text: string) => {
    setQuery(text);
    if (text.trim()) {
      // Show all search type suggestions
      setSuggestions(SEARCH_TYPES);
    } else {
      setSuggestions([]);
    }
  };

  const handleSearch = (type: (typeof SEARCH_TYPES)[number]) => {
    search({ query, type });
    onSearch(results);
    setSuggestions([]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <TextInput
          style={styles.input}
          placeholder="Search by county, city, artist..."
          value={query}
          onChangeText={handleTextChange}
        />
        {query && (
          <TouchableOpacity onPress={() => { setQuery(''); setSuggestions([]); onSearch([]); }}>
            <Text style={styles.clearBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          {suggestions.map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => handleSearch(type)}
              style={styles.suggestionRow}
            >
              <Text style={styles.suggestionText}>
                Search for {query} ({type})
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  input: {
    flex: 1,
    height: 40,
    fontSize: 14,
  },
  clearBtn: {
    fontSize: 18,
    color: '#999',
    paddingRight: 8,
  },
  suggestionsBox: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  suggestionRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
  },
});
```

### Backend Search Endpoint (Hono)

```typescript
// apps/server/src/routes/events.ts

import { Hono } from 'hono';
import { db } from '../db';
import { events } from '@ceolx/shared/schema';
import { ilike, sql } from 'drizzle-orm';

const app = new Hono();

app.get('/search', async (c) => {
  const query = c.req.query('query');
  const type = c.req.query('type') as 'county' | 'city' | 'artist' | 'category' | undefined;
  const swLat = c.req.query('swLat');
  const swLng = c.req.query('swLng');
  const neLat = c.req.query('neLat');
  const neLng = c.req.query('neLng');

  if (!query || !type) {
    return c.json({ error: 'query and type are required' }, 400);
  }

  try {
    let whereConditions = [sql`${events.status} = 'active'`, sql`${events.date_start} >= NOW()`];

    // Add type-specific filter
    if (type === 'county' || type === 'city') {
      whereConditions.push(ilike(events.venue_address, `%${query}%`));
    } else if (type === 'artist') {
      whereConditions.push(ilike(events.created_by, `%${query}%`));
    } else if (type === 'category') {
      whereConditions.push(ilike(events.category, `%${query}%`));
    }

    // Add spatial bounds if provided
    if (swLat && swLng && neLat && neLng) {
      whereConditions.push(
        sql`${events.lat} BETWEEN ${swLat} AND ${neLat} AND ${events.lng} BETWEEN ${swLng} AND ${neLng}`
      );
    }

    // Hide gig opportunities from non-artists (implement via auth context)
    // ...

    const results = await db
      .select()
      .from(events)
      .where(sql`${whereConditions.join(' AND ')}`)
      .orderBy(sql`${events.date_start} DESC`)
      .limit(50);

    return c.json({
      events: results,
      totalCount: results.length,
      searchType: type,
    });
  } catch (error) {
    console.error('Search error:', error);
    return c.json({ error: 'Failed to search events' }, 500);
  }
});
```

### Environment Variables Required

```
# apps/native/.env
REACT_APP_API_BASE_URL=https://api.ceolx.ie

# apps/server/.env.local
DATABASE_URL=postgresql://user:password@ep-xxxxx.neon.tech/ceolx_db
```

---

## Common Gotchas

- **Clustering distance too large**: If cluster radius is >60 pixels, distinct pins may disappear into a single cluster prematurely. Test at multiple zoom levels before finalizing cluster config.
- **Search type ambiguity**: If user enters "Dublin", it matches both county ("County Dublin") and city ("Dublin city"). Show all suggestions rather than auto-selecting one type.
- **Artist name search**: Partial matching may return too many results (e.g., searching "Pat" returns "Pat McCarthy", "Patrick", "Patricia"). Consider adding a "Did you mean?" feature if results exceed 10.
- **Gig opportunity filtering**: Ensure the search endpoint respects the current user's persona when filtering gig opportunities. A Spectator should never see gig opportunity events, even if explicitly searched.
- **Search result pins overwriting viewport pins**: If user searches while pins are already on the map, the search results should replace the viewport pins (not overlay them). Clear old pins before adding search results.
