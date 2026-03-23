# Email Verification

## Description

Implement email verification flow to confirm user ownership of email addresses. After signup, users receive a verification email with a time-limited token. Users must verify their email before accessing platform features. Includes resend functionality for expired or lost tokens.

## Affected Apps/Packages

- `packages/auth`
- Frontend: All web apps and mobile
- Backend: Hono API
- Email Service: Postmark integration

## API Endpoints

### POST /auth/verify-email

Verify email using a token sent via email.

**Request Body**:

```json
{
  "token": "verify_abc123def456"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Email verified successfully",
  "user": {
    "id": "user_abc123",
    "email": "john@example.com",
    "emailVerified": true,
    "createdAt": "2024-02-18T10:30:00Z"
  }
}
```

**Error Responses**:

- `400 Bad Request`: Token missing or invalid
  ```json
  {
    "error": "INVALID_TOKEN",
    "message": "Verification token is invalid or has expired"
  }
  ```
- `404 Not Found`: Token not found
  ```json
  {
    "error": "TOKEN_NOT_FOUND",
    "message": "Verification token does not exist"
  }
  ```
- `410 Gone`: Token expired (24 hours)
  ```json
  {
    "error": "TOKEN_EXPIRED",
    "message": "Verification token has expired. Request a new one."
  }
  ```

### POST /auth/resend-verification

Resend verification email to user.

**Request Body**:

```json
{
  "email": "john@example.com"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Verification email sent"
}
```

**Error Responses**:

- `404 Not Found`: User not found
  ```json
  {
    "error": "USER_NOT_FOUND",
    "message": "No account found with this email"
  }
  ```
- `400 Bad Request`: Email already verified
  ```json
  {
    "error": "EMAIL_ALREADY_VERIFIED",
    "message": "This email address is already verified"
  }
  ```
- `429 Too Many Requests`: Too many resend attempts
  ```json
  {
    "error": "RATE_LIMITED",
    "message": "Too many verification emails sent. Try again in 5 minutes."
  }
  ```

## Requirements

### Verification Token Generation

- Generate secure random token (32 bytes hex-encoded)
- Token format: `verify_<32-char-random-string>`
- Store in `verificationToken` table with:
  - `token` (unique, indexed)
  - `userId` (foreign key to user)
  - `email` (denormalized for resend without user lookup)
  - `type: 'email'`
  - `expiresAt` (24 hours from creation)
  - `createdAt`
- Set database index on `token` and `expiresAt` for queries

### Email Delivery (Postmark)

- Send verification email via Postmark API
- Email template name: `email-verification`
- Template variables:
  - `verificationLink`: `https://api.example.com/auth/verify?token=<token>`
  - `userName`: User's name
  - `expiryTime`: "24 hours"
  - For mobile apps: use deep link format
- Set reply-to: `noreply@example.com`
- Tag: `email-verification`
- Track opens and clicks

### Token Verification Process

- Accept token via POST /auth/verify-email
- Query `verificationToken` table by token
- Check expiration: `expiresAt > now()`
- Check not already used (soft delete or mark used)
- Update user: `emailVerified = true`
- Delete verification token record
- Return user object with `emailVerified: true`

### Access Control Before Verification

- Middleware in auth package checks `emailVerified` flag
- Block access to:
  - Course browsing
  - Payments/subscriptions
  - Dashboard features
- Allow access to:
  - Profile settings
  - Verification page
  - Account recovery
- Return 403 Forbidden with `VERIFY_EMAIL` error code

### Resend Functionality

- Allow resend if email unverified and user exists
- Rate limit: Max 3 resend attempts per 15 minutes
- Track resend attempts in session or database
- Generate new token each time (invalidate old token)
- Send new email immediately
- Show user: "Verification email sent. Check your inbox."

### Expiration & Cleanup

- Tokens expire after 24 hours
- Implement background job to delete expired tokens
- Run job every hour or on demand
- Query: `verificationToken WHERE expiresAt < now()`

### Frontend Implementation (All Apps)

- **Signup Success Screen**: Display "Check your email" message
- **Verification Page**:
  - Show status (pending, verified, expired)
  - Display email address
  - "Resend Email" button
  - "Change Email" link (triggers account recovery)
  - Copy-paste token field (fallback for mobile email clients)
- **Magic Link**: Auto-detect and redirect when clicking email link
- **Mobile Deep Links**: `mentor://verify?token=<token>`

## Acceptance Criteria

