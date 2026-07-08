import { beforeEach, describe, expect, it, vi } from 'vitest';

// Regression: a guest ("Skip sign-in") tapping Save on an event used to fire the
// protected events.save mutation, 401, and fail silently — the optimistic
// bookmark icon just snapped back with no feedback or sign-in prompt. It must now
// route the guest to sign-in and never call the mutation.
// Asana [P2][Bug] 1216227544201487 — guest spectators unable to save events.

// Hoisted so the vi.mock factories below can reference them (vi.mock is hoisted
// above normal top-level declarations).
const { promptSignInMock, mutateMock, useGuestGateMock } = vi.hoisted(() => ({
  promptSignInMock: vi.fn(),
  mutateMock: vi.fn(),
  useGuestGateMock: vi.fn(() => ({ isAuthenticated: true, promptSignIn: promptSignInMock })),
}));

vi.mock('@/hooks/use-guest-gate', () => ({ useGuestGate: () => useGuestGateMock() }));
vi.mock('@/hooks/use-save-event', () => ({ useSaveEvent: () => ({ mutate: mutateMock }) }));

import { useSaveHandler } from '../use-save-handler';

const event = { id: 'e1', isSaved: false };

describe('useSaveHandler — guest gate', () => {
  beforeEach(() => {
    promptSignInMock.mockClear();
    mutateMock.mockClear();
  });

  it('routes a guest to sign-in and does not fire the save mutation', () => {
    useGuestGateMock.mockReturnValue({ isAuthenticated: false, promptSignIn: promptSignInMock });
    useSaveHandler(event).onToggleSave();
    expect(promptSignInMock).toHaveBeenCalledWith('Sign in to save events');
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('fires the save mutation for an authenticated user', () => {
    useGuestGateMock.mockReturnValue({ isAuthenticated: true, promptSignIn: promptSignInMock });
    useSaveHandler(event).onToggleSave();
    expect(mutateMock).toHaveBeenCalledWith({ eventId: 'e1', saved: true });
    expect(promptSignInMock).not.toHaveBeenCalled();
  });

  it('unsaves when the event is already saved', () => {
    useGuestGateMock.mockReturnValue({ isAuthenticated: true, promptSignIn: promptSignInMock });
    useSaveHandler({ id: 'e1', isSaved: true }).onToggleSave();
    expect(mutateMock).toHaveBeenCalledWith({ eventId: 'e1', saved: false });
  });
});
