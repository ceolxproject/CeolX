# Task 10: Subscription Cancellation

## Description

Implement subscription cancellation flow allowing users to cancel at the end of their current billing period while maintaining access until expiry. Include optional pre-cancellation survey, confirmation emails, and resubscription capability that restores previous progress. This task balances user choice with retention and ensures smooth offboarding.

## Affected Apps/Packages

- **Backend**: Hono API service (`packages/api`)
- **Database**: `subscriptions`, `surveys` tables
- **Stripe Integration**: Stripe Subscription cancellation API

## API Endpoints

### POST /api/v1/subscriptions/cancel

Cancel subscription at end of current billing period.

**Request**:

```
POST /api/v1/subscriptions/cancel
Headers:
  Content-Type: application/json
  Authorization: Bearer {user_jwt_token}

Body:
{
  "reason": "too_expensive", // optional, for survey
  "feedbackComment": "The price is higher than competitors", // optional
  "surveyResponses": {
    "would_you_return": "maybe",
    "missing_features": "offline downloads for mobile"
  } // optional
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_1H5eSdI50VqksJqJ...",
    "status": "active_until_period_end",
    "currentPlan": {
      "id": "annual",
      "name": "Premium Annual"
    },
    "accessDetails": {
      "accessUntil": "2025-02-18T10:30:00Z",
      "daysRemaining": 365,
      "message": "You have full access until your billing period ends."
    },
    "purchasedCoursesAccess": {
      "retained": true,
      "message": "Your purchased courses will remain permanently accessible."
    },
    "cancellationDetails": {
      "canceledAt": "2024-02-18T10:30:00Z",
      "canceledBy": "user",
      "scheduledCancellationDate": "2025-02-18T10:30:00Z"
    },
    "resubscriptionOption": {
      "available": true,
      "message": "You can resubscribe anytime and restore your progress."
    }
  }
}
```

**Error Response (400 No Subscription)**:

```json
{
  "success": false,
  "error": {
    "code": "NO_SUBSCRIPTION",
    "message": "User does not have an active subscription to cancel"
  }
}
```

**Error Response (400 Already Canceled)**:

```json
{
  "success": false,
  "error": {
    "code": "SUBSCRIPTION_ALREADY_CANCELED",
    "message": "Subscription is already scheduled for cancellation"
  }
}
```

### GET /api/v1/subscriptions/cancellation-survey

Retrieve cancellation survey questions (before cancel).

**Request**:

```
GET /api/v1/subscriptions/cancellation-survey
Headers:
  Authorization: Bearer {user_jwt_token}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "surveyId": "survey_12345",
    "title": "Help us improve",
    "description": "We'd like to know why you're canceling",
    "optional": true,
    "questions": [
      {
        "id": "q_reason",
        "type": "single_choice",
        "question": "What's the main reason you're canceling?",
        "options": [
          "too_expensive",
          "not_enough_content",
          "missing_features",
          "found_alternative",
          "other"
        ],
        "required": false
      },
      {
        "id": "q_would_return",
        "type": "single_choice",
        "question": "Would you consider returning if we made changes?",
        "options": ["yes", "maybe", "no"],
        "required": false
      },
      {
        "id": "q_missing_features",
        "type": "text",
        "question": "What features would make you stay?",
        "required": false
      }
    ]
  }
}
```

### GET /api/v1/subscriptions/cancellation-status

Get current cancellation status and access details.

**Request**:

```
GET /api/v1/subscriptions/cancellation-status
Headers:
  Authorization: Bearer {user_jwt_token}
```

**Response (200 OK - Canceled)**:

```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_1H5eSdI50VqksJqJ...",
    "isCanceledAtPeriodEnd": true,
    "currentStatus": "active_until_period_end",
    "canceledDate": "2024-02-18T10:30:00Z",
    "accessUntil": "2025-02-18T10:30:00Z",
    "daysRemaining": 365,
    "canReverseCancel": true,
    "reverseCancelUrl": "/api/v1/subscriptions/cancel-reversal"
  }
}
```

**Response (200 OK - Active)**:

```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_1H5eSdI50VqksJqJ...",
    "isCanceledAtPeriodEnd": false,
    "currentStatus": "active",
    "accessUntil": null,
    "daysRemaining": null,
    "canReverseCancel": false
  }
}
```

### POST /api/v1/subscriptions/cancel-reversal

Reverse a subscription cancellation (undo cancel before period end).

