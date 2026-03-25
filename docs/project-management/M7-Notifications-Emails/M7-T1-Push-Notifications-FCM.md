# M7-T1 · Firebase Cloud Messaging (FCM) Push Notifications

| Field          | Value                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------- |
| **Milestone**  | M7 — Notifications & Emails                                                                       |
| **Status**     | 🔲 To Do                                                                                          |
| **Depends on** | M2-T4 (persona system + device_tokens table), M4-T3 (event moderation), M5-T1/T2 (booking system) |
| **PRD Ref**    | Section 9.6 (Notifications), Section 4.3 (Notification Routing), Section 4.4 (Persona Switching)  |

---

## Description

Implement full Firebase Cloud Messaging integration for push notifications across iOS and Android. Every user action that requires notification (event approval, booking updates, subscription status) flows through a centralised FCM handler. Notifications are persona-aware: each payload includes `persona` (artist|venue|spectator) and a `route` deep link, enabling the mobile app to auto-switch roles and navigate to the correct screen. This task covers token registration, foreground/background tap handling, cold-start routing, and token refresh listeners.

---

## Affected Apps / Packages

| App / Package     | Role                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api`        | FCM token registration endpoint, device_tokens schema queries, notification dispatch service                                               |
| `apps/mobile`     | Expo-notifications setup, permission request post-login, tap handlers (foreground/background/cold), persona auto-switch, deep link routing |
| `packages/shared` | Notification type enums, payload schema, deep link route constants                                                                         |

---

## Database Schema

### device_tokens table

```sql
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL,
  platform ENUM('ios', 'android') NOT NULL,
  device_identifier TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, device_identifier)
);

CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX idx_device_tokens_active ON device_tokens(is_active);
```

---

## API Endpoints

### POST /api/v1/device-tokens

Register or update a device token after login.

**Request Body:**

```json
{
  "token": "ExponentPushToken[abc123xyz...]",
  "platform": "ios"
}
```

**Response (2xx):**

```json
{
  "success": true,
  "message": "Token registered"
}
```

**Error Responses:**

- `400 Bad Request`: Missing token or invalid platform
- `401 Unauthorized`: Not authenticated
- `500 Internal Server Error`: Database write failed

### DELETE /api/v1/device-tokens/:token

Deregister token on logout.

**Response (2xx):**

```json
{
  "success": true
}
```

---

## Requirements

### Device Token Lifecycle

- R1.1: On every user login, mobile app calls `expo-notifications.getExpoPushTokenAsync()` and POSTs to `/api/v1/device-tokens` with token + platform
- R1.2: Upsert logic: if (user_id, device_identifier) exists, update token; else insert new record. Set `is_active = true`
- R1.3: On logout, call DELETE `/api/v1/device-tokens/:token` and set `is_active = false`
- R1.4: Listen to `addNotificationResponseReceivedListener` for token refresh; auto-reregister new token when Firebase rotates it
- R1.5: Each user shares one FCM token per device (no multi-device token per user in V1)

### Notification Permission Handling

- R2.1: On first app launch post-login, call `expo-notifications.requestPermissionsAsync()`
- R2.2: iOS requires explicit user consent; Android grants at install time
- R2.3: If permission denied, show non-blocking banner: _"Enable notifications to stay updated on events and bookings"_ with Settings CTA
- R2.4: No custom dialogs — use native permission API only

### Notification Payload Structure

- R3.1: All FCM payloads follow this schema:
  ```json
  {
    "notification": {
      "title": "Event Approved ✓",
      "body": "Your event 'Ceili Night' is now live"
    },
    "data": {
      "persona": "artist",
      "route": "/events/uuid",
      "action": "view_event"
    }
  }
  ```
- R3.2: `persona` must be one of: `spectator`, `artist`, `venue` (never other values)
- R3.3: `route` is a deep link path (e.g., `/events/123`, `/bookings/456`, `/profile`)
- R3.4: `action` is optional; guides mobile handler (e.g., `view_event`, `accept_booking`)

### Foreground Notification Tap

- R4.1: When app is in foreground and user taps notification:
  - Read `persona` from payload
  - If persona matches current role → navigate directly to `route`
  - If mismatch → call persona-switch function → await role update → navigate → show toast: _"Switched to [Role] mode"_
- R4.2: Use `expo-notifications.addNotificationResponseReceivedListener()` to capture tap
- R4.3: Toast auto-dismisses after 2–3 seconds, non-blocking

### Background & Cold-Start Tap

- R5.1: When notification tapped from lock screen or notification centre:
  - Extract `persona` from payload and store in AsyncStorage (persist across app restarts)
  - On app boot, read stored persona and set it as the app's initial role
  - Once root screen renders, navigate to notification's `route`
  - Show persona-switch toast if switched
- R5.2: Cold-start ensures app opens in correct role + screen immediately

### Notification Triggers & Deep Links

- R6.1: **Event Approved** (Artist): `persona: 'artist'`, route `/events/:event_id`, title "Event Approved ✓"
- R6.2: **Event Rejected** (Artist): `persona: 'artist'`, route `/events/:event_id`, title "Event Not Approved"
- R6.3: **Booking Invitation** (Artist): `persona: 'artist'`, route `/bookings/:booking_id`, title "New Gig Opportunity"
- R6.4: **Booking Accepted** (Venue & Artist): each gets separate notification, route `/bookings/:booking_id`, title "Booking Accepted ✓"
- R6.5: **Booking Rejected** (Venue & Artist): separate notifications, title "Booking Rejected"
- R6.6: **Booking Cancelled** (Venue & Artist): separate notifications, title "Booking Cancelled"
- R6.7: **Subscription Activated** (Venue): `persona: 'venue'`, route `/profile`, title "Subscription Activated ✓"
- R6.8: **Payment Renewed** (Venue): `persona: 'venue'`, route `/profile`, title "Payment Received ✓"

### Logging & Rate Limiting

- R7.1: All sent notifications logged to `notifications` table (see M7-T2) with `type, title, body, is_read`
- R7.2: Rate limit: max 5 notifications per user per minute; queue excess and send in batches next minute
- R7.3: Implement exponential backoff retry on FCM failures: 1s → 3s → 10s, max 3 attempts

---

## Acceptance Criteria

- [ ] Device token successfully registered on `POST /api/v1/device-tokens`; stored in `device_tokens` table
- [ ] Token refresh listener fires and auto-reregisters new token on Firebase refresh
- [ ] Notification permission explicitly requested on first app launch post-login
- [ ] Push notification received in background on both iOS and Android (Expo simulator tested)
- [ ] Foreground tap: persona match → direct navigation; persona mismatch → auto-switch + navigate + toast
- [ ] Cold-start tap: app opens in correct persona and navigates to notification route
- [ ] All 8 notification types fire with correct title, body, and route
- [ ] Notifications logged to `notifications` table with correct metadata
- [ ] Rate limiting: 6th notification in same minute queued, sent after minute boundary
- [ ] FCM failures retried 3 times with exponential backoff; logged separately

---

## Dependencies

- **Upstream**: M2-T4 (persona system + device_tokens schema), M4-T3 (event moderation), M5-T1 & M5-T2 (booking system)
- **Downstream**: M7-T2 (notification inbox queries notifications table), M7-T3 (email as fallback), M8-T2 (subscription webhooks dispatch notifications)
- **External services**: Firebase Cloud Messaging, Expo React Native wrapper

---

## Technical Notes

### Expo-Notifications Hook (Mobile)

```typescript
// apps/native/hooks/useNotifications.ts
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRole } from "@/context/RoleContext";
import * as SecureStore from "expo-secure-store";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function useNotifications() {
  const { user, session } = useAuth();
  const { switchRole, currentRole } = useRole();

  useEffect(() => {
    if (!user) return;

    // Request permission (iOS)
    Notifications.requestPermissionsAsync();

    // Register FCM token
    registerToken();

    // Listen to token refresh
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => handleTap(response),
    );

    return () => Notifications.removeNotificationSubscription(subscription);
  }, [user]);

  const registerToken = async () => {
    try {
      const expoPushToken = await Notifications.getExpoPushTokenAsync();
      const platform = Platform.OS as "ios" | "android";

      await fetch(`${API_URL}/api/v1/device-tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.token}`,
        },
        body: JSON.stringify({
          token: expoPushToken.data,
          platform,
        }),
      });
    } catch (error) {
      console.error("FCM registration failed:", error);
    }
  };

  const handleTap = async (response: Notifications.NotificationResponse) => {
    const { persona, route } = response.notification.request.content.data;

    if (persona !== currentRole) {
      await switchRole(persona);
      Toast.show({
        type: "info",
        text1: `Switched to ${personaLabel(persona)} mode`,
        duration: 2500,
      });
    }

    navigation.navigate(route);
  };
}
```

### Hono Backend — Token Endpoint

```typescript
// apps/server/routes/v1/device-tokens.ts
import { Hono } from "hono";
import { db } from "@/db";
import { deviceTokens } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const router = new Hono();

