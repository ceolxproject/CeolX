# M9-T2 · Event Moderation Queue (Admin Dashboard)

| Field | Value |
|-------|-------|
| **Milestone** | M9 — Super Admin |
| **Status** | 🔲 To Do |
| **Depends on** | M9-T1 (admin auth), M4-T3 (moderation logic in API) |
| **PRD Ref** | Section 8 (Super Admin — Content Moderation) |

---

## Description
The Pending Events page in the admin dashboard. The Super Admin reviews submitted events, approves or rejects them with a reason. This is the admin-side counterpart to M4-T3 which built the API and mobile-side moderation flow.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/admin` | Pending Events Queue page, event detail view, approve/reject modal |
| `apps/api` | Moderation endpoints (already built in M4-T3 — this task wires the admin UI to them) |

---

## API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/events/pending` | List events awaiting moderation |
| POST | `/admin/events/:id/approve` | Approve event → `status = active` |
| POST | `/admin/events/:id/reject` | Reject event with reason → `status = rejected` |

---

## Requirements
- R1: Pending Events page lists all `status = pending_review` events, oldest submitted first
- R2: Each row shows: cover image thumbnail, event title, creator name + persona (Artist/Venue), submitted date/time
- R3: Admin can click into an event to view full details before deciding
- R4: Approve button → `POST /admin/events/:id/approve` → event goes live immediately
- R5: Reject button → opens a modal requiring a written rejection reason → `POST /admin/events/:id/reject`
- R6: Rejection reason is mandatory — reject button in modal disabled until reason is entered
- R7: After approve/reject, the event is removed from the pending queue
- R8: "Pending Events" sidebar badge count updates after each action

---

## Acceptance Criteria
- [ ] Pending Events page shows all `pending_review` events with correct fields
- [ ] Oldest events shown first
- [ ] Clicking into an event shows full details (cover image, description, location, date, creator)
- [ ] Approve button activates the event and removes it from the queue
- [ ] Reject button opens modal; reject is disabled until reason is typed
- [ ] After rejection, event removed from queue and creator is notified (push notification via M4-T3)
- [ ] Sidebar badge count decrements after each approve/reject action

---

## Technical Notes
- Event detail view in admin should display the map pin location (embedded mini-map) so admin can verify the location is in Ireland before approving
- The API endpoints (`/admin/events/:id/approve` and `/admin/events/:id/reject`) were scaffolded in M4-T3 — this task only builds the admin UI that calls them
- Consider adding a simple filtering option (all pending / pending by Artist / pending by Venue) for admin convenience — nice to have, not required
