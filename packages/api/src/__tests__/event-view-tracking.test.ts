import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted db mock — granular per-call assertions ──────────────────────────

const { mockUpdate, mockUpdateWhere, mockInsert, mockInsertValues } = vi.hoisted(() => {
  const mockUpdateWhere = vi.fn(() => Promise.resolve());
  const mockInsertValues = vi.fn(() => Promise.resolve());
  const mockUpdate = vi.fn(() => ({
    set: vi.fn(() => ({
      where: mockUpdateWhere,
    })),
  }));
  const mockInsert = vi.fn(() => ({
    values: mockInsertValues,
  }));
  return { mockUpdate, mockUpdateWhere, mockInsert, mockInsertValues };
});

vi.mock('@CeolX/db', () => ({
  db: {
    update: mockUpdate,
    insert: mockInsert,
  },
}));

vi.mock('@CeolX/db/schema/events', () => ({
  events: { id: 'id', viewCount: 'view_count' },
  eventViews: { id: 'id', eventId: 'event_id', userId: 'user_id' },
}));

// ─── System under test ───────────────────────────────────────────────────────

import { recordEventView } from '../routers/events/view-tracking';

describe('recordEventView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT track when viewer is anonymous (null userId)', async () => {
    await recordEventView({
      eventId: 'event-1',
      viewerUserId: null,
      eventCreatorId: 'creator-1',
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('does NOT track when viewer is the event creator', async () => {
    await recordEventView({
      eventId: 'event-1',
      viewerUserId: 'creator-1',
      eventCreatorId: 'creator-1',
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('increments view_count AND inserts an event_views row when viewer is a different authenticated user', async () => {
    await recordEventView({
      eventId: 'event-1',
      viewerUserId: 'other-user',
      eventCreatorId: 'creator-1',
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledWith({
      eventId: 'event-1',
      userId: 'other-user',
    });
  });

  it('swallows DB errors so an event load is never broken by view tracking', async () => {
    mockUpdateWhere.mockRejectedValueOnce(new Error('DB unavailable'));

    await expect(
      recordEventView({
        eventId: 'event-1',
        viewerUserId: 'other-user',
        eventCreatorId: 'creator-1',
      })
    ).resolves.toBeUndefined();
  });
});
