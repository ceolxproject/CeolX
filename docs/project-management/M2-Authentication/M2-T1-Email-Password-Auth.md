# M2-T1 · Email/Password Sign-Up + Email Verification

| Field | Value |
|-------|-------|
| **Milestone** | M2 — Authentication & Persona System |
| **Status** | 🔲 To Do |
| **Depends on** | M1-T1 (Turborepo), M1-T2 (DB schema), M1-T3 (API scaffold), M1-T4 (mobile scaffold) |
| **PRD Ref** | Section 4.1 (Authentication) |

---

## Description

Implement the base authentication method — email/password sign-up, email verification via Postmark, sign-in, and logout. This is the foundation that all other sign-in flows (Google, Apple) build on. Users must verify their email before accessing any protected features. BetterAuth handles session token management; the mobile app stores the token securely in `expo-secure-store`.

---

## Affected Apps / Packages

| App / Package | Role |
|---------------|------|
| `apps/api` | BetterAuth configuration, sign-up/sign-in/logout endpoints, email verification logic, password hashing |
| `apps/mobile` | Sign Up screen, Sign In screen, email confirmation screen, session persistence via AuthContext |
| `packages/shared` | Shared error codes and response types |

---

## API Endpoints

### POST /api/v1/auth/sign-up

Create user account with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": false,
    "createdAt": "2026-03-23T10:30:00Z"
  },
  "message": "Account created. Check your email to verify."
}
```

**Error Responses:**
- `400 Bad Request` — Missing required fields or invalid email format
- `409 Conflict` — Email already registered
- `422 Unprocessable Entity` — Password does not meet strength requirements

### GET /api/v1/auth/verify-email?token=:token

Mark user as verified using token from email link.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Email verified. You can now sign in."
}
```

**Error Responses:**
- `400 Bad Request` — Token missing or invalid
- `410 Gone` — Token expired (24 hour window)
- `404 Not Found` — User not found

### POST /api/v1/auth/sign-in

Authenticate user with email and password. Returns BetterAuth session token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "session": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2026-03-23T15:30:00Z"
  },
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": true,
    "currentRole": "spectator"
  }
}
```

**Error Responses:**
- `400 Bad Request` — Missing email or password
- `401 Unauthorized` — Invalid credentials
- `403 Forbidden` — Email not verified (include link to resend verification)

### POST /api/v1/auth/resend-verification

Resend verification email to a user's email address.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Verification email sent. Check your inbox."
}
```

### POST /api/v1/auth/logout

Terminate user session and invalidate token.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully."
}
```

---

## Requirements

### BetterAuth Configuration

- BetterAuth installed and initialized in `apps/api`
- Email/password provider configured
- Postmark email adapter configured for transactional emails
- Session storage using PostgreSQL (via Drizzle schema from M1-T2)
- JWT tokens: 15-minute access token + 30-day refresh token

### Sign-Up Implementation

- Email validation: RFC 5322 compliant, converted to lowercase
- Password validation:
  - Minimum 8 characters
  - At least one uppercase letter, one lowercase letter, one number, one special character
  - Cannot contain email or common patterns (password123, etc.)
- Duplicate email detection: case-insensitive uniqueness check
- Password hashing: bcrypt with cost factor 12 (never store plain passwords)
- User creation: generates UUID, stores email (lowercase), password hash, sets `emailVerified: false`
- Automatic role assignment: `current_role = 'spectator'` (can be changed in M2-T4)

### Email Verification

- Verification email sent immediately after sign-up via Postmark
- Email contains deep link: `ceolx://verify-email?token=<uuid>`
- Token generated: random UUID, stored in `email_verification_tokens` table
- Token expiry: 24 hours from creation
- Single-use: token deleted after verification (cannot reuse)
- Resend option: user can request a new verification email (rate limited to 3 per hour per email)
- Before verification: user cannot sign in (returns 403 with "please verify" message)

### Sign-In Implementation

- BetterAuth session creation on successful password verification
- Returns JWT access token + refresh token to mobile app
- Access token stored securely in `expo-secure-store` (not AsyncStorage)
- Session persists across app restarts — app reads stored token on startup
- Unverified users: returns 403 with link to resend verification email
- Rate limiting: max 5 failed attempts per email per 15 minutes (returns 429 Too Many Requests)

### Logout Implementation

- Session token invalidated on backend
- Token deleted from `expo-secure-store` on mobile
- User context cleared in AuthContext
- User redirected to Sign In screen

### Mobile Frontend

- **Sign Up Screen**:
  - Name, Email, Password, Confirm Password fields with real-time validation
  - Password strength indicator (visual feedback)
  - Show/hide password toggle
  - Submit button disabled until form valid
  - Error messages displayed below fields
  - Success: redirects to email verification screen

