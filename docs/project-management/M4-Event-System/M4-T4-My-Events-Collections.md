# M4-T4 · My Events View + Collections

| Field          | Value                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M4 — Event System                                                                                                            |
| **Status**     | 🔲 To Do                                                                                                                     |
| **Depends on** | M4-T1 (events created), M4-T2 (event detail with save), M2-T4 (persona system), M10-T1 (S3 media)                            |
| **PRD Ref**    | Section 5.1 (End User Features), Section 6.1 (Artist Features), Section 7.1 (Venue Features), Section 9.3 (Event Data Model) |

---

## Description

Two profile-oriented features for event management. **My Created Events** allows Artists and Venues to view and manage all events they've created, grouped by status (Active, Pending Review, Rejected, Archived). Each event shows title, date, status badge, and rejection reason (if applicable). **Collections** (Venue-only) groups related events under a branded entity with a custom logo. Venues can create collections, assign events to them during event creation, and view collection pages showing all associated events. **Saved Events** (visible to all personas) displays events bookmarked by the user via the Save button. Saved events list shows upcoming events by default with a collapsible section for past (archived) saved events.

---

## Affected Apps / Packages

| App / Package     | Role                                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`        | GET /users/me/events, GET /users/me/saved-events, collections CRUD endpoints (POST, GET, PATCH, DELETE), event-collection associations        |
| `apps/mobile`     | My Events section (Profile tab), Collections management screen (Venue only), Saved Events section (all personas), event status grouping logic |
| `packages/shared` | Collection and saved_events types, event grouping utilities                                                                                   |

---

## API Endpoints

### GET /api/v1/users/me/events

List all events created by the authenticated user.

**Query Parameters:**

```json
{
  "limit": 20,
  "offset": 0
}
```

**Response (200 OK):**

```json
{
  "events": [
    {
      "id": "evt_abc123def456",
      "title": "Live at Temple Bar",
      "date_start": "2026-03-28T19:00:00Z",
      "cover_image": "https://d1234.cloudfront.net/evt_abc123.jpg",
      "status": "active" | "pending_review" | "rejected" | "archived",
      "rejection_reason": "Venue address unclear",
      "category": "trad_session"
    }
  ],
  "total_count": 12
}
```

**Error Responses:**

- `401 Unauthorized`: User not authenticated

### GET /api/v1/users/me/saved-events

List all events saved by the authenticated user.

**Query Parameters:**

```json
{
  "limit": 20,
  "offset": 0,
  "include_archived": false
}
```

**Response (200 OK):**

```json
{
  "events": [
    {
      "id": "evt_abc123def456",
      "title": "Live at Temple Bar",
      "date_start": "2026-03-28T19:00:00Z",
      "date_end": "2026-03-28T23:00:00Z",
      "cover_image": "https://d1234.cloudfront.net/evt_abc123.jpg",
      "venue_address": "Temple Bar, Dublin",
      "category": "trad_session",
      "status": "active" | "archived",
      "creator_name": "Padraig O'Brien",
      "saved_at": "2026-03-25T10:15:00Z"
    }
  ],
  "total_count": 8
}
```

**Error Responses:**

- `401 Unauthorized`: User not authenticated

### POST /api/v1/collections

Create a new collection.

**Request Body:**

```json
{
  "name": "string (required, max 100 chars)",
  "logo": "string (optional, CloudFront CDN URL after S3 upload)"
}
```

**Response (201 Created):**

```json
{
  "id": "coll_xyz789",
  "name": "Spring Festival Series",
  "logo": "https://d1234.cloudfront.net/coll_xyz789.jpg",
  "created_by": "venue_123",
  "event_count": 0,
  "created_at": "2026-03-20T10:30:00Z"
}
```

**Error Responses:**

- `400 Bad Request`: Name is required or exceeds 100 chars
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User is not a venue

### GET /api/v1/collections/:id

Get collection details with all associated events.

**Response (200 OK):**

```json
{
  "id": "coll_xyz789",
  "name": "Spring Festival Series",
  "logo": "https://d1234.cloudfront.net/coll_xyz789.jpg",
  "created_by": "venue_123",
  "events": [
    {
      "id": "evt_abc123def456",
      "title": "Live at Temple Bar",
      "date_start": "2026-03-28T19:00:00Z",
      "cover_image": "https://d1234.cloudfront.net/evt_abc123.jpg",
      "status": "active"
    }
  ],
  "event_count": 1,
  "created_at": "2026-03-20T10:30:00Z"
}
```

**Error Responses:**

- `404 Not Found`: Collection not found

### PATCH /api/v1/collections/:id

Edit collection name and/or logo.

**Request Body:**

```json
{
  "name": "string (optional, max 100 chars)",
  "logo": "string (optional, CloudFront CDN URL)"
}
```

**Response (200 OK):** Updated collection object (same as GET response).

**Error Responses:**

- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User is not the collection owner
- `404 Not Found`: Collection not found

### DELETE /api/v1/collections/:id

Delete a collection. Associated events are NOT deleted — their `collection_id` is set to null.

**Response (204 No Content):** Empty response on success.

**Error Responses:**

- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User is not the collection owner
- `404 Not Found`: Collection not found

---

## Requirements

### My Created Events

- **Display**: FlatList showing all events created by the authenticated user
- **Grouping**: Client-side grouping by status: "Active", "Pending Review", "Rejected", "Archived (Past)"
- **Each event card shows**: Cover image thumbnail (80x60px), title, date/time, status badge with color (green=active, blue=pending, red=rejected, gray=archived)
- **Rejected events**: Show rejection reason as a subtitle below the event title
- **Interaction**: Tap event to navigate to Event Detail screen
- **Empty state**: "You haven't created any events yet. Create one to get started!"
- **Only visible to**: Artist and Venue personas (not Spectators)

### Collections (Venue-Only)

- **Creation**: Venue can create a collection with name (required, max 100 chars) and optional logo image
- **Logo upload**: Direct to S3 via presigned URL, stored as CloudFront CDN URL
- **Display**: List of collections in Venue's Profile section
- **Collection detail page**: Shows collection logo, name, description (optional), and all associated events (as cards)
- **Editing**: Venue can edit collection name and logo
- **Deletion**: Deleting a collection removes the collection record but keeps events (they lose `collection_id` FK)
- **Event assignment**: When creating or editing an event, Venue can optionally assign it to a collection
- **Visible to**: Venue persona only

### Saved Events (All Personas)

- **Display**: FlatList showing all events saved by the authenticated user via the Save button (M4-T2)
- **Default view**: Shows upcoming saved events (status = active, date_start >= now)
- **Collapsible section**: "Past Saved Events" below upcoming events, showing archived saved events (status = archived or date_start < now)
- **Each event card shows**: Cover image, title, date/time, venue/location, creator name
- **Interaction**: Tap event to navigate to Event Detail
- **State sync**: If user unsaves an event (via Event Detail), the list updates on next load
- **Empty state**: "You haven't saved any events yet. Tap the heart icon on an event to save it."
- **Visible to**: All personas (Spectator, Artist, Venue)

---

## Acceptance Criteria

- [ ] My Created Events visible on Artist profile tab (Artist persona only)
- [ ] My Created Events visible on Venue profile tab (Venue persona only)
- [ ] Events grouped correctly by status: Active (green badge), Pending Review (blue badge), Rejected (red badge), Archived (gray badge)
- [ ] Rejected events display rejection reason as subtitle
- [ ] Tapping a created event navigates to Event Detail screen
- [ ] Saved Events visible for ALL personas (Spectator, Artist, Venue) in their Profile tab
- [ ] Saved Events shows upcoming events by default (status=active, date in future)
- [ ] Saved Events has collapsible "Past Saved Events" section showing archived or past events
- [ ] Tapping a saved event navigates to Event Detail
- [ ] Removing save from Event Detail (M4-T2) is reflected in Saved Events list (on next load)
- [ ] Venue can create a collection with name (required) and optional logo
- [ ] Collection logo uploads to S3 and displays as CloudFront URL
- [ ] Venue can view list of their collections on Profile
- [ ] Venue can tap collection to view detail page with logo, name, and all associated events
- [ ] Venue can edit collection name and/or logo
- [ ] Venue can delete a collection without deleting its events (events lose collection_id)
- [ ] When creating or editing an event, Venue can assign it to a collection (dropdown/selector)
- [ ] Artist and Spectator personas have no Collections UI visible
- [ ] Artist persona cannot see Collections in Profile, even if they created events

---

## Dependencies

### Upstream

- **M4-T1** — Events created; My Created Events queries user's events
- **M4-T2** — Saved Events button populates saved_events table
- **M2-T4** — Persona system; My Created Events and Collections are persona-specific
- **M10-T1** — S3 + CloudFront for collection logos and event images

### Downstream

- **M4-T2** — Event Detail save/unsave affects Saved Events list
- **M6-T1**, **M6-T2** — Creator names in Saved Events link to artist/venue profiles

### External Services

- **AWS S3** — Collection logo storage
- **AWS CloudFront** — CDN for collection logos

---

## Technical Notes

### My Created Events Endpoint (Hono)

```typescript
// apps/server/src/routes/users.ts