- [ ] Verification token generated with 32 bytes of randomness
- [ ] Token stored in database with 24-hour expiration
- [ ] Verification email sent via Postmark after signup
- [ ] Email includes verification link with token
- [ ] POST /auth/verify-email validates token and marks email verified
- [ ] POST /auth/verify-email returns 410 if token expired
- [ ] POST /auth/resend-verification generates new token
- [ ] Resend endpoint rate-limited to 3 attempts per 15 min
- [ ] Unverified users blocked from accessing features (403 error)
- [ ] Verification page shows appropriate status messages
- [ ] Magic link in email automatically verifies when clicked
- [ ] Mobile deep links work correctly
- [ ] Background job cleans up expired tokens
- [ ] Expired tokens return clear error message
- [ ] User can resend verification email multiple times
- [ ] Database indexes on `token` and `expiresAt` created

## Dependencies

- BetterAuth (from task 01)
- postmark (npm package)
- crypto for token generation
- Drizzle ORM for database operations
- Node.js scheduled job library (node-cron or similar)

## Technical Notes

### Token Generation

```typescript
import crypto from "crypto";

function generateVerificationToken(): string {
  const randomBytes = crypto.randomBytes(16).toString("hex");
  return `verify_${randomBytes}`;
}
```

### Database Schema

```typescript
export const verificationTokens = pgTable("verification_token", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  type: text("type").notNull(), // 'email', 'password_reset', etc.
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Indexes
createIndex("verification_token_token_idx").on(verificationTokens.token);
createIndex("verification_token_expires_at_idx").on(
  verificationTokens.expiresAt
);
```

### Postmark Integration

```typescript
import { Client } = require("postmark");

const client = new Client(process.env.POSTMARK_API_TOKEN);

async function sendVerificationEmail(email: string, token: string, userName: string) {
  const verificationLink = `https://api.example.com/auth/verify?token=${token}`;

  return client.sendEmailWithTemplate({
    From: "noreply@example.com",
    To: email,
    TemplateId: 123456, // Get from Postmark
    TemplateModel: {
      verificationLink,
      userName,
      expiryTime: "24 hours"
    },
    Tag: "email-verification",
    TrackOpens: true,
    TrackLinks: "htmlAndText",
  });
}
```

### Middleware to Check Verification Status

```typescript
export async function withEmailVerified(c: Context, next: Next) {
  const user = c.get("auth.user");

  if (!user?.emailVerified) {
    return c.json(
      {
        error: "VERIFY_EMAIL",
        message: "Please verify your email to access this feature",
      },
      403
    );
  }

  await next();
}
```

### Background Job for Token Cleanup

```typescript
import cron from "node-cron";

// Run every hour
cron.schedule("0 * * * *", async () => {
  const deleted = await db
    .delete(verificationTokens)
    .where(lt(verificationTokens.expiresAt, new Date()));

  console.log(`Cleaned up ${deleted} expired verification tokens`);
});
```

### Mobile Deep Link Setup (Expo)

- Configure in `app.json`:
  ```json
  {
    "plugins": [
      ["expo-notifications"],
      [
        "expo-linking",
        {
          "schemes": ["mentor"]
        }
      ]
    ]
  }
  ```
- Handle in app entry:
  ```typescript
  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      const route = url.replace(/.*?:\/\//g, "");
      if (route.includes("verify")) {
        const token = extractTokenFromUrl(route);
        verifyEmail(token);
      }
    });
    return () => subscription.remove();
  }, []);
  ```

### Error Handling Edge Cases

- Token already used (soft delete approach): Return 410 Gone
- Token belongs to different user: Return 400 Bad Request (security)
- User deleted after token creation: Handle gracefully, return 410
- Email changed after signup: Use email from token, not current user email

### Rate Limiting Strategy

Use Redis or in-memory cache:

```typescript
const resendAttempts = new Map<string, number[]>();

function canResend(email: string): boolean {
  const attempts = resendAttempts.get(email) || [];
  const recent = attempts.filter((t) => Date.now() - t < 15 * 60 * 1000);

  if (recent.length >= 3) return false;

  resendAttempts.set(email, [...recent, Date.now()]);
  return true;
}
```

## Verification Notes (2026-02-26)

- Code evidence:
  - `packages/auth/src/index.ts` (`emailVerification.sendVerificationEmail`, `sendOnSignUp`, `autoSignInAfterVerification`)
  - `packages/api/src/routers/auth.ts` (`resendVerification`, `verificationStatus`)
  - `apps/web-learner/src/app/(auth)/verify-email/page.tsx` and `verify-email/callback/page.tsx`
  - `apps/mobile/app/(auth)/verify-email.tsx`
- Verification evidence:
  - `packages/api/src/routers/__tests__/auth.test.ts` validates resend rate-limit behavior.
  - `packages/api/src/routers/__tests__/verified-guard.test.ts` confirms verified-gated router usage.
