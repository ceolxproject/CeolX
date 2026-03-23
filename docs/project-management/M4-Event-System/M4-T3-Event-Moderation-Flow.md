# M4-T3 · Event Moderation (Admin Approve / Reject)

| Field | Value |
|-------|-------|
| **Milestone** | M4 — Event System |
| **Status** | 🔲 To Do |
| **Depends on** | M4-T1 (events created with pending_review status), M1-T5 (Next.js admin scaffold), M9-T1 (Super Admin auth), M7-T2 (Firebase FCM for notifications) |
| **PRD Ref** | Section 8 (Super Admin Features), Section 9.3 (Event Status Lifecycle), Section 9.4 (Event Moderation) |

---

## Description

The admin moderation pipeline ensures quality and prevents spam on the CeolX platform. Every event submitted by Artists or Venues sits in the `pending_review` queue until the Super Admin approves or rejects it. Approval makes the event live on the map and feed. Rejection notifies the creator with a detailed reason so they can edit and resubmit. Only one Super Admin account exists (per CLAUDE.md). The admin dashboard provides a clean queue view with sorting, filtering, and one-click approve/reject actions. Creators receive push notifications on all moderation decisions, with the rejection reason included in reject notifications.

---

## Affected Apps / Packages

| App / Package | Role |
|---------------|------|
| `apps/api` | Moderation endpoints (GET pending queue, POST approve, POST reject), FCM notification dispatch |
| `apps/admin` | Pending Events Queue page (Next.js), approve/reject forms, status indicators |
| `apps/mobile` | Creator receives push notifications with rejection reasons, displays rejection reason on Event Detail |
| `packages/shared` | Event status enum, notification schemas |

---

## API Endpoints

### GET /api/v1/admin/events/pending

List all events with `status = pending_review` for admin moderation.

**Query Parameters:**
```json
{
  "limit": 20,
  "offset": 0,
  "sort_by": "created_at|title|creator_name",
  "sort_order": "asc|desc"
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
      "status": "pending_review",
      "created_by": "artist_123",
      "creator_name": "Padraig O'Brien",
      "creator_type": "artist" | "venue",
      "venue_address": "Temple Bar, Dublin",
      "description": "A lively evening of traditional Irish music...",
      "created_at": "2026-03-20T10:30:00Z"
    }
  ],
  "total_count": 45,
  "offset": 0,
  "limit": 20
}
```

**Error Responses:**
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User is not Super Admin

### POST /api/v1/admin/events/:id/approve

Approve a pending event and make it live.

**Request Body:** (empty)

