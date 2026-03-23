# Payout History

## Description

Implement payout tracking API endpoints and UI for instructors to view their payout history. Display list of payouts with amounts, dates, and status. Show detailed breakdown of earnings included in each payout by course. Track Stripe transfer references for reconciliation. Enable export functionality for accounting and tax purposes.

## Affected Apps/Packages

- Backend: `hono-api` service
- Frontend: `mentor-web` (Next.js)
- Database: PostgreSQL payouts, payout_items tables
- Payment Provider: Stripe (transfers API)
- External Service: Stripe for transfer tracking

## API Endpoints

### GET /instructor/payouts

**List all payouts with pagination**

**Request:**

```http
GET /instructor/payouts?limit=25&offset=0&sortBy=date_desc
Authorization: Bearer {instructor_jwt}
```

**Query Parameters:**

- `limit` (optional, default: 25): 1-100 items per page
- `offset` (optional, default: 0): For pagination
- `sortBy` (optional, default: "date_desc"): "date_asc", "date_desc", "amount_asc", "amount_desc"
- `dateFrom` (optional): ISO 8601 date string, filter start
- `dateTo` (optional): ISO 8601 date string, filter end
- `status` (optional): "pending", "in_progress", "completed", "failed"

**Response (200 OK):**

```json
{
  "payouts": [
    {
      "payoutId": "payout-uuid-1",
      "amount": 2100.5,
      "currency": "USD",
      "status": "completed",
      "payoutMethod": "bank_transfer",
      "bankAccountLast4": "1234",
      "bankName": "Wells Fargo",
      "stripeTransferId": "tr_1234567890abcdef",
      "stripeTransferStatus": "transferred",
      "createdAt": "2024-02-15T08:00:00Z",
      "completedAt": "2024-02-20T10:30:00Z",
      "earningsIncluded": 2100.5,
      "earningsCount": 23,
      "courseBreakdown": [
        {
          "courseId": "course-uuid-1",
          "courseName": "Advanced Makeup Techniques",
          "earnings": 1400.25,
          "transactionCount": 15
        },
        {
          "courseId": "course-uuid-2",
          "courseName": "Skin Care Fundamentals",
          "earnings": 700.25,
          "transactionCount": 8
        }
      ]
    },
    {
      "payoutId": "payout-uuid-2",
      "amount": 1875.0,
      "currency": "USD",
      "status": "completed",
      "payoutMethod": "bank_transfer",
      "bankAccountLast4": "1234",
      "bankName": "Wells Fargo",
      "stripeTransferId": "tr_0987654321zyxwvu",
      "stripeTransferStatus": "transferred",
      "createdAt": "2024-01-15T08:00:00Z",
      "completedAt": "2024-01-20T10:30:00Z",
      "earningsIncluded": 1875.0,
      "earningsCount": 19,
      "courseBreakdown": [
        {
          "courseId": "course-uuid-1",
          "courseName": "Advanced Makeup Techniques",
          "earnings": 1200.0,
          "transactionCount": 12
        },
        {
          "courseId": "course-uuid-3",
          "courseName": "Lip Art Masterclass",
          "earnings": 675.0,
          "transactionCount": 7
        }
      ]
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 25,
    "total": 42,
    "hasMore": false
  },
  "summary": {
    "totalPaidOut": 8950.0,
    "totalPendingPayout": 875.25,
    "averagePayoutAmount": 1270.71,
    "lastPayoutDate": "2024-02-15T08:00:00Z",
    "nextPayoutEligibleDate": "2024-03-15T08:00:00Z"
  }
}
```

**Response Fields:**

- `payoutId` (string): UUID of payout record
- `amount` (number): Total amount paid out
- `currency` (string): Always "USD"
- `status` (string): "pending", "in_progress", "completed", "failed"
- `payoutMethod` (string): "bank_transfer", "stripe_express" (always bank_transfer for now)
- `bankAccountLast4` (string): Last 4 digits of bank account
- `bankName` (string): Name of bank
- `stripeTransferId` (string): Stripe transfer ID for tracking
- `stripeTransferStatus` (string): "pending", "in_transit", "paid", "failed"
- `createdAt` (ISO 8601): When payout was initiated
- `completedAt` (ISO 8601): When payout completed (null if pending)
- `earningsIncluded` (number): Total earnings in this payout
- `earningsCount` (number): Number of transactions included
- `courseBreakdown` (array): Per-course earnings breakdown
- `pagination` (object): Pagination metadata
- `summary` (object): Summary stats across all payouts

