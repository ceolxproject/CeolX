import { createHash } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = 'user_abc';

const {
  mockSelectLimit,
  mockInsertValues,
  mockInsertReturning,
  mockDeleteWhere,
  mockUpdateWhere,
  mockTransaction,
  mockDb,
  envState,
} = vi.hoisted(() => {
  const mockSelectLimit = vi.fn();
  const mockInsertReturning = vi.fn();
  // issueActivationToken uses INSERT ... RETURNING to get the new row id back, so
  // the mock has to model the chain rather than resolve at .values().
  const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
  const mockDeleteWhere = vi.fn(() => Promise.resolve());
  const mockUpdateWhere = vi.fn(() => Promise.resolve());
  const envState: Record<string, unknown> = { ACTIVATION_TOKEN_TTL_MINUTES: 45 };

  const mockDb: Record<string, unknown> = {};
  const mockTransaction = vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockDb));

  Object.assign(mockDb, {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: mockSelectLimit })) })),
    })),
    insert: vi.fn(() => ({ values: mockInsertValues })),
    delete: vi.fn(() => ({ where: mockDeleteWhere })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: mockUpdateWhere })) })),
    transaction: mockTransaction,
  });

  return {
    mockSelectLimit,
    mockInsertValues,
    mockInsertReturning,
    mockDeleteWhere,
    mockUpdateWhere,
    mockTransaction,
    mockDb,
    envState,
  };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));
vi.mock('@CeolX/env/server', () => ({
  get env() {
    return envState;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  envState.ACTIVATION_TOKEN_TTL_MINUTES = 45;
  mockSelectLimit.mockResolvedValue([]);
  mockInsertValues.mockImplementation(() => ({ returning: mockInsertReturning }));
  mockInsertReturning.mockResolvedValue([{ id: 'tok_new' }]);
  mockDeleteWhere.mockResolvedValue(undefined);
  mockUpdateWhere.mockResolvedValue(undefined);
  mockTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(mockDb));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/**
 * Read an argument out of a mock call.
 *
 * `vi.fn()` with no signature infers its call arguments as an empty tuple, so
 * indexing `.mock.calls[0][0]` is a type error even though it is correct at
 * runtime. This narrows in one place rather than casting at a dozen call sites.
 */
function callArg<T>(fn: { mock: { calls: unknown[][] } }, call = 0, arg = 0): T {
  return fn.mock.calls[call]?.[arg] as T;
}

const sha256b64url = (v: string) => createHash('sha256').update(v).digest('base64url');

describe('issueActivationToken', () => {
  it('returns a high-entropy base64url token', async () => {
    const { issueActivationToken } = await import('../services/activation-token.js');
    const { token, tokenId } = await issueActivationToken(USER_ID);

    // 32 random bytes → 43 base64url chars, no padding, no + or /
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // The row id comes back so a caller can revoke this exact token if the
    // activation email then fails to send.
    expect(tokenId).toBe('tok_new');
  });

  it('never repeats a token across issues', async () => {
    const { issueActivationToken } = await import('../services/activation-token.js');
    const seen = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      seen.add((await issueActivationToken(USER_ID)).token);
    }
    expect(seen.size).toBe(25);
  });

  it('persists only the hash — the raw token never reaches the database', async () => {
    const { issueActivationToken } = await import('../services/activation-token.js');
    const { token } = await issueActivationToken(USER_ID);

    const inserted = callArg<Record<string, unknown>>(mockInsertValues);
    expect(inserted.tokenHash).toBe(sha256b64url(token));
    expect(inserted.tokenHash).not.toBe(token);
    // Nothing in the persisted row may contain the raw token in any field.
    expect(JSON.stringify(inserted)).not.toContain(token);
  });

  it('sets expiry from configuration, absolutely rather than relatively', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-18T10:00:00.000Z'));
    envState.ACTIVATION_TOKEN_TTL_MINUTES = 45;

    const { issueActivationToken } = await import('../services/activation-token.js');
    const { expiresAt } = await issueActivationToken(USER_ID);

    expect(expiresAt.toISOString()).toBe('2026-08-18T10:45:00.000Z');
    const inserted = callArg<Record<string, unknown>>(mockInsertValues);
    expect((inserted.expiresAt as Date).toISOString()).toBe('2026-08-18T10:45:00.000Z');
  });

  it('honours a different configured TTL', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-18T10:00:00.000Z'));
    envState.ACTIVATION_TOKEN_TTL_MINUTES = 30;

    const { issueActivationToken } = await import('../services/activation-token.js');
    const { expiresAt } = await issueActivationToken(USER_ID);
    expect(expiresAt.toISOString()).toBe('2026-08-18T10:30:00.000Z');
  });

  it('invalidates prior unconsumed tokens and inserts in one transaction (D-18)', async () => {
    const { issueActivationToken } = await import('../services/activation-token.js');
    await issueActivationToken(USER_ID);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
  });

  it('fails loudly if the insert returns no row rather than minting a dead link', async () => {
    mockInsertReturning.mockResolvedValue([]);
    const { issueActivationToken } = await import('../services/activation-token.js');
    await expect(issueActivationToken(USER_ID)).rejects.toThrow(/returned no row/);
  });

  it('does not insert if invalidating the prior tokens fails', async () => {
    // The two writes must not be able to half-apply: a surviving older token
    // alongside a new one would mean two live activation links (D-18).
    mockDeleteWhere.mockRejectedValueOnce(new Error('delete exploded'));
    const { issueActivationToken } = await import('../services/activation-token.js');

    await expect(issueActivationToken(USER_ID)).rejects.toThrow('delete exploded');
    expect(mockInsertValues).not.toHaveBeenCalled();
  });
});

