# Task 8: Stripe Webhook Handlers

## Description

Implement comprehensive Stripe webhook event handlers for all payment and subscription events. Webhook handlers process Stripe events, verify signatures, update local database state, and maintain synchronization between Stripe (source of truth) and the app's database. This task ensures all payment state changes are captured and reflected immediately.

## Affected Apps/Packages

- **Backend**: Hono API service (`packages/api`)
- **Database**: `subscriptions`, `purchases`, `payments`, `users` tables
- **Queue**: Job queue for async processing (optional, for high-volume)

## API Endpoints

### POST /api/v1/webhooks/stripe

Stripe webhook endpoint for receiving events.

**Request** (sent from Stripe):

```
POST /api/v1/webhooks/stripe
Headers:
  Content-Type: application/json
  stripe-signature: t=1614556800,v1=abcdef123456...,v0=oldformat

Body: (raw)
{
  "id": "evt_1H5eSaI50VqksJqJ...",
  "object": "event",
  "api_version": "2024-12-18.acacia",
  "created": 1614556800,
  "data": {
    "object": {
      "id": "cs_test_a1K2p3L4...",
      "object": "checkout.session",
      ...
    },
    "previous_attributes": {}
  },
  "livemode": false,
  "pending_webhooks": 1,
  "request": {
    "id": null,
    "idempotency_key": "12345"
  },
  "type": "checkout.session.completed"
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "eventId": "evt_1H5eSaI50VqksJqJ...",
  "eventType": "checkout.session.completed"
}
```