**Request**:

```
POST /api/v1/subscriptions/cancel-reversal
Headers:
  Content-Type: application/json
  Authorization: Bearer {user_jwt_token}

Body:
{
  "reason": "changed_my_mind" // optional
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_1H5eSdI50VqksJqJ...",
    "status": "active",
    "message": "Cancellation reversed. Your subscription continues.",
    "currentPlan": {
      "id": "annual",
      "name": "Premium Annual"
    },
    "nextBillingDate": "2025-02-18T10:30:00Z"
  }
}
```

### POST /api/v1/subscriptions/resubscribe

Resubscribe user after cancellation.

**Request**:

```
POST /api/v1/subscriptions/resubscribe
Headers:
  Content-Type: application/json
  Authorization: Bearer {user_jwt_token}

Body:
{
  "priceId": "price_1H5eSbI50VqksJqJ...",
  "planId": "annual"
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_1H5eSdI50VqksJqJ...",
    "status": "active",
    "plan": {
      "id": "annual",
      "name": "Premium Annual"
    },
    "progressRestored": {
      "restored": true,
      "message": "Your previous course progress has been restored."
    },
    "accessRestored": {
      "restored": true,
      "subscribedCourses": 12,
      "message": "Access to 12 courses restored."
    },
    "billingDetails": {
      "nextBillingDate": "2025-02-18T10:30:00Z",
      "billingPeriod": "annual",
      "amount": 9990,
      "currency": "EUR"
    }
  }
}
```

**Error Response (400 No Previous Subscription)**:

```json
{
  "success": false,
  "error": {
    "code": "NO_PREVIOUS_SUBSCRIPTION",
    "message": "User did not previously have a subscription"
  }
}
```

## Requirements

### Cancellation Implementation

1. **Cancellation at Period End**:
   - User initiates cancellation via API or Stripe Customer Portal
   - Subscription status set to `active` with `cancel_at_period_end = true`
   - Stripe automatically cancels at period end (via webhook)
   - No immediate charge removal
   - No access revocation until period end

2. **Stripe Cancellation**:

   ```typescript
   const subscription = await stripe.subscriptions.update(
     stripeSubscriptionId,
     {
       cancel_at_period_end: true,
       // Do not specify cancel_at, let Stripe auto-cancel at period end
     }
   );
   ```

3. **Access During Period**:
   - User retains full access to all subscription courses until period end
   - Subscription courses not accessible after period end
   - One-time purchased courses remain accessible permanently
   - Clear messaging: "You have access until X date"

4. **Database Updates**:
   - Update subscription.cancel_at_period_end = true
   - Create cancellation record with:
     - User ID
     - Subscription ID
     - Cancellation timestamp
     - Reason (optional)
     - Survey responses (optional)
   - Store in new `subscription_cancellations` table

### Pre-Cancellation Survey (Optional)

1. **Survey Delivery**:
   - Shown before user confirms cancellation
   - Optional (user can skip)
   - Helps understand churn reasons
   - Questions configurable in database

2. **Survey Questions** (Example):
   - Main reason for canceling (multiple choice)
   - Would you return if we made changes (yes/maybe/no)
   - What features would help (free text)
   - Overall satisfaction rating
   - Any other comments (free text)

