# M5-T2 · Artist-Initiated Booking (Apply to Gig Opportunity)

| Field          | Value                                                                                  |
| -------------- | -------------------------------------------------------------------------------------- |
| **Milestone**  | M5 — Booking Flow                                                                      |
| **Status**     | 🔲 To Do                                                                               |
| **Depends on** | M5-T1 (booking infrastructure), M4-T1 (gig opportunity events), M2-T4 (persona system) |
| **PRD Ref**    | Section 6.2 (Artist Booking Features), Section 9.4 (Booking Flow)                      |

---

## Description

Artists discover gig opportunity events (`is_gig_opportunity: true`) posted by Venues and apply directly. The Venue receives an application notification and can accept or reject it through their Bookings tab. This is the second avenue for Artist-Venue connections, complementing Venue-initiated invitations.

---

## Affected Apps / Packages

- `packages/api` — `bookings.create` (artist-initiated variant), `bookings.update`, `bookings.list` — same tRPC procedures as M5-T1; direction field distinguishes flow
- `apps/mobile` — Apply button on gig opportunity Event Detail screen, application tracking in Bookings tab, Venue application queue UI

---

## tRPC Procedures

Same three procedures as M5-T1 (`bookings.create`, `bookings.update`, `bookings.list`). The `direction` field in `bookings.create` distinguishes artist-initiated from venue-initiated.

### `bookings.create` — artist-initiated variant

**Input:**

```typescript
{
  eventId: string,              // must be a gig opportunity (is_gig_opportunity: true)
  artistId: string,             // calling user's own artist profile id
  direction: "artist_to_venue",
}
```

**tRPC errors:**

- `BAD_REQUEST` — Event is not a gig opportunity; artist is already a collaborator on the event
- `UNAUTHORIZED` — Not in Artist persona
- `CONFLICT` — Duplicate application already pending/accepted

### `bookings.update` — venue response to application

Valid transitions for `artist_to_venue` bookings:

- `pending` → `accepted` (Venue only)
- `pending` → `rejected` (Venue only)
- `accepted` → `cancelled` (Artist or Venue)

### `bookings.list` — filter to applications only

```typescript
trpc.bookings.list.query({ direction: 'artist_to_venue' });
```

**Output includes** (for artist_to_venue bookings):

```json
{
  "bookings": [
    {
      "id": "booking-uuid",
      "artist_id": "artist-uuid",
      "artist_name": "Síle Na Gealach",
      "venue_id": "venue-uuid",
      "venue_name": "The Temple Bar",
      "event_id": "event-uuid",
      "event_title": "Folk Night Wednesday",
      "status": "pending",
      "direction": "artist_to_venue",
      "message": null,
      "created_at": "2026-03-23T14:20:00Z",
      "updated_at": "2026-03-23T14:20:00Z"
    }
  ]
}
```

---

## Requirements

### Gig Opportunity Discovery

Gig opportunity events (marked `is_gig_opportunity: true` in the events table) are visible only to Artists. The Event Detail screen for a gig opportunity shows an "Apply" button (instead of the normal "Interested" or "Save" button visible to Spectators). Spectators do not see gig opportunity events on the map or feed.

### Application Creation

When an Artist taps the Apply button, the app creates a booking with `direction = artist_to_venue`, `status = pending`, and no message field (artist-initiated applications are implicit expressions of interest). The Artist receives a confirmation toast: "Application sent!" The booking is created and immediately sent to the Venue via FCM.

### Venue Notification

The Venue receives a push notification: `"[Artist Name] applied to [Event Title]"` with a deep link to the Bookings tab. The notification includes the persona (`venue`) and route (`/bookings`).

### Venue Response

The Venue accesses their Bookings tab and sees incoming applications grouped by status. Each application card shows the Artist's stage name, profile photo, genre, and a short bio. The Venue can tap Accept or Reject. Accepting notifies the Artist and the application transitions to `accepted`. Rejecting notifies the Artist with an optional reason (V2 enhancement).

