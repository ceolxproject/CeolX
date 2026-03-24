# M3-T4 · Feed View + Algorithmic Ranking

| Field          | Value                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M3 — Map & Discovery                                                                                              |
| **Status**     | 🔲 To Do                                                                                                          |
| **Depends on** | M1-T2 (events table), M1-T3 (API scaffold), M2-T4 (persona system), M3-T2 (user location), M6-T3 (follows system) |
| **PRD Ref**    | Section 9.2.2 (Feed View), Section 5.1 (End User Features), Section 6.1 (Artist Features)                         |

---

## Description

The Feed view displays events as vertically scrollable cards, ranked by an algorithmic combination of recency, distance from user's location, and whether the user follows the event creator. The ranking formula is: **40% recency + 40% proximity + 20% social signals**. Recency scores newer events higher; proximity scores closer events higher; social signals boost events from artists the user follows. The Feed serves as an alternative discovery surface to the Map view — users who prefer a list layout instead of map pins discover events here. Pagination is cursor-based, loading 15 events per page. Pull-to-refresh resets to page 1. Gig opportunity events (`is_gig_opportunity: true`) are visible to Artist persona only, hidden from Spectators and Venues.

---

## Affected Apps / Packages

- `apps/api` — Feed ranking endpoint, distance calculation, pagination, gig opportunity filtering
- `apps/mobile` — Feed screen (tab in bottom navigation), vertical scroll list, pagination, pull-to-refresh
- `packages/shared` — Feed event card type definitions

---

## API Endpoints

### GET /feed

Fetch algorithmically ranked events with pagination.

**Query Parameters:**

```json
{
  "latitude": 53.3432,
  "longitude": -6.2545,
  "limit": 15,
  "offset": 0,
  "persona": "spectator|artist|venue"
}
```

**Response (200 OK):**

```json
{
  "events": [
    {
      "id": "evt_001",
      "title": "Live at Temple Bar",
      "date_start": "2026-03-28T19:00:00Z",
      "date_end": "2026-03-28T23:00:00Z",
      "lat": 53.3432,
      "lng": -6.2545,
      "category": "trad_session",
      "cover_image": "https://d1234.cloudfront.net/evt_001.jpg",
      "venue_address": "Temple Bar, Dublin",
      "creator_artist_name": "Padraig O'Brien",
      "creator_profile_id": "artist_123",
      "distance_km": 0.5,
      "is_followed_creator": false,
      "ranking_score": 0.78
    }
  ],
  "hasMore": true,
  "totalCount": 245
}
```

**Error Responses:**

- `400` — Invalid parameters `{ "error": "latitude and longitude required" }`
- `401` — Unauthorized `{ "error": "Authentication required" }`
- `500` — Ranking error `{ "error": "Failed to fetch feed" }`

---

## Requirements

### Algorithmic Ranking Formula

- **Recency Score (40%)**: `1 - (daysSinceCreation / 30)`, capped at 0-1. Events created today score ~1.0; events created 30 days ago score ~0.0
- **Distance Score (40%)**: `1 - (distance_km / max_distance_km)`, capped at 0-1. Closest events score ~1.0; events >100km away score ~0.0
- **Social Score (20%)**: Binary — 1.0 if user follows the event creator, 0.0 if not
- **Final Score**: `0.4 * recency + 0.4 * distance + 0.2 * social`
- Events sorted by final score descending (highest score first)

### Feed Layout

- Events displayed as vertically scrollable cards (full-width or with margins)
- Each card shows: cover image, title, date/time, location (venue address or lat/lng), creator name (artist or venue), distance from user (e.g., "12 km away")
- Tapping a card opens Event Detail screen (same as M4-T2)
- Category badge or icon shown on each card (matching M3-T1 design)

### Pagination

- API returns 10-15 events per page (limit parameter configurable)
- Offset-based pagination: `offset = 0, 15, 30, 45, ...`
- On reaching end of list, a "Load more" button or auto-pagination loads the next batch
- `hasMore` boolean indicates whether more events exist beyond the current page
- Pull-to-refresh resets pagination and re-fetches the first page

### Gig Opportunity Visibility

- Gig opportunity events (`is_gig_opportunity: true`) shown to **Artist persona only**
- Gig opportunity events **hidden from Spectator and Venue personas** on the Feed
- Venue personas see their own events on My Events (M4-T4) but not other venues' gig opportunities on the Feed

### Empty & Error States

- If no events available in user's region, show non-blocking card: "No events nearby. Check back soon or search for a specific county."
- If API error occurs, show error toast and offer a "Retry" button
- During pagination loading, show a loading indicator (spinner) at the bottom of the list

### Saved Events Integration

- Each event card includes a **Save button** (heart icon or bookmark)
- Tapping Save adds the event to `saved_events` table (see M4-T2)
- Save button reflects saved state: filled heart if saved, outlined heart if not
- Saved state updates immediately in the UI (optimistic update, with error handling)

---

## Acceptance Criteria

