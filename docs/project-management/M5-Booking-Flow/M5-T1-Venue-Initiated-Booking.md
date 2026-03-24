# M5-T1 · Venue-Initiated Booking (Invitation to Artist)

| Field          | Value                                                            |
| -------------- | ---------------------------------------------------------------- |
| **Milestone**  | M5 — Booking Flow                                                |
| **Status**     | 🔲 To Do                                                         |
| **Depends on** | M6-T1 (Artist profiles), M4-T1 (events), M2-T4 (persona system)  |
| **PRD Ref**    | Section 7.2 (Venue Booking Features), Section 9.4 (Booking Flow) |

---

## Description

Venue sends a binding booking invitation to a specific Artist for a specific event they own. The Artist receives a push notification and can accept, reject, or ignore the invitation. Once accepted, either party may cancel at any time. This is the primary avenue for Venues to recruit Artists.

---

## Affected Apps / Packages

- `apps/api` — Booking CRUD endpoints, status transitions, FCM push dispatch
- `apps/mobile` — Booking invitation UI (Artist & Venue), Bookings tab (role-aware), artist search/selection modal for Venues
- `packages/shared` — `BookingStatus` enum, `BookingDirection` enum, TypeScript types

---

## API Endpoints

### POST /bookings

**Request Body:**

```json
{
  "direction": "venue_to_artist",
  "artist_id": "artist-profile-uuid",
  "event_id": "event-uuid",
  "message": "We'd love to have you perform at our Summer Festival!"
}
```

**Response (201 Created):**

```json
{
  "id": "booking-uuid",
  "artist_id": "artist-profile-uuid",
  "venue_id": "venue-profile-uuid",
  "event_id": "event-uuid",
  "status": "pending",
  "direction": "venue_to_artist",
  "message": "We'd love to have you perform at our Summer Festival!",
  "created_at": "2026-03-23T10:30:00Z",
  "updated_at": "2026-03-23T10:30:00Z"
}
```

**Error Responses:**

- `400` — Invalid event_id or artist_id; event not owned by requesting Venue; artist_id references inactive profile
- `401` — Not authenticated or not in Venue persona
- `409` — Duplicate booking already pending or accepted for this artist + event pair

### PATCH /bookings/:id

**Request Body:**

```json
{
  "status": "accepted"
}
```

Valid status transitions:

- `pending` → `accepted` (Artist only)
- `pending` → `rejected` (Artist only)
- `accepted` → `cancelled` (Artist or Venue)

**Response (200 OK):**

```json
{
  "id": "booking-uuid",
  "artist_id": "artist-profile-uuid",
  "venue_id": "venue-profile-uuid",
  "event_id": "event-uuid",
  "status": "accepted",
  "direction": "venue_to_artist",
  "message": "We'd love to have you perform at our Summer Festival!",
  "created_at": "2026-03-23T10:30:00Z",
  "updated_at": "2026-03-23T12:15:00Z"
}
```

**Error Responses:**

- `400` — Invalid status; invalid state transition (e.g., pending → cancelled is not allowed)
- `401` — Not authenticated; not the Artist or Venue for this booking
- `404` — Booking not found

### GET /bookings

**Query Params:**

```
?status=pending          # Optional: filter by status (pending | accepted | rejected | cancelled)
?direction=venue_to_artist  # Optional: filter by direction
```

**Response (200 OK):**

```json
{
  "bookings": [
    {
      "id": "booking-uuid-1",
      "artist_id": "artist-uuid",
      "artist_name": "The Dubliners",
      "venue_id": "venue-uuid",
      "venue_name": "The Brazen Head",
      "event_id": "event-uuid",
      "event_title": "St. Patrick's Day Session",
      "status": "pending",
      "direction": "venue_to_artist",
      "message": "We'd love to have you perform!",
      "created_at": "2026-03-23T10:30:00Z",
      "updated_at": "2026-03-23T10:30:00Z"
    }
  ]
}
```

---

## Requirements

### Booking Creation

Venues can search for Artists by name or profile and send them a booking invitation tied to a specific event. The invitation includes an optional freeform message. The booking is created with `status = pending` and `direction = venue_to_artist`. An Artist can have at most one pending or accepted booking per event (no duplicates).

### Notification Delivery

