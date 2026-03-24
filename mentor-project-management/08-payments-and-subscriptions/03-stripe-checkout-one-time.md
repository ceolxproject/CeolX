# Task 3: Stripe Checkout One-Time Purchase

## Description

Implement Stripe Checkout integration for one-time course purchases. This task enables users to purchase individual premium courses without a subscription, including promo code support, success/cancel redirect handling, and automatic receipt email delivery via Stripe.

## Affected Apps/Packages

- **Backend**: Hono API service (`packages/api`)
- **Database**: `purchases`, `users` tables
- **Stripe Integration**: Stripe Checkout and Payment Links
- **Frontend**: Web app for redirect URLs and deep linking from mobile

## API Endpoints

### POST /api/v1/checkout/create

Create a Stripe Checkout session for one-time course purchase.

**Request**:

```
POST /api/v1/checkout/create
Headers:
  Content-Type: application/json
  Authorization: Bearer {user_jwt_token}

Body:
{
  "courseId": "course_12345abc",
  "priceId": "price_1H5eSaI50VqksJqJ...",
  "amount": 2999,
  "currency": "EUR",
  "successUrl": "https://mentor.example.com/courses/{courseId}?checkout_success=true&session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://mentor.example.com/courses/{courseId}",
  "couponCode": "SUMMER20" (optional),
  "source": "web" (optional, values: "web" or "mobile")
}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "sessionId": "cs_test_a1K2p3L4...",
    "url": "https://checkout.stripe.com/pay/cs_test_a1K2p3L4...",
    "expiresAt": "2024-02-25T10:30:00Z",
    "courseId": "course_12345abc",
    "courseTitle": "Advanced Eye Makeup Techniques",
    "price": {
      "amount": 2999,
      "currency": "EUR",
      "formattedAmount": "29.99 EUR"
    },
    "discount": {
      "code": "SUMMER20",
      "percentOff": 20,
      "finalAmount": 2399,
      "finalFormattedAmount": "23.99 EUR"
    } // Only if coupon applied
  }
}
```

**Error Response (400 Bad Request)**:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_COURSE",
    "message": "Course not found or is not available for purchase"
  }
}
```

**Error Response (401 Unauthorized)**:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "User not authenticated"
  }
}
```

