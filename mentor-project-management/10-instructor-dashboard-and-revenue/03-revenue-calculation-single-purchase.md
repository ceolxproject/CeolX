# Revenue Calculation: Single Purchase (70/30 Split)

## Description

Implement server-side revenue calculation logic for single course purchases. On successful payment (Stripe checkout.session.completed webhook), calculate the 70% instructor share and 30% platform share, record the earnings transaction, and handle refunds by clawing back the instructor's share if refund occurs before payout.

## Affected Apps/Packages

- Backend: `hono-api` service
- Database: earnings, transactions, refunds tables
- Payment Provider: Stripe (webhooks, refunds API)
- External Service: Stripe for payment and refund events

## API Endpoints & Webhooks

### POST /webhooks/stripe/checkout-session-completed

**Stripe webhook for successful course purchase**

**Request Body (Stripe Event):**

```json
{
  "id": "evt_1234567890",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_live_abcdef123456",
      "customer": "cus_abc123",
      "payment_intent": "pi_abc123",
      "amount_total": 9900,
      "currency": "usd",
      "metadata": {
        "courseId": "course-uuid-123",
        "instructorId": "instructor-uuid-456",
        "studentId": "student-uuid-789",
        "type": "single_purchase"
      },
      "status": "complete",
      "payment_status": "paid"
    }
  }
}
```

**Processing Logic:**

1. Verify webhook signature (Stripe secret key)
2. Extract metadata: courseId, instructorId, studentId
3. Validate course exists and is active
4. Validate instructor owns the course
5. Calculate 70/30 split
6. Create earnings record
7. Create enrollment record (if not exists)
8. Return 200 OK

**Response:**

```json
{
  "success": true,
  "transactionId": "txn-uuid-123",
  "status": "recorded"
}
```

---

### POST /webhooks/stripe/charge-refunded

**Stripe webhook for refund events**

**Request Body (Stripe Event):**

```json
{
  "id": "evt_refund_1234567890",
  "type": "charge.refunded",
  "data": {
    "object": {
      "id": "ch_abc123",
      "refunded": true,
      "amount_refunded": 9900,
      "amount": 9900,
      "currency": "usd",
      "metadata": {
        "checkout_session_id": "cs_live_abcdef123456"
      },
      "refund_reason": "requested_by_customer"
    }
  }
}
```

**Processing Logic:**

1. Verify webhook signature
2. Look up original checkout session from refund metadata
3. Find original earnings transaction
4. Check if earnings have already been paid out
5. If NOT paid out: Create refund transaction (negative amounts)
6. If paid out: Create "clawed back" transaction (account as debt to platform)
7. Update enrollment status (if applicable)
8. Notify instructor of refund via email
9. Return 200 OK

---

## Data Model

### earnings Table

```sql
CREATE TABLE earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES instructors(id),
  student_id UUID NOT NULL REFERENCES students(id),
  course_id UUID NOT NULL REFERENCES courses(id),

  -- Transaction identifiers
  transaction_id VARCHAR(64) UNIQUE NOT NULL,  -- Internal transaction ID
  stripe_charge_id VARCHAR(64),  -- Stripe charge ID from webhook
  stripe_payment_intent_id VARCHAR(64),  -- Payment intent ID

  -- Revenue breakdown
  gross_amount DECIMAL(10, 2) NOT NULL,  -- Total amount (USD)
  instructor_share DECIMAL(10, 2) NOT NULL,  -- 70% of gross
  platform_share DECIMAL(10, 2) NOT NULL,  -- 30% of gross

  -- Transaction classification
  type VARCHAR(32) NOT NULL DEFAULT 'single_purchase',  -- 'single_purchase', 'subscription', 'refund'
  status VARCHAR(32) NOT NULL DEFAULT 'pending',  -- 'pending', 'completed', 'refunded', 'clawed_back'

  -- Payout tracking
  payout_included BOOLEAN DEFAULT FALSE,  -- Included in a payout?
  payout_id UUID REFERENCES payouts(id),  -- Which payout (if any)
  payout_date TIMESTAMP NULL,  -- When paid out

  -- Refund handling
  original_transaction_id VARCHAR(64) NULL,  -- References transaction_id if this is a refund
  refund_reason VARCHAR(255) NULL,  -- 'customer_request', 'duplicate', 'fraud', etc.
  refunded_at TIMESTAMP NULL,  -- When refund was processed

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_split CHECK (
    instructor_share + platform_share = gross_amount
  ),
  CONSTRAINT valid_amounts CHECK (
    gross_amount > 0 AND instructor_share >= 0 AND platform_share >= 0
  )
);

-- Indexes for fast lookups
CREATE INDEX idx_earnings_instructor_id ON earnings(instructor_id);
CREATE INDEX idx_earnings_course_id ON earnings(course_id);
CREATE INDEX idx_earnings_student_id ON earnings(student_id);
CREATE INDEX idx_earnings_stripe_charge_id ON earnings(stripe_charge_id);
CREATE INDEX idx_earnings_payout_id ON earnings(payout_id);
CREATE INDEX idx_earnings_created_at ON earnings(created_at DESC);
CREATE UNIQUE INDEX idx_earnings_transaction_id ON earnings(transaction_id);
```