---

### GET /instructor/payouts/:payoutId

**Get detailed payout information with full transaction list**

**Request:**

```http
GET /instructor/payouts/payout-uuid-1
Authorization: Bearer {instructor_jwt}
```

**Response (200 OK):**

```json
{
  "payoutId": "payout-uuid-1",
  "amount": 2100.5,
  "currency": "USD",
  "status": "completed",
  "createdAt": "2024-02-15T08:00:00Z",
  "completedAt": "2024-02-20T10:30:00Z",
  "payout": {
    "bankAccountLast4": "1234",
    "bankName": "Wells Fargo",
    "stripeTransferId": "tr_1234567890abcdef",
    "stripeTransferStatus": "transferred",
    "estimatedArrival": "2024-02-22T00:00:00Z"
  },
  "earnings": [
    {
      "transactionId": "txn-uuid-1",
      "date": "2024-02-14T14:30:00Z",
      "type": "single_purchase",
      "courseId": "course-uuid-1",
      "courseName": "Advanced Makeup Techniques",
      "studentName": "Jane Doe",
      "amount": 69.3,
      "status": "completed"
    },
    {
      "transactionId": "txn-uuid-2",
      "date": "2024-02-10T10:15:00Z",
      "type": "subscription",
      "courseIds": ["course-uuid-1", "course-uuid-2"],
      "billingPeriod": "2024-02",
      "amount": 875.0,
      "watchTimePercentage": 25.0,
      "status": "completed"
    }
  ],
  "courseBreakdown": [
    {
      "courseId": "course-uuid-1",
      "courseName": "Advanced Makeup Techniques",
      "singlePurchaseRevenue": 1400.0,
      "subscriptionRevenue": 700.0,
      "totalEarnings": 2100.0,
      "transactionCount": 23
    }
  ],
  "taxInfo": {
    "year": 2024,
    "quarterEstimate": "Q1",
    "yearToDateEarnings": 2100.5,
    "reportingNotes": "For tax purposes, please consult a tax professional"
  }
}
```

---

### POST /instructor/payouts/request

**Request a manual payout (if eligible)**

**Request:**

```http
POST /instructor/payouts/request
Authorization: Bearer {instructor_jwt}
Content-Type: application/json

{
  "amount": 875.25,
  "payoutMethod": "bank_transfer"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "payoutId": "payout-uuid-new",
  "status": "pending",
  "amount": 875.25,
  "message": "Payout request submitted. You'll receive funds in 2-3 business days.",
  "createdAt": "2024-02-18T14:30:00Z"
}
```

**Error Responses:**

- 400: Amount exceeds pending balance
- 403: Payout minimum not met (e.g., $25 minimum)
- 409: Bank account not verified
- 409: Account pending Super Admin verification

---

### GET /instructor/payouts/export

**Export payout history to CSV**

**Request:**

```http
GET /instructor/payouts/export?dateFrom=2024-01-01&dateTo=2024-02-28&format=csv
Authorization: Bearer {instructor_jwt}
```

**Query Parameters:**

- `format` (optional): "csv" (default), "json"
- `dateFrom` (optional): ISO 8601 start date
- `dateTo` (optional): ISO 8601 end date
- `includeDetails` (optional): "true" to include full transaction details

**Response (200 OK):**

```
Content-Type: text/csv
Content-Disposition: attachment; filename="payout-history-2024-02-18.csv"

Payout ID,Date,Amount (USD),Status,Bank Account,Stripe Transfer ID,Completed Date,Transaction Count
payout-uuid-1,2024-02-15,2100.50,completed,Wells Fargo ****1234,tr_1234567890abcdef,2024-02-20,23
payout-uuid-2,2024-01-15,1875.00,completed,Wells Fargo ****1234,tr_0987654321zyxwvu,2024-01-20,19
```

