# M8-T3 · Subscription Lifecycle & Webhook Event Handlers

| Field          | Value                                                                                  |
| -------------- | -------------------------------------------------------------------------------------- |
| **Milestone**  | M8 — Venue Subscription & Payments                                                     |
| **Status**     | 🔲 To Do                                                                               |
| **Depends on** | M8-T1 (Stripe checkout + initial webhook handler), M8-T2 (subscription status polling) |
| **PRD Ref**    | Section 7.2 (Venue Subscription), Section 4.3 (Persona Switching)                      |

---

## Description

Extend the Stripe webhook handler to manage the full subscription lifecycle beyond checkout completion. Handle payment renewals, payment failures, and cancellations. Sync `venue_profiles.subscription_status` with Stripe's truth: active → past_due (on failure) → cancelled (on explicit cancellation), and active (on successful renewal). Ensure Venue profiles correctly hide/show based on billing state, and send appropriate email/push notifications.

---

## Affected Apps / Packages

| App / Package | Role                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------- |
| `apps/api`    | Extended webhook handler in `POST /api/webhooks/stripe` (M8-T1), Stripe event type handlers |

---

## Stripe Events to Handle

| Event                           | Trigger                                                   | Action                                                           |
| ------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| `checkout.session.completed`    | Subscription created (already done in M8-T1)              | Set `subscription_status = 'active'`                             |
| `customer.subscription.updated` | Renewal processed (payment_succeeded within subscription) | Ensure `subscription_status = 'active'`                          |
| `invoice.payment_succeeded`     | Payment renewal successful                                | Set `subscription_status = 'active'`; send confirmation email    |
| `invoice.payment_failed`        | Payment failed (card declined, etc.)                      | Set `subscription_status = 'past_due'`; send failure email       |
| `customer.subscription.deleted` | Explicit cancellation via Stripe Portal                   | Set `subscription_status = 'cancelled'`; set `is_active = false` |

---

## Requirements

### Payment Renewal Handler

- R1.1: On `invoice.payment_succeeded` webhook:
  - Find Venue by `invoice.customer` (Stripe customer ID)
  - Update `venue_subscriptions.status = 'active'`
  - Update `venue_profiles.subscription_status = 'active'`
  - Ensure `venue_profiles.is_active = true` (profile visible)
  - Send Postmark payment confirmation email to Venue user (invoice summary, manage link to `ceolx.ie/account`)
  - Send FCM notification: "Payment Received ✓" (M7-T1)
- R1.2: Extract invoice details for email: amount (EUR), plan name, next billing date
- R1.3: Idempotent: if `subscription_status` already `'active'`, no error; email/notification sent once per invoice

### Payment Failure Handler

- R2.1: On `invoice.payment_failed` webhook:
  - Find Venue by `invoice.customer`
  - Update `venue_subscriptions.status = 'past_due'`
  - Update `venue_profiles.subscription_status = 'past_due'`
  - Set `venue_profiles.is_active = false` (profile hidden from map/search)
  - Send Postmark failure email: _"Payment failed. Your subscription is paused."_ + retry instructions + link to `ceolx.ie/account` to update payment method
  - Log error in backend (do not send FCM notification — avoid alarm; email is sufficient)
- R2.2: Venue can update payment method via Stripe Customer Portal at `ceolx.ie/account`
- R2.3: On next renewal, payment retried automatically by Stripe (up to 3 days of retries); `invoice.payment_succeeded` fires on success
- R2.4: Idempotent: if already `'past_due'`, no duplicate emails

### Cancellation Handler

- R3.1: On `customer.subscription.deleted` webhook:
  - Find Venue by `event.data.object.customer`
  - Update `venue_subscriptions.status = 'cancelled'`
  - Update `venue_profiles.subscription_status = 'cancelled'`
  - Set `venue_profiles.is_active = false` (profile hidden)
  - Send Postmark cancellation confirmation email: _"Your subscription has been cancelled."_ + offer to reactivate
  - Log in backend (no FCM notification)
