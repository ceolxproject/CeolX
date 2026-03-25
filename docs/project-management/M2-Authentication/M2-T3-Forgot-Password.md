# M2-T3 · Forgot Password Flow

| Field          | Value                                                   |
| -------------- | ------------------------------------------------------- |
| **Milestone**  | M2 — Authentication & Persona System                    |
| **Status**     | 🔲 To Do                                                |
| **Depends on** | M2-T1 (email auth), M1-T2 (password_reset_tokens table) |
| **PRD Ref**    | Section 4.1 (Forgot Password)                           |

---

## Description

Standard password reset via email link. Token-based, time-limited, single-use. User requests a reset link, opens it on their device (via deep link), and is directed to a screen to set a new password. Generic success messages prevent email enumeration (security best practice).

---

## Affected Apps / Packages

| App / Package | Role                                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| `apps/api`    | Reset token generation, validation, password update endpoints, rate limiting |
| `apps/mobile` | Forgot Password screen, deep link handler, New Password screen               |

---

## API Endpoints

### POST /api/v1/auth/forgot-password

Request a password reset link. Returns generic success message whether or not email exists (security: prevent email enumeration).

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
  "message": "If an account exists, a password reset link has been sent to your email."
}
```

**Error Responses:**

- `429 Too Many Requests` — Rate limited (max 3 requests per email per hour)

### POST /api/v1/auth/reset-password

Validate token and update password. Token must be valid, not expired, and not already used.

**Request Body:**

```json
{
  "token": "uuid-token",
  "newPassword": "NewSecurePass123!"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Password reset successfully. You can now sign in."
}
```

**Error Responses:**

- `400 Bad Request` — Token missing, password invalid, or password doesn't meet requirements
- `410 Gone` — Token expired (15 minute window)
- `409 Conflict` — Token already used (single-use enforcement)

---

## Requirements

### Reset Token Generation

- Triggered by `POST /api/v1/auth/forgot-password`
- Token: random UUID, stored in `password_reset_tokens` table
- Expiry: 15 minutes from creation
- Single-use: deleted after successful password reset
- Rate limiting: max 3 requests per email per hour (returns 429 if exceeded)

### Email Delivery

- Postmark email sent immediately after token generation
- Email contains deep link: `ceolx://reset-password?token=<uuid>`
- Generic success message shown to user (whether email exists or not)
- Email subject: "Reset your CeolX password"
- Email body includes warning not to share the link

### Password Reset Screen

- Accessed via deep link: `ceolx://reset-password?token=...`
- Token pre-populated in hidden form field
- User enters new password + confirm password
- New password must meet same requirements as sign-up (8 chars, uppercase, lowercase, number, special char)
- Form validation before submission
- On success: redirect to Sign In screen with "Password updated" confirmation

### Token Validation

- Token must exist in `password_reset_tokens` table
- Token must not be expired (expiresAt > now)
- Token must not have been used (used_at is null)
- After password update: mark token as used (set used_at timestamp)

### Frontend Integration

- "Forgot Password?" link visible on Sign In screen
- Clicking link navigates to Forgot Password screen
- User enters email, taps "Send Reset Link"
- Success screen shows "Check your email"
- User opens email, taps deep link, app opens Reset Password screen
- User sets new password and confirms

---

## Acceptance Criteria

- [ ] "Forgot Password?" link visible on Sign In screen
- [ ] Submitting email shows generic "Check your email" message (whether email exists or not)
- [ ] Reset email received with working deep link (`ceolx://reset-password?token=...`)
- [ ] Tapping deep link opens app and navigates to Reset Password screen with token pre-populated
- [ ] Submitting valid new password updates it and redirects to Sign In screen
- [ ] Confirmation message shown: "Password reset successfully"
- [ ] Expired token (>15 min old) shows appropriate error: "Link expired, request a new one"
- [ ] Already-used token shows appropriate error: "Link already used, request a new one"
- [ ] Rate limiting blocks excessive requests (>3 per email per hour)
- [ ] Password validation enforced (8 chars, uppercase, lowercase, number, special char)
- [ ] Old password can be completely replaced; no account lockout
- [ ] Deep link works on both iOS and Android cold starts

---

## Technical Notes

### Forgot Password Endpoint

```typescript
// apps/server/src/routes/auth.ts (forgot-password)

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { db } from "../lib/db";
import { users, passwordResetTokens } from "../schema";
import { sendPasswordResetEmail } from "../services/emailService";
import { rateLimitByEmail } from "../middleware/rateLimit";

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

app.post(
  "/forgot-password",
  zValidator("json", forgotPasswordSchema),
  rateLimitByEmail({ maxRequests: 3, windowMinutes: 60 }),
  async (c) => {
    const { email } = c.req.valid("json");
    const emailLower = email.toLowerCase();

    // Check if user exists (do NOT return different response if not found)
    const user = await db.query.users.findFirst({
      where: eq(users.email, emailLower),
    });

    // Generic success message whether user exists or not
    if (!user) {
      return c.json({
        success: true,
        message:
          "If an account exists, a password reset link has been sent to your email.",
      });
    }

    // Generate reset token
    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await db.insert(passwordResetTokens).values({
      id: uuidv4(),
      userId: user.id,
      token: resetToken,
      expiresAt,
      usedAt: null,
    });

    // Send reset email
    const deepLink = `ceolx://reset-password?token=${resetToken}`;
    await sendPasswordResetEmail(user.email, deepLink);

    return c.json({
      success: true,
      message:
        "If an account exists, a password reset link has been sent to your email.",
    });
  },
);
```

### Reset Password Endpoint

```typescript
// apps/server/src/routes/auth.ts (reset-password)