---

## Data Model

### payouts Table

```sql
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Instructor reference
  instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,

  -- Payout amount and currency
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',

  -- Stripe information
  stripe_transfer_id VARCHAR(64) UNIQUE,
  stripe_account_id VARCHAR(64),

  -- Payout method
  payout_method VARCHAR(32) DEFAULT 'bank_transfer',  -- bank_transfer, stripe_express
  bank_account_id VARCHAR(64),  -- Reference to Stripe bank account
  bank_account_last4 VARCHAR(4),
  bank_name VARCHAR(255),

  -- Status tracking
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  -- pending, in_progress, in_transit, completed, failed, cancelled

  stripe_transfer_status VARCHAR(32),
  -- pending, in_transit, paid, failed (from Stripe API)

  -- Payout completion
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  initiated_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  estimated_arrival_at TIMESTAMP NULL,

  -- Failure handling
  failure_reason VARCHAR(255) NULL,
  failure_code VARCHAR(64) NULL,

  -- Reconciliation
  reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMP NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT valid_amount CHECK (amount > 0),
  CONSTRAINT valid_status CHECK (
    status IN ('pending', 'in_progress', 'in_transit', 'completed', 'failed', 'cancelled')
  )
);

CREATE INDEX idx_payouts_instructor_id ON payouts(instructor_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_created_at ON payouts(created_at DESC);
CREATE INDEX idx_payouts_stripe_transfer_id ON payouts(stripe_transfer_id);
CREATE UNIQUE INDEX idx_payouts_unique_instructor_date
  ON payouts(instructor_id, created_at)
  WHERE status != 'cancelled';
```

### payout_items Table

```sql
CREATE TABLE payout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  payout_id UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  earnings_id UUID NOT NULL REFERENCES earnings(id),

  -- Denormalized fields for faster queries
  instructor_id UUID NOT NULL REFERENCES instructors(id),
  course_id UUID REFERENCES courses(id),
  amount DECIMAL(10, 2) NOT NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payout_items_payout_id ON payout_items(payout_id);
CREATE INDEX idx_payout_items_earnings_id ON payout_items(earnings_id);
CREATE INDEX idx_payout_items_instructor_id ON payout_items(instructor_id);
CREATE INDEX idx_payout_items_course_id ON payout_items(course_id);
```

---

## Implementation Details

### Create Payout (Manual Trigger)

```typescript
async function createPayoutRequest(
  instructorId: string,
  amount: number,
  payoutMethod: string = "bank_transfer"
) {
  // 1. Verify instructor and account status
  const instructor = await db.instructors.findById(instructorId);
  if (!instructor) {
    throw new Error("Instructor not found");
  }

  const connectAccount = await db.stripe_connect_accounts.findOne({
    instructor_id: instructorId,
  });

  if (!connectAccount) {
    throw new Error("Stripe Connect account not set up");
  }

  if (!connectAccount.payouts_enabled) {
    throw new Error("Payouts not enabled for this account");
  }

  // 2. Check pending balance
  const pendingBalance = await getPendingBalance(instructorId);
  if (amount > pendingBalance) {
    throw new Error(
      `Amount exceeds pending balance ($${pendingBalance.toFixed(2)})`
    );
  }

  // 3. Check minimum payout amount
  const MIN_PAYOUT = 25.0;
  if (amount < MIN_PAYOUT) {
    throw new Error(`Minimum payout amount is $${MIN_PAYOUT}`);
  }

  // 4. Get bank account info
  const bankAccount = await stripe.accounts.retrieveExternalAccount(
    connectAccount.stripe_account_id,
    connectAccount.bank_account_id
  );

  // 5. Create payout record
  const payout = await db.payouts.create({
    instructor_id: instructorId,
    amount,
    currency: "USD",
    stripe_account_id: connectAccount.stripe_account_id,
    payout_method: payoutMethod,
    bank_account_id: bankAccount.id,
    bank_account_last4: bankAccount.last4,
    bank_name: bankAccount.bank_name,
    status: "pending",
    created_at: new Date(),
  });

  // 6. Mark earnings as pending payout
  const earningsToInclude = await db.earnings.find({
    instructor_id: instructorId,
    payout_included: false,
    status: "completed",
  });

  let includedAmount = 0;
  const itemsToCreate = [];

  for (const earnings of earningsToInclude) {
    if (includedAmount + earnings.instructor_share <= amount) {
      includedAmount += earnings.instructor_share;

      itemsToCreate.push({
        payout_id: payout.id,
        earnings_id: earnings.id,
        instructor_id: instructorId,
        course_id: earnings.course_id,
        amount: earnings.instructor_share,
      });

      // Mark earnings as included in payout
      await db.earnings.update(earnings.id, {
        payout_included: true,
        payout_id: payout.id,
      });
    }
  }

  // Bulk insert payout items
  if (itemsToCreate.length > 0) {
    await db.payout_items.insertMany(itemsToCreate);
  }

  // 7. Emit event for processing
  await eventBus.emit("payout.requested", {
    payoutId: payout.id,
    instructorId,
    amount,
    stripeAccountId: connectAccount.stripe_account_id,
    itemCount: itemsToCreate.length,
  });

  // 8. Notify instructor
  await notificationService.send({
    instructorId,
    type: "payout_requested",
    data: {
      payoutId: payout.id,
      amount,
      estimatedArrival: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    payoutId: payout.id,
    status: "pending",
    amount,
    createdAt: payout.created_at,
  };
}
```