import { Hono } from 'hono';
import { getAuth } from 'hono/better-auth';
import { db } from '../db';
import { events } from '@ceolx/shared/schema';
import { eq } from 'drizzle-orm';

app.get('/users/me/events', async (c) => {
  const auth = await requireAuth(c);
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  try {
    // Get all events created by user (via artist or venue profile)
    const userEvents = await db
      .select()
      .from(events)
      .where(eq(events.created_by, auth.user.id))
      .orderBy(desc(events.created_at))
      .limit(limit)
      .offset(offset);

    const totalCount = await db
      .select({ count: sql`count(*)` })
      .from(events)
      .where(eq(events.created_by, auth.user.id));

    return c.json({
      events: userEvents,
      total_count: parseInt(totalCount[0].count),
    });
  } catch (error) {
    console.error('My events fetch error:', error);
    return c.json({ error: 'Failed to fetch your events' }, 500);
  }
});
```

### Saved Events Endpoint (Hono)

```typescript
app.get('/users/me/saved-events', async (c) => {
  const auth = await requireAuth(c);
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const includeArchived = c.req.query('include_archived') === 'true';

  try {
    let query = db
      .select({
        event: events,
        saved_at: saved_events.saved_at,
      })
      .from(saved_events)
      .innerJoin(events, eq(saved_events.event_id, events.id))
      .where(eq(saved_events.user_id, auth.user.id))
      .orderBy(desc(saved_events.saved_at));

    if (!includeArchived) {
      query = query.where(eq(events.status, 'active'));
    }

    const savedEvents = await query.limit(limit).offset(offset);

    const totalCount = await db
      .select({ count: sql`count(*)` })
      .from(saved_events)
      .where(eq(saved_events.user_id, auth.user.id));

    return c.json({
      events: savedEvents.map((s) => ({
        ...s.event,
        saved_at: s.saved_at,
      })),
      total_count: parseInt(totalCount[0].count),
    });
  } catch (error) {
    console.error('Saved events fetch error:', error);
    return c.json({ error: 'Failed to fetch saved events' }, 500);
  }
});
```

### Collections CRUD (Hono)

```typescript
// apps/server/src/routes/collections.ts

