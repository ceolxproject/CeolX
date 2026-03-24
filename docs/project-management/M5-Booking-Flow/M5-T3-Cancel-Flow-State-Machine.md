# M5-T3 · Cancellation Flow & State Machine

| Field          | Value                                                               |
| -------------- | ------------------------------------------------------------------- |
| **Milestone**  | M5 — Booking Flow                                                   |
| **Status**     | 🔲 To Do                                                            |
| **Depends on** | M5-T1 (Venue-initiated bookings), M5-T2 (Artist-initiated bookings) |
| **PRD Ref**    | Section 9.4 (Booking Flow — full state machine)                     |

---

## Description

Defines the complete booking state machine lifecycle: from creation (pending) through acceptance or rejection, to final cancellation. Both Venue-initiated and Artist-initiated bookings follow the same state transitions. Cancellation is allowed only after acceptance and by either party. Rejected applications cannot be revived — the Artist must apply or the Venue must reinvite.

---

## Affected Apps / Packages

- `apps/api` — State machine validation, status transition endpoints (reuses PATCH /bookings/:id), notification dispatch for each transition
- `apps/mobile` — UI state synchronization (pending → accepted → cancelled flow), action button visibility per role and status
- `packages/shared` — `BookingStatus` enum, transition validation logic (TypeScript types)

---

## API Endpoints

### PATCH /bookings/:id (State Transitions)

**Request Body:**

```json
{
  "status": "cancelled"
}
```

**Valid Status Paths:**

```
[pending] → [accepted] (Artist only, for venue_to_artist; Venue only, for artist_to_venue)
[pending] → [rejected] (Artist only, for venue_to_artist; Venue only, for artist_to_venue)
[pending] → [cancelled] (Artist only, artist_to_venue direction; Initiated Artist can cancel their own applications)
[accepted] → [cancelled] (Either Artist or Venue)

[rejected] → (terminal, no transitions)
[cancelled] → (terminal, no transitions)
```

**Response (200 OK):**

```json
{
  "id": "booking-uuid",
  "artist_id": "artist-uuid",
  "venue_id": "venue-uuid",
  "event_id": "event-uuid",
  "status": "cancelled",
  "direction": "venue_to_artist",
  "message": "We'd love to have you perform...",
  "created_at": "2026-03-23T10:30:00Z",
  "updated_at": "2026-03-23T16:45:00Z"
}
```

**Error Responses:**

- `400` — Invalid state transition (e.g., cancelled → accepted, rejected → accepted, pending → cancelled for venue_to_artist)
- `401` — Not authorized to perform this transition (e.g., non-Venue trying to accept artist_to_venue, non-Artist trying to cancel venue_to_artist pending)
- `404` — Booking not found

---

## Requirements

### Complete State Machine

Bookings have five possible states: `pending`, `accepted`, `rejected`, `cancelled`. Not all transitions are valid. The state machine enforces these rules at the API level.

**Pending State**: Booking just created, awaiting response from the decision-maker (Artist for venue_to_artist; Venue for artist_to_venue). Pending bookings are visible in both parties' Bookings tabs. Pending invitations expire after 90 days (V2 enhancement — V1 does not auto-expire).

**Accepted State**: Both parties have confirmed. The booking is "locked in" — the Artist will perform at the event. Either party can now cancel if circumstances change.

**Rejected State**: The decision-maker declined the booking. This is final; the booking cannot be revived. The Artist or Venue must initiate a new booking (apply again or reinvite) if they want to retry.

**Cancelled State**: An accepted booking that one party terminated. This is also final. If the Artist and Venue want to rebook, they must create a new booking record.

### Transition Rules by Direction

**Venue-Initiated (direction = venue_to_artist):**

- Artist is the decision-maker on pending applications.
- `pending` → `accepted`: Artist accepts the invitation. Venue is notified. Booking moves to accepted.
- `pending` → `rejected`: Artist rejects. Venue is notified with optional reason. Booking is terminal.
- `pending` → (no Artist-initiated cancel): The Artist cannot cancel a Venue-initiated invite while pending. They must reject it (terminal) or accept it (then cancel from accepted).
- `accepted` → `cancelled`: Either Artist or Venue can cancel an accepted booking.

