// Hoisted Drizzle mocks — vi.mock() is lifted by Vitest before any imports.

const mockSelectLimit = vi.hoisted(() => vi.fn());
const mockSelectWhere = vi.hoisted(() =>
  vi.fn((_condition: unknown) => ({ limit: mockSelectLimit }))
);
const mockSelectFrom = vi.hoisted(() => vi.fn(() => ({ where: mockSelectWhere })));
const mockSelect = vi.hoisted(() => vi.fn(() => ({ from: mockSelectFrom })));

vi.mock('@CeolX/db', () => ({
  db: { select: mockSelect },
}));

vi.mock('@CeolX/db/schema/auth', () => ({
  user: { id: 'id', username: 'username' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
}));

import { afterEach, describe, expect, it, vi } from 'vitest';

import { assertUsernameImmutable } from '../username-hook.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('assertUsernameImmutable — permanent handle cannot be reassigned', () => {
  it('rejects changing an already-set handle to a different value', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ username: 'priyamusic' }]);

    await expect(assertUsernameImmutable('user_1', 'someoneelse')).rejects.toThrow(
      /permanent and cannot be changed/i
    );
  });

  it('normalises (trim + lowercase) before comparing, so casing/whitespace is not a "change"', async () => {
    // The plugin stores handles lowercased; a re-send with stray casing must read
    // as the SAME value, not a rejected change.
    mockSelectLimit.mockResolvedValueOnce([{ username: 'priyamusic' }]);

    await expect(assertUsernameImmutable('user_1', '  PriyaMusic  ')).resolves.toBeUndefined();
  });
});

describe('assertUsernameImmutable — allowed writes pass through', () => {
  it('allows setting a handle when none is set yet (null -> value)', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ username: null }]);

    await expect(assertUsernameImmutable('user_1', 'priyamusic')).resolves.toBeUndefined();
  });

  it('allows re-sending the same handle (half-finished onboarding can retry)', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ username: 'priyamusic' }]);

    await expect(assertUsernameImmutable('user_1', 'priyamusic')).resolves.toBeUndefined();
  });
});

describe('assertUsernameImmutable — non-handle updates never query', () => {
  it('no-ops when the update carries no username/displayUsername (name/image edit)', async () => {
    // The update.before hook passes `data.username ?? data.displayUsername`, which
    // is undefined for a plain name/image update — must not block or query.
    await expect(assertUsernameImmutable('user_1', undefined)).resolves.toBeUndefined();

    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('no-ops when the userId is missing rather than fail-closed on a lookup', async () => {
    await expect(assertUsernameImmutable(undefined, 'priyamusic')).resolves.toBeUndefined();

    expect(mockSelect).not.toHaveBeenCalled();
  });
});