### Process Payout (Admin Trigger)

```typescript
async function processPayout(payoutId: string) {
  // 1. Get payout record
  const payout = await db.payouts.findById(payoutId);
  if (!payout) {
    throw new Error("Payout not found");
  }

  if (payout.status !== "pending") {
    throw new Error(`Cannot process payout with status: ${payout.status}`);
  }

  // 2. Update status to in_progress
  await db.payouts.update(payoutId, {
    status: "in_progress",
    initiated_at: new Date(),
  });

  // 3. Create Stripe transfer
  try {
    const transfer = await stripe.transfers.create({
      amount: Math.round(payout.amount * 100), // Convert to cents
      currency: payout.currency.toLowerCase(),
      destination: payout.stripe_account_id,
      description: `Payout for instructor earnings`,
      metadata: {
        payoutId,
        instructorId: payout.instructor_id,
      },
    });

    // 4. Update payout with transfer info
    await db.payouts.update(payoutId, {
      stripe_transfer_id: transfer.id,
      stripe_transfer_status: transfer.status,
      status: transfer.status === "pending" ? "in_progress" : "in_transit",
      estimated_arrival_at: calculateEstimatedArrival(transfer),
      updated_at: new Date(),
    });

    // 5. Log event
    await eventBus.emit("payout.processed", {
      payoutId,
      stripeTransferId: transfer.id,
      amount: payout.amount,
      status: transfer.status,
    });

    return {
      success: true,
      payoutId,
      stripeTransferId: transfer.id,
      status: transfer.status,
    };
  } catch (error) {
    // 6. Handle Stripe error
    await db.payouts.update(payoutId, {
      status: "failed",
      failure_reason: error.message,
      failure_code: error.code,
      updated_at: new Date(),
    });

    // Notify instructor of failure
    await notificationService.send({
      instructorId: payout.instructor_id,
      type: "payout_failed",
      data: {
        payoutId,
        reason: error.message,
      },
    });

    throw error;
  }
}
```

### Fetch Payout List

