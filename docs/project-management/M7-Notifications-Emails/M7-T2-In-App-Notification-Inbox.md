# M7-T2 · In-App Notification Inbox & Centre

| Field          | Value                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------- |
| **Milestone**  | M7 — Notifications & Emails                                                                    |
| **Status**     | 🔲 To Do                                                                                       |
| **Depends on** | M7-T1 (FCM handler + notifications table), M4-T3 (event moderation), M5-T1/T2 (booking system) |
| **PRD Ref**    | Section 9.6 (Notifications), Section 4.3 (Notification Routing)                                |

---

## Description

Build an in-app Notification Centre accessible from the header (bell icon with unread badge). Users can view their notification history, mark notifications as read individually or in bulk, and tap notifications to navigate with persona auto-switching. The mobile app polls or pushes updates to keep the unread count badge in sync. Notifications are paginated, persona-aware, and sortable by date.

---

## Affected Apps / Packages

| App / Package     | Role                                                                             |
| ----------------- | -------------------------------------------------------------------------------- |
| `apps/api`        | Notification endpoints: list, mark-as-read, unread count                         |
| `apps/mobile`     | Notification Centre screen, bell icon + badge in header, tap-to-navigate handler |
| `packages/shared` | Notification type enums, UI constants                                            |

---

## Database Schema

### notifications table

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  -- enum: event_approved | event_rejected | booking_invited | booking_accepted | booking_rejected | booking_cancelled | subscription_activated | payment_received
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  route TEXT NOT NULL,
  persona TEXT NOT NULL,
  -- enum: spectator | artist | venue
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  archived_at TIMESTAMP,
  INDEX(user_id, created_at DESC),
  INDEX(user_id, is_read)
);
```

---

## API Endpoints

### GET /api/v1/notifications

Fetch paginated notifications for current user.

**Query Parameters:**

```
page=1
limit=20
```

**Response (2xx):**

```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "event_approved",
      "title": "Event Approved ✓",
      "body": "Your event 'Ceili Night' is now live",
      "route": "/events/uuid",
      "persona": "artist",
      "isRead": false,
      "createdAt": "2026-03-23T10:30:00Z"
    }
  ],
  "total": 42,
  "hasMore": true
}
```

**Error Responses:**

- `401 Unauthorized`: Not authenticated

### PUT /api/v1/notifications/:id/read

Mark single notification as read.

**Response (2xx):**

```json
{
  "success": true
}
```

### PUT /api/v1/notifications/read-all

Mark all notifications as read.

**Response (2xx):**

```json
{
  "success": true,
  "marked": 12
}
```

### GET /api/v1/notifications/unread-count

Get unread notification badge count.

**Response (2xx):**

```json
{
  "count": 5
}
```

---

## Requirements

### Notification List & Pagination

- R1.1: `GET /api/v1/notifications?page=1&limit=20` returns paginated list, ordered by `created_at DESC`
- R1.2: Each notification includes: `id, type, title, body, route, persona, isRead, createdAt`
- R1.3: Response includes `total` count and `hasMore` boolean for infinite scroll
- R1.4: Exclude archived notifications (older than 90 days) from list queries
- R1.5: Soft filter only — archived records stay in DB for GDPR compliance

### Mark As Read

- R2.1: `PUT /api/v1/notifications/:id/read` sets `is_read = true` for single notification
- R2.2: `PUT /api/v1/notifications/read-all` sets `is_read = true` for all unread notifications
- R2.3: Return count of marked notifications in response (for analytics/UX feedback)
- R2.4: No error if notification already read — idempotent

### Unread Badge Count

- R3.1: `GET /api/v1/notifications/unread-count` returns count of `is_read = false` notifications
- R3.2: Mobile app polls this endpoint every 30 seconds OR listens to WebSocket push
- R3.3: Badge updates in header (bell icon with number) in real-time or near-real-time
- R3.4: Badge hidden if count is 0

### Notification Centre UI

- R4.1: Bell icon in header with red badge showing unread count
- R4.2: Tapping bell opens full-screen Notification Centre modal
- R4.3: List shows newest notifications first; supports infinite scroll for pagination
- R4.4: Each notification card shows: title, body, timestamp (e.g., "2 hours ago"), unread indicator (dot or highlight)
- R4.5: Swipe-left or context menu option to mark single notification as read
- R4.6: "Mark All as Read" button at top if unread count > 0
- R4.7: Empty state if no notifications: _"No notifications yet"_

### Tap-to-Navigate

- R5.1: Tapping notification on `GET /api/v1/notifications` list navigates to `route` with persona auto-switch (same as M7-T1 foreground handler)
- R5.2: If current persona ≠ notification's persona, auto-switch first, show toast, then navigate
- R5.3: Automatically mark tapped notification as read

### Real-Time Updates

- R6.1: (V1) Poll `GET /api/v1/notifications/unread-count` every 30 seconds while Notification Centre is open
- R6.2: (Post-V1) Replace polling with WebSocket push on new notification (via FCM received + local update)
- R6.3: Append new notifications to top of list in real-time without full refresh

---

## Acceptance Criteria

- [ ] `GET /api/v1/notifications` returns paginated list, newest first; includes `total` and `hasMore`
- [ ] Pagination limit defaults to 20; accepts custom `limit` parameter
- [ ] Archived notifications (90+ days old) excluded from queries
- [ ] `PUT /api/v1/notifications/:id/read` marks single notification read; idempotent
- [ ] `PUT /api/v1/notifications/read-all` marks all unread as read; returns count
- [ ] `GET /api/v1/notifications/unread-count` returns accurate unread count
- [ ] Bell icon with unread badge visible in header
- [ ] Tapping notification navigates to correct route with persona auto-switch
- [ ] Tapped notification marked as read
- [ ] "Mark All as Read" button works and badge updates
- [ ] Empty state shown when no notifications
- [ ] Notification Centre supports infinite scroll to page 2, 3, etc.

---

## Dependencies

- **Upstream**: M7-T1 (FCM handler logs to notifications table), M4-T3 (event moderation generates notifications), M5-T1 & M5-T2 (booking system generates notifications)
- **Downstream**: None direct
- **External services**: None

---

## Technical Notes

### Hono Backend — Notification Endpoints

```typescript
// apps/api/routes/v1/notifications.ts
import { Hono } from "hono";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";

