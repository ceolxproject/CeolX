# M4-T4 · My Events View + Collections

| Field | Value |
|-------|-------|
| **Milestone** | M4 — Event System |
| **Status** | 🔲 To Do |
| **Depends on** | M4-T1 (events must exist), M2-T4 (persona system) |
| **PRD Ref** | Section 6.1 (Artist Features), Section 7.1 (Venue Features), Section 9.3 (Event Data Model) |

---

## Description
Artists and Venues need a dedicated view to manage their own events. Collections allow Venues to group related events (e.g. a festival series) under a single branded entity with its own logo.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | My Events list endpoint, collections CRUD endpoints |
| `apps/mobile` | My Events section in Profile tab, Collections management screen |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/users/me/events` | List all events created by the authenticated user |
| GET | `/users/me/saved-events` | List all events saved by the authenticated user |
| POST | `/collections` | Create a new collection |
| GET | `/collections/:id` | Get collection with its events |
| PATCH | `/collections/:id` | Edit collection name/logo |
| DELETE | `/collections/:id` | Delete collection (events not deleted — they lose `collection_id`) |

---

## Requirements
- R1: **My Created Events** — Artists and Venues see all events they created, grouped by status: Active, Pending Review, Rejected, Archived (Past)
- R2: Each event entry shows: title, date, status badge, cover image thumbnail
- R3: Tapping an event navigates to Event Detail
- R4: Events with `status = rejected` show the rejection reason as a subtitle
- R5: **Saved Events** — All personas (Spectator, Artist, Venue) can see a "Saved Events" section listing all events they have bookmarked via the Save button (M4-T2). Saved events are backed by the `saved_events` table.
- R6: Saved Events section shows only upcoming saved events by default; past (archived) saved events are shown in a "Past Saved Events" collapsible section below
- R7: Tapping a saved event navigates to Event Detail; if the event has since been archived, show it in a read-only state
- R8: Collections are Venue-only — Artist and Spectator personas do not see Collections UI
- R9: A collection has: `name`, `logo` (S3 image), `created_by` (venue profile ID)
- R10: When creating an event, Venue can optionally assign it to a collection
- R11: Collection detail page shows the collection logo, name, and all its associated events
- R12: Deleting a collection does not delete the associated events — it only removes the `collection_id` FK from those events

---

## Acceptance Criteria
- [ ] My Created Events section visible on Artist and Venue profile tabs
- [ ] Events grouped correctly by status: Active, Pending Review, Rejected, Archived
- [ ] Rejected events show rejection reason in the listing
- [ ] Saved Events section visible for ALL personas (Spectator, Artist, Venue) in their Profile tab
- [ ] Saved Events shows correct upcoming events the user has bookmarked
- [ ] Removing a save from Event Detail is reflected in Saved Events list (on next load)
- [ ] Venue can create a collection, upload a logo, and assign events to it
- [ ] Collection page shows all associated events
- [ ] Deleting a collection does not delete its events — events remain but lose collection association
- [ ] Artist and Spectator personas have no Collections UI visible

---

## Technical Notes
- Status grouping on My Events is client-side — the API returns all events; the mobile app groups by status
- Collection logo uploaded to S3, stored as a CloudFront CDN URL
- `collections.created_by` references a `venue_profiles` ID, not a `users` ID
- Past events (`status = archived`) are shown in a separate "Past Events" section below active/pending/rejected
