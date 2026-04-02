import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { db } from '@CeolX/db';
import * as schema from '@CeolX/db/schema/auth';
import { sendEmail } from '@CeolX/email';
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
  },
  emailVerification: {
    sendOnSignUp: true,
    expiresIn: 60 * 60 * 24, // 24 hours
    sendVerificationEmail: async ({ user, url }) => {
      const deepLink = buildVerificationDeepLink(url);

      await sendEmail({
        to: user.email,
        subject: 'Verify your CeolX account',
        htmlBody: `
          <p>Hi ${user.name ?? 'there'},</p>
          <p>Please verify your CeolX account by tapping the link below on your mobile device:</p>
          <p><a href="${deepLink}">Verify my account</a></p>
          <p>This link expires in 24 hours.</p>
          <p>If you did not create a CeolX account, you can safely ignore this email.</p>
        `,
        textBody: `Verify your CeolX account: ${deepLink}\n\nThis link expires in 24 hours.`,
        tag: 'email-verification',
      });
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