**Artist-Initiated (direction = artist_to_venue):**

- Venue is the decision-maker on pending applications.
- `pending` → `accepted`: Venue accepts the application. Artist is notified. Booking moves to accepted.
- `pending` → `rejected`: Venue rejects. Artist is notified. Booking is terminal.
- `pending` → `cancelled`: Artist can cancel their own pending application before the Venue responds. Venue is notified.
- `accepted` → `cancelled`: Either Venue or Artist can cancel an accepted booking.

### Cancellation Semantics

When an accepted booking is cancelled, the cancelling party may provide a reason (V2 enhancement). The other party receives a notification with the reason. The UI should show the cancellation timestamp and which party initiated it (read-only post-cancellation).

### Authorization Rules

- **Accepting/Rejecting**: Only the decision-maker can accept or reject. Attempting to accept/reject as the non-decision-maker returns 401.
- **Cancelling accepted**: Either party can cancel. The API checks that the user is either the Artist or Venue for the booking.
- **Cancelling pending (artist_to_venue)**: Only the Artist (the applicant) can cancel their own application.

### Notifications on State Change

Each state transition triggers an FCM notification to the other party.

- `pending` → `accepted`: "Great news! [Artist/Venue] accepted your booking for [Event Title]"
- `pending` → `rejected`: "[Artist/Venue] declined your booking request for [Event Title]"
- `pending` → `cancelled` (artist_to_venue only): "[Artist Name] withdrew their application for [Event Title]"
- `accepted` → `cancelled`: "[Artist/Venue] cancelled the booking for [Event Title]. Event date: [Date]"

---

## Acceptance Criteria

### Venue-Initiated Booking Path

- [ ] Venue can view pending invitations sent to Artists
- [ ] Artist taps Accept → status = accepted; Venue is notified
- [ ] Artist taps Reject → status = rejected; Venue is notified; booking is terminal
- [ ] Artist cannot cancel while pending; must Reject instead
- [ ] After accepting, Artist can tap Cancel; Venue is notified; status = cancelled
- [ ] After accepting, Venue can tap Cancel; Artist is notified

### Artist-Initiated Booking Path

- [ ] Artist can view pending applications they've submitted
- [ ] Venue can view pending applications from Artists
- [ ] Venue taps Accept → status = accepted; Artist is notified
- [ ] Venue taps Reject → status = rejected; Artist is notified; booking is terminal
- [ ] While pending, Artist can cancel their own application; Venue is notified
- [ ] After accepting, Artist can cancel; Venue is notified
- [ ] After accepting, Venue can cancel; Artist is notified

### Terminal States

- [ ] Rejected booking shows status "Declined" with read-only UI (no action buttons)
- [ ] Cancelled booking shows status "Cancelled" with cancellation timestamp and which party cancelled it
- [ ] Attempting to transition from rejected or cancelled returns 400 error

### Authorization Checks

- [ ] Non-Venue cannot accept a venue_to_artist pending booking
- [ ] Non-Artist cannot reject a venue_to_artist pending booking
- [ ] Non-Venue cannot accept an artist_to_venue pending booking
- [ ] Non-Artist cannot reject an artist_to_venue pending booking
- [ ] Only the Artist can cancel their own pending artist_to_venue application
- [ ] Non-Artist, non-Venue trying to cancel an accepted booking fails with 401

### Notification Flow

- [ ] Accepting triggers FCM to other party with [Role] accepted your booking
- [ ] Rejecting triggers FCM with [Role] declined your booking
- [ ] Cancelling from accepted triggers FCM with [Role] cancelled the booking
- [ ] Notifications include the Event Title and deep link to Bookings tab

---

## Dependencies

- **Upstream**: M5-T1, M5-T2 (both must implement PATCH endpoints; this task validates and documents the shared logic)
- **Downstream**: No blocking dependencies; M5 is complete after this task
- **External services**: Firebase FCM for all state-change notifications

