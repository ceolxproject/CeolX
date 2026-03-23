# M8-T1 · Stripe Checkout Web Flow (ceolx.ie/subscribe)

| Field | Value |
|-------|-------|
| **Milestone** | M8 — Venue Subscription & Payments |
| **Status** | 🔲 To Do |
| **Depends on** | M1-T5 (Next.js admin scaffold + /subscribe route), M2-T4 (venue persona system), M7-T3 (Postmark venue activation email) |
| **PRD Ref** | Section 7.2 (Venue Subscription — Web-based Stripe), Section 13 (Tech Stack — Admin Dashboard) |

---

## Description

Build the Venue subscription flow at `ceolx.ie/subscribe`. Unlike in-app purchases (prohibited by Apple Rule 3.1.1), Venues subscribe via web-based Stripe Checkout. The flow: user selects Venue persona → Postmark activation email sent with `ceolx.ie/subscribe` link → Venue logs in with CeolX credentials on the page → redirected to Stripe Checkout → on success, Stripe webhook activates the Venue profile → app detects activation and removes the pending state.

---

## Affected Apps / Packages

| App / Package | Role |
|---------------|------|
| `apps/admin` | `/subscribe` route (public, no auth required initially) + login for CeolX credentials |
| `apps/api` | `POST /api/v1/stripe/checkout-session` endpoint, Stripe webhook handler |

---

## API Endpoints

### POST /api/v1/stripe/checkout-session

Create a Stripe Checkout session for Venue subscription.

**Request Body:**
```json
{
  "venueProfileId": "uuid"
}
```

**Response (2xx):**
```json
{
  "checkoutUrl": "https://checkout.stripe.com/pay/cs_live_xxx",
  "sessionId": "cs_live_xxx"
}
```

**Error Responses:**
- `400 Bad Request`: Missing venueProfileId or venue not found
- `401 Unauthorized`: Not authenticated
- `409 Conflict`: Venue already has active subscription
- `500 Internal Server Error`: Stripe API error

### POST /api/webhooks/stripe

Handle Stripe webhook events (e.g., `checkout.session.completed`).

**Request Body:** Raw Stripe event JSON (Postman-like, not parsed)

**Response (2xx):**
```json
{
  "received": true
}
```

**Error Responses:**
- `400 Bad Request`: Invalid Stripe signature
- `500 Internal Server Error`: Webhook processing failed

---

## Requirements

### Web Page Configuration
- R1.1: `/subscribe` page in `apps/admin` is **public** — no initial authentication required to view the page
- R1.2: Page title/branding: CeolX logo, heading *"Activate Your Venue Profile"*
- R1.3: Logged-out users see login form on `/subscribe`; logged-in Venue users skip to checkout button
- R1.4: No external URL (`ceolx.ie/subscribe` link itself) shown or mentioned inside the mobile app — link sent only via email

### Login Flow
- R2.1: `/subscribe` page includes email/password login form for users without a session
- R2.2: POST to `/auth/sign-in` (existing BetterAuth endpoint) with email/password
- R2.3: On successful login, issue session cookie; refresh `/subscribe` page
- R2.4: Logged-in users see heading: *"Complete your subscription to activate your profile"*
- R2.5: Account type check: redirect non-Venue users with message: *"Please switch to Venue account type first"*

### Checkout Session Creation
- R3.1: Authenticated Venue user clicks "Subscribe Now" button
- R3.2: Button POSTs to `/api/v1/stripe/checkout-session` with authenticated session
- R3.3: Backend validates: user is authenticated, has Venue profile, subscription_status ≠ active
- R3.4: Stripe API call: `stripe.checkout.sessions.create()` with:
  - Mode: `subscription`
  - Customer email: user's email (Stripe pre-fills)
  - Line items: `[{ price: STRIPE_PRICE_ID, quantity: 1 }]`
  - Success URL: `https://ceolx.ie/subscribe?success=true`
  - Cancel URL: `https://ceolx.ie/subscribe?cancelled=true`
  - Metadata: `{ venueProfileId, userId }`
- R3.5: Return checkout session URL; frontend redirects to Stripe-hosted checkout