### Artist Cancellation

If an Artist's application is still pending (Venue has not yet responded), the Artist can cancel their application. This transitions the booking to `cancelled` and notifies the Venue. Once the Venue accepts or rejects, the Artist loses cancellation rights (the decision is the Venue's).

### Duplicate Prevention

An Artist cannot apply to the same gig opportunity more than once. If they already have a pending or accepted booking for that event, a second application attempt returns a 409 Conflict error with a message: "You've already applied to this event."

### Collaborator Check

If the Artist is already listed as a collaborator on the event (in the events.collaborators array), they cannot apply. The "Apply" button is hidden for collaborators. This prevents Artist-initiated duplicates for events where the Artist was already invited by the Venue.

---

## Acceptance Criteria

### Apply Button & Event Detail

- [ ] Gig opportunity events marked `is_gig_opportunity: true` show Apply button (Artist persona only)
- [ ] Regular events (gig_opportunity=false) do not show Apply button
- [ ] Spectator persona does not see gig opportunity events on map/feed
- [ ] Artist already a collaborator on the event → Apply button hidden

### Application Submission

- [ ] Tapping Apply creates a booking with direction=artist_to_venue, status=pending
- [ ] Artist sees confirmation toast: "Application sent!"
- [ ] POST /bookings validates event is a gig opportunity
- [ ] Duplicate application attempt returns 409 error

### Venue Receives Application

- [ ] Venue receives FCM push with Artist name and Event title
- [ ] Notification deep links to Bookings tab
- [ ] Venue Bookings tab shows incoming applications (filter by direction=artist_to_venue)

### Venue Response UI

- [ ] Each application card shows Artist stage name, profile photo, and genre
- [ ] Accept and Reject buttons visible on pending applications
- [ ] Accepting transitions status to accepted; Artist notified
- [ ] Rejecting transitions status to rejected; Artist notified

### Artist Can Cancel Pending

- [ ] Artist taps Cancel on their own pending application → status=cancelled
- [ ] Venue is notified of cancellation
- [ ] Artist cannot cancel after Venue accepts or rejects

### Bookings List Filtering

- [ ] GET /bookings?direction=artist_to_venue returns only artist-initiated applications
- [ ] Venue can filter their incoming applications separately from outgoing invitations

---

## Dependencies

- **Upstream**: M5-T1 (shared booking endpoints and state machine), M4-T1 (gig opportunity events with is_gig_opportunity flag), M2-T4 (Artist persona required)
- **Downstream**: M5-T3 (cancellation state machine), M3-T3 (gig opportunities may be surfaced in the feed separately)
- **External services**: Firebase FCM for push notifications

---

## Technical Notes

### Event Validation

```typescript
// In POST /bookings handler, when direction='artist_to_venue':
const event = await db
  .select()
  .from(events)
  .where(eq(events.id, event_id))
  .then((rows) => rows[0]);

if (!event.is_gig_opportunity) {
  return c.json({ error: 'This event is not a gig opportunity' }, 400);
}
```

### Collaborator Check

```typescript
// Check if Artist is already a collaborator
const collaborators = event.collaborators || []; // JSON array of artist profile IDs
if (collaborators.includes(artist_id)) {
  return c.json({ error: 'You are already booked for this event' }, 400);
}
```

### Duplicate Prevention (same as M5-T1)

```typescript
const existingBooking = await db
  .select()
  .from(bookings)
  .where(
    and(
      eq(bookings.artist_id, artist_id),
      eq(bookings.event_id, event_id),
      inArray(bookings.status, ['pending', 'accepted'])
    )
  )
  .then((rows) => rows[0]);

if (existingBooking) {
  return c.json({ error: 'You have already applied to this event' }, 409);
}
```

### React Native — Event Detail Screen (Artist Persona)