import { Hono } from 'hono';
import { getAuth } from 'hono/better-auth';
import { db } from '../db';
import { collections, events } from '@ceolx/shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const CollectionSchema = z.object({
  name: z.string().min(1).max(100),
  logo: z.string().url().optional(),
});

app.post('/collections', zValidator('json', CollectionSchema), async (c) => {
  const auth = await requireAuth(c);
  const data = c.req.valid('json');

  // Verify user is a venue
  const venueProfile = await db.query.venue_profiles.findFirst({
    where: (profiles, { eq }) => eq(profiles.user_id, auth.user.id),
  });

  if (!venueProfile) {
    return c.json({ error: 'Only venues can create collections' }, 403);
  }

  const collection = await db
    .insert(collections)
    .values({
      name: data.name,
      logo: data.logo || null,
      created_by: venueProfile.id,
      created_at: new Date(),
    })
    .returning();

  return c.json(collection[0], 201);
});

app.get('/collections/:id', async (c) => {
  const collectionId = c.req.param('id');

  const collection = await db.query.collections.findFirst({
    where: (coll, { eq }) => eq(coll.id, collectionId),
    with: {
      events: {
        columns: {
          id: true,
          title: true,
          date_start: true,
          cover_image: true,
          status: true,
        },
      },
    },
  });

  if (!collection) {
    return c.json({ error: 'Collection not found' }, 404);
  }

  return c.json({
    ...collection,
    event_count: collection.events.length,
  });
});

