import { expoClient } from '@better-auth/expo/client';
import { inferAdditionalFields, usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import { env } from '@CeolX/env/native';

export const authClient = createAuthClient({
  baseURL: env.EXPO_PUBLIC_SERVER_URL,
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
    // Profile handle (ceolx.com/u/<username>): exposes authClient.isUsernameAvailable
    // for the live picker check and adds username/displayUsername to updateUser.
    usernameClient(),
    expoClient({
      scheme: Constants.expoConfig?.scheme as string,
      storagePrefix: Constants.expoConfig?.scheme as string,
      storage: SecureStore,
    }),
  ],
});
