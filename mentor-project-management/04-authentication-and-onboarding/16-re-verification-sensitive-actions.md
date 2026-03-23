# Re-Verification for Sensitive Actions

## Description

Implement identity re-verification before sensitive actions: data export, account deletion, email change. Users must re-authenticate using one of three methods within 15-minute session window: re-login, email OTP (6-digit, 10 min expiry, 3 attempt max), or password confirmation. Shared utility in packages/auth. Verification records logged for audit trail.

## Affected Apps/Packages

- `packages/auth`
- Backend: Hono API
- Frontend: All web apps and mobile

## API Endpoints

### POST /auth/verify-identity

Request identity re-verification (start process).

**Request Body**:

```json
{
  "method": "email_otp", // or "password", "relogin"
  "action": "delete_account", // or "export_data", "change_email"
  "purpose": "Permanent account deletion"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "verificationRequired": true,
  "method": "email_otp",
  "verificationId": "verify_abc123",
  "message": "Verification code sent to your email",
  "expiresIn": 600,
  "attemptsRemaining": 3
}
```

**Error Responses**:

- `400 Bad Request`: Invalid method or action
- `403 Forbidden`: Session too old for relogin method
- `409 Conflict`: Action already in progress

### POST /auth/verify-identity/confirm

Confirm identity re-verification with code/password.

**Request Body** (for email OTP):

```json
{
  "verificationId": "verify_abc123",
  "code": "123456"
}
```

**Request Body** (for password):

```json
{
  "verificationId": "verify_abc123",
  "password": "CurrentPassword123!"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "verified": true,
  "verificationId": "verify_abc123",
  "expiresAt": "2024-02-18T10:45:00Z"
}
```

**Error Responses**:

- `400 Bad Request`: Invalid code/password
  ```json
  {
    "error": "INVALID_CODE",
    "message": "Verification code is incorrect",
    "attemptsRemaining": 2
  }
  ```
- `410 Gone`: Code expired
- `423 Locked`: Too many attempts

### DELETE /auth/user

Delete user account (requires prior verification).

**Request Body**:

