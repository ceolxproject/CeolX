# M8-T2 · Subscription Status Polling & In-App Pending State

| Field          | Value                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M8 — Venue Subscription & Payments                                                                         |
| **Status**     | 🔲 To Do                                                                                                   |
| **Depends on** | M8-T1 (Stripe checkout + webhook handler), M2-T4 (venue persona system), M7-T3 (Postmark activation email) |
| **PRD Ref**    | Section 7.2 (Venue Subscription), Section 4.3 (Persona Switching)                                          |

---

## Description

Once a Venue user selects the Venue persona but hasn't completed Stripe payment, the mobile app shows a persistent pending activation state. The app polls the backend every 30 seconds to detect when the Stripe webhook activates the subscription. This task covers the in-app banner/screen, the polling logic, rate-limited email resend, and the transition from pending to activated state.

---

## Affected Apps / Packages

| App / Package | Role                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| `apps/api`    | `GET /api/v1/users/me` (returns subscription_status), `POST /api/v1/venues/me/resend-activation` endpoint |
| `apps/mobile` | Pending activation screen/banner, polling logic, rate-limited resend button, subscription status check    |

---

## API Endpoints

### GET /api/v1/users/me

Fetch current user profile including Venue subscription status.

**Response (2xx):**

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "currentRole": "venue",
  "venueProfile": {
    "id": "venue-uuid",
    "name": "The Brazen Head",
    "subscriptionStatus": "inactive",
    "isActive": false,
    "createdAt": "2026-03-23T10:00:00Z"
  }
}
```

### POST /api/v1/venues/me/resend-activation

Resend Postmark venue activation email. Rate-limited: max 3 per hour per Venue.

**Request Body:**

```json
{}
```

**Response (2xx):**

```json
{
  "success": true,
  "message": "Activation email sent. Check your inbox."
}
```

**Error Responses:**

- `401 Unauthorized`: Not authenticated or not a Venue user
- `429 Too Many Requests`: Rate limit exceeded (max 3 per hour)
- `500 Internal Server Error`: Email send failed

---

## Database Schema Additions

### venue_profiles table (add columns)

```sql
ALTER TABLE venue_profiles ADD COLUMN subscription_status TEXT DEFAULT 'inactive';
-- enum: inactive | active | past_due | cancelled

ALTER TABLE venue_profiles ADD COLUMN stripe_customer_id TEXT UNIQUE NULL;
ALTER TABLE venue_profiles ADD COLUMN stripe_subscription_id TEXT UNIQUE NULL;

