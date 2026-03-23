# M4-T3 · Event Moderation Flow (Admin Approve / Reject)

| Field | Value |
|-------|-------|
| **Milestone** | M4 — Event System |
| **Status** | 🔲 To Do |
| **Depends on** | M4-T1 (events must be created), M1-T5 (admin scaffold), M9-T1 (admin auth) |
| **PRD Ref** | Section 8 (Super Admin Features), Section 9.3 (Event Status Lifecycle) |

---

## Description
The admin moderation pipeline. Every event submitted by Artists or Venues sits in the `pending_review` queue until the Super Admin approves or rejects it. Approval makes it live on the map and feed. Rejection notifies the creator with a reason so they can edit and resubmit.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Moderation endpoints, status transition logic, push notification trigger |
| `apps/admin` | Pending Events Queue page, approve/reject UI |
| `apps/mobile` | Creator notification receipt, rejection reason display on Event Detail |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/events/pending` | List all events with `status = pending_review` |
| POST | `/admin/events/:id/approve` | Set `status = active`, trigger push notification to creator |
| POST | `/admin/events/:id/reject` | Set `status = rejected`, store `rejection_reason`, trigger push notification |

---

## Requirements
- R1: `GET /admin/events/pending` returns all events with `status = pending_review`, sorted by `created_at` ascending (oldest first)
- R2: Admin can approve an event → `status = active`; event becomes visible on map and feed immediately
- R3: Admin can reject an event with a mandatory written reason → `status = rejected`, `rejection_reason` populated
- R4: Creator receives a push notification on approval: *"Your event '[title]' is now live!"*
- R5: Creator receives a push notification on rejection with the rejection reason included
- R6: Creator can edit a rejected event and resubmit → `status = pending_review`, `rejection_reason` cleared
- R7: Admin pending queue shows: event title, creator name, persona (Artist/Venue), submitted date, cover image thumbnail
- R8: Rejection reason field is mandatory on the admin reject action — cannot reject without a reason

---

## Acceptance Criteria
- [ ] Admin Pending Events page lists all `pending_review` events, oldest first
- [ ] Approving an event sets `status = active` and event appears on map/feed
- [ ] Rejecting an event requires a reason to be entered before submitting
- [ ] Rejected event shows `rejection_reason` to creator on their Event Detail screen
- [ ] Creator receives push notification on approval and rejection
- [ ] Creator can edit and resubmit a rejected event; it re-enters `pending_review`
- [ ] Only Super Admin can call `/admin/events/:id/approve` and `/admin/events/:id/reject` (auth guard)

---

## Technical Notes
- Status lifecycle: `draft → pending_review → active → archived` (and `pending_review → rejected → pending_review` for resubmission)
- Hard delete is never used — `archived` is the terminal state for expired events
- Push notification sent via Firebase FCM — notification payload must include `persona` and `route` fields for persona-aware routing on mobile (per M2-T4)
- Profile creation and profile edits are NOT moderated — events only