**Error Response (402 Coupon Invalid)**:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_COUPON",
    "message": "Coupon code expired or not applicable to this course"
  }
}
```

### GET /api/v1/checkout/success

Verify checkout session completion and return purchase details. Called after Stripe redirects user back to app.

**Request**:

```
GET /api/v1/checkout/success?session_id=cs_test_a1K2p3L4...
Headers:
  Authorization: Bearer {user_jwt_token}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "sessionId": "cs_test_a1K2p3L4...",
    "paymentStatus": "paid",
    "courseId": "course_12345abc",
    "courseTitle": "Advanced Eye Makeup Techniques",
    "transactionId": "txn_1H5eSdI50VqksJqJ...",
    "amount": {
      "paid": 2399,
      "currency": "EUR",
      "formattedAmount": "23.99 EUR"
    },
    "discount": {
      "code": "SUMMER20",
      "percentOff": 20,
      "savedAmount": 600
    },
    "purchasedAt": "2024-02-18T10:30:00Z",
    "receiptUrl": "https://invoice.stripe.com/i/acct_1H5eSdI50VqksJqJ/test_YWNjdF8xSDVlU2RJNTBWcWtzSnFKLF9JMlg4c2JuMDhiaGNlODQ4MWQ3YTdhZGJmMWJkMjc4NDRmODI4MTc0MGU4ZjhiMjA1MWM5YzVhMjEwNzU0NGUwNWJiZjczMTUxOTVhMTkyNzJmYWE1NjEyMzY2NzI/pdf",
    "receiptEmail": "user@example.com",
    "instantAccess": true
  }
}
```

**Error Response (404 Not Found)**:

```json
{
  "success": false,
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Checkout session not found or already processed"
  }
}
```

## Requirements

### Stripe Checkout Configuration

1. **One-Time Purchase Product Setup**:
   - For each premium course, create Stripe product with metadata:
     ```json
     {
       "courseId": "course_12345abc",
       "courseTitle": "Advanced Eye Makeup Techniques",
       "instructorId": "instructor_789xyz",
       "type": "course_purchase"
     }
     ```
   - Products created dynamically or via admin panel (milestone 11)
   - Price set by course owner (admin/instructor determines pricing)

2. **Checkout Session Configuration**:
   - `mode`: "payment" (one-time, not subscription)
   - `payment_method_types`: ["card"]
   - `line_items`: Include product, price, and quantity (1)
   - `customer_email`: Pre-fill from user email
   - `customer`: Link to Stripe Customer if exists (create if not)
   - `client_reference_id`: User ID for tracking
   - `metadata`:
     ```json
     {
       "userId": "user_123",
       "courseId": "course_12345abc",
       "purchaseType": "one_time",
       "source": "web"
     }
     ```
   - `billing_address_collection`: "auto"
   - `consent_collection`: { "terms_of_service": "required" } (optional, for future compliance)

3. **Receipt Email Configuration**:
   - Enable Stripe's automatic receipt email (`stripe_enabled: true` in settings)
   - Custom email template via Stripe Dashboard or Stripe integration settings
   - Email includes: course title, amount paid, date, receipt link

### Backend Implementation

1. **Checkout Session Creation**:
   - Validate courseId exists and is a premium course (not free)
   - Validate priceId matches course pricing in database
   - Validate amount matches course price (prevent client-side manipulation)
   - Apply coupon code if provided (integration with task 5)
   - Create Stripe Checkout session with course metadata
   - Store session details in database for tracking:
     ```sql
     INSERT INTO checkout_sessions (
       stripe_session_id,
       user_id,
       course_id,
       price,
       currency,
       status,
       coupon_code,
       created_at,
       expires_at
     ) VALUES (...)
     ```
   - Return session URL and ID to frontend

2. **Success Verification**:
   - Retrieve Stripe session by ID
   - Verify payment status is "paid"
   - Verify customer matches authenticated user (prevent session hijacking)
   - Check if purchase already processed (idempotency)
   - Create purchase record in database:
     ```sql
     INSERT INTO purchases (
       id,
       user_id,
       course_id,
       stripe_checkout_session_id,
       stripe_payment_intent_id,
       amount,
       currency,
       coupon_code,
       status,
       purchased_at
     ) VALUES (...)
     ```
   - Mark course as purchased for user (enrollment-like record)
   - Grant immediate access to course content
   - Return receipt URL from Stripe
   - Log successful purchase

3. **Course Access Control**:
   - Purchased course should be immediately accessible after payment confirmation
   - Check purchase records when determining course access
   - Courses purchased one-time have perpetual access (not time-limited)
   - Retained even if user cancels subscription (per requirements)

### Database Schema (if not already present)

```sql
CREATE TABLE purchases (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  stripe_checkout_session_id VARCHAR(255) NOT NULL,
  stripe_payment_intent_id VARCHAR(255),
  amount INT NOT NULL, -- Amount in cents
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  coupon_code VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'completed',
  receipt_url VARCHAR(500),
  receipt_email VARCHAR(255),
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, course_id) -- Prevent duplicate purchases
);

CREATE TABLE checkout_sessions (
  id UUID PRIMARY KEY,
  stripe_session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  price INT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, paid, expired
  coupon_code VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  processed_at TIMESTAMP
);