```typescript
import React from 'react';
import { View, TouchableOpacity, Text, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export function EventDetailScreen({ route }) {
  const { event } = route.params;
  const { user } = useAuth();
  const [applying, setApplying] = React.useState(false);

  const isArtist = user.role === 'artist';
  const isCollaborator = event.collaborators?.includes(user.artist_id);
  const isGigOpportunity = event.is_gig_opportunity;

  const handleApply = async () => {
    setApplying(true);
    try {
      await api.post('/bookings', {
        direction: 'artist_to_venue',
        event_id: event.id,
      });
      Alert.alert('Success', 'Application sent! The venue will review your profile.');
    } catch (error) {
      if (error.response?.status === 409) {
        Alert.alert('Already Applied', 'You have already applied to this event.');
      } else {
        Alert.alert('Error', error.response?.data?.error || 'Failed to apply');
      }
    } finally {
      setApplying(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Event details: title, date, venue, etc. */}
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.venue}>{event.venue_address}</Text>

      {/* Gig opportunity indicator */}
      {isGigOpportunity && <Text style={styles.gigBadge}>🎵 We're hiring!</Text>}

      {/* Apply button — visible to Artists, not if collaborator, not if gig_opportunity=false */}
      {isArtist && isGigOpportunity && !isCollaborator && (
        <TouchableOpacity
          onPress={handleApply}
          disabled={applying}
          style={styles.applyButton}
        >
          <Text style={styles.applyButtonText}>
            {applying ? 'Applying...' : 'Apply to Perform'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Collaborator indicator — if user is already booked */}
      {isArtist && isCollaborator && (
        <View style={styles.collaboratorBanner}>
          <Text style={styles.collaboratorText}>You are already booked for this event</Text>
        </View>
      )}
    </View>
  );
}
```

### Venue Bookings Tab — Filtering Applications

```typescript
// In Venue's Bookings tab, fetch only artist-to-venue applications:
const fetchIncomingApplications = async () => {
  const response = await api.get('/bookings?direction=artist_to_venue&status=pending');
  return response.data.bookings;
};

// Render incoming applications with Venue response UI
const renderApplication = ({ item }) => (
  <View style={styles.applicationCard}>
    <Image source={{ uri: item.artist_profile_photo }} style={styles.photo} />
    <Text style={styles.artistName}>{item.artist_name}</Text>
    <Text style={styles.genre}>{item.genre}</Text>
    <Text style={styles.eventTitle}>For: {item.event_title}</Text>

    {item.status === 'pending' && (
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => acceptApplication(item.id)}
          style={styles.acceptBtn}
        >
          <Text style={styles.btnText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => rejectApplication(item.id)}
          style={styles.rejectBtn}
        >
          <Text style={styles.btnText}>Reject</Text>
        </TouchableOpacity>
      </View>
    )}
  </View>
);
```

### Common Gotchas

- **Gig opportunity visibility**: The API returns all events to all users, but the Mobile app must filter out `is_gig_opportunity: true` events before rendering them to Spectators. Do this on the client side; the backend doesn't enforce it (V1 scale assumption).
- **Collaborators JSON array**: The `events.collaborators` field is a JSON array in PostgreSQL. When checking if an Artist is a collaborator, use PostgreSQL's JSON operators: `WHERE collaborators @> '["artist-id"]'::jsonb`. However, in Drizzle ORM, serialize to TypeScript array first for easier type safety.
- **Apply button state**: After tapping Apply, disable the button immediately (optimistic UI). Don't re-enable until the server responds. If the response is 409 (duplicate), show an Alert instead of re-enabling.
- **Notification routing**: When the Venue receives the application notification and taps it, the app navigates to the Bookings tab and auto-filters to direction=artist_to_venue. Implement this as a deep link parameter or context flag.
- **Application card data**: The application card needs the Artist's stage name, genre, and profile photo. These are in the artist_profiles table, not the bookings table. Join artist_profiles on the GET /bookings response, or fetch separately as you build each card.