### Stripe Checkout Page
- R4.1: Stripe Checkout hosted page (Stripe's domain) shows:
  - Product: "CeolX Venue Subscription" (or client-specified name)
  - Price: Monthly or annual (per client pricing decision)
  - Payment method: card, Apple Pay, Google Pay
  - Billing address (optional per client decision)
- R4.2: No CeolX custom branding on this page — Stripe's standard checkout (matches App Store compliance)
- R4.3: Success redirects to `/subscribe?success=true`; cancel redirects to `/subscribe?cancelled=true`

### Webhook Handler
- R5.1: Stripe sends POST to `/api/webhooks/stripe` with `checkout.session.completed` event
- R5.2: Endpoint verifies Stripe signature using `stripe.webhooks.constructEvent(body, sig, secret)`
- R5.3: Extract `metadata.venueProfileId` from session
- R5.4: Database transaction:
  - Update `venue_profiles`: set `subscription_status = 'active'`, `stripe_customer_id`, `stripe_subscription_id`
  - Create record in `venue_subscriptions` table: `{ venueProfileId, stripeCustomerId, stripeSubscriptionId, status: 'active', currentPeriodStart, currentPeriodEnd, createdAt }`
  - Set `venue_profiles.is_active = true` (profile now visible)
- R5.5: Send Postmark payment confirmation email to user (M7-T3)
- R5.6: Fire FCM notification to Venue: "Subscription Activated ✓" (M7-T1)
- R5.7: If webhook fails, log error but don't throw (idempotent retry on Stripe's next attempt)

### Success & Error Messaging
- R6.1: On success redirect (`?success=true`), show: *"Subscription activated! Your profile is now live. Artists can now find you."* + button to return to app
- R6.2: On cancel redirect (`?cancelled=true`), show: *"Subscription cancelled. Your profile remains pending. Check your email to try again or contact support."*
- R6.3: If `subscription_status = active` already, show: *"Your subscription is already active. Return to the app to manage bookings."*
- R6.4: Contact support link if error occurs

### Environment & Configuration
- R7.1: Stripe live secret key stored as `STRIPE_SECRET_KEY` (prod) + test key for staging
- R7.2: Stripe webhook signing secret stored as `STRIPE_WEBHOOK_SECRET`
- R7.3: Stripe price ID (subscription product) stored as `STRIPE_PRICE_ID`
- R7.4: Stripe Customer Portal configured in Stripe Dashboard (branding, cancellation policy) before launch
- R7.5: Revenue math: Stripe fee ~2.9% + €0.30 per transaction → CeolX net ~97% (vs ~85% with Apple IAP)

---

## Acceptance Criteria

- [ ] `/subscribe` page renders publicly; login form visible for unauthenticated users
- [ ] Authenticated Venue user sees "Subscribe Now" button
- [ ] Clicking "Subscribe Now" redirects to Stripe Checkout
- [ ] Completing payment on Stripe redirects back to `/subscribe?success=true`
- [ ] Success page shows "Subscription activated" message + return button
- [ ] Stripe webhook received and processed; `subscription_status = 'active'` in DB
- [ ] Webhook signature verification rejects tampered payloads (returns 400)
- [ ] Venue profile becomes visible (`is_active = true`) after webhook
- [ ] Payment confirmation email sent after successful subscription
- [ ] FCM notification sent to Venue: "Subscription Activated ✓"
- [ ] Cancellation page shows appropriate message
- [ ] No Stripe checkout URL shown or linked inside mobile app
- [ ] Stripe live mode tested with real payment (staging → prod) before launch

---

## Dependencies

- **Upstream**: M1-T5 (admin scaffold with public routes), M2-T4 (venue persona + activation email), M7-T3 (Postmark integration)
- **Downstream**: M8-T2 (subscription status polling + in-app pending state), M8-T3 (lifecycle/cancellation handler), M8-T4 (subscription management portal)
- **External services**: Stripe (payment processor), Postmark (email), Firebase FCM (notifications)

---

## Technical Notes

### Next.js /subscribe Page

```typescript
// apps/admin/app/(public)/subscribe/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/auth-client';

export default function SubscribePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const success = searchParams.get('success');
  const cancelled = searchParams.get('cancelled');

  useEffect(() => {
    // Check current session
    const auth = createClient();
    auth.getSession().then((s) => {
      if (s?.user) {
        setSession(s);
        // Redirect to checkout if not Venue
        if (s.user.currentRole !== 'venue') {
          // Show error or redirect
        }
      }
    });
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const auth = createClient();
      const result = await auth.signIn.email({
        email,
        password,
        callbackURL: '/subscribe',
      });

      if (result.ok) {
        setSession(result.data);
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    setLoading(true);

    try {
      const res = await fetch('/api/v1/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueProfileId: session?.user?.venueProfileId,
        }),
      });

      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (error) {
      console.error('Checkout error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div>
        <h1>Subscription Activated ✓</h1>
        <p>Your profile is now live. Artists can find you on the map.</p>
        <a href="ceolx://app">Return to App</a>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div>
        <h1>Subscription Cancelled</h1>
        <p>Check your email to try again or contact support.</p>
        <a href="ceolx://app">Return to App</a>
      </div>
    );
  }

  if (!session) {
    return (
      <form onSubmit={handleLogin}>
        <h2>Sign In</h2>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
        <button type="submit" disabled={loading}>
          Sign In
        </button>
      </form>
    );
  }

  return (
    <div>
      <h1>Activate Your Venue Profile</h1>
      <p>Complete your subscription to start accepting bookings.</p>
      <button onClick={handleCheckout} disabled={loading}>
        {loading ? 'Redirecting...' : 'Subscribe Now'}
      </button>
    </div>
  );
}
```

