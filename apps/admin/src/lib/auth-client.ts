import { createAuthClient } from 'better-auth/react';

import { env } from '@CeolX/env/web';

export const authClient = createAuthClient({
  baseURL: env.VITE_SERVER_URL,
});