### Refunds Table (optional, for explicit tracking)

```sql
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Original transaction reference
  original_transaction_id VARCHAR(64) NOT NULL REFERENCES earnings(transaction_id),
  original_earnings_id UUID NOT NULL REFERENCES earnings(id),

  -- Refund transaction (created as earnings record)
  refund_earnings_id UUID NOT NULL REFERENCES earnings(id),

  -- Refund details
  stripe_refund_id VARCHAR(64) UNIQUE,
  gross_amount_refunded DECIMAL(10, 2) NOT NULL,
  instructor_share_refunded DECIMAL(10, 2) NOT NULL,
  platform_share_refunded DECIMAL(10, 2) NOT NULL,

  -- Refund classification
  reason VARCHAR(255),
  refund_method VARCHAR(32) DEFAULT 'original_payment_method',  -- original_payment_method, credit_account

  -- Status
  status VARCHAR(32) DEFAULT 'pending',  -- pending, completed, failed

  -- Timestamps
  requested_at TIMESTAMP,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_refund_amounts CHECK (
    gross_amount_refunded > 0 AND
    instructor_share_refunded > 0 AND
    platform_share_refunded > 0
  )
);

CREATE INDEX idx_refunds_original_transaction_id ON refunds(original_transaction_id);
CREATE INDEX idx_refunds_status ON refunds(status);
```

---

## Revenue Calculation Logic

### 70/30 Split Calculation

```typescript
// Calculation function
function calculateSinglePurchaseRevenue(grossAmount: number): {
  instructorShare: number;
  platformShare: number;
} {
  const instructorShare = grossAmount * 0.7;
  const platformShare = grossAmount * 0.3;

  return {
    instructorShare: Math.round(instructorShare * 100) / 100, // Round to 2 decimals
    platformShare: Math.round(platformShare * 100) / 100,
  };
}

// Example: $99 course
// instructorShare = 99 * 0.70 = $69.30
// platformShare = 99 * 0.30 = $29.70
```

### Transaction Creation on Payment Success

```typescript
async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  // 1. Extract metadata
  const { courseId, instructorId, studentId, type } = session.metadata as {
    courseId: string;
    instructorId: string;
    studentId: string;
    type: string;
  };

  // 2. Validate prerequisites
  const course = await db.courses.findById(courseId);
  if (!course) throw new Error("Course not found");

  if (course.instructor_id !== instructorId) {
    throw new Error("Instructor mismatch");
  }

  if (type !== "single_purchase") {
    throw new Error("Invalid transaction type");
  }

  // 3. Calculate revenue split
  const grossAmount = session.amount_total / 100; // Stripe amount is in cents
  const { instructorShare, platformShare } =
    calculateSinglePurchaseRevenue(grossAmount);

  // 4. Create earnings record
  const transactionId = `txn-${uuidv4()}`;

  await db.earnings.create({
    instructor_id: instructorId,
    student_id: studentId,
    course_id: courseId,
    transaction_id: transactionId,
    stripe_charge_id: session.payment_intent,
    stripe_payment_intent_id: session.payment_intent,
    gross_amount: grossAmount,
    instructor_share: instructorShare,
    platform_share: platformShare,
    type: "single_purchase",
    status: "completed",
    payout_included: false,
    created_at: new Date(),
  });

  // 5. Create or update enrollment
  const enrollment = await db.enrollments.findOrCreate({
    student_id: studentId,
    course_id: courseId,
    purchase_type: "single_purchase",
    stripe_session_id: session.id,
    enrolled_at: new Date(),
  });

  // 6. Emit event for downstream processing
  await eventBus.emit("earnings.recorded", {
    earningsId: transactionId,
    courseId,
    instructorId,
    studentId,
    amount: instructorShare,
  });

  return { success: true, transactionId };
}
```

