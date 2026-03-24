# Privacy & Terms Acceptance

## Description

Implement explicit consent management for privacy policy and terms of service at signup. Checkboxes not pre-checked. Timestamp and policy version recorded. IP address and device metadata captured for compliance. Links to full policy documents. Re-acceptance triggered on policy version change via blocking modal on next login. Acceptance history viewable in user profile.

## Affected Apps/Packages

- Backend: Hono API
- Frontend: All web apps and mobile
- Database: Store consent records per Section 12.1 spec

## API Endpoints

### GET /auth/policies/latest

Get latest versions of privacy policy and terms.

**Response** (200 OK):

```json
{
  "privacyPolicy": {
    "version": "2.1",
    "updatedAt": "2024-02-01T00:00:00Z",
    "url": "https://example.com/privacy",
    "summaryText": "We collect your data to..."
  },
  "termsOfService": {
    "version": "2.0",
    "updatedAt": "2024-01-15T00:00:00Z",
    "url": "https://example.com/terms",
    "summaryText": "By using our service, you agree to..."
  }
}
```

### POST /auth/policies/accept

Accept privacy policy and terms of service.

**Request Body**:

```json
{
  "privacyPolicyVersion": "2.1",
  "termsOfServiceVersion": "2.0",
  "privacyPolicyAccepted": true,
  "termsOfServiceAccepted": true
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Policies accepted successfully",
  "acceptanceId": "consent_abc123",
  "acceptedAt": "2024-02-18T10:30:00Z"
}
```

**Error Responses**:

- `400 Bad Request`: Not all required policies accepted
  ```json
  {
    "error": "INCOMPLETE_CONSENT",
    "message": "Both privacy policy and terms of service must be accepted"
  }
  ```

### GET /auth/user/consent-history

Get user's consent acceptance history.

**Response** (200 OK):

```json
{
  "consents": [
    {
      "id": "consent_abc123",
      "privacyPolicyVersion": "2.1",
      "termsOfServiceVersion": "2.0",
      "acceptedAt": "2024-02-18T10:30:00Z",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "location": "San Francisco, CA"
    },
    {
      "id": "consent_xyz789",
      "privacyPolicyVersion": "2.0",
      "termsOfServiceVersion": "1.9",
      "acceptedAt": "2024-01-10T15:00:00Z",
      "ipAddress": "203.0.113.1",
      "userAgent": "Mozilla/5.0...",
      "location": "New York, NY"
    }
  ]
}
```

### GET /auth/user/policies-acceptance-status

Check if user needs to re-accept policies.

**Response** (200 OK):

```json
{
  "compliant": false,
  "requiresReAcceptance": true,
  "currentVersions": {
    "privacyPolicy": "2.1",
    "termsOfService": "2.0"
  },
  "lastAcceptedVersions": {
    "privacyPolicy": "2.0",
    "termsOfService": "1.9"
  },
  "message": "New privacy policy available. Please review and accept."
}
```

## Requirements

### Policy Versions

- Store policy version as semantic version: `major.minor`
- Example: `2.1` means version 2, release 1
- Track update timestamp (`updatedAt`)
- Maintain full policy text (or external link)
- Summary text for consent screen

### Acceptance Tracking

**Consent Record Fields**:

- `id`: Unique consent ID (UUID)
- `userId`: User who accepted
- `privacyPolicyVersion`: Version accepted
- `termsOfServiceVersion`: Version accepted
- `privacyPolicyAccepted`: boolean
- `termsOfServiceAccepted`: boolean
- `acceptedAt`: Timestamp (UTC)
- `ipAddress`: Client IP
- `userAgent`: Browser user agent
- `location`: Geolocation (city, country)
- `createdAt`: When record created

### Signup Form

- Display links to full policy documents
- Non-pre-checked checkboxes: "I agree to the Privacy Policy"
- Non-pre-checked checkboxes: "I agree to the Terms of Service"
- Both checkboxes required to sign up
- Form disabled until both checked
- Links open in new tab/window
- Mobile: Show policy text in modal or expanded section

### Policy Change Detection

- On login, check if user's accepted versions match current versions
- If policy version higher than accepted version:
  - Set `requiresReAcceptance: true`
  - Show blocking modal on dashboard
  - Prevent access to features until re-accepted
  - Modal shows summary of changes (optional)
  - Must explicitly accept new version

### Re-acceptance Flow

- Check on every login (via `/auth/user/policies-acceptance-status`)
- If `requiresReAcceptance: true`:
  - Show blocking modal/screen
  - Display current versions
  - Display previous versions accepted
  - Show summary of changes (optional)
  - Cannot dismiss without accepting
  - No back button
- On acceptance:
  - Create new consent record
  - Update user last accepted versions
  - Clear blocking state
  - Redirect to dashboard

