import { CEOLX_WEB_URL } from '../constants.js';

export interface InactivityWarningEmailCopy {
  subject: string;
  body: string;
  ctaUrl: string;
}

/**
 * Copy for the GDPR inactivity warning (matrix S-08). Email-only — not a
 * notification trigger — so it lives here rather than in `triggers.ts`. Sent
 * via the generic `notification` template; the recipient's name is supplied
 * separately by the caller (the template renders the greeting), so the body
 * stays name-agnostic. Goes to any account idle ~24 months, regardless of role.
 */
export function buildInactivityWarningEmail(): InactivityWarningEmailCopy {
  return {
    subject: 'We miss you at CeolX',
    body: 'Your CeolX account has been inactive for almost two years. Log in to keep it active — if it stays idle it may be removed.',
    ctaUrl: CEOLX_WEB_URL,
  };
}
