# Account Lockout

## Description

Implement account lockout mechanism to protect against brute force attacks. After 5 consecutive failed login attempts, the account is locked for 15 minutes. Lockout duration is configurable. Admins can manually unlock accounts. Users receive email notification when account is locked. Lockout mechanism coordinates with task 04-email-password-signin.md.

## Affected Apps/Packages

- `packages/auth`
- Backend: Hono API
- Email Service: Postmark integration

## API Endpoints

### POST /auth/check-account-lockout

Check if account is locked (used by frontend before signin).

**Request Body**:

```json
{
  "email": "john@example.com"
}
```

**Response** (200 OK - Account Not Locked):

```json
{
  "locked": false,
  "message": "Account is not locked"
}
```

**Response** (423 Locked - Account Locked):

```json
{
  "locked": true,
  "message": "Account is locked due to too many failed login attempts",
  "unlocksAt": "2024-02-18T10:45:00Z",
  "remainingSeconds": 900,
  "remainingMinutes": 15
}
```

### GET /auth/account-status/{userId}

Admin endpoint to check account lockout status.

**Response** (200 OK):

```json
{
  "userId": "user_abc123",
  "email": "john@example.com",
  "locked": true,
  "lockedAt": "2024-02-18T10:30:00Z",
  "unlocksAt": "2024-02-18T10:45:00Z",
  "failedAttempts": 5,
  "lastFailedAttempt": "2024-02-18T10:30:00Z"
}
```

### POST /auth/unlock-account/{userId}

Admin endpoint to manually unlock account.

**Request Body**:

```json
{
  "reason": "User verified identity via phone call"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Account unlocked successfully",
  "user": {
    "id": "user_abc123",
    "email": "john@example.com",
    "locked": false
  }
}
```

## Requirements

### Failed Login Attempt Tracking

- Track failed authentication attempts per email
- Create `loginAttempt` table to store:
  - `id`: Unique ID
  - `email`: Normalized email address
  - `ipAddress`: Client IP for tracking
  - `userAgent`: Browser user agent
  - `reason`: "invalid_password", "unverified_email", etc.
  - `attemptAt`: Timestamp
- Index on `email` and `attemptAt`

### Lockout Logic

- Count failed attempts for email in last 24 hours
- Failed attempts reset to 0 on successful login
- After 5 consecutive failed attempts:
  - Set account locked status
  - Store `lockedAt` timestamp
  - Calculate `unlocksAt`: now + lockout duration (default 15 minutes)
  - Store in user record or separate `accountLockout` table
  - Return 423 Locked status code
  - Prevent further login attempts
- Allow login only if:
  - Account not locked, OR
  - Lockout duration has expired
- After lockout expires, reset failed attempts to 0

### Lockout Configuration

- **Lockout Duration**: Configurable, default 15 minutes
- **Failed Attempt Threshold**: Configurable, default 5
- **Attempt Window**: 24 hours (count attempts in last 24 hours)
- **Store in environment**: `LOGIN_LOCKOUT_MINUTES`, `LOGIN_FAILED_ATTEMPT_THRESHOLD`

### Unlock Mechanisms

1. **Automatic**: Wait for lockout duration to expire
2. **Manual (Admin)**: Admin can unlock via API
3. **Verification (Future)**: User can unlock by verifying email/phone

### User Notification

- Send email notification when account locked
- Email template: `account-locked`
- Variables:
  - `userName`: User's first name
  - `lockDuration`: "15 minutes"
  - `unlocksAt`: Exact time when account unlocks
  - `supportLink`: Link to help center
  - `reportLink`: Link to report unauthorized access
- Send via Postmark after 5th failed attempt
- Do not send for each failed attempt (avoid spam)

### Admin Unlock

- Require admin role to unlock accounts
- Endpoint: `POST /auth/unlock-account/{userId}`
- Log unlock action with admin ID and reason
- Notification to user: "Your account has been unlocked"
- Reset failed attempts to 0
- Emit audit log event

### Sign-In Flow Integration

- In `handleSignIn()` (task 04):
  1. Check if account locked before password check
  2. If locked and window expired, proceed with login
  3. If locked and window active, return 423 Locked
  4. On password mismatch, increment failed attempts
  5. If attempts >= threshold, lock account
  6. On successful login, reset failed attempts to 0

### Lockout Duration Display (Frontend)

- Show countdown timer to user
- Display "Account locked for X minutes Y seconds"
- Show "Unlock now" link (if unlock mechanism implemented)
- Provide contact support link
- Show lock icon in sign-in form

### Audit Logging

- Log failed login attempts (for security monitoring)
- Log account lockout events
- Log unlock events (who unlocked, when, why)
- Include IP address, user agent, timestamp
- Aggregate for security alerts (e.g., >10 lockouts per day)