```typescript
async function getPayoutList(
  instructorId: string,
  limit: number = 25,
  offset: number = 0,
  sortBy: string = "date_desc",
  filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    status?: string;
  }
) {
  // 1. Build query
  const query = {
    instructor_id: instructorId,
  };

  if (filters?.dateFrom || filters?.dateTo) {
    query.created_at = {};
    if (filters.dateFrom) {
      query.created_at.$gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      query.created_at.$lte = filters.dateTo;
    }
  }

  if (filters?.status) {
    query.status = filters.status;
  }

  // 2. Determine sort
  let sortOption = {};
  switch (sortBy) {
    case "date_asc":
      sortOption = { created_at: 1 };
      break;
    case "amount_asc":
      sortOption = { amount: 1 };
      break;
    case "amount_desc":
      sortOption = { amount: -1 };
      break;
    case "date_desc":
    default:
      sortOption = { created_at: -1 };
  }

  // 3. Fetch payouts
  const payouts = await db.payouts
    .find(query)
    .sort(sortOption)
    .limit(limit)
    .skip(offset);

  // 4. Get total count
  const total = await db.payouts.count(query);

  // 5. Enrich with course breakdown
  const enrichedPayouts = await Promise.all(
    payouts.map(async (payout) => {
      const items = await db.payout_items.find({
        payout_id: payout.id,
      });

      const courseBreakdown = items.reduce((acc, item) => {
        const existing = acc.find((c) => c.courseId === item.course_id);
        if (existing) {
          existing.earnings += item.amount;
          existing.transactionCount++;
        } else {
          acc.push({
            courseId: item.course_id,
            courseName: item.course?.name || "Unknown",
            earnings: item.amount,
            transactionCount: 1,
          });
        }
        return acc;
      }, []);

      return {
        payoutId: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        status: payout.status,
        payoutMethod: payout.payout_method,
        bankAccountLast4: payout.bank_account_last4,
        bankName: payout.bank_name,
        stripeTransferId: payout.stripe_transfer_id,
        stripeTransferStatus: payout.stripe_transfer_status,
        createdAt: payout.created_at,
        completedAt: payout.completed_at,
        earningsIncluded: items.reduce((sum, i) => sum + i.amount, 0),
        earningsCount: items.length,
        courseBreakdown,
      };
    })
  );

  // 6. Calculate summary
  const allPayouts = await db.payouts.find({ instructor_id: instructorId });
  const completedPayouts = allPayouts.filter((p) => p.status === "completed");
  const totalPaidOut = completedPayouts.reduce((sum, p) => sum + p.amount, 0);
  const totalPendingPayout = await getPendingBalance(instructorId);
  const averagePayoutAmount =
    completedPayouts.length > 0 ? totalPaidOut / completedPayouts.length : 0;

  return {
    payouts: enrichedPayouts,
    pagination: {
      offset,
      limit,
      total,
      hasMore: offset + limit < total,
    },
    summary: {
      totalPaidOut,
      totalPendingPayout,
      averagePayoutAmount,
      lastPayoutDate:
        completedPayouts.length > 0 ? completedPayouts[0].completed_at : null,
      nextPayoutEligibleDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  };
}
```

### Export to CSV

```typescript
async function exportPayoutHistory(
  instructorId: string,
  format: string = "csv",
  filters?: {
    dateFrom?: Date;
    dateTo?: Date;
  }
) {
  // 1. Fetch all payouts (no pagination for export)
  const query = {
    instructor_id: instructorId,
  };

  if (filters?.dateFrom || filters?.dateTo) {
    query.created_at = {};
    if (filters.dateFrom) {
      query.created_at.$gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      query.created_at.$lte = filters.dateTo;
    }
  }

  const payouts = await db.payouts.find(query).sort({ created_at: -1 });

  if (format === "csv") {
    // 2. Generate CSV
    const csv = [
      [
        "Payout ID",
        "Date",
        "Amount (USD)",
        "Status",
        "Bank Account",
        "Stripe Transfer ID",
        "Completed Date",
        "Transaction Count",
      ].join(","),
    ];

    for (const payout of payouts) {
      const items = await db.payout_items.find({
        payout_id: payout.id,
      });

      csv.push(
        [
          payout.id,
          payout.created_at.toISOString().split("T")[0],
          payout.amount.toFixed(2),
          payout.status,
          `${payout.bank_name} ****${payout.bank_account_last4}`,
          payout.stripe_transfer_id || "",
          payout.completed_at
            ? payout.completed_at.toISOString().split("T")[0]
            : "",
          items.length,
        ].join(",")
      );
    }

    return {
      data: csv.join("\n"),
      filename: `payout-history-${new Date().toISOString().split("T")[0]}.csv`,
      contentType: "text/csv",
    };
  }

  return {
    data: JSON.stringify(payouts, null, 2),
    filename: `payout-history-${new Date().toISOString().split("T")[0]}.json`,
    contentType: "application/json",
  };
}
```

