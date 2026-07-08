import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regression: once posts.feed became public, guests ("Skip sign-in") can see and
// tap Like, but posts.toggleLike is protected — firing it 401s and the optimistic
// heart snaps back with no feedback. The like must route the guest to sign-in and
// never call the mutation. Asana [P2][Bug] 1216227543475896.

// Hoisted so the vi.mock factories below can reference them (vi.mock is hoisted
// above normal top-level declarations).
const { promptSignInMock, mutateMock, useGuestGateMock } = vi.hoisted(() => ({
  promptSignInMock: vi.fn(),
  mutateMock: vi.fn(),
  useGuestGateMock: vi.fn(() => ({ isAuthenticated: true, promptSignIn: promptSignInMock })),
}));

vi.mock('@/hooks/use-guest-gate', () => ({ useGuestGate: () => useGuestGateMock() }));
vi.mock('@/hooks/use-toggle-post-like', () => ({
  useTogglePostLike: () => ({ mutate: mutateMock }),
}));

import { useLikeHandler } from '../use-like-handler';

describe('useLikeHandler — guest gate', () => {
  beforeEach(() => {
    promptSignInMock.mockClear();
    mutateMock.mockClear();
  });

  it('routes a guest to sign-in and does not fire the like mutation', () => {
    useGuestGateMock.mockReturnValue({ isAuthenticated: false, promptSignIn: promptSignInMock });
    useLikeHandler('p1').onLikePress();
    expect(promptSignInMock).toHaveBeenCalledWith('Sign in to like posts');
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('fires the like mutation for an authenticated user', () => {
    useGuestGateMock.mockReturnValue({ isAuthenticated: true, promptSignIn: promptSignInMock });
    useLikeHandler('p1').onLikePress();
    expect(mutateMock).toHaveBeenCalledWith({ postId: 'p1' });
    expect(promptSignInMock).not.toHaveBeenCalled();
  });
});