---

### Refund Handling

```typescript
async function handleChargeRefunded(event: Stripe.Event) {
  const charge = event.data.object as Stripe.Charge;

  // 1. Lookup original transaction
  const originalEarnings = await db.earnings.findByStripeChargeId(charge.id);

  if (!originalEarnings) {
    console.error("Original transaction not found for charge:", charge.id);
    // Log and return - may be a duplicate webhook
    return { success: false, reason: "Original transaction not found" };
  }

  // 2. Check if already paid out
  const isPaidOut = originalEarnings.payout_id !== null;

  // 3. Create refund earnings record
  const refundTransactionId = `refund-${uuidv4()}`;
  const grossRefundAmount = charge.amount_refunded / 100;

  const { instructorShare, platformShare } =
    calculateSinglePurchaseRevenue(grossRefundAmount);

  const refundStatus = isPaidOut ? "clawed_back" : "refunded";

  const refundEarnings = await db.earnings.create({
    instructor_id: originalEarnings.instructor_id,
    student_id: originalEarnings.student_id,
    course_id: originalEarnings.course_id,
    transaction_id: refundTransactionId,
    stripe_charge_id: charge.id,
    gross_amount: -grossRefundAmount, // Negative amount
    instructor_share: -instructorShare, // Negative share
    platform_share: -platformShare, // Negative share
    type: "refund",
    status: refundStatus,
    original_transaction_id: originalEarnings.transaction_id,
    refund_reason: charge.refund_reason || "unknown",
    refunded_at: new Date(),
    payout_included: isPaidOut, // Include in accounting
  });

  // 4. Update original earnings status
  await db.earnings.update(originalEarnings.id, {
    status: isPaidOut ? "clawed_back" : "refunded",
    updated_at: new Date(),
  });

  // 5. Handle enrollment (optional: remove or mark as cancelled)
  if (!isPaidOut) {
    await db.enrollments.update(
      {
        student_id: originalEarnings.student_id,
        course_id: originalEarnings.course_id,
      },
      {
        status: "refunded",
        refunded_at: new Date(),
      },
    );
  }

  // 6. Notify instructor
  await notificationService.send({
    instructorId: originalEarnings.instructor_id,
    type: "refund_processed",
    data: {
      courseName: originalEarnings.course.name,
      amount: instructorShare,
      clawedBack: isPaidOut,
      studentName: originalEarnings.student.name,
    },
  });

  // 7. Log event
  await eventBus.emit("refund.processed", {
    originalTransactionId: originalEarnings.transaction_id,
    refundTransactionId,
    instructorId: originalEarnings.instructor_id,
    amount: instructorShare,
    isPaidOut,
  });

  return {
    success: true,
    refundTransactionId,
    clawedBack: isPaidOut,
  };
}
```

---

## Requirements

### Webhook Security

1. **Signature Verification**: Verify all Stripe webhook signatures using Stripe secret key
   - Use `stripe.webhooks.constructEvent()` to validate
   - Reject unsigned or invalid requests (return 403)

2. **Idempotency**: Handle duplicate webhooks gracefully
   - Check if transaction_id already exists before creating new record
   - Return success if duplicate detected
   - Use database unique constraint on transaction_id

3. **Timeout Handling**: Implement retry logic for transient failures
   - If database write fails, return 500 to trigger Stripe retry
   - Implement exponential backoff for max 3 retries

### Data Integrity

1. **Decimal Precision**: Always use decimal/numeric types for currency
2. **Split Validation**: Database constraint ensures instructor_share + platform_share = gross_amount
3. **Amount Validation**: Ensure all amounts are positive (except refunds which are negative)
4. **Atomic Transactions**: Wrap earnings creation + enrollment in database transaction