**Error Response (401 Unauthorized)**:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_SIGNATURE",
    "message": "Webhook signature verification failed"
  }
}
```

**Error Response (400 Bad Request)**:

```json
{
  "success": false,
  "error": {
    "code": "PROCESSING_ERROR",
    "message": "Failed to process webhook event"
  }
}
```

## Requirements

### Webhook Signature Verification

1. **Signature Verification Implementation**:
   - Extract `stripe-signature` header from request
   - Read raw request body (as string, not parsed JSON)
   - Use `stripe.webhooks.constructEvent()` to verify and parse
   - This method handles verification internally
   - Returns parsed event object if valid
   - Throws error if signature invalid

2. **Verification Code Example**:

```typescript
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function handleWebhook(rawBody: string, signature: string) {
  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );

    // Event is verified and parsed
    await processEvent(event);

    return { success: true, eventId: event.id };
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    throw new Error("Invalid signature");
  }
}
```

3. **Error Handling**:
   - Invalid signature: Return 401
   - Verification error: Return 400
   - Processing error: Return 500 but still return 200 to Stripe (for retry)

### Webhook Events to Handle

1. **checkout.session.completed**
   - Triggered when: Payment successful, user ready to be redirected
   - Action: Verify payment session, mark session as completed
   - Database: Update checkout_sessions table
   - Log: Record successful checkout

2. **invoice.paid**
   - Triggered when: Subscription payment received
   - Action: Update subscription status, record payment
   - Database: Update subscriptions.status, create payment record
   - Log: Record successful payment

3. **invoice.payment_failed**
   - Triggered when: Subscription payment fails (retry pending)
   - Action: Update subscription status, notify user, track retry
   - Database: Update subscriptions.status, create payment record with failure info
   - Log: Record payment failure

4. **customer.subscription.created**
   - Triggered when: New subscription created (during checkout.session.completed)
   - Action: Create subscription record, link to user
   - Database: Create subscriptions record, update user.stripe_customer_id
   - Log: Record new subscription

5. **customer.subscription.updated**
   - Triggered when: Subscription details changed (upgrade/downgrade, cancel, etc.)
   - Action: Update subscription record with new details
   - Database: Update subscriptions table with new plan, status, billing dates
   - Log: Record subscription change with type (upgraded, downgraded, canceled, etc.)

6. **customer.subscription.deleted**
   - Triggered when: Subscription canceled after billing period
   - Action: Mark subscription as inactive, record cancellation
   - Database: Update subscriptions.status to 'canceled', set canceled_at
   - Log: Record subscription cancellation

7. **charge.refunded**
   - Triggered when: One-time purchase refunded
   - Action: Track refund, update purchase record
   - Database: Record refund in payments table, update purchase.refunded_amount
   - Log: Record refund

### Event Processing Logic

#### checkout.session.completed

```typescript
async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  // Verify payment succeeded
  if (session.payment_status !== "paid") {
    console.warn("Checkout session not paid:", session.id);
    return; // Ignore, will be paid later
  }

  // Get checkout session from database
  const checkoutSession = await db.query(
    "SELECT * FROM checkout_sessions WHERE stripe_session_id = ?",
    [session.id],
  );

  if (!checkoutSession) {
    console.error("Checkout session not found in DB:", session.id);
    return; // Log but don't error (idempotency)
  }

  // Determine if subscription or one-time purchase
  if (session.subscription) {
    // Subscription: handled by customer.subscription.created
  } else if (session.payment_intent) {
    // One-time purchase: create purchase record
    const purchase = await createPurchaseFromCheckout(session, checkoutSession);
    // Grant course access
    await grantCourseAccess(checkoutSession.user_id, checkoutSession.course_id);
    // Enqueue receipt email (optional)
    await sendPurchaseConfirmationEmail(purchase);
  }

  // Mark checkout session as completed
  await db.query(
    "UPDATE checkout_sessions SET status = ?, processed_at = ? WHERE id = ?",
    ["paid", new Date(), checkoutSession.id],
  );
}
```

#### invoice.paid

```typescript
async function handleInvoicePaid(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;

  if (!invoice.subscription) {
    return; // Not subscription invoice
  }

  // Update subscription status
  await db.query(
    "UPDATE subscriptions SET status = ?, updated_at = ? WHERE stripe_subscription_id = ?",
    ["active", new Date(), invoice.subscription],
  );

  // Create payment record
  const payment = await db.query(
    "INSERT INTO payments (user_id, type, status, amount, stripe_invoice_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [
      invoice.customer_email,
      "subscription",
      "succeeded",
      invoice.amount_paid,
      invoice.id,
      new Date(invoice.created * 1000),
    ],
  );

  // Send payment confirmation email
  await sendPaymentConfirmationEmail(invoice);
}
```

#### invoice.payment_failed

```typescript
async function handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;

  if (!invoice.subscription) {
    return; // Not subscription invoice
  }

  // Update subscription to past_due
  await db.query(
    "UPDATE subscriptions SET status = ?, updated_at = ? WHERE stripe_subscription_id = ?",
    ["past_due", new Date(), invoice.subscription],
  );

  // Create payment failure record
  await db.query(
    "INSERT INTO payments (type, status, stripe_invoice_id, failure_reason) VALUES (?, ?, ?, ?)",
    [
      "subscription",
      "failed",
      invoice.id,
      invoice.last_finalization_error?.code,
    ],
  );

  // Notify user of payment failure
  await sendPaymentFailureNotification(invoice);
}
```

#### customer.subscription.created

```typescript
async function handleCustomerSubscriptionCreated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;

  // Get user by Stripe customer ID
  const user = await db.query(
    "SELECT id FROM users WHERE stripe_customer_id = ?",
    [subscription.customer],
  );

  if (!user) {
    console.error("User not found for Stripe customer:", subscription.customer);
    return;
  }

  // Create subscription record
  await db.query(
    `INSERT INTO subscriptions (
      user_id, stripe_subscription_id, stripe_customer_id,
      plan_id, status, current_period_start, current_period_end,
      trial_end, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      subscription.id,
      subscription.customer,
      getPlanIdFromPrice(subscription.items.data[0].price.id),
      subscription.status,
      new Date(subscription.current_period_start * 1000),
      new Date(subscription.current_period_end * 1000),
      subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      new Date(),
      new Date(),
    ],
  );

  // Grant course access for subscription
  await grantSubscriptionAccess(user.id);

  // Send welcome email
  await sendSubscriptionWelcomeEmail(user, subscription);
}
```

#### customer.subscription.updated

```typescript
async function handleCustomerSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const previousAttributes = event.data.previous_attributes || {};

  // Determine what changed
  const planChanged = previousAttributes.items !== undefined;
  const canceledChanged = previousAttributes.cancel_at_period_end !== undefined;

  // Update subscription record
  await db.query(
    `UPDATE subscriptions SET
      plan_id = ?, status = ?, current_period_start = ?,
      current_period_end = ?, cancel_at_period_end = ?, updated_at = ?
      WHERE stripe_subscription_id = ?`,
    [
      getPlanIdFromPrice(subscription.items.data[0].price.id),
      subscription.status,
      new Date(subscription.current_period_start * 1000),
      new Date(subscription.current_period_end * 1000),
      subscription.cancel_at_period_end,
      new Date(),
      subscription.id,
    ],
  );

  // Handle plan change
  if (planChanged) {
    const oldPlan = getPlanIdFromPrice(
      previousAttributes.items.data[0].price.id,
    );
    const newPlan = getPlanIdFromPrice(subscription.items.data[0].price.id);
    await sendSubscriptionChangedEmail(subscription, oldPlan, newPlan);
  }

  // Handle cancellation
  if (canceledChanged && subscription.cancel_at_period_end) {
    await sendSubscriptionCancelationScheduledEmail(subscription);
  }
}
```

#### customer.subscription.deleted

```typescript
async function handleCustomerSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;

  // Update subscription as canceled
  await db.query(
    `UPDATE subscriptions SET status = ?, canceled_at = ?, updated_at = ?
     WHERE stripe_subscription_id = ?`,
    ["canceled", new Date(), new Date(), subscription.id],
  );

  // Revoke subscription access (but keep purchased course access)
  await revokeSubscriptionAccess(subscription.customer);

  // Send cancellation confirmation email
  await sendSubscriptionCanceledEmail(subscription);
}
```

#### charge.refunded

```typescript
async function handleChargeRefunded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;

  // Find purchase associated with charge
  const purchase = await db.query(
    "SELECT * FROM purchases WHERE stripe_payment_intent_id = ?",
    [charge.payment_intent],
  );

  if (!purchase) {
    console.warn("Purchase not found for refunded charge:", charge.id);
    return;
  }

  // Update purchase with refund
  await db.query(
    "UPDATE purchases SET status = ?, refunded_at = ? WHERE id = ?",
    ["refunded", new Date(), purchase.id],
  );

  // Create refund record in payments table
  await db.query(
    "INSERT INTO payments (user_id, type, status, amount, refund_amount, stripe_charge_id) VALUES (?, ?, ?, ?, ?, ?)",
    [
      purchase.user_id,
      "purchase",
      "refunded",
      purchase.amount,
      charge.amount_refunded,
      charge.id,
    ],
  );

  // Revoke course access (refunded purchase)
  await revokeCourseAccess(purchase.user_id, purchase.course_id);

  // Send refund notification email
  await sendRefundNotificationEmail(purchase);
}
```

### Idempotency Implementation

1. **Event ID Tracking**:

   ```sql
   CREATE TABLE webhook_events (
     id UUID PRIMARY KEY,
     stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
     event_type VARCHAR(100) NOT NULL,
     processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **Check Before Processing**:

   ```typescript
   async function processEvent(event: Stripe.Event) {
     // Check if already processed
     const existing = await db.query(
       "SELECT id FROM webhook_events WHERE stripe_event_id = ?",
       [event.id],
     );

     if (existing) {
       console.log("Event already processed:", event.id);
       return; // Idempotent - return success
     }

     // Process event
     await handleEventType(event);

     // Record processed event
     await db.query(
       "INSERT INTO webhook_events (stripe_event_id, event_type) VALUES (?, ?)",
       [event.id, event.type],
     );
   }
   ```

3. **Database Constraints**:
   - Unique index on stripe_event_id prevents duplicate processing
   - Idempotent operations (UPDATE instead of INSERT, check exists before insert)

### Async Processing (Optional for Scale)

For high-volume deployments, consider async processing:

1. **Webhook Receives Event**:
   - Verify signature
   - Enqueue event to job queue (Redis Queue, Bull, etc.)
   - Return 200 immediately

2. **Worker Processes Event**:
   - Retrieve event from queue
   - Process event (update DB, send emails, etc.)
   - Retry on failure (3 attempts recommended)
   - Dead-letter queue for failed events

3. **Benefits**:
   - Webhook endpoint returns quickly (< 1 second)
   - Prevents timeout if processing slow
   - Can retry failed events
   - Scales with worker processes

### Error Handling and Logging

1. **Always Return 200 to Stripe**:
   - Return 200 OK even if processing fails
   - Stripe will retry on non-2xx responses
   - Log error but don't return error to Stripe

2. **Detailed Logging**:

   ```typescript
   logger.info("Webhook received", {
     eventId: event.id,
     eventType: event.type,
     timestamp: new Date().toISOString(),
   });

   logger.info("Webhook processed successfully", {
     eventId: event.id,
     eventType: event.type,
     processingTimeMs: Date.now() - startTime,
   });

   logger.error("Webhook processing failed", {
     eventId: event.id,
     eventType: event.type,
     error: error.message,
     stack: error.stack,
   });
   ```

3. **Error Retry Strategy**:
   - Stripe retries webhook for 3 days on non-2xx response
   - Max 5 attempts per event
   - Exponential backoff: 5 min, 30 min, 2 hours, 5 hours, 10 hours

### Testing

1. **Manual Testing in Stripe Dashboard**:
   - Developers → Webhooks → Select endpoint → Send test event
   - Choose event type and send
   - Verify database updates reflect test event

2. **Integration Testing**:
   - Mock Stripe API responses
   - Simulate webhook events
   - Verify database state changes
   - Verify emails sent (mock email service)

3. **Signature Verification Testing**:
   - Test with valid signature (should succeed)
   - Test with invalid signature (should return 401)
   - Test with missing signature (should return 401)

## Acceptance Criteria

- [ ] POST /api/v1/webhooks/stripe endpoint implemented
- [ ] Stripe signature verification implemented using stripe.webhooks.constructEvent()
- [ ] Invalid signature returns 401 INVALID_SIGNATURE
- [ ] Raw request body passed to signature verification (not parsed JSON)
- [ ] checkout.session.completed event handler implemented
- [ ] invoice.paid event handler implemented
- [ ] invoice.payment_failed event handler implemented
- [ ] customer.subscription.created event handler implemented
- [ ] customer.subscription.updated event handler implemented
- [ ] customer.subscription.deleted event handler implemented
- [ ] charge.refunded event handler implemented
- [ ] Subscription records created/updated in database from webhooks
- [ ] Purchase records created in database from checkout completion
- [ ] Payment records created in database from invoices and charges
- [ ] Failed payment records tracked with retry information
- [ ] Refund records tracked with refund amounts
- [ ] User access granted/revoked based on subscription status
- [ ] Purchased courses accessible after successful one-time purchase
- [ ] Subscription-accessible courses granted access on subscription creation
- [ ] Course access revoked on subscription cancellation or refund
- [ ] Idempotency implemented: duplicate events processed only once
- [ ] webhook_events table tracks processed events by stripe_event_id
- [ ] Subscription status correctly transitions: trialing → active, active → past_due, etc.
- [ ] Plan upgrades/downgrades reflected in subscription records
- [ ] Cancellation scheduled (cancel_at_period_end) properly tracked
- [ ] All database updates happen via webhook processing (Stripe is source of truth)
- [ ] Error handling returns 200 to Stripe (for retry) but logs failures
- [ ] Detailed logging for all webhook events
- [ ] Email notifications sent on key events:
  - [ ] Payment success
  - [ ] Payment failure
  - [ ] Subscription created
  - [ ] Plan changed
  - [ ] Subscription canceled
  - [ ] Refund processed
- [ ] All webhook events tested in Stripe test mode
- [ ] Database transactions ensure atomicity of updates
- [ ] Unit tests cover event parsing and handler logic
- [ ] Integration tests verify full webhook flow with database changes
- [ ] API documentation includes webhook event types and handling logic

## Dependencies

- Task 1: Stripe Billing Setup (webhook registration)
- Tasks 2-5: API implementations (data to process)
- Milestone 2: Database schema for subscriptions, purchases, payments

## Technical Notes

### Webhook Processing Checklist

1. Verify signature (fail if invalid)
2. Check idempotency (skip if already processed)
3. Log event received
4. Process specific event type
5. Update database atomically
6. Send notifications (emails)
7. Record processed event
8. Log completion
9. Return 200 OK

### Database Update Best Practices

1. Use transactions for multi-table updates
2. Verify record exists before updating (log if not found)
3. Update `updated_at` timestamp
4. Use database constraints to prevent invalid states
5. Test edge cases (missing records, concurrent updates)

### Event Ordering Issues

- Webhooks may arrive out of order (use timestamps to detect)
- Always check previous state before updating
- Use idempotency for safety

### Monitoring and Alerts

1. Alert on webhook processing failures
2. Monitor webhook latency (< 1 second recommended)
3. Track event processing success rate
4. Monitor database transaction failures
5. Track unprocessed events in dead-letter queue

### Stripe Webhook Security

1. Always verify signature (mandatory)
2. Never trust data before verification
3. Use HTTPS for webhook endpoint
4. Rotate webhook secret periodically
5. Monitor webhook endpoint for unusual activity
