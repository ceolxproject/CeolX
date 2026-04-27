// Hoisted mocks — must be defined before imports that depend on them.
const { mockInsertValues, mockSelectFromWhere, mockDb } = vi.hoisted(() => {
  const mockInsertValues = vi.fn().mockResolvedValue(undefined);
  const mockSelectFromWhere = vi.fn();

  const mockDb = {
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: mockSelectFromWhere })),
    })),
  };

  return { mockInsertValues, mockSelectFromWhere, mockDb };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));

vi.mock('@CeolX/db/schema/notifications', () => ({
  notifications: {
    id: 'id',
    userId: 'user_id',
    type: 'type',
    title: 'title',
    body: 'body',
    route: 'route',
    persona: 'persona',
    isRead: 'is_read',
    createdAt: 'created_at',
  },
  deviceTokens: {
    id: 'id',
    userId: 'user_id',
    fcmToken: 'fcm_token',
    platform: 'platform',
  },
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeDispatchNotification } from '../../services/notifications-dispatcher.js';

const mockPublishJob = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

const baseInput = {
  userId: 'user-123',
  type: 'booking_invitation',
  title: 'New booking invite',
  body: 'The Temple Bar invited you to play "Trad Night" on Sat 28 Mar.',
  route: '/bookings/abc',
  persona: 'artist' as const,
};

describe('dispatchNotification — inbox row', () => {
  it('always inserts an inbox row for the recipient with the matrix copy', async () => {
    mockSelectFromWhere.mockResolvedValueOnce([]); // no device tokens

    const dispatch = makeDispatchNotification({ db: mockDb, publishJob: mockPublishJob });
    await dispatch(baseInput);

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledWith({
      userId: 'user-123',
      type: 'booking_invitation',
      title: 'New booking invite',
      body: 'The Temple Bar invited you to play "Trad Night" on Sat 28 Mar.',
      route: '/bookings/abc',
      persona: 'artist',
    });
  });
});

describe('dispatchNotification — push fan-out', () => {
  it('skips publishJob when the user has no device tokens', async () => {
    mockSelectFromWhere.mockResolvedValueOnce([]);

    const dispatch = makeDispatchNotification({ db: mockDb, publishJob: mockPublishJob });
    await dispatch(baseInput);

    expect(mockPublishJob).not.toHaveBeenCalled();
  });

  it('publishes one notification.push job per device token', async () => {
    mockSelectFromWhere.mockResolvedValueOnce([
      { fcmToken: 'token-ios-1' },
      { fcmToken: 'token-android-1' },
      { fcmToken: 'token-ios-2' },
    ]);

    const dispatch = makeDispatchNotification({ db: mockDb, publishJob: mockPublishJob });
    await dispatch(baseInput);

    expect(mockPublishJob).toHaveBeenCalledTimes(3);
    for (const token of ['token-ios-1', 'token-android-1', 'token-ios-2']) {
      expect(mockPublishJob).toHaveBeenCalledWith('notification.push', {
        deviceToken: token,
        title: baseInput.title,
        body: baseInput.body,
        persona: baseInput.persona,
        route: baseInput.route,
      });
    }
  });

  it('forwards optional data payload to every push job', async () => {
    mockSelectFromWhere.mockResolvedValueOnce([{ fcmToken: 'token-1' }]);

    const dispatch = makeDispatchNotification({ db: mockDb, publishJob: mockPublishJob });
    await dispatch({ ...baseInput, data: { bookingId: 'abc', actorId: 'venue-9' } });

    expect(mockPublishJob).toHaveBeenCalledWith('notification.push', {
      deviceToken: 'token-1',
      title: baseInput.title,
      body: baseInput.body,
      persona: baseInput.persona,
      route: baseInput.route,
      data: { bookingId: 'abc', actorId: 'venue-9' },
    });
  });

  it('passes persona through unchanged (artist / venue / spectator)', async () => {
    mockSelectFromWhere.mockResolvedValueOnce([{ fcmToken: 'token-1' }]);

    const dispatch = makeDispatchNotification({ db: mockDb, publishJob: mockPublishJob });
    await dispatch({ ...baseInput, persona: 'venue' });

    expect(mockPublishJob).toHaveBeenCalledWith(
      'notification.push',
      expect.objectContaining({ persona: 'venue' })
    );
  });
});

describe('dispatchNotification — error propagation', () => {
  it('rejects if the inbox insert fails (so callers can rollback)', async () => {
    mockInsertValues.mockRejectedValueOnce(new Error('db down'));

    const dispatch = makeDispatchNotification({ db: mockDb, publishJob: mockPublishJob });

    await expect(dispatch(baseInput)).rejects.toThrow('db down');
    expect(mockPublishJob).not.toHaveBeenCalled();
  });

  it('rejects if any publishJob fails (QStash will retry the job, not the caller)', async () => {
    mockSelectFromWhere.mockResolvedValueOnce([{ fcmToken: 'token-1' }]);
    mockPublishJob.mockRejectedValueOnce(new Error('qstash 500'));

    const dispatch = makeDispatchNotification({ db: mockDb, publishJob: mockPublishJob });

    await expect(dispatch(baseInput)).rejects.toThrow('qstash 500');
  });
});
