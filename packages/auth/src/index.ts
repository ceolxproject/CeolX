import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { db } from '@CeolX/db';
import * as schema from '@CeolX/db/schema/auth';
import { sendPasswordResetEmail, sendVerificationEmail } from '@CeolX/email';
import { env } from '@CeolX/env/server';

import { generateAppleClientSecret } from './apple-secret.js';
import { buildDeepLinkBridgeUrl, buildVerificationBridgeUrl } from './email-utils';
import { onSessionCreated } from './login-hook.js';

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
  emailVerification: {
    sendOnSignUp: true,
    expiresIn: 60 * 60 * 24, // 24 hours
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
            clientId: env.GOOGLE_OAUTH_CLIENT_ID,
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
