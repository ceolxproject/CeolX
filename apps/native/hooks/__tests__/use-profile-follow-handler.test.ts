import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regression: a guest (Skip sign-in) tapping Follow used to fire the protected
// follows.follow mutation, 401, and show a "Could not follow" error. It must now
// route to sign-in and never call the mutation. Covers the post-card CTA and both
// profile-header CTAs, which all share this handler.

// Hoisted so the vi.mock factories below can safely reference them (vi.mock is
// hoisted above normal top-level declarations).
const { routerPushMock, mutateMock, useAuthMock } = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
  mutateMock: vi.fn(),
  useAuthMock: vi.fn(() => ({ isAuthenticated: true })),
}));

// Mock React so the hook runs as a plain function (same approach as use-social-auth.test).
vi.mock('react', () => ({
  useState: (initial: unknown) => [initial, vi.fn()],
  useEffect: vi.fn(),
}));
vi.mock('expo-router', () => ({ router: { push: routerPushMock, replace: vi.fn() } }));
vi.mock('@/components/AppToast', () => ({ appToast: { info: vi.fn(), error: vi.fn() } }));
vi.mock('@/contexts/auth-context', () => ({ useAuth: () => useAuthMock() }));
vi.mock('@/hooks/use-follow', () => ({ useFollow: () => ({ mutate: mutateMock }) }));
// use-guest-gate now records guest_gate_hit, and analytics.ts imports
// @sentry/react-native, which re-exports the real react-native and fails to parse
// under vitest. Mocked so the gate stays unit-testable.
vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  AnalyticsEvent: { GUEST_GATE_HIT: 'guest_gate_hit' },
}));

import { useProfileFollowHandler } from '../use-profile-follow-handler';

const profile = { userId: 'u1', isFollowing: false };

describe('useProfileFollowHandler — guest gate', () => {
  beforeEach(() => {
    routerPushMock.mockClear();
    mutateMock.mockClear();
  });

  it('routes a guest to sign-in and does not fire the follow mutation', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false });
    useProfileFollowHandler(profile).onFollowPress();
    expect(routerPushMock).toHaveBeenCalledWith('/(auth)/sign-in');
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('fires the follow mutation for an authenticated user', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true });
    useProfileFollowHandler(profile).onFollowPress();
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(routerPushMock).not.toHaveBeenCalled();
  });
});