import * as bcrypt from "bcryptjs";

const resetPasswordSchema = z.object({
  token: z.string().uuid(),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[a-z]/, "Must contain lowercase letter")
    .regex(/[0-9]/, "Must contain number")
    .regex(/[!@#$%^&*]/, "Must contain special character"),
});

app.post(
  "/reset-password",
  zValidator("json", resetPasswordSchema),
  async (c) => {
    const { token, newPassword } = c.req.valid("json");

    // Find token
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: eq(passwordResetTokens.token, token),
    });

    if (!resetToken) {
      return c.json(
        {
          error: "INVALID_TOKEN",
          message: "Invalid or expired password reset link",
        },
        400,
      );
    }

    // Check expiry
    if (resetToken.expiresAt < new Date()) {
      return c.json(
        {
          error: "TOKEN_EXPIRED",
          message: "Password reset link has expired. Request a new one.",
        },
        410,
      );
    }

    // Check if already used
    if (resetToken.usedAt !== null) {
      return c.json(
        {
          error: "TOKEN_ALREADY_USED",
          message: "This password reset link has already been used.",
        },
        409,
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update user password
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, resetToken.userId));

    // Mark token as used
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetToken.id));

    return c.json({
      success: true,
      message: "Password reset successfully. You can now sign in.",
    });
  },
);
```

### Rate Limiting Middleware

```typescript
// apps/server/src/middleware/rateLimit.ts

import { Context, Next } from "hono";
import { LRUCache } from "lru-cache";

interface RateLimitOptions {
  maxRequests: number;
  windowMinutes: number;
}

const cache = new LRUCache<string, { count: number; resetAt: number }>({
  max: 10000,
  ttl: 1000 * 60 * 60, // 1 hour
});

export const rateLimitByEmail =
  (options: RateLimitOptions) => async (c: Context, next: Next) => {
    const body = await c.req.json();
    const email = body.email?.toLowerCase();

    if (!email) {
      return next();
    }

    const now = Date.now();
    const windowMs = options.windowMinutes * 60 * 1000;
    const entry = cache.get(email);

    if (!entry || now > entry.resetAt) {
      cache.set(email, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= options.maxRequests) {
      return c.json(
        {
          error: "RATE_LIMITED",
          message: "Too many requests. Try again later.",
        },
        429,
      );
    }

    entry.count++;
    cache.set(email, entry);
    return next();
  };
```

### Mobile Forgot Password Screen

```typescript
// apps/mobile/src/screens/Auth/ForgotPasswordScreen.tsx

import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

const ForgotPasswordScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/v1/auth/forgot-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );

      if (response.ok) {
        setSubmitted(true);
      } else {
        const data = await response.json();
        setError(data.message || 'An error occurred');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Check Your Email</Text>
        <Text style={styles.message}>
          If an account exists with that email, we've sent a password reset link.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('SignIn')}
        >
          <Text style={styles.buttonText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.subtitle}>
        Enter your email and we'll send you a link to reset your password.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send Reset Link</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
        <Text style={styles.link}>Back to Sign In</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 16,
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#00a86b',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
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
    fontSize: 14,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default ForgotPasswordScreen;
```

### Mobile Reset Password Screen

```typescript
// apps/mobile/src/screens/Auth/ResetPasswordScreen.tsx

import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface ResetPasswordScreenProps {
  route: {
    params: {
      token: string;
    };
  };
  navigation: any;
}

const ResetPasswordScreen = ({
  route,
  navigation,
}: ResetPasswordScreenProps) => {
  const { token } = route.params;
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async () => {
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/v1/auth/reset-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            newPassword,
          }),
        }
      );

      if (response.ok) {
        navigation.navigate('SignIn', {
          message: 'Password reset successfully. Please sign in.',
        });
      } else {
        const data = await response.json();
        setError(data.message || 'Password reset failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create New Password</Text>

      <TextInput
        style={styles.input}
        placeholder="New Password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleReset}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Reset Password</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
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
    marginBottom: 16,
    fontSize: 16,
  },
  error: {
    color: '#dc2626',
    fontSize: 14,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#00a86b',
    paddingVertical: 12,
    borderRadius: 8,
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
});

export default ResetPasswordScreen;
```

### Deep Link Configuration

```typescript
// apps/mobile/src/navigation/linking.ts

export const linking = {
  prefixes: ["ceolx://", "https://ceolx.ie"],
  config: {
    screens: {
      ResetPassword: "reset-password?token=:token",
      VerifyEmail: "verify-email?token=:token",
    },
  },
};
```

---

## Common Gotchas

- **Generic success messages**: Always return success even if email doesn't exist (prevents email enumeration attacks).
- **15-minute window**: Reset tokens expire after 15 minutes; enough time for user to open email and reset, short enough for security.
- **Single-use tokens**: Delete token after use or mark as used; prevents token reuse.
- **Rate limiting**: Max 3 requests per email per hour prevents abuse (spam attacks).
- **Deep link format**: Must match scheme registered in `app.config.ts`. Token passed as query parameter: `ceolx://reset-password?token=...`
- **Password requirements**: Same as sign-up (8 chars, uppercase, lowercase, number, special char).
- **No old password required**: Unlike some systems, we don't ask for the old password (user already forgot it).

---
