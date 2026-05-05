import 'dotenv/config';
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ALLOWED_ORIGINS: z.string().min(1),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    POSTMARK_API_TOKEN: z.string().optional(),
    POSTMARK_FROM_ADDRESS: z.string().default('noreply@ceolx.ie'),
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().default(1025),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    RATE_LIMIT_ENABLED: z.enum(['true', 'false']).default('true'),
    RATE_LIMIT_IP_ALLOWLIST: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
    APPLE_OAUTH_CLIENT_ID: z.string().optional(),
    APPLE_OAUTH_TEAM_ID: z.string().optional(),
    APPLE_OAUTH_KEY_ID: z.string().optional(),
    APPLE_OAUTH_PRIVATE_KEY: z.string().optional(),
    SENTRY_DSN_API: z.url().optional(),
    SENTRY_ENVIRONMENT: z.string().optional(),
    QSTASH_TOKEN: z.string().optional(),
    QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
    QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
    QSTASH_BASE_URL: z.string().url().optional(),
    TYPESENSE_HOST: z.string().min(1),
    TYPESENSE_API_KEY: z.string().min(1),
    TYPESENSE_PORT: z.coerce.number().default(443),
    TYPESENSE_PROTOCOL: z.enum(['http', 'https']).default('https'),
    AWS_REGION: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    S3_BUCKET_NAME: z.string().optional(),
    CLOUDFRONT_DOMAIN: z.string().optional(),
    // Mux — used by uploads router (Direct Upload) + /api/webhooks/mux.
    // Optional so the server boots in dev/test without Mux configured;
    // upload calls throw PRECONDITION_FAILED with a clear message instead.
    MUX_TOKEN_ID: z.string().optional(),
    MUX_TOKEN_SECRET: z.string().optional(),
    MUX_WEBHOOK_SECRET: z.string().optional(),
    // Firebase Cloud Messaging — used by apps/server/src/lib/firebase-admin
    // and the notification.push QStash handler. Optional so the server boots
    // in dev/test without push set up; getMessaging() throws on first use.
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
