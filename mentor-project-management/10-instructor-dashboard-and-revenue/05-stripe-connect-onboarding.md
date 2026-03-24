# Stripe Connect Onboarding

## Description

Implement Stripe Connect Express account setup flow for instructors. Handle onboarding flow with bank account details, tax information, and identity verification. Manage account status tracking, verification requirements, and payout routing. Support return and refresh URLs for seamless onboarding, and ensure refunds route correctly through Connect accounts.

## Affected Apps/Packages

- Backend: `hono-api` service
- Frontend: `mentor-web` (Next.js)
- Database: PostgreSQL stripe_connect_accounts table
- Payment Provider: Stripe Connect API
- External Service: Stripe

## Architecture Overview

### Account Creation Flow

```
Instructor Initiates     Stripe Account Created     Onboarding Started
   Payout Setup     →      (Express Account)    →     (in Stripe UI)
        ↓                        ↓                             ↓
   Request Sent         Account ID Stored       Link Sent to Instructor
        ↓                        ↓                             ↓
   Backend API        Database Record      Instructor Completes
   Routes to Stripe     Updated             Setup in Stripe
```

---

## API Endpoints

### POST /instructor/stripe-connect/create-account

**Initiate Stripe Connect Express account creation**

**Request:**

```http
POST /instructor/stripe-connect/create-account
Authorization: Bearer {instructor_jwt}
Content-Type: application/json

{
  "refreshUrl": "https://mentor.example.com/account/payout-setup",
  "returnUrl": "https://mentor.example.com/account/payout-setup?success=true"
}
```

**Request Parameters:**

- `refreshUrl` (required): URL to return if user exits onboarding (to restart)
- `returnUrl` (required): URL to redirect after successful onboarding

**Response (201 Created):**

```json
{
  "success": true,
  "accountId": "acct_1234567890abcdef",
  "accountStatus": "restricted_soon",
  "onboardingLink": "https://connect.stripe.com/onboarding/acct_1234567890abcdef?...",
  "expiresAt": "2024-02-25T10:30:00Z"
}
```

**Error Responses:**

- 400: Invalid refresh/return URL
- 400: Instructor already has connected account
- 401: Unauthorized (missing JWT)
- 409: Account already exists

---

### GET /instructor/stripe-connect/account-status

**Check Stripe Connect account status and verification requirements**

**Request:**

```http
GET /instructor/stripe-connect/account-status
Authorization: Bearer {instructor_jwt}
```

**Response (200 OK):**

```json
{
  "accountId": "acct_1234567890abcdef",
  "status": "active",
  "chargesEnabled": true,
  "payoutsEnabled": true,
  "requirements": {
    "currentlyDue": [],
    "eventuallyDue": [],
    "pastDue": [],
    "pendingVerification": []
  },
  "charges": {
    "enabled": true,
    "disabledReason": null
  },
  "payouts": {
    "enabled": true,
    "interval": "daily",
    "schedule": {
      "intervalCount": 1,
      "type": "daily"
    },
    "disabledReason": null
  },
  "bankAccount": {
    "id": "ba_1234567890abcdef",
    "accountHolderName": "Jane Doe",
    "accountNumber": "••••••••1234",
    "routingNumber": "121000248",
    "bankName": "Wells Fargo",
    "accountHolderType": "individual",
    "status": "verified",
    "last4": "1234"
  },
  "identity": {
    "verificationStatus": "verified",
    "verifiedAt": "2024-02-15T08:30:00Z"
  },
  "nextPayoutDate": "2024-02-19T00:00:00Z",
  "createdAt": "2024-02-01T14:22:00Z",
  "updatedAt": "2024-02-18T10:30:00Z"
}
```

**Status Values:**

- `active`: Account fully operational
- `restricted`: Charges/payouts partially disabled
- `restricted_soon`: Will be restricted if requirements not met
- `pending_verification`: Awaiting identity or bank verification
- `rejected`: Account rejected (contact support)

---

### POST /instructor/stripe-connect/refresh-account

**Refresh onboarding if incomplete (returns new onboarding link)**

