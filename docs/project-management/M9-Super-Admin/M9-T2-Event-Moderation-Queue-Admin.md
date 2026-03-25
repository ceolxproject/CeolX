# M9-T2 · Event Moderation Queue (Admin Dashboard)

| Field          | Value                                               |
| -------------- | --------------------------------------------------- |
| **Milestone**  | M9 — Super Admin                                    |
| **Status**     | 🔲 To Do                                            |
| **Depends on** | M9-T1 (admin auth), M4-T3 (moderation logic in API) |
| **PRD Ref**    | Section 8 (Super Admin — Content Moderation)        |

---

## Description

The Pending Events page in the admin dashboard. The Super Admin reviews submitted events, approves or rejects them with a reason. This is the admin-side counterpart to M4-T3 which built the API and mobile-side moderation flow.

---

## Affected Apps / Packages

| App / Package  | Role                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------ |
| `apps/admin`   | Pending Events Queue page, event detail view, approve/reject modal                         |
| `packages/api` | `admin.pendingEvents`, `admin.approveEvent`, `admin.rejectEvent` — tRPC procedures (M9-T1) |

---

## tRPC Procedures

All three procedures are `adminProcedure` — require authenticated Super Admin session (wired in M9-T1).

### `admin.pendingEvents` (adminProcedure · query)

List all events with `status = pending_review`, oldest first.

**Output:**

```typescript
{
  events: Array<{
    id: string;
    title: string;
    coverImage: string | null;
    creatorName: string;
    creatorPersona: "artist" | "venue";
    submittedAt: string;
    location: { lat: number; lng: number; address: string };
  }>;
}
```

### `admin.approveEvent` (adminProcedure · mutation)

Approve a pending event → `status = active`. Creator receives push notification.

**Input:** `{ id: string }`

**tRPC errors:** `NOT_FOUND` — event not found or not in `pending_review`

### `admin.rejectEvent` (adminProcedure · mutation)

Reject a pending event with a mandatory reason → `status = rejected`. Creator notified with reason.

**Input:** `{ id: string, reason: string }`

**tRPC errors:**

- `NOT_FOUND` — event not found or not in `pending_review`
- `BAD_REQUEST` — reason is empty

---

## Requirements

- R1: Pending Events page lists all `status = pending_review` events, oldest submitted first
- R2: Each row shows: cover image thumbnail, event title, creator name + persona (Artist/Venue), submitted date/time
- R3: Admin can click into an event to view full details before deciding
- R4: Approve button → calls `trpc.admin.approveEvent.mutate({ id })` → event goes live immediately
- R5: Reject button → opens a modal requiring a written rejection reason → calls `trpc.admin.rejectEvent.mutate({ id, reason })`
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
- The tRPC procedures (`admin.pendingEvents`, `admin.approveEvent`, `admin.rejectEvent`) are defined in `packages/api/src/routers/admin.ts` and scaffolded in M1-T3 — this task only builds the admin UI that calls them via the tRPC client
- Consider adding a simple filtering option (all pending / pending by Artist / pending by Venue) for admin convenience — nice to have, not required