When a Venue creates a booking, the Artist receives an FCM push notification via Firebase. The notification payload includes the persona (`artist`), the route (`/bookings`), and a localized title: `"[Venue Name] wants to book you for [Event Title]"`. The notification is delivered via the Artist's active device token.

### Booking Response

Artists access their Bookings tab (visible in the Profile section) and see pending invitations grouped by status. They can tap into an invitation detail view and choose to Accept, Reject, or dismiss it. Accepting transitions the status to `accepted` and notifies the Venue. Rejecting transitions to `rejected` and notifies the Venue with a reason (optional). The Artist can also ignore the invitation — it remains pending indefinitely.

### Cancellation Rights

After a booking is accepted, either the Artist or Venue can cancel it at any time. This is useful if circumstances change (Artist no longer available, Venue reschedules event, etc.). Cancelling transitions the status to `cancelled` and notifies the other party.

### Booking Visibility

Each role sees different booking views:

- **Venue persona**: Sees outgoing invitations (direction = venue_to_artist) for their own events
- **Artist persona**: Sees incoming invitations (direction = venue_to_artist) from any Venue
- **Spectator persona**: Cannot see bookings (tab hidden)

---

## Acceptance Criteria

### Artist Response & Notifications

- [ ] Venue can search for Artist by stage name and see their profile in a modal selection UI
- [ ] Venue can select an Artist and an event, optionally add a message, and tap Send Invitation
- [ ] POST /bookings creates the booking with status=pending, direction=venue_to_artist
- [ ] Artist receives FCM push notification with Venue name and Event title
- [ ] Artist can open the Bookings tab and see the incoming invitation
- [ ] Artist can tap Accept, Reject, or dismiss the invitation

### Status Transitions

- [ ] Accepting updates status to accepted; Venue receives push notification
- [ ] Rejecting updates status to rejected; Venue receives notification
- [ ] Cancelled booking transitions correctly from accepted state; other party notified
- [ ] Rejected / Cancelled bookings remain visible in the booking history (read-only)

### Deduplication & Constraints

- [ ] Creating a duplicate booking (same artist + event, pending/accepted) returns 409 error
- [ ] Venue can only send invitations for events they own
- [ ] Artist must have is_active=true profile to receive bookings

### Bookings Tab Visualization

- [ ] Venue Bookings tab shows outgoing invitations grouped by event and status
- [ ] Artist Bookings tab shows incoming invitations grouped by Venue and status
- [ ] Pending invitations show a time since sent (e.g., "2 days ago")
- [ ] Each booking card shows Venue/Artist name, Event title, and action buttons (accept/reject for pending; cancel for accepted)

### State Transitions (Negative Cases)

- [ ] Trying to accept a rejected or cancelled booking fails gracefully
- [ ] Trying to cancel a pending booking fails (cancel only allowed from accepted)
- [ ] Non-owner trying to cancel an accepted booking fails with 401

---

## Dependencies

- **Upstream**: M6-T1 (Artist profiles must exist), M4-T1 (events must exist and include is_active status), M2-T4 (persona system)
- **Downstream**: M5-T2 (Artist-initiated bookings share the same endpoint and state machine), M5-T3 (Cancellation and state machine) — M5-T1/T2/T3 are tightly coupled
- **External services**: Firebase FCM for push notifications; Postmark for transactional email notifications (optional in V1, deferred to V2)

---

## Technical Notes

### Drizzle Schema (apps/api/src/db/schema.ts)

```typescript
import {
  uuid,
  text,
  timestamp,
  pgEnum,
  pgTable,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
]);
export const bookingDirectionEnum = pgEnum("booking_direction", [
  "venue_to_artist",
  "artist_to_venue",
]);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artist_id: uuid("artist_id")
      .notNull()
      .references(() => artistProfiles.id),
    venue_id: uuid("venue_id")
      .notNull()
      .references(() => venueProfiles.id),
    event_id: uuid("event_id")
      .notNull()
      .references(() => events.id),
    status: bookingStatusEnum("status").notNull().default("pending"),
    direction: bookingDirectionEnum("direction").notNull(),
    message: text("message"),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueBooking: uniqueIndex("idx_booking_artist_event_active")
      .on(
        table.artist_id,
        table.event_id,
        table.status, // Only one pending/accepted booking per artist+event pair
      )
      .where(sql`status IN ('pending', 'accepted')`),
  }),
);
```

