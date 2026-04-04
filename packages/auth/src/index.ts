import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { db } from '@CeolX/db';
import * as schema from '@CeolX/db/schema/auth';
import { sendEmail, sendPasswordResetEmail } from '@CeolX/email';
import { env } from '@CeolX/env/server';

import { buildVerificationDeepLink } from './email-utils';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: schema,
  }),
  trustedOrigins: [
    ...env.CORS_ALLOWED_ORIGINS.split('|'),
    'CeolX://',
    ...(env.NODE_ENV === 'development' ? ['exp://', 'exp://**', 'exp://192.168.*.*:*/**'] : []),
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 900, // 15 minutes
    sendResetPassword: async ({ user, token }) => {
      const deepLink = `ceolx://reset-password?token=${token}`;
      await sendPasswordResetEmail(user.email, deepLink);
    },
  },
  user: {
    additionalFields: {
      currentRole: { type: 'string', defaultValue: 'spectator', input: true },
      consentAt: { type: 'date', required: false, input: false },
      marketingConsent: { type: 'boolean', defaultValue: false, input: false },
      lastLoginAt: { type: 'date', required: false, input: false },
      flaggedInactive: { type: 'boolean', defaultValue: false, input: false },
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    expiresIn: 60 * 60 * 24, // 24 hours
    sendVerificationEmail: async ({ user, url }) => {
      const deepLink = buildVerificationDeepLink(url);

      await sendEmail({
        to: user.email,
        template: 'verification',
        data: {
          userName: user.name ?? '',
          verificationUrl: deepLink,
        },
      });
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
