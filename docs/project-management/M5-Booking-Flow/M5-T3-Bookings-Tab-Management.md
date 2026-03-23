# M5-T3 · Bookings Tab — Full Management View

| Field | Value |
|-------|-------|
| **Milestone** | M5 — Booking Flow |
| **Status** | 🔲 To Do |
| **Depends on** | M5-T1, M5-T2 (both booking directions must exist) |
| **PRD Ref** | Section 6.2 (Artist Bookings), Section 7.2 (Venue Bookings) |

---

## Description
The Bookings tab is the central hub for managing all booking activity across both directions (incoming and outgoing). The tab content adapts based on the user's current persona. Spectators do not see this tab.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Bookings list endpoint with persona-aware filtering |
| `apps/mobile` | Bookings tab UI, status-grouped lists, action buttons, booking detail view |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/bookings?status=` | List bookings for the current persona; optional status filter |
| GET | `/bookings/:id` | Get single booking detail |

---

## Requirements
- R1: Bookings tab visible to Artist and Venue personas only — hidden for Spectator
- R2: Artist view: incoming invitations from Venues (direction = `venue_to_artist`) + outgoing applications to gig opportunities (direction = `artist_to_venue`)
- R3: Venue view: outgoing invitations sent to Artists + incoming applications received from Artists
- R4: Bookings grouped by status: Pending, Accepted, Rejected, Cancelled
- R5: Each booking entry shows: event title, counterparty name (Artist or Venue), date, status badge
- R6: Tapping a booking opens the Booking Detail view with full information and available actions
- R7: Actions available per status: Pending (accept/reject for the receiving party; cancel for the sender); Accepted (cancel for either party); Rejected and Cancelled are read-only
- R8: Unread/new booking notifications reflected with a badge count on the Bookings tab icon

---

## Acceptance Criteria
- [ ] Bookings tab hidden when user is in Spectator persona
- [ ] Artist sees both incoming Venue invitations and their outgoing gig opportunity applications
- [ ] Venue sees both outgoing Artist invitations and incoming Artist applications
- [ ] Status grouping (Pending, Accepted, Rejected, Cancelled) correctly applied
- [ ] Booking detail view shows all relevant information
- [ ] Correct action buttons shown based on persona and booking direction
- [ ] Badge count on Bookings tab icon reflects unread booking notifications

---

## Technical Notes
- The API filters bookings based on the authenticated user's `current_role` — same endpoint serves both Artist and Venue views
- Badge count on the tab icon wired up to unread notifications count for booking-related notifications (M7-T1)
- Spectator persona has no Bookings tab; the tab navigator hides this tab when `current_role = spectator`
