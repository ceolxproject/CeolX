# M4-T1 · Create Event + Edit Event (Artist & Venue)

| Field | Value |
|-------|-------|
| **Milestone** | M4 — Event System |
| **Status** | 🔲 To Do |
| **Depends on** | M2-T4 (persona system), M1-T2 (events table), M1-T3 (API scaffold) |
| **PRD Ref** | Section 6.1 (Artist Features), Section 7.1 (Venue Features), Section 9.3 (Event Data Model) |

---

## Description
Artists and Venues can create events through the mobile app. Every new event enters `pending_review` status and must be approved by the Super Admin before going live. Creators can also edit events that are in `draft`, `pending_review`, or `rejected` status.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Create/edit event endpoints, status transition logic, input validation |
| `apps/mobile` | Create Event form screen, Edit Event screen, image picker integration |
| `packages/shared` | `EventStatus` enum |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/events` | Create a new event (status → `pending_review`) |
| PATCH | `/events/:id` | Edit event fields (allowed for `draft`, `pending_review`, `rejected`) |
| GET | `/events/:id` | Get single event detail |

---

## Requirements
- R1: `POST /events` creates event with `status = pending_review` — never `active` on creation
- R2: Required fields: `title`, `date_start`, `lat`, `lng` or `venue_address`, `category`
- R3: Optional fields: `description`, `cover_image`, `date_end`, `venue_id`, `ticket_link`, `is_gig_opportunity`, `collection_id`, `collaborators`
- R4: `cover_image` uploaded to AWS S3 and stored as a CDN URL — not a raw S3 URL
- R5: Location input: user taps map to drop a pin OR searches an address; lat/lng captured from pin; `venue_address` is free-text fallback when no registered venue selected
- R6: `PATCH /events/:id` only allowed when `status` is `draft`, `pending_review`, or `rejected` — editing an `active` event is blocked (must be rejected by admin first to re-enter flow)
- R7: Only the event creator can edit their own event
- R8: `is_gig_opportunity` flag only settable by Venue persona
- R9: Resubmitting an edited rejected event sets `status = pending_review` and clears `rejection_reason`
- R10: All inputs validated using `@hono/zod-validator`

---

## Acceptance Criteria
- [ ] Artist and Venue can open a Create Event form and submit it
- [ ] Submitted event appears in admin pending moderation queue (not on public map/feed)
- [ ] Cover image uploads to S3 and displays in form preview
- [ ] Location pin dropped on embedded mini-map in form captures lat/lng
- [ ] Editing a rejected event and resubmitting sets status back to `pending_review`
- [ ] Attempting to edit an `active` event returns an error
- [ ] Only the creator can edit their own event (other users get 403)
- [ ] Validation errors shown inline for required fields
- [ ] `is_gig_opportunity` checkbox only visible to Venue persona

---

## Technical Notes
- Cover image upload flow: mobile picks image → uploads directly to S3 presigned URL → stores the CloudFront CDN URL in the `events.cover_image` field
- `lat` and `lng` stored as `numeric(10,7)` — sufficient precision for Irish geolocations
- Location input should provide both: (a) tap-to-pin on an embedded map and (b) address text search — the pin sets the lat/lng
- Gig opportunity events (`is_gig_opportunity: true`) are visible to Artists on the feed/map but not to Spectators
