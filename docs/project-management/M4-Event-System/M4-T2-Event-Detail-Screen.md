# M4-T2 · Event Detail Screen

| Field          | Value                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M4 — Event System                                                                                                           |
| **Status**     | ✅ Complete                                                                                                                 |
| **Depends on** | M4-T1 (events must exist), M3-T1 (map pins link to this screen), M3-T4 (feed cards link to this), M4-T4 (saved events view) |
| **PRD Ref**    | Section 5.1 (End User Features), Section 6.1 (Artist Features), Section 9.3 (Event Data Model)                              |

---

## Description

The full event detail view — the canonical source of event information. Accessible by tapping a map pin (opens as a bottom sheet preview with expand option), a feed card (full screen), or a saved/created event listing. Shows all event data: cover image, title, date/time, location, description, category, ticket link, and collaborating artists. Provides persona-aware actions: Spectators and Artists can save events; Artists can apply to gig opportunities; creators can edit their own events; all users can share and add to their calendar. Rejected events display the admin's rejection reason only to the creator.

---

## Affected Apps / Packages

| App / Package  | Role                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| `packages/api` | `events.byId`, `events.save`, `events.unsave` — tRPC procedures                                               |
| `apps/mobile`  | Event Detail screen (full screen modal), bottom sheet variant (from map pin), save/calendar/share integration |

---

## tRPC Procedures

### `events.byId` (publicProcedure · query)

Fetch full event detail. Visibility rules apply server-side: `pending_review` / `rejected` / `archived` events return `NOT_FOUND` to non-creators.

**Input:** `{ id: string }`

**Output** (key fields):

```typescript
{
  id, title, description, coverImage,
  dateStart, dateEnd, lat, lng, venueAddress,
  category, ticketLink, isGigOpportunity,
  status: "active" | "pending_review" | "rejected" | "archived",
  rejectionReason: string | null,
  creator: { id, name, type: "artist" | "venue", profilePicture },
  collaborators: Array<{ id, name, profilePicture }>,
  isSaved: boolean,   // false if caller is unauthenticated
  createdAt, updatedAt,
}
```

**tRPC errors:**

- `NOT_FOUND` — Event not found, archived (non-creator), or not yet approved (non-creator)

### `events.save` (protectedProcedure · mutation)

Save event to current user's saved list.

**Input:** `{ id: string }`

**tRPC errors:** `NOT_FOUND` — event not found; `BAD_REQUEST` — already saved

### `events.unsave` (protectedProcedure · mutation)

Remove event from current user's saved list.

**Input:** `{ id: string }`

**Mobile usage:**

```typescript
// Fetch detail
const event = await trpc.events.byId.query({ id: eventId });

// Toggle save (optimistic)
if (event.isSaved) {
  await trpc.events.unsave.mutate({ id: eventId });
} else {
  await trpc.events.save.mutate({ id: eventId });
}
```

---

## Requirements

### Display & Layout

- **Cover image** at top (16:9 aspect ratio, 300px height on mobile)
- **Title** bold, large font, below image
- **Category badge** with icon (color-coded by category)
- **Date/time** in readable format (e.g. "Fri, Mar 28 · 7:00 PM - 11:00 PM")
- **Location** showing address or lat/lng, with small map preview (if possible)
- **Description** body text, markdown-supported for bold/links
- **Creator profile** section showing artist/venue name, picture, link to profile
- **Collaborators** section (if any) showing list of linked artists
- **Ticket link** (if present) as a button: "Get Tickets → External Link"

### Persona-Aware Actions

- **All users**: Save button (heart icon, filled if already saved), Share button, Save to Calendar button
- **Artists**: "Apply" button on gig opportunity events (disabled if already applied, links to Booking flow M5)
- **Event creators** (if status = draft/pending_review/rejected): Edit button (navigates to Edit Event screen)
- **Creators of rejected events**: Rejection reason displayed prominently (yellow background, clear messaging)
- **Spectators**: No edit/manage controls; only save/share/calendar

### Save Functionality

- Save button toggles between filled (saved) and outline (unsaved) heart icon
- Tapping save inserts row into `saved_events(user_id, event_id)` via API
- Tapping unsave removes the row
- Save state persists across app sessions (backed by DB)
- Optimistic UI: button state updates immediately; error handling if API fails

### Save to Calendar

- "Add to Calendar" button visible on all events for all personas
- On tap: request `WRITE_CALENDAR` permission (expo-calendar)
- Creates calendar event with:
  - Title: event title
  - Date/time: `date_start` and `date_end`
  - Location: venue address or coordinates (human-readable)
  - Description: event description (optional)
