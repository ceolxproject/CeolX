# Task 14: Consent Records Table

## Description

Create comprehensive consent tracking tables for storing user consent and preferences around privacy policies, terms of service, cookies, marketing communications, and push notifications. Supports GDPR, CCPA, and other privacy regulations with immutable consent records. All consent records are append-only to create an auditable trail of user consent decisions.

## Affected Apps/Packages

- `packages/db` (schema definition)
- `apps/api` (consent endpoints and banners)
- `apps/web-learner` (consent dialogs and preference management)
- `apps/web-admin` (consent reporting and compliance)

## Requirements

### Consent Records Table

Create table `consent_records` for immutable consent audit trail:

| Column                 | Type           | Constraints                | Description                                                                                                      |
| ---------------------- | -------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `id`                   | `UUID`         | PK, Default: `uuid_v7()`   | Unique consent record identifier                                                                                 |
| `user_id`              | `UUID`         | FK → users(id), NOT NULL   | User giving/withdrawing consent                                                                                  |
| `consent_type`         | `VARCHAR(100)` | NOT NULL                   | Enum: privacy_policy, terms_of_service, cookie_analytics, cookie_marketing, marketing_emails, push_notifications |
| `action`               | `VARCHAR(50)`  | NOT NULL                   | Enum: granted, revoked, re_granted                                                                               |
| `policy_version`       | `VARCHAR(50)`  | NOT NULL                   | Version of policy being consented to                                                                             |
| `accepted_full_policy` | `BOOLEAN`      | DEFAULT: FALSE             | Read full policy before accepting                                                                                |
| `timestamp`            | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()` | When consent was given/withdrawn                                                                                 |
| `ip_address`           | `INET`         | NOT NULL                   | IP address where consent was given                                                                               |
| `user_agent`           | `TEXT`         | NULL                       | User-Agent header (device info)                                                                                  |
| `device_metadata`      | `JSONB`        | NULL                       | Device fingerprint or metadata                                                                                   |
| `source`               | `VARCHAR(50)`  | NOT NULL                   | Enum: mobile_app, web_learner, web_mentor, web_admin, email_link, api                                            |
| `source_url`           | `TEXT`         | NULL                       | Page URL where consent was given                                                                                 |
| `explicit_agreement`   | `BOOLEAN`      | NOT NULL, DEFAULT: FALSE   | Affirmative opt-in (not pre-checked)                                                                             |
| `notes`                | `TEXT`         | NULL                       | Admin notes about consent                                                                                        |

### Consent Type Definitions

- **privacy_policy** - Main privacy policy acceptance
- **terms_of_service** - Terms and conditions acceptance
- **cookie_analytics** - Analytics/performance cookies (GA, etc.)
- **cookie_marketing** - Marketing/advertising cookies (Meta Pixel, LinkedIn Ads, etc.)
- **marketing_emails** - Marketing email communications (newsletters, promotions)
- **push_notifications** - Push notification opt-in

### Consent Action States

- **granted** - User gave consent
- **revoked** - User withdrew previously granted consent
- **re_granted** - User re-granted consent after revoking

### Constraints for Consent Records

- No UPDATE or DELETE operations allowed (append-only, immutable)
- `timestamp` uses UTC timezone
- `explicit_agreement` must be TRUE for opt-in (not pre-checked)
- Cannot have same user with multiple "granted" for same type without intermediate revoke

### Indexes for Consent Records Table

- Primary Key: `id`
- Index: `(user_id)` - find user's consent history
- Index: `(consent_type)` - filter by consent type
- Index: `(action)` - filter by action
- Index: `(timestamp)` - chronological queries
- Composite Index: `(user_id, consent_type)` - user's consent for specific type
- Composite Index: `(user_id, consent_type, timestamp)` - user's consent timeline
- Index: `(policy_version)` - track policy version adoption
- Index: `(source)` - consent source analytics

### Device Metadata JSON Structure

Captures device information without PII:

```json
{
  "device_type": "mobile",
  "os": "iOS",
  "os_version": "17.2",
  "browser": "Safari",
  "browser_version": "17.2",
  "device_id_hash": "sha256_hash_of_device_id",
  "timezone": "America/New_York",
  "language": "en-US"
}
```

### Cookie Consent Preferences Table

Create table `cookie_consent_preferences` for current consent state:

| Column                      | Type        | Constraints                      | Description                      |
| --------------------------- | ----------- | -------------------------------- | -------------------------------- |
| `id`                        | `UUID`      | PK, Default: `uuid_v7()`         | Unique preferences record        |
| `user_id`                   | `UUID`      | FK → users(id), NOT NULL, UNIQUE | User's consent preferences       |
| `analytics_cookies_enabled` | `BOOLEAN`   | NOT NULL, DEFAULT: FALSE         | Analytics/performance cookies    |
| `marketing_cookies_enabled` | `BOOLEAN`   | NOT NULL, DEFAULT: FALSE         | Marketing/advertising cookies    |
| `strictly_necessary_only`   | `BOOLEAN`   | NOT NULL, DEFAULT: FALSE         | Only essential cookies           |
| `updated_at`                | `TIMESTAMP` | NOT NULL, DEFAULT: `now()`       | Last preference change           |
| `last_consent_timestamp`    | `TIMESTAMP` | NOT NULL                         | When last consent record created |

### Unique Constraint for Cookie Preferences

- Unique Index: `(user_id)` - one preferences record per user

### Indexes for Cookie Consent Preferences

- Primary Key: `id`
- Unique Index: `(user_id)` - uniqueness
- Index: `(analytics_cookies_enabled)` - filter for analytics scripts
- Index: `(marketing_cookies_enabled)` - filter for marketing pixels
- Index: `(updated_at)` - recent changes

### Email Consent Preferences Table

Create table `email_consent_preferences`:

| Column                         | Type           | Constraints                      | Description                     |
| ------------------------------ | -------------- | -------------------------------- | ------------------------------- |
| `id`                           | `UUID`         | PK, Default: `uuid_v7()`         | Unique preferences record       |
| `user_id`                      | `UUID`         | FK → users(id), NOT NULL, UNIQUE | User's email preferences        |
| `marketing_emails_enabled`     | `BOOLEAN`      | NOT NULL, DEFAULT: FALSE         | Promotional emails              |
| `transactional_emails_enabled` | `BOOLEAN`      | NOT NULL, DEFAULT: TRUE          | Order, account, security emails |
| `digest_emails_enabled`        | `BOOLEAN`      | NOT NULL, DEFAULT: FALSE         | Weekly/monthly digest emails    |
| `unsubscribe_token`            | `VARCHAR(100)` | UNIQUE                           | Token for one-click unsubscribe |
| `unsubscribed_at`              | `TIMESTAMP`    | NULL                             | When user unsubscribed          |
| `unsubscribe_reason`           | `VARCHAR(100)` | NULL                             | Reason for unsubscribe          |
| `updated_at`                   | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()`       | Last preference change          |

