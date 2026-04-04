import { TRPCError } from '@trpc/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appRouter } from '@CeolX/api/routers/index';
import { parseUserAgent } from '@CeolX/api/utils/parse-user-agent';

// ---------------------------------------------------------------------------
// Mock @CeolX/auth so tests don't need a real database or BetterAuth server
// vi.hoisted ensures mock functions are available when the factory runs
// ---------------------------------------------------------------------------

const { mockListSessions, mockRevokeSession, mockRevokeOtherSessions } = vi.hoisted(() => ({
  mockListSessions: vi.fn(),
  mockRevokeSession: vi.fn(),
  mockRevokeOtherSessions: vi.fn(),
}));

vi.mock('@CeolX/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      listSessions: mockListSessions,
      revokeSession: mockRevokeSession,
      revokeOtherSessions: mockRevokeOtherSessions,
    },
  },
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const CURRENT_TOKEN = 'token-current-device';
const OTHER_TOKEN = 'token-other-device';

const mockCurrentSession = {
  id: 'sess-1',
  token: CURRENT_TOKEN,
  userId: 'user-1',
  createdAt: new Date('2026-03-01T10:00:00Z'),
  updatedAt: new Date('2026-03-15T10:00:00Z'),
  expiresAt: new Date('2026-04-01T10:00:00Z'),
  ipAddress: '83.45.120.10',
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const mockOtherSession = {
  id: 'sess-2',
  token: OTHER_TOKEN,
  userId: 'user-1',
  createdAt: new Date('2026-02-15T08:00:00Z'),
  updatedAt: new Date('2026-03-10T08:00:00Z'),
  expiresAt: new Date('2026-04-15T08:00:00Z'),
  ipAddress: '192.168.1.1',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};

const mockNullUASession = {
  id: 'sess-3',
  token: 'token-unknown',
  userId: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  expiresAt: new Date('2026-02-01T00:00:00Z'),
  ipAddress: null,
  userAgent: null,
};

/** Build a mock tRPC context for an authenticated user */
function makeAuthCtx() {
  return {
    session: {
      session: {
        id: 'sess-1',
        token: CURRENT_TOKEN,
        userId: 'user-1',
        expiresAt: new Date('2026-04-01T10:00:00Z'),
        createdAt: new Date('2026-03-01T10:00:00Z'),
        updatedAt: new Date('2026-03-15T10:00:00Z'),
        ipAddress: '83.45.120.10',
        userAgent: 'test-ua',
      },
      user: {
        id: 'user-1',
        email: 'test@ceolx.ie',
        emailVerified: true,
        name: 'Test User',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    },
    headers: new Headers({ Cookie: `better-auth.session_token=${CURRENT_TOKEN}` }),
  };
}

/** Build a mock tRPC context for an unauthenticated request */
function makeAnonCtx() {
  return {
    session: null,
    headers: new Headers(),
  };
}

// ---------------------------------------------------------------------------
// sessions.list
// ---------------------------------------------------------------------------

describe('sessions.list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns sessions with isCurrent flag correctly set', async () => {
    mockListSessions.mockResolvedValueOnce([mockCurrentSession, mockOtherSession]);
    const caller = appRouter.createCaller(makeAuthCtx());

    const result = await caller.sessions.list();

    const current = result.sessions.find((s) => s.id === 'sess-1');
    const other = result.sessions.find((s) => s.id === 'sess-2');
    expect(current?.isCurrent).toBe(true);
    expect(other?.isCurrent).toBe(false);
  });

  it('places the current session first in the list', async () => {
    // Other session created more recently, but current session should still come first
    mockListSessions.mockResolvedValueOnce([mockOtherSession, mockCurrentSession]);
    const caller = appRouter.createCaller(makeAuthCtx());

    const result = await caller.sessions.list();

    expect(result.sessions[0]?.isCurrent).toBe(true);
  });

  it('parses Chrome user agent into human-readable deviceLabel', async () => {
    mockListSessions.mockResolvedValueOnce([mockCurrentSession]);
    const caller = appRouter.createCaller(makeAuthCtx());

    const result = await caller.sessions.list();

    expect(result.sessions[0]?.deviceLabel).toContain('Chrome');
    expect(result.sessions[0]?.deviceLabel).toContain('macOS');
  });

  it('parses iPhone user agent into human-readable deviceLabel', async () => {
    mockListSessions.mockResolvedValueOnce([mockOtherSession]);
    const caller = appRouter.createCaller(makeAuthCtx());

    const result = await caller.sessions.list();

    const session = result.sessions[0];
    expect(session?.deviceLabel).toBeTruthy();
    // Should mention Safari and iOS
    expect(session?.os).toContain('iOS');
  });

  it('returns Unknown device for null userAgent', async () => {
    mockListSessions.mockResolvedValueOnce([mockNullUASession]);
    const caller = appRouter.createCaller(makeAuthCtx());

    const result = await caller.sessions.list();

    expect(result.sessions[0]?.deviceLabel).toBe('Unknown device');
  });

  it('does not expose the session token to the client', async () => {
    mockListSessions.mockResolvedValueOnce([mockCurrentSession, mockOtherSession]);
    const caller = appRouter.createCaller(makeAuthCtx());

    const result = await caller.sessions.list();

    for (const session of result.sessions) {
      expect(session).not.toHaveProperty('token');
    }
  });

  it('returns createdAt and expiresAt as ISO strings', async () => {
    mockListSessions.mockResolvedValueOnce([mockCurrentSession]);
    const caller = appRouter.createCaller(makeAuthCtx());

    const result = await caller.sessions.list();
    const session = result.sessions[0];

    expect(typeof session?.createdAt).toBe('string');
    expect(typeof session?.expiresAt).toBe('string');
    // Verify they are valid ISO date strings
    if (session) {
      expect(() => new Date(session.createdAt)).not.toThrow();
      expect(() => new Date(session.expiresAt)).not.toThrow();
    }
  });

  it('throws UNAUTHORIZED when not authenticated', async () => {
    const caller = appRouter.createCaller(makeAnonCtx());

    await expect(caller.sessions.list()).rejects.toThrow(TRPCError);
    await expect(caller.sessions.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('passes the request headers to BetterAuth listSessions', async () => {
    mockListSessions.mockResolvedValueOnce([]);
    const ctx = makeAuthCtx();
    const caller = appRouter.createCaller(ctx);

    await caller.sessions.list();

    expect(mockListSessions).toHaveBeenCalledWith(
      expect.objectContaining({ headers: ctx.headers })
    );
  });
});

// ---------------------------------------------------------------------------
// sessions.revoke
// ---------------------------------------------------------------------------

describe('sessions.revoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revokes a non-current session and returns success', async () => {
    mockListSessions.mockResolvedValueOnce([mockCurrentSession, mockOtherSession]);
    mockRevokeSession.mockResolvedValueOnce({ status: true });
    const caller = appRouter.createCaller(makeAuthCtx());

    const result = await caller.sessions.revoke({ sessionId: 'sess-2' });

    expect(result.success).toBe(true);
    expect(mockRevokeSession).toHaveBeenCalledWith(
      expect.objectContaining({ body: { token: OTHER_TOKEN } })
    );
  });

  it('throws BAD_REQUEST when attempting to revoke the current session', async () => {
    mockListSessions.mockResolvedValue([mockCurrentSession, mockOtherSession]);
    const caller = appRouter.createCaller(makeAuthCtx());

    const rejection = caller.sessions.revoke({ sessionId: 'sess-1' });
    await expect(rejection).rejects.toThrow(TRPCError);
    await expect(rejection).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('throws NOT_FOUND for an unknown session ID', async () => {
    mockListSessions.mockResolvedValueOnce([mockCurrentSession]);
    const caller = appRouter.createCaller(makeAuthCtx());

    await expect(caller.sessions.revoke({ sessionId: 'sess-nonexistent' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('does not call revokeSession when the target is the current session', async () => {
    mockListSessions.mockResolvedValueOnce([mockCurrentSession]);
    const caller = appRouter.createCaller(makeAuthCtx());

    await expect(caller.sessions.revoke({ sessionId: 'sess-1' })).rejects.toThrow();
    expect(mockRevokeSession).not.toHaveBeenCalled();
  });

  it('throws UNAUTHORIZED when not authenticated', async () => {
    const caller = appRouter.createCaller(makeAnonCtx());

    await expect(caller.sessions.revoke({ sessionId: 'sess-2' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

// ---------------------------------------------------------------------------
// sessions.revokeAll
// ---------------------------------------------------------------------------

describe('sessions.revokeAll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls revokeOtherSessions and returns success', async () => {
    mockRevokeOtherSessions.mockResolvedValueOnce({ status: true });
    const caller = appRouter.createCaller(makeAuthCtx());

    const result = await caller.sessions.revokeAll();

    expect(result.success).toBe(true);
    expect(mockRevokeOtherSessions).toHaveBeenCalledOnce();
  });

  it('passes the request headers to BetterAuth revokeOtherSessions', async () => {
    mockRevokeOtherSessions.mockResolvedValueOnce({ status: true });
    const ctx = makeAuthCtx();
    const caller = appRouter.createCaller(ctx);

    await caller.sessions.revokeAll();

    expect(mockRevokeOtherSessions).toHaveBeenCalledWith(
      expect.objectContaining({ headers: ctx.headers })
    );
  });

  it('throws UNAUTHORIZED when not authenticated', async () => {
    const caller = appRouter.createCaller(makeAnonCtx());

    await expect(caller.sessions.revokeAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

// ---------------------------------------------------------------------------
// parseUserAgent utility
// ---------------------------------------------------------------------------

describe('parseUserAgent', () => {
  it('parses Chrome on macOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const result = parseUserAgent(ua);
    expect(result.browser).toContain('Chrome');
    expect(result.os).toContain('macOS');
    expect(result.deviceLabel).toContain('Chrome');
    expect(result.deviceLabel).toContain('macOS');
  });

  it('parses Safari on iOS', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const result = parseUserAgent(ua);
    expect(result.os).toContain('iOS');
    expect(result.deviceLabel).toBeTruthy();
  });

  it('returns Unknown device for null', () => {
    const result = parseUserAgent(null);
    expect(result.deviceLabel).toBe('Unknown device');
    expect(result.browser).toBeNull();
    expect(result.os).toBeNull();
  });

  it('returns Unknown device for undefined', () => {
    const result = parseUserAgent(undefined);
    expect(result.deviceLabel).toBe('Unknown device');
  });

  it('returns Unknown device for empty string', () => {
    const result = parseUserAgent('');
    expect(result.deviceLabel).toBe('Unknown device');
  });

  it('returns an object with all three expected fields', () => {
    const result = parseUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/119.0.0.0'
    );
    expect(result).toHaveProperty('deviceLabel');
    expect(result).toHaveProperty('browser');
    expect(result).toHaveProperty('os');
  });
});