### Hono Handler (apps/api/src/routes/bookings.ts)

```typescript
import { Hono } from "hono";
import { db } from "../db";
import { bookings, artistProfiles, venueProfiles, events } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { sendFCMNotification } from "../services/fcm";

const bookingsRouter = new Hono();

// POST /bookings — Venue initiates booking
bookingsRouter.post("/", async (c) => {
  const user = c.get("user"); // from BetterAuth middleware
  const { direction, artist_id, event_id, message } = await c.req.json();

  if (user.current_role !== "venue") {
    return c.json({ error: "Only Venues can create bookings" }, 401);
  }

  // Get Venue profile
  const venueProfile = await db
    .select()
    .from(venueProfiles)
    .where(eq(venueProfiles.user_id, user.id))
    .then((rows) => rows[0]);

  if (!venueProfile) {
    return c.json({ error: "Venue profile not found" }, 404);
  }

  // Verify event ownership
  const event = await db
    .select()
    .from(events)
    .where(and(eq(events.id, event_id), eq(events.created_by, venueProfile.id)))
    .then((rows) => rows[0]);

  if (!event) {
    return c.json({ error: "Event not found or not owned by you" }, 400);
  }

  // Verify Artist profile
  const artistProfile = await db
    .select()
    .from(artistProfiles)
    .where(
      and(eq(artistProfiles.id, artist_id), eq(artistProfiles.is_active, true)),
    )
    .then((rows) => rows[0]);

  if (!artistProfile) {
    return c.json({ error: "Artist profile not found or inactive" }, 400);
  }

  // Check for duplicate active booking
  const existingBooking = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.artist_id, artist_id),
        eq(bookings.event_id, event_id),
        inArray(bookings.status, ["pending", "accepted"]),
      ),
    )
    .then((rows) => rows[0]);

  if (existingBooking) {
    return c.json({ error: "Duplicate booking already exists" }, 409);
  }

  // Create booking
  const newBooking = await db
    .insert(bookings)
    .values({
      artist_id,
      venue_id: venueProfile.id,
      event_id,
      status: "pending",
      direction: "venue_to_artist",
      message,
    })
    .returning()
    .then((rows) => rows[0]);

  // Send FCM notification to Artist
  const artistUser = await db.query.users.findFirst({
    where: eq(users.id, artistProfile.user_id),
  });

  if (artistUser?.device_tokens?.length) {
    await sendFCMNotification({
      tokens: artistUser.device_tokens,
      title: `${venueProfile.venue_name} wants to book you for ${event.title}`,
      body: message || "Tap to view the invitation",
      data: {
        persona: "artist",
        route: "/bookings",
        booking_id: newBooking.id,
      },
    });
  }

  return c.json(newBooking, 201);
});

// PATCH /bookings/:id — Update booking status
bookingsRouter.patch("/:id", async (c) => {
  const user = c.get("user");
  const bookingId = c.req.param("id");
  const { status: newStatus } = await c.req.json();

  const booking = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .then((rows) => rows[0]);

  if (!booking) {
    return c.json({ error: "Booking not found" }, 404);
  }

  // Verify user is Artist or Venue
  const isArtist =
    user.current_role === "artist" &&
    (await db.query.artistProfiles.findFirst({
      where: and(
        eq(artistProfiles.user_id, user.id),
        eq(artistProfiles.id, booking.artist_id),
      ),
    }));

  const isVenue =
    user.current_role === "venue" &&
    (await db.query.venueProfiles.findFirst({
      where: and(
        eq(venueProfiles.user_id, user.id),
        eq(venueProfiles.id, booking.venue_id),
      ),
    }));

  if (!isArtist && !isVenue) {
    return c.json({ error: "Not authorized for this booking" }, 401);
  }

  // Validate state transition
  const validTransitions = {
    pending: ["accepted", "rejected"],
    accepted: ["cancelled"],
    rejected: [],
    cancelled: [],
  };

  if (!validTransitions[booking.status]?.includes(newStatus)) {
    return c.json(
      { error: `Invalid transition from ${booking.status} to ${newStatus}` },
      400,
    );
  }

  // Only artist can accept/reject pending
  if (booking.status === "pending" && newStatus !== "cancelled" && !isArtist) {
    return c.json({ error: "Only artist can accept or reject" }, 401);
  }

  // Update booking
  const updated = await db
    .update(bookings)
    .set({ status: newStatus, updated_at: new Date() })
    .where(eq(bookings.id, bookingId))
    .returning()
    .then((rows) => rows[0]);

  // Send notification to other party
  const notifyProfileId = isArtist ? booking.venue_id : booking.artist_id;
  const notifyRole = isArtist ? "venue" : "artist";
  // ... FCM push logic

  return c.json(updated, 200);
});

// GET /bookings
bookingsRouter.get("/", async (c) => {
  const user = c.get("user");
  const status = c.req.query("status");
  const direction = c.req.query("direction");

  let query = db.select().from(bookings);

  if (user.current_role === "artist") {
    const artistProfile = await db.query.artistProfiles.findFirst({
      where: eq(artistProfiles.user_id, user.id),
    });
    query = query.where(eq(bookings.artist_id, artistProfile.id));
  } else if (user.current_role === "venue") {
    const venueProfile = await db.query.venueProfiles.findFirst({
      where: eq(venueProfiles.user_id, user.id),
    });
    query = query.where(eq(bookings.venue_id, venueProfile.id));
  } else {
    return c.json({ error: "Spectators cannot view bookings" }, 403);
  }

  if (status) {
    query = query.where(eq(bookings.status, status));
  }
  if (direction) {
    query = query.where(eq(bookings.direction, direction));
  }

  const results = await query.orderBy(desc(bookings.created_at));
  return c.json({ bookings: results }, 200);
});

export default bookingsRouter;
```