### Rate Limiting Coordination

- Coordinate with IP-based rate limiting
- If account locked, still count as rate-limited request
- May block IP after N locked account attempts from same IP

## Acceptance Criteria

- [ ] Failed login attempts tracked in database
- [ ] Account locked after 5 consecutive failed attempts
- [ ] Lockout prevents all login attempts for duration
- [ ] Lockout duration configurable (default 15 min)
- [ ] Failed attempts counter resets on successful login
- [ ] Failed attempts counted in 24-hour window
- [ ] POST /auth/check-account-lockout returns lockout status
- [ ] Locked account returns 423 status code
- [ ] Response includes unlock time in seconds and minutes
- [ ] Account automatically unlocks after duration expires
- [ ] Admin can manually unlock via API
- [ ] Unlock action logged with admin ID and reason
- [ ] Failed attempts reset to 0 on unlock
- [ ] Email notification sent when account locked
- [ ] Notification includes unlock time and support link
- [ ] Frontend shows countdown timer to user
- [ ] Lockout status checked before password validation
- [ ] Audit log entries created for all lockout events
- [ ] Backend validates on both client and server
- [ ] Lockout applies to single email (not IP-wide)
- [ ] Security alerts triggered for suspicious patterns

## Dependencies

- BetterAuth (from task 01)
- postmark (npm package)
- Drizzle ORM for database operations
- crypto for tracking
- cron for cleanup jobs

## Technical Notes

### Database Schema

```typescript
// Track login attempts
export const loginAttempts = pgTable("login_attempt", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  reason: text("reason").notNull(), // 'invalid_password', 'unverified_email', etc.
  attemptAt: timestamp("attempt_at").notNull().defaultNow(),
});

// Account lockout status
export const accountLockouts = pgTable("account_lockout", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  lockedAt: timestamp("locked_at").notNull().defaultNow(),
  unlocksAt: timestamp("unlocks_at").notNull(),
  reason: text("reason"), // What triggered the lockout
  failedAttempts: integer("failed_attempts").notNull().default(5),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Unlock audit log
export const unlockAuditLog = pgTable("unlock_audit_log", {
  id: text("id").primaryKey(),
  accountLockoutId: text("account_lockout_id").notNull(),
  userId: text("user_id"), // User who requested unlock (admin)
  reason: text("reason"),
  unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
});

// Indexes
createIndex("login_attempt_email_idx").on(loginAttempts.email);
createIndex("login_attempt_attempt_at_idx").on(loginAttempts.attemptAt);
createIndex("account_lockout_user_id_idx").on(accountLockouts.userId);
createIndex("account_lockout_unlocks_at_idx").on(accountLockouts.unlocksAt);
```

### Check Lockout Status Function

```typescript
async function checkAccountLockout(email: string): Promise<{
  locked: boolean;
  lockedAt?: Date;
  unlocksAt?: Date;
  remainingSeconds?: number;
  failedAttempts?: number;
}> {
  const normalizedEmail = email.toLowerCase();

  const lockout = await db.query.accountLockouts.findFirst({
    where: eq(accountLockouts.email, normalizedEmail),
  });

  if (!lockout) {
    return { locked: false };
  }

  const now = Date.now();
  const unlockTime = lockout.unlocksAt.getTime();

  // Check if lockout has expired
  if (now >= unlockTime) {
    // Lockout expired, clear it
    await db.delete(accountLockouts).where(eq(accountLockouts.id, lockout.id));

    // Reset failed attempts
    const user = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    if (user) {
      const attempts = await db.query.loginAttempts.findMany({
        where: and(
          eq(loginAttempts.email, normalizedEmail),
          gt(loginAttempts.attemptAt, new Date(now - 24 * 60 * 60 * 1000))
        ),
      });

      // Delete old attempts
      await db
        .delete(loginAttempts)
        .where(
          and(
            eq(loginAttempts.email, normalizedEmail),
            lt(loginAttempts.attemptAt, new Date(now - 24 * 60 * 60 * 1000))
          )
        );
    }

    return { locked: false };
  }

  // Still locked
  return {
    locked: true,
    lockedAt: lockout.lockedAt,
    unlocksAt: lockout.unlocksAt,
    remainingSeconds: Math.ceil((unlockTime - now) / 1000),
    failedAttempts: lockout.failedAttempts,
  };
}
```

### Record Failed Login Attempt