### Unique Constraint for Email Preferences

- Unique Index: `(user_id)` - one preferences per user
- Unique Index: `(unsubscribe_token)` - for unsubscribe links

### Indexes for Email Consent Preferences

- Primary Key: `id`
- Unique Index: `(user_id)` - uniqueness
- Unique Index: `(unsubscribe_token)` - unsubscribe lookup
- Index: `(marketing_emails_enabled)` - find opted-in users
- Index: `(updated_at)` - recent changes

### Enums Definition

Create PostgreSQL ENUM types:

```sql
CREATE TYPE consent_type AS ENUM (
  'privacy_policy',
  'terms_of_service',
  'cookie_analytics',
  'cookie_marketing',
  'marketing_emails',
  'push_notifications'
);
CREATE TYPE consent_action AS ENUM ('granted', 'revoked', 're_granted');
CREATE TYPE consent_source AS ENUM ('mobile_app', 'web_learner', 'web_mentor', 'web_admin', 'email_link', 'api');
```

### Drizzle Schema Definition

In `packages/db/src/schema/consent.ts`:

- Define `consentRecords` table as append-only (never update/delete)
- Define `cookieConsentPreferences` table (updatable summary)
- Define `emailConsentPreferences` table (updatable summary)
- Relations:
  - users ↔ consentRecords (one-to-many)
  - users ↔ cookieConsentPreferences (one-to-one)
  - users ↔ emailConsentPreferences (one-to-one)
- Add comment: "consentRecords is append-only; never update or delete"

## Database Tables

### consent_records

- **Purpose**: Immutable consent audit trail for compliance
- **Row estimate**: ~2M-10M records (multiple consents per user over time)
- **Retention**: 7-10 years (legal compliance)
- **Properties**: Append-only, immutable
- **Key relationships**: N:1 with users

### cookie_consent_preferences

- **Purpose**: Current state of cookie consent (summary)
- **Row estimate**: ~1M (same as users)
- **Properties**: Updatable summary of latest consent_records state
- **Key relationships**: 1:1 with users

