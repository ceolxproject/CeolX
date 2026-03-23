# M5-T2 · Artist-Initiated Booking (Apply to Gig Opportunity)

| Field | Value |
|-------|-------|
| **Milestone** | M5 — Booking Flow |
| **Status** | 🔲 To Do |
| **Depends on** | M5-T1 (booking infrastructure), M4-T1 (gig opportunity events), M2-T4 (persona system) |
| **PRD Ref** | Section 6.2 (Artist Booking Features), Section 9.4 (Booking Flow) |

---

## Description
Artists apply to Venue gig opportunity events (`is_gig_opportunity: true`). The Venue receives the application and can accept or reject it. The "Apply" button on gig opportunity events triggers this flow.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Artist-initiated booking creation, Venue accept/reject endpoints |
| `apps/mobile` | Apply button on gig opportunity Event Detail, outgoing application tracking for Artists, incoming application management for Venues |
| `packages/shared` | `BookingDirection` enum (`artist_to_venue`) |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/bookings` | Create booking — Artist applies to a gig opportunity |
| PATCH | `/bookings/:id` | Venue accepts / rejects the application |
| GET | `/bookings` | List bookings (shared with M5-T1 endpoint) |

---

## Requirements
- R1: Artist taps "Apply" on a gig opportunity event → creates booking with `direction = artist_to_venue`, `status = pending`
- R2: Venue receives push notification: *"[Artist Name] applied to [Event Title]"*
- R3: Venue can view all incoming applications on their Bookings tab
- R4: Venue can accept or reject an application
- R5: Accepted: `status = accepted`; Artist notified
- R6: Rejected: `status = rejected`; Artist notified
- R7: Artist can cancel their pending application (before Venue responds): `status = cancelled`
- R8: Artist cannot apply to the same event twice — duplicate application blocked

---

## Acceptance Criteria
- [ ] "Apply" button visible only on gig opportunity events when viewed by Artist persona
- [ ] Tapping Apply creates a pending booking and shows confirmation to Artist
- [ ] Venue receives push notification for incoming application
- [ ] Venue sees incoming applications in Bookings tab with accept/reject actions
- [ ] Accepting notifies Artist; rejecting notifies Artist
- [ ] Artist can cancel a pending application
- [ ] Duplicate application attempt returns an error

---

## Technical Notes
- The `POST /bookings` endpoint handles both directions (venue_to_artist and artist_to_venue) — differentiated by the `direction` field in the request body
- Gig opportunity events must have `is_gig_opportunity: true` — the API must validate this before creating an artist-initiated booking
- An Artist should not be able to apply to an event they are already attached to as a collaborator
