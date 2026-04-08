# M4-T3 · Event Moderation (Post-publication Content Review)

| Field          | Value                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M9 — Super Admin Dashboard (moved from M4 — depends on M9-T1 Super Admin auth)                                 |
| **Status**     | 🔲 To Do                                                                                                       |
| **Depends on** | M4-T1 (events in DB), M1-T5 (admin scaffold), M9-T1 (Super Admin auth), M7-T2 (Firebase FCM for notifications) |
| **PRD Ref**    | Section 8 (Super Admin Features), Section 9.3 (Event Status Lifecycle)                                         |

> **Approach updated 08/04/2026 — MoM 3rd Apr 2026 (Section 4)**: Events go live immediately upon creation. Super Admin reviews after publication and can remove inappropriate content. This replaces the original pre-moderation (pending_review queue) approach.

---

## Description

Events published by Artists and Venues become **immediately visible** on the map and feed. The Super Admin has a content review dashboard to browse all active events and remove any that violate platform guidelines. Removed events are hidden from the map/feed and the creator is notified with a reason. Creators can edit and resubmit a removed event, which goes live again immediately.

---

## Affected Apps / Packages

| App / Package     | Role                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `apps/api`        | Content review endpoints (GET active events, POST remove, POST restore), FCM notification dispatch |
| `apps/admin`      | Content Review page — browse active events, remove with reason                                     |
| `apps/mobile`     | Creator receives push notification on removal, displays removal reason on Event Detail             |
| `packages/shared` | Event status enum (`active`, `removed`, `archived`), notification schemas                          |

---

## Event Status Lifecycle

```
draft → active → archived
             ↘ removed (admin takedown) → (creator edits + resubmits) → active
```

- `pending_review` and `rejected` kept in schema enum but unused in V1.
- Hard delete never used — `archived` is the terminal state for expired events.

---

## API Endpoints

### GET /api/v1/admin/events

List all active events for content review.

**Query Parameters:**

```json
{
  "limit": 20,
  "offset": 0,
  "sort_by": "created_at|title|creator_name",
  "sort_order": "asc|desc",
  "category": "string (optional)",
  "creator_type": "artist|venue (optional)"
}
```

**Response (200 OK):**

```json
{
  "events": [
    {
      "id": "evt_abc123def456",
      "title": "Live at Temple Bar",
      "cover_image": "https://d1234.cloudfront.net/evt_abc123.jpg",
      "date_start": "2026-03-28T19:00:00Z",
      "category": "trad_session",
      "status": "active",
      "creator_name": "Padraig O'Brien",
      "creator_type": "artist",
      "venue_address": "Temple Bar, Dublin",
      "description": "A lively evening of traditional Irish music...",
      "created_at": "2026-03-20T10:30:00Z"
    }
  ],
  "total_count": 120,
  "offset": 0,
  "limit": 20
}
```

**Error Responses:**

- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User is not Super Admin

---

### POST /api/v1/admin/events/:id/remove

Remove an active event from map and feed.

**Request Body:**

```json
{
  "reason": "string (required, min 10 chars, max 500 chars)"
}
```

**Response (200 OK):**

```json
{
  "id": "evt_abc123def456",
  "status": "removed",
  "removal_reason": "Event contains misleading venue information.",
  "updated_at": "2026-04-08T14:20:00Z"
}
```

**Error Responses:**

- `400 Bad Request`: Reason missing or invalid; event is not in `active` status
- `401 Unauthorized`
- `403 Forbidden`: Not Super Admin
- `404 Not Found`

---

### POST /api/v1/admin/events/:id/restore

Restore a removed event back to active (optional admin action).

**Request Body:** (empty)

**Response (200 OK):**

```json
{
  "id": "evt_abc123def456",
  "status": "active",
  "updated_at": "2026-04-08T14:25:00Z"
}
```

---

## Requirements

### Content Review Dashboard

- List all events with `status = active` sorted by `created_at` descending (newest first — so admin sees fresh content)
- Display per event: cover image thumbnail, title, creator name, creator type (artist/venue), category, venue address, published date
- Pagination: 20 events per page
- Filter by: category, creator type
- Sorting: newest first (default), oldest first, by title

### Remove Action

- Admin clicks "Remove" on an event
- Modal asks for mandatory removal reason (min 10 chars, max 500 chars)
- On submit:
  - `status` → `removed`, `removal_reason` populated
  - Event immediately disappears from map and feed
  - Creator receives push notification: "Your event was removed: [reason]"
  - Admin sees success toast: "Event removed"

### Creator Flow After Removal