app.patch('/collections/:id', zValidator('json', CollectionSchema.partial()), async (c) => {
  const auth = await requireAuth(c);
  const collectionId = c.req.param('id');
  const data = c.req.valid('json');

  const collection = await db.query.collections.findFirst({
    where: (coll, { eq }) => eq(coll.id, collectionId),
  });

  if (!collection) {
    return c.json({ error: 'Collection not found' }, 404);
  }

  // Verify ownership
  const venueProfile = await db.query.venue_profiles.findFirst({
    where: (profiles, { eq }) => eq(profiles.user_id, auth.user.id),
  });

  if (!venueProfile || collection.created_by !== venueProfile.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const updated = await db
    .update(collections)
    .set({
      name: data.name !== undefined ? data.name : collection.name,
      logo: data.logo !== undefined ? data.logo : collection.logo,
    })
    .where(eq(collections.id, collectionId))
    .returning();

  return c.json(updated[0]);
});

app.delete('/collections/:id', async (c) => {
  const auth = await requireAuth(c);
  const collectionId = c.req.param('id');

  const collection = await db.query.collections.findFirst({
    where: (coll, { eq }) => eq(coll.id, collectionId),
  });

  if (!collection) {
    return c.json({ error: 'Collection not found' }, 404);
  }

  const venueProfile = await db.query.venue_profiles.findFirst({
    where: (profiles, { eq }) => eq(profiles.user_id, auth.user.id),
  });

  if (!venueProfile || collection.created_by !== venueProfile.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Remove collection_id from all associated events
  await db
    .update(events)
    .set({ collection_id: null })
    .where(eq(events.collection_id, collectionId));

  // Delete collection
  await db.delete(collections).where(eq(collections.id, collectionId));

  return c.status(204).body('');
});
```

### My Events Screen (React Native)

```typescript
// apps/native/src/screens/MyEventsScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  SectionList,
  ActivityIndicator,
} from 'react-native';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';

interface Event {
  id: string;
  title: string;
  date_start: string;
  cover_image: string;
  status: 'active' | 'pending_review' | 'rejected' | 'archived';
  rejection_reason?: string;
}

interface EventSection {
  title: string;
  data: Event[];
}

export const MyEventsScreen: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyEvents();
  }, []);

  const fetchMyEvents = async () => {
    try {
      const res = await api.get('/users/me/events');
      setEvents(res.data.events);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Active', color: '#34C759' };
      case 'pending_review':
        return { label: 'Pending Review', color: '#007AFF' };
      case 'rejected':
        return { label: 'Rejected', color: '#FF3B30' };
      case 'archived':
        return { label: 'Archived', color: '#999999' };
      default:
        return { label: status, color: '#666666' };
    }
  };

  const sections: EventSection[] = [
    {
      title: 'Active',
      data: events.filter((e) => e.status === 'active'),
    },
    {
      title: 'Pending Review',
      data: events.filter((e) => e.status === 'pending_review'),
    },
    {
      title: 'Rejected',
      data: events.filter((e) => e.status === 'rejected'),
    },
    {
      title: 'Archived',
      data: events.filter((e) => e.status === 'archived'),
    },
  ].filter((s) => s.data.length > 0);

  const renderEventCard = ({ item }: { item: Event }) => {
    const status = getStatusLabel(item.status);
    return (
      <TouchableOpacity style={styles.eventCard}>
        <Image source={{ uri: item.cover_image }} style={styles.eventImage} />
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.eventDate}>
            {new Date(item.date_start).toLocaleDateString()}
          </Text>
          {item.rejection_reason && (
            <Text style={styles.rejectionReason}>
              Rejected: {item.rejection_reason}
            </Text>
          )}
        </View>
        <View
          style={[styles.statusBadge, { backgroundColor: status.color }]}
        >
          <Text style={styles.statusLabel}>{status.label}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>You haven't created any events yet.</Text>
        <Text style={styles.emptySubtext}>Create one to get started!</Text>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={renderEventCard}
      renderSectionHeader={({ section: { title } }) => (
        <Text style={styles.sectionHeader}>{title}</Text>
      )}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  contentContainer: { padding: 16 },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    marginVertical: 12,
    color: '#333',
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  eventImage: { width: 80, height: 80 },
  eventInfo: { flex: 1, padding: 12 },
  eventTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  eventDate: { fontSize: 12, color: '#666', marginBottom: 4 },
  rejectionReason: { fontSize: 11, color: '#FF3B30', fontStyle: 'italic' },
  statusBadge: { justifyContent: 'center', alignItems: 'center', padding: 8 },
  statusLabel: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#666', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#999' },
});
```

### Common Gotchas

- **Status grouping client-side**: API returns events unsorted; mobile app must group by status. Pre-sort API results by status to reduce mobile work.
- **Rejection reason truncation**: Some reasons may be long; wrap text or show ellipsis with "..." and full text on tap.
- **Collection deletion**: Ensure events are not deleted when collection is deleted — only the FK is removed.
- **Saved Events sync**: Saving/unsaving events in Event Detail doesn't update Saved Events list until next load. Consider WebSocket or optimistic UI updates.
- **Empty state**: Make sure empty states are clear and encourage user to take action (create events, save events).