```typescript
async function recordFailedLoginAttempt(
  email: string,
  ipAddress: string,
  userAgent: string,
  reason: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase();
  const now = new Date();

  // Record attempt
  await db.insert(loginAttempts).values({
    id: crypto.randomUUID(),
    email: normalizedEmail,
    ipAddress,
    userAgent,
    reason,
    attemptAt: now,
  });

  // Count recent attempts (last 24 hours)
  const recentAttempts = await db.query.loginAttempts.findMany({
    where: and(
      eq(loginAttempts.email, normalizedEmail),
      gt(loginAttempts.attemptAt, new Date(now.getTime() - 24 * 60 * 60 * 1000))
    ),
  });

  const LOCKOUT_THRESHOLD = parseInt(
    process.env.LOGIN_FAILED_ATTEMPT_THRESHOLD || "5"
  );

  if (recentAttempts.length >= LOCKOUT_THRESHOLD) {
    // Lock account
    const lockoutDurationMinutes = parseInt(
      process.env.LOGIN_LOCKOUT_MINUTES || "15"
    );
    const unlocksAt = new Date(
      now.getTime() + lockoutDurationMinutes * 60 * 1000
    );

    // Check if already locked
    const existingLockout = await db.query.accountLockouts.findFirst({
      where: eq(accountLockouts.email, normalizedEmail),
    });

    if (existingLockout) {
      // Update existing lockout
      await db
        .update(accountLockouts)
        .set({
          unlocksAt,
          failedAttempts: recentAttempts.length,
          updatedAt: now,
        })
        .where(eq(accountLockouts.id, existingLockout.id));
    } else {
      // Create new lockout
      const user = await db.query.users.findFirst({
        where: eq(users.email, normalizedEmail),
      });

      if (user) {
        await db.insert(accountLockouts).values({
          id: crypto.randomUUID(),
          userId: user.id,
          email: normalizedEmail,
          lockedAt: now,
          unlocksAt,
          failedAttempts: recentAttempts.length,
          reason: "Too many failed login attempts",
        });

        // Send notification email
        await sendAccountLockedEmail(
          user.email,
          user.name,
          unlocksAt,
          lockoutDurationMinutes
        );

        // Log security event
        console.warn(`Account locked: ${user.id} (${normalizedEmail})`);
      }
    }
  }
}
```

### Clear Failed Login Attempts

```typescript
async function clearFailedLoginAttempts(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase();

  // Find and delete login attempts for this email
  await db
    .delete(loginAttempts)
    .where(eq(loginAttempts.email, normalizedEmail));

  // Remove lockout if exists
  const user = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });

  if (user) {
    await db.delete(accountLockouts).where(eq(accountLockouts.userId, user.id));
  }
}
```

### Integration in Sign-In Handler

```typescript
export async function handleSignIn(c: Context) {
  const body = await c.req.json();
  const { email, password } = body;
  const ipAddress = getClientIp(c);
  const userAgent = c.req.header("user-agent") || "";

  // Step 1: Check if email provided
  if (!email || !password) {
    return c.json({ error: "MISSING_CREDENTIALS" }, 400);
  }

  // Step 2: Check account lockout
  const lockoutStatus = await checkAccountLockout(email);
  if (lockoutStatus.locked) {
    return c.json(
      {
        error: "ACCOUNT_LOCKED",
        message: "Account locked due to too many failed login attempts",
        unlocksAt: lockoutStatus.unlocksAt,
        remainingSeconds: lockoutStatus.remainingSeconds,
        remainingMinutes: Math.ceil(lockoutStatus.remainingSeconds! / 60),
      },
      423
    );
  }

  // Step 3: Find user
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (!user) {
    // Record attempt even if user doesn't exist
    await recordFailedLoginAttempt(
      email,
      ipAddress,
      userAgent,
      "user_not_found"
    );
    return c.json({ error: "INVALID_CREDENTIALS" }, 401);
  }

  // Step 4: Check email verified
  if (!user.emailVerified) {
    await recordFailedLoginAttempt(
      email,
      ipAddress,
      userAgent,
      "email_not_verified"
    );
    return c.json(
      {
        error: "EMAIL_NOT_VERIFIED",
        email: user.email,
      },
      403
    );
  }

  // Step 5: Verify password
  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    await recordFailedLoginAttempt(
      email,
      ipAddress,
      userAgent,
      "invalid_password"
    );
    return c.json({ error: "INVALID_CREDENTIALS" }, 401);
  }

  // Step 6: Clear failed attempts
  await clearFailedLoginAttempts(user.email);

  // Step 7: Create session (continue as before)
  // ... rest of sign-in logic
}
```

### Admin Unlock Endpoint

