import { createAppRedirectBridge } from './deep-link-bridge.js';

/**
 * Tokenless HTTPS→ceolx:// redirect bridge for notification email CTAs.
 * Mounted at `/r`; see `createAppRedirectBridge`.
 */
const appRedirect = createAppRedirectBridge();

export default appRedirect;