3. **Survey Storage**:

   ```sql
   CREATE TABLE cancellation_surveys (
     id UUID PRIMARY KEY,
     subscription_id UUID NOT NULL REFERENCES subscriptions(id),
     user_id UUID NOT NULL REFERENCES users(id),
     survey_responses JSONB,
     feedback_comment TEXT,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

4. **Privacy and Compliance**:
   - Survey is optional (user can cancel without responding)
   - Responses used for analytics/retention only
   - No use for targeting or negative treatment
   - Clear privacy statement

### Confirmation Emails

1. **Cancellation Confirmation Email** (immediately):
   - Subject: "Your subscription has been scheduled for cancellation"
   - Details:
     - Current plan name
     - Access continues until X date (period end)
     - Purchased courses remain accessible
     - Option to undo cancellation via link
   - Call to action: Link to resubscribe later

2. **Final Notice Email** (7 days before expiration):
   - Subject: "Your Premium access is ending in 7 days"
   - Details:
     - Access ends on specific date
     - Courses no longer accessible after date
     - Purchased courses remain accessible
     - How to resubscribe

3. **Cancellation Complete Email** (at period end):
   - Subject: "Your Premium subscription has ended"
   - Details:
     - Subscription ended, courses no longer accessible
     - How to resubscribe
     - Any retention offers/discounts

### Cancel Reversal

1. **Reverse Before Period End**:
   - User can undo cancellation anytime before period end
   - Subscription returns to normal active state
   - Cancel_at_period_end set to false in Stripe
   - No additional charge (subscription continues normally)

2. **Stripe Reversal**:

   ```typescript
   const subscription = await stripe.subscriptions.update(
     stripeSubscriptionId,
     {
       cancel_at_period_end: false,
     }
   );
   ```

3. **User Experience**:
   - Easy 1-click reversal
   - Confirmation: "Cancellation reversed"
   - Option to manage subscription to make changes

### Resubscription After Cancellation

1. **Resubscription Eligibility**:
   - Only after subscription fully canceled
   - User must explicitly request resubscription
   - New billing cycle starts immediately
   - Same or different plan can be chosen

2. **Progress Restoration**:
   - Course enrollments restored (from cancelled subscription)
   - Learning progress restored (lessons completed, bookmarks, etc.)
   - All course data preserved
   - Appears as new subscription in billing history

3. **Access Restoration**:
   - All subscription-accessible courses restored
   - New subscription ID in Stripe
   - Same customer in Stripe (linked via customer ID)

4. **Pricing for Resubscription**:
   - Standard plan pricing applies
   - Free trial offered again (configurable)
   - No special discount needed (but can be offered)
   - Full charge for new period

5. **Database Updates**:
   - Create new subscription record
   - Link to customer's previous subscription history
   - Restore enrollments marked as from-subscription
   - Log resubscription event

### Database Schema

```sql
CREATE TABLE subscription_cancellations (
  id UUID PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  reason VARCHAR(100),
  canceled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scheduled_cancellation_date TIMESTAMP NOT NULL,
  survey_id UUID REFERENCES cancellation_surveys(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cancellation_surveys (
  id UUID PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  user_id UUID NOT NULL REFERENCES users(id),
  survey_responses JSONB,
  feedback_comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cancellations_user ON subscription_cancellations(user_id);
CREATE INDEX idx_cancellations_scheduled_date ON subscription_cancellations(scheduled_cancellation_date);
```

### Error Handling

1. **No Active Subscription**:
   - Return 400 `NO_SUBSCRIPTION`

2. **Already Canceled**:
   - Return 400 `SUBSCRIPTION_ALREADY_CANCELED`

3. **Unable to Contact Stripe**:
   - Return 500 `STRIPE_ERROR`
   - Log but allow DB update to continue (webhook will sync)

4. **No Previous Subscription**:
   - Return 400 when attempting resubscribe without prior subscription

### Security and Compliance

1. **User Verification**:
   - JWT authentication required
   - Users can only cancel their own subscriptions

2. **Audit Trail**:
   - Log all cancellations with timestamp and reason
   - Track resubscriptions

3. **Data Retention**:
   - Keep cancellation records for legal compliance
   - Keep survey data for analytics (anonymized after time)

4. **GDPR Compliance**:
   - Users can request data deletion after cancellation
   - Retain payment records per legal requirement
   - Survey data optional and user-controlled

### Testing Scenarios

1. Cancel active subscription
2. Verify access continues until period end
3. Reverse cancellation before period end
4. Complete cancellation (at period end via webhook)
5. Resubscribe after cancellation
6. Verify progress/access restored
7. Survey submission during cancellation
8. Cancel without survey
9. Verify emails sent at correct times
10. Prevent cancellation of already-canceled subscription

## Acceptance Criteria

- [ ] POST /api/v1/subscriptions/cancel endpoint implemented
- [ ] Cancellation only for active subscriptions
- [ ] Prevents cancellation if already canceled
- [ ] Stripe cancel_at_period_end set to true
- [ ] User retains access until period end
- [ ] Cancellation scheduled for period end (not immediate)
- [ ] GET /api/v1/subscriptions/cancellation-survey returns survey questions
- [ ] Survey questions configurable and optional
- [ ] Survey responses stored with cancellation
- [ ] Cancellation confirmation email sent immediately
- [ ] Final notice email sent 7 days before expiration
- [ ] Cancellation complete email sent at period end
- [ ] Emails include clear dates and resubscription options
- [ ] GET /api/v1/subscriptions/cancellation-status shows accurate status
- [ ] Shows cancel scheduled status and access until date
- [ ] Shows days remaining until access ends
- [ ] POST /api/v1/subscriptions/cancel-reversal reverses cancellation
- [ ] Cancel reversal sets cancel_at_period_end to false
- [ ] Reversal only available before period end
- [ ] POST /api/v1/subscriptions/resubscribe enables resubscription
- [ ] Resubscription creates new subscription with same customer
- [ ] Resubscription restores course enrollments
- [ ] Resubscription restores learning progress
- [ ] Resubscription offers free trial (if configurable)
- [ ] Resubscription charged normal plan price
- [ ] One-time purchased courses permanently accessible (not affected by cancellation)
- [ ] Database schema includes subscription_cancellations table
- [ ] Database schema includes cancellation_surveys table
- [ ] All cancellations tracked with timestamp and reason
- [ ] Survey responses stored as JSONB for flexibility
- [ ] Webhook integration confirms cancellation (customer.subscription.deleted)
- [ ] JWT authentication required for all endpoints
- [ ] Users can only manage their own subscriptions
- [ ] Error handling for invalid state transitions
- [ ] All Stripe API calls properly logged
- [ ] Unit tests cover cancellation, reversal, resubscription logic
- [ ] Integration tests verify Stripe subscription updates
- [ ] Email delivery tests verify correct timing and content
- [ ] API documentation includes endpoint specifications and examples

## Dependencies

- Task 1: Stripe Billing Setup (Stripe configuration)
- Task 2: Subscription Plans API (subscription tracking)
- Task 6: Stripe Customer Portal (users may cancel here too)
- Task 8: Stripe Webhook Handlers (confirm cancellation via webhooks)
- Milestone 2: Database schema for subscriptions
- Milestone 4: User authentication (JWT validation)
- Milestone 7: Video player and learning (course access, progress tracking)

## Technical Notes

### Stripe Cancellation vs Deletion

| Action                       | Stripe Behavior                         | Database Effect                   | Access Impact                |
| ---------------------------- | --------------------------------------- | --------------------------------- | ---------------------------- |
| `cancel_at_period_end: true` | Subscription auto-cancels at period end | `status: active_until_period_end` | Keep access until period end |
| `cancel_at: timestamp`       | Subscription cancels at specific date   | `status: active_until_date`       | Keep access until date       |
| `immediate_cancel` (delete)  | Subscription immediately canceled       | `status: canceled`                | Revoke access immediately    |

### Accessing Data After Cancellation

- Purchased courses: Always accessible (use purchase table)
- Subscription courses: Only while subscription active
- Progress/bookmarks: Always stored (even after subscription ends)
- Learning history: Retained for analytics

### Resubscription Data Flow

1. User cancels subscription → cancel_at_period_end = true
2. Period end reached → subscription.status = "canceled"
3. User calls resubscribe → New subscription created
4. Enrollments: Restore from previous subscription
5. Progress: User's previous progress preserved

### Email Scheduling

- Immediate: Cancellation confirmation (1 second after cancel)
- 7 days before: Final notice (scheduled job)
- At period end: Completion email (webhook-triggered)

```typescript
async function scheduleCancellationEmails(
  subscriptionId: string,
  periodEnd: Date
) {
  // Immediate email
  await sendCancellationConfirmationEmail(subscriptionId);

  // 7-day reminder
  const reminderDate = new Date(periodEnd);
  reminderDate.setDate(reminderDate.getDate() - 7);
  await scheduleEmail(subscriptionId, reminderDate, "cancellation_reminder");

  // Completion email (via webhook)
  // Triggered by customer.subscription.deleted event
}
```

### Survey Analytics

```sql
SELECT
  cancellation_reason,
  COUNT(*) as count,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM subscription_cancellations) as percentage
FROM subscription_cancellations
GROUP BY cancellation_reason
ORDER BY count DESC;
```

### Monitoring and Alerts

1. Track cancellation rate (churn %)
2. Monitor cancellation reasons from surveys
3. Alert on unusual cancellation spikes
4. Track resubscription rate (win-back)
5. Monitor cancellation email delivery

### Future Enhancements

1. **Retention Offers**: Show discount/incentives before cancellation
2. **Pause Instead of Cancel**: Allow 30-day pause instead of full cancel
3. **Win-Back Campaigns**: Special offers for recently-canceled users
4. **Exit Surveys**: Extended survey with follow-up questions
5. **Downgrade Instead**: Offer cheaper plan before full cancellation