- [ ] Feed screen renders with vertically scrollable event cards
- [ ] Events ranked correctly by the 40/40/20 algorithm (verified by comparing top-ranked events against formula)
- [ ] Distance calculated from user's current location (or cached location) — correct in km
- [ ] Recency score reflects event creation date — newer events ranked higher
- [ ] Social score reflects follow status — followed creators' events ranked higher
- [ ] Pagination loads 15 events per page; "Load more" or auto-pagination available
- [ ] Pull-to-refresh resets pagination and re-fetches first page
- [ ] Gig opportunity events visible to Artist persona on Feed
- [ ] Gig opportunity events hidden from Spectator persona on Feed
- [ ] Save button visible on each card; saving updates `saved_events` table
- [ ] Empty state shows non-blocking message when no events available
- [ ] Tapping an event card opens Event Detail screen with correct event data
- [ ] Distance shown on each card matches user's current location
- [ ] Loading indicator shown during pagination fetches

---

## Dependencies

### Upstream

- **M1-T2** — Events table with `created_at` timestamp for recency calculation
- **M1-T3** — API scaffold with middleware for user context and error handling
- **M2-T4** — User persona system; Feed filters by `current_role` to hide gig opportunities from Spectators
- **M3-T2** — Location resolution (user's current or cached location) for distance calculation
- **M6-T3** — Follow system; Feed queries `follows` table to determine social score
- **M4-T2** — Event Detail screen linked from Feed cards

### Downstream

- **M6-T1** (Artist Profile) — Creator names on Feed cards link to artist profiles
- **M6-T2** (Venue Profile) — Venue names on Feed cards link to venue profiles

### External Services

- None

---

## Technical Notes

### Ranking Algorithm Implementation

```typescript
// apps/api/src/services/feedRanking.ts

import { Event } from "@ceolx/shared/schema";

interface LocationCoords {
  lat: number;
  lng: number;
}

const MAX_DISTANCE_KM = 100;
const DAYS_FOR_RECENCY = 30;

export function calculateRankingScore(
  event: Event,
  userLocation: LocationCoords,
  isFollowingCreator: boolean,
): number {
  // Recency score (40%)
  const now = Date.now();
  const eventCreatedAt = new Date(event.created_at).getTime();
  const daysSince = (now - eventCreatedAt) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 1 - daysSince / DAYS_FOR_RECENCY);

  // Distance score (40%)
  const distanceKm = calculateDistance(
    userLocation.lat,
    userLocation.lng,
    event.lat,
    event.lng,
  );
  const distanceScore = Math.max(0, 1 - distanceKm / MAX_DISTANCE_KM);

  // Social score (20%)
  const socialScore = isFollowingCreator ? 1.0 : 0.0;

  // Final score
  const finalScore =
    0.4 * recencyScore + 0.4 * distanceScore + 0.2 * socialScore;

  return finalScore;
}

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  // Haversine formula
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

### Feed Endpoint — Hono Handler

```typescript
// apps/api/src/routes/feed.ts

import { Hono } from "hono";
import { getAuth } from "hono/better-auth";
import { db } from "../db";
import { events, follows, saved_events } from "@ceolx/shared/schema";
import { eq, sql, and } from "drizzle-orm";
import { calculateRankingScore } from "../services/feedRanking";

const app = new Hono();

app.get("/feed", async (c) => {
  const auth = getAuth(c);
  if (!auth) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const latitude = parseFloat(c.req.query("latitude") || "");
  const longitude = parseFloat(c.req.query("longitude") || "");
  const limit = parseInt(c.req.query("limit") || "15", 10);
  const offset = parseInt(c.req.query("offset") || "0", 10);
  const persona = c.req.query("persona") || "spectator";

  if (isNaN(latitude) || isNaN(longitude)) {
    return c.json({ error: "latitude and longitude required" }, 400);
  }

  try {
    // Fetch all active upcoming events
    let query = db
      .select({
        event: events,
      })
      .from(events)
      .where(
        and(eq(events.status, "active"), sql`${events.date_start} >= NOW()`),
      );

    // Hide gig opportunities from non-artists
    if (persona !== "artist") {
      query = query.where(eq(events.is_gig_opportunity, false));
    }

    const allEvents = await query;

    // Fetch follows for the current user
    const userFollows = await db
      .select({ created_by: events.created_by })
      .from(follows)
      .where(eq(follows.follower_id, auth.user.id));

    const followedCreatorIds = new Set(userFollows.map((f) => f.created_by));

    // Calculate ranking scores
    const rankedEvents = allEvents
      .map((e) => ({
        ...e.event,
        ranking_score: calculateRankingScore(
          e.event,
          { lat: latitude, lng: longitude },
          followedCreatorIds.has(e.event.created_by),
        ),
        is_followed_creator: followedCreatorIds.has(e.event.created_by),
      }))
      .sort((a, b) => b.ranking_score - a.ranking_score);

    // Apply pagination
    const paginatedEvents = rankedEvents.slice(offset, offset + limit);

    // Check if user has saved each event
    const savedEventIds = await db
      .select({ event_id: saved_events.event_id })
      .from(saved_events)
      .where(eq(saved_events.user_id, auth.user.id));

    const savedSet = new Set(savedEventIds.map((s) => s.event_id));

    return c.json({
      events: paginatedEvents.map((e) => ({
        id: e.id,
        title: e.title,
        date_start: e.date_start,
        date_end: e.date_end,
        lat: e.lat,
        lng: e.lng,
        category: e.category,
        cover_image: e.cover_image,
        venue_address: e.venue_address,
        creator_profile_id: e.created_by,
        distance_km: calculateDistance(latitude, longitude, e.lat, e.lng),
        is_followed_creator: e.is_followed_creator,
        ranking_score: e.ranking_score,
        is_saved: savedSet.has(e.id),
      })),
      hasMore: offset + limit < rankedEvents.length,
      totalCount: rankedEvents.length,
    });
  } catch (error) {
    console.error("Feed fetch error:", error);
    return c.json({ error: "Failed to fetch feed" }, 500);
  }
});

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c + Number.EPSILON) * 10) / 10; // Round to 1 decimal
}
```

### Feed Screen Component (React Native)

```typescript
// apps/mobile/src/screens/FeedScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useUserLocation } from '../hooks/useLocationPermission';
import { api } from '../services/api';

