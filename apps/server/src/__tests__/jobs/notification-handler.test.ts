// Hoisted mocks — vi.mock is lifted above imports.

const mockSend = vi.hoisted(() => vi.fn());
const mockDeleteWhere = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockDeleteChain = vi.hoisted(() => vi.fn(() => ({ where: mockDeleteWhere })));

vi.mock('../../lib/firebase-admin.js', () => ({
  getMessaging: () => ({ send: mockSend }),
}));

vi.mock('@CeolX/db', () => ({
  db: { delete: mockDeleteChain },
}));

vi.mock('@CeolX/db/schema/notifications', () => ({
  deviceTokens: { fcmToken: 'fcm_token' },
}));

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleNotificationPush } from '../../jobs/handlers/notification.js';

const validPayload = {
  deviceToken: 'fcm-token-abc',
  title: 'New booking invite',
  body: 'The Temple Bar invited you to play "Trad Night" on Fri 1 May.',
  persona: 'artist' as const,
  route: '/bookings/123',
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('handleNotificationPush — success path', () => {
  it('calls messaging.send with the right token + notification + data shape', async () => {
    mockSend.mockResolvedValueOnce('msg_abc123');

    await handleNotificationPush(validPayload);

    expect(mockSend).toHaveBeenCalledWith({
      token: 'fcm-token-abc',
      notification: {
        title: 'New booking invite',
        body: 'The Temple Bar invited you to play "Trad Night" on Fri 1 May.',
      },
      data: {
        persona: 'artist',
        route: '/bookings/123',
      },
    });
    expect(mockDeleteChain).not.toHaveBeenCalled();
  });

  it('forwards optional data fields alongside persona + route', async () => {
    mockSend.mockResolvedValueOnce('msg_abc');

    await handleNotificationPush({
      ...validPayload,
      data: { bookingId: 'abc', kind: 'invite' },
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          persona: 'artist',
          route: '/bookings/123',
          bookingId: 'abc',
          kind: 'invite',
        },
      })
    );
  });
});

describe('handleNotificationPush — token cleanup on terminal errors', () => {
  it('deletes the token row on REGISTRATION_TOKEN_NOT_REGISTERED and swallows', async () => {
    const err = Object.assign(new Error('not registered'), {
      code: 'messaging/registration-token-not-registered',
    });
    mockSend.mockRejectedValueOnce(err);

    await expect(handleNotificationPush(validPayload)).resolves.toBeUndefined();
    expect(mockDeleteChain).toHaveBeenCalledTimes(1);
    expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
  });

  it('deletes the token row on INVALID_REGISTRATION_TOKEN and swallows', async () => {
    const err = Object.assign(new Error('invalid'), {
      code: 'messaging/invalid-registration-token',
    });
    mockSend.mockRejectedValueOnce(err);

    await expect(handleNotificationPush(validPayload)).resolves.toBeUndefined();
    expect(mockDeleteChain).toHaveBeenCalledTimes(1);
  });
});

describe('handleNotificationPush — transient errors propagate (QStash retries)', () => {
  it('rethrows on SERVER_UNAVAILABLE so QStash backs off', async () => {
    const err = Object.assign(new Error('server unavailable'), {
      code: 'messaging/server-unavailable',
    });
    mockSend.mockRejectedValueOnce(err);

    await expect(handleNotificationPush(validPayload)).rejects.toThrow('server unavailable');
    expect(mockDeleteChain).not.toHaveBeenCalled();
  });

  it('rethrows on INTERNAL_ERROR', async () => {
    const err = Object.assign(new Error('internal'), {
      code: 'messaging/internal-error',
    });
    mockSend.mockRejectedValueOnce(err);

    await expect(handleNotificationPush(validPayload)).rejects.toThrow('internal');
    expect(mockDeleteChain).not.toHaveBeenCalled();
  });

  it('rethrows on unknown errors', async () => {
    mockSend.mockRejectedValueOnce(new Error('boom'));

    await expect(handleNotificationPush(validPayload)).rejects.toThrow('boom');
  });
});
