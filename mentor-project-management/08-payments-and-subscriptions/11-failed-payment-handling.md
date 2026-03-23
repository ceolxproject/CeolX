# Task 11: Failed Payment Handling and Recovery

## Description

Implement failed payment recovery workflow with Stripe Smart Retries. Handle failed subscription charges with automatic retry logic (3 attempts over 7 days), in-app and email notifications on each failure, access suspension after final failure, and payment method update flow for recovery. This task minimizes involuntary churn and recovers failed payments.

## Affected Apps/Packages

- **Backend**: Hono API service (`packages/api`)
- **Database**: `subscriptions`, `payments`, `payment_attempts` tables
- **Stripe Integration**: Stripe Invoice and Subscription management
- **Notifications**: Email and in-app notification system

## API Endpoints

### GET /api/v1/payments/failed

Get failed payment details for authenticated user.

**Request**:

```
GET /api/v1/payments/failed?includeRetryAttempts=true
Headers:
  Authorization: Bearer {user_jwt_token}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "hasFailedPayment": true,
    "failedPayment": {
      "id": "payment_failed_123",
      "invoiceId": "in_1H5eSdI50VqksJqJ...",
      "subscriptionId": "sub_1H5eSdI50VqksJqJ...",
      "amount": 9990,
      "currency": "EUR",
      "formattedAmount": "99.90 EUR",
      "originalDueDate": "2024-02-18T10:30:00Z",
      "failureReason": "card_declined",
      "failureCode": "card_declined",
      "failureMessage": "Your card was declined",
      "retryStatus": {
        "currentAttempt": 2,
        "totalAttempts": 3,
        "nextRetryDate": "2024-02-20T10:30:00Z",
        "finalRetryDate": "2024-02-25T10:30:00Z",
        "daysUntilFinalRetry": 7,
        "lastAttemptDate": "2024-02-19T10:30:00Z"
      },
      "subscriptionStatus": "past_due",
      "accessStatus": {
        "suspended": false,
        "message": "Access continues until payment successful or retries exhausted"
      }
    },
    "retryAttempts": [
      {
        "attempt": 1,
        "date": "2024-02-18T10:30:00Z",
        "status": "failed",
        "failureReason": "card_declined",
        "nextRetryDate": "2024-02-19T10:30:00Z"
      },
      {
        "attempt": 2,
        "date": "2024-02-19T10:30:00Z",
        "status": "failed",
        "failureReason": "card_declined",
        "nextRetryDate": "2024-02-20T10:30:00Z"
      }
    ],
    "paymentMethodNeeded": true,
    "updatePaymentUrl": "/api/v1/payments/update-method"
  }
}
```

**Error Response (204 No Failed Payment)**:

```json
{
  "success": true,
  "data": {
    "hasFailedPayment": false
  }
}
```

### POST /api/v1/payments/retry-payment

Manually trigger retry of failed payment (if user updates payment method).

**Request**:

```
POST /api/v1/payments/retry-payment
Headers:
  Content-Type: application/json
  Authorization: Bearer {user_jwt_token}

Body:
{
  "invoiceId": "in_1H5eSdI50VqksJqJ..."
}
```

**Response (200 OK - Success)**:

```json
{
  "success": true,
  "data": {
    "invoiceId": "in_1H5eSdI50VqksJqJ...",
    "retryStatus": "pending",
    "message": "Payment retry initiated. Your new payment method will be charged.",
    "confirmationDetails": {
      "amount": 9990,
      "currency": "EUR",
      "formattedAmount": "99.90 EUR",
      "processingTime": "Within 24 hours"
    }
  }
}
```

**Response (200 OK - Already Succeeded)**:

```json
{
  "success": true,
  "data": {
    "invoiceId": "in_1H5eSdI50VqksJqJ...",
    "status": "paid",
    "message": "Payment already successful. Thank you!"
  }
}
```

### POST /api/v1/payments/update-payment-method

Create Stripe Setup Intent for updating payment method.

**Request**:

```
POST /api/v1/payments/update-payment-method
Headers:
  Content-Type: application/json
  Authorization: Bearer {user_jwt_token}

Body:
{
  "returnUrl": "https://mentor.example.com/account/subscriptions"
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "setupIntentId": "seti_1H5eSdI50VqksJqJ...",
    "clientSecret": "seti_1H5eSdI50VqksJqJ..._secret_abcdef123456",
    "frontendSetupUrl": "https://mentor.example.com/update-payment-method?setup_intent=seti_1H5eSdI50VqksJqJ..."
  }
}
```

### GET /api/v1/notifications/failed-payment