CREATE INDEX idx_purchases_user_course ON purchases(user_id, course_id);
CREATE INDEX idx_checkout_sessions_session_id ON checkout_sessions(stripe_session_id);
```

### Error Handling

1. **Validation Errors**:
   - Invalid courseId: Return 400 with `INVALID_COURSE` error
   - Course is free: Return 400 with `COURSE_FREE` error
   - Invalid priceId: Return 400 with `INVALID_PRICE` error
   - Price mismatch (client-side manipulation): Return 400 with `PRICE_MISMATCH` error

2. **Stripe Errors**:
   - Checkout session creation fails: Return 500 with `STRIPE_ERROR`
   - Stripe API unreachable: Return 503 with `SERVICE_UNAVAILABLE`

3. **Coupon Errors** (handled in integration with task 5):
   - Coupon not found: Return 402 with `INVALID_COUPON`
   - Coupon expired: Return 402 with `COUPON_EXPIRED`
   - Coupon not applicable to course: Return 402 with `COUPON_NOT_APPLICABLE`

4. **Session Errors**:
   - Session not found: Return 404 with `SESSION_NOT_FOUND`
   - Session already processed: Return 400 with `SESSION_ALREADY_PROCESSED`
   - Payment not yet completed: Return 400 with `PAYMENT_INCOMPLETE`

### Deep Link Handling (Mobile)

1. **Web-to-Mobile Redirect Flow**:
   - User initiates purchase on mobile, directed to web checkout
   - Stripe Checkout session created with return URL
   - On success, redirect includes `checkout_success=true` query parameter
   - JavaScript detects success and initiates deep link back to mobile app
   - Deep link format: `mentor://purchase-success?session_id=cs_test_...&course_id=course_123`

2. **Mobile App Handling**:
   - Mobile app registers deep link handler for `mentor://purchase-success`
   - App receives session ID and course ID
   - App calls GET /api/v1/checkout/success with session ID
   - App displays confirmation and navigates to course

3. **Implementation Notes**:
   - Success URL should be flexible to support both web and mobile contexts
   - Include `source` parameter in checkout metadata to track web vs mobile origin
   - Consider analytics: track conversion by source

### Promo Code Integration

1. **Coupon Application**:
   - If couponCode provided, call validation endpoint (task 5)
   - Include validated discount in checkout session
   - Store coupon code with purchase record for reporting
   - Display discount amount in response and confirmation

2. **Discount Display**:
   - Show original price and discounted price
   - Show percentage discount or fixed amount savings
   - Display final amount to be charged

### Email Confirmation

1. **Stripe Automatic Receipt**:
   - Enable email receipts in Stripe settings
   - Stripe automatically sends receipt after payment
   - Receipt includes charge details, date, and receipt URL
   - Link to receipt URL for user records

2. **App Confirmation Email** (optional enhancement):
   - Send internal app email with course access link
   - Include course details and instant access information
   - Include link to Stripe receipt for financial records

## Acceptance Criteria

- [ ] POST /api/v1/checkout/create endpoint implemented
- [ ] Stripe Checkout session created with mode: "payment"
- [ ] Course validation ensures course exists and is premium (not free)
- [ ] Price validation prevents client-side price manipulation
- [ ] Stripe Customer created if not exists (linked to user)
- [ ] Course metadata included in checkout session
- [ ] Coupon code parameter accepted and integrated (task 5)
- [ ] Success and cancel URLs properly formatted and returned
- [ ] Session expiration time included in response
- [ ] GET /api/v1/checkout/success endpoint implemented
- [ ] Success endpoint verifies payment status is "paid"
- [ ] Idempotency check prevents duplicate purchase processing
- [ ] Receipt URL from Stripe returned to user
- [ ] Purchase record created in database with all details
- [ ] Course immediately accessible after successful payment
- [ ] Permanent access granted (not time-limited)
- [ ] Purchased courses retained if subscription canceled
- [ ] Database schema updated with purchases and checkout_sessions tables
- [ ] Unique constraint prevents duplicate course purchases by same user
- [ ] Checkout session expiration tracked (24-hour Stripe standard)
- [ ] Stripe automatic receipt email configured
- [ ] Error handling covers all failure scenarios with appropriate HTTP codes
- [ ] JWT authentication required for checkout creation and success endpoints
- [ ] Deep link integration supports redirect from web to mobile
- [ ] Source parameter tracks origin (web vs mobile)
- [ ] All Stripe API calls properly logged with timing
- [ ] Unit tests cover checkout creation, success verification, course access
- [ ] Integration tests verify Stripe Checkout flow with test cards
- [ ] API documentation includes examples of successful and failed purchases

