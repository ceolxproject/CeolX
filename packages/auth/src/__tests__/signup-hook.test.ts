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
  user: { id: 'id', email: 'email' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
}));

import { afterEach, describe, expect, it, vi } from 'vitest';

import { assertEmailAvailable } from '../signup-hook.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('assertEmailAvailable — duplicate email is rejected before verification', () => {
  it('throws an "already exists" error when any account owns the email', async () => {
    mockSelectLimit.mockResolvedValueOnce([{ id: 'user_1' }]);

    await expect(assertEmailAvailable('taken@example.com')).rejects.toThrow(/already exists/i);
  });

  it('blocks regardless of role/verification state — the row existing is enough', async () => {
    // Per Asana 1215616181509943: a half-finished (unverified) signup still
    // counts as taken; we only need one matching row to reject.
    mockSelectLimit.mockResolvedValueOnce([{ id: 'user_unverified' }]);

    await expect(assertEmailAvailable('artist@example.com')).rejects.toThrow(/sign in/i);
  });
});

describe('assertEmailAvailable — available email passes through', () => {
  it('resolves when no account owns the email', async () => {
    mockSelectLimit.mockResolvedValueOnce([]);

    await expect(assertEmailAvailable('new@example.com')).resolves.toBeUndefined();
  });

  it('normalises case + surrounding whitespace before the lookup', async () => {
    // BetterAuth stores emails lowercased; match that so "Foo@X.com" can't slip
    // past the uniqueness gate on a case difference.
    mockSelectLimit.mockResolvedValueOnce([]);

    await assertEmailAvailable('  New@Example.COM  ');

    const whereArg = mockSelectWhere.mock.calls[0]?.[0] as { val: string };
    expect(whereArg.val).toBe('new@example.com');
  });
});

describe('assertEmailAvailable — defers malformed bodies to BetterAuth', () => {
  it('does not query for a non-string or empty email', async () => {
    await expect(assertEmailAvailable(undefined)).resolves.toBeUndefined();
    await expect(assertEmailAvailable('   ')).resolves.toBeUndefined();

    expect(mockSelect).not.toHaveBeenCalled();
  });
});