- R3.2: Cancellation typically triggered via Stripe Customer Portal (M8-T4); CeolX does not build a cancellation UI in V1
- R3.3: Events created by Venue before cancellation are not deleted — they remain archived after event date passes
- R3.4: Idempotent: if already `'cancelled'`, no duplicate emails

### Persona Switching & Subscription Persistence

- R4.1: When user switches away from Venue persona (to Spectator/Artist):
  - `venue_profiles.is_active = false` (profile hidden)
  - `subscription_status` **unchanged** — billing persists
  - Venue can re-activate later without re-subscribing
- R4.2: When user switches back to Venue persona:
  - If `subscription_status = 'active'` → profile immediately visible
  - If `subscription_status = 'past_due'` or `'cancelled'` → show pending/failed state (M8-T2, M8-T3 UI)

### Database State Sync

- R5.1: `venue_profiles.subscription_status` enum: `'inactive' | 'active' | 'past_due' | 'cancelled'`
- R5.2: `venue_subscriptions.status` enum: `'active' | 'past_due' | 'cancelled'` (matches Stripe)
- R5.3: On every webhook, verify consistency: if webhook updates `venue_subscriptions`, also update `venue_profiles` to match
- R5.4: Never delete records — only update status and timestamps

### Webhook Error Handling

- R6.1: All webhook handlers validate Stripe signature using `stripe.webhooks.constructEvent()`
- R6.2: If signature invalid → return 400, do not process
- R6.3: If event already processed (idempotent check) → return 200 (success)
- R6.4: If database error → log error, return 500; Stripe retries webhook after exponential backoff
- R6.5: Fire-and-forget for email/FCM: if email send fails, log error but don't fail webhook response

---

## Acceptance Criteria

- [ ] `invoice.payment_succeeded` webhook updates `subscription_status = 'active'`; sends confirmation email and FCM
- [ ] `invoice.payment_failed` webhook updates `subscription_status = 'past_due'`; sends failure email; hides profile
- [ ] `customer.subscription.deleted` webhook updates `subscription_status = 'cancelled'`; sends cancellation email; hides profile
- [ ] Venue profile hidden on map/search when `subscription_status = 'past_due'` or `'cancelled'`
- [ ] Switching away from Venue doesn't cancel subscription; `subscription_status` persists
- [ ] Switching back to Venue shows correct subscription state (active or failed)
- [ ] All webhooks idempotent: processing same event twice doesn't create duplicates or re-send emails
- [ ] Stripe signature validation rejects tampered payloads (returns 400)
- [ ] Email/FCM failures don't fail webhook processing (logged separately)
- [ ] Payment failure email includes `ceolx.ie/account` link to update payment method

---

## Dependencies

- **Upstream**: M8-T1 (base webhook handler), M8-T2 (subscription status display), M7-T3 (Postmark email), M7-T1 (FCM)
- **Downstream**: M8-T4 (subscription management portal), M12 (launch checklist for Stripe config)
- **External services**: Stripe (webhook events), Postmark (email), Firebase FCM

---

## Technical Notes

### Extended Stripe Webhook Handler