**Request:**

```http
POST /instructor/stripe-connect/refresh-account
Authorization: Bearer {instructor_jwt}

{
  "refreshUrl": "https://mentor.example.com/account/payout-setup",
  "returnUrl": "https://mentor.example.com/account/payout-setup?success=true"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "accountId": "acct_1234567890abcdef",
  "onboardingLink": "https://connect.stripe.com/onboarding/acct_1234567890abcdef?...",
  "expiresAt": "2024-02-25T10:30:00Z"
}
```

---

## Data Model

### stripe_connect_accounts Table

```sql
CREATE TABLE stripe_connect_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Instructor reference
  instructor_id UUID NOT NULL UNIQUE REFERENCES instructors(id) ON DELETE CASCADE,

  -- Stripe account info
  stripe_account_id VARCHAR(64) UNIQUE NOT NULL,  -- acct_xxx
  account_type VARCHAR(32) DEFAULT 'express',  -- express, standard, custom

  -- Account status tracking
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  -- pending, active, restricted, restricted_soon, pending_verification, rejected

  charges_enabled BOOLEAN DEFAULT FALSE,
  payouts_enabled BOOLEAN DEFAULT FALSE,

  -- Requirements (JSONB for flexible schema)
  currently_due JSONB DEFAULT '[]'::jsonb,  -- Array of required fields
  eventually_due JSONB DEFAULT '[]'::jsonb,
  past_due JSONB DEFAULT '[]'::jsonb,
  pending_verification JSONB DEFAULT '[]'::jsonb,

  -- Bank account info
  bank_account_id VARCHAR(64),  -- ba_xxx
  bank_account_last4 VARCHAR(4),
  bank_account_bank_name VARCHAR(255),
  bank_account_holder_name VARCHAR(255),
  bank_account_holder_type VARCHAR(32),  -- individual, company
  bank_account_verified BOOLEAN DEFAULT FALSE,
  bank_account_verified_at TIMESTAMP NULL,

  -- Identity verification
  identity_verification_status VARCHAR(32),  -- unverified, pending, verified, failed
  identity_verified_at TIMESTAMP NULL,
  identity_verification_document VARCHAR(255),  -- reference to stored ID doc

  -- Payout settings
  default_currency VARCHAR(3) DEFAULT 'USD',
  payout_interval VARCHAR(32) DEFAULT 'daily',  -- daily, weekly, monthly
  next_payout_date TIMESTAMP NULL,

  -- Dashboard URL
  dashboard_url VARCHAR(512),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  activated_at TIMESTAMP NULL,
  rejected_at TIMESTAMP NULL,

  -- Constraints
  CONSTRAINT valid_status CHECK (
    status IN ('pending', 'active', 'restricted', 'restricted_soon', 'pending_verification', 'rejected')
  )
);

CREATE INDEX idx_stripe_connect_accounts_instructor_id
  ON stripe_connect_accounts(instructor_id);
CREATE INDEX idx_stripe_connect_accounts_status
  ON stripe_connect_accounts(status);
CREATE INDEX idx_stripe_connect_accounts_stripe_account_id
  ON stripe_connect_accounts(stripe_account_id);
```

### Webhook Events for Account Status Table

```sql
CREATE TABLE stripe_connect_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  stripe_connect_account_id UUID NOT NULL REFERENCES stripe_connect_accounts(id),
  instructor_id UUID NOT NULL REFERENCES instructors(id),

  -- Event details
  event_type VARCHAR(255) NOT NULL,  -- account.updated, account.application.authorized, etc.
  stripe_event_id VARCHAR(255) UNIQUE,

  -- Event data snapshot
  event_data JSONB,

  -- Timestamps
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,

  -- Tracking
  status VARCHAR(32) DEFAULT 'pending'  -- pending, processed, failed
);

CREATE INDEX idx_stripe_connect_webhook_events_instructor_id
  ON stripe_connect_webhook_events(instructor_id);
CREATE INDEX idx_stripe_connect_webhook_events_event_type
  ON stripe_connect_webhook_events(event_type);
```