---

## Technical Notes

### State Machine Validation (Drizzle + Hono)

```typescript
// Define valid transitions as a mapping
const validTransitions: Record<BookingStatus, BookingStatus[]> = {
  pending: ["accepted", "rejected", "cancelled"],
  accepted: ["cancelled"],
  rejected: [],
  cancelled: [],
};

// In PATCH /bookings/:id handler:
const booking = await db
  .select()
  .from(bookings)
  .where(eq(bookings.id, bookingId))
  .then((rows) => rows[0]);

const { status: newStatus } = await c.req.json();

if (!validTransitions[booking.status]?.includes(newStatus)) {
  return c.json(
    { error: `Invalid transition from ${booking.status} to ${newStatus}` },
    400,
  );
}
```

### Direction-Specific Authorization

```typescript
// Extract the user's Artist or Venue profile
const userArtistProfile = await db.query.artistProfiles.findFirst({
  where: eq(artistProfiles.user_id, user.id),
});

const userVenueProfile = await db.query.venueProfiles.findFirst({
  where: eq(venueProfiles.user_id, user.id),
});

// For venue_to_artist bookings, only Artist can accept/reject
if (
  booking.direction === "venue_to_artist" &&
  ["accepted", "rejected"].includes(newStatus) &&
  !userArtistProfile?.id === booking.artist_id
) {
  return c.json(
    { error: "Only the Artist can respond to this invitation" },
    401,
  );
}

// For artist_to_venue bookings, only Venue can accept/reject
if (
  booking.direction === "artist_to_venue" &&
  ["accepted", "rejected"].includes(newStatus) &&
  !userVenueProfile?.id === booking.venue_id
) {
  return c.json(
    { error: "Only the Venue can respond to this application" },
    401,
  );
}

// For pending → cancelled (artist_to_venue), only Artist can initiate
if (
  booking.direction === "artist_to_venue" &&
  booking.status === "pending" &&
  newStatus === "cancelled" &&
  !userArtistProfile?.id === booking.artist_id
) {
  return c.json(
    { error: "Only the Artist can withdraw their application" },
    401,
  );
}

// For accepted → cancelled, either party can initiate
if (booking.status === "accepted" && newStatus === "cancelled") {
  const isArtist = userArtistProfile?.id === booking.artist_id;
  const isVenue = userVenueProfile?.id === booking.venue_id;

  if (!isArtist && !isVenue) {
    return c.json({ error: "Not authorized to cancel this booking" }, 401);
  }
}
```

### Notification Dispatch on Status Change

```typescript
// After validating transition and updating DB:
const updated = await db
  .update(bookings)
  .set({ status: newStatus, updated_at: new Date() })
  .where(eq(bookings.id, bookingId))
  .returning()
  .then((rows) => rows[0]);

// Determine who to notify and message content
const notifyRole =
  booking.direction === "venue_to_artist"
    ? booking.status === "pending"
      ? "venue" // Artist just responded to Venue's invitation
      : "artist" // Venue cancelled an accepted booking
    : booking.status === "pending"
      ? "artist" // Venue just responded to Artist's application
      : "venue"; // Artist cancelled or withdrew

let title: string;
let body: string;

if (newStatus === "accepted") {
  const responder = notifyRole === "artist" ? "Venue" : "Artist";
  title = `Great news! ${responder} accepted your booking`;
  body = `Event: ${event.title} on ${event.date_start}`;
} else if (newStatus === "rejected") {
  const decliner = notifyRole === "artist" ? "Venue" : "Artist";
  title = `${decliner} declined your booking`;
  body = `Event: ${event.title}`;
} else if (newStatus === "cancelled") {
  const canceller = isArtist ? "Artist" : "Venue";
  title = `${canceller} cancelled the booking`;
  body = `Event: ${event.title}. Event date: ${event.date_start}`;
}

// Get the notified user's device tokens
const notifiedProfileId =
  notifyRole === "artist" ? booking.artist_id : booking.venue_id;
const notifiedUserId =
  (await db.query.artistProfiles
    .findFirst({
      where: eq(artistProfiles.id, notifiedProfileId),
      columns: { user_id: true },
    })
    .then((r) => r?.user_id)) ||
  (await db.query.venueProfiles
    .findFirst({
      where: eq(venueProfiles.id, notifiedProfileId),
      columns: { user_id: true },
    })
    .then((r) => r?.user_id));

const notifiedUser = await db.query.users.findFirst({
  where: eq(users.id, notifiedUserId),
});

if (notifiedUser?.device_tokens?.length) {
  await sendFCMNotification({
    tokens: notifiedUser.device_tokens,
    title,
    body,
    data: {
      persona: notifyRole,
      route: "/bookings",
      booking_id: updated.id,
    },
  });
}

return c.json(updated, 200);
```