```typescript
// apps/api/routes/webhooks/stripe.ts (extended)
import { Hono } from "hono";
import Stripe from "stripe";
import { db } from "@/db";
import { venueProfiles, venueSubscriptions, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/services/email";
import { fcmDispatcher } from "@/services/fcmDispatcher";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const router = new Hono();

router.post("/webhooks/stripe", async (c) => {
  const body = await c.req.text();
  const sig = c.req.header("stripe-signature");

  if (!sig) return c.json({ error: "No signature" }, 400);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return c.json({ error: "Invalid signature" }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice,
        );
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return c.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return c.json({ error: "Processing failed" }, 500);
  }
});

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
) {
  const { venueProfileId, userId } = session.metadata as any;

  await db
    .update(venueProfiles)
    .set({
      subscriptionStatus: "active",
      stripeCustomerId: session.customer as string,
      isActive: true,
    })
    .where(eq(venueProfiles.id, venueProfileId));

  await db.insert(venueSubscriptions).values({
    venueProfileId,
    stripeCustomerId: session.customer as string,
    stripeSubscriptionId: session.subscription as string,
    status: "active",
  });

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  const venue = await db.query.venueProfiles.findFirst({
    where: eq(venueProfiles.id, venueProfileId),
  });

  // Send confirmation email
  await sendEmail({
    to: user.email,
    templateAlias: "payment-confirmation",
    templateModel: {
      venueName: venue.name,
      Amount: "€29.99",
      PlanName: "CeolX Pro",
      ManageLink: "https://ceolx.ie/account",
    },
  }).catch((error) => console.error("Email send failed:", error));

  // Send FCM notification
  await fcmDispatcher
    .sendNotification({
      userId,
      title: "Subscription Activated ✓",
      body: "Your profile is now live. Start accepting bookings!",
      data: {
        persona: "venue",
        route: "/profile",
        action: "view_subscription",
      },
    })
    .catch((error) => console.error("FCM send failed:", error));
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // Find Venue
  const venue = await db.query.venueProfiles.findFirst({
    where: eq(venueProfiles.stripeCustomerId, customerId),
  });

  if (!venue) {
    console.warn(`No venue found for customer ${customerId}`);
    return;
  }

  // Update subscription and profile
  await db
    .update(venueSubscriptions)
    .set({
      status: "active",
      currentPeriodStart: new Date(invoice.period_start * 1000),
      currentPeriodEnd: new Date(invoice.period_end * 1000),
      updatedAt: new Date(),
    })
    .where(eq(venueSubscriptions.stripeCustomerId, customerId));

  await db
    .update(venueProfiles)
    .set({
      subscriptionStatus: "active",
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(venueProfiles.id, venue.id));

  // Get user for email
  const user = await db.query.users.findFirst({
    where: eq(users.id, venue.userId),
  });

  // Send confirmation email
  const amount = (invoice.amount_paid / 100).toFixed(2);
  const planName = invoice.lines.data[0]?.description || "CeolX Pro";

  await sendEmail({
    to: user.email,
    templateAlias: "payment-confirmation",
    templateModel: {
      venueName: venue.name,
      Amount: `€${amount}`,
      PlanName: planName,
      NextBillingDate: new Date(invoice.period_end * 1000)
        .toISOString()
        .split("T")[0],
      ManageLink: "https://ceolx.ie/account",
      InvoiceLink: invoice.hosted_invoice_url,
    },
  }).catch((error) => console.error("Email send failed:", error));

  // Send FCM notification
  await fcmDispatcher
    .sendNotification({
      userId: venue.userId,
      title: "Payment Received ✓",
      body: `Your subscription renewal of €${amount} has been processed`,
      data: {
        persona: "venue",
        route: "/profile",
        action: "view_subscription",
      },
    })
    .catch((error) => console.error("FCM send failed:", error));
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // Find Venue
  const venue = await db.query.venueProfiles.findFirst({
    where: eq(venueProfiles.stripeCustomerId, customerId),
  });

  if (!venue) {
    console.warn(`No venue found for customer ${customerId}`);
    return;
  }

  // Update subscription and profile
  await db
    .update(venueSubscriptions)
    .set({
      status: "past_due",
      updatedAt: new Date(),
    })
    .where(eq(venueSubscriptions.stripeCustomerId, customerId));

  await db
    .update(venueProfiles)
    .set({
      subscriptionStatus: "past_due",
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(venueProfiles.id, venue.id));

  // Get user for email
  const user = await db.query.users.findFirst({
    where: eq(users.id, venue.userId),
  });

  // Send failure email
  await sendEmail({
    to: user.email,
    templateAlias: "payment-failed",
    templateModel: {
      venueName: venue.name,
      ManageLink: "https://ceolx.ie/account",
    },
  }).catch((error) => console.error("Email send failed:", error));

  console.error(
    `Payment failed for venue ${venue.id}; subscription marked past_due`,
  );
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Find Venue
  const venue = await db.query.venueProfiles.findFirst({
    where: eq(venueProfiles.stripeCustomerId, customerId),
  });

  if (!venue) {
    console.warn(`No venue found for customer ${customerId}`);
    return;
  }

  // Update subscription and profile
  await db
    .update(venueSubscriptions)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(eq(venueSubscriptions.stripeCustomerId, customerId));

  await db
    .update(venueProfiles)
    .set({
      subscriptionStatus: "cancelled",
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(venueProfiles.id, venue.id));

  // Get user for email
  const user = await db.query.users.findFirst({
    where: eq(users.id, venue.userId),
  });

  // Send cancellation email
  await sendEmail({
    to: user.email,
    templateAlias: "subscription-cancelled",
    templateModel: {
      venueName: venue.name,
      ReactivateLink: "https://ceolx.ie/subscribe",
    },
  }).catch((error) => console.error("Email send failed:", error));

  console.log(`Subscription cancelled for venue ${venue.id}`);
}

export default router;
```

