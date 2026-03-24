# Task 7: Payment History API

## Description

Implement payment history API for users to view their transaction records. Users can see all charges (subscriptions and one-time purchases), filter by date, access Stripe receipts/invoices, and download financial records for their own accounts. This task provides transparency and supports customer service inquiries.

## Affected Apps/Packages

- **Backend**: Hono API service (`packages/api`)
- **Database**: `payments`, `subscriptions`, `purchases` tables
- **Stripe Integration**: Stripe Charges and Invoices API

## API Endpoints

### GET /api/v1/payments

List user's payment transactions with filtering and pagination.

**Request**:

```
GET /api/v1/payments?page=1&limit=20&type=all&dateFrom=2024-01-01&dateTo=2024-02-18&sortBy=date&sortOrder=desc
Headers:
  Authorization: Bearer {user_jwt_token}
```

**Query Parameters**:

- `page`: Page number (default: 1)
- `limit`: Items per page, max 100 (default: 20)
- `type`: Filter by transaction type (default: all)
  - `all`: All transactions
  - `subscription`: Subscription charges
  - `purchase`: One-time purchases
- `status`: Filter by status (default: all)
  - `all`: All statuses
  - `succeeded`: Successfully paid
  - `failed`: Failed/refunded
  - `pending`: Awaiting payment (past_due subscriptions)
- `dateFrom`: ISO 8601 date (e.g., 2024-01-01)
- `dateTo`: ISO 8601 date (e.g., 2024-02-18)
- `sortBy`: Sort field (default: date)
  - `date`: Transaction date
  - `amount`: Amount paid
  - `status`: Payment status
- `sortOrder`: asc or desc (default: desc)

**Response (200 OK)**:

```json
{
  "success": true,
  "data": [
    {
      "id": "payment_123",
      "type": "subscription",
      "status": "succeeded",
      "description": "Premium Annual Subscription",
      "amount": 9990,
      "currency": "EUR",
      "formattedAmount": "99.90 EUR",
      "date": "2024-02-18T10:30:00Z",
      "invoiceNumber": "INV-2024-001234",
      "receiptUrl": "https://invoice.stripe.com/i/acct_1H5eSdI50VqksJqJ/test_YWNjdF8xSDVlU2RJNTBWcWtzSnFKLF9JNDZ5WjJqREpzQjVWakZpakMwM21UTXdGN1lxQlE0Ng.../pdf",
      "pdfUrl": "https://invoice.stripe.com/i/acct_1H5eSdI50VqksJqJ/test_YWNjdF8xSDVlU2RJNTBWcWtzSnFKLF9JNDZ5WjJqREpzQjVWakZpakMwM21UTXdGN1lxQlE0Ng.../pdf",
      "periodStart": "2024-02-18",
      "periodEnd": "2025-02-18",
      "nextPaymentDate": "2025-02-18",
      "relatedItem": {
        "type": "subscription",
        "id": "sub_1H5eSdI50VqksJqJ..."
      }
    },
    {
      "id": "payment_124",
      "type": "purchase",
      "status": "succeeded",
      "description": "Advanced Eye Makeup Techniques",
      "amount": 2399,
      "currency": "EUR",
      "formattedAmount": "23.99 EUR",
      "date": "2024-01-15T14:20:00Z",
      "invoiceNumber": "INV-2024-001233",
      "receiptUrl": "https://invoice.stripe.com/i/...",
      "pdfUrl": "https://invoice.stripe.com/i/.../pdf",
      "discountApplied": {
        "code": "SUMMER20",
        "originalAmount": 2999,
        "discountAmount": 600,
        "discountPercent": 20
      },
      "relatedItem": {
        "type": "course",
        "id": "course_12345abc",
        "title": "Advanced Eye Makeup Techniques"
      }
    },
    {
      "id": "payment_125",
      "type": "subscription",
      "status": "failed",
      "description": "Premium Monthly Subscription - Payment Failed",
      "amount": 999,
      "currency": "EUR",
      "formattedAmount": "9.99 EUR",
      "date": "2024-01-01T09:00:00Z",
      "failureReason": "card_declined",
      "failureMessage": "Your card was declined",
      "retryAttempt": 1,
      "nextRetryDate": "2024-01-03T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "pages": 3
  },
  "summary": {
    "totalAmount": 13388,
    "formattedTotalAmount": "133.88 EUR",
    "transactionCount": 47,
    "succeededCount": 45,
    "failedCount": 2,
    "dateRange": {
      "from": "2024-01-01",
      "to": "2024-02-18"
    }
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

### GET /api/v1/payments/:paymentId

Get detailed information about a specific payment transaction.

**Request**:

```
GET /api/v1/payments/payment_123
Headers:
  Authorization: Bearer {user_jwt_token}