const router = new Hono();

router.get("/notifications", async (c) => {
  const userId = c.get("user")?.id;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  const thirtyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          // Exclude archived (older than 90 days)
          gt(notifications.createdAt, thirtyDaysAgo),
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: db.fn.count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          gt(notifications.createdAt, thirtyDaysAgo),
        ),
      );

    return c.json({
      notifications: rows,
      total: count,
      hasMore: offset + limit < count,
    });
  } catch (error) {
    console.error("Notification fetch error:", error);
    return c.json({ error: "Failed to fetch notifications" }, 500);
  }
});

router.put("/notifications/:id/read", async (c) => {
  const userId = c.get("user")?.id;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const notificationId = c.req.param("id");

  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId),
        ),
      );

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: "Failed to update notification" }, 500);
  }
});

router.put("/notifications/read-all", async (c) => {
  const userId = c.get("user")?.id;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  try {
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
      )
      .returning();

    return c.json({ success: true, marked: result.length });
  } catch (error) {
    return c.json({ error: "Failed to mark all as read" }, 500);
  }
});

router.get("/notifications/unread-count", async (c) => {
  const userId = c.get("user")?.id;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  try {
    const [{ count }] = await db
      .select({ count: db.fn.count() })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
      );

    return c.json({ count });
  } catch (error) {
    return c.json({ error: "Failed to fetch unread count" }, 500);
  }
});

export default router;
```

### React Native Notification Centre Component

```typescript
// apps/mobile/screens/NotificationCentreScreen.tsx
import { FlatList, View, Text, TouchableOpacity } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRole } from '@/context/RoleContext';

export function NotificationCentreScreen() {
  const { switchRole, currentRole } = useRole();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page],
    queryFn: () =>
      fetch(`${API_URL}/api/v1/notifications?page=${page}&limit=20`).then((r) =>
        r.json()
      ),
  });

  const { mutate: markAsRead } = useMutation({
    mutationFn: (id: string) =>
      fetch(`${API_URL}/api/v1/notifications/${id}/read`, { method: 'PUT' }).then((r) =>
        r.json()
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const { mutate: markAllAsRead } = useMutation({
    mutationFn: () =>
      fetch(`${API_URL}/api/v1/notifications/read-all`, { method: 'PUT' }).then((r) =>
        r.json()
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const handleNotificationTap = async (notification: any) => {
    markAsRead(notification.id);

    if (notification.persona !== currentRole) {
      await switchRole(notification.persona);
      Toast.show({
        type: 'info',
        text1: `Switched to ${personaLabel(notification.persona)} mode`,
        duration: 2500,
      });
    }

    navigation.navigate(notification.route);
  };

  return (
    <View style={{ flex: 1 }}>
      {data?.notifications?.length > 0 && (
        <TouchableOpacity onPress={() => markAllAsRead()}>
          <Text>Mark All as Read</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={data?.notifications || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleNotificationTap(item)}>
            <View>
              <Text style={{ fontWeight: item.isRead ? '400' : '700' }}>{item.title}</Text>
              <Text>{item.body}</Text>
              <Text>{formatTimeAgo(item.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        )}
        onEndReached={() => {
          if (data?.hasMore) setPage(page + 1);
        }}
      />

      {data?.notifications?.length === 0 && <Text>No notifications yet</Text>}
    </View>
  );
}
```

### Unread Badge Hook

```typescript
// apps/mobile/hooks/useUnreadBadgeCount.ts
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

export function useUnreadBadgeCount() {
  const { data } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () =>
      fetch(`${API_URL}/api/v1/notifications/unread-count`).then((r) =>
        r.json(),
      ),
    refetchInterval: 30000, // Poll every 30s
  });

  return data?.count || 0;
}
```

### Common Gotchas

**Gotcha 1: Unread badge not updating after mark-as-read**

- Issue: Query cache not invalidated after mutation
- Fix: Call `queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })` after mark-as-read mutation

**Gotcha 2: Pagination loads duplicates**

- Issue: Cache not keyed by page number
- Fix: Use `queryKey: ['notifications', page]` so each page cached separately

**Gotcha 3: Auto-navigate on notification tap loads old data**

- Issue: Navigation happens before persona switch completes
- Fix: `await switchRole(persona)` before `navigation.navigate(route)`

**Gotcha 4: Notification Centre lagging on 500+ notifications**

- Issue: Loading entire list for "Mark All as Read" is slow
- Fix: Use database batch update; only fetch first 50 for display, paginate on demand
