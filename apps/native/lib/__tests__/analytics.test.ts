import { describe, expect, it, vi } from 'vitest';

// posthog-react-native pulls in native deps that don't resolve under vitest, and
// the client is a no-op in tests anyway (no key). Only the two pure helpers are
// under test here — they are the pieces with real branching logic.
vi.mock('posthog-react-native', () => ({ default: vi.fn() }));
// Same reason: @sentry/react-native re-exports react-native, whose index.js uses
// Flow's `import typeof` syntax that vite cannot parse. analytics.ts imports Sentry
// to report a throwing capture, so the module can't load here without this.
vi.mock('@sentry/react-native', () => ({ captureException: vi.fn() }));
vi.mock('@CeolX/env/native', () => ({
  env: { EXPO_PUBLIC_POSTHOG_KEY: undefined, EXPO_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com' },
}));

const { collapseRoute, AnalyticsEvent } = await import('../analytics');

describe('collapseRoute', () => {
  it('leaves static routes untouched', () => {
    expect(collapseRoute('/(app)/(tabs)/discover')).toBe('/(app)/(tabs)/discover');
    expect(collapseRoute('/change-password')).toBe('/change-password');
  });

  it('collapses uuid segments', () => {
    expect(collapseRoute('/events/0d5f8a1e-4c2b-4f7a-9b3d-1e2f3a4b5c6d')).toBe('/events/[id]');
  });

  it('collapses an id in the middle of a path', () => {
    expect(collapseRoute('/events/0d5f8a1e-4c2b-4f7a-9b3d-1e2f3a4b5c6d/analytics')).toBe(
      '/events/[id]/analytics'
    );
  });

  it('collapses numeric and long opaque ids', () => {
    expect(collapseRoute('/events/123456')).toBe('/events/[id]');
    expect(collapseRoute('/u/clx7k2p9q0000abcd1234')).toBe('/u/[id]');
  });

  it('keeps short readable segments that are not ids', () => {
    // Regression guard: an over-eager pattern would eat real route names and
    // every screen would report as /[id]. These are the real static routes that
    // sit next to, or under, a dynamic segment.
    expect(collapseRoute('/create/post')).toBe('/create/post');
    expect(collapseRoute('/profile/edit')).toBe('/profile/edit');
    expect(collapseRoute('/profile/followers')).toBe('/profile/followers');
    expect(collapseRoute('/events/create')).toBe('/events/create');
    expect(collapseRoute('/create')).toBe('/create');
  });

  /**
   * The regex alone only catches opaque ids, so short slugs leaked through and
   * became their own screen rows — `/u/nxnw`, `/artist/seed_artist` were both live
   * in PostHog. A username is a personal identifier, so this is the no-PII rule,
   * not just a tidiness one.
   */
  it('collapses short slugs under a parent whose child is always a record', () => {
    expect(collapseRoute('/u/nxnw')).toBe('/u/[id]');
    expect(collapseRoute('/artist/seed_artist')).toBe('/artist/[id]');
    expect(collapseRoute('/venue/demo_venue_test')).toBe('/venue/[id]');
    expect(collapseRoute('/map/event/abc')).toBe('/map/event/[id]');
  });

  it('still collapses the id under a static child', () => {
    expect(collapseRoute('/events/edit/0d5f8a1e-4c2b-4f7a-9b3d-1e2f3a4b5c6d')).toBe(
      '/events/edit/[id]'
    );
  });

  it('never returns an empty string', () => {
    expect(collapseRoute('/')).toBe('/');
  });
});

describe('AnalyticsEvent registry', () => {
  it('has no duplicate event names', () => {
    // Two keys sharing a string silently merges two funnels into one number, and the
    // mistake is invisible in the dashboard — the chart still renders.
    const names = Object.values(AnalyticsEvent);
    expect(new Set(names).size).toBe(names.length);
  });

  it('names every event in snake_case', () => {
    // PostHog treats names as opaque, so a stray camelCase entry just becomes a second
    // series next to the one everyone reads.
    for (const name of Object.values(AnalyticsEvent)) {
      expect(name).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
    }
  });
});

describe('venue activation funnel (M8)', () => {
  it('registers the three client-side funnel steps', () => {
    // The funnel this PR exists to measure: shown → asked → blocked.
    expect(AnalyticsEvent.VENUE_ACTIVATION_PROMPT_SHOWN).toBe('venue_activation_prompt_shown');
    expect(AnalyticsEvent.VENUE_ACTIVATION_EMAIL_REQUESTED).toBe(
      'venue_activation_email_requested'
    );
    expect(AnalyticsEvent.VENUE_PUBLISH_BLOCKED).toBe('venue_publish_blocked');
  });

  it('registers no client-side conversion event', () => {
    // Conversion happens in a browser, usually on another device, so the app never sees
    // it. An undeduped client event would inflate it by however many times the profile
    // screen is opened; Stripe is the source for the paid step.
    const names: string[] = Object.values(AnalyticsEvent);
    expect(names).not.toContain('venue_activation_completed');
    expect(names.filter((n) => n.includes('subscription_started'))).toEqual([]);
  });

  it('carries no price or plan in an event name', () => {
    // D-16: no price surfaces anywhere in the app, and that includes analytics payload
    // keys someone might later mirror into copy.
    for (const name of Object.values(AnalyticsEvent)) {
      expect(name).not.toMatch(/price|19\.99|199|eur/i);
    }
  });
});