---

## Webhook Handling

### POST /webhooks/stripe/connect/transfer-updated

**Stripe webhook for transfer status changes**

**Event Types:**

- `transfer.created`
- `transfer.updated`
- `transfer.paid`
- `transfer.reversed`
- `transfer.failed`

**Processing Logic:**

```typescript
async function handleTransferUpdated(event: Stripe.Event) {
  const transfer = event.data.object as Stripe.Transfer;

  // 1. Find payout by Stripe transfer ID
  const payout = await db.payouts.findOne({
    stripe_transfer_id: transfer.id,
  });

  if (!payout) {
    console.warn("Payout not found for transfer:", transfer.id);
    return;
  }

  // 2. Update payout status
  const status = mapTransferStatusToPayoutStatus(transfer.status);

  await db.payouts.update(payout.id, {
    stripe_transfer_status: transfer.status,
    status,
    updated_at: new Date(),
  });

  // 3. If completed, update completed_at
  if (status === "completed") {
    await db.payouts.update(payout.id, {
      completed_at: new Date(),
    });

    // Notify instructor
    await notificationService.send({
      instructorId: payout.instructor_id,
      type: "payout_completed",
      data: {
        payoutId: payout.id,
        amount: payout.amount,
        bankAccount: `${payout.bank_name} ****${payout.bank_account_last4}`,
      },
    });
  }

  // 4. If failed, set failure info
  if (status === "failed") {
    await db.payouts.update(payout.id, {
      failure_reason: transfer.failure_reason,
      failure_code: transfer.failure_code,
    });

    // Notify instructor
    await notificationService.send({
      instructorId: payout.instructor_id,
      type: "payout_failed",
      data: {
        payoutId: payout.id,
        reason: transfer.failure_reason,
      },
    });
  }
}
```

---

## Frontend Integration

### Payout History Page

