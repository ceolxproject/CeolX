import { describe, expect, it } from 'vitest';

import { CEOLX_WEB_URL } from '../../constants.js';
import { buildInactivityWarningEmail } from '../inactivity-email.js';

describe('buildInactivityWarningEmail', () => {
  it('returns the S-08 subject, a body mentioning inactivity, and the web CTA', () => {
    const copy = buildInactivityWarningEmail();
    expect(copy.subject).toBe('We miss you at CeolX');
    expect(copy.body).toMatch(/inactive/i);
    expect(copy.ctaUrl).toBe(CEOLX_WEB_URL);
  });
});