```typescript
export async function handleUnlockAccount(c: Context) {
  const { userId } = c.req.param();
  const body = await c.req.json();
  const { reason } = body;

  // Check admin role
  const adminUser = c.get("auth.user");
  if (adminUser?.role !== "super_admin") {
    return c.json({ error: "FORBIDDEN" }, 403);
  }

  // Find lockout
  const lockout = await db.query.accountLockouts.findFirst({
    where: eq(accountLockouts.userId, userId),
  });

  if (!lockout) {
    return c.json({ error: "NOT_LOCKED" }, 400);
  }

  // Delete lockout
  await db.delete(accountLockouts).where(eq(accountLockouts.id, lockout.id));

  // Log unlock
  await db.insert(unlockAuditLog).values({
    id: crypto.randomUUID(),
    accountLockoutId: lockout.id,
    userId: adminUser.id,
    reason: reason || "Admin unlock",
    unlockedAt: new Date(),
  });

  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (user) {
    // Send notification email
    await sendAccountUnlockedEmail(user.email, user.name);

    // Clear failed attempts
    await clearFailedLoginAttempts(user.email);
  }

  console.log(`Account unlocked: ${userId} by admin ${adminUser.id}`);

  return c.json(
    {
      success: true,
      message: "Account unlocked successfully",
      user: sanitizeUser(user),
    },
    200
  );
}
```

### Postmark Email Templates

```typescript
// Send account locked notification
async function sendAccountLockedEmail(
  email: string,
  name: string,
  unlocksAt: Date,
  lockoutDurationMinutes: number
) {
  const client = new Client(process.env.POSTMARK_API_TOKEN!);

  return client.sendEmailWithTemplate({
    From: "security@example.com",
    To: email,
    TemplateId: 987654, // Account locked template
    TemplateModel: {
      userName: name.split(" ")[0],
      lockDuration: `${lockoutDurationMinutes} minutes`,
      unlocksAt: unlocksAt.toLocaleString(),
      supportLink: "https://example.com/support",
      reportLink: "https://example.com/security/report",
    },
    Tag: "account-locked",
  });
}

// Send account unlocked notification
async function sendAccountUnlockedEmail(email: string, name: string) {
  const client = new Client(process.env.POSTMARK_API_TOKEN!);

  return client.sendEmailWithTemplate({
    From: "security@example.com",
    To: email,
    TemplateId: 987655, // Account unlocked template
    TemplateModel: {
      userName: name.split(" ")[0],
      supportLink: "https://example.com/support",
    },
    Tag: "account-unlocked",
  });
}
```

### Frontend Lockout Display

```typescript
// components/AccountLockedModal.tsx
'use client';

import { useEffect, useState } from 'react';

export function AccountLockedModal({
  unlocksAt,
  onRetry,
}: {
  unlocksAt: Date;
  onRetry: () => void;
}) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, unlocksAt.getTime() - now);
      setRemainingSeconds(Math.ceil(remaining / 1000));

      if (remaining <= 0) {
        // Unlock time reached
        onRetry();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [unlocksAt, onRetry]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <div className="account-locked-modal">
      <div className="icon">🔒</div>
      <h1>Account Locked</h1>
      <p>Your account is temporarily locked due to too many failed login attempts.</p>

      <div className="countdown">
        <p>Account will unlock in:</p>
        <div className="timer">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </div>
      </div>

      <div className="actions">
        <a href="/auth/forgot-password" className="link">
          Forgot password?
        </a>
        <a href="/support" className="link">
          Contact support
        </a>
      </div>
    </div>
  );
}
```

### Cleanup Job for Old Attempts

```typescript
import cron from "node-cron";

// Run every hour
cron.schedule("0 * * * *", async () => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const deleted = await db
    .delete(loginAttempts)
    .where(lt(loginAttempts.attemptAt, oneDayAgo));

  console.log(`Cleaned up ${deleted} old login attempts`);
});
```

### Environment Variables

```
# Account Lockout Configuration
LOGIN_LOCKOUT_MINUTES=15
LOGIN_FAILED_ATTEMPT_THRESHOLD=5
LOGIN_ATTEMPT_WINDOW_HOURS=24
```

### Security Monitoring

- Alert on >10 lockouts per day
- Alert on repeated lockouts for same user (possible breach)
- Alert on lockouts from many different IPs (coordinated attack)
- Track lockout by IP to detect distributed attacks

## Verification Notes (2026-02-26)

- Code evidence:
  - `packages/auth/src/index.ts` (failed login tracking, threshold-based lockout, pre-sign-in lockout check, lockout email send)
  - `packages/api/src/routers/lockout.ts` (status check and admin unlock endpoints)
  - `apps/mobile/app/(auth)/login.tsx` (lockout countdown handling)
- Verification evidence:
  - `packages/ui/src/components/__tests__/signin-form.test.tsx` includes lockout-message behavior coverage.