## Dependencies

- Task 1: Stripe Billing Setup (Stripe account configuration)
- Task 5: Promo Code Application (coupon validation integration)
- Milestone 2: Database schema for courses and users
- Milestone 4: User authentication (JWT validation)
- Milestone 5: Course management (course data and pricing)

## Technical Notes

### Preventing Price Manipulation

Always verify the price on the backend:

```typescript
const course = await db.query("SELECT price FROM courses WHERE id = ?", [
  courseId,
]);
if (course.price * 100 !== amount) {
  throw new Error("Price mismatch - possible tampering");
}
```

### Idempotency Implementation

Check if purchase already exists before processing:

```typescript
const existingPurchase = await db.query(
  "SELECT id FROM purchases WHERE stripe_checkout_session_id = ?",
  [sessionId],
);
if (existingPurchase) {
  return existingPurchase; // Return existing record
}
```

### Course Access Verification

When determining if user can access course:

```typescript
const hasAccess =
  user.hasActiveSubscription ||
  user.purchasedCourses.includes(courseId) ||
  course.isFree;
```

### Stripe Checkout Session States

| Status     | Description                                                  |
| ---------- | ------------------------------------------------------------ |
| `open`     | Session created, awaiting payment                            |
| `complete` | Payment successful, user redirected to success URL           |
| `expired`  | Session expired (24 hours), customer must create new session |

### Currency and Amount Handling

- All amounts stored in cents (multiply EUR amount by 100)
- Example: 29.99 EUR = 2999 cents
- Stripe expects amounts as integers in smallest currency unit
- Always convert back to EUR for display: amount / 100

### Testing Scenarios

1. Successful purchase with valid course and price
2. Prevent free course purchase
3. Detect price manipulation attempt
4. Apply coupon code to discount
5. Expired/invalid coupon rejection
6. Duplicate purchase detection
7. Session not found error
8. Stripe API failure handling
9. Mobile deep link redirect flow
10. Receipt email delivery

### Receipt URL Handling

- Stripe provides unique receipt URL for each session
- Store URL in database for user access to receipts
- Include in confirmation response
- Link available in payment history (task 7)

### Future Enhancements

1. **Bundle Purchases**: Allow purchasing multiple courses at once
2. **Gift Purchases**: Enable user to purchase course for another user
3. **Refund Flow**: Implement refund processing (initiated by admin)
4. **Payment Plan**: Offer payment plans for expensive courses (Klarna, Afterpay)
5. **Affiliate Tracking**: Track purchases originating from affiliate links

### Security Considerations

1. Always verify customer in session matches authenticated user
2. Validate course ID matches user's enrollment check
3. Use HTTPS for all redirect URLs
4. Include CSRF token in success URL if session-based auth used (JWT generally safe)
5. Log all sensitive operations (purchase creation, success verification)
6. Monitor for fraud patterns (multiple failed attempts, etc.)

### Performance Optimization

1. Cache course pricing to reduce database queries
2. Implement checkout session expiration cleanup (scheduled job)
3. Use database indexes on user_id and course_id for quick lookups
4. Stripe Checkout is hosted, reducing frontend API calls

### Monitoring and Analytics

1. Track checkout initiated → payment completed conversion rate
2. Monitor coupon redemption rate and discount impact on revenue
3. Alert on Stripe Checkout API errors
4. Track average time from checkout initiation to completion
5. Monitor receipt email delivery success rate
