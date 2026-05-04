import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  clientPrefix: 'EXPO_PUBLIC_',
  client: {
    EXPO_PUBLIC_SERVER_URL: z.url(),
    EXPO_PUBLIC_SENTRY_DSN: z.url().optional(),
    // CloudFront CDN domain for media URLs. Optional in dev/test; required
    // in prod for delete-on-replace flows — use-media-delete derives the s3
    // key from a stored CDN url by stripping this domain.
    EXPO_PUBLIC_CLOUDFRONT_DOMAIN: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