```typescript
// pages/account/payouts.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function PayoutHistory() {
  const router = useRouter();
  const [payouts, setPayouts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPayouts = async () => {
      try {
        const res = await fetch("/api/instructor/payouts", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwt")}`,
          },
        });

        if (!res.ok) throw new Error("Failed to fetch payouts");

        const data = await res.json();
        setPayouts(data.payouts);
        setSummary(data.summary);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPayouts();
  }, []);

  const handleRequestPayout = async () => {
    if (!summary || summary.totalPendingPayout < 25) {
      alert("Minimum payout amount is $25");
      return;
    }

    try {
      const res = await fetch("/api/instructor/payouts/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("jwt")}`,
        },
        body: JSON.stringify({
          amount: summary.totalPendingPayout,
          payoutMethod: "bank_transfer",
        }),
      });

      const data = await res.json();
      alert("Payout request submitted!");
      // Refetch payouts
      window.location.reload();
    } catch (err) {
      alert("Failed to request payout: " + err.message);
    }
  };

  const handleExport = async () => {
    const res = await fetch("/api/instructor/payouts/export?format=csv", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("jwt")}`,
      },
    });

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payout-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="payout-history">
      <h1>Payout History</h1>

      {summary && (
        <div className="summary-cards">
          <div className="card">
            <p className="label">Total Paid Out</p>
            <p className="value">${summary.totalPaidOut.toFixed(2)}</p>
          </div>
          <div className="card">
            <p className="label">Pending Balance</p>
            <p className="value highlight">
              ${summary.totalPendingPayout.toFixed(2)}
            </p>
            <button
              onClick={handleRequestPayout}
              disabled={summary.totalPendingPayout < 25}
            >
              Request Payout
            </button>
          </div>
          <div className="card">
            <p className="label">Average Payout</p>
            <p className="value">${summary.averagePayoutAmount.toFixed(2)}</p>
          </div>
          <div className="card">
            <p className="label">Last Payout</p>
            <p className="value">
              {summary.lastPayoutDate
                ? new Date(summary.lastPayoutDate).toLocaleDateString()
                : "None"}
            </p>
          </div>
        </div>
      )}

      <div className="controls">
        <button onClick={handleExport}>Export as CSV</button>
      </div>

      <table className="payouts-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Bank Account</th>
            <th>Transactions</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((payout) => (
            <tr key={payout.payoutId}>
              <td>{new Date(payout.createdAt).toLocaleDateString()}</td>
              <td>${payout.amount.toFixed(2)}</td>
              <td>
                <span className={`status-${payout.status}`}>
                  {payout.status}
                </span>
              </td>
              <td>{payout.bankName}</td>
              <td>{payout.earningsCount}</td>
              <td>
                <button
                  onClick={() =>
                    router.push(`/account/payouts/${payout.payoutId}`)
                  }
                >
                  View Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Requirements

### Database Schema

1. Create payouts table with Stripe transfer tracking
2. Create payout_items table for transaction breakdown
3. Add indexes for efficient queries by instructor_id, created_at, status

### API Implementation

1. GET /instructor/payouts for list with pagination
2. GET /instructor/payouts/:payoutId for detailed view
3. POST /instructor/payouts/request for manual payout
4. GET /instructor/payouts/export for CSV/JSON export

### Webhook Handling

1. Handle transfer.updated events from Stripe
2. Update payout status based on transfer status
3. Notify instructor on completion/failure

### UI Components

1. Payout summary cards (total paid, pending, average)
2. Payout history table with sorting/filtering
3. Export button for CSV download
4. Request payout button (with validation)
5. Detailed payout view with transaction breakdown

---

## Acceptance Criteria

- [ ] GET /instructor/payouts returns paginated list of payouts
- [ ] Pagination works correctly with limit/offset
- [ ] Sorting by date and amount works in both directions
- [ ] Date range filter (dateFrom/dateTo) works correctly
- [ ] Status filter returns only matching payouts
- [ ] Course breakdown shows earnings per course
- [ ] GET /instructor/payouts/:payoutId returns detailed view
- [ ] Detailed view includes all transactions in payout
- [ ] Course breakdown totals match payout amount
- [ ] POST /instructor/payouts/request creates pending payout
- [ ] POST validates amount doesn't exceed pending balance
- [ ] POST validates minimum payout amount ($25)
- [ ] POST marks earnings as payout_included
- [ ] POST notifies instructor of request
- [ ] Webhook updates payout status on transfer update
- [ ] Webhook marks payout as completed when transfer paid
- [ ] Webhook notifies instructor on completion
- [ ] GET /instructor/payouts/export returns CSV file
- [ ] CSV export includes all payout records
- [ ] CSV export can be filtered by date range
- [ ] Summary stats show correct totals
- [ ] Instructor can only see their own payouts (403 for others)
- [ ] Payout history UI displays all payouts
- [ ] UI shows pending balance and request button
- [ ] UI shows course breakdown for each payout
- [ ] Export button downloads CSV file
- [ ] Payout status badges display correct color coding

## Dependencies

- **Milestone**: Revenue Calculation (03, 04) - earnings records
- **Milestone**: Stripe Connect (05) - connected accounts
- **Milestone**: Database Schema (02) - payouts tables
- **External Service**: Stripe Transfers API
- **Frontend**: Mentor Web dashboard

## Technical Notes

### Payout Processing Workflow

1. Instructor manually requests payout (pending)
2. Admin reviews and approves (in_progress)
3. Stripe transfer created and sent (in_transit)
4. Transfer completes at bank (completed)
5. Webhook updates final status

### Minimum Payout Amount

- Enforce $25 minimum to reduce bank fees
- Can be configured per business rules

### Tax Reporting

- Store YTD earnings for 1099 calculations
- Provide export with quarterly breakdown
- Note: Not actual 1099 filing, just data export

### Reconciliation

- Daily: Compare payouts.amount vs earnings sum in that payout
- Monthly: Compare total payouts vs Stripe transfers API
- Store reconciliation status for audit trail

### Future Enhancements

1. Scheduled payouts (automatic monthly payout)
2. Multiple payout destinations
3. Payout scheduling (defer to specific date)
4. ACH direct debit from instructor (reverse flow)
5. 1099-NEC generation for tax season
