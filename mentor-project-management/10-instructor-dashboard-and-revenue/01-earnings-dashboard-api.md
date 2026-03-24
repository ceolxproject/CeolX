# Earnings Dashboard API

## Description

Implement comprehensive API endpoints for instructor earnings retrieval, including summary statistics, breakdown by course/period, and detailed transaction history. These endpoints power the Mentor dashboard earnings interface and support filtering by date ranges and courses.

## Affected Apps/Packages

- Backend: `hono-api` service
- Database: PostgreSQL earnings and transactions tables
- Authentication: Instructor JWT middleware

## API Endpoints

### GET /instructor/earnings

**Summary of total earnings across all time**

**Request:**

```http
GET /instructor/earnings
Authorization: Bearer {instructor_jwt}
```

**Query Parameters:**

- `dateFrom` (optional): ISO 8601 date string (filter start date)
- `dateTo` (optional): ISO 8601 date string (filter end date)
- `courseId` (optional): UUID to filter by specific course

**Response (200 OK):**

```json
{
  "totalEarned": 4250.5,
  "pendingBalance": 875.25,
  "paidOut": 3375.25,
  "currencyCode": "USD",
  "nextPayoutDate": "2024-03-15T00:00:00Z",
  "payoutStatus": "eligible",
  "lastPayout": {
    "date": "2024-02-15T00:00:00Z",
    "amount": 1120.5
  }
}
```

**Response Fields:**

- `totalEarned` (number): Cumulative earnings (single purchase + subscription share)
- `pendingBalance` (number): Amount accrued but not yet paid out
- `paidOut` (number): Total amount instructor has received
- `currencyCode` (string): Always "USD"
- `nextPayoutDate` (ISO 8601 datetime): Projected next payout date (if eligible)
- `payoutStatus` (string): "eligible", "pending_bank_setup", "pending_verification", "stripe_blocked"
- `lastPayout` (object): Most recent payout info or null

---

### GET /instructor/earnings/breakdown

**Revenue breakdown by course and time period**

**Request:**

```http
GET /instructor/earnings/breakdown
Authorization: Bearer {instructor_jwt}
```

**Query Parameters:**

- `groupBy` (required): "course" | "month" | "week" | "day"
- `dateFrom` (optional): ISO 8601 date string
- `dateTo` (optional): ISO 8601 date string
- `courseId` (optional): UUID to filter by specific course
- `revenueType` (optional): "all" | "single_purchase" | "subscription" (default: "all")

**Response (200 OK) - groupBy=course:**

```json
{
  "groupedBy": "course",
  "totalEarnings": 4250.5,
  "breakdown": [
    {
      "courseId": "uuid-1",
      "courseName": "Advanced Makeup Techniques",
      "courseSlug": "advanced-makeup-techniques",
      "earnings": 2100.0,
      "singlePurchaseRevenue": 1400.0,
      "subscriptionRevenue": 700.0,
      "enrollmentCount": 45,
      "currency": "USD"
    },
    {
      "courseId": "uuid-2",
      "courseName": "Skin Care Fundamentals",
      "courseSlug": "skin-care-fundamentals",
      "earnings": 2150.5,
      "singlePurchaseRevenue": 1505.35,
      "subscriptionRevenue": 645.15,
      "enrollmentCount": 38,
      "currency": "USD"
    }
  ]
}
```

**Response (200 OK) - groupBy=month:**

```json
{
  "groupedBy": "month",
  "totalEarnings": 4250.5,
  "breakdown": [
    {
      "period": "2024-02",
      "displayLabel": "February 2024",
      "earnings": 2050.75,
      "singlePurchaseRevenue": 1435.53,
      "subscriptionRevenue": 615.22,
      "transactionCount": 23
    },
    {
      "period": "2024-01",
      "displayLabel": "January 2024",
      "earnings": 2199.75,
      "singlePurchaseRevenue": 1539.82,
      "subscriptionRevenue": 659.93,
      "transactionCount": 31
    }
  ]
}
```

**Response Fields:**

- `groupedBy` (string): The grouping strategy used
- `totalEarnings` (number): Sum of all earnings in breakdown
- `breakdown` (array): Array of grouped earning records

