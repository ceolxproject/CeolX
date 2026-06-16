import { createDeepLinkBridge } from './deep-link-bridge.js';

// HTTPS bridge for the email-verification button. See deep-link-bridge.ts for
// why a custom-scheme link can't go straight into the email.
const verifyEmail = createDeepLinkBridge({
  path: 'verify-email',
  errorTitle: 'Verification link error',
  errorBody: 'This verification link is missing or invalid. Please request a new one from the app.',
});

export default verifyEmail;
