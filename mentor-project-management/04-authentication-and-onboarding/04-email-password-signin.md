# Email/Password Sign-In

## Description

Implement sign-in flow using email and password credentials. This is the primary authentication method for users who registered with email/password. Sign-in creates secure sessions, handles invalid credentials, enforces account lockouts, and validates email verification status before allowing access.

## Affected Apps/Packages

- `packages/auth`
- Frontend: All web apps and mobile
- Backend: Hono API
- Session management via BetterAuth

## API Endpoints

### POST /auth/signin

Authenticate user with email and password, create session.

**Request Body**:

```json
{
  "email": "john@example.com",
  "password": "SecurePass123!",
  "rememberMe": false
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "user": {
    "id": "user_abc123",
    "email": "john@example.com",
    "name": "John Doe",
    "emailVerified": true,
    "role": "learner",
    "image": null,
    "createdAt": "2024-02-18T10:30:00Z"
  },
  "session": {
    "id": "session_xyz789",
    "token": "session_xyz789",
    "expiresAt": "2024-03-19T10:30:00Z",
    "createdAt": "2024-02-18T10:30:00Z"
  }
}
```

**Cookies Set**:

- `authToken`: Session token (HttpOnly, Secure, SameSite=Lax)
- `authUserId`: User ID for non-sensitive identification (Optional)

**Error Responses**:

- `401 Unauthorized`: Invalid credentials
  ```json
  {
    "error": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect"
  }
  ```
- `403 Forbidden`: Email not verified
  ```json
  {
    "error": "EMAIL_NOT_VERIFIED",
    "message": "Please verify your email before signing in",
    "email": "john@example.com"
  }
  ```
- `423 Locked`: Account locked after failed attempts
  ```json
  {
    "error": "ACCOUNT_LOCKED",
    "message": "Account locked due to too many failed login attempts",
    "unlocksAt": "2024-02-18T11:15:00Z",
    "remainingMinutes": 15
  }
  ```
- `400 Bad Request`: Missing email or password
  ```json
  {
    "error": "MISSING_CREDENTIALS",
    "message": "Email and password are required"
  }
  ```

## Requirements

### Credential Validation

- Email must be provided and normalized to lowercase
- Password must be provided (non-empty)
- Return 400 Bad Request if either missing
- Case-insensitive email matching
- Case-sensitive password matching (always)

### Password Verification

- Query user by email
- If user not found, return 401 (don't indicate email doesn't exist)
- Compare submitted password hash using bcrypt.compare()
- Never log passwords or password hashes

### Email Verification Check

- Check user `emailVerified` flag
- If false, return 403 Forbidden with `EMAIL_NOT_VERIFIED` error
- Include email in response to allow user to request resend

### Session Creation

- On successful authentication, create session record in database
- Session fields:
  - `id`: Unique session ID (UUID)
  - `token`: Secure random token (32 bytes hex)
  - `userId`: Foreign key to user
  - `userAgent`: Browser user agent (for device tracking)
  - `ipAddress`: Client IP (for security monitoring)
  - `expiresAt`: Set based on role
    - Learner: 30 days from now
    - Super Admin: 24 hours from now
  - `createdAt`: Current timestamp
  - `lastActivityAt`: Current timestamp
  - `refreshedAt`: Current timestamp

### Session Persistence

- Store session token in HttpOnly secure cookie
- Cookie expires match session expiration
- Database session should persist across server restarts
- Implement session refresh on activity (sliding window)

### Failed Login Tracking

- Increment failed attempts counter for email on each invalid password
- Counter key: `failed_auth_<email_hash>` or database field
- Reset counter to 0 on successful login
- Track failed attempt timestamp (for lockout duration)
- After 5 consecutive failed attempts, lock account for 15 minutes (see task 09)

### Frontend Implementation

- **Sign-In Form**:
  - Email input field with validation
  - Password input field with show/hide toggle
  - "Remember me" checkbox (extends session to 7 days learners only)
  - "Forgot password?" link to password recovery
  - "Create account" link to signup
- **Loading State**: Show spinner during auth
- **Error Handling**:
  - Display error messages clearly
  - For unverified email, show "Resend verification" button
  - For account locked, show countdown timer
  - For invalid credentials, generic message (security)
- **Session Handling**:
  - Store session token in app state/context
  - Store user object in context/store
  - Redirect to dashboard/home on success
  - Set up session refresh interval (25-29 days learner, 23 hours admin)

### Account Lockout Integration

- Coordinate with task 09-account-lockout.md
- If account locked, return 423 with unlock time
- Show user countdown timer on frontend
- After unlock time, reset failed attempts counter

## Acceptance Criteria

- [ ] Form validates email and password are provided
- [ ] Email normalized to lowercase before database query
- [ ] Password compared using bcrypt.compare()
- [ ] Invalid credentials return 401 with generic message
- [ ] Unverified email returns 403 with option to resend verification
- [ ] Session created in database with all required fields
- [ ] Session token stored in HttpOnly secure cookie
- [ ] Session token never exposed in response body (only in cookie)
- [ ] Learner sessions set to 30-day expiration
- [ ] Admin sessions set to 24-hour expiration
- [ ] Failed login attempt tracked and incremented
- [ ] Failed attempts counter reset on successful login
- [ ] Account locked after 5 failed attempts (23-hour lockout)
- [ ] POST /auth/signin returns 200 with user and session on success
- [ ] User redirected to dashboard/home after successful signin
- [ ] "Remember me" extends learner session to 7 days
- [ ] Password visibility toggle works
- [ ] Sign-in works across all three web apps
- [ ] Mobile app sign-in integrates with form validation
- [ ] Session persists across app restarts

