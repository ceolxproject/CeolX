import { describe, expect, it, vi } from 'vitest';

// posthog-react-native pulls in native deps that don't resolve under vitest, and
// the client is a no-op in tests anyway (no key). Only collapseRoute is under
// test here — it is the one piece with real branching logic.
vi.mock('posthog-react-native', () => ({ default: vi.fn() }));
vi.mock('@CeolX/env/native', () => ({
  env: { EXPO_PUBLIC_POSTHOG_KEY: undefined, EXPO_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com' },
}));

const { collapseRoute } = await import('../analytics');

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
    // every screen would report as /[id].
    expect(collapseRoute('/artist/profile')).toBe('/artist/profile');
    expect(collapseRoute('/venue/edit')).toBe('/venue/edit');
    expect(collapseRoute('/create')).toBe('/create');
  });

  it('never returns an empty string', () => {
    expect(collapseRoute('/')).toBe('/');
  });
});