Get failed payment notifications for in-app alert.

**Request**:

```
GET /api/v1/notifications/failed-payment
Headers:
  Authorization: Bearer {user_jwt_token}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "hasNotification": true,
    "notification": {
      "id": "notif_123",
      "type": "payment_failed",
      "severity": "warning", // or "critical" if suspended
      "title": "Payment Issue",
      "message": "Your payment of 99.90 EUR failed. Retrying automatically on Feb 20.",
      "details": {
        "amount": 9990,
        "dueDate": "2024-02-18",
        "nextRetryDate": "2024-02-20",
        "retryAttempt": 2,
        "totalAttempts": 3
      },
      "actions": [
        {
          "label": "Update Payment Method",
          "url": "/account/subscriptions",
          "primary": true
        },
        {
          "label": "View Details",
          "url": "/payments/failed-payment-details"
        }
      ],
      "dismissible": false,
      "createdAt": "2024-02-19T10:30:00Z"
    }
  }
}
```

## Requirements

### Stripe Smart Retries Configuration

1. **Retry Strategy Setup** (in Stripe Dashboard):
   - Navigate to Stripe → Settings → Billing Settings → Smart Retries (Dunning)
   - Enable Smart Retries for invoices
   - Configure retry schedule:
     - Attempt 1: Immediately on failure
     - Attempt 2: 3 days later
     - Attempt 3: 7 days after initial failure
   - Total window: 7 days max
   - After 3 failed attempts: Invoice marked as failed, subscription past_due

2. **Dunning Management** (optional advanced):
   - Configure dunning email templates (customizable)
   - Set retry email frequency
   - Configure hard decline handling

3. **Recovery Email Templates**:
   - Email 1 (immediate): "Payment Failed - We'll Retry Soon"
   - Email 2 (day 3): "Payment Still Pending - Update Your Card"
   - Email 3 (day 7): "Final Attempt - Your Access May Be Suspended"

### Failed Payment Detection

1. **Webhook Event Processing**:
   - Listen for `invoice.payment_failed` webhook
   - Store payment failure details
   - Track retry attempt count
   - Schedule next retry
   - Notify user

2. **Database Record**:

   ```sql
   CREATE TABLE payment_attempts (
     id UUID PRIMARY KEY,
     payment_id UUID NOT NULL REFERENCES payments(id),
     attempt_number INT NOT NULL,
     attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     status VARCHAR(50) NOT NULL, -- 'pending', 'success', 'failed'
     failure_code VARCHAR(50),
     failure_message VARCHAR(255),
     failure_reason VARCHAR(100),
     next_retry_date TIMESTAMP,
     charge_id VARCHAR(255),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   ALTER TABLE payments ADD COLUMN last_failed_at TIMESTAMP;
   ALTER TABLE payments ADD COLUMN final_retry_date TIMESTAMP;

   CREATE INDEX idx_payment_attempts_status ON payment_attempts(status);
   CREATE INDEX idx_payment_attempts_next_retry ON payment_attempts(next_retry_date);
   ```

3. **Subscription Status During Failure**:
   - Status: `past_due` (during retry period)
   - Subscription active but marked as at-risk
   - User retains access to courses
   - Access suspended only after final retry fails

### User Notifications

1. **In-App Notifications**:
   - Show prominent alert on dashboard
   - Display in notifications center
   - Include:
     - Amount and due date
     - Reason for failure
     - Next retry date
     - Action: Update payment method
   - Not dismissible until resolved or retries exhausted

2. **Email Notifications**:

   **First Failure Email** (Immediate):

   ```
   Subject: "Payment Failed - We'll Retry Soon"
   - Payment of 99.90 EUR failed
   - Reason: Card declined
   - We'll try again on Feb 20
   - Update payment method link
   - Action: Update card
   ```

   **Second Failure Email** (After attempt 2 fails):

   ```
   Subject: "Payment Still Pending - Update Your Card"
   - Previous payment retry failed
   - Your access continues while we retry
   - Final attempt: Feb 25
   - Action: Update payment method now
   - Consequences if no action taken
   ```

   **Final Notice Email** (Before attempt 3):

   ```
   Subject: "Final Payment Attempt - Your Access May Be Suspended"
   - Final retry attempt on Feb 25
   - If fails, access to courses will be suspended
   - Action: Update payment method immediately
   - Contact support link
   ```

   **Suspended Email** (After all attempts fail):

   ```
   Subject: "Subscription Suspended - Payment Failed"
   - All retry attempts failed
   - Subscription suspended
   - Access to courses suspended
   - Action: Update payment method to reactivate
   - Support contact info
   ```

