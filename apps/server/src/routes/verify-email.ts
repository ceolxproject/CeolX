import { auth } from '@CeolX/auth';

import { createDeepLinkBridge } from './deep-link-bridge.js';

// HTTPS bridge for the email-verification button. See deep-link-bridge.ts for
// why a custom-scheme link can't go straight into the email.
const verifyEmail = createDeepLinkBridge({
  path: 'verify-email',
  errorTitle: 'Verification link error',
  errorBody: 'This verification link is missing or invalid. Please request a new one from the app.',
  // Desktop/web fallback: when the deep link can't open the app, complete the
  // verification server-side so clicking the link works from any device. On
  // mobile the app still verifies first (and keeps its auto-sign-in session) —
  // this only runs when no app picked up the ceolx:// link. Returns false on an
  // expired/used/invalid token so the page can show the right message.
  confirm: async (token) => {
    try {
      await auth.api.verifyEmail({ query: { token } });
      return true;
    } catch {
      return false;
    }
  },
});

export default verifyEmail;