### React Native Component (apps/mobile/src/screens/BookingsTab.tsx)

```typescript
import React, { useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, Text, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export function BookingsTab() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [])
  );

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/bookings');
      setBookings(response.data.bookings);
    } catch (error) {
      Alert.alert('Error', 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (bookingId) => {
    try {
      await api.patch(`/bookings/${bookingId}`, { status: 'accepted' });
      await fetchBookings();
      Alert.alert('Success', 'Booking accepted!');
    } catch (error) {
      Alert.alert('Error', 'Failed to accept booking');
    }
  };

  const handleReject = async (bookingId) => {
    try {
      await api.patch(`/bookings/${bookingId}`, { status: 'rejected' });
      await fetchBookings();
      Alert.alert('Success', 'Booking rejected');
    } catch (error) {
      Alert.alert('Error', 'Failed to reject booking');
    }
  };

  const renderBookingCard = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.venue}>{item.venue_name}</Text>
      <Text style={styles.event}>{item.event_title}</Text>
      <Text style={styles.message}>{item.message}</Text>
      <Text style={styles.status}>Status: {item.status}</Text>

      {item.status === 'pending' && user.role === 'artist' && (
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => handleAccept(item.id)} style={styles.acceptBtn}>
            <Text style={styles.btnText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleReject(item.id)} style={styles.rejectBtn}>
            <Text style={styles.btnText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={bookings}
        renderItem={renderBookingCard}
        keyExtractor={(item) => item.id}
        onRefresh={fetchBookings}
        refreshing={loading}
      />
    </View>
  );
}
```

### Common Gotchas

- **Duplicate booking prevention**: The unique index on (artist_id, event_id, status) with status IN ('pending', 'accepted') prevents multiple active bookings. However, a rejected booking for the same artist+event can be created afterward. This is intentional — it allows Artists to reapply.
- **FCM token stale**: If the Artist has never logged in or has deleted the app, device_tokens array may be empty. The notification silently fails — the booking still exists but won't be pushed. The Bookings tab will show it on next login.
- **Timezone display**: Booking timestamps stored in UTC. Display "time since sent" on client using relative time (e.g., "2 days ago") to avoid timezone confusion.
- **Deleted events**: If a Venue deletes an event after creating a booking, the event_id foreign key constraint prevents hard deletion. Events are soft-deleted, so the booking remains visible but the event_id points to a soft-deleted row. Handle gracefully in UI.
- **Concurrent status updates**: Two rapid API calls updating the same booking's status could result in race conditions. Use optimistic locking (version field) in V2; for V1, last-write-wins is acceptable given low scale.