describe('resolveActivationToken', () => {
  const future = new Date('2026-08-18T11:00:00.000Z');
  const past = new Date('2026-08-18T09:00:00.000Z');
  const now = new Date('2026-08-18T10:00:00.000Z');

  it('looks the token up by hash, never by the raw value', async () => {
    const { resolveActivationToken } = await import('../services/activation-token.js');
    await resolveActivationToken('some-raw-token');
    // The service hashes before querying; if it ever queried the raw value this
    // test would still pass, so the real guarantee is the assertion in
    // issueActivationToken that only a hash is stored. This pins that a lookup
    // happens at all and returns the not-found branch cleanly.
    expect(mockSelectLimit).toHaveBeenCalledTimes(1);
  });

  it('returns invalid for a token that does not exist', async () => {
    mockSelectLimit.mockResolvedValue([]);
    const { resolveActivationToken } = await import('../services/activation-token.js');
    await expect(resolveActivationToken('nope', now)).resolves.toEqual({ status: 'invalid' });
  });

  it('returns invalid for a superseded token, indistinguishable from never-existed', async () => {
    // Prior tokens are deleted on re-issue, so an older link lands in the same
    // not-found branch — deliberately, so nothing leaks about which hashes exist.
    mockSelectLimit.mockResolvedValue([]);
    const { resolveActivationToken } = await import('../services/activation-token.js');
    await expect(resolveActivationToken('older-link', now)).resolves.toEqual({
      status: 'invalid',
    });
  });

  it('returns valid with the account it activates', async () => {
    mockSelectLimit.mockResolvedValue([
      { id: 'tok_1', userId: USER_ID, expiresAt: future, consumedAt: null },
    ]);
    const { resolveActivationToken } = await import('../services/activation-token.js');
    await expect(resolveActivationToken('raw', now)).resolves.toEqual({
      status: 'valid',
      tokenId: 'tok_1',
      userId: USER_ID,
    });
  });

  it('returns expired distinctly, so the venue can be offered a fresh link (D-24)', async () => {
    mockSelectLimit.mockResolvedValue([
      { id: 'tok_1', userId: USER_ID, expiresAt: past, consumedAt: null },
    ]);
    const { resolveActivationToken } = await import('../services/activation-token.js');
    await expect(resolveActivationToken('raw', now)).resolves.toEqual({ status: 'expired' });
  });

  it('treats the expiry boundary as expired', async () => {
    mockSelectLimit.mockResolvedValue([
      { id: 'tok_1', userId: USER_ID, expiresAt: now, consumedAt: null },
    ]);
    const { resolveActivationToken } = await import('../services/activation-token.js');
    await expect(resolveActivationToken('raw', now)).resolves.toEqual({ status: 'expired' });
  });

  it('returns consumed for a token already used', async () => {
    mockSelectLimit.mockResolvedValue([
      { id: 'tok_1', userId: USER_ID, expiresAt: future, consumedAt: past },
    ]);
    const { resolveActivationToken } = await import('../services/activation-token.js');
    await expect(resolveActivationToken('raw', now)).resolves.toEqual({ status: 'consumed' });
  });

  it('reports consumed ahead of expired when a used token has also aged out', async () => {
    mockSelectLimit.mockResolvedValue([
      { id: 'tok_1', userId: USER_ID, expiresAt: past, consumedAt: past },
    ]);
    const { resolveActivationToken } = await import('../services/activation-token.js');
    await expect(resolveActivationToken('raw', now)).resolves.toEqual({ status: 'consumed' });
  });

  it('keeps the four outcomes distinct — none may collapse into another', async () => {
    const { resolveActivationToken } = await import('../services/activation-token.js');
    const outcomes: string[] = [];

    mockSelectLimit.mockResolvedValue([]);
    outcomes.push((await resolveActivationToken('a', now)).status);
    mockSelectLimit.mockResolvedValue([
      { id: 't', userId: USER_ID, expiresAt: past, consumedAt: null },
    ]);
    outcomes.push((await resolveActivationToken('b', now)).status);
    mockSelectLimit.mockResolvedValue([
      { id: 't', userId: USER_ID, expiresAt: future, consumedAt: past },
    ]);
    outcomes.push((await resolveActivationToken('c', now)).status);
    mockSelectLimit.mockResolvedValue([
      { id: 't', userId: USER_ID, expiresAt: future, consumedAt: null },
    ]);
    outcomes.push((await resolveActivationToken('d', now)).status);

    expect(outcomes).toEqual(['invalid', 'expired', 'consumed', 'valid']);
  });
});

describe('markActivationTokenConsumed', () => {
  it('stamps consumedAt', async () => {
    const at = new Date('2026-08-18T10:30:00.000Z');
    const { markActivationTokenConsumed } = await import('../services/activation-token.js');
    await markActivationTokenConsumed('tok_1', at);
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1);
  });

  it('is safe to call twice — a redelivered webhook must not error', async () => {
    const { markActivationTokenConsumed } = await import('../services/activation-token.js');
    await markActivationTokenConsumed('tok_1');
    await markActivationTokenConsumed('tok_1');
    expect(mockUpdateWhere).toHaveBeenCalledTimes(2);
  });
});