3. **Notification Scheduling**:
   - Email 1: Immediately when invoice.payment_failed received
   - Email 2: On second failed attempt
   - Email 3: 1 day before final retry
   - Email 4: On final failure
   - In-app: Update at each milestone

### Payment Method Update Flow

1. **Stripe Setup Intent**:
   - When user needs to update payment method
   - Create Stripe SetupIntent (not PaymentIntent)
   - SetupIntent: Authorizes card without charging
   - Returns clientSecret for Stripe.js frontend

2. **Frontend Implementation**:
   - Call POST /api/v1/payments/update-payment-method
   - Receive setupIntentId and clientSecret
   - Use Stripe.js to collect card details
   - Confirm SetupIntent
   - Update default payment method on Stripe Customer
   - Trigger manual retry

3. **Automatic Retry After Update**:
   - When payment method updated, trigger immediate retry
   - Call Stripe API to retry invoice
   - If succeeds, notification: "Payment Successful!"
   - If fails, continue retry schedule

### Access Control During Failure

1. **During Retry Period** (status: past_due):
   - User retains full access to subscription courses
   - Banner on app: "Payment pending - update your card"
   - No restrictions on course access
   - Learning continues normally

2. **After Final Failure** (status: unpaid):
   - Access suspended to all subscription courses
   - User sees message: "Subscription suspended - update payment method"
   - One-time purchased courses still accessible
   - Provide prominent link to update payment method
   - All course launch blocked for subscription courses

3. **Reactivation on Success**:
   - When failed payment succeeds, access immediately restored
   - Subscription status: active
   - User notified: "Payment successful - access restored"
   - No action needed from user

### Database Schema

```sql
CREATE TABLE payments (
  -- ... existing fields ...
  last_failed_at TIMESTAMP,
  final_retry_date TIMESTAMP,
  status VARCHAR(50) NOT NULL, -- 'succeeded', 'failed', 'pending', 'refunded'
  failure_attempts INT DEFAULT 0
);

CREATE TABLE payment_attempts (
  id UUID PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(id),
  invoice_id VARCHAR(255),
  subscription_id UUID REFERENCES subscriptions(id),
  attempt_number INT NOT NULL,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) NOT NULL,
  failure_code VARCHAR(50),
  failure_message VARCHAR(255),
  failure_reason VARCHAR(100),
  next_retry_date TIMESTAMP,
  retry_triggered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_attempts_subscription ON payment_attempts(subscription_id);
CREATE INDEX idx_payment_attempts_next_retry ON payment_attempts(next_retry_date);
```

### Error Handling

1. **Failure Reasons** (from Stripe):
   - `card_declined`: Card issuer declined
   - `expired_card`: Card expired
   - `lost_card`: Card reported lost
   - `stolen_card`: Card reported stolen
   - `insufficient_funds`: Insufficient balance
   - `processing_error`: Error processing (retry likely to succeed)
   - `unknown`: Unknown error

2. **User-Friendly Messages**:
   - card_declined: "Your card was declined. Try another card."
   - expired_card: "Your card has expired. Update to a valid card."
   - insufficient_funds: "Insufficient funds. Check your account."
   - processing_error: "Temporary processing error. We'll retry soon."

### Testing

1. **Failed Payment Simulation**:
   - Use Stripe test card that triggers decline: `4000 0000 0000 0002`
   - Verify payment failure recorded
   - Verify retry scheduled
   - Verify notifications sent

2. **Retry Success**:
   - Simulate second attempt with valid card
   - Verify payment succeeds
   - Verify access restored
   - Verify notification sent

3. **All Retries Fail**:
   - Force all 3 attempts to fail
   - Verify access suspended
   - Verify suspension notification sent

## Acceptance Criteria

- [ ] Stripe Smart Retries configured with 3-attempt strategy over 7 days
- [ ] invoice.payment_failed webhook event processed
- [ ] Payment failure recorded with reason code and message
- [ ] Retry schedule calculated: day 0, day 3, day 7
- [ ] GET /api/v1/payments/failed returns failed payment details
- [ ] Failed payment includes retry attempt count and dates
- [ ] Failed payment shows subscription status (past_due)
- [ ] Failed payment shows access status (suspended or continuing)
- [ ] In-app notification displayed with failed payment alert
- [ ] Notification includes action: "Update Payment Method"
- [ ] Notification not dismissible until resolved
- [ ] Email notifications sent on correct schedule:
  - [ ] Immediate on first failure
  - [ ] On second failure
  - [ ] Before final attempt
  - [ ] On final failure
