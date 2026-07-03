# M2-T7 · Privacy Policy + Terms of Service Acceptance

| Field          | Value                                                           |
| -------------- | --------------------------------------------------------------- |
| **Milestone**  | M2 — Authentication & Persona System                            |
| **Status**     | 🔲 To Do                                                        |
| **Depends on** | M2-T1 (sign-up flow), M1-T2 (DB schema — `user_consents` table) |
| **PRD Ref**    | Section 9 (GDPR), Section 4.1 (Sign-Up)                         |

---

## Description

Capture explicit user consent to the Privacy Policy and Terms of Service at sign-up. This is a **legal requirement** under GDPR Article 6 for the Irish client (Chongie Entertainment Services). Consent must be opt-in (checkbox, not pre-ticked), recorded with a timestamp and the policy version the user accepted, and stored permanently. Users cannot complete sign-up without accepting both. A separate marketing communications opt-in is captured at the same time (optional).

---

## Affected Apps / Packages

| App / Package | Role                                                                             |
| ------------- | -------------------------------------------------------------------------------- |
| `apps/api`    | Consent recording endpoint, policy version config, consent validation on sign-up |
| `apps/mobile` | Consent checkboxes on Sign-Up screen, links to policy documents                  |

---

## API Endpoints

### POST /api/v1/users/consent

Record user consent after sign-up. Called once immediately after account creation, before onboarding.

**Request Body:**

```json
{
  "privacyPolicyAccepted": true,
  "termsAccepted": true,
  "marketingOptIn": false
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Consent recorded."
}
```

**Error Responses:**

- `400 Bad Request` — `privacyPolicyAccepted` or `termsAccepted` is false
- `409 Conflict` — Consent already recorded for this user

### GET /api/v1/users/consent

Return the user's current consent record (used to check if re-acceptance is needed after policy update).

**Response (200 OK):**

```json
{
  "success": true,
  "consent": {
    "privacyPolicyVersion": "1.0",
    "termsVersion": "1.0",
    "acceptedAt": "2026-03-20T10:00:00Z",
    "marketingOptIn": false
  }
}
```

---

## Requirements

### Consent Capture at Sign-Up

- Sign-Up screen includes two mandatory checkboxes (unchecked by default):
  - "I agree to the [Privacy Policy]" — required
  - "I agree to the [Terms of Service]" — required
- One optional checkbox:
  - "I'd like to receive updates and news from CeolX" (marketing opt-in)
- Submit button disabled until both mandatory checkboxes are ticked
- Policy links open in an in-app web view (not external browser)
- Consent is recorded server-side via `POST /api/v1/users/consent` immediately after account creation

### Consent Storage

- `user_consents` table stores: `user_id`, `privacy_policy_version`, `terms_version`, `accepted_at` (UTC timestamp), `marketing_opt_in`
- Policy versions stored as strings (e.g. `"1.0"`) — configurable via env var or server config
- Consent record is immutable — never updated in-place. If user re-accepts after a policy update, insert a new row
- Consent records are never hard-deleted (GDPR audit trail)

### Policy Version Enforcement

- Current policy versions defined in server config: `PRIVACY_POLICY_VERSION` and `TERMS_VERSION`
- On each sign-in, `authMiddleware` checks if user's accepted version matches current version
- If versions differ: user is redirected to a "Policy Updated" screen before accessing the app
- User must re-accept updated policies before proceeding

### GDPR Data Rights

- **Right to erasure**: account deletion anonymises personal data in `user_consents` (nullify `user_id` FK) but retains the consent record itself for legal compliance
- **Right to data portability**: consent records included in the user data export (M9)
- **Marketing opt-out**: user can toggle marketing opt-in from Settings at any time

---

## Acceptance Criteria

- [ ] Sign-Up screen shows two unchecked mandatory checkboxes (Privacy Policy, Terms of Service)
- [ ] Submit button remains disabled until both mandatory checkboxes are ticked
- [ ] Tapping policy links opens the document in an in-app web view
- [ ] Consent recorded server-side with timestamp and policy version after account creation
- [ ] `privacyPolicyAccepted: false` or `termsAccepted: false` returns `400`
- [ ] Consent record stored in `user_consents` table with correct versions and UTC timestamp
- [ ] If policy version is updated, user is prompted to re-accept on next sign-in
- [ ] Re-acceptance inserts a new consent row (does not overwrite)
- [ ] Marketing opt-in defaults to `false`; user can change it in Settings
- [ ] Consent records excluded from hard delete on account deletion (anonymised only)

---

## Dependencies

### Upstream

- M1-T2 (DB schema — `user_consents` table required)
- M2-T1 (sign-up flow — consent capture happens immediately after `signUp.email()` succeeds)

### Downstream

- M9 (Data Portability) — consent records included in export
- Account deletion flow — must anonymise (not delete) consent records

### External services

- None — policy documents served as static files or in-app web view URLs

---

## Technical Notes

### DB Schema (Drizzle)

