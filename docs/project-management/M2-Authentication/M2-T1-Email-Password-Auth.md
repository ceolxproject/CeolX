# M2-T1 · Email/Password Sign-Up + Email Verification

| Field          | Value                                                                               |
| -------------- | ----------------------------------------------------------------------------------- |
| **Milestone**  | M2 — Authentication & Persona System                                                |
| **Status**     | 🔲 To Do                                                                            |
| **Depends on** | M1-T1 (Turborepo), M1-T2 (DB schema), M1-T3 (API scaffold), M1-T4 (mobile scaffold) |
| **PRD Ref**    | Section 4.1 (Authentication)                                                        |

---

## Description

Implement the base authentication method — email/password sign-up, email verification via Postmark, sign-in, and logout. This is the foundation that all other sign-in flows (Google, Apple) build on. Users must verify their email before accessing any protected features. BetterAuth handles session token management; the mobile app stores the token securely in `expo-secure-store`.

---

## Affected Apps / Packages

| App / Package   | Role                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| `packages/auth` | BetterAuth configuration: email/password provider, Postmark email, Drizzle adapter, session settings |
| `apps/server`   | Mounts BetterAuth HTTP handler at `/api/auth/*` — no custom routes needed                            |
| `apps/mobile`   | Sign Up screen, Sign In screen, email confirmation screen, session persistence via AuthContext       |

---

## API Endpoints

Auth is handled entirely by **BetterAuth's HTTP handler** mounted at `/api/auth/*`. There are no custom tRPC procedures or Hono routes for sign-up, sign-in, or sign-out.

The mobile app uses the **BetterAuth client SDK** (`@better-auth/expo`) — not raw fetch calls.

### BetterAuth endpoints (called internally by the client SDK)

| Method | Path                                | Action                                 |
| ------ | ----------------------------------- | -------------------------------------- |
| POST   | `/api/auth/sign-up/email`           | Create account (name, email, password) |
| POST   | `/api/auth/sign-in/email`           | Authenticate, receive session token    |
| POST   | `/api/auth/sign-out`                | Invalidate session                     |
| GET    | `/api/auth/verify-email`            | Verify email from deep link token      |
| POST   | `/api/auth/send-verification-email` | Resend verification email              |

BetterAuth handles password hashing, session token generation, email sending (via Postmark), and token expiry. Do not re-implement any of this.

**Error shape** (BetterAuth standard):

- `400` — Missing/invalid fields
- `401` — Invalid credentials
- `403` — Email not verified
- `409` — Email already registered

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

### BetterAuth Configuration (`packages/auth/src/index.ts`)

```typescript
import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@CeolX/db";
import { env } from "@CeolX/env/server";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: env.CORS_ALLOWED_ORIGINS.split("|"),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Postmark sends the verification email automatically
    sendResetPassword: async ({ user, url }) => {
      // TODO M2-T3: wire Postmark reset-password email
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      // TODO M7-T3: wire Postmark verification email with deep link
      // Deep link format: ceolx://verify-email?token=<token>
    },
  },
  plugins: [expo()],
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh after 1 day of activity
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
});
```

BetterAuth handles: password hashing (bcrypt), session token generation, email verification tokens, and Postmark delivery. Do not re-implement any of this.

### Mobile — BetterAuth Client SDK

```typescript
// apps/native/src/lib/auth.ts
import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL, // e.g. https://api.ceolx.ie
  plugins: [
    expoClient({
      scheme: "ceolx",
      storagePrefix: "ceolx",
      storage: SecureStore,
    }),
  ],
});
```

### Mobile Sign-Up Screen

```typescript
// apps/native/src/screens/Auth/SignUpScreen.tsx

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
    const { data, error } = await authClient.signUp.email({
      name,
      email,
      password,
    });

    setLoading(false);
    if (error) {
      setErrors({ submit: error.message ?? 'Sign up failed' });
    } else {
      navigation.navigate('VerifyEmail', { email });
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
