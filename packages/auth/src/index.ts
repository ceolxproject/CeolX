import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { db } from '@CeolX/db';
import * as schema from '@CeolX/db/schema/auth';
import { sendPasswordResetEmail } from '@CeolX/email';
import { env } from '@CeolX/env/server';

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
    resetPasswordTokenExpiresIn: 900, // 15 minutes
    sendResetPassword: async ({ user, token }) => {
      const deepLink = `ceolx://reset-password?token=${token}`;
      await sendPasswordResetEmail(user.email, deepLink);
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