```typescript
// packages/db/src/schema/user-consents.ts

import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userConsents = pgTable('user_consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  privacyPolicyVersion: varchar('privacy_policy_version', { length: 20 }).notNull(),
  termsVersion: varchar('terms_version', { length: 20 }).notNull(),
  marketingOptIn: boolean('marketing_opt_in').notNull().default(false),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### Consent Endpoint

```typescript
// apps/api/src/routes/consent.ts

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../lib/db';
import { userConsents } from '../schema';
import { authMiddleware } from '../middleware/auth';
import { env } from '../lib/env';

const consentSchema = z.object({
  privacyPolicyAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Privacy Policy to continue.' }),
  }),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms of Service to continue.' }),
  }),
  marketingOptIn: z.boolean().default(false),
});

const app = new Hono();

app.post('/consent', authMiddleware, zValidator('json', consentSchema), async (c) => {
  const userId = c.get('userId');
  const { marketingOptIn } = c.req.valid('json');

  // Check if consent already recorded
  const existing = await db.query.userConsents.findFirst({
    where: eq(userConsents.userId, userId),
    orderBy: desc(userConsents.acceptedAt),
  });

  if (
    existing &&
    existing.privacyPolicyVersion === env.PRIVACY_POLICY_VERSION &&
    existing.termsVersion === env.TERMS_VERSION
  ) {
    return c.json({ error: 'CONSENT_ALREADY_RECORDED' }, 409);
  }

  await db.insert(userConsents).values({
    userId,
    privacyPolicyVersion: env.PRIVACY_POLICY_VERSION,
    termsVersion: env.TERMS_VERSION,
    marketingOptIn,
  });

  return c.json({ success: true, message: 'Consent recorded.' });
});
```

### Mobile Sign-Up Screen (Consent Checkboxes)

```typescript
// Additions to apps/native/src/screens/Auth/SignUpScreen.tsx

import { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';

const [privacyAccepted, setPrivacyAccepted] = useState(false);
const [termsAccepted, setTermsAccepted] = useState(false);
const [marketingOptIn, setMarketingOptIn] = useState(false);

const canSubmit = privacyAccepted && termsAccepted;

// After successful sign-up, record consent:
const handleSignUp = async () => {
  // ... existing sign-up logic ...

  if (data) {
    await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/v1/users/consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session.token}`,
      },
      body: JSON.stringify({
        privacyPolicyAccepted: true,
        termsAccepted: true,
        marketingOptIn,
      }),
    });

    navigation.navigate('Onboarding');
  }
};

// JSX additions before the submit button:
const ConsentCheckboxes = () => (
  <View>
    <TouchableOpacity
      style={styles.checkboxRow}
      onPress={() => setPrivacyAccepted((v) => !v)}
    >
      <View style={[styles.checkbox, privacyAccepted && styles.checkboxChecked]} />
      <Text style={styles.checkboxLabel}>
        I agree to the{' '}
        <Text style={styles.link} onPress={() => navigation.navigate('PolicyWebView', { url: 'https://ceolx.com/privacy' })}>
          Privacy Policy
        </Text>
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.checkboxRow}
      onPress={() => setTermsAccepted((v) => !v)}
    >
      <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]} />
      <Text style={styles.checkboxLabel}>
        I agree to the{' '}
        <Text style={styles.link} onPress={() => navigation.navigate('PolicyWebView', { url: 'https://ceolx.com/terms' })}>
          Terms of Service
        </Text>
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.checkboxRow}
      onPress={() => setMarketingOptIn((v) => !v)}
    >
      <View style={[styles.checkbox, marketingOptIn && styles.checkboxChecked]} />
      <Text style={styles.checkboxLabel}>
        I'd like to receive updates and news from CeolX (optional)
      </Text>
    </TouchableOpacity>
  </View>
);
```

### Policy Version Check in Auth Middleware

```typescript
// apps/api/src/middleware/auth.ts (addition)

// After setting userId and currentRole:
const latestConsent = await db.query.userConsents.findFirst({
  where: eq(userConsents.userId, session.user.id),
  orderBy: desc(userConsents.acceptedAt),
});

const policyOutdated =
  !latestConsent ||
  latestConsent.privacyPolicyVersion !== env.PRIVACY_POLICY_VERSION ||
  latestConsent.termsVersion !== env.TERMS_VERSION;

if (policyOutdated) {
  c.set('policyUpdateRequired', true);
  // Non-consent routes still blocked by requirePolicyAcceptance middleware
}
```

---

## Common Gotchas

- **Pre-ticked checkboxes are invalid under GDPR**: Both mandatory checkboxes MUST default to unchecked. Pre-ticking voids the legal consent.
- **Consent versioning**: Always store the version string accepted, not just a boolean. When policy changes, you need to know who accepted which version.
- **Immutable consent records**: Never `UPDATE` a consent row. Always `INSERT` a new one on re-acceptance. This provides a complete audit trail.
- **Marketing opt-in is separate**: Marketing consent is optional and must be distinct from the mandatory legal consents. Bundling them together is a GDPR violation.
- **Policy links in-app**: Open policy documents in an in-app WebView (e.g. `expo-web-browser` or a `WebView` screen), not in an external browser, to keep the user in the flow.
- **Anonymise on deletion**: On account deletion, set `user_id = NULL` on consent records (or replace with an anonymised placeholder ID). Do not delete the row — consent records may be required for legal defence.

---