CREATE INDEX idx_venue_profiles_subscription_status ON venue_profiles(subscription_status);
```

### venue_subscriptions table (create)

```sql
CREATE TABLE venue_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_profile_id UUID NOT NULL REFERENCES venue_profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  -- enum: active | past_due | cancelled
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  INDEX(venue_profile_id),
  INDEX(stripe_customer_id)
);
```

### resend_email_log table (create — for rate limiting)

```sql
CREATE TABLE resend_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_profile_id UUID NOT NULL REFERENCES venue_profiles(id) ON DELETE CASCADE,
  sent_at TIMESTAMP DEFAULT now(),
  INDEX(venue_profile_id, sent_at)
);
```

---

## Requirements

### Pending Activation UI

- R1.1: When Venue persona is active and `subscription_status = 'inactive'`, show persistent banner or full-screen state
- R1.2: Banner/screen heading: _"Activate Your Venue Profile"_
- R1.3: Body text: _"Your profile is not yet visible to artists. Complete your subscription to get started."_
- R1.4: Visual style: yellow/warning tone (not error red); non-blocking, allows navigation
- R1.5: Include two CTAs:
  - **"Check Email"** button (links to email app or shows instructions)
  - **"Resend Email"** button (calls `POST /api/v1/venues/me/resend-activation`)
- R1.6: No external URL (`ceolx.ie/subscribe`, Stripe, payment links) shown or linked inside the app
- R1.7: Footer: _"If you didn't receive the email, check your spam folder or contact support"_

### Subscription Status Polling

- R2.1: When Venue persona is active and `subscription_status = 'inactive'`, poll `GET /api/v1/users/me` every 30 seconds
- R2.2: Polling starts on Venue persona activation; stops when `subscription_status = 'active'` OR user navigates away from pending screen
- R2.3: On successful poll response: check `venueProfile.subscriptionStatus`
  - If `'active'`: dismiss pending state, refresh profile data, show confirmation toast: _"Profile activated! You're ready to accept bookings."_
  - If still `'inactive'`: no UI change; continue polling
- R2.4: On poll error (network fail, 401, etc.): log error, continue polling (don't fail)
- R2.5: Clear polling interval on unmount or role switch

### Rate-Limited Email Resend

- R3.1: `POST /api/v1/venues/me/resend-activation` checks `resend_email_log` for entries in the last 60 minutes
- R3.2: If count >= 3, return `429 Too Many Requests`: _"Too many resend requests. Please wait 1 hour before trying again."_
- R3.3: If count < 3: send Postmark email (same template as M2-T4), log to resend_email_log, return success
- R3.4: Show toast: _"Activation email sent. Check your inbox."_
- R3.5: Disable "Resend Email" button for 5 seconds post-click (UX smoothness)

### Subscription Status Persistence

- R4.1: `subscription_status` is the source of truth: fetched from DB on every `GET /api/v1/users/me` request
- R4.2: Mobile app never caches subscription status longer than the polling interval (30s)
- R4.3: On fresh app launch, first request to `GET /api/v1/users/me` determines initial state
- R4.4: No hard refresh required — smooth polling detection is sufficient for V1

### Profile Visibility Gating

- R5.1: When `subscription_status = 'inactive'`, Venue profile is not visible to other users/Artists (set by `is_active = false`)
- R5.2: Venue can create events, but events remain `pending_review` until profile is activated
- R5.3: Once `subscription_status = 'active'`, set `is_active = true`; profile appears on map/search; events auto-activate from pending (if approved)
- R5.4: Switching away from Venue persona: `is_active = false` but `subscription_status` unchanged (subscription persists if Venue re-activated later)

---

## Acceptance Criteria

- [ ] Venue with `subscription_status = 'inactive'` sees pending activation banner/screen
- [ ] No payment URL or external link visible inside the app
- [ ] "Resend Email" button calls `POST /api/v1/venues/me/resend-activation` and shows success toast
- [ ] Rate limit on Resend Email works (4th attempt within 1 hour returns error message)
- [ ] Polling detects `subscription_status = 'active'` within ~30 seconds of webhook firing
- [ ] Pending state dismissed on activation; confirmation toast shown
- [ ] Polling stops after activation or role switch
- [ ] `GET /api/v1/users/me` returns correct `subscription_status` and `isActive` flag
- [ ] Venue profile hidden on map until activation
- [ ] Switching away from Venue does not cancel subscription (billing persists)
- [ ] Full-screen pending state only shown in Venue persona, not in Spectator/Artist

---

## Dependencies

- **Upstream**: M8-T1 (Stripe checkout + webhook handler), M2-T4 (venue persona system), M7-T3 (Postmark), M2-T1 (authentication)
- **Downstream**: M8-T3 (lifecycle/cancellation handler), M8-T4 (subscription management portal)
- **External services**: None (internal polling only)

---

## Technical Notes

### Hono Backend — Subscription Status Endpoint

```typescript
// apps/server/routes/v1/users.ts
import { Hono } from "hono";
import { db } from "@/db";
import { users, venueProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

const router = new Hono();

router.get("/users/me", async (c) => {
  const userId = c.get("user")?.id;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    let venueProfile = null;
    if (user.currentRole === "venue") {
      venueProfile = await db.query.venueProfiles.findFirst({
        where: eq(venueProfiles.userId, userId),
      });
    }

    return c.json({
      id: user.id,
      email: user.email,
      currentRole: user.currentRole,
      venueProfile: venueProfile
        ? {
            id: venueProfile.id,
            name: venueProfile.name,
            subscriptionStatus: venueProfile.subscriptionStatus,
            isActive: venueProfile.isActive,
            createdAt: venueProfile.createdAt,
          }
        : null,
    });
  } catch (error) {
    console.error("User fetch error:", error);
    return c.json({ error: "Failed to fetch user" }, 500);
  }
});
```

### Resend Activation Email Endpoint

```typescript
// apps/server/routes/v1/venues.ts
import { Hono } from "hono";
import { db } from "@/db";
import { venueProfiles, resendEmailLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/services/email";

const router = new Hono();

router.post("/venues/me/resend-activation", async (c) => {
  const userId = c.get("user")?.id;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  try {
    // Get Venue profile
    const venue = await db.query.venueProfiles.findFirst({
      where: eq(venueProfiles.userId, userId),
    });

    if (!venue) {
      return c.json({ error: "Venue profile not found" }, 400);
    }

    // Check rate limit: count resends in last 60 minutes
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentResends = await db
      .select()
      .from(resendEmailLog)
      .where(
        and(
          eq(resendEmailLog.venueProfileId, venue.id),
          gt(resendEmailLog.sentAt, oneHourAgo),
        ),
      );

    if (recentResends.length >= 3) {
      return c.json(
        { error: "Too many resend requests. Please wait 1 hour." },
        429,
      );
    }

    // Get user email
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    // Send email
    await sendEmail({
      to: user.email,
      templateAlias: "venue-activation",
      templateModel: {
        venueName: venue.name,
        ActivationLink: "https://ceolx.ie/subscribe",
      },
    });

    // Log resend
    await db.insert(resendEmailLog).values({
      venueProfileId: venue.id,
    });

    return c.json({
      success: true,
      message: "Activation email sent",
    });
  } catch (error) {
    console.error("Resend activation error:", error);
    return c.json({ error: "Failed to send email" }, 500);
  }
});

export default router;
```

### React Native Polling Hook

```typescript
// apps/native/hooks/useSubscriptionPolling.ts
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRole } from "@/context/RoleContext";