### React Native — Booking Card UI (State-Aware)

```typescript
export function BookingCard({ booking, onAction }: Props) {
  const { user } = useAuth();
  const isArtist = user.role === 'artist';
  const isVenue = user.role === 'venue';

  // Determine which party is viewing and what actions are available
  const isSelfInitiated = booking.direction === 'artist_to_venue' && isArtist;
  const isRecipient = booking.direction === 'venue_to_artist' && isArtist ||
                       booking.direction === 'artist_to_venue' && isVenue;
  const isInitiator = booking.direction === 'venue_to_artist' && isVenue ||
                      booking.direction === 'artist_to_venue' && isArtist;

  return (
    <View style={styles.card}>
      <Text style={styles.header}>{booking.venue_name}</Text>
      <Text style={styles.event}>{booking.event_title}</Text>
      <Text style={styles.status}>Status: {booking.status}</Text>

      {/* Pending — decision-maker sees accept/reject; applicant sees cancel (artist_to_venue only) */}
      {booking.status === 'pending' && (
        <View style={styles.actions}>
          {isRecipient && (
            <>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => onAction(booking.id, 'accepted')}
              >
                <Text style={styles.btnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => onAction(booking.id, 'rejected')}
              >
                <Text style={styles.btnText}>Reject</Text>
              </TouchableOpacity>
            </>
          )}
          {isSelfInitiated && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => onAction(booking.id, 'cancelled')}
            >
              <Text style={styles.btnText}>Withdraw Application</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Accepted — both parties can cancel */}
      {booking.status === 'accepted' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => onAction(booking.id, 'cancelled')}
          >
            <Text style={styles.btnText}>Cancel Booking</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Rejected or Cancelled — terminal, no actions */}
      {['rejected', 'cancelled'].includes(booking.status) && (
        <View style={styles.terminalBanner}>
          <Text style={styles.terminalText}>
            {booking.status === 'rejected' ? 'Booking Declined' : 'Booking Cancelled'}
          </Text>
        </View>
      )}
    </View>
  );
}
```

### Common Gotchas

- **Asymmetric rejection rules**: Venue-initiated bookings cannot be cancelled by the Artist while pending — they must reject instead. Artist-initiated bookings can be withdrawn by the Artist while pending. This asymmetry is intentional (respects the initiator's control). Document it clearly in tooltips or help text.
- **Terminal states**: Once a booking reaches `rejected` or `cancelled`, no further transitions are possible. If the Artist/Venue wants to retry, they must create a new booking record. The old one stays in the DB for audit and history. Do not re-use old booking IDs.
- **Race conditions**: Two simultaneous requests (one accepting, one rejecting) could both succeed if not carefully guarded. Use database-level constraints or optimistic locking (version field in V2). For V1 under 1,000 users, last-write-wins is acceptable.
- **Notification retry logic**: If FCM notification fails to send (device offline), do not retry immediately. Log it and rely on the Bookings tab to be the source of truth. When the user opens the app next time, they will see the status change.
- **Event soft-deletes**: If a Venue deletes (soft-deletes) an event after creating a booking, the booking's event_id still exists in the DB but points to a soft-deleted row. When rendering the booking, join to events and check `deleted_at IS NULL`. Handle gracefully in UI (show "[Event Removed]" or similar).