---

### GET /instructor/earnings/history

**Paginated transaction history with details**

**Request:**

```http
GET /instructor/earnings/history
Authorization: Bearer {instructor_jwt}
```

**Query Parameters:**

- `limit` (optional, default: 25): 1-100, items per page
- `offset` (optional, default: 0): For pagination
- `dateFrom` (optional): ISO 8601 date string
- `dateTo` (optional): ISO 8601 date string
- `courseId` (optional): Filter by course
- `transactionType` (optional): "single_purchase" | "subscription" | "refund"
- `sortBy` (optional, default: "date_desc"): "date_asc" | "date_desc" | "amount_asc" | "amount_desc"

**Response (200 OK):**

```json
{
  "transactions": [
    {
      "transactionId": "txn-uuid-1",
      "date": "2024-02-18T14:30:00Z",
      "type": "single_purchase",
      "courseId": "uuid-1",
      "courseName": "Advanced Makeup Techniques",
      "studentName": "Jane Doe",
      "studentId": "student-uuid",
      "grossAmount": 99.0,
      "instructorShare": 69.3,
      "platformShare": 29.7,
      "currency": "USD",
      "status": "completed",
      "payoutIncluded": true,
      "payoutDate": "2024-02-28T00:00:00Z"
    },
    {
      "transactionId": "txn-uuid-2",
      "date": "2024-02-15T10:15:00Z",
      "type": "subscription",
      "courseIds": ["uuid-1", "uuid-3"],
      "billingPeriod": "2024-02",
      "studentCount": 120,
      "allAccessPool": 3500.0,
      "instructorShare": 875.0,
      "platformShare": 2625.0,
      "watchTimePercentage": 25.0,
      "currency": "USD",
      "status": "completed",
      "payoutIncluded": true,
      "payoutDate": "2024-02-28T00:00:00Z"
    },
    {
      "transactionId": "txn-uuid-3",
      "date": "2024-02-10T08:00:00Z",
      "type": "refund",
      "originalTransactionId": "txn-uuid-1",
      "courseId": "uuid-1",
      "courseName": "Advanced Makeup Techniques",
      "studentName": "John Smith",
      "grossAmount": -99.0,
      "instructorShare": -69.3,
      "platformShare": -29.7,
      "currency": "USD",
      "status": "completed",
      "refundReason": "customer_request"
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 25,
    "total": 142,
    "hasMore": true
  }
}
```

**Response Fields:**

- `transactions` (array): Array of transaction objects
  - Single Purchase transactions include: transactionId, date, type, courseId, courseName, studentName, studentId, grossAmount, instructorShare, platformShare, currency, status, payoutIncluded, payoutDate
  - Subscription transactions include: transactionId, date, type, courseIds, billingPeriod, studentCount, allAccessPool, instructorShare, platformShare, watchTimePercentage, currency, status, payoutIncluded, payoutDate
  - Refund transactions include: originalTransactionId, refundReason, and negative amounts
- `pagination` (object): Pagination metadata

---

## Requirements

### Data Model

1. `earnings` table schema:
   - instructorId (UUID, FK)
   - transactionId (UUID, unique)
   - type (enum: "single_purchase", "subscription", "refund")
   - courseId (UUID, nullable for subscriptions)
   - courseIds (JSONB array, nullable)
   - grossAmount (decimal)
   - instructorShare (decimal)
   - platformShare (decimal)
   - billingPeriod (string, nullable for subscriptions like "2024-02")
   - watchTimePercentage (decimal, nullable for subscriptions)
   - status (enum: "pending", "completed", "refunded", "clawed_back")
   - payoutIncluded (boolean)
   - payoutId (UUID, FK, nullable)
   - payoutDate (timestamp, nullable)
   - createdAt (timestamp)
   - updatedAt (timestamp)

2. Indexing strategy:
   - (instructorId, createdAt DESC) for fast sorting
   - (instructorId, courseId) for course filtering
   - (instructorId, type) for type filtering
   - (payoutId) for payout lookup

### Filter Implementation

