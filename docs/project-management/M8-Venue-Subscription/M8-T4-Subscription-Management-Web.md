# M8-T4 · Subscription Management Portal (ceolx.ie/account)

| Field          | Value                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Milestone**  | M8 — Venue Subscription & Payments                                                                                     |
| **Status**     | 🔲 To Do                                                                                                               |
| **Depends on** | M8-T1 (Stripe checkout), M8-T2 (subscription status), M8-T3 (lifecycle + cancellation), M1-T5 (Next.js admin scaffold) |
| **PRD Ref**    | Section 7.2 (Venue Subscription), Section 13 (Tech Stack — Admin Dashboard)                                            |

---

## Description

Build the Venue subscription management page at `ceolx.ie/account`. Authenticated Venues can view their subscription status, billing history, update payment method, and cancel their subscription. The page redirects to Stripe Customer Portal (Stripe's hosted interface) for all management operations. Cancellation via the portal triggers a Stripe webhook → app detects cancellation → profile hidden in app.

---

## Affected Apps / Packages

| App / Package | Role                                                                                 |
| ------------- | ------------------------------------------------------------------------------------ |
| `apps/admin`  | `/account` route (public but auth-required), Stripe Customer Portal session endpoint |
| `apps/api`    | `POST /api/v1/stripe/portal-session` endpoint                                        |

---

## API Endpoints

### POST /api/v1/stripe/portal-session

Create a Stripe Customer Portal session for authenticated Venue user.

**Request Body:**

```json
{}
```

**Response (2xx):**

```json
{
  "portalUrl": "https://billing.stripe.com/p/session/..."
}
```

**Error Responses:**

- `401 Unauthorized`: Not authenticated or not a Venue user
- `404 Not Found`: No active Stripe subscription found
- `500 Internal Server Error`: Stripe API error

---

## Requirements

### Authentication & Routing

- R1.1: `/account` page requires authenticated user with active Venue persona
- R1.2: Unauthenticated users redirected to login page
- R1.3: Non-Venue users (Spectator/Artist) see message: _"Please switch to Venue account type to manage your subscription."_
- R1.4: No external URL shown inside mobile app — link to `ceolx.ie/account` sent only via Postmark payment confirmation email (M7-T3)

### Subscription Status Display

- R2.1: On page load, display current subscription status:
  - If `subscription_status = 'active'`: show green badge "Active" + plan name + next billing date
  - If `subscription_status = 'past_due'`: show yellow badge "Payment Due" + message "Your payment method needs updating"
  - If `subscription_status = 'cancelled'`: show gray badge "Cancelled" + message "You can reactivate at any time"
  - If `subscription_status = 'inactive'` (edge case): show message "No active subscription" + link to `/subscribe`
- R2.2: Display billing history: last invoice date, amount, status (paid, failed, etc.)
- R2.3: Display next billing date (extracted from Stripe subscription `current_period_end`)

### Stripe Customer Portal Integration

- R3.1: On page load, fetch `stripe_customer_id` from Venue profile via authenticated API call
- R3.2: Call `POST /api/v1/stripe/portal-session` to create a Stripe portal session
- R3.3: Redirect Venue to portal URL (Stripe's hosted domain)
- R3.4: Portal URL auto-expires after 24 hours; generate fresh URL on each page load
- R3.5: Stripe Customer Portal displays (per Dashboard config, M12):
  - Current subscription details (plan, price, billing cycle)
  - Billing history (past invoices with download links)
  - Payment method management (add/update card)
  - Subscription cancellation button
- R3.6: Return URL in portal session: `https://ceolx.ie` (returns to home, not `/account`)

### Cancellation Flow

- R4.1: Venue clicks "Cancel Subscription" in Stripe Customer Portal
- R4.2: Stripe sends `customer.subscription.deleted` webhook → backend sets `subscription_status = 'cancelled'` (M8-T3)
- R4.3: Mobile app detects cancellation on next poll (30s) → shows pending/reactivation state (M8-T2, M8-T3)
- R4.4: **CeolX does not build cancellation UI** — all cancellation is via Stripe Portal only

### Reactivation Path

- R5.1: If Venue cancels, `/account` page shows: _"Your subscription is cancelled. [Button: Reactivate] → ceolx.ie/subscribe"_
- R5.2: Re-subscribing follows same flow as M8-T1 (Stripe Checkout → webhook → activation)
- R5.3: No data is deleted on cancellation — past events and bookings preserved

### Error Handling

- R6.1: If user has no Stripe customer ID: _"No active subscription found. Check your email for the activation link or contact support."_
- R6.2: If Stripe API fails: _"Unable to load subscription details. Please try again or contact support."_
- R6.3: Retry button available on error state
- R6.4: Contact support link on all error pages

### Page Layout

- R7.1: Heading: "Manage Your Subscription"
- R7.2: Subscription status card (green/yellow/gray badge)
- R7.3: Billing details section: plan name, next billing date, amount
- R7.4: Billing history section: table of past invoices (date, amount, status, download link)
- R7.5: Action button: "Manage in Stripe Portal" (primary color) → redirects to portal
- R7.6: Footer: support contact, FAQ link (if available)
- R7.7: No payment form or card input on this page — all via Stripe Portal

---

## Acceptance Criteria

- [ ] Unauthenticated users redirected to login page
- [ ] Non-Venue users see appropriate message
- [ ] `/account` page loads with correct subscription status badge
- [ ] Subscription status updates after webhook fires (within ~30s due to polling)
- [ ] "Manage in Stripe Portal" button redirects to Stripe Customer Portal
- [ ] Portal session URL generated fresh on each page load (not cached)
- [ ] Venue can update payment method in Stripe Portal
- [ ] Venue can cancel subscription in Stripe Portal
- [ ] Cancellation triggers webhook → app detects → profile hidden
- [ ] Reactivation link points to `/subscribe`
- [ ] Error states show helpful messages + support contact
- [ ] No subscription URL shown or linked inside mobile app
- [ ] Return URL from portal is `https://ceolx.ie` (not `/account`)

---

## Dependencies

- **Upstream**: M8-T1 (Stripe checkout), M8-T2 (subscription polling), M8-T3 (lifecycle/cancellation), M1-T5 (admin scaffold), M2-T1 (authentication)
- **Downstream**: None direct (final M8 task)
- **External services**: Stripe (Customer Portal), BetterAuth (session management)

---

## Technical Notes

### Next.js /account Page

```typescript
// apps/admin/app/(protected)/account/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/auth-client';
import { useQuery } from '@tanstack/react-query';

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Check session
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const auth = createClient();
      const s = await auth.getSession();
      if (!s?.user) router.push('/login');
      if (s?.user?.currentRole !== 'venue') {
        return { user: s.user, error: 'NOT_VENUE' };
      }
      return s;
    },
  });

  // Fetch user details (subscription status)
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['user', 'me'],
    queryFn: () =>
      fetch('/api/v1/users/me').then((r) => r.json()),
    enabled: !!session?.user,
  });

  const { data: portalSession, isLoading: portalLoading } = useQuery({
    queryKey: ['stripe', 'portal-session'],
    queryFn: () =>
      fetch('/api/v1/stripe/portal-session', { method: 'POST' }).then((r) =>
        r.json()
      ),
    enabled: !!user?.venueProfile && user.venueProfile.subscriptionStatus !== 'inactive',
  });

  useEffect(() => {
    if (portalSession?.portalUrl) {
      window.location.href = portalSession.portalUrl;
    }
    setLoading(false);
  }, [portalSession]);

  if (!session?.user || session.error === 'NOT_VENUE') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Manage Subscription</h1>
        <p>Please switch to Venue account type to manage your subscription.</p>
        <a href="/">Return Home</a>
      </div>
    );
  }

  const venueProfile = user?.venueProfile;
  const statusColor =
    venueProfile?.subscriptionStatus === 'active'
      ? 'green'
      : venueProfile?.subscriptionStatus === 'past_due'
        ? 'orange'
        : 'gray';

  if (
    venueProfile?.subscriptionStatus === 'inactive' ||
    !venueProfile
  ) {
    return (
      <div style={{ padding: '2rem' }}>
        <h1>Manage Subscription</h1>
        <p>No active subscription found. Check your email for the activation link.</p>
        <a href="/subscribe">Activate Subscription</a>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Manage Your Subscription</h1>

      {/* Status Card */}
      <div style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '2rem' }}>
        <span
          style={{
            backgroundColor: statusColor,
            color: 'white',
            padding: '0.25rem 0.75rem',
            borderRadius: '4px',
            fontSize: '0.875rem',
          }}
        >
          {venueProfile.subscriptionStatus === 'active' && 'Active'}
          {venueProfile.subscriptionStatus === 'past_due' && 'Payment Due'}
          {venueProfile.subscriptionStatus === 'cancelled' && 'Cancelled'}
        </span>

        <h2 style={{ marginTop: '1rem' }}>CeolX Pro</h2>
        <p>€29.99 per month</p>

        {venueProfile.subscriptionStatus === 'active' && (
          <p>Next billing date: [Next Period End Date]</p>
        )}

        {venueProfile.subscriptionStatus === 'past_due' && (
          <p style={{ color: 'orange' }}>
            Your payment method needs updating. Please update your card details below.
          </p>
        )}

        {venueProfile.subscriptionStatus === 'cancelled' && (
          <p>Your subscription was cancelled. You can reactivate at any time.</p>
        )}
      </div>

      {/* Action Buttons */}
      {venueProfile.subscriptionStatus === 'cancelled' && (
        <a
          href="/subscribe"
          style={{
            display: 'block',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#007AFF',
            color: 'white',
            borderRadius: '4px',
            textAlign: 'center',
            marginBottom: '1rem',
          }}
        >
          Reactivate Subscription
        </a>
      )}

      {(venueProfile.subscriptionStatus === 'active' ||
        venueProfile.subscriptionStatus === 'past_due') && (
        <button
          onClick={() => {
            setLoading(true);
            // Portal redirect happens in useEffect above
          }}
          disabled={portalLoading || loading}
          style={{
            display: 'block',
            width: '100%',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#007AFF',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          {loading ? 'Redirecting...' : 'Manage in Stripe Portal'}
        </button>
      )}

      {/* Support Footer */}
      <div style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
        <p>Need help? Contact support@ceolx.ie</p>
      </div>
    </div>
  );
}
```

### Hono Portal Session Endpoint

```typescript
// apps/server/routes/v1/stripe.ts (extended)
import { Hono } from "hono";
import Stripe from "stripe";
import { db } from "@/db";
import { venueProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const router = new Hono();

router.post("/stripe/portal-session", async (c) => {
  const userId = c.get("user")?.id;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  try {
    // Get Venue profile with Stripe customer ID
    const venue = await db.query.venueProfiles.findFirst({
      where: eq(venueProfiles.userId, userId),
    });

    if (!venue || !venue.stripeCustomerId) {
      return c.json(
        {
          error:
            "No active subscription found. Check your email for the activation link or contact support.",
        },
        404,
      );
    }

    // Create Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: venue.stripeCustomerId,
      return_url: "https://ceolx.ie",
    });

    return c.json({ portalUrl: session.url });
  } catch (error) {
    console.error("Portal session error:", error);
    return c.json(
      { error: "Unable to load subscription details. Please try again." },
      500,
    );
  }
});

export default router;
```

### Stripe Customer Portal Configuration (Pre-Launch Checklist — M12)

Before launch, configure Stripe Customer Portal in Stripe Dashboard:

1. Go to **Settings → Billing → Customer portal**
2. Create or configure portal:
   - **Branding**: Upload CeolX logo, set brand color
   - **Enabled features**:
     - ✓ Allow customers to update payment method
     - ✓ Allow customers to view billing history
     - ✓ Allow customers to view invoices
     - ✓ Allow customers to update email
     - ✓ Allow customers to cancel subscriptions
   - **Cancellation behaviour**: Set custom message and offer to pause instead of cancel (optional)
   - **Blocked features**: Disable if any (e.g., pause subscriptions)
3. Set default portal configuration for all products
4. Test with Stripe test customer ID before going live

---

## Common Gotchas

**Gotcha 1: Portal session URL redirects to login**

- Issue: User not authenticated; Stripe portal tries to verify ownership
- Fix: Ensure session cookie is valid before creating portal session; check `user_id` matches Stripe metadata

**Gotcha 2: No Stripe Customer ID found**

- Issue: Stripe customer created but not stored in `venue_profiles.stripe_customer_id`
- Fix: Verify M8-T1 webhook handler saves `stripe_customer_id` in the update statement

**Gotcha 3: Portal session URL expired/404**

- Issue: Portal URLs expire after 24 hours; user gets 404 if page is bookmarked
- Fix: Regenerate portal URL on each page load (do NOT cache); use React Query with no cache time

**Gotcha 4: Cancellation not detected in app**

- Issue: User cancels in Stripe Portal but app still shows active until next poll (30s)
- Fix: For now acceptable (V1); post-launch use WebSocket push on webhook for instant detection

**Gotcha 5: Return URL from portal shows home page instead of `/account`**

- Issue: User expects to return to subscription page; instead redirected to home
- Fix: Set `return_url` to `https://ceolx.ie` (not `/account`); it's a portal exit point, not a return

**Gotcha 6: Payment method update doesn't immediately fix past_due**

- Issue: User updates card in portal; still sees `subscription_status = 'past_due'` in app
- Fix: Stripe automatically retries payment within 3 days; no immediate action needed. App will show active once `invoice.payment_succeeded` fires and is processed by webhook

---

## Email Template: Link to /account (Payment Confirmation)

Postmark payment confirmation email should include:

```html
<p>
  <a href="https://ceolx.ie/account">Manage Your Subscription</a> anytime in the
  portal above.
</p>
```

This is the only place the `/account` link appears — never shown inside the mobile app.
