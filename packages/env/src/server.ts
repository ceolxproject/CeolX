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
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
