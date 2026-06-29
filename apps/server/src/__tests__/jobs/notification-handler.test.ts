// Hoisted mocks — vi.mock is lifted above imports.
//
// The new handler shape (mentor §3 hybrid) is per-user: it looks up active
// tokens for `payload.userId`, calls `messaging.sendEach`, then soft-
// deactivates rows whose per-message error code is terminal.

const { mockGetMessaging, mockSendEach, mockDb, captures } = vi.hoisted(() => {
  const mockSendEach = vi.fn();
  const mockGetMessaging = vi.fn();

  const captures = {
    selectWhere: undefined as unknown,
    updateSet: undefined as unknown,
    updateWhere: undefined as unknown,
    selectResult: [] as Array<{ id: string; fcmToken: string }>,
  };

  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn((clause: unknown) => {
          captures.selectWhere = clause;
          return Promise.resolve(captures.selectResult);
        }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((set: unknown) => ({
        where: vi.fn((clause: unknown) => {
          captures.updateSet = set;
          captures.updateWhere = clause;
          return Promise.resolve(undefined);
        }),
      })),
    })),
  };

  return { mockGetMessaging, mockSendEach, mockDb, captures };
});

vi.mock('../../lib/firebase-admin.js', () => ({
  getMessaging: mockGetMessaging,
}));

vi.mock('@CeolX/db', () => ({ db: mockDb }));

vi.mock('@CeolX/db/schema/notifications', () => ({
  deviceTokens: {
    id: 'id',
    userId: 'user_id',
    fcmToken: 'fcm_token',
    isActive: 'is_active',
    updatedAt: 'updated_at',
  },
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleNotificationPush } from '../../jobs/handlers/notification.js';

const validPayload = {
  userId: 'user-123',
  title: 'New performance invite',
  body: 'The Temple Bar invited you to play "Trad Night" on Fri 1 May.',
  persona: 'artist' as const,
  route: '/bookings/123',
};

beforeEach(() => {
  // Default: messaging is configured and returns a sendEach mock.
  mockGetMessaging.mockReturnValue({ sendEach: mockSendEach });
  captures.selectResult = [];
  captures.selectWhere = undefined;
  captures.updateSet = undefined;
  captures.updateWhere = undefined;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── No-op guards ────────────────────────────────────────────────────────────

describe('handleNotificationPush — no-op guards', () => {
  it('returns early when getMessaging() is null (no Firebase creds in dev/CI)', async () => {
    mockGetMessaging.mockReturnValueOnce(null);

    await expect(handleNotificationPush(validPayload)).resolves.toBeUndefined();
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockSendEach).not.toHaveBeenCalled();
  });

  it('returns early when the user has no active device tokens', async () => {
    captures.selectResult = [];

    await expect(handleNotificationPush(validPayload)).resolves.toBeUndefined();
    expect(mockSendEach).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

// ─── sendEach happy path ─────────────────────────────────────────────────────

describe('handleNotificationPush — sendEach batch fan-out', () => {
  it('builds a Message per active token with platform-specific shape', async () => {
    captures.selectResult = [
      { id: 'row-ios', fcmToken: 'token-ios-1' },
      { id: 'row-android', fcmToken: 'token-android-1' },
    ];
    mockSendEach.mockResolvedValueOnce({
      successCount: 2,
      failureCount: 0,
      responses: [
        { success: true, messageId: 'm1' },
        { success: true, messageId: 'm2' },
      ],
    });

    await handleNotificationPush(validPayload);

    expect(mockSendEach).toHaveBeenCalledTimes(1);
    const messages = mockSendEach.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(messages).toHaveLength(2);

    // First message — iOS row
    expect(messages[0]).toMatchObject({
      token: 'token-ios-1',
      notification: { title: validPayload.title, body: validPayload.body },
      data: { persona: 'artist', route: '/bookings/123' },
      android: { priority: 'high', notification: { channelId: 'default', sound: 'default' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
  });

  it('forwards extra data fields alongside persona + route', async () => {
    captures.selectResult = [{ id: 'row-1', fcmToken: 'token-1' }];
    mockSendEach.mockResolvedValueOnce({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true, messageId: 'm1' }],
    });

    await handleNotificationPush({
      ...validPayload,
      data: { bookingId: 'b-abc', kind: 'invite' },
    });

    const messages = mockSendEach.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(messages[0]?.data).toEqual({
      persona: 'artist',
      route: '/bookings/123',
      bookingId: 'b-abc',
      kind: 'invite',
    });
  });

  it('does not soft-deactivate when every message succeeded', async () => {
    captures.selectResult = [{ id: 'row-1', fcmToken: 'token-1' }];
    mockSendEach.mockResolvedValueOnce({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true, messageId: 'm1' }],
    });

    await handleNotificationPush(validPayload);

    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

// ─── Stale-token cleanup loop ────────────────────────────────────────────────

describe('handleNotificationPush — soft-deactivate on terminal errors', () => {
  it('soft-deactivates rows for tokens with messaging/registration-token-not-registered', async () => {
    captures.selectResult = [
      { id: 'row-good', fcmToken: 'token-good' },
      { id: 'row-dead', fcmToken: 'token-dead' },
    ];
    mockSendEach.mockResolvedValueOnce({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true, messageId: 'm1' },
        {
          success: false,
          error: { code: 'messaging/registration-token-not-registered', message: 'gone' },
        },
      ],
    });

    await expect(handleNotificationPush(validPayload)).resolves.toBeUndefined();

    // db.update is called once with isActive: false and an inArray over the
    // single dead row.
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(captures.updateSet).toMatchObject({ isActive: false });
  });

  it('soft-deactivates rows for tokens with messaging/invalid-registration-token', async () => {
    captures.selectResult = [{ id: 'row-invalid', fcmToken: 'token-invalid' }];
    mockSendEach.mockResolvedValueOnce({
      successCount: 0,
      failureCount: 1,
      responses: [
        {
          success: false,
          error: { code: 'messaging/invalid-registration-token', message: 'bad' },
        },
      ],
    });

    await expect(handleNotificationPush(validPayload)).resolves.toBeUndefined();
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it('only soft-deactivates terminal errors — leaves transient per-message errors alone', async () => {
    captures.selectResult = [
      { id: 'row-1', fcmToken: 'token-1' },
      { id: 'row-2', fcmToken: 'token-2' },
    ];
    mockSendEach.mockResolvedValueOnce({
      successCount: 0,
      failureCount: 2,
      responses: [
        {
          success: false,
          error: { code: 'messaging/server-unavailable', message: 'transient' },
        },
        {
          success: false,
          error: { code: 'messaging/internal-error', message: 'transient' },
        },
      ],
    });

    await expect(handleNotificationPush(validPayload)).resolves.toBeUndefined();
    // No update — we don't kill rows over transient errors. The next dispatch
    // will retry these tokens via QStash; if they keep failing for a real
    // terminal reason, the cleanup catches them later.
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

// ─── Network/auth failure → throw → QStash retry ─────────────────────────────

describe('handleNotificationPush — sendEach itself throws', () => {
  it('rethrows when sendEach errors at the network/auth layer', async () => {
    captures.selectResult = [{ id: 'row-1', fcmToken: 'token-1' }];
    mockSendEach.mockRejectedValueOnce(new Error('network down'));

    await expect(handleNotificationPush(validPayload)).rejects.toThrow('network down');
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