```

**Response (200 OK)**:

```json
{
  "success": true,
  "data": {
    "id": "payment_123",
    "type": "subscription",
    "status": "succeeded",
    "description": "Premium Annual Subscription",
    "amount": 9990,
    "currency": "EUR",
    "formattedAmount": "99.90 EUR",
    "date": "2024-02-18T10:30:00Z",
    "invoiceNumber": "INV-2024-001234",
    "receiptUrl": "https://invoice.stripe.com/i/...",
    "pdfUrl": "https://invoice.stripe.com/i/.../pdf",
    "periodStart": "2024-02-18",
    "periodEnd": "2025-02-18",
    "nextPaymentDate": "2025-02-18",
    "stripeChargeId": "ch_1H5eSdI50VqksJqJ...",
    "stripeInvoiceId": "in_1H5eSdI50VqksJqJ...",
    "paymentMethod": {
      "type": "card",
      "card": {
        "brand": "visa",
        "last4": "4242",
        "expiryMonth": 12,
        "expiryYear": 2025
      }
    },
    "billingDetails": {
      "email": "user@example.com",
      "name": "John Doe"
    }
  }
}
```

**Error Response (404 Not Found)**:

```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_NOT_FOUND",
    "message": "Payment transaction not found"
  }
}
```

### GET /api/v1/payments/export/csv

Export payment history as CSV file (optional).

**Request**:

```
GET /api/v1/payments/export/csv?dateFrom=2024-01-01&dateTo=2024-02-18
Headers:
  Authorization: Bearer {user_jwt_token}
```

**Response (200 OK)**:

```
Content-Type: text/csv
Content-Disposition: attachment; filename="payment_history_2024-02-18.csv"

Date,Type,Description,Amount (EUR),Status,Invoice Number,Receipt Link
2024-02-18,Subscription,Premium Annual Subscription,99.90,Succeeded,INV-2024-001234,https://invoice.stripe.com/i/...
2024-01-15,Purchase,Advanced Eye Makeup Techniques,23.99,Succeeded,INV-2024-001233,https://invoice.stripe.com/i/...
...
```

## Requirements

### Payment Record Collection

1. **Subscription Payments**:
   - Collected from Stripe Invoices
   - One invoice per billing period
   - Associated with subscription ID
   - Include period start/end and next payment date
   - Track invoice status (paid, unpaid, draft)

2. **One-Time Purchase Payments**:
   - Collected from Stripe Charges and purchases table
   - One charge per course purchase
   - Associated with course and purchase record
   - Include discount applied (if coupon used)
   - Track payment intent status

3. **Failed Payments**:
   - Include failed charge attempts
   - Show failure reason and code
   - Display retry attempts and next retry date
   - Track if eventually recovered

4. **Refunds**:
   - Track refunded amounts
   - Show refund date and reason (admin-initiated, customer request, etc.)
   - Track refund status (pending, completed, failed)

### Database Schema

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL, -- 'subscription', 'purchase'
  status VARCHAR(50) NOT NULL, -- 'succeeded', 'failed', 'pending', 'refunded'
  description VARCHAR(255),
  amount INT NOT NULL, -- amount in cents
  currency VARCHAR(3) DEFAULT 'EUR',
  discount_amount INT DEFAULT 0,
  discount_code VARCHAR(50),
  stripe_charge_id VARCHAR(255),
  stripe_invoice_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  receipt_url VARCHAR(500),
  invoice_number VARCHAR(50),
  subscription_id UUID REFERENCES subscriptions(id),
  purchase_id UUID REFERENCES purchases(id),
  course_id UUID REFERENCES courses(id),
  period_start DATE,
  period_end DATE,
  next_payment_date DATE,
  failure_reason VARCHAR(100),
  failure_message VARCHAR(255),
  retry_attempt INT,
  next_retry_date TIMESTAMP,
  refund_amount INT DEFAULT 0,
  refund_reason VARCHAR(255),
  refund_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_user_date ON payments(user_id, created_at DESC);
CREATE INDEX idx_payments_user_type ON payments(user_id, type);
CREATE INDEX idx_payments_status ON payments(user_id, status);
```