- Opens device's native calendar app (iOS Calendar, Google Calendar on Android)
- Gracefully handle permission denial (show info toast, don't crash)

### Bottom Sheet Variant (Map Pin Tap)

- Condensed preview: cover image (smaller), title, date, location, category
- "See full details" button expands to full Event Detail screen
- All action buttons (save, share, apply) available in condensed view
- Swipe down to dismiss

### Visibility & Access Control

- **Active events** visible to all users
- **Pending/rejected events** visible only to creator
- **Archived events** visible to creator only; other users see 404
- **Gig opportunities** (`is_gig_opportunity: true`) visible to:
  - All users if status = active
  - Creator only if status = pending_review or rejected

### Rejection Reason Display

- If `status = rejected` and user is creator: display banner at top:
  - Background: yellow/warning color
  - Text: "Your event was rejected: [rejection_reason]. You can edit and resubmit."
  - Button: "Edit Event"

---

## Acceptance Criteria

- [ ] Tapping a map pin (M3-T1) opens Event Detail bottom sheet with preview
- [ ] "See full details" in bottom sheet expands to full Event Detail screen
- [ ] Tapping a feed card (M3-T4) opens Event Detail full screen
- [ ] All event fields display correctly: title, cover image, date, location, description, category
- [ ] Cover image displays at 16:9 aspect ratio (300px height on mobile)
- [ ] Ticket link button visible and tappable (opens in external browser)
- [ ] Collaborating artists displayed with profile pictures and names; names are tappable links
- [ ] Creator profile section shows artist/venue name and profile picture; name is tappable link
- [ ] Save button visible on all Event Detail screens; toggles between filled/outline heart
- [ ] Save persists across app restarts (database backed)
- [ ] Share button opens device share sheet with event title + deep link
- [ ] Save to Calendar button requests WRITE_CALENDAR permission (first time only)
- [ ] Save to Calendar creates native calendar event with correct title, date, time, location
- [ ] Artists see "Apply" button on gig opportunity events; button links to Booking flow (M5)
- [ ] Event creator sees "Edit" button for draft/pending_review/rejected events
- [ ] Rejected events show rejection reason in yellow banner with "Edit Event" button
- [ ] Spectators see no edit controls on any event
- [ ] Archived events return 404 (except to creator, who sees it read-only)
- [ ] Bottom sheet can be swiped down to dismiss
- [ ] All links (creator, collaborators, ticket) open correctly in their respective targets

---

## Dependencies

### Upstream

- **M4-T1** — Events must be created; Event Detail displays them
- **M3-T1** — Map pins tap to open Event Detail bottom sheet
- **M3-T4** — Feed cards tap to open Event Detail full screen
- **M2-T4** — Persona system; UI actions are persona-aware

### Downstream

- **M4-T4** — Saved Events view queries `saved_events` table for list of saved events
- **M5-T1** (Booking Flow) — "Apply" button on gig opportunities links to booking interface
- **M6-T1** (Artist Profile) — Creator and collaborator names link to artist profiles
- **M6-T2** (Venue Profile) — Venue names (if applicable) link to venue profiles

### External Services

- **expo-calendar** — Native calendar integration for Save to Calendar
- **Linking API (React Native)** — Open external ticket URLs
- **expo-sharing** — Device share sheet for event sharing

---

## Technical Notes

### Event Detail Endpoint (Hono Backend)

```typescript
// apps/server/src/routes/events.ts

import { Hono } from 'hono';
import { getAuth } from 'hono/better-auth';
import { db } from '../db';
import { events, saved_events, artist_profiles } from '@ceolx/shared/schema';
import { eq } from 'drizzle-orm';

app.get('/events/:id', async (c) => {
  const auth = getAuth(c); // Optional for public events
  const eventId = c.req.param('id');

  // Fetch event with creator details
  const event = await db.query.events.findFirst({
    where: (events, { eq }) => eq(events.id, eventId),
    with: {
      creator: {
        columns: { id: true, name: true, profile_picture: true },
      },
      collaborators: {
        with: {
          artist: {
            columns: { id: true, name: true, profile_picture: true },
          },
        },
      },
    },
  });

  if (!event) {
    return c.json({ error: 'Event not found' }, 404);
  }

  // Check visibility
  if (
    event.status === 'archived' ||
    event.status === 'rejected' ||
    event.status === 'pending_review'
  ) {
    if (!auth || auth.user.id !== event.created_by) {
      return c.json({ error: 'Event not found' }, 404);
    }
  }

  // Check if user has saved this event
  let isSaved = false;
  if (auth) {
    const saved = await db.query.saved_events.findFirst({
      where: (saved, { and, eq }) =>
        and(eq(saved.user_id, auth.user.id), eq(saved.event_id, eventId)),
    });
    isSaved = !!saved;
  }

  return c.json({
    ...event,
    creator: event.creator,
    collaborators: event.collaborators.map((c) => c.artist),
    is_saved: isSaved,
  });
});

app.post('/events/:id/save', async (c) => {
  const auth = await requireAuth(c);
  const eventId = c.req.param('id');

  // Check event exists
  const event = await db.query.events.findFirst({
    where: (events, { eq }) => eq(events.id, eventId),
  });

  if (!event) {
    return c.json({ error: 'Event not found' }, 404);
  }

  // Check if already saved
  const existing = await db.query.saved_events.findFirst({
    where: (saved, { and, eq }) =>
      and(eq(saved.user_id, auth.user.id), eq(saved.event_id, eventId)),
  });

  if (existing) {
    return c.json({ error: 'Event already saved' }, 400);
  }

  // Insert save
  const saved = await db
    .insert(saved_events)
    .values({
      user_id: auth.user.id,
      event_id: eventId,
      saved_at: new Date(),
    })
    .returning();

  setResponseStatus(c, 201);
  return c.json(saved[0]);
});

app.delete('/events/:id/save', async (c) => {
  const auth = await requireAuth(c);
  const eventId = c.req.param('id');

  // Delete save relationship
  await db
    .delete(saved_events)
    .where((saved, { and, eq }) =>
      and(eq(saved.user_id, auth.user.id), eq(saved.event_id, eventId))
    );

  setResponseStatus(c, 204);
  return new Response();
});
```

### Event Detail Screen Component (React Native)

```typescript
// apps/native/src/screens/EventDetailScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Share,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Calendar from 'expo-calendar';
import * as Sharing from 'expo-sharing';
import { useRoute } from '@react-navigation/native';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { CalendarBadge, CategoryBadge, HeartIcon, ShareIcon } from '../components/Icons';

interface Event {
  id: string;
  title: string;
  description: string;
  cover_image: string;
  date_start: string;
  date_end?: string;
  lat: number;
  lng: number;
  venue_address: string;
  category: string;
  ticket_link?: string;
  is_gig_opportunity: boolean;
  status: 'active' | 'pending_review' | 'rejected' | 'archived';
  rejection_reason?: string;
  creator: { id: string; name: string; profile_picture: string };
  collaborators: Array<{ id: string; name: string; profile_picture: string }>;
  is_saved: boolean;
}

export const EventDetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const { eventId } = route.params;
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const res = await api.get(`/events/${eventId}`);
      setEvent(res.data);
      setIsSaved(res.data.is_saved);
    } catch (error) {
      Alert.alert('Error', 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const toggleSave = async () => {
    if (!user) {
      Alert.alert('Sign in', 'You need to be signed in to save events');
      return;
    }

    setSaving(true);
    try {
      if (isSaved) {
        await api.delete(`/events/${eventId}/save`);
        setIsSaved(false);
      } else {
        await api.post(`/events/${eventId}/save`, {});
        setIsSaved(true);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!event) return;

    try {
      await Share.share({
        message: `Check out this event: ${event.title}`,
        url: `https://ceolx.com/events/${event.id}`,
        title: event.title,
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const addToCalendar = async () => {
    if (!event) return;

    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission', 'Calendar permission required to add events');
        return;
      }

      const calendars = await Calendar.getCalendarsAsync();
      const primary = calendars.find((c) => c.isPrimary) || calendars[0];

      if (!primary) {
        Alert.alert('Error', 'No calendar found');
        return;
      }

      const eventId = await Calendar.createEventAsync(primary.id, {
        title: event.title,
        startDate: new Date(event.date_start),
        endDate: event.date_end ? new Date(event.date_end) : new Date(event.date_start),
        location: event.venue_address,
        notes: event.description,
        timeZone: 'Europe/Dublin',
      });

      Alert.alert('Success', 'Event added to your calendar');
    } catch (error) {
      console.error('Calendar error:', error);
      Alert.alert('Error', 'Failed to add to calendar');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Event not found</Text>
      </View>
    );
  }

  const isCreator = user?.id === event.creator.id;
  const canEdit = isCreator && ['draft', 'pending_review', 'rejected'].includes(event.status);
  const isArtist = user?.current_role === 'artist';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Cover Image */}
      <Image
        source={{ uri: event.cover_image }}
        style={styles.coverImage}
      />

      {/* Rejection Banner */}
      {event.status === 'rejected' && isCreator && (
        <View style={styles.rejectionBanner}>
          <Text style={styles.rejectionText}>
            <strong>Event was rejected:</strong> {event.rejection_reason}
          </Text>
          {canEdit && (
            <TouchableOpacity
              onPress={() => {/* Navigate to Edit */}}
              style={styles.editButton}
            >
              <Text style={styles.editButtonText}>Edit Event</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Title, Category, Date */}
      <View style={styles.headerSection}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{event.title}</Text>
          <TouchableOpacity
            onPress={toggleSave}
            disabled={saving}
            style={styles.saveButton}
          >
            <HeartIcon filled={isSaved} />
          </TouchableOpacity>
        </View>

        <View style={styles.metaRow}>
          <CategoryBadge category={event.category} />
          <Text style={styles.date}>
            {new Date(event.date_start).toLocaleDateString()} ·{' '}
            {new Date(event.date_start).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>

      {/* Location */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <Text style={styles.location}>{event.venue_address}</Text>
        <Text style={styles.coords}>
          {event.lat.toFixed(4)}, {event.lng.toFixed(4)}
        </Text>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.description}>{event.description}</Text>
      </View>

      {/* Creator Profile */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {event.creator.type === 'venue' ? 'Venue' : 'Artist'}
        </Text>
        <TouchableOpacity
          onPress={() => {/* Navigate to Profile */}}
          style={styles.profileRow}
        >
          <Image
            source={{ uri: event.creator.profile_picture }}
            style={styles.profileImage}
          />
          <Text style={styles.profileName}>{event.creator.name}</Text>
        </TouchableOpacity>
      </View>

      {/* Collaborators */}
      {event.collaborators.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Collaborators</Text>
          {event.collaborators.map((collab) => (
            <TouchableOpacity
              key={collab.id}
              onPress={() => {/* Navigate to Profile */}}
              style={styles.profileRow}
            >
              <Image
                source={{ uri: collab.profile_picture }}
                style={styles.profileImage}
              />
              <Text style={styles.profileName}>{collab.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        {event.ticket_link && (
          <TouchableOpacity
            onPress={() => Linking.openURL(event.ticket_link!)}
            style={styles.ticketButton}
          >
            <Text style={styles.ticketButtonText}>Get Tickets → </Text>
          </TouchableOpacity>
        )}

        {event.is_gig_opportunity && isArtist && (
          <TouchableOpacity
            onPress={() => {/* Navigate to Booking Flow */}}
            style={styles.applyButton}
          >
            <Text style={styles.applyButtonText}>Apply for Gig</Text>
          </TouchableOpacity>
        )}

        {canEdit && (
          <TouchableOpacity
            onPress={() => {/* Navigate to Edit */}}
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>Edit Event</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Secondary Actions */}
      <View style={styles.secondaryActions}>
        <TouchableOpacity onPress={handleShare} style={styles.secondaryButton}>
          <ShareIcon />
          <Text style={styles.secondaryButtonText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={addToCalendar} style={styles.secondaryButton}>
          <CalendarBadge />
          <Text style={styles.secondaryButtonText}>Add to Calendar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#666' },
  coverImage: { width: '100%', height: 250, backgroundColor: '#E0E0E0' },
  rejectionBanner: {
    backgroundColor: '#FFF3CD',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
  },
  rejectionText: { fontSize: 14, color: '#333', marginBottom: 12 },
  headerSection: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', flex: 1, marginRight: 12 },
  saveButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  date: { fontSize: 14, color: '#666' },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  location: { fontSize: 14, color: '#333', marginBottom: 4 },
  coords: { fontSize: 12, color: '#999' },
  description: { fontSize: 14, color: '#555', lineHeight: 20 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  profileImage: { width: 40, height: 40, borderRadius: 20 },
  profileName: { fontSize: 14, fontWeight: '500', color: '#007AFF' },
  actionSection: { padding: 16, gap: 10 },
  ticketButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  ticketButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  applyButton: {
    backgroundColor: '#34C759',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  editButton: {
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: { color: '#333', fontSize: 16, fontWeight: '600' },
  secondaryActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDD',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '500', color: '#333' },
});
```

### Common Gotchas

- **Calendar permission timing**: First tap of "Add to Calendar" requests permission synchronously. Handle the case where user denies permission gracefully (show toast, don't crash).
- **Link opening fallback**: If `Linking.openURL()` fails (e.g., invalid URL), log the error and show user-friendly message. Don't use WebView for external links (App Store compliance).
- **Save state synchronization**: If user saves event in Event Detail and then views Saved Events list, list should reflect the change. Consider using React Query or similar for client-side cache invalidation.
- **Archived event visibility**: Ensure 404 is returned for archived events to non-creators. If you expose archived events to creators, clearly mark them as "past event" so UX is not confusing.
- **Rejection reason length**: Some rejection reasons may be long. Wrap text in the banner; don't truncate without indication.
