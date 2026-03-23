# M2-T2 · Google Sign-In + Apple Sign-In (iOS)

| Field | Value |
|-------|-------|
| **Milestone** | M2 — Authentication & Persona System |
| **Status** | 🔲 To Do |
| **Depends on** | M2-T1 (BetterAuth must be configured), M1-T4 (mobile app) |
| **PRD Ref** | Section 4.1 (Apple Sign-In is mandatory for App Store compliance) |

---

## Description

Implement social login methods as an alternative to email/password. Google Sign-In works on both iOS and Android. Apple Sign-In is a hard App Store requirement — Apple rejects apps that offer any third-party social login without also offering Apple Sign-In. Both methods leverage BetterAuth's social provider system; account merging (same email from different providers) is handled server-side to prevent duplicates.

---

## Affected Apps / Packages

| App / Package | Role |
|---------------|------|
| `apps/api` | BetterAuth Google + Apple OAuth provider configuration, account linking logic |
| `apps/mobile` | OAuth flow implementation, social login buttons on Sign Up/Sign In screens, deep link callbacks |

---

## API Endpoints

### POST /api/v1/auth/google

Initiate Google OAuth flow (mobile calls this to get authorization code).

**Request Body:**
```json
{
  "code": "auth_code_from_google",
  "redirectUri": "ceolx://oauth-callback"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "session": {
    "token": "jwt_token",
    "expiresAt": "2026-03-23T15:30:00Z"
  },
  "user": {
    "id": "uuid",
    "email": "user@gmail.com",
    "name": "John Doe",
    "emailVerified": true,
    "currentRole": "spectator"
  }
}
```

**Error Responses:**
- `400 Bad Request` — Invalid auth code
- `401 Unauthorized` — OAuth provider error

### POST /api/v1/auth/apple

Initiate Apple Sign-In flow (iOS only).

**Request Body:**
```json
{
  "identityToken": "identity_token_from_apple",
  "user": {
    "name": { "firstName": "John", "lastName": "Doe" }
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "session": {
    "token": "jwt_token",
    "expiresAt": "2026-03-23T15:30:00Z"
  },
  "user": {
    "id": "uuid",
    "email": "user@privaterelay.appleid.com",
    "name": "John Doe",
    "emailVerified": true,
    "currentRole": "spectator"
  }
}
```

**Error Responses:**
- `400 Bad Request` — Invalid identity token
- `401 Unauthorized` — Apple verification failed

---

## Requirements

### Google OAuth Configuration

- Google Cloud Console project created with OAuth 2.0 credentials
- Separate client IDs for iOS, Android, and Web
- iOS client ID configured in `app.config.ts` with bundle identifier `ie.ceolx.app`
- Android client ID configured with package name `ie.ceolx.app`
- OAuth scopes: `openid profile email` (minimal scope)
- Redirect URI: `ceolx://oauth-callback` (deep link scheme)
- BetterAuth Google provider configured with all three client IDs

### Apple Sign-In Configuration

- Apple Developer Account with Team ID
- Service ID created (format: `ie.ceolx.app`)
- Sign-In with Apple capability enabled for the app
- Private Email Relay enabled (users can hide real email)
- Key pair generated and stored securely (Certificate Management in Apple Developer)
- BetterAuth Apple provider configured with Team ID, Service ID, and key

### Mobile Implementation

- `expo-auth-session` installed for Google OAuth on both platforms
- `@invertase/react-native-apple-authentication` installed for Apple Sign-In (iOS only)
- Google sign-in button visible on both iOS and Android
- Apple sign-in button visible on iOS only (platform check: `Platform.OS === 'ios'`)
- Both buttons visible on Sign Up and Sign In screens
- Buttons labeled "Continue with Google" and "Continue with Apple"

### Account Linking