---

## Implementation Details

### Create Stripe Connect Express Account

```typescript
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function createConnectAccount(
  instructorId: string,
  instructorEmail: string,
  instructorName: string,
  refreshUrl: string,
  returnUrl: string,
) {
  // 1. Check if account already exists
  const existing = await db.stripe_connect_accounts.findOne({
    instructor_id: instructorId,
  });

  if (existing) {
    throw new Error("Instructor already has a Stripe Connect account");
  }

  // 2. Validate URLs
  if (!isValidUrl(refreshUrl) || !isValidUrl(returnUrl)) {
    throw new Error("Invalid refresh or return URL");
  }

  // 3. Create Express account
  const account = await stripe.accounts.create({
    type: "express",
    email: instructorEmail,
    country: "US",
    metadata: {
      instructorId,
      instructorName,
    },
  });

  // 4. Store in database
  await db.stripe_connect_accounts.create({
    instructor_id: instructorId,
    stripe_account_id: account.id,
    status: "pending",
    created_at: new Date(),
  });

  // 5. Create onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    type: "account_onboarding",
    refresh_url: refreshUrl,
    return_url: returnUrl,
  });

  return {
    accountId: account.id,
    onboardingLink: accountLink.url,
    expiresAt: new Date(accountLink.expires_at * 1000),
  };
}
```

### Refresh Onboarding Link

```typescript
async function refreshConnectAccountOnboarding(
  instructorId: string,
  refreshUrl: string,
  returnUrl: string,
) {
  // 1. Get existing account
  const connectAccount = await db.stripe_connect_accounts.findOne({
    instructor_id: instructorId,
  });

  if (!connectAccount) {
    throw new Error("No Stripe Connect account found");
  }

  // 2. Validate URLs
  if (!isValidUrl(refreshUrl) || !isValidUrl(returnUrl)) {
    throw new Error("Invalid refresh or return URL");
  }

  // 3. Create new onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: connectAccount.stripe_account_id,
    type: "account_onboarding",
    refresh_url: refreshUrl,
    return_url: returnUrl,
  });

  return {
    accountId: connectAccount.stripe_account_id,
    onboardingLink: accountLink.url,
    expiresAt: new Date(accountLink.expires_at * 1000),
  };
}
```

### Fetch Account Status

```typescript
async function getConnectAccountStatus(instructorId: string) {
  const connectAccount = await db.stripe_connect_accounts.findOne({
    instructor_id: instructorId,
  });

  if (!connectAccount) {
    return null;
  }

  // Fetch fresh data from Stripe
  const account = await stripe.accounts.retrieve(
    connectAccount.stripe_account_id,
  );

  // Update local record
  await db.stripe_connect_accounts.update(connectAccount.id, {
    status: determineAccountStatus(account),
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    currently_due: account.requirements?.currently_due || [],
    eventually_due: account.requirements?.eventually_due || [],
    past_due: account.requirements?.past_due || [],
    pending_verification: account.requirements?.pending_verification || [],
    updated_at: new Date(),
  });

  // Extract bank account info
  const externalAccount = account.external_accounts?.data[0];

  return {
    accountId: account.id,
    status: determineAccountStatus(account),
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    requirements: {
      currentlyDue: account.requirements?.currently_due || [],
      eventuallyDue: account.requirements?.eventually_due || [],
      pastDue: account.requirements?.past_due || [],
      pendingVerification: account.requirements?.pending_verification || [],
    },
    charges: {
      enabled: account.charges_enabled,
      disabledReason: account.requirements?.disabled_reason,
    },
    payouts: {
      enabled: account.payouts_enabled,
      interval: account.payout_schedule?.interval,
      schedule: {
        intervalCount: account.payout_schedule?.interval_count,
        type: account.payout_schedule?.type,
      },
      disabledReason: account.requirements?.disabled_reason,
    },
    bankAccount: externalAccount
      ? {
          id: externalAccount.id,
          accountHolderName: externalAccount.account_holder_name,
          accountNumber: externalAccount.account_number,
          routingNumber: externalAccount.routing_number,
          bankName: externalAccount.bank_name,
          accountHolderType: externalAccount.account_holder_type,
          status: externalAccount.status,
          last4: externalAccount.last4,
        }
      : null,
    identity: {
      verificationStatus: account.verification?.status,
      verifiedAt: account.verification?.verified_at
        ? new Date(account.verification.verified_at * 1000)
        : null,
    },
    nextPayoutDate: account.next_payout_on
      ? new Date(account.next_payout_on * 1000)
      : null,
    createdAt: new Date(account.created * 1000),
    updatedAt: new Date(),
  };
}

function determineAccountStatus(account: Stripe.Account): string {
  if (!account.charges_enabled || !account.payouts_enabled) {
    if (account.requirements?.disabled_reason === "platform_paused") {
      return "pending_verification";
    }
    if (
      account.requirements?.currently_due &&
      account.requirements.currently_due.length > 0
    ) {
      return "restricted";
    }
    if (
      account.requirements?.eventually_due &&
      account.requirements.eventually_due.length > 0
    ) {
      return "restricted_soon";
    }
  }

  return account.charges_enabled && account.payouts_enabled
    ? "active"
    : "restricted";
}
```

