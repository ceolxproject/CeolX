import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { env } from '@CeolX/env/web';

export const authClient = createAuthClient({
  baseURL: env.VITE_SERVER_URL,
  plugins: [
    inferAdditionalFields({
      user: {
        currentRole: { type: 'string' as const, input: true },
        consentAt: { type: 'date' as const, input: false },
        marketingConsent: { type: 'boolean' as const, input: false },
        lastLoginAt: { type: 'date' as const, input: false },
        flaggedInactive: { type: 'boolean' as const, input: false },
      },
    }),
  ],
});
