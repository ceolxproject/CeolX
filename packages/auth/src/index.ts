import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';

import { db } from '@CeolX/db';
import * as schema from '@CeolX/db/schema/auth';
import { sendPasswordResetEmail, sendVerificationEmail } from '@CeolX/email';
import { env } from '@CeolX/env/server';

import { generateAppleClientSecret } from './apple-secret.js';
import { buildDeepLinkBridgeUrl, buildVerificationBridgeUrl } from './email-utils';
import { onSessionCreated } from './login-hook.js';
import { normalizeEmail } from './normalize-email.js';
import { assertEmailAvailable } from './signup-hook.js';

// Endpoints whose request body carries a user-supplied email we must
// canonicalize so storage (sign-up) and lookup (sign-in / resend / reset)
// agree on the same key. See normalize-email.ts (Asana 1215700058851867).
const EMAIL_BODY_PATHS = new Set([
  '/sign-up/email',
  '/sign-in/email',
  '/forget-password',
  '/send-verification-email',
]);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: schema,
  }),
  trustedOrigins: [
    ...env.CORS_ALLOWED_ORIGINS.split('|'),
    'ceolx://',
    'https://appleid.apple.com',
    ...(env.NODE_ENV === 'development' ? ['exp://', 'exp://**', 'exp://192.168.*.*:*/**'] : []),
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 900, // 15 minutes
    sendResetPassword: async ({ user, token }) => {
      // Email clients drop custom-scheme links, so point at the HTTPS bridge
      // on our server which redirects to ceolx://reset-password?token=...
      const bridgeUrl = buildDeepLinkBridgeUrl('reset-password', token, env.BETTER_AUTH_URL);
      await sendPasswordResetEmail(user.email, bridgeUrl, user.name ?? '');
    },
  },
  user: {
    additionalFields: {
      currentRole: { type: 'string', defaultValue: 'spectator', input: true },
      consentAt: { type: 'date', required: false, input: false },
      marketingConsent: { type: 'boolean', defaultValue: false, input: false },
      lastLoginAt: { type: 'date', required: false, input: false },
      flaggedInactive: { type: 'boolean', defaultValue: false, input: false },
      deletionRequestedAt: { type: 'date', required: false, input: false },
      deletionScheduledFor: { type: 'date', required: false, input: false },
      deletionCancelledAt: { type: 'date', required: false, input: false },
      isAnonymized: { type: 'boolean', defaultValue: false, input: false },
      anonymizedAt: { type: 'date', required: false, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        after: onSessionCreated,
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!EMAIL_BODY_PATHS.has(ctx.path)) return undefined;

      // Canonicalize the email the user typed (lowercase + trim) so the
      // byte-exact `user.email` unique constraint and Better Auth's lookups
      // can't be fooled by casing — the root cause of plus/casing
      // verification confusion (Asana 1215700058851867). The +tag is kept,
      // so plus-addressed accounts stay independent.
      const body = ctx.body as { email?: unknown } | undefined;
      const email = normalizeEmail(body?.email);

      // Reject sign-up with an already-registered email *before* Better Auth's
      // enumeration-protection silently returns success and sends a verification
      // email. Without this, re-registering an existing email (e.g. a second
      // role) showed a misleading "verification sent" screen (Asana 1215616181509943).
      if (ctx.path === '/sign-up/email') {
        await assertEmailAvailable(email);
      }

      // Hand Better Auth the normalized body so every downstream step (storage,
      // dup-check, verification token identifier, login lookup) uses one key.
      if (email && body && body.email !== email) {
        return { context: { ...ctx, body: { ...body, email } } };
      }

      return undefined;
    }),
  },
  emailVerification: {
    sendOnSignUp: true,
    expiresIn: 60 * 60 * 24, // 24 hours
    // Create a session the moment the email is verified. The mobile app makes
    // the verifyEmail call itself, so the Set-Cookie lands in the app's cookie
    // store — letting verify-email.tsx route straight into onboarding/the app
    // instead of bouncing to sign-in for a fresh signup. (Asana 1215273331307886)
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Email clients drop custom-scheme links, so point at the HTTPS bridge
      // on our server which redirects to ceolx://verify-email?token=...
      const bridgeUrl = buildVerificationBridgeUrl(url, env.BETTER_AUTH_URL);
      await sendVerificationEmail(user.email, bridgeUrl, user.name ?? '');
    },
  },
  rateLimit: {
    enabled: true,
    customRules: {
      '/forget-password': {
        window: 3600, // 1 hour
        max: 3,
      },
    },
  },
  socialProviders: {
    ...(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET
      ? {
          google: {
            // Accept the web client id plus the native iOS/Android client ids
            // as valid idToken audiences. BetterAuth types clientId as a string,
            // but the runtime verifier accepts an array — so one provider
            // validates tokens from BOTH the legacy web redirect and the native
            // Google Sign-In SDK (which mints the token with the web id as aud).
            clientId: [
              env.GOOGLE_OAUTH_CLIENT_ID,
              env.GOOGLE_OAUTH_IOS_CLIENT_ID,
              env.GOOGLE_OAUTH_ANDROID_CLIENT_ID,
            ].filter(Boolean) as unknown as string,
            clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
            // Never auto-create an account for an unknown Google identity. A
            // brand-new user tapping Google on the Login screen must instead go
            // through Who-are-you → sign-up (role + ToS). The sign-up path opts
            // back in with `requestSignUp: true`; the sign-in path omits it, so
            // the server refuses to create a row (Asana 1215188822147991).
            disableImplicitSignUp: true,
          },
        }
      : {}),
    ...(env.APPLE_OAUTH_CLIENT_ID &&
    env.APPLE_OAUTH_TEAM_ID &&
    env.APPLE_OAUTH_KEY_ID &&
    env.APPLE_OAUTH_PRIVATE_KEY
      ? (() => {
          const clientId = env.APPLE_OAUTH_CLIENT_ID;
          const teamId = env.APPLE_OAUTH_TEAM_ID;
          const keyId = env.APPLE_OAUTH_KEY_ID;
          const privateKey = env.APPLE_OAUTH_PRIVATE_KEY;
          return {
            apple: async () => ({
              clientId,
              appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER ?? 'ie.ceolx.app',
              // Same gate as Google: an unknown Apple identity is not auto-signed
              // up. The idToken sign-in path returns OAUTH_LINK_ERROR instead of
              // creating a spectator row (Asana 1215188822147991).
              disableImplicitSignUp: true,
              clientSecret: await generateAppleClientSecret({
                clientId,
                teamId,
                keyId,
                privateKey,
              }),
            }),
          };
        })()
      : {}),
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'apple', 'email-password'],
    },
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  advanced: {
    defaultCookieAttributes: {
      sameSite: 'none',
      secure: true,
      httpOnly: true,
    },
  },
  plugins: [expo()],
});