- Creator sees `removal_reason` on their Event Detail screen
- Creator can edit the event and tap "Resubmit"
- Resubmit sets `status = active` immediately — no queue
- `removal_reason` cleared on resubmit

### Super Admin Authorization

- Only `role = super_admin` can access `/admin/events`, remove, or restore
- Verify auth token and role on every endpoint call
- Log all remove/restore actions (admin_id, event_id, action, timestamp, reason)

---

## Acceptance Criteria

- [ ] Content Review page lists all `active` events, newest first
- [ ] Each event shows: cover image, title, creator name, type, category, venue address, published date
- [ ] Filter by category and creator type works
- [ ] Pagination: 20 per page
- [ ] Admin can click "Remove" → modal appears requiring a reason (min 10 chars)
- [ ] On remove: event status → `removed`, disappears from map/feed immediately
- [ ] Creator receives push notification with removal reason
- [ ] Creator sees removal reason on Event Detail screen
- [ ] Creator can edit and resubmit → `status = active` immediately, visible on map/feed
- [ ] Only Super Admin can access remove/restore endpoints (403 for all other roles)
- [ ] All remove/restore actions logged with admin_id, timestamp, reason

---

## Dependencies

### Upstream

- **M4-T1** — Events exist in DB with `status = active`
- **M1-T5** — Admin scaffold
- **M9-T1** — Super Admin authentication (reason this task is in M9 scope)
- **M7-T2** — Firebase FCM for push notifications

### Downstream

- **M4-T2** — Event Detail screen displays removal reason to creator
- **M3-T1**, **M3-T4** — Map and Feed queries exclude `removed` and `archived` events

---

## Technical Notes

### Status Enum (Drizzle schema)

```typescript
// packages/shared/src/schema/events.ts
export const eventStatusEnum = pgEnum('event_status', [
  'draft',
  'active', // live immediately on creation
  'removed', // admin takedown
  'archived', // auto after event date passes
  'pending_review', // reserved, unused in V1
  'rejected', // reserved, unused in V1
]);
```

### Content Review Endpoints (Hono)

```typescript
// apps/api/src/routes/admin.ts

// Middleware: Verify Super Admin
async function requireSuperAdmin(c: Context, next: Next) {
  const session = c.get('session');
  if (!session || session.user.role !== 'super_admin') {
    return c.json({ error: 'Forbidden: Super Admin access required' }, 403);
  }
  await next();
}

app.use('/admin/*', requireSuperAdmin);

// GET /admin/events — content review feed
app.get('/admin/events', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  const activeEvents = await db.query.events.findMany({
    where: eq(events.status, 'active'),
    orderBy: [desc(events.created_at)],
    limit,
    offset,
  });

  return c.json({ events: activeEvents, total_count: activeEvents.length, offset, limit });
});

// POST /admin/events/:id/remove
const RemoveSchema = z.object({ reason: z.string().min(10).max(500) });

app.post('/admin/events/:id/remove', zValidator('json', RemoveSchema), async (c) => {
  const eventId = c.req.param('id');
  const { reason } = c.req.valid('json');
  const session = c.get('session');

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) return c.json({ error: 'Event not found' }, 404);
  if (event.status !== 'active')
    return c.json({ error: `Cannot remove event with status: ${event.status}` }, 400);

  const [updated] = await db
    .update(events)
    .set({ status: 'removed', removal_reason: reason, updated_at: new Date() })
    .where(eq(events.id, eventId))
    .returning();

  // Notify creator via FCM
  const creatorUser = await db.query.users.findFirst({
    where: eq(users.id, event.created_by),
  });

  if (creatorUser?.device_token) {
    await sendFCMNotification({
      token: creatorUser.device_token,
      title: 'Event Removed',
      body: `Your event "${event.title}" was removed: ${reason}`,
      data: { persona: event.creator_type, route: `/events/${event.id}` },
    });
  }

  console.log(`[ADMIN] Event ${eventId} removed by ${session.user.id}: ${reason}`);
  return c.json({
    id: updated.id,
    status: updated.status,
    removal_reason: updated.removal_reason,
    updated_at: updated.updated_at,
  });
});
```

### Common Gotchas

- **Immediate visibility**: Events are live the moment they're created. The content review feed shows them instantly. Admin may see a brief lag of a few seconds if caching is involved — ensure map/feed queries exclude `removed` status.
- **Resubmit goes live immediately**: Creator editing a removed event and resubmitting sets `status = active` directly — no secondary review queue. This is intentional per MoM.
- **Double-remove prevention**: Validate `status === 'active'` before applying remove. Return 400 if already removed.
- **FCM failures**: Fire-and-forget — log but don't fail the webhook response.