```json
{
  "verificationId": "verify_abc123",
  "confirmation": "I understand this action is permanent"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

### POST /auth/user/email/change

Change email address (requires prior verification).

**Request Body**:

```json
{
  "verificationId": "verify_abc123",
  "newEmail": "newemail@example.com"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Email changed successfully. Please verify your new email."
}
```

### GET /auth/user/export-data

Export user data as JSON (requires prior verification).

**Query Parameters**:

- `verificationId`: From prior verification

**Response** (200 OK):
Download JSON file with user profile, settings, activity, etc.

## Requirements

### Sensitive Actions Definition

Actions requiring re-verification:

1. **Account Deletion**: Permanently delete user account and all data
2. **Email Change**: Update primary email address
3. **Data Export**: Download personal data (GDPR/CCPA)
4. **Password Change**: Change password (optional, nice to have)
5. **Role Assignment**: Change user role (admin only)
6. **Suspend/Restrict User**: Disable user account (admin)

### Verification Methods

**Method 1: Re-Login**

- Requires user to sign in again
- Validates email and password
- Session must be < 15 minutes old
- After valid signin, mark as verified
- Valid for 1 hour (action window)
- Simple and most secure

**Method 2: Email OTP**

- Send 6-digit code to user's email
- 10-minute expiration
- Max 3 incorrect attempts
- After 3 failures, wait 15 minutes
- After verification, valid for 1 hour
- User-friendly alternative

**Method 3: Password Confirmation**

- User enters current password in modal
- Single password field
- Max 5 incorrect attempts (then require email OTP)
- 10-minute validity after confirmation
- Local session-only (not database-backed)
- Fastest method for quick actions

### Verification Session

- Create `identityVerification` record
- Store:
  - `id`: Verification ID
  - `userId`: User ID
  - `action`: What action is being verified for
  - `method`: How it was verified
  - `verificationId`: Unique token
  - `verifiedAt`: When confirmed (null if pending)
  - `expiresAt`: When expires (1 hour after verification)
  - `attemptsRemaining`: For OTP/password attempts
  - `attempts`: Tracks total attempts
- Invalidate after action completed or expiration

### Time Windows

**Verification Window**:

- Request: User initiates sensitive action
- Available time: Until verification expires
- OTP: 10 minutes to enter code
- Password: Single entry, 10 minute validity
- Re-login: 60 minutes after new signin
- Total action window: 1 hour after verification

**Session Age Check**:

- If current session > 15 minutes old
- Re-login method disabled
- Force email OTP or password method
- Prevents logged-in but idle sessions

### Frontend Implementation

**Sensitive Action Trigger**:

- User clicks "Delete Account" or "Change Email"
- Show modal: "Verify Your Identity"
- Offer method selection
- "I'll verify with: [Email OTP] [Password] [Re-login]"

**Email OTP Verification Screen**:

- Message: "We've sent a code to your email"
- Show masked email
- 6 digit input fields (auto-focus, paste support)
- Countdown timer (10 min)
- Resend button (after 30 sec)
- Attempts remaining counter
- "Use different method" link

**Password Confirmation Modal**:

- Message: "Confirm your password"
- Password field
- Show/hide toggle
- "Verify" button
- "Use different method" link
- Max 5 attempts before fallback to email

**Re-Login Screen**:

- "Sign in again to verify your identity"
- Email field (pre-filled, read-only)
- Password field
- Standard signin flow
- On success, mark verified
- Show countdown timer

### Audit Logging

- Log all verification attempts
- Log successful verifications
- Log failed attempts
- Store: userId, action, method, timestamp, success/failure, IP
- Retention: 1 year minimum
- Alert on suspicious patterns

### Account Deletion

- Check verification first
- Show confirmation modal
- "Type 'DELETE' to confirm"
- List consequences: "This will..."
  - Delete all courses created
  - Remove access to enrolled courses
  - Permanently delete account
  - Cannot be undone
- After confirmation:
  - Delete user record
  - Delete all sessions
  - Delete all personal data
  - Archive purchases (for billing)
  - Send confirmation email
  - Log deletion

### Email Change

- Send verification email to new email address
- User must click link in new email
- Old email becomes backup
- New email becomes primary
- Keep old email for recovery (optional)
- Notify user of change via both emails

### Data Export

- Export user profile, settings, activity logs
- Include: courses, enrollments, messages, activity
- Format: JSON, CSV (configurable)
- Include metadata: export date, user info
- Generate on demand (can take 30-60 seconds)
- Download as file
- Optional: Email download link

### Database Schema

```typescript
export const identityVerifications = pgTable("identity_verification", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // delete_account, change_email, export_data
  method: text("method").notNull(), // email_otp, password, relogin
  verificationToken: text("verification_token").notNull().unique(),
  code: text("code"), // Hashed OTP (for email_otp method)
  attemptsRemaining: integer("attempts_remaining"),
  attemptedAt: timestamp("attempted_at"),
  verifiedAt: timestamp("verified_at"), // NULL if not verified yet
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"), // When action was completed
  metadata: jsonb("metadata"), // Store action-specific data
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const verificationAudit = pgTable("verification_audit", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  method: text("method").notNull(),
  success: boolean("success").notNull(),
  reason: text("reason"), // If failed
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});
```

### Hono Handlers

**Initiate Verification**:

```typescript
export async function handleVerifyIdentity(c: Context) {
  const user = c.get("auth.user");
  const session = c.get("auth.session");

  if (!user) return c.json({ error: "UNAUTHORIZED" }, 401);

  const { method, action, purpose } = await c.req.json();

  // Validate method
  if (!["email_otp", "password", "relogin"].includes(method)) {
    return c.json({ error: "INVALID_METHOD" }, 400);
  }

  // Check session age for re-login
  if (method === "relogin") {
    const sessionAge = Date.now() - session.createdAt.getTime();
    if (sessionAge > 15 * 60 * 1000) {
      return c.json(
        {
          error: "SESSION_TOO_OLD",
          message:
            "Session is too old for re-login method. Use email OTP or password.",
        },
        403
      );
    }
  }

  // Create verification record
  const verificationId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + (method === "relogin" ? 60 : 10) * 60 * 1000
  );

  let code = null;
  let hashedCode = null;

  // Generate code for email OTP
  if (method === "email_otp") {
    code = generateOtpCode(); // 6-digit
    hashedCode = hashOtpCode(code);
  }

  const verification = await db
    .insert(identityVerifications)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      action,
      method,
      verificationToken: verificationId,
      code: hashedCode,
      attemptsRemaining: method === "email_otp" ? 3 : 5,
      expiresAt,
      metadata: { purpose },
    })
    .returning();

  // Send email if OTP method
  if (method === "email_otp") {
    await sendVerificationEmail(user.email, code, action);
  }

  return c.json({
    success: true,
    verificationRequired: true,
    method,
    verificationId: verification[0].verificationToken,
    message:
      method === "email_otp"
        ? "Verification code sent to your email"
        : "Please confirm your identity",
    expiresIn: Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
    attemptsRemaining: method === "email_otp" ? 3 : 5,
  });
}
```

**Confirm Verification**:

```typescript
export async function handleConfirmVerification(c: Context) {
  const user = c.get("auth.user");
  if (!user) return c.json({ error: "UNAUTHORIZED" }, 401);

  const { verificationId, code, password } = await c.req.json();

  // Find verification record
  const verification = await db.query.identityVerifications.findFirst({
    where: and(
      eq(identityVerifications.verificationToken, verificationId),
      eq(identityVerifications.userId, user.id)
    ),
  });

  if (!verification) {
    return c.json({ error: "INVALID_VERIFICATION" }, 400);
  }

  if (verification.expiresAt < new Date()) {
    return c.json({ error: "VERIFICATION_EXPIRED" }, 410);
  }

  if (verification.verifiedAt) {
    return c.json({ error: "ALREADY_VERIFIED" }, 400);
  }

  // Verify based on method
  let verified = false;

  if (verification.method === "email_otp") {
    if (!code || !/^\d{6}$/.test(code)) {
      return c.json({ error: "INVALID_CODE_FORMAT" }, 400);
    }

    const codeMatch = bcrypt.compareSync(code, verification.code);
    if (!codeMatch) {
      const newAttempts = verification.attemptsRemaining - 1;

      if (newAttempts <= 0) {
        // Lock verification
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await db
          .update(identityVerifications)
          .set({ expiresAt: lockedUntil })
          .where(eq(identityVerifications.id, verification.id));

        return c.json(
          {
            error: "TOO_MANY_ATTEMPTS",
            message: "Too many incorrect attempts. Try again later.",
          },
          423
        );
      }

      await db
        .update(identityVerifications)
        .set({ attemptsRemaining: newAttempts })
        .where(eq(identityVerifications.id, verification.id));

      // Log failed attempt
      await db.insert(verificationAudit).values({
        id: crypto.randomUUID(),
        userId: user.id,
        action: verification.action,
        method: verification.method,
        success: false,
        reason: "invalid_code",
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      });

      return c.json(
        {
          error: "INVALID_CODE",
          message: "Verification code is incorrect",
          attemptsRemaining: newAttempts,
        },
        400
      );
    }

    verified = true;
  } else if (verification.method === "password") {
    if (!password) {
      return c.json({ error: "PASSWORD_REQUIRED" }, 400);
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      const newAttempts = verification.attemptsRemaining - 1;

      if (newAttempts <= 0) {
        // Switch to email OTP
        return c.json(
          {
            error: "TOO_MANY_ATTEMPTS",
            message: "Too many incorrect passwords. Use email OTP instead.",
            suggestedMethod: "email_otp",
          },
          400
        );
      }

      await db
        .update(identityVerifications)
        .set({ attemptsRemaining: newAttempts })
        .where(eq(identityVerifications.id, verification.id));

      return c.json(
        {
          error: "INVALID_PASSWORD",
          message: "Password is incorrect",
          attemptsRemaining: newAttempts,
        },
        400
      );
    }

    verified = true;
  } else if (verification.method === "relogin") {
    // Already verified by re-login, just confirm
    verified = true;
  }

  if (!verified) {
    return c.json({ error: "VERIFICATION_FAILED" }, 400);
  }

  // Mark as verified
  const newExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db
    .update(identityVerifications)
    .set({
      verifiedAt: new Date(),
      expiresAt: newExpiresAt,
    })
    .where(eq(identityVerifications.id, verification.id));

  // Log successful verification
  await db.insert(verificationAudit).values({
    id: crypto.randomUUID(),
    userId: user.id,
    action: verification.action,
    method: verification.method,
    success: true,
    ipAddress: getClientIp(c),
    userAgent: c.req.header("user-agent"),
  });

  console.log(`Identity verified for user ${user.id}: ${verification.action}`);

  return c.json({
    success: true,
    verified: true,
    verificationId: verificationId,
    expiresAt: newExpiresAt,
  });
}
```

**Delete Account**:

```typescript
export async function handleDeleteAccount(c: Context) {
  const user = c.get("auth.user");
  if (!user) return c.json({ error: "UNAUTHORIZED" }, 401);

  const { verificationId, confirmation } = await c.req.json();

  // Check verification
  const verification = await db.query.identityVerifications.findFirst({
    where: and(
      eq(identityVerifications.verificationToken, verificationId),
      eq(identityVerifications.userId, user.id),
      eq(identityVerifications.action, "delete_account")
    ),
  });

  if (!verification || !verification.verifiedAt) {
    return c.json({ error: "NOT_VERIFIED" }, 403);
  }

  if (verification.expiresAt < new Date()) {
    return c.json({ error: "VERIFICATION_EXPIRED" }, 410);
  }

  if (confirmation !== "I understand this action is permanent") {
    return c.json({ error: "INVALID_CONFIRMATION" }, 400);
  }

  // Delete user and all related data
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  await db.delete(users).where(eq(users.id, user.id));

  // Mark verification as completed
  await db
    .update(identityVerifications)
    .set({ completedAt: new Date() })
    .where(eq(identityVerifications.id, verification.id));

  // Send deletion confirmation email
  await sendAccountDeletedEmail(user.email, user.name);

  // Clear cookies
  c.cookie("authToken", "", { maxAge: 0 });

  console.log(`Account deleted: ${user.id}`);

  return c.json({
    success: true,
    message: "Account deleted successfully",
  });
}
```

### Frontend Component

```typescript
// components/VerifyIdentityModal.tsx
'use client';

