# M9-T2 · Event Moderation (Admin Dashboard)

| Field          | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| **Milestone**  | M9 — Super Admin                                                   |
| **Status**     | 🔲 To Do                                                           |
| **Depends on** | M9-T1 (admin auth), creator-side resubmit logic in `events.update` |
| **PRD Ref**    | Section 8 (Super Admin — Content Moderation), MoM 3rd Apr 2026 §4  |

---

## Description

The Event Moderation page in the admin dashboard. Per the MoM 3rd Apr 2026 (Section 4), CeolX moved from pre-publication moderation to **post-publication moderation**: events go live immediately on creation. The Super Admin reviews live events and removes inappropriate content with a **mandatory reason**. The creator is notified and can edit and resubmit (REMOVED → ACTIVE), which the existing `events.update` mutation handles automatically.

> **Historical note:** Earlier drafts of this task described a `pending_review → approve/reject` queue. That flow is no longer used in V1 — the `pending_review` and `rejected` enum values remain in the schema for future flexibility but are never written by the application.

---

## Affected Apps / Packages

| App / Package     | Role                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `apps/admin`      | Event Moderation page, status/persona filters, search, detail dialog, remove flow            |
| `packages/api`    | `admin.listEvents`, `admin.removeEvent` — tRPC `adminProcedure`s                             |
| `packages/shared` | `adminEventListQuerySchema`, `adminRemoveEventSchema` — Zod schemas (single source of truth) |

---

## tRPC Procedures

Both procedures are `adminProcedure` — authenticated Super Admin session required (M9-T1).

### `admin.listEvents` (adminProcedure · query)

List events filtered by status, creator persona, and title search. Sorted newest first.

**Input** (`adminEventListQuerySchema`):

```typescript
{
  status: 'active' | 'removed' | 'archived';   // default: 'active'
  persona?: 'artist' | 'venue';                 // optional
  q?: string;                                   // title ILIKE search, max 100 chars
  limit: number;                                // 1-50, default 20
  offset: number;                               // ≥0, default 0
}
```

**Output:**

```typescript
{
  events: Array<{
    id: string;
    title: string;
    coverImage: string | null;
    description: string;
    dateStart: Date;
    lat: string;
    lng: string;
    venueAddress: string | null;
    status: 'active' | 'removed' | 'archived' | ...;
    removalReason: string | null;
    createdAt: Date;
    creator: { id: string; name: string | null; persona: 'artist' | 'venue' | 'spectator' | 'admin' | null };
  }>;
  total: number;
}
```

### `admin.removeEvent` (adminProcedure · mutation)

Remove a live event with a mandatory reason. Sets `status = REMOVED`, populates `removalReason`, fires the moderation notification, and removes the event from the Typesense map index. Idempotent: removing an already-removed event throws `NOT_FOUND`.

**Input** (`adminRemoveEventSchema`):

```typescript
{
  id: string; // UUID
  removalReason: string; // 10-500 characters
}
```

**Side effects:**

- Dispatches `EVENT_REMOVED_BY_ADMIN_TO_ARTIST` (A-15) or `EVENT_REMOVED_BY_ADMIN_TO_VENUE` (V-14) to the creator's user ID via `ctx.dispatchNotification`. Failure is non-blocking.
- Calls `removeEventFromTypesense(id)` so the removed event disappears from the map. Failure is non-blocking.

**tRPC errors:**

- `BAD_REQUEST` — Zod rejects malformed `id` or `removalReason`
- `NOT_FOUND` — event missing or not currently `active` (already removed/archived/etc.)

---

## Resubmit (out of scope — already shipped)

The creator-side `events.update` mutation (`packages/api/src/routers/events/crud.ts`, commit `4927c6b`) detects `REMOVED → ACTIVE` and:

- Clears `removalReason`
- Fires `EVENT_RESUBMITTED_TO_ARTIST` (A-16) or `EVENT_RESUBMITTED_TO_VENUE` (V-15)

No work in this task touches that flow.

---

## Requirements

- R1: Event Moderation page lists `status = active` events by default, sorted newest first
- R2: Each row shows: cover thumb, title, creator name + persona, date, location (address or `lat, lng`), status badge, action button
- R3: Status filter dropdown (active / removed / archived) switches the result set
- R4: Persona filter dropdown (all / artists / venues) further narrows results
- R5: Title search input (debounced) filters by case-insensitive substring (`ILIKE %q%`)
- R6: Clicking a row opens a detail dialog showing description, location coordinates, dateStart, creator info, and `removalReason` if present
- R7: For `active` rows, a destructive **Remove** action opens `RemoveReasonDialog` requiring 10–500 character reason
- R8: After successful removal, list query is invalidated; row disappears from `active` filter and appears under `removed` filter with the reason visible in the detail view
- R9: Toast feedback on success/failure
- R10: Sidebar shows "Event Moderation" linked to `/events/moderation`. Old "Pending Events" / `/events/pending` route is removed

---

## Acceptance Criteria

- [ ] Page renders with status, persona, and search filters; default view shows active events newest first
- [ ] Filtering by status switches the list (active ↔ removed ↔ archived)
- [ ] Filtering by persona narrows to events created by artists or venues
- [ ] Title search filters server-side (case-insensitive)
- [ ] Clicking a row opens a detail dialog with full event details
- [ ] Remove button is hidden for non-active rows
- [ ] Remove dialog disables submit until reason ≥ 10 chars; trimmed reason is sent
- [ ] On successful removal: toast appears, list refreshes, row leaves the active list, removalReason shows under the removed filter
- [ ] Server: `admin.removeEvent` requires admin role (FORBIDDEN otherwise), validates input shape (BAD_REQUEST on bad reason/id), is idempotent on already-removed events (NOT_FOUND)
- [ ] Server: removal fires the correct A-15 / V-14 notification trigger to the creator and removes the event from Typesense

---

## Technical Notes

- The Zod source-of-truth schemas live in `@CeolX/shared/validators`: `adminEventListQuerySchema`, `adminRemoveEventSchema`. Both client (admin form) and server (tRPC `.input()`) import from there.
- Notification triggers (A-15, V-14, A-16, V-15) are pre-built in `@CeolX/shared/notifications/triggers`. The router builds a `DispatchNotificationInput` and calls `ctx.dispatchNotification`; the actual fan-out to push + inbox happens in the `apps/server` notifications dispatcher (M7).
- The badge count from the original spec is intentionally dropped — under post-publication moderation there is no queue, so a "pending" count is misleading.
- Event detail mini-map is intentionally deferred — the detail dialog shows lat/lng + venue address as text, sufficient for V1 review. Reintroduce behind a feature flag if reviewers report difficulty verifying Irish locations.