### Consent History

- User can view all past acceptances
- Show date, version numbers, IP, location
- Export as CSV for personal records (optional)
- Retention: Indefinite (for legal compliance)

### Device & Location Tracking

- IP address: Capture on every consent
- User agent: Parse to get browser, OS, device type
- Geolocation: Use GeoIP to get country, city
- Privacy note: "We record your IP and device for security"
- Explain in privacy notice: Why we track

### Compliance Features

- Audit trail: Full history of all acceptances
- Export: Download consent history
- Retraction: Allow user to view/withdraw consent (optional, depends on jurisdiction)
- GDPR: Support consent withdrawal per GDPR requirements

### Database Schema

```typescript
export const policyVersions = pgTable("policy_version", {
  id: text("id").primaryKey(),
  policyType: text("policy_type").notNull(), // 'privacy', 'terms'
  version: text("version").notNull(), // '2.1'
  content: text("content").notNull(), // Full policy text
  summaryText: text("summary_text"), // Brief summary
  externalUrl: text("external_url"), // Link to hosted policy
  effectiveAt: timestamp("effective_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userConsents = pgTable("user_consent", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  privacyPolicyVersion: text("privacy_policy_version").notNull(),
  termsOfServiceVersion: text("terms_of_service_version").notNull(),
  privacyPolicyAccepted: boolean("privacy_policy_accepted")
    .notNull()
    .default(false),
  termsOfServiceAccepted: boolean("terms_of_service_accepted")
    .notNull()
    .default(false),
  acceptedAt: timestamp("accepted_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  location: jsonb("location"), // { country, city, timezone }
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Indexes
createIndex("user_consent_user_id_idx").on(userConsents.userId);
createIndex("user_consent_accepted_at_idx").on(userConsents.acceptedAt);
createIndex("policy_version_type_version_idx")
  .on(policyVersions.policyType, policyVersions.version)
  .unique();
```

### Signup Form Component

```typescript
// components/SignupForm.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';

export function SignupForm() {
  const [policiesData, setPoliciesData] = useState(null);
  const { register, watch, formState: { isValid } } = useForm({
    defaultValues: {
      privacyPolicyAccepted: false,
      termsOfServiceAccepted: false,
    }
  });

  const privacyAccepted = watch('privacyPolicyAccepted');
  const termsAccepted = watch('termsOfServiceAccepted');

  const handleSubmit = async (data) => {
    // Include policy versions in signup
    const signupData = {
      ...data,
      privacyPolicyVersion: policiesData.privacyPolicy.version,
      termsOfServiceVersion: policiesData.termsOfService.version,
    };

    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(signupData),
    });

    // Handle response...
  };

  useEffect(() => {
    // Fetch latest policy versions
    fetch('/api/auth/policies/latest')
      .then(r => r.json())
      .then(setPoliciesData);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="signup-form">
      {/* Email, password fields... */}

      <div className="policy-section">
        <label className="checkbox">
          <input
            type="checkbox"
            {...register('privacyPolicyAccepted')}
          />
          <span>
            I agree to the{' '}
            <a href={policiesData?.privacyPolicy.url} target="_blank">
              Privacy Policy
            </a>
            *
          </span>
        </label>

        <label className="checkbox">
          <input
            type="checkbox"
            {...register('termsOfServiceAccepted')}
          />
          <span>
            I agree to the{' '}
            <a href={policiesData?.termsOfService.url} target="_blank">
              Terms of Service
            </a>
            *
          </span>
        </label>

        <p className="note">
          We store your IP and device info to comply with legal requirements.
        </p>
      </div>

      <button
        type="submit"
        disabled={!privacyAccepted || !termsAccepted}
        className="btn-primary"
      >
        Create Account
      </button>
    </form>
  );
}
```

### Policy Update Modal

