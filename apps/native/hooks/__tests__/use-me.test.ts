import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the options passed to useQuery so we can assert on `enabled`.
// Mutable so individual tests can simulate a populated (stale) cache entry —
// a disabled useQuery still returns whatever is already cached.
let useQueryResult: { data: unknown } = { data: undefined };
const useQueryMock = vi.fn((_opts: unknown) => useQueryResult);
const useAuthMock = vi.fn(() => ({ isAuthenticated: false, isGuest: false }));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: unknown) => useQueryMock(opts),
}));

vi.mock('@/utils/trpc', () => ({
  trpc: { users: { me: { queryOptions: () => ({ queryKey: ['users', 'me'] }) } } },
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

import { useMe } from '../use-me';

function enabledArg() {
  return (useQueryMock.mock.calls[0]?.[0] as { enabled?: boolean }).enabled;
}

describe('useMe — guest/auth guard (regression for guest "Retrying your session…" loop)', () => {
  beforeEach(() => {
    useQueryMock.mockClear();
    useQueryResult = { data: undefined };
  });

  it('stays disabled for a guest (skip → browse without a session)', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, isGuest: true });
    useMe();
    expect(enabledArg()).toBe(false);
  });

  it('stays disabled while unauthenticated and not yet a guest', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, isGuest: false });
    useMe();
    expect(enabledArg()).toBe(false);
  });

  it('enables for an authenticated, non-guest user', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, isGuest: false });
    useMe();
    expect(enabledArg()).toBe(true);
  });

  it('honours an explicit enabled:false even for an authenticated user', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, isGuest: false });
    useMe({ enabled: false });
    expect(enabledArg()).toBe(false);
  });
});

describe('useMe — masks stale cache when disabled (regression: guest sees prior artist/venue view after logout→skip)', () => {
  beforeEach(() => {
    useQueryMock.mockClear();
    useQueryResult = { data: undefined };
  });

  it('returns data:undefined for a guest even when the cache still holds a prior artist role', () => {
    // Logged-out artist's users.me entry survives in the singleton queryClient;
    // a disabled useQuery hands it right back. The hook must suppress it.
    useQueryResult = { data: { currentRole: 'artist' } };
    useAuthMock.mockReturnValue({ isAuthenticated: false, isGuest: true });
    expect(useMe().data).toBeUndefined();
  });

  it('passes cached data through for an authenticated, non-guest user', () => {
    useQueryResult = { data: { currentRole: 'artist' } };
    useAuthMock.mockReturnValue({ isAuthenticated: true, isGuest: false });
    expect(useMe().data).toEqual({ currentRole: 'artist' });
  });
});