---

## Webhook Handling

### POST /webhooks/stripe/connect/account-updated

**Stripe webhook for Connect account changes**

**Event Types:**

- `account.updated`: Account details changed
- `account.application.authorized`: Application authorized
- `account.application.deauthorized`: Account disconnected
- `charge.refunded`: Refund issued (routing through Connect)

**Request Body (example account.updated):**

```json
{
  "id": "evt_connect_123",
  "type": "account.updated",
  "account": "acct_1234567890abcdef",
  "data": {
    "object": {
      "id": "acct_1234567890abcdef",
      "charges_enabled": true,
      "payouts_enabled": true,
      "requirements": {
        "currently_due": [],
        "eventually_due": [],
        "past_due": [],
        "disabled_reason": null
      }
    }
  }
}
```

**Processing Logic:**

```typescript
async function handleConnectAccountUpdated(event: Stripe.Event) {
  const account = event.data.object as Stripe.Account;

  // 1. Find instructor
  const connectAccount = await db.stripe_connect_accounts.findOne({
    stripe_account_id: account.id,
  });

  if (!connectAccount) {
    console.warn("Connect account not found:", account.id);
    return;
  }

  // 2. Update status
  const status = determineAccountStatus(account);

  await db.stripe_connect_accounts.update(connectAccount.id, {
    status,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    currently_due: account.requirements?.currently_due || [],
    eventually_due: account.requirements?.eventually_due || [],
    past_due: account.requirements?.past_due || [],
    pending_verification: account.requirements?.pending_verification || [],
    updated_at: new Date(),
  });

  // 3. If activated, notify instructor
  if (status === "active") {
    await notificationService.send({
      instructorId: connectAccount.instructor_id,
      type: "stripe_connect_activated",
      data: {
        accountId: account.id,
      },
    });
  }

  // 4. If restricted, notify instructor
  if (
    status === "restricted" ||
    status === "restricted_soon" ||
    status === "pending_verification"
  ) {
    await notificationService.send({
      instructorId: connectAccount.instructor_id,
      type: "stripe_connect_needs_attention",
      data: {
        accountId: account.id,
        currentlyDue: account.requirements?.currently_due,
        status,
      },
    });
  }

  // 5. Store webhook event for audit
  await db.stripe_connect_webhook_events.create({
    stripe_connect_account_id: connectAccount.id,
    instructor_id: connectAccount.instructor_id,
    event_type: event.type,
    stripe_event_id: event.id,
    event_data: event.data,
    received_at: new Date(),
  });

  return { success: true };
}
```

---

## Payout Routing & Refund Handling

### Payout Creation (Manual Trigger)

