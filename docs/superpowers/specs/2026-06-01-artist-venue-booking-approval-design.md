# Artist→Venue event approval (event goes live only after the venue accepts)

**Asana:** 1215189395180422 — "[P1][Functional] Event auto-accepted on Venue side when Artist adds a Venue"
**Date:** 2026-06-01
**Status:** Approved design

## Problem

When an Artist creates an event and selects a **registered venue**, the event currently goes live
immediately and the venue booking is written as `ACCEPTED` — the venue's profile is attached to a
live event without the venue's consent.

PM (Pratiksha) confirmed with the client: a venue's profile must not be used without the venue's
approval, mirroring the artist-invite rule. So an artist adding a venue must become a **request** the
venue approves, and the event must **not go live** until then.

## Current behaviour (the bug)

`packages/api/src/routers/events/crud.ts` `create`, artist + `venueId` branch (lines ~351-405):

- event inserted with `status = active`
- booking inserted with `status = ACCEPTED`, `direction = artist_to_venue`
- notification `EVENT_HOSTED_AT_VENUE_TO_VENUE` (off-matrix auto-confirm)
- synced to Typesense → live on map/feed

The `update` path does **not** create an artist→venue booking at all, so an artist editing an event
to add a registered venue attaches the venue with no consent and no booking.

## Existing infrastructure we reuse (no new tables / enums / triggers)

- `bookings.direction = artist_to_venue`, `status = pending` — the model already exists.
- `bookings.update` is direction-aware: for `artist_to_venue` the **venue is the recipient**
  (accept/reject) and the **artist is the sender** (withdraw). No change to auth logic needed.
- Venue "Requests" = `bookings.list({ tab: 'received' })` → `artist_to_venue` rows. Pending requests
  appear here automatically.
- Venue "Bookings" = `bookings.confirmedEvents` → events whose collaborator row links an **accepted**
  booking. Held events stay out until accepted.
- `BOOKING_REQUEST_TO_VENUE` (request received) and `BOOKING_ACCEPTED_TO_ARTIST` /
  `BOOKING_REJECTED_TO_ARTIST` notifications already exist (used by `requestToPerform` + `update`).
- `pending_review` already exists in `EVENT_STATUSES` (reserved, unused in V1) — no DB migration.

## Decisions

1. **Held status:** event sits at `pending_review` while awaiting the venue. Hidden from map/feed
   (not synced to Typesense). Artist sees it in My Events.
2. **On venue reject:** event stays `pending_review`; artist gets the existing reject notification and
   can edit to choose another venue (or free-text) to make it go live. No data discarded.
3. **Edit path covered:** adding/switching to a registered venue on edit also creates a pending
   request and holds the event.
4. **Free-text address only (no `venueId`):** event goes live immediately, no booking — there is no
   profile to consent. (Unchanged.)
5. **Legacy auto-confirmed events:** left untouched (same precedent as the 31/05 collaborator change).

## Design

### A. Create — `events/crud.ts` `create`, artist + registered `venueId`

- Insert event with `status = pending_review` (was `active`).
- Insert booking `status = PENDING` (was `ACCEPTED`), `direction = artist_to_venue`.
- Insert the artist + venue `eventCollaborators` rows linked to the pending booking (unchanged shape;
  `confirmedEvents` hides them until accepted).
- Notify venue with `BOOKING_REQUEST_TO_VENUE` (replaces `EVENT_HOSTED_AT_VENUE_TO_VENUE`).
- **Skip** `syncEventToTypesense` (only active events are synced).

### B. Create — artist + free-text address only

- Unchanged: `status = active`, no booking, synced to Typesense.

### C. Venue accepts — `bookings.update`

- After the status update, when `newStatus = accepted` **and** `booking.direction = artist_to_venue`
  **and** the booking's event is currently `pending_review`:
  - set event `status = active`, `updatedAt = now`
  - `syncEventToTypesense(event)`
- Guard on `pending_review` so the `requestToPerform` case (event already active) is a no-op on event
  status.

### D. Venue rejects / cancels — `bookings.update`

- Event stays `pending_review` (no status change). Existing collaborator-row cleanup (delete by
  `bookingId`) and `BOOKING_REJECTED_TO_ARTIST` / cancel notifications already fire.

### E. Edit — `events/crud.ts` `update` (artist creator only)

Determine the registered-venue transition from `updateData.venueId` vs `event.venueId`:

- **Add/switch to a registered venue** (`newVenueId` set, `!== event.venueId`, no active
  `artist_to_venue` booking for it):
  - cancel any existing pending `artist_to_venue` booking for this event + delete its collaborator rows
  - insert new `PENDING` `artist_to_venue` booking + artist/venue collaborator rows
  - set event `status = pending_review`; `removeEventFromTypesense`
  - notify the new venue `BOOKING_REQUEST_TO_VENUE`
- **Clear venue / switch to free-text** while held: cancel the pending `artist_to_venue` booking; if
  the event was `pending_review`, set `status = active` + `syncEventToTypesense`.
- Existing admin-removed → resubmit path unchanged.

### F. UI (native)

- `getMyEvents` already returns `pending_review`; the My Events list shows a "Awaiting venue approval"
  state for `pending_review` events (small label/badge — confirm existing status-label component
  during implementation). No change to the venue Requests/Bookings tabs (they work as-is).

## Out of scope

- No new Typesense schema, no DB migration, no new notification triggers.
- Venue→artist invite flow (already pending), `requestToPerform` (already pending) — untouched.
- Admin moderation of `pending_review` events — `pending_review` here means "awaiting venue", not
  "awaiting admin"; admin moderation remains post-publication on active events per CLAUDE.md.

## Testing

- `events.create`: artist + registered venue → event `pending_review`, booking `pending`, no Typesense
  sync, `BOOKING_REQUEST_TO_VENUE` dispatched.
- `events.create`: artist + free-text only → event `active`, no booking.
- `bookings.update` accept: `artist_to_venue` + event `pending_review` → event `active` + synced;
  `requestToPerform` accept (event already `active`) → event unchanged.
- `bookings.update` reject: event stays `pending_review`, collaborator rows removed.
- `events.update`: add registered venue → held + pending request; clear venue on a held event →
  released to `active`.