- **Sign In Screen**:
  - Email, Password fields
  - "Forgot Password?" link (wired in M2-T3)
  - "Create Account" link redirects to Sign Up
  - Loading state during submission
  - Error message for unverified email with "Resend Email" button

- **Email Verification Screen**:
  - Instruction text: "Check your email to verify your account"
  - "Resend Email" button (rate limited)
  - Timer showing verification token expiry
  - Automatic navigation to Map screen after verification (via deep link or manual confirmation)

---

## Acceptance Criteria

- [ ] User can sign up with email + password; verification email received via Postmark
- [ ] Email contains clickable verification link with deep link scheme (`ceolx://verify-email?token=...`)
- [ ] Clicking verification link in email opens mobile app and marks account as verified
- [ ] Verified user can sign in and receive JWT session token
- [ ] Session token stored securely in `expo-secure-store` and persists across app restarts
- [ ] Unverified user sees "Check your email" message, not a generic error
- [ ] "Resend verification email" works with rate limiting (max 3 per hour)
- [ ] Duplicate email registration returns 409 Conflict with clear error message
- [ ] Password validation enforces all requirements (8 chars, uppercase, lowercase, number, special char)
- [ ] Logout clears token from device and returns user to Sign In screen
- [ ] Password hashed with bcrypt (cost 12) before storage; plain password never logged
- [ ] API returns consistent error format: `{ error, code, message, statusCode }`
- [ ] Verification token expires after 24 hours and cannot be reused
- [ ] Rate limiting on failed sign-in attempts (5 per 15 minutes)
- [ ] All API responses use ISO 8601 timestamps in UTC

---

## Dependencies

### Upstream
- M1-T1 (Turborepo configuration)
- M1-T2 (Drizzle schema with `users` and `email_verification_tokens` tables)
- M1-T3 (Hono API scaffold with routes and middleware)
- M1-T4 (Mobile app scaffold with AuthContext and SecureStore)

### Downstream
- M2-T2 (Google/Apple OAuth) — builds on BetterAuth session
- M2-T3 (Forgot Password) — reuses token generation pattern
- M2-T4 (Onboarding/Persona Selection) — activated after email verification
- All M3+ features — require authenticated user

### External services
- Postmark API (for transactional email)
- BetterAuth (hosted or self-managed)
- PostgreSQL / Neon (for session and token storage)

---

## Technical Notes

### BetterAuth Configuration

```typescript
// apps/api/src/lib/auth.ts

import { betterAuth } from 'better-auth';
import { postmark } from 'better-auth/providers';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  providers: [
    postmark({
      apiKey: process.env.POSTMARK_API_TOKEN!,
    }),
  ],
  socialProviders: {
    // Google and Apple wired in M2-T2
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // Update after 1 day of inactivity
  },
});
```

### Sign-Up Endpoint

```typescript
// apps/api/src/routes/auth.ts (sign-up)

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../lib/db';
import { users, emailVerificationTokens } from '../schema';
import { sendVerificationEmail } from '../services/emailService';

const signUpSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[!@#$%^&*]/, 'Must contain special character'),
});

const app = new Hono();

app.post('/sign-up', zValidator('json', signUpSchema), async (c) => {
  const { name, email, password } = c.req.valid('json');
  const emailLower = email.toLowerCase();

  // Check for duplicate email
  const existing = await db.query.users.findFirst({
    where: eq(users.email, emailLower),
  });
  if (existing) {
    return c.json(
      { error: 'EMAIL_ALREADY_EXISTS', message: 'Email already registered' },
      409
    );
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  const userId = uuidv4();
  const user = await db
    .insert(users)
    .values({
      id: userId,
      email: emailLower,
      name,
      passwordHash,
      emailVerified: false,
      currentRole: 'spectator',
    })
    .returning();

  // Generate verification token
  const verificationToken = uuidv4();
  await db.insert(emailVerificationTokens).values({
    id: uuidv4(),
    userId: userId,
    token: verificationToken,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  });

  // Send verification email
  const deepLink = `ceolx://verify-email?token=${verificationToken}`;
  await sendVerificationEmail(email, deepLink);

  return c.json(
    {
      success: true,
      user: {
        id: user[0].id,
        email: user[0].email,
        name: user[0].name,
        emailVerified: user[0].emailVerified,
        createdAt: user[0].createdAt,
      },
      message: 'Account created. Check your email to verify.',
    },
    201
  );
});
```

### Email Verification Endpoint

```typescript
// apps/api/src/routes/auth.ts (verify-email)