```typescript
async function createPayout(instructorId: string, amount: number) {
  // 1. Get Stripe Connect account
  const connectAccount = await db.stripe_connect_accounts.findOne({
    instructor_id: instructorId,
  });

  if (!connectAccount) {
    throw new Error("No Stripe Connect account found");
  }

  if (!connectAccount.payouts_enabled) {
    throw new Error("Payouts not enabled for this account");
  }

  // 2. Create Stripe transfer (payout)
  const transfer = await stripe.transfers.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: "usd",
    destination: connectAccount.stripe_account_id,
    description: `Payout for instructor ${instructorId}`,
    metadata: {
      instructorId,
      payoutId: payoutId,
    },
  });

  // 3. Record payout in database
  const payout = await db.payouts.create({
    instructor_id: instructorId,
    amount,
    stripe_transfer_id: transfer.id,
    status: "in_progress",
    created_at: new Date(),
  });

  return {
    payoutId: payout.id,
    stripeTransferId: transfer.id,
    amount,
    status: "in_progress",
  };
}
```

### Refund Routing (via Stripe Checkout)

When instructor refunds are processed, ensure refunds route through Connect:

```typescript
// When creating Stripe charge, include on_behalf_of
const charge = await stripe.charges.create({
  amount: Math.round(grossAmount * 100),
  currency: "usd",
  source: stripeToken,
  on_behalf_of: connectAccountId, // Route through instructor's Connect account
  metadata: {
    courseId,
    instructorId,
    studentId,
  },
});

// Refund automatically routes back to original payment method
const refund = await stripe.refunds.create({
  charge: charge.id,
  reason: "requested_by_customer",
  metadata: {
    instructorId,
  },
});
```

---

## Frontend Integration

### Payout Setup Page (`/account/payout-setup`)

