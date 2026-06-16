import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the options passed to useQuery so we can assert on `enabled`.
const useQueryMock = vi.fn(() => ({ data: undefined }));
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