### Data Collection Strategy

1. **Subscription Payments from Invoices**:
   - Listen for `invoice.paid` webhook (task 8)
   - Fetch invoice details from Stripe
   - Create/update payment record
   - Extract invoice PDF URL

2. **One-Time Purchases from Charges**:
   - Listen for `checkout.session.completed` webhook (task 8)
   - Retrieve charge from Stripe
   - Link to purchase record
   - Extract receipt URL

3. **Failed Payments from Webhooks**:
   - Listen for `invoice.payment_failed` webhook (task 8)
   - Track failure reason and code
   - Store retry information

4. **Historical Data Sync**:
   - Batch job to sync existing Stripe data on first deployment
   - Only sync if payment records don't already exist (idempotency)
   - Run nightly to catch missed webhooks

### Payment Filtering and Sorting

1. **Type Filtering**:
   - All: Return both subscriptions and purchases
   - Subscription: Only recurring charges
   - Purchase: Only one-time purchases

2. **Status Filtering**:
   - All: All statuses
   - Succeeded: Completed, paid transactions
   - Failed: Failed or refunded transactions
   - Pending: Awaiting payment (past_due subscriptions)

3. **Date Range**:
   - Default: Last 12 months
   - User can specify custom date range
   - Validate dates (from <= to)

4. **Sorting**:
   - By Date: Most recent first (default)
   - By Amount: Highest/lowest first
   - By Status: Succeeded/failed first
   - Always sortable by any field

5. **Pagination**:
   - Default: 20 items per page
   - Max: 100 items per page
   - Return total count and page count

### API Response Details

1. **List Response**:
   - Include summary statistics (total amount, transaction count)
   - Show breakdown by status (succeeded/failed count)
   - Include date range of displayed transactions
   - For each transaction:
     - Transaction ID and type
     - Description (plan/course name)
     - Amount in cents and formatted EUR
     - Date (transaction/invoice date)
     - Status with failure reason if failed
     - Links to receipt/invoice PDF

2. **Detail Response**:
   - All list fields plus:
     - Stripe charge/invoice ID
     - Payment method details (card brand, last 4 digits)
     - Billing details (email, name)
     - Full period information (for subscriptions)
     - Related item (subscription, course, etc.)

3. **Receipt/Invoice Links**:
   - Stripe-hosted PDFs (read-only)
   - Links expire after time (stored URL from Stripe)
   - Regenerate if needed (call Stripe API)

### Error Handling

1. **Authentication**:
   - Return 401 if user not authenticated

2. **Authorization**:
   - User can only view their own payments
   - Return 404 (not 403) if accessing another user's payments

3. **Not Found**:
   - Return 404 for non-existent payment ID

4. **Validation**:
   - Validate page number (positive integer)
   - Validate limit (1-100)
   - Validate date format (ISO 8601)
   - Validate sort fields (only allowed fields)

### Security Considerations

1. **User Isolation**: Users can only see their own payment history
2. **No Sensitive Data**: Don't expose full card numbers or CVV
3. **Rate Limiting**: Limit payment history requests per user (prevent scraping)
4. **Audit Logging**: Log access to payment history
5. **HTTPS**: All links over HTTPS
6. **Data Retention**: Follow compliance rules for payment data retention

### Testing Scenarios

1. List all payments
2. Filter by transaction type (subscription/purchase)
3. Filter by status (succeeded/failed)
4. Filter by date range
5. Sort by date, amount, status
6. Pagination (first/middle/last page)
7. Single payment detail
8. Non-existent payment (404)
9. Another user's payment (404)
10. CSV export with various filters

## Acceptance Criteria

- [ ] GET /api/v1/payments endpoint implemented
- [ ] Pagination works correctly with page, limit, total, pages
- [ ] Type filtering (all, subscription, purchase) works
- [ ] Status filtering (all, succeeded, failed, pending) works
- [ ] Date range filtering (dateFrom, dateTo) works
- [ ] Sorting by date, amount, status works
- [ ] Sort order (asc/desc) works
- [ ] Summary statistics included (totalAmount, transactionCount, succeededCount)
- [ ] Each transaction includes:
  - ID, type, status, description
  - Amount in cents and formatted EUR
  - Date, invoice number, receipt URL
  - Period info for subscriptions
  - Discount info for purchases
  - Failure reason if failed