## Dependencies

- BetterAuth (from task 01)
- bcryptjs for password verification
- crypto for session token generation
- Drizzle ORM for database operations
- React context/state management (for frontend)

## Technical Notes

### Session Token Generation

```typescript
import crypto from "crypto";

function generateSessionToken(): string {
  return crypto.randomBytes(16).toString("hex");
}
```

### Database Schema

```typescript
export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
  refreshedAt: timestamp("refreshed_at").notNull().defaultNow(),
});

// Indexes for quick lookups
createIndex("session_token_idx").on(sessions.token);
createIndex("session_user_id_idx").on(sessions.userId);
createIndex("session_expires_at_idx").on(sessions.expiresAt);
```

### Hono Handler Pattern

```typescript
export async function handleSignIn(c: Context) {
  const body = await c.req.json();
  const { email, password, rememberMe } = body;

  // Validate input
  if (!email || !password) {
    return c.json({ error: "MISSING_CREDENTIALS" }, 400);
  }

  // Check account lockout
  const lockoutStatus = await checkAccountLockout(email);
  if (lockoutStatus.locked) {
    return c.json(
      {
        error: "ACCOUNT_LOCKED",
        unlocksAt: lockoutStatus.unlocksAt,
        remainingMinutes: lockoutStatus.remainingMinutes,
      },
      423
    );
  }

  // Find user
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (!user) {
    // Record failed attempt even if user doesn't exist (timing attack prevention)
    await recordFailedLoginAttempt(email);
    return c.json({ error: "INVALID_CREDENTIALS" }, 401);
  }

  // Check email verified
  if (!user.emailVerified) {
    return c.json(
      {
        error: "EMAIL_NOT_VERIFIED",
        email: user.email,
      },
      403
    );
  }

  // Verify password
  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    await recordFailedLoginAttempt(user.email);
    return c.json({ error: "INVALID_CREDENTIALS" }, 401);
  }

  // Reset failed attempts
  await clearFailedLoginAttempts(user.email);

  // Create session
  const sessionToken = generateSessionToken();
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + (user.role === "learner" ? 30 : 1) * 24 * 60 * 60 * 1000
  );

  const sessionDuration =
    rememberMe && user.role === "learner"
      ? 7 * 24 * 60 * 60 * 1000
      : expiresAt.getTime() - Date.now();

  const session = await db
    .insert(sessions)
    .values({
      id: sessionId,
      token: sessionToken,
      userId: user.id,
      userAgent: c.req.header("user-agent"),
      ipAddress: getClientIp(c),
      expiresAt: new Date(Date.now() + sessionDuration),
    })
    .returning();

  // Set cookie
  c.cookie("authToken", sessionToken, {
    httpOnly: true,
    secure: c.env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: Math.floor(sessionDuration / 1000),
    domain: process.env.COOKIE_DOMAIN,
    path: "/",
  });

  return c.json(
    {
      success: true,
      user: sanitizeUser(user),
      session: {
        id: session[0].id,
        expiresAt: session[0].expiresAt,
        createdAt: session[0].createdAt,
      },
    },
    200
  );
}
```

### Session Refresh (Sliding Window)

```typescript
// Middleware to extend session on activity
export async function refreshSessionIfNeeded(c: Context, next: Next) {
  const sessionToken = c.req.cookie("authToken");
  if (!sessionToken) return next();

  const session = await db.query.sessions.findFirst({
    where: eq(sessions.token, sessionToken),
  });

  if (!session) return next();

  // Refresh if last activity was > threshold ago
  const threshold = 5 * 60 * 1000; // 5 minutes
  if (Date.now() - session.lastActivityAt.getTime() > threshold) {
    const newExpiresAt = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000);

    await db
      .update(sessions)
      .set({
        expiresAt: newExpiresAt,
        lastActivityAt: new Date(),
        refreshedAt: new Date(),
      })
      .where(eq(sessions.id, session.id));

    c.cookie("authToken", sessionToken, {
      httpOnly: true,
      secure: c.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: Math.floor((newExpiresAt.getTime() - Date.now()) / 1000),
      domain: process.env.COOKIE_DOMAIN,
      path: "/",
    });
  }

  await next();
}
```

### Frontend Sign-In Context (React)

```typescript
interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const { user: userData, session: sessionData } = await response.json();
      setUser(userData);
      setSession(sessionData);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Mobile Implementation (Expo)

- Use same API endpoint with credentials
- Store session token in SecureStore
- Implement token refresh on app foreground
- Handle deep links from email/notifications

## Verification Notes (2026-02-26)

- Code evidence:
  - `apps/web-learner/src/app/(auth)/login/page.tsx`
  - `apps/web-mentor/src/app/(auth)/login/page.tsx`
  - `apps/web-admin/src/app/(auth)/login/page.tsx`
  - `apps/mobile/app/(auth)/login.tsx`
  - `packages/auth/src/index.ts` (email sign-in hooks, lockout checks, per-role session duration)
- Verification evidence:
  - `packages/auth/src/__tests__/session-duration.test.ts`
  - `packages/auth/src/__tests__/session-expiry.test.ts`
  - `packages/auth/src/__tests__/session-hooks.test.ts`