**Response (200 OK):**
```json
{
  "id": "evt_abc123def456",
  "status": "active",
  "updated_at": "2026-03-25T14:20:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Event is not in pending_review status
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User is not Super Admin
- `404 Not Found`: Event not found

### POST /api/v1/admin/events/:id/reject

Reject a pending event with a written reason.

**Request Body:**
```json
{
  "reason": "string (required, max 500 chars - the rejection reason to explain to creator)"
}
```

**Response (200 OK):**
```json
{
  "id": "evt_abc123def456",
  "status": "rejected",
  "rejection_reason": "Venue address is unclear. Please provide a full address or venue name.",
  "updated_at": "2026-03-25T14:20:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Reason is required or exceeds 500 chars; event is not in pending_review status
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User is not Super Admin
- `404 Not Found`: Event not found

---

## Requirements

### Admin Queue Display
- List all events with `status = pending_review` sorted by creation date (oldest first — FIFO)
- Display for each event: cover image thumbnail, title, creator name, creator type (artist/venue), category, created date, venue address
- Pagination: 20 events per page
- Sorting options: By created date (default), by title, by creator name
- Filter (optional): By category or creator type

### Approve Action
- Admin views a pending event and clicks "Approve"
- Event `status` transitions from `pending_review` → `active`
- Event becomes visible on map and feed immediately (next refresh)
- Creator receives push notification: "Your event '[title]' is now live!"
- Admin sees success toast: "Event approved"

### Reject Action
- Admin views a pending event, clicks "Reject"
- Modal/form appears asking for rejection reason (mandatory)
- Admin enters reason (max 500 chars): e.g., "Venue address is unclear. Please provide a full venue name or building number."
- On submit:
  - Event `status` → `rejected`
  - `rejection_reason` field populated with admin's message
  - Creator receives push notification with reason: "Your event was rejected: [reason]"
  - Admin sees success toast: "Event rejected"

### Creator Notification Flow
- **On Approve**: Push notification sent to creator via FCM with payload:
  - `title`: "Event Approved!"
  - `body`: "Your event '[event title]' is now live and visible to users."
  - `persona`: "artist" or "venue"
  - `route`: `/events/{event_id}` (deep link to Event Detail)
- **On Reject**: Push notification sent to creator via FCM with payload:
  - `title`: "Event Rejected"
  - `body`: "Your event '[event title]' was rejected: [rejection_reason]"
  - `persona`: "artist" or "venue"
  - `route`: `/events/{event_id}` (deep link to Event Detail, showing rejection banner)

### Super Admin Authorization
- Only `role = super_admin` can access `/admin/events/pending`, approve, or reject
- Verify auth token and role on every endpoint call
- Log all approve/reject actions (admin_id, event_id, action, timestamp)

### Data Consistency
- Hard delete is never used; `archived` is the terminal state for expired events
- Profile creation/edits are NOT moderated — events only
- Moderation decisions are final; admins cannot "unapprove" an active event (would require admin to manually reject it if needed)

---

## Acceptance Criteria

- [ ] Super Admin can access /admin/events/pending dashboard
- [ ] Pending queue displays all events with `status = pending_review`, sorted by oldest first
- [ ] Each event shows: cover image, title, creator name, category, creation date, venue address
- [ ] Pagination works: 20 events per page, next/prev navigation
- [ ] Admin can sort by created date (default), title, or creator name
- [ ] Admin can click "Approve" on an event; status transitions to `active`
- [ ] On approve, event becomes visible on map/feed within seconds
- [ ] Creator receives push notification on approval with correct messaging
- [ ] Admin can click "Reject" on an event; modal appears asking for rejection reason
- [ ] Rejection reason is required (cannot submit empty)
- [ ] On reject with reason, event status → `rejected` and `rejection_reason` populated
- [ ] Creator receives push notification on rejection with the reason included
- [ ] Creator can view rejection reason on their Event Detail screen (M4-T2)
- [ ] Creator can edit a rejected event and resubmit; it re-enters `pending_review`
- [ ] Only Super Admin can approve/reject (other roles receive 403)
- [ ] Admin dashboard logs all actions (audit trail visible in logs)

---

## Dependencies

### Upstream
- **M4-T1** — Events are created with `status = pending_review`; moderation queue queries these
- **M1-T3** — API scaffold, authentication, error handling
- **M1-T5** — Next.js admin dashboard scaffold
- **M9-T1** — Super Admin authentication and authorization
- **M7-T2** — Firebase FCM for push notifications

### Downstream
- **M4-T2** — Event Detail screen displays rejection reason to creator
- **M3-T1**, **M3-T4** — Map and Feed queries only active events; approved events appear there
- **M4-T4** — My Events view shows rejected events in creator's event list

### External Services
- **Firebase FCM** — Push notifications to creators

---

## Technical Notes

### Moderation Endpoints (Hono Backend)

```typescript
// apps/api/src/routes/admin.ts

import { Hono } from 'hono';
import { getAuth } from 'hono/better-auth';
import { db } from '../db';
import { events } from '@ceolx/shared/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { sendFCMNotification } from '../services/fcm';

const app = new Hono();

// Middleware: Verify Super Admin
async function requireSuperAdmin(c: any, next: any) {
  const auth = getAuth(c);
  if (!auth || auth.user.role !== 'super_admin') {
    return c.json({ error: 'Forbidden: Super Admin access required' }, 403);
  }
  await next();
}

app.use('/admin/*', requireSuperAdmin);

// GET /admin/events/pending
app.get('/admin/events/pending', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const sortBy = c.req.query('sort_by') || 'created_at';
  const sortOrder = c.req.query('sort_order') || 'asc';

  try {
    const pendingEvents = await db.query.events.findMany({
      where: (events, { eq }) => eq(events.status, 'pending_review'),
      with: {
        creator: {
          columns: { id: true, name: true, type: true },
        },
      },
      orderBy: (events) => {
        if (sortBy === 'title') {
          return sortOrder === 'asc' ? [events.title] : [events.title];
        }
        return sortOrder === 'asc'
          ? [events.created_at]
          : [events.created_at];
      },
      limit,
      offset,
    });

    const totalCount = await db.query.events.findMany({
      where: (events, { eq }) => eq(events.status, 'pending_review'),
      columns: { id: true },
    });

    return c.json({
      events: pendingEvents.map((e) => ({
        id: e.id,
        title: e.title,
        cover_image: e.cover_image,
        date_start: e.date_start,
        category: e.category,
        status: e.status,
        created_by: e.created_by,
        creator_name: e.creator.name,
        creator_type: e.creator.type,
        venue_address: e.venue_address,
        description: e.description,
        created_at: e.created_at,
      })),
      total_count: totalCount.length,
      offset,
      limit,
    });
  } catch (error) {
    console.error('Moderation queue fetch error:', error);
    return c.json({ error: 'Failed to fetch pending events' }, 500);
  }
});

// POST /admin/events/:id/approve
app.post('/admin/events/:id/approve', async (c) => {
  const auth = getAuth(c);
  const eventId = c.req.param('id');

  try {
    // Fetch event
    const event = await db.query.events.findFirst({
      where: (events, { eq }) => eq(events.id, eventId),
      with: {
        creator: {
          columns: { id: true, name: true, user_id: true },
        },
      },
    });

    if (!event) {
      return c.json({ error: 'Event not found' }, 404);
    }

    if (event.status !== 'pending_review') {
      return c.json(
        { error: `Event status is ${event.status}, cannot approve` },
        400
      );
    }

    // Update event status
    const updated = await db
      .update(events)
      .set({
        status: 'active',
        updated_at: new Date(),
      })
      .where(eq(events.id, eventId))
      .returning();

    // Send FCM notification to creator
    const creatorUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, event.creator.user_id),
    });

    if (creatorUser?.device_token) {
      await sendFCMNotification({
        token: creatorUser.device_token,
        title: 'Event Approved!',
        body: `Your event "${event.title}" is now live!`,
        data: {
          persona: event.creator.type,
          route: `/events/${event.id}`,
        },
      });
    }

    // Log action
    console.log(`[ADMIN] Event ${eventId} approved by ${auth.user.id}`);

    return c.json({
      id: updated[0].id,
      status: updated[0].status,
      updated_at: updated[0].updated_at,
    });
  } catch (error) {
    console.error('Approve event error:', error);
    return c.json({ error: 'Failed to approve event' }, 500);
  }
});

// POST /admin/events/:id/reject
const RejectSchema = z.object({
  reason: z.string().min(1).max(500),
});

app.post(
  '/admin/events/:id/reject',
  zValidator('json', RejectSchema),
  async (c) => {
    const auth = getAuth(c);
    const eventId = c.req.param('id');
    const { reason } = c.req.valid('json');

    try {
      // Fetch event
      const event = await db.query.events.findFirst({
        where: (events, { eq }) => eq(events.id, eventId),
        with: {
          creator: {
            columns: { id: true, name: true, user_id: true, type: true },
          },
        },
      });

      if (!event) {
        return c.json({ error: 'Event not found' }, 404);
      }

      if (event.status !== 'pending_review') {
        return c.json(
          { error: `Event status is ${event.status}, cannot reject` },
          400
        );
      }

      // Update event status and reason
      const updated = await db
        .update(events)
        .set({
          status: 'rejected',
          rejection_reason: reason,
          updated_at: new Date(),
        })
        .where(eq(events.id, eventId))
        .returning();

      // Send FCM notification to creator
      const creatorUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, event.creator.user_id),
      });

      if (creatorUser?.device_token) {
        await sendFCMNotification({
          token: creatorUser.device_token,
          title: 'Event Rejected',
          body: `Your event was rejected: ${reason}`,
          data: {
            persona: event.creator.type,
            route: `/events/${event.id}`,
          },
        });
      }

      // Log action
      console.log(
        `[ADMIN] Event ${eventId} rejected by ${auth.user.id}: ${reason}`
      );

      return c.json({
        id: updated[0].id,
        status: updated[0].status,
        rejection_reason: updated[0].rejection_reason,
        updated_at: updated[0].updated_at,
      });
    } catch (error) {
      console.error('Reject event error:', error);
      return c.json({ error: 'Failed to reject event' }, 500);
    }
  }
);
```

### Admin Dashboard — Pending Events Queue (Next.js + ShadCN)

```typescript
// apps/admin/app/events/pending/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { api } from '@/lib/api';

interface PendingEvent {
  id: string;
  title: string;
  cover_image: string;
  creator_name: string;
  creator_type: 'artist' | 'venue';
  category: string;
  venue_address: string;
  created_at: string;
}

export default function PendingEventsPage() {
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPendingEvents();
  }, [offset]);

  const fetchPendingEvents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/events/pending', {
        params: { offset, limit: 20, sort_by: 'created_at', sort_order: 'asc' },
      });
      setEvents(res.data.events);
      setTotalCount(res.data.total_count);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (eventId: string) => {
    setActionLoading(true);
    try {
      await api.post(`/admin/events/${eventId}/approve`);
      setEvents(events.filter((e) => e.id !== eventId));
      // Toast success message
    } catch (error) {
      console.error('Approve error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectingId) return;

    setActionLoading(true);
    try {
      await api.post(`/admin/events/${rejectingId}/reject`, {
        reason: rejectReason,
      });
      setEvents(events.filter((e) => e.id !== rejectingId));
      setRejectingId(null);
      setRejectReason('');
      // Toast success message
    } catch (error) {
      console.error('Reject error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && events.length === 0) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">
        Pending Events ({totalCount})
      </h1>

      {events.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          No pending events. All events have been reviewed!
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cover</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <Image
                      src={event.cover_image}
                      alt={event.title}
                      width={60}
                      height={40}
                      className="rounded"
                    />
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {event.title}
                  </TableCell>
                  <TableCell>
                    {event.creator_name}
                    <br />
                    <span className="text-xs text-gray-500">
                      ({event.creator_type})
                    </span>
                  </TableCell>
                  <TableCell>{event.category}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    {event.venue_address}
                  </TableCell>
                  <TableCell>
                    {new Date(event.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(event.id)}
                      disabled={actionLoading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRejectingId(event.id)}
                      disabled={actionLoading}
                    >
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={!!rejectingId} onOpenChange={() => setRejectingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Event</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason (max 500 chars)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value.slice(0, 500))}
            className="h-24"
          />
          <p className="text-xs text-gray-500">
            {rejectReason.length}/500 characters
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectingId(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRejectSubmit}
              disabled={actionLoading || !rejectReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-8">
        <Button
          onClick={() => setOffset(Math.max(0, offset - 20))}
          disabled={offset === 0}
        >
          Previous
        </Button>
        <span>
          Showing {offset + 1}-{Math.min(offset + 20, totalCount)} of {totalCount}
        </span>
        <Button
          onClick={() => setOffset(offset + 20)}
          disabled={offset + 20 >= totalCount}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
```

### Firebase FCM Notification Service

```typescript
// apps/api/src/services/fcm.ts

import admin from 'firebase-admin';

interface FCMPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendFCMNotification(payload: FCMPayload) {
  try {
    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      token: payload.token,
    };

    const response = await admin.messaging().send(message);
    console.log(`FCM sent: ${response}`);
    return response;
  } catch (error) {
    console.error('FCM send error:', error);
    throw error;
  }
}
```

### Common Gotchas

- **Rejection reason truncation**: Admin might paste very long reasons. Enforce 500 char limit in frontend and backend; truncate gracefully if needed.
- **Double-approval/rejection**: Prevent accidental double-click; disable buttons during submission and validate status before action on backend.
- **Notification delivery**: FCM may fail silently if device token is invalid. Log failures and implement retry logic or cleanup of stale tokens.
- **Timezone confusion**: Rejection reason timestamps stored in UTC. Ensure admin dashboard converts to their local timezone for readability.

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
