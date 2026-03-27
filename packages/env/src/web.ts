import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  clientPrefix: 'VITE_',
  client: {
    VITE_SERVER_URL: z.url(),
    VITE_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  },
  runtimeEnv: (import.meta as unknown as { env: Record<string, string | undefined> }).env,
  emptyStringAsUndefined: true,
});
