// Hoisted mocks — must be defined before imports that depend on them.
const {
  mockNotificationsReturning,
  mockNotificationUsersValues,
  mockUserFindFirst,
  mockDb,
  insertCalls,
} = vi.hoisted(() => {
  const mockNotificationsReturning = vi.fn().mockResolvedValue([{ id: 'n-1' }]);
  const mockNotificationUsersValues = vi.fn().mockResolvedValue(undefined);
  const mockUserFindFirst = vi
    .fn()
    .mockResolvedValue({ email: 'recipient@example.com', name: 'Aoife' });

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
    query: { user: { findFirst: mockUserFindFirst } },
  };

  return {
    mockNotificationsReturning,
    mockNotificationUsersValues,
    mockUserFindFirst,
    mockDb,
    insertCalls,
  };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));

vi.mock('@CeolX/db/schema/notifications', () => ({
  notifications: { __table: 'notifications', id: 'id' },
  notificationUsers: { __table: 'notification_users', id: 'id' },
}));

vi.mock('@CeolX/db/schema/auth', () => ({
  user: { __table: 'user', id: 'id' },
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
  mockUserFindFirst.mockResolvedValue({ email: 'recipient@example.com', name: 'Aoife' });
  // Email fan-out is gated on BETTER_AUTH_URL; default it OFF so the push-only
  // assertions (exactly one job) hold. The email tests opt in explicitly.
  vi.stubEnv('BETTER_AUTH_URL', '');
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
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
      route: '/(app)/(tabs)/bookings/b-abc',
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

// ─── Email fan-out (M7-T4 PR1 — booking lifecycle) ───────────────────────────

describe('dispatchNotification — email fan-out', () => {
  it('publishes an email.send job for a trigger with EMAIL copy, resolving the recipient address', async () => {
    vi.stubEnv('BETTER_AUTH_URL', 'https://api.ceolx.com');
    const dispatch = makeDispatchNotification({ db: dbMock, publishJob: mockPublishJob });
    await dispatch(baseInput);

    expect(mockUserFindFirst).toHaveBeenCalledTimes(1);
    expect(mockPublishJob).toHaveBeenCalledWith('email.send', {
      to: 'recipient@example.com',
      template: 'notification',
      locale: 'en',
      data: {
        userName: 'Aoife',
        subject: 'You\'ve been invited to play "Trad Night"',
        body: 'The Temple Bar invited you to perform at "Trad Night" on Fri 1 May.',
        ctaUrl: 'https://api.ceolx.com/r?to=%2F(app)%2F(tabs)%2Fbookings%2Fb-abc',
      },
    });
    // push + email
    expect(mockPublishJob).toHaveBeenCalledTimes(2);
  });

  it('skips email for triggers with no EMAIL copy (co-artist invite)', async () => {
    vi.stubEnv('BETTER_AUTH_URL', 'https://api.ceolx.com');
    const dispatch = makeDispatchNotification({ db: dbMock, publishJob: mockPublishJob });
    await dispatch({
      trigger: NotificationTrigger.BOOKING_INVITE_TO_COARTIST,
      recipientUserId: 'user-123',
      vars: {
        bookingId: 'b-abc',
        coArtistName: 'Tune Bomb',
        eventTitle: 'Trad Night',
        date: 'Fri 1 May',
      },
    });

    expect(mockUserFindFirst).not.toHaveBeenCalled();
    expect(mockPublishJob).toHaveBeenCalledTimes(1); // push only
    expect(mockPublishJob).not.toHaveBeenCalledWith('email.send', expect.anything());
  });

  it('skips email when the recipient has no address on file', async () => {
    vi.stubEnv('BETTER_AUTH_URL', 'https://api.ceolx.com');
    mockUserFindFirst.mockResolvedValueOnce({ email: null, name: 'Aoife' });
    const dispatch = makeDispatchNotification({ db: dbMock, publishJob: mockPublishJob });
    await dispatch(baseInput);

    expect(mockPublishJob).toHaveBeenCalledTimes(1); // push only
    expect(mockPublishJob).not.toHaveBeenCalledWith('email.send', expect.anything());
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