app.get('/verify-email', async (c) => {
  const token = c.req.query('token');

  if (!token) {
    return c.json(
      { error: 'INVALID_TOKEN', message: 'Token required' },
      400
    );
  }

  // Find token
  const verificationToken = await db.query.emailVerificationTokens.findFirst({
    where: eq(emailVerificationTokens.token, token),
  });

  if (!verificationToken) {
    return c.json(
      { error: 'INVALID_TOKEN', message: 'Invalid verification token' },
      400
    );
  }

  // Check expiry
  if (verificationToken.expiresAt < new Date()) {
    return c.json(
      { error: 'TOKEN_EXPIRED', message: 'Verification token expired' },
      410
    );
  }

  // Mark user as verified
  await db
    .update(users)
    .set({ emailVerified: true })
    .where(eq(users.id, verificationToken.userId));

  // Delete token (single-use)
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.id, verificationToken.id));

  return c.json({
    success: true,
    message: 'Email verified. You can now sign in.',
  });
});
```

### Sign-In Endpoint

```typescript
// apps/api/src/routes/auth.ts (sign-in)

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

app.post('/sign-in', zValidator('json', signInSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const emailLower = email.toLowerCase();

  // Find user
  const user = await db.query.users.findFirst({
    where: eq(users.email, emailLower),
  });

  if (!user) {
    return c.json(
      { error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      401
    );
  }

  // Check email verified
  if (!user.emailVerified) {
    return c.json(
      {
        error: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before signing in',
        code: 'EMAIL_NOT_VERIFIED',
      },
      403
    );
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return c.json(
      { error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      401
    );
  }

  // Create BetterAuth session (token generation handled by BetterAuth)
  const session = await auth.createSession(user.id);

  return c.json({
    success: true,
    session: {
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
    },
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      currentRole: user.currentRole,
    },
  });
});
```

### Mobile Sign-Up Screen

```typescript
// apps/mobile/src/screens/Auth/SignUpScreen.tsx

import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';

const SignUpScreen = ({ navigation }: any) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name) newErrors.name = 'Name required';
    if (!email) newErrors.email = 'Email required';
    if (!password) newErrors.password = 'Password required';
    if (password.length < 8) newErrors.password = 'Password must be 8+ characters';
    if (!/[A-Z]/.test(password)) newErrors.password = 'Must include uppercase letter';
    if (!/[0-9]/.test(password)) newErrors.password = 'Must include number';
    if (!/[!@#$%^&*]/.test(password)) newErrors.password = 'Must include special character';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords must match';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/api/v1/auth/sign-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (response.ok) {
        navigation.navigate('VerifyEmail', { email });
      } else {
        const data = await response.json();
        setErrors({ submit: data.message });
      }
    } catch (err) {
      setErrors({ submit: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        style={[styles.input, errors.name && styles.inputError]}
        placeholder="Name"
        value={name}
        onChangeText={setName}
      />
      {errors.name && <Text style={styles.error}>{errors.name}</Text>}

      <TextInput
        style={[styles.input, errors.email && styles.inputError]}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      {errors.email && <Text style={styles.error}>{errors.email}</Text>}

      <TextInput
        style={[styles.input, errors.password && styles.inputError]}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {errors.password && <Text style={styles.error}>{errors.password}</Text>}

      <TextInput
        style={[styles.input, errors.confirmPassword && styles.inputError]}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      {errors.confirmPassword && <Text style={styles.error}>{errors.confirmPassword}</Text>}

      {errors.submit && <Text style={styles.error}>{errors.submit}</Text>}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSignUp}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign Up</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
        <Text style={styles.link}>Already have an account? Sign In</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 16,
  },
  inputError: {
    borderColor: '#dc2626',
  },
  error: {
    color: '#dc2626',
    fontSize: 12,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#00a86b',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  link: {
    color: '#00a86b',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 14,
  },
});

export default SignUpScreen;
```

---

## Common Gotchas

- **AsyncStorage vs SecureStore**: AsyncStorage is NOT encrypted. Always use `expo-secure-store` for JWT tokens.
- **Password hashing**: Never log passwords or password hashes. Use bcrypt cost factor 12 for the security/performance tradeoff.
- **Email normalization**: Always convert email to lowercase before storage and lookup to prevent duplicate accounts.
- **Verification token expiry**: Set to 24 hours; expired tokens should return 410 Gone.
- **Deep link format**: Must match the scheme registered in `app.config.ts` (e.g., `ceolx://verify-email?token=...`).
- **Rate limiting**: Implement on sign-in (5 failed attempts per 15 min) and resend verification (3 per hour).
- **Error messages**: Never tell users whether an email exists (security best practice). Use generic messages like "Invalid email or password."
- **BetterAuth sessions**: Let BetterAuth handle token generation and session management; do not implement custom JWT logic.

---