### Postmark Email Templates for Payment Failure & Cancellation

#### Payment Failed Template

- Subject: _"Payment Failed: Update Your Payment Method"_
- Body: _"Hi [VenueName], Your recent payment failed due to an issue with your payment method. Your subscription is temporarily paused. [Button: Update Payment Method] → ceolx.ie/account"_
- Instructions: "Stripe will retry your payment for up to 3 days. Update your card details above to ensure payment succeeds."

#### Subscription Cancelled Template

- Subject: _"Your CeolX Subscription Has Been Cancelled"_
- Body: _"Hi [VenueName], Your subscription has been cancelled. Your profile is no longer visible to artists. [Button: Reactivate] → ceolx.ie/subscribe"_
- Instructions: "If you'd like to reactivate, click the button above. All your past events and bookings are preserved."

---

## Webhook Payload Examples

### invoice.payment_succeeded

```json
{
  "type": "invoice.payment_succeeded",
  "data": {
    "object": {
      "id": "in_live_xxx",
      "customer": "cus_live_xxx",
      "amount_paid": 2999,
      "period_start": 1711324800,
      "period_end": 1714003200,
      "hosted_invoice_url": "https://invoice.stripe.com/...",
      "lines": {
        "data": [
          {
            "description": "CeolX Pro",
            "amount": 2999
          }
        ]
      }
    }
  }
}
```

### customer.subscription.deleted

```json
{
  "type": "customer.subscription.deleted",
  "data": {
    "object": {
      "id": "sub_live_xxx",
      "customer": "cus_live_xxx",
      "status": "cancelled"
    }
  }
}
```

---

## Common Gotchas

**Gotcha 1: Payment failure email never sent**

- Issue: Stripe `invoice.payment_failed` webhook not configured in Stripe Dashboard
- Fix: In Stripe settings, enable webhook event type `invoice.payment_failed` and add endpoint `/api/webhooks/stripe`

**Gotcha 2: Duplicate emails on webhook retry**

- Issue: Stripe retries webhook; webhook handler fires twice
- Fix: Use idempotent checks: verify `subscription_status` before updating; verify email hasn't been sent already (optional: log webhook ID)

**Gotcha 3: Profile never becomes visible after payment success**

- Issue: `is_active` not updated in `handleInvoicePaymentSucceeded`
- Fix: Ensure all event handlers set `is_active = true` when `subscription_status = 'active'`

**Gotcha 4: Cancellation shows old profile for 30 seconds**

- Issue: Mobile app polls every 30s; user sees stale `is_active = true` until next poll
- Fix: (Post-V1) Replace polling with WebSocket push from server on webhook completion

**Gotcha 5: Email template IDs not configured**

- Issue: `POSTMARK_PAYMENT_FAILED_TEMPLATE_ID` env var missing; send fails silently
- Fix: List all required template IDs in env vars and verify in deployment pipeline