interface FeedEvent {
  id: string;
  title: string;
  date_start: string;
  lat: number;
  lng: number;
  category: string;
  cover_image: string;
  venue_address: string;
  distance_km: number;
  is_followed_creator: boolean;
  ranking_score: number;
  is_saved: boolean;
}

export const FeedScreen: React.FC = () => {
  const { location } = useUserLocation();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const currentPersona = 'spectator'; // Get from auth context

  const fetchFeed = useCallback(
    async (pageOffset: number = 0) => {
      if (!location) return;

      const isRefresh = pageOffset === 0;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const response = await api.get('/feed', {
          params: {
            latitude: location.lat,
            longitude: location.lng,
            limit: 15,
            offset: pageOffset,
            persona: currentPersona,
          },
        });

        if (isRefresh) {
          setEvents(response.data.events);
        } else {
          setEvents((prev) => [...prev, ...response.data.events]);
        }

        setOffset(pageOffset + response.data.events.length);
        setHasMore(response.data.hasMore);
      } catch (error) {
        console.error('Feed fetch error:', error);
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [location, currentPersona]
  );

  useEffect(() => {
    fetchFeed(0);
  }, [location]);

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      fetchFeed(offset);
    }
  };

  const handleRefresh = () => {
    setOffset(0);
    fetchFeed(0);
  };

  const renderEvent = ({ item }: { item: FeedEvent }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        // Navigate to Event Detail
      }}
    >
      <Image
        source={{ uri: item.cover_image }}
        style={styles.coverImage}
      />
      <View style={styles.cardContent}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.date}>
          {new Date(item.date_start).toLocaleDateString()}
        </Text>
        <Text style={styles.location}>
          {item.venue_address} · {item.distance_km} km away
        </Text>
        <Text style={styles.category}>{item.category}</Text>
      </View>
      <TouchableOpacity style={styles.saveButton}>
        <Text style={styles.saveIcon}>
          {item.is_saved ? '❤️' : '🤍'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        ListFooterComponent={
          loading ? (
            <ActivityIndicator
              size="large"
              color="#0000ff"
              style={styles.loader}
            />
          ) : null
        }
        ListEmptyComponent={
          !refreshing && (
            <Text style={styles.emptyText}>
              No events nearby. Check back soon or search for a specific county.
            </Text>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  card: {
    margin: 12,
    borderRadius: 8,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  coverImage: {
    width: '100%',
    height: 180,
  },
  cardContent: {
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  location: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  category: {
    fontSize: 11,
    backgroundColor: '#E8F4F8',
    color: '#0077BE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  saveButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
  },
  saveIcon: {
    fontSize: 20,
  },
  loader: {
    marginVertical: 20,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
    color: '#999',
  },
});
```

### Environment Variables Required

```
# apps/mobile/.env
REACT_APP_API_BASE_URL=https://api.ceolx.ie

# apps/api/.env.local
DATABASE_URL=postgresql://user:password@ep-xxxxx.neon.tech/ceolx_db
```

---

## Common Gotchas

- **Location staleness**: If user's cached location is >1 hour old, distance calculations may be inaccurate for users who've traveled. Consider adding a "Refresh Location" button or re-requesting GPS periodically.
- **Algorithm weights misalignment**: If 40/40/20 weighting doesn't feel natural in practice, adjust based on user feedback. Higher recency weight (e.g., 50/30/20) may surface newer events more prominently.
- **Performance at scale**: If database contains 10,000+ events, fetching all events and then sorting in-memory is slow. Consider pre-calculating ranking scores at event creation/update time and storing in the DB, or using a dedicated ranking service.
- **Gig opportunity filtering logic**: Ensure the persona is correctly determined from auth context. A user switching from Artist to Spectator should immediately stop seeing gig opportunities on the Feed.
- **Pagination state after refresh**: Pull-to-refresh resets offset to 0 and re-fetches page 1. If user was on page 3, pagination state must reset cleanly — otherwise, tapping "Load more" may skip pages or show duplicates.