- First social sign-in with email that doesn't exist: create new user, skip email verification
- Same email from different provider: link providers to one account (BetterAuth handles this)
- User can have multiple linked providers; session created from whichever provider was used
- No duplicate accounts with same email across different providers

### Session Management

- Social sign-in returns same JWT session token format as email/password
- Token stored securely in `expo-secure-store` (identical to M2-T1)
- Session persists across app restarts
- Logout from any sign-in method clears session identically

---

## Acceptance Criteria

- [ ] "Continue with Google" button appears on Sign Up and Sign In screens (both platforms)
- [ ] "Continue with Apple" button appears on iOS only (hidden on Android)
- [ ] Tapping Google button opens OAuth consent screen, user grants permission, returns to app signed in
- [ ] Tapping Apple button opens Apple Sign-In prompt (iOS), user authenticates, returns to app signed in
- [ ] Google sign-in works on iOS Simulator, iOS real device, Android Emulator, and Android real device
- [ ] Apple sign-in works on iOS real device via TestFlight (does NOT work in Simulator)
- [ ] New social sign-in creates a user account without requiring email verification
- [ ] Signing in with same email via different provider links to existing account (no duplicate)
- [ ] Social sign-in session persists across app restarts (same as email/password)
- [ ] Social sign-in returns JWT token and user data in expected format
- [ ] Error handling: OAuth errors show user-friendly messages (not raw error codes)
- [ ] Deep link callback (`ceolx://oauth-callback`) handled correctly by app

---

## Technical Notes

### Google OAuth Setup (Google Cloud Console)

1. Create OAuth 2.0 Client IDs:
   - **iOS**: Bundle ID `ie.ceolx.app`
   - **Android**: Package name `ie.ceolx.app`, signing certificate SHA-1 fingerprint
   - **Web**: Redirect URI `ceolx://oauth-callback`

2. Scopes: `openid profile email`

3. Store client IDs in environment variables:
   ```bash
   GOOGLE_CLIENT_ID_IOS=...
   GOOGLE_CLIENT_ID_ANDROID=...
   GOOGLE_CLIENT_ID_WEB=...
   ```

### Apple Sign-In Setup (Apple Developer)

1. Register Service ID: `ie.ceolx.app`
2. Enable "Sign In with Apple" capability
3. Configure as a Web Authentication Configuration with redirect URI `ceolx://oauth-callback`
4. Create a private key and download it (keep secure)
5. Store securely:
   ```bash
   APPLE_TEAM_ID=...
   APPLE_SERVICE_ID=ie.ceolx.app
   APPLE_KEY_ID=...
   APPLE_PRIVATE_KEY=...  # PEM format, base64 encoded
   ```

### BetterAuth Google Provider

```typescript
// apps/api/src/lib/auth.ts

import { betterAuth } from 'better-auth';
import { google } from 'better-auth/providers';

export const auth = betterAuth({
  // ... other config
  socialProviders: {
    google: {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID_WEB!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  // For iOS and Android, use clientIds per platform
});
```

### BetterAuth Apple Provider

```typescript
// apps/api/src/lib/auth.ts

import { apple } from 'better-auth/providers';

export const auth = betterAuth({
  // ... other config
  socialProviders: {
    apple: {
      enabled: true,
      teamId: process.env.APPLE_TEAM_ID!,
      serviceId: process.env.APPLE_SERVICE_ID!,
      keyId: process.env.APPLE_KEY_ID!,
      privateKey: process.env.APPLE_PRIVATE_KEY!,
    },
  },
});
```

### Mobile Google Sign-In Screen