### email_consent_preferences

- **Purpose**: Current state of email preferences (summary)
- **Row estimate**: ~1M (same as users)
- **Properties**: Updatable summary of latest consent_records state
- **Key relationships**: 1:1 with users

## Acceptance Criteria

- [ ] `consent_records` table created with comprehensive consent types
- [ ] No UPDATE or DELETE operations allowed on consent_records (append-only)
- [ ] Explicit consent actions captured (not pre-checked defaults)
- [ ] Device metadata JSONB captures device fingerprint
- [ ] IP addresses logged with consent for compliance
- [ ] Policy version tracked for each consent
- [ ] `cookie_consent_preferences` table tracks current cookie state
- [ ] `email_consent_preferences` table with unsubscribe tokens
- [ ] Unsubscribe link requires valid token (GDPR List-Unsubscribe)
- [ ] All timestamps in UTC timezone
- [ ] All indexes created for efficient queries
- [ ] Composite indexes on (user_id, consent_type) for quick lookup
- [ ] Partial indexes on current state (latest consent per type)
- [ ] Test data with various consent types and timelines
- [ ] Test immutability of consent records
- [ ] Test preference sync with latest consent record
- [ ] Migration file generated and runnable

## Dependencies

- Task 01: Drizzle ORM Setup and Configuration
- Task 02: Users and Profiles Tables
- Privacy regulations knowledge (GDPR, CCPA, etc.)

## Technical Notes

### Consent Record Flow

```typescript
// When user grants consent
const grantConsent = async (userId, consentType, source) => {
  // Create immutable record
  await db.insert(consentRecords).values({
    userId,
    consentType,
    action: "granted",
    policyVersion: getPolicyVersion(consentType),
    timestamp: NOW,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    deviceMetadata: captureDeviceInfo(req),
    source,
    sourceUrl: req.originalUrl,
    explicitAgreement: true,
    acceptedFullPolicy: userReadPolicy,
  });

  // Update preferences summary table
  await db
    .update(cookieConsentPreferences)
    .set({
      analyticsCookiesEnabled: consentType === "cookie_analytics",
      marketingCookiesEnabled: consentType === "cookie_marketing",
      updatedAt: NOW,
      lastConsentTimestamp: NOW,
    })
    .where(eq(cookieConsentPreferences.userId, userId));
};
```

### Current Consent State Query

```typescript
// Get user's current consent status
const getCurrentConsent = async (userId) => {
  return db
    .select()
    .from(consentRecords)
    .where(eq(consentRecords.userId, userId))
    .orderBy(desc(consentRecords.timestamp))
    .groupBy(consentRecords.consentType)
    .having(
      sql`ROW_NUMBER() OVER (PARTITION BY ${consentRecords.consentType} ORDER BY ${consentRecords.timestamp} DESC) = 1`
    );
};
```

### GDPR Compliance

```typescript
// Export user's consent history for GDPR data access request
const exportConsentHistory = async (userId) => {
  return db
    .select()
    .from(consentRecords)
    .where(eq(consentRecords.userId, userId))
    .orderBy(desc(consentRecords.timestamp));
};

// Support right to be forgotten (delete all consent records)
const deleteUserConsent = async (userId) => {
  // Note: In practice, might anonymize instead of delete
  // Delete preferences tables
  await db
    .delete(cookieConsentPreferences)
    .where(eq(cookieConsentPreferences.userId, userId));

  await db
    .delete(emailConsentPreferences)
    .where(eq(emailConsentPreferences.userId, userId));

  // Mark consent records as deleted/anonymized (or keep for legal hold)
  // DO NOT delete consent_records for compliance
};
```

### Policy Version Management

```typescript
// Track policy versions for consent records
const policies = {
  privacy_policy: {
    v1: { date: "2024-01-01", url: "/legal/privacy-v1" },
    v2: { date: "2024-06-01", url: "/legal/privacy-v2" },
    current: "v2",
  },
  terms_of_service: {
    v1: { date: "2024-01-01", url: "/legal/tos-v1" },
    current: "v1",
  },
};

const getPolicyVersion = (consentType) => {
  return policies[consentType]?.current || "v1";
};
```

### Cookie Management Script

