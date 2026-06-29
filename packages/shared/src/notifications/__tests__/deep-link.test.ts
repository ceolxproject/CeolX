import { describe, expect, it } from 'vitest';

import { buildAppRedirectUrl, isAllowedDeepLinkRoute } from '../deep-link.js';

describe('isAllowedDeepLinkRoute', () => {
  it('allows fully-qualified booking routes', () => {
    expect(isAllowedDeepLinkRoute('/(app)/(tabs)/bookings/b-123')).toBe(true);
  });

  it('allows the bare booking route form', () => {
    expect(isAllowedDeepLinkRoute('/bookings/b-123')).toBe(true);
  });

  it('allows the Discover home feed (welcome email CTA), both forms', () => {
    expect(isAllowedDeepLinkRoute('/(app)/(tabs)/discover')).toBe(true);
    expect(isAllowedDeepLinkRoute('/discover')).toBe(true);
  });

  it('rejects unknown routes and junk', () => {
    expect(isAllowedDeepLinkRoute('/(app)/(tabs)/settings')).toBe(false);
    expect(isAllowedDeepLinkRoute('/(app)/(tabs)/discover/event/e-1')).toBe(false);
    expect(isAllowedDeepLinkRoute('https://evil.example.com')).toBe(false);
    expect(isAllowedDeepLinkRoute('/bookings/')).toBe(false);
    expect(isAllowedDeepLinkRoute('')).toBe(false);
  });

  it('rejects a booking route with a path-traversal id', () => {
    expect(isAllowedDeepLinkRoute('/bookings/../admin')).toBe(false);
  });
});

describe('buildAppRedirectUrl', () => {
  it('builds an /r bridge URL with the route URL-encoded', () => {
    expect(buildAppRedirectUrl('https://api.ceolx.com', '/(app)/(tabs)/bookings/b-123')).toBe(
      'https://api.ceolx.com/r?to=%2F(app)%2F(tabs)%2Fbookings%2Fb-123'
    );
  });

  it('trims a trailing slash on the base URL', () => {
    expect(buildAppRedirectUrl('https://api.ceolx.com/', '/bookings/b-1')).toBe(
      'https://api.ceolx.com/r?to=%2Fbookings%2Fb-1'
    );
  });
});