### Refund Scenarios

1. **Refund Before Payout**: Remove pending earnings, update enrollment to refunded
2. **Refund After Payout**: Create clawed-back transaction, flag for next settlement with platform
3. **Partial Refund**: Handle partial refunds (rare for course purchases, but prepare for it)
4. **Multiple Refunds**: Support multiple refunds for same original transaction

### Reconciliation

1. Track all refunds with Stripe refund ID for reconciliation
2. Prepare monthly reconciliation report comparing:
   - Earnings table sum vs Stripe charges API
   - Refunds table sum vs Stripe refunds API
   - Expected payouts vs actual payouts

---

## Acceptance Criteria

- [ ] Webhook endpoint validates Stripe signature before processing
- [ ] Duplicate webhooks are handled idempotently (no duplicate earnings records)
- [ ] Single purchase revenue calculation correctly applies 70/30 split
- [ ] Earnings record created with correct gross_amount, instructor_share, platform_share
- [ ] Constraint checks: instructor_share + platform_share = gross_amount
- [ ] Enrollment created or updated when earnings recorded
- [ ] Enrollment status reflects transaction type (active for new, refunded for refunds)
- [ ] Refund webhook processes and creates refund earnings record
- [ ] Refund creates negative amounts (not separate refund_amount field)
- [ ] Refund before payout: earnings removed, enrollment marked refunded
- [ ] Refund after payout: clawed_back status set, tracked for settlement
- [ ] Instructor notified of refund via email
- [ ] Stripe charge ID and payment intent ID stored for reconciliation
- [ ] Webhook returns 200 OK for successful processing
- [ ] Webhook returns 500 if database write fails (triggers Stripe retry)
- [ ] Webhook returns 403 if signature verification fails
- [ ] Idempotency key implementation prevents duplicate processing
- [ ] Database indexes optimize lookup by instructor_id, course_id, stripe_charge_id
- [ ] Revenue calculations are accurate to 2 decimal places
- [ ] Refund reason captured and stored
- [ ] Partial refunds supported (edge case)
- [ ] Monthly reconciliation report can be generated

## Dependencies

- **Milestone**: Database Schema (02-database-schema) - earnings, refunds, enrollments tables
- **Milestone**: Payments Integration (08-payments-and-subscriptions) - Stripe setup
- **External Service**: Stripe Webhooks API
- **Event System**: Event bus or async job queue for notifications

## Technical Notes

### Webhook Endpoint Implementation

```typescript
// Express/Hono middleware for Stripe webhook
import { Stripe } from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

app.post("/webhooks/stripe", async (c) => {
  const signature = c.req.header("stripe-signature");
  const body = await c.req.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature!, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return c.json({ error: "Signature verification failed" }, 403);
  }

  // Route to specific handler
  switch (event.type) {
    case "checkout.session.completed":
      return await handleCheckoutSessionCompleted(event);
    case "charge.refunded":
      return await handleChargeRefunded(event);
    default:
      console.log("Unhandled event type:", event.type);
      return c.json({ received: true });
  }
});
```

### Stripe Metadata Design

Include in Stripe checkout session metadata:

```javascript
stripe.checkout.sessions.create({
  line_items: [...],
  metadata: {
    courseId: course.id,
    instructorId: course.instructor_id,
    studentId: student.id,
    type: "single_purchase",
  },
});
```

### Error Handling

- **Database Unique Constraint Violation**: Log as potential duplicate, return 200 (idempotent)
- **Course Not Found**: Log error, return 400 (invalid checkout metadata)
- **Instructor Mismatch**: Log security event, return 403
- **Database Timeout**: Return 500 to trigger webhook retry

### Monitoring & Observability

- Log all webhook events with event ID and timestamp
- Monitor webhook latency (should be < 1s)
- Alert on repeated webhook failures
- Track refund rate and revenue impact
- Daily reconciliation check: sum(earnings) == Stripe charges total

### Future Enhancements

1. Support partial refunds (courses refund less than full amount)
2. Refund windows (e.g., 30-day refund guarantee)
3. Platform refund policy configuration (% back to instructor varies by policy)
4. Bulk refund processing for course withdrawals
5. Refund reversal (instructor disputes refund)