```typescript
// Load cookies based on consent preferences
const initializeCookies = async (userId) => {
  const prefs = await db
    .select()
    .from(cookieConsentPreferences)
    .where(eq(cookieConsentPreferences.userId, userId));

  if (prefs.analyticsCookiesEnabled) {
    // Load Google Analytics
    initGoogleAnalytics();
    // Initialize analytics providers
    initAnalyticsProviders();
  }

  if (prefs.marketingCookiesEnabled) {
    // Load Meta Pixel
    initMetaPixel();
    // Load LinkedIn Insight Tag
    initLinkedInPixel();
  }
};
```

### One-Click Unsubscribe (RFC 8058)

```typescript
// Generate unsubscribe token
const generateUnsubscribeToken = async (userId) => {
  const token = crypto.randomBytes(32).toString("hex");

  await db
    .update(emailConsentPreferences)
    .set({ unsubscribeToken: token })
    .where(eq(emailConsentPreferences.userId, userId));

  return token;
};

// Email List-Unsubscribe header
const getUnsubscribeHeaders = (user) => {
  const preferences = await getEmailPreferences(user.id);

  return {
    "List-Unsubscribe": `https://app.example.com/email/unsubscribe?token=${preferences.unsubscribeToken}`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
};

// Handle unsubscribe click
const handleUnsubscribe = async (token) => {
  await db
    .update(emailConsentPreferences)
    .set({
      marketingEmailsEnabled: false,
      unsubscribedAt: NOW,
      unsubscribeReason: "one_click_unsubscribe",
    })
    .where(eq(emailConsentPreferences.unsubscribeToken, token));
};
```

### Consent Banner Logic

```typescript
// Show banner based on consent state
const shouldShowConsentBanner = async (userId) => {
  const preferences = await db
    .select()
    .from(cookieConsentPreferences)
    .where(eq(cookieConsentPreferences.userId, userId))
    .limit(1);

  if (!preferences.length) {
    return true; // New user, show banner
  }

  // Check if preferences stale (> 90 days)
  const daysSinceUpdate =
    (NOW - preferences[0].updatedAt) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate > 90) {
    return true; // Re-show banner after 90 days
  }

  return false;
};
```

### Query Patterns

```typescript
// Get user's latest consent for specific type
const getLatestConsent = (userId, consentType) => {
  return db
    .select()
    .from(consentRecords)
    .where(
      and(
        eq(consentRecords.userId, userId),
        eq(consentRecords.consentType, consentType)
      )
    )
    .orderBy(desc(consentRecords.timestamp))
    .limit(1);
};

// Get consent timeline for user
const getConsentTimeline = (userId) => {
  return db
    .select()
    .from(consentRecords)
    .where(eq(consentRecords.userId, userId))
    .orderBy(desc(consentRecords.timestamp));
};

// Find users who consented to marketing emails
const getUsersWithMarketingConsent = () => {
  return db
    .select()
    .from(users)
    .innerJoin(
      emailConsentPreferences,
      eq(users.id, emailConsentPreferences.userId)
    )
    .where(eq(emailConsentPreferences.marketingEmailsEnabled, true));
};

// Get consent statistics for compliance reporting
const getConsentStatistics = () => {
  return db
    .select({
      consentType: consentRecords.consentType,
      totalGranted: sql`COUNT(CASE WHEN action = 'granted' THEN 1 END)`,
      totalRevoked: sql`COUNT(CASE WHEN action = 'revoked' THEN 1 END)`,
      uniqueUsers: sql`COUNT(DISTINCT user_id)`,
    })
    .from(consentRecords)
    .groupBy(consentRecords.consentType);
};
```

### Testing Considerations

- Test consent grant and withdrawal
- Test policy version tracking
- Test immutability of consent records
- Test preferences summary sync with consent records
- Test unsubscribe token generation and validation
- Test device metadata capture
- Test compliance export (GDPR data access)
- Test one-click unsubscribe in email
- Test consent banner display logic
- Test cascade behavior (consent records stay when user deleted)
- Test cookie initialization based on preferences

### Performance Optimization

- Partial index on latest consent per type
- Cache user's current preferences (5-minute TTL)
- Use cookie_consent_preferences for quick lookups (don't query consent_records)
- Batch export for GDPR data access requests
- Archive old consent records (>7 years) to cold storage

### Compliance Notes

- Never pre-check consent boxes (explicit only)
- Store consent proof (IP, timestamp, user-agent) for 7 years
- Support easy withdrawal (preference center, email link)
- Transactional emails cannot be gated by consent
- GDPR: honor Do Not Track (DNT) header
- CCPA: Honor user opt-out requests within 45 days
- Support data portability (export consent history)