- [ ] Emails include clear amounts, dates, and action links
- [ ] POST /api/v1/payments/update-payment-method creates SetupIntent
- [ ] SetupIntent clientSecret returned for frontend
- [ ] Frontend can use Stripe.js to confirm SetupIntent
- [ ] Payment method updated on Stripe Customer after SetupIntent success
- [ ] POST /api/v1/payments/retry-payment triggers immediate retry
- [ ] Retry payment shows success/failure result
- [ ] Successful retry restores access immediately
- [ ] User access continues during retry period (status: past_due)
- [ ] User access suspended after final failure (status: unpaid)
- [ ] Subscription courses blocked when suspended
- [ ] One-time purchased courses remain accessible
- [ ] Prominent link provided to update payment method
- [ ] Database schema updated with payment_attempts table
- [ ] Retry attempts tracked with all details (attempt #, date, reason)
- [ ] Subscription status correctly reflects: past_due → unpaid
- [ ] All failure reasons mapped to user-friendly messages
- [ ] Payment notifications retrievable via GET /api/v1/notifications/failed-payment
- [ ] JWT authentication required for all payment endpoints
- [ ] All Stripe API calls properly logged
- [ ] Unit tests cover failure detection and notification logic
- [ ] Integration tests verify retry workflow with Stripe test mode
- [ ] Email delivery tests verify correct timing and content
- [ ] API documentation includes failed payment handling flow

## Dependencies

- Task 1: Stripe Billing Setup (Stripe configuration)
- Task 2: Subscription Plans API (subscription tracking)
- Task 8: Stripe Webhook Handlers (invoice.payment_failed processing)
- Milestone 2: Database schema for payments and subscriptions
- Milestone 4: User authentication (JWT validation)
- Notification system implementation

## Technical Notes

### Stripe Smart Retries Architecture

- Stripe handles all retry logic automatically
- App listens for webhook events
- App stores retry attempts for UI/notifications
- Stripe is source of truth for retry schedule

### Retry Schedule Example

- Invoice due: Feb 18, 2024 @ 10:30 AM
- Attempt 1: Feb 18, 2024 @ 10:30 AM (initial charge)
- Attempt 2: Feb 21, 2024 @ 10:30 AM (3 days later)
- Attempt 3: Feb 25, 2024 @ 10:30 AM (7 days after initial)
- If all fail: Invoice stays open, manual intervention needed

### Payment Intent vs Setup Intent

| Type          | Use Case            | Charges | Result                       |
| ------------- | ------------------- | ------- | ---------------------------- |
| PaymentIntent | Complete a payment  | Yes     | Payment processed            |
| SetupIntent   | Save card for later | No      | Card authorized, not charged |

### Access Control Implementation

```typescript
function canAccessSubscriptionCourses(
  user: User,
  subscription: Subscription
): boolean {
  // Check subscription status
  if (subscription.status === "unpaid") {
    return false; // Access suspended
  }

  if (subscription.status === "past_due") {
    return true; // Access continues during retry
  }

  if (subscription.status === "active" || subscription.status === "trialing") {
    return true; // Full access
  }

  return false;
}
```

### Monitoring and Alerts

1. Monitor payment failure rate by failure reason
2. Alert on high failure rates (>5%)
3. Track recovery rate (% of failed payments eventually recovered)
4. Monitor revenue impact of failures
5. Track churn due to payment failures

### Future Enhancements

1. **Smart Promos**: Offer discount to encourage payment method update
2. **Retention Dunning**: Show retention offers before suspension
3. **Multiple Payment Methods**: Allow backup cards
4. **Alternative Payment Methods**: Add wallet, ACH, etc.
5. **Custom Dunning Strategy**: Allow business rules to override Stripe defaults

### Compliance Notes

1. **PCI-DSS**: Never handle raw card data (use SetupIntent)
2. **Data Protection**: Don't store sensitive card details
3. **Accessibility**: Notifications accessible to users with disabilities
4. **GDPR**: Allow users to opt-out of certain emails (retention for dunning)

### Performance Optimization

1. Cache failed payment check (5 min TTL)
2. Index on subscription_id for quick lookup
3. Use background job for email scheduling
4. Batch notification queries for efficiency

### Logging and Audit Trail

```typescript
logger.warn("Payment failed", {
  invoiceId: invoice.id,
  subscriptionId: subscription.id,
  amount: invoice.amount_due,
  failureReason: invoice.last_finalization_error?.code,
  retryDate: nextRetryDate,
  attemptNumber: currentAttempt,
});
```
