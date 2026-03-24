# M3-T4 · Feed View (Algorithmic) + Discover Tab

| Field          | Value                                                                   |
| -------------- | ----------------------------------------------------------------------- |
| **Milestone**  | M3 — Map & Discovery                                                    |
| **Status**     | 🔲 To Do                                                                |
| **Depends on** | M3-T1 (location handling done), M4 (events must exist to populate feed) |
| **PRD Ref**    | Section 9.1 (Feed & Discovery), Section 5.1 (End User Features)         |

---

## Description

The Discover tab — a feed-based alternative to the map. Events are ordered algorithmically by recency, distance, and social graph (followed accounts). Gig opportunity events are hidden from Spectators and shown only to Artists.

---

## Affected Apps / Packages

| App / Package | Role                                                                            |
| ------------- | ------------------------------------------------------------------------------- |
| `apps/api`    | Algorithmic feed query, pagination, gig opportunity filtering                   |
| `apps/mobile` | Discover tab vertical feed UI, category chips, infinite scroll, pull-to-refresh |

---

## API Endpoints

| Method | Path                        | Purpose                                        |
| ------ | --------------------------- | ---------------------------------------------- |
| GET    | `/events/feed?lat&lng&page` | Paginated algorithmic event feed (20 per page) |

---

## Requirements

- R1: Feed returns 20 items per page with a `hasNextPage` flag
- R2: Algorithmic ordering weights: Recency 40% (newest first), Distance 40% (closest to user's lat/lng), Social graph 20% (events from followed Artists/Venues ranked higher)
- R3: `is_gig_opportunity = true` events excluded from Spectator feed; visible to Artists with a "Gig Opportunity" label; visible to Venues under their My Events section
- R4: Promotional posts from followed accounts interleaved inline in the feed
- R5: Infinite scroll — next page loaded when user scrolls near the bottom
- R6: Pull-to-refresh reloads page 1 of the feed
- R7: Category filter chips at the top of the feed (horizontal scroll) for filtering
- R8: Tapping an event card navigates to Event Detail screen
- R9: Tapping an artist/venue name on a card navigates to their Profile screen
- R10: Event card shows: cover image, title, date, distance from user, category tag

---

## Acceptance Criteria

- [ ] Discover tab shows a vertical scrollable feed of event cards
- [ ] Each event card shows cover image, title, date, distance, category tag
- [ ] Infinite scroll loads next page when near bottom
- [ ] Pull-to-refresh reloads the feed
- [ ] Category chips at top filter the feed
- [ ] Gig opportunity events are hidden from Spectator feed
- [ ] Gig opportunity events show "Gig Opportunity" label in Artist feed
- [ ] Promotional posts from followed accounts appear inline
- [ ] Tapping event card navigates to Event Detail
- [ ] Tapping artist/venue name navigates to Profile

---

## Technical Notes

- Distance calculation uses the Haversine formula server-side — raw lat/lng is never returned to the client; only the human-readable distance string (e.g. "3.2 km away")
- The feed algorithm weights (40/40/20) are a starting point — they can be tuned after launch based on engagement data
- `hasNextPage` flag in the response tells the mobile app whether to show or hide the infinite scroll trigger
