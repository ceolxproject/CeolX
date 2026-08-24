import { describe, expect, it } from 'vitest';

import {
  VENUE_BILLING_RETURN_ROUTE,
  buildAppRedirectUrl,
  isAllowedDeepLinkRoute,
} from '../deep-link.js';
import { NOTIFICATION_TRIGGERS, NotificationTrigger } from '../triggers.js';

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

  it('allows the venue billing return route, both forms', () => {
    expect(isAllowedDeepLinkRoute('/(app)/(tabs)/profile')).toBe(true);
    expect(isAllowedDeepLinkRoute('/profile')).toBe(true);
  });

  it('allows the route the billing CTAs actually send', () => {
    // The pin. The suite below walks NOTIFICATION_TRIGGERS, and the billing URLs are
    // built outside the trigger matrix — which is how all three shipped pointing at a
    // route the bridge rejected with "This link is no longer valid or has expired".
    expect(isAllowedDeepLinkRoute(VENUE_BILLING_RETURN_ROUTE)).toBe(true);
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

describe('every email-bridge route is allowlisted', () => {
  // The HTTPS redirect bridge is only ever used for EMAIL CTAs. A trigger reaches
  // it two ways: via the dispatcher when it has a non-null `email` surface, and —
  // for USER_WELCOME — via its dedicated onboarding email (auth login-hook),
  // which builds a bridge URL despite the matrix row being `email: null`. Any
  // such route that isn't in ALLOWED_ROUTE_PATTERNS silently 403s at the bridge.
  // This pins the coupling between trigger `routeTemplate`s and the allowlist so
  // a new email trigger pointing at an un-allowlisted route fails CI, not prod.
  const SAMPLE_TOKENS: Record<string, string> = {
    bookingId: 'b-1',
    eventId: 'e-1',
    artistUserId: 'u-1',
    venueUserId: 'u-2',
  };
  const fillTemplate = (template: string): string =>
    template.replace(/\{(\w+)\}/g, (_match, key: string) => SAMPLE_TOKENS[key] ?? 'sample');

  const bridgeTriggers = Object.entries(NOTIFICATION_TRIGGERS).filter(
    ([trigger, def]) => def.email !== null || trigger === NotificationTrigger.USER_WELCOME
  );

  it.each(bridgeTriggers)('allows the email CTA route for %s', (_trigger, def) => {
    expect(isAllowedDeepLinkRoute(fillTemplate(def.routeTemplate))).toBe(true);
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