```typescript
// components/PolicyUpdateModal.tsx
'use client';

import { useEffect, useState } from 'react';

export function PolicyUpdateModal() {
  const [requiresReAcceptance, setRequiresReAcceptance] = useState(false);
  const [newVersions, setNewVersions] = useState(null);
  const [oldVersions, setOldVersions] = useState(null);
  const [acceptanceLoading, setAcceptanceLoading] = useState(false);

  useEffect(() => {
    // Check acceptance status on mount
    fetch('/api/auth/user/policies-acceptance-status')
      .then(r => r.json())
      .then(data => {
        setRequiresReAcceptance(data.requiresReAcceptance);
        setNewVersions(data.currentVersions);
        setOldVersions(data.lastAcceptedVersions);
      });
  }, []);

  const handleAccept = async () => {
    setAcceptanceLoading(true);

    try {
      const response = await fetch('/api/auth/policies/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          privacyPolicyVersion: newVersions.privacyPolicy,
          termsOfServiceVersion: newVersions.termsOfService,
          privacyPolicyAccepted: true,
          termsOfServiceAccepted: true,
        }),
      });

      if (response.ok) {
        setRequiresReAcceptance(false);
        window.location.reload();
      }
    } finally {
      setAcceptanceLoading(false);
    }
  };

  if (!requiresReAcceptance) return null;

  return (
    <div className="modal-overlay">
      <div className="modal policy-update">
        <h2>Policy Update Required</h2>

        <p>
          Our policies have been updated. Please review and accept the new versions
          to continue using the platform.
        </p>

        <div className="version-info">
          <div className="policy">
            <h3>Privacy Policy</h3>
            <p>Updated from v{oldVersions?.privacyPolicy} to v{newVersions?.privacyPolicy}</p>
            <a href="https://example.com/privacy" target="_blank">
              Read full policy
            </a>
          </div>

          <div className="policy">
            <h3>Terms of Service</h3>
            <p>Updated from v{oldVersions?.termsOfService} to v{newVersions?.termsOfService}</p>
            <a href="https://example.com/terms" target="_blank">
              Read full policy
            </a>
          </div>
        </div>

        <div className="acceptance-form">
          <label>
            <input type="checkbox" disabled checked />
            I accept the updated Privacy Policy
          </label>

          <label>
            <input type="checkbox" disabled checked />
            I accept the updated Terms of Service
          </label>
        </div>

        <button
          onClick={handleAccept}
          disabled={acceptanceLoading}
          className="btn-primary"
        >
          {acceptanceLoading ? 'Accepting...' : 'Accept & Continue'}
        </button>
      </div>
    </div>
  );
}
```

### Hono Handlers

```typescript
export async function handleGetLatestPolicies(c: Context) {
  const privacy = await db.query.policyVersions.findFirst({
    where: eq(policyVersions.policyType, "privacy"),
    orderBy: desc(policyVersions.version),
  });

  const terms = await db.query.policyVersions.findFirst({
    where: eq(policyVersions.policyType, "terms"),
    orderBy: desc(policyVersions.version),
  });

  return c.json({
    privacyPolicy: {
      version: privacy?.version,
      updatedAt: privacy?.updatedAt,
      url: privacy?.externalUrl || "https://example.com/privacy",
      summaryText: privacy?.summaryText,
    },
    termsOfService: {
      version: terms?.version,
      updatedAt: terms?.updatedAt,
      url: terms?.externalUrl || "https://example.com/terms",
      summaryText: terms?.summaryText,
    },
  });
}

export async function handleAcceptPolicies(c: Context) {
  const user = c.get("auth.user");
  if (!user) return c.json({ error: "UNAUTHORIZED" }, 401);

  const {
    privacyPolicyVersion,
    termsOfServiceVersion,
    privacyPolicyAccepted,
    termsOfServiceAccepted,
  } = await c.req.json();

  // Validate both accepted
  if (!privacyPolicyAccepted || !termsOfServiceAccepted) {
    return c.json({ error: "INCOMPLETE_CONSENT" }, 400);
  }

  // Create consent record
  const consentId = crypto.randomUUID();
  const ipAddress = getClientIp(c);
  const userAgent = c.req.header("user-agent");
  const location = getLocationFromIP(ipAddress);

  const consent = await db
    .insert(userConsents)
    .values({
      id: consentId,
      userId: user.id,
      privacyPolicyVersion,
      termsOfServiceVersion,
      privacyPolicyAccepted: true,
      termsOfServiceAccepted: true,
      ipAddress,
      userAgent,
      location,
    })
    .returning();

  // Log for audit
  console.log(
    `Policies accepted by user ${user.id}: v${privacyPolicyVersion}/v${termsOfServiceVersion}`,
  );

  return c.json({
    success: true,
    message: "Policies accepted successfully",
    acceptanceId: consentId,
    acceptedAt: consent[0].acceptedAt,
  });
}

export async function handleGetConsentHistory(c: Context) {
  const user = c.get("auth.user");
  if (!user) return c.json({ error: "UNAUTHORIZED" }, 401);

  const consents = await db.query.userConsents.findMany({
    where: eq(userConsents.userId, user.id),
    orderBy: desc(userConsents.acceptedAt),
  });

  return c.json({
    consents: consents.map((consent) => ({
      id: consent.id,
      privacyPolicyVersion: consent.privacyPolicyVersion,
      termsOfServiceVersion: consent.termsOfServiceVersion,
      acceptedAt: consent.acceptedAt,
      ipAddress: maskIP(consent.ipAddress),
      userAgent: maskUserAgent(consent.userAgent),
      location: consent.location
        ? `${consent.location.city}, ${consent.location.country}`
        : "Unknown",
    })),
  });
}

export async function handleGetAcceptanceStatus(c: Context) {
  const user = c.get("auth.user");
  if (!user) return c.json({ error: "UNAUTHORIZED" }, 401);

  // Get current versions
  const currentPolicies =
    (await c.req.app.env.get("policies")) || (await fetchLatestPolicies());

  // Get user's last consent
  const lastConsent = await db.query.userConsents.findFirst({
    where: eq(userConsents.userId, user.id),
    orderBy: desc(userConsents.acceptedAt),
  });

  const compliant =
    lastConsent?.privacyPolicyVersion ===
      currentPolicies.privacyPolicy.version &&
    lastConsent?.termsOfServiceVersion ===
      currentPolicies.termsOfService.version;

  return c.json({
    compliant,
    requiresReAcceptance: !compliant && lastConsent !== null,
    currentVersions: {
      privacyPolicy: currentPolicies.privacyPolicy.version,
      termsOfService: currentPolicies.termsOfService.version,
    },
    lastAcceptedVersions: lastConsent
      ? {
          privacyPolicy: lastConsent.privacyPolicyVersion,
          termsOfService: lastConsent.termsOfServiceVersion,
        }
      : null,
    message: compliant
      ? "You are compliant with current policies"
      : "New policies available. Please review and accept.",
  });
}
```

