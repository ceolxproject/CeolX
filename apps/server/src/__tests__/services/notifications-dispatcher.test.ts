// Hoisted mocks — must be defined before imports that depend on them.
const { mockNotificationsReturning, mockNotificationUsersValues, mockDb, insertCalls } = vi.hoisted(
  () => {
    const mockNotificationsReturning = vi.fn().mockResolvedValue([{ id: 'n-1' }]);
    const mockNotificationUsersValues = vi.fn().mockResolvedValue(undefined);

    // Track which schema table each insert() targets so tests can route
    // assertions properly. The dispatcher inserts twice (notifications, then
    // notification_users); the schema mock below hands back a discriminator
    // each call site can compare against.
    const insertCalls: Array<'notifications' | 'notification_users'> = [];

    const mockDb = {
      insert: vi.fn((schema: { __table: 'notifications' | 'notification_users' }) => {
        insertCalls.push(schema.__table);
        if (schema.__table === 'notifications') {
          return {
            values: vi.fn(() => ({ returning: mockNotificationsReturning })),
          };
        }
        return { values: mockNotificationUsersValues };
      }),
    };

    return {
      mockNotificationsReturning,
      mockNotificationUsersValues,
      mockDb,
      insertCalls,
    };
  }
);

vi.mock('@CeolX/db', () => ({ db: mockDb }));

vi.mock('@CeolX/db/schema/notifications', () => ({
  notifications: { __table: 'notifications', id: 'id' },
  notificationUsers: { __table: 'notification_users', id: 'id' },
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { db as RealDb } from '@CeolX/db';
import { NotificationTrigger } from '@CeolX/shared';

import { makeDispatchNotification } from '../../services/notifications-dispatcher.js';

const dbMock = mockDb as unknown as typeof RealDb;
const mockPublishJob = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  insertCalls.length = 0;
  mockNotificationsReturning.mockResolvedValue([{ id: 'n-1' }]);
});

afterEach(() => {
  vi.clearAllMocks();
});

const baseInput = {
  trigger: NotificationTrigger.BOOKING_INVITE_TO_ARTIST,
  recipientUserId: 'user-123',
  vars: {
    bookingId: 'b-abc',
    venueName: 'The Temple Bar',
    artistName: 'Celtic Thunder',
    eventTitle: 'Trad Night',
    date: 'Fri 1 May',
  },
};

// ─── Two-table writes (split schema) ─────────────────────────────────────────

describe('dispatchNotification — split schema', () => {
  it('writes the content row to notifications and the per-user row to notification_users', async () => {
    const dispatch = makeDispatchNotification({ db: dbMock, publishJob: mockPublishJob });
    await dispatch(baseInput);

    // notifications first (returns id), then notification_users
    expect(insertCalls).toEqual(['notifications', 'notification_users']);

    // The notification_users insert links the per-user row to the content id
    // and the recipient — no copy fields here.
    expect(mockNotificationUsersValues).toHaveBeenCalledWith({
      notificationId: 'n-1',
      userId: 'user-123',
    });
  });

  it('throws if the notifications insert returns no id (would orphan the join row)', async () => {
    mockNotificationsReturning.mockResolvedValueOnce([]);

    const dispatch = makeDispatchNotification({ db: dbMock, publishJob: mockPublishJob });

    await expect(dispatch(baseInput)).rejects.toThrow(/no id/);
    expect(mockNotificationUsersValues).not.toHaveBeenCalled();
  });
});

// ─── Push job publish (per-user, mentor §3 hybrid) ──────────────────────────

describe('dispatchNotification — push fan-out', () => {
  it('publishes exactly one notification.push job per dispatch (handler does the token fan-out)', async () => {
    const dispatch = makeDispatchNotification({ db: dbMock, publishJob: mockPublishJob });
    await dispatch(baseInput);

    expect(mockPublishJob).toHaveBeenCalledTimes(1);
    expect(mockPublishJob).toHaveBeenCalledWith('notification.push', {
      userId: 'user-123',
      title: 'New booking invite',
      // push variant — no "Respond before it expires."
      body: 'The Temple Bar invited you to play "Trad Night" on Fri 1 May.',
      persona: 'artist',
      route: '/bookings/b-abc',
    });
  });

  it('different triggers resolve to different copy (persona pinned by the trigger)', async () => {
    const dispatch = makeDispatchNotification({ db: dbMock, publishJob: mockPublishJob });
    await dispatch({
      trigger: NotificationTrigger.BOOKING_REQUEST_TO_VENUE,
      recipientUserId: 'venue-user-1',
      vars: baseInput.vars,
    });

    expect(mockPublishJob).toHaveBeenCalledWith(
      'notification.push',
      expect.objectContaining({
        userId: 'venue-user-1',
        title: 'New booking request',
        body: 'Celtic Thunder applied for "Trad Night" on Fri 1 May.',
        persona: 'venue',
      })
    );
  });
});

// ─── Error propagation ───────────────────────────────────────────────────────

describe('dispatchNotification — error propagation', () => {
  it('rejects if publishJob fails (QStash retries the job, not the caller)', async () => {
    mockPublishJob.mockRejectedValueOnce(new Error('qstash 500'));

    const dispatch = makeDispatchNotification({ db: dbMock, publishJob: mockPublishJob });

    await expect(dispatch(baseInput)).rejects.toThrow('qstash 500');
  });

  it('throws when vars are missing — surfaces matrix mismatches early', async () => {
    const dispatch = makeDispatchNotification({ db: dbMock, publishJob: mockPublishJob });

    await expect(
      dispatch({
        trigger: NotificationTrigger.BOOKING_INVITE_TO_ARTIST,
        recipientUserId: 'user-123',
        vars: { bookingId: 'b-1' }, // missing venueName/eventTitle/date
      })
    ).rejects.toThrow(/venueName/);
  });
});