```typescript
// Next.js page component
import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export default function PayoutSetup() {
  const router = useRouter();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkAccountStatus = async () => {
      try {
        const res = await fetch("/api/instructor/stripe-connect/account-status", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwt")}`,
          },
        });

        if (!res.ok) {
          if (res.status === 404) {
            // No account yet, need to create one
            setAccount(null);
          } else {
            throw new Error("Failed to fetch account status");
          }
        } else {
          const data = await res.json();
          setAccount(data);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkAccountStatus();
  }, []);

  const handleCreateAccount = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        "/api/instructor/stripe-connect/create-account",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("jwt")}`,
          },
          body: JSON.stringify({
            refreshUrl: `${window.location.origin}/account/payout-setup`,
            returnUrl: `${window.location.origin}/account/payout-setup?success=true`,
          }),
        }
      );

      const data = await res.json();
      window.location.href = data.onboardingLink;  // Redirect to Stripe
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        "/api/instructor/stripe-connect/refresh-account",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("jwt")}`,
          },
          body: JSON.stringify({
            refreshUrl: `${window.location.origin}/account/payout-setup`,
            returnUrl: `${window.location.origin}/account/payout-setup?success=true`,
          }),
        }
      );

      const data = await res.json();
      window.location.href = data.onboardingLink;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  if (!account) {
    return (
      <div className="payout-setup">
        <h1>Set Up Payouts</h1>
        <p>Connect your bank account to receive payouts.</p>
        <button onClick={handleCreateAccount} disabled={loading}>
          {loading ? "Setting up..." : "Connect Bank Account"}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="payout-setup">
      <h1>Payout Settings</h1>
      <div className="account-status">
        <p>
          <strong>Status:</strong>{" "}
          <span className={`status-${account.status}`}>
            {account.status}
          </span>
        </p>
        <p>
          <strong>Charges Enabled:</strong> {account.chargesEnabled ? "Yes" : "No"}
        </p>
        <p>
          <strong>Payouts Enabled:</strong> {account.payoutsEnabled ? "Yes" : "No"}
        </p>
      </div>

      {account.requirements.currentlyDue.length > 0 && (
        <div className="alert alert-warning">
          <p>Your account needs the following information:</p>
          <ul>
            {account.requirements.currentlyDue.map((req) => (
              <li key={req}>{req}</li>
            ))}
          </ul>
          <button onClick={handleRefresh} disabled={loading}>
            Complete Setup
          </button>
        </div>
      )}

      {account.bankAccount && (
        <div className="bank-account">
          <h3>Bank Account</h3>
          <p>
            <strong>{account.bankAccount.bankName}</strong>
          </p>
          <p>Ending in {account.bankAccount.last4}</p>
          <p>
            <strong>Status:</strong> {account.bankAccount.status}
          </p>
        </div>
      )}

      {account.status === "active" && (
        <div className="alert alert-success">
          Your account is fully set up and ready to receive payouts.
        </div>
      )}
    </div>
  );
}
```

---

## Requirements

### Stripe Setup

1. Create Stripe Connect platform account (if not exists)
2. Configure API keys (secret key in backend environment)
3. Configure webhook endpoint for account events
4. Set up return/refresh URL patterns in documentation

### Database

1. Create stripe_connect_accounts table
2. Create stripe_connect_webhook_events table
3. Add indexes for fast lookup by instructor_id and stripe_account_id

### Webhook Configuration

1. Register webhook endpoint with Stripe for:
   - `account.updated`
   - `account.application.authorized`
   - `account.application.deauthorized`
2. Verify webhook signature on every request

### Frontend

1. Payout setup page at `/account/payout-setup`
2. Show account status and requirements
3. Button to create or refresh account
4. Notification on success/failure

---

## Acceptance Criteria

- [ ] POST /instructor/stripe-connect/create-account creates Express account
- [ ] Onboarding link redirects to Stripe hosted UI
- [ ] Account ID stored in database for future reference
- [ ] GET /instructor/stripe-connect/account-status returns current status
- [ ] Status includes charges_enabled and payouts_enabled flags
- [ ] Status includes requirements (currently_due, eventually_due, past_due)
- [ ] Status includes bank account details (last4, bank name, verification status)
- [ ] Status includes identity verification status
- [ ] POST /instructor/stripe-connect/refresh-account generates new onboarding link
- [ ] Refresh link works multiple times if incomplete
- [ ] Webhook handles account.updated events
- [ ] Webhook updates status in database
- [ ] Webhook notifies instructor when account activated
- [ ] Webhook notifies instructor when account needs attention
- [ ] Payout creation routes through instructor's Connect account
- [ ] Refunds automatically route to original payment method
- [ ] Instructor can only see their own account status (403 for others)
- [ ] URL validation prevents open redirect vulnerabilities
- [ ] Account status is cached with short TTL (5 min) to avoid API quota issues
- [ ] Error messages are user-friendly
- [ ] Test Stripe account works in development
- [ ] Live Stripe account works in production

## Dependencies

- **Milestone**: Authentication (04-authentication-and-onboarding) for instructor JWT
- **Milestone**: Database Schema (02-database-schema) for stripe_connect_accounts table
- **External Service**: Stripe Connect API
- **Frontend**: Mentor Web dashboard

## Technical Notes

### Express vs Standard vs Custom

- **Express** (recommended): Fully hosted Stripe UI, fast onboarding
- **Standard**: More control, requires more integration
- **Custom**: Full control, most integration work

Implementation uses **Express** for best UX.

### Account Linking Gotchas

1. Can only create one Express account per instructor
2. Onboarding links expire after 24 hours
3. Can't revoke authorization from platform (instructor must disconnect)

### Payout Schedule

- Default: Daily automatic payouts
- Configurable: Weekly or monthly
- Transfers take 2-3 business days to appear in bank account

### Refund Handling

- Refunds must be issued within 180 days of charge
- Routing via `on_behalf_of` ensures refund goes to original payment method
- Clawed back from instructor earnings if after payout

### Monitoring

- Alert if account status changes to restricted
- Alert if instructor has been disabled
- Daily reconciliation: check all accounts have recent status update

### Security

- Never store bank account numbers in plaintext
- Validate onboarding URLs to prevent open redirect
- Webhook signature verification required
- JWT required for all instructor endpoints

### Testing

- Use Stripe test API keys
- Create test platform account for sandbox testing
- Use test card numbers for test mode charges
- Webhook events can be simulated via Stripe CLI