### Middleware for Policy Enforcement

```typescript
// Middleware to check policy compliance on every request
export async function withPolicyCompliance(c: Context, next: Next) {
  const user = c.get("auth.user");
  if (!user) return next();

  // Skip check for policy endpoints
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/auth/policies")) return next();

  const status = await checkPolicyCompliance(user.id);

  if (!status.compliant && status.requiresReAcceptance) {
    c.set("requiresPolicyAcceptance", true);
  }

  await next();
}
```

### Admin: Policy Management

```typescript
// POST /admin/policies/create - Create new policy version
export async function handleCreatePolicyVersion(c: Context) {
  const user = c.get("auth.user");
  if (user?.role !== "super_admin") {
    return c.json({ error: "FORBIDDEN" }, 403);
  }

  const { policyType, version, content, summaryText, externalUrl } =
    await c.req.json();

  const policyVersion = await db
    .insert(policyVersions)
    .values({
      id: crypto.randomUUID(),
      policyType,
      version,
      content,
      summaryText,
      externalUrl,
      effectiveAt: new Date(),
    })
    .returning();

  // Notify users of update
  await notifyUsersOfPolicyUpdate(policyType, version);

  return c.json({ success: true, policyVersion });
}
```

## Acceptance Criteria

- [ ] Checkbox not pre-checked in signup form
- [ ] Both privacy and terms must be accepted
- [ ] Acceptance timestamp recorded in database
- [ ] IP address captured with consent
- [ ] User agent captured with consent
- [ ] Geolocation determined from IP
- [ ] Links to full policies in signup form
- [ ] GET /auth/policies/latest returns current versions
- [ ] POST /auth/policies/accept stores consent record
- [ ] GET /auth/user/consent-history shows all acceptances
- [ ] GET /auth/user/policies-acceptance-status detects policy changes
- [ ] Policy version increment triggers re-acceptance
- [ ] Blocking modal shown on login if policies changed
- [ ] User cannot dismiss modal without accepting
- [ ] Re-acceptance creates new consent record
- [ ] Consent history viewable in account settings
- [ ] Policy update timestamps accurate
- [ ] Audit trail captures all acceptances
- [ ] Consent withdrawal supported (if GDPR required)
- [ ] Export consent history as CSV (optional)

## Dependencies

- Drizzle ORM
- Postmark (for notifications, optional)
- GeoIP library for location
- User agent parser

## Technical Notes

### Semantic Versioning for Policies

```typescript
// Helper to compare versions
function isNewVersion(oldVersion: string, newVersion: string): boolean {
  const [oldMajor, oldMinor] = oldVersion.split(".").map(Number);
  const [newMajor, newMinor] = newVersion.split(".").map(Number);

  if (newMajor > oldMajor) return true;
  if (newMajor === oldMajor && newMinor > oldMinor) return true;

  return false;
}
```

### Privacy Compliance

- GDPR: Store consent with purpose and scope
- CCPA: Allow withdrawal of consent
- LGPD: Keep consent records indefinitely
- PIPEDA: Include data collection purpose

## Verification Notes (2026-02-26)

- Code evidence:
  - `packages/api/src/routers/consent.ts` (latest policies, acceptance writes, acceptance-status checks, consent history)
  - `packages/validators/src/auth.ts` (signup requires policy acceptance fields)
  - `packages/ui/src/components/signup-form.tsx` and `consent-checkboxes.tsx`
- Verification evidence:
  - `packages/api/src/routers/__tests__/verified-guard.test.ts` verifies consent routes are gated through verified procedure.