- [ ] GET /api/v1/payments/:paymentId returns detailed payment info
- [ ] Detail response includes payment method and billing details
- [ ] Links to Stripe receipts/invoices included and working
- [ ] Users can only view their own payments (authorization check)
- [ ] GET /api/v1/payments/export/csv exports payment history as CSV
- [ ] CSV export respects filters (dateFrom, dateTo, type, status)
- [ ] Database schema includes payments table with all fields
- [ ] Indexes on user_id, type, status, date for query performance
- [ ] Payment records created via webhooks (task 8)
- [ ] Subscription invoices synced to payments table
- [ ] One-time purchases synced to payments table
- [ ] Failed payments tracked with retry information
- [ ] Refunds tracked with refund amount and reason
- [ ] JWT authentication required for all endpoints
- [ ] Rate limiting prevents payment history scraping
- [ ] Users cannot access other users' payment records
- [ ] Error handling for invalid inputs (pagination, dates, sort)
- [ ] Error handling for non-existent payments (404)
- [ ] All Stripe API calls properly logged
- [ ] Unit tests cover filtering, sorting, pagination, authorization
- [ ] Integration tests verify payment record creation from webhooks
- [ ] API documentation includes filter/sort examples and error codes

## Dependencies

- Task 1: Stripe Billing Setup (Stripe configuration)
- Task 2: Subscription Plans API (subscription data)
- Task 3: Stripe Checkout One-Time (purchase data)
- Task 8: Stripe Webhook Handlers (payment data collection)
- Milestone 2: Database schema for payments table

## Technical Notes

### Payment Record Types

| Type           | Source         | Trigger                  | Status Values                        |
| -------------- | -------------- | ------------------------ | ------------------------------------ |
| Subscription   | Stripe Invoice | `invoice.paid`           | succeeded, failed, pending, refunded |
| Purchase       | Stripe Charge  | `charge.succeeded`       | succeeded, failed, refunded          |
| Failed Payment | Stripe Invoice | `invoice.payment_failed` | failed, pending (retry)              |

### Invoice vs Charge

- **Invoice**: Monthly/annual subscription charges (aggregate of subscriptions)
- **Charge**: Individual payment (subscriptions, one-time purchases)
- Both needed for complete payment history

### Receipt URL Strategy

- Store Stripe-generated PDF URLs in database
- URLs may expire (regenerate if 404)
- Provide link to Stripe portal for re-download
- Consider storing PDF locally for compliance

### Historical Data Import

```typescript
async function syncHistoricalPayments(userId: string) {
  const customer = await getStripeCustomer(userId);
  const invoices = await stripe.invoices.list({
    customer: customer.id,
    limit: 100,
  });

  for (const invoice of invoices.data) {
    const existingPayment = await db.query(
      "SELECT id FROM payments WHERE stripe_invoice_id = ?",
      [invoice.id],
    );

    if (!existingPayment) {
      await createPaymentFromInvoice(invoice, userId);
    }
  }
}
```

### Summary Statistics Calculation

```typescript
function calculateSummary(payments: Payment[]): PaymentSummary {
  return {
    totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
    transactionCount: payments.length,
    succeededCount: payments.filter((p) => p.status === "succeeded").length,
    failedCount: payments.filter((p) => p.status === "failed").length,
  };
}
```

### Performance Optimization

1. Index on (user_id, created_at DESC) for chronological queries
2. Index on (user_id, type) for type filtering
3. Index on (user_id, status) for status filtering
4. Consider denormalization for summary stats (updated via webhook)
5. Use pagination to limit result set size

### Compliance and Retention

- PCI-DSS: Don't store full payment card numbers
- GDPR: Retain payment records per legal obligation (typically 6-7 years for tax)
- Allow data export for user (via CSV or via GDPR access request)
- Implement data deletion after retention period (if applicable)

### Monitoring

1. Track payment records created per transaction type
2. Monitor webhook processing success rate for payments
3. Alert on failed payment processing
4. Track receipt URL link validity (detect 404s)
5. Monitor API response times for payment history queries

### Future Enhancements

1. **Tax Documents**: Generate tax invoices with VAT
2. **Financial Reports**: Monthly/annual spending summaries
3. **Recurring Charges Forecast**: Show upcoming charges
4. **Currency Conversion**: Display in user's preferred currency (future multi-currency)
5. **Payment Analytics**: Charts of spending over time
6. **Duplicate Prevention**: Detect and prevent duplicate invoices in webhook
7. **Three-Factor Auth**: Add extra security for payment history access