```typescript
// apps/mobile/src/screens/Auth/SignUpScreen.tsx

import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { useAuth } from '@/context/AuthContext';
import { Enums } from '@ceolx/shared';

const SignUpScreen = ({ navigation }: any) => {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const clientId =
        Platform.OS === 'ios'
          ? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS
          : process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;

      const discovery = await AuthSession.fetchDiscoveryAsync(
        'https://accounts.google.com'
      );

      const request = new AuthSession.AuthRequest({
        clientId: clientId!,
        redirectUrl: AuthSession.getRedirectUrl(),
        scopes: ['openid', 'profile', 'email'],
      });

      const result = await request.promptAsync(discovery);

      if (result.type === 'success') {
        // Send auth code to backend
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/v1/auth/google`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: result.params.code,
              redirectUri: AuthSession.getRedirectUrl(),
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          await login(data.session.token, data.user);
          // Navigation handled by AuthContext in RootNavigator
        }
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      // Show error toast to user
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (Platform.OS !== 'ios') return; // Apple Sign-In iOS only

    setLoading(true);
    try {
      const response = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      if (response.identityToken) {
        // Send identity token to backend
        const apiResponse = await fetch(
          `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/v1/auth/apple`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              identityToken: response.identityToken,
              user: response.user,
            }),
          }
        );

        if (apiResponse.ok) {
          const data = await apiResponse.json();
          await login(data.session.token, data.user);
        }
      }
    } catch (err) {
      console.error('Apple sign-in error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      {/* Email/Password form here (M2-T1) */}

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>Or continue with</Text>
        <View style={styles.line} />
      </View>

      <TouchableOpacity
        style={[styles.socialButton, styles.googleButton]}
        onPress={handleGoogleSignIn}
        disabled={loading}
      >
        <Text style={styles.socialButtonText}>Continue with Google</Text>
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <TouchableOpacity
          style={[styles.socialButton, styles.appleButton]}
          onPress={handleAppleSignIn}
          disabled={loading}
        >
          <Text style={[styles.socialButtonText, styles.appleButtonText]}>
            Continue with Apple
          </Text>
        </TouchableOpacity>
      )}

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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 8,
    color: '#999',
    fontSize: 14,
  },
  socialButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  googleButton: {
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  appleButton: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  socialButtonText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  appleButtonText: {
    color: '#fff',
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

### Mobile Apple Sign-In (iOS only)

```typescript
// apps/mobile/src/screens/Auth/SignUpScreen.tsx (Apple portion)

import { appleAuth } from '@invertase/react-native-apple-authentication';
import { Platform } from 'react-native';

const handleAppleSignIn = async () => {
  if (Platform.OS !== 'ios') return;

  try {
    const appleAuthRequestResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [
        appleAuth.Scope.EMAIL,
        appleAuth.Scope.FULL_NAME,
      ],
    });

    const { identityToken, user } = appleAuthRequestResponse;

    if (!identityToken) {
      throw new Error('Apple Sign-In failed - no identity token');
    }

    // Send to backend for verification
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_API_BASE_URL}/api/v1/auth/apple`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityToken,
          user: {
            name: user?.name,
            email: user?.email,
          },
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const { login } = useAuth();
      await login(data.session.token, data.user);
    }
  } catch (err) {
    console.error('Apple authentication error:', err);
  }
};
```

---

## Common Gotchas

- **Apple Sign-In does NOT work in Simulator** — must test on a physical device via TestFlight. Budget time for a TestFlight build.
- **Google client IDs per platform** — iOS and Android have separate client IDs; do not reuse them across platforms.
- **Apple email privacy** — Users can hide their real email; Apple provides a private relay address. Store whatever email is returned.
- **Account linking server-side** — Never merge accounts on the client. BetterAuth handles this; trust its implementation.
- **Deep link callback** — The OAuth redirect URI (`ceolx://oauth-callback`) must be registered in `app.config.ts` under `expo.scheme`.
- **Private Email Relay** — Users can opt to hide their email with Apple Sign-In. Always handle the case where email is hidden.
- **TestFlight for Apple** — Apple Sign-In requires code signing and provisioning profiles; external testing (TestFlight) is the only way to test on real device.
- **Environment variables** — Google and Apple credentials must be stored as env vars, never hardcoded in app source.

---