export function useSubscriptionPolling() {
  const { currentRole } = useRole();
  const queryClient = useQueryClient();
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const { data: user } = useQuery({
    queryKey: ["user", "me"],
    queryFn: () => fetch(`${API_URL}/api/v1/users/me`).then((r) => r.json()),
  });

  useEffect(() => {
    const venueProfile = user?.venueProfile;

    // Start polling if Venue is inactive
    if (
      currentRole === "venue" &&
      venueProfile?.subscriptionStatus === "inactive"
    ) {
      pollInterval.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["user", "me"] });
      }, 30000); // Poll every 30s
    } else {
      // Stop polling if activated or role changed
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
    }

    // Detect activation
    if (venueProfile?.subscriptionStatus === "active" && pollInterval.current) {
      clearInterval(pollInterval.current);
      Toast.show({
        type: "success",
        text1: "Profile activated!",
        text2: "You're ready to accept bookings.",
        duration: 3000,
      });
      // Dismiss pending screen automatically
    }

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [currentRole, user?.venueProfile?.subscriptionStatus]);

  return { subscriptionStatus: user?.venueProfile?.subscriptionStatus };
}
```

### Pending Activation Screen Component

```typescript
// apps/native/screens/PendingActivationScreen.tsx
import { View, Text, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSubscriptionPolling } from '@/hooks/useSubscriptionPolling';
import * as Linking from 'expo-linking';

export function PendingActivationScreen() {
  const { subscriptionStatus } = useSubscriptionPolling();
  const [resendLoading, setResendLoading] = useState(false);

  const { mutate: resendEmail } = useMutation({
    mutationFn: () =>
      fetch(`${API_URL}/api/v1/venues/me/resend-activation`, {
        method: 'POST',
      }).then((r) => r.json()),
    onSuccess: () => {
      Toast.show({
        type: 'success',
        text1: 'Email sent',
        text2: 'Check your inbox',
        duration: 2000,
      });
      setResendLoading(false);
    },
    onError: (error: any) => {
      if (error.response?.status === 429) {
        Toast.show({
          type: 'error',
          text1: 'Too many requests',
          text2: 'Please wait 1 hour before resending',
        });
      }
      setResendLoading(false);
    },
  });

  if (subscriptionStatus === 'active') {
    // Should not reach here; parent component should dismiss this screen
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Activate Your Venue Profile</Text>
      <Text style={styles.body}>
        Your profile is not yet visible to artists. Complete your subscription to get started.
      </Text>

      <TouchableOpacity onPress={() => Linking.openURL('message://')} style={styles.button}>
        <Text>Check Email</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          setResendLoading(true);
          resendEmail();
        }}
        disabled={resendLoading}
        style={[styles.button, styles.secondaryButton]}
      >
        <Text>{resendLoading ? 'Sending...' : 'Resend Email'}</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        If you didn't receive the email, check your spam folder or contact support.
      </Text>
    </View>
  );
}
```

### Common Gotchas

**Gotcha 1: Polling continues after user navigates away**

- Issue: Interval keeps running; drains battery, creates redundant requests
- Fix: Clear `setInterval` in useEffect cleanup on component unmount

**Gotcha 2: Rate limit reset logic broken**

- Issue: Resend count doesn't reset after 1 hour; users permanently locked out
- Fix: Query `sent_at > now() - interval '1 hour'`; old records expire automatically

**Gotcha 3: Email resend sends to wrong address**

- Issue: Resend uses hardcoded email instead of current user's email
- Fix: Fetch user email from `GET /api/v1/users/me` before resending

**Gotcha 4: Subscription status not refreshed after webhook**

- Issue: App still shows pending; webhook fired but app didn't re-query
- Fix: Ensure polling interval is actually triggering queries; check React Query cache invalidation

**Gotcha 5: Pending screen shown in Spectator/Artist role accidentally**

- Issue: Profile check doesn't filter by `currentRole === 'venue'`
- Fix: Guard: `if (currentRole !== 'venue') return null` in component