1. Date range filters (dateFrom/dateTo):
   - Validate ISO 8601 format
   - Default to last 90 days if not provided
   - Throw validation error if dateTo < dateFrom

2. Course filter:
   - For single purchase: exact match on courseId
   - For subscriptions: check if courseId in courseIds JSONB array
   - If courseId provided, only return relevant transaction types

3. Revenue type filter:
   - "single_purchase": type = "single_purchase" AND type != "refund"
   - "subscription": type = "subscription"
   - "all": no type restriction

### Pagination

1. Offset-based pagination (most common for analytics dashboards)
2. Limit: 1-100 (default 25)
3. Always return total count for UI calculation
4. Efficient: use count(\*) window function query

### Sorting

1. Default: most recent first (createdAt DESC)
2. Supported: date (asc/desc), amount (asc/desc)
3. Validate sortBy parameter against allowed values

## Acceptance Criteria

- [ ] GET /instructor/earnings returns accurate total earned, pending, and paid out
- [ ] Pending balance calculation excludes transactions in payouts (payoutIncluded = false)
- [ ] Paid out total matches sum of all completed payouts
- [ ] GET /instructor/earnings/breakdown supports groupBy="course" with accurate per-course revenue
- [ ] GET /instructor/earnings/breakdown supports groupBy="month" with correct aggregation
- [ ] GET /instructor/earnings/breakdown supports groupBy="week" and groupBy="day"
- [ ] Date range filter (dateFrom/dateTo) correctly filters all endpoints
- [ ] courseId filter correctly filters single purchase and subscription transactions
- [ ] GET /instructor/earnings/history returns paginated results with accurate pagination metadata
- [ ] Refund transactions show negative amounts and link to original transaction
- [ ] Response includes correct currency code (USD)
- [ ] All monetary values are consistent (grossAmount = instructorShare + platformShare)
- [ ] Subscription revenue includes watchTimePercentage and courseName aggregation
- [ ] Sorting by date and amount works correctly in both directions
- [ ] API requires instructor authentication (401 if no valid JWT)
- [ ] Instructor can only see their own earnings (403 if accessing another instructor's data)
- [ ] Performance: all queries return within 500ms for typical instructor (< 1000 transactions)
- [ ] API implements proper error handling with meaningful error messages
- [ ] API validates all query parameters and returns 400 for invalid input

## Dependencies

- **Database**: PostgreSQL 14+
- **Authentication**: JWT middleware for instructor role verification
- **External**: Stripe for transaction source data (via webhooks)
- **Milestone**: Database schema (02-database-schema)
- **Milestone**: Payments integration (08-payments-and-subscriptions) for transaction recording

## Technical Notes

### Implementation Strategy

1. **Query Optimization**: Use database aggregation functions (SUM, COUNT, GROUP BY) rather than application-level aggregation
2. **Timestamp Handling**: Store all timestamps in UTC, convert to instructor's timezone on response if needed (can extend later)
3. **Currency**: Hard-code USD for now; prepare for multi-currency by storing currency code in schema
4. **Calculation Accuracy**: Use decimal/numeric types in database for financial calculations, never float

### Pending Balance Calculation

```sql
SELECT SUM(instructor_share)
FROM earnings
WHERE instructor_id = ?
  AND status = 'completed'
  AND payout_included = false
  AND created_at >= date_from
  AND created_at <= date_to
```

### Paid Out Total Calculation

```sql
SELECT SUM(amount)
FROM payouts
WHERE instructor_id = ?
  AND status = 'completed'
```

### Subscription Revenue Aggregation

For grouping by course when transaction type is subscription, the query must:

1. Unnest the courseIds JSONB array
2. Sum by each course
3. Calculate watch-time percentage proportionally

### Error Handling

- 401: Missing/invalid JWT
- 403: Accessing another instructor's earnings
- 400: Invalid date format, invalid limit/offset, invalid sortBy
- 500: Database query failure

### Future Extensions

1. Export functionality (CSV) - prepare schema now
2. Timezone localization per instructor profile
3. Multi-currency support (prepare schema with currency_code field)
4. Forecasting dashboard (estimated next month revenue)
5. Cohort analysis (compare with average instructor)