import { useState } from 'react';

export function VerifyIdentityModal({
  action,
  onVerified,
  onCancel,
}: {
  action: string;
  onVerified: (verificationId: string) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState('select-method'); // select, verify, confirmed
  const [method, setMethod] = useState<'email_otp' | 'password' | 'relogin'>();
  const [verificationId, setVerificationId] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const [expiresIn, setExpiresIn] = useState(0);

  const handleRequestVerification = async (selectedMethod: typeof method) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          method: selectedMethod,
          action,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 403 && errorData.error === 'SESSION_TOO_OLD') {
          setError('Session too old. Please use email OTP or password.');
          return;
        }
        throw new Error(errorData.message);
      }

      const data = await response.json();
      setVerificationId(data.verificationId);
      setMethod(selectedMethod);
      setAttemptsRemaining(data.attemptsRemaining);
      setExpiresIn(data.expiresIn);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request verification');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');

    try {
      const payload: any = { verificationId };

      if (method === 'email_otp') {
        payload.code = code;
      } else if (method === 'password') {
        payload.password = password;
      }

      const response = await fetch('/api/auth/verify-identity/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.attemptsRemaining !== undefined) {
          setAttemptsRemaining(errorData.attemptsRemaining);
        }
        throw new Error(errorData.message);
      }

      const data = await response.json();
      onVerified(data.verificationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verify-identity-modal">
      <h2>Verify Your Identity</h2>

      {step === 'select-method' && (
        <div>
          <p>Choose verification method:</p>

          <button
            onClick={() => handleRequestVerification('email_otp')}
            className="method-btn"
            disabled={loading}
          >
            <strong>Email Code</strong>
            <small>Get a code in your email</small>
          </button>

          <button
            onClick={() => handleRequestVerification('password')}
            className="method-btn"
            disabled={loading}
          >
            <strong>Password</strong>
            <small>Confirm your password</small>
          </button>

          <button
            onClick={() => handleRequestVerification('relogin')}
            className="method-btn"
            disabled={loading}
          >
            <strong>Sign In Again</strong>
            <small>Log in again for verification</small>
          </button>
        </div>
      )}

      {step === 'verify' && method === 'email_otp' && (
        <div>
          <p>Enter the code sent to your email:</p>

          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            pattern="[0-9]{6}"
          />

          <small>{expiresIn}s remaining</small>
          <small>{attemptsRemaining} attempts left</small>

          <button onClick={handleConfirm} disabled={loading || code.length !== 6}>
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
        </div>
      )}

      {step === 'verify' && method === 'password' && (
        <div>
          <p>Confirm your password:</p>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />

          <small>{attemptsRemaining} attempts left</small>

          <button onClick={handleConfirm} disabled={loading || !password}>
            {loading ? 'Verifying...' : 'Confirm Password'}
          </button>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <button onClick={onCancel} className="btn-cancel">
        Cancel
      </button>
    </div>
  );
}
```

## Acceptance Criteria

- [ ] Identity verification required before account deletion
- [ ] Verification required before email change
- [ ] Verification required before data export
- [ ] Three methods available: email OTP, password, re-login
- [ ] Re-login disabled if session > 15 minutes old
- [ ] Email OTP sends 6-digit code
- [ ] OTP expires in 10 minutes
- [ ] Max 3 OTP attempts, then 15-min lockout
- [ ] Password confirmation allows 5 attempts
- [ ] After 5 password failures, switch to email OTP
- [ ] Verification valid for 1 hour after confirmation
- [ ] POST /auth/verify-identity starts process
- [ ] POST /auth/verify-identity/confirm confirms identity
- [ ] Account deletion requires "I understand" confirmation text
- [ ] Email change sends verification email to new address
- [ ] Data export downloads as JSON or CSV
- [ ] Audit log tracks all verification attempts
- [ ] Suspicious patterns flagged (>5 attempts)
- [ ] Frontend shows countdown timers
- [ ] Clear error messages guide user
- [ ] All verification records expire properly

## Dependencies

- Drizzle ORM
- bcryptjs for password/OTP hashing
- crypto for token generation
- Postmark for email OTP
- Node.js cron for cleanup

## Technical Notes

### Cleanup Job for Expired Verifications

```typescript
import cron from "node-cron";

// Run every hour
cron.schedule("0 * * * *", async () => {
  const deleted = await db
    .delete(identityVerifications)
    .where(lt(identityVerifications.expiresAt, new Date()));

  console.log(`Cleaned up ${deleted} expired verifications`);
});
```

### Security Best Practices

- Never expose verificationToken in logs
- Hash all codes/passwords
- Rate limit verification attempts
- Monitor for brute force patterns
- Use HTTPS in production
- Expire verifications quickly
- Log all attempts for audit
- Mask email/phone in responses