### Hono Checkout Session Endpoint

```typescript
// apps/api/routes/v1/stripe.ts
import { Hono } from 'hono';
import Stripe from 'stripe';
import { db } from '@/db';
import { venueProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const router = new Hono();

router.post('/stripe/checkout-session', async (c) => {
  const userId = c.get('user')?.id;
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const { venueProfileId } = await c.req.json();
  if (!venueProfileId) return c.json({ error: 'Missing venueProfileId' }, 400);

  try {
    // Validate Venue profile
    const venue = await db
      .select()
      .from(venueProfiles)
      .where(eq(venueProfiles.id, venueProfileId));

    if (!venue.length || venue[0].userId !== userId) {
      return c.json({ error: 'Venue not found' }, 400);
    }

    if (venue[0].subscriptionStatus === 'active') {
      return c.json({ error: 'Already subscribed' }, 409);
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: c.get('user').email,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.APP_URL}/subscribe?success=true`,
      cancel_url: `${process.env.APP_URL}/subscribe?cancelled=true`,
      metadata: {
        venueProfileId,
        userId,
      },
    });

    return c.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Checkout session error:', error);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
});

export default router;
```

### Stripe Webhook Handler (Checkout Completion)

```typescript
// apps/api/routes/webhooks/stripe.ts
import { Hono } from 'hono';
import Stripe from 'stripe';
import { db } from '@/db';
import { venueProfiles, venueSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendEmail } from '@/services/email';
import { fcmDispatcher } from '@/services/fcmDispatcher';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const router = new Hono();

router.post('/webhooks/stripe', async (c) => {
  const body = await c.req.text();
  const sig = c.req.header('stripe-signature');

  if (!sig) return c.json({ error: 'No signature' }, 400);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return c.json({ error: 'Invalid signature' }, 400);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { venueProfileId, userId } = session.metadata as any;

      // Update Venue profile
      await db
        .update(venueProfiles)
        .set({
          subscriptionStatus: 'active',
          stripeCustomerId: session.customer as string,
          isActive: true,
        })
        .where(eq(venueProfiles.id, venueProfileId));

      // Create subscription record
      await db.insert(venueSubscriptions).values({
        venueProfileId,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        status: 'active',
      });

      // Get user email for confirmation
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      // Send confirmation email
      await sendEmail({
        to: user.email,
        templateAlias: 'payment-confirmation',
        templateModel: {
          venueName: (await db.query.venueProfiles.findFirst({
            where: eq(venueProfiles.id, venueProfileId),
          })).name,
          Amount: '€29.99',
          PlanName: 'CeolX Pro',
          ManageLink: 'https://ceolx.ie/account',
        },
      });

      // Send FCM notification
      await fcmDispatcher.sendNotification({
        userId,
        title: 'Subscription Activated ✓',
        body: 'Your profile is now live. Start accepting bookings!',
        data: {
          persona: 'venue',
          route: '/profile',
          action: 'view_subscription',
        },
      });
    }

    return c.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return c.json({ error: 'Processing failed' }, 500);
  }
});

export default router;
```

### Common Gotchas

**Gotcha 1: Webhook endpoint not set as public in Next.js**
- Issue: Stripe webhook redirected to auth; returns 401
- Fix: Ensure `/api/webhooks/stripe` route is public (no middleware auth)

**Gotcha 2: Raw body consumed before Stripe signature verification**
- Issue: Body already parsed as JSON; Stripe signature verify fails
- Fix: In Hono, use `c.req.raw.text()` or middleware to preserve raw body for signature verification

**Gotcha 3: Duplicate webhooks on retry causing double-charge**
- Issue: Stripe retries webhook; if not idempotent, creates duplicate subscription record
- Fix: Check `subscription_status` before creating record; use unique constraint on stripeSubscriptionId

**Gotcha 4: Success page doesn't close or redirect**
- Issue: User lands on `/subscribe?success=true` but doesn't know how to return to app
- Fix: Provide CTA button "Return to App" → deeplink scheme `ceolx://app`

**Gotcha 5: Wrong Stripe environment mixed up (live vs test)**
- Issue: Development uses live Stripe keys; real payments charged
- Fix: Stripe test keys in .env.local; live keys only in production environment variables
