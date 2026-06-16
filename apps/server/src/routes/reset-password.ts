import { createDeepLinkBridge } from './deep-link-bridge.js';

// HTTPS bridge for the password-reset button. See deep-link-bridge.ts for
// why a custom-scheme link can't go straight into the email.
const resetPassword = createDeepLinkBridge({
  path: 'reset-password',
  errorTitle: 'Reset link error',
  errorBody:
    'This password reset link is missing or invalid. Please request a new one from the app.',
});

export default resetPassword;