router.post("/device-tokens", async (c) => {
  const userId = c.get("user")?.id;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const { token, platform } = await c.req.json();
  if (!token || !["ios", "android"].includes(platform)) {
    return c.json({ error: "Invalid token or platform" }, 400);
  }

  try {
    // Upsert: update if exists, else insert
    const deviceId = await getDeviceId(); // App-side generated UUID
    const existing = await db
      .select()
      .from(deviceTokens)
      .where(
        and(
          eq(deviceTokens.userId, userId),
          eq(deviceTokens.deviceIdentifier, deviceId),
        ),
      );

    if (existing.length > 0) {
      await db
        .update(deviceTokens)
        .set({ fcmToken: token, isActive: true, updatedAt: new Date() })
        .where(eq(deviceTokens.id, existing[0].id));
    } else {
      await db.insert(deviceTokens).values({
        userId,
        fcmToken: token,
        platform,
        deviceIdentifier: deviceId,
        isActive: true,
      });
    }

    return c.json({ success: true, message: "Token registered" });
  } catch (error) {
    console.error("FCM registration error:", error);
    return c.json({ error: "Failed to register token" }, 500);
  }
});

router.delete("/device-tokens/:token", async (c) => {
  const userId = c.get("user")?.id;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const token = c.req.param("token");
  await db
    .update(deviceTokens)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(eq(deviceTokens.userId, userId), eq(deviceTokens.fcmToken, token)),
    );

  return c.json({ success: true });
});

export default router;
```

### FCM Dispatcher Service

```typescript
// apps/server/services/fcmDispatcher.ts
import admin from "firebase-admin";
import { db } from "@/db";
import { deviceTokens, notifications } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export class FCMDispatcher {
  async sendNotification(payload: {
    userId: string;
    title: string;
    body: string;
    data: {
      persona: "artist" | "venue" | "spectator";
      route: string;
      action?: string;
    };
  }) {
    const { userId, title, body, data } = payload;

    try {
      // Fetch active tokens
      const tokens = await db
        .select()
        .from(deviceTokens)
        .where(
          and(eq(deviceTokens.userId, userId), eq(deviceTokens.isActive, true)),
        );

      if (tokens.length === 0) return { sent: 0, failed: 0 };

      // Send multicast
      const response = await admin.messaging().sendMulticast({
        tokens: tokens.map((t) => t.fcmToken),
        notification: { title, body },
        data,
      });

      // Log to notifications table
      await db.insert(notifications).values({
        userId,
        type: data.action || "generic",
        title,
        body,
        route: data.route,
        persona: data.persona,
        isRead: false,
      });

      return { sent: response.successCount, failed: response.failureCount };
    } catch (error) {
      console.error("FCM dispatch error:", error);
      throw error;
    }
  }
}

export const fcmDispatcher = new FCMDispatcher();
```

### Common Gotchas

**Gotcha 1: Android token not returned immediately**

- Issue: `getExpoPushTokenAsync()` returns null on first Android login
- Fix: Wrap in retry loop with exponential backoff; retry up to 3 times over 5 seconds

**Gotcha 2: Cold-start persona not persisting**

- Issue: App reads notification persona on cold boot but doesn't save to AsyncStorage
- Fix: Store persona in AsyncStorage on cold boot; read on next app boot until user explicitly switches

**Gotcha 3: iOS foreground notification silent**

- Issue: `shouldShowAlert: true` not returned from notification handler
- Fix: Ensure `Notifications.setNotificationHandler()` explicitly returns `shouldShowAlert: true`

**Gotcha 4: Token rotation ignored**

- Issue: FCM rotates tokens; old tokens become invalid if app doesn't listen for refresh
- Fix: Always implement `addNotificationResponseReceivedListener()` and re-register on token refresh

**Gotcha 5: Over-notification spam**

- Issue: Bulk moderation or payment processing triggers 100+ notifications at once
- Fix: Implement rate limiting in FCMDispatcher — max 5 per user per minute; queue and batch excess

---

## Environment Variables

```bash
# Firebase Admin SDK
FIREBASE_PROJECT_ID=ceolx-firebase-project
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Notification config
FCM_MAX_RETRIES=3
NOTIFICATION_RATE_LIMIT_PER_MINUTE=5
NOTIFICATION_RETENTION_DAYS=90
```
