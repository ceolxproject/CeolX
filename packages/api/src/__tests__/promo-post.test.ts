import { describe, expect, it, vi } from 'vitest';

// The helper imports the db singleton (for a type only) and the posts schema.
// Mock both so importing it doesn't load the real db client / validate env.
vi.mock('@CeolX/db', () => ({ db: {} }));
vi.mock('@CeolX/db/schema/social', () => ({ posts: { eventId: 'event_id' } }));

import { syncPromoPost, isPromoEventExpired } from '../services/promo-post';

function mockExecutor() {
  const where = vi.fn(() => Promise.resolve());
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { executor: { update } as never, update, set, where };
}

describe('syncPromoPost', () => {
  it('sets deletedAt to a Date (and no content) when hidden', async () => {
    const { executor, set } = mockExecutor();
    await syncPromoPost(executor, 'evt-1', { hidden: true });

    const values = set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(values.deletedAt).toBeInstanceOf(Date);
    expect(values.caption).toBeUndefined();
    expect(values.mediaType).toBeUndefined();
  });

  it('clears deletedAt (null) when not hidden', async () => {
    const { executor, set } = mockExecutor();
    await syncPromoPost(executor, 'evt-1', { hidden: false });

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: null }));
  });

  it('mirrors image content when a cover image is present', async () => {
    const { executor, set } = mockExecutor();
    await syncPromoPost(executor, 'evt-1', {
      hidden: false,
      content: { title: 'Trad Night', coverImage: 'https://cdn.ceolx.test/x.jpg' },
    });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        caption: 'Trad Night',
        mediaType: 'image',
        mediaUrl: 'https://cdn.ceolx.test/x.jpg',
        deletedAt: null,
      })
    );
  });

  it('mirrors a text post when there is no cover image (and can hide at the same time)', async () => {
    const { executor, set } = mockExecutor();
    await syncPromoPost(executor, 'evt-1', {
      hidden: true,
      content: { title: 'Trad Night', coverImage: null },
    });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ caption: 'Trad Night', mediaType: 'text', mediaUrl: null })
    );
    const values = set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(values.deletedAt).toBeInstanceOf(Date);
  });

  it('scopes the update by event id', async () => {
    const { executor, update, where } = mockExecutor();
    await syncPromoPost(executor, 'evt-42', { hidden: false });

    expect(update).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
  });
});

describe('isPromoEventExpired', () => {
  const DAY = 86_400_000;

  it('returns false for a non-promo post (null event)', () => {
    expect(isPromoEventExpired(null)).toBe(false);
  });

  it('returns false when the event start is in the future', () => {
    expect(isPromoEventExpired({ dateStart: new Date(Date.now() + DAY), dateEnd: null })).toBe(
      false
    );
  });

  it('returns true when the event start is in the past and there is no end', () => {
    expect(isPromoEventExpired({ dateStart: new Date(Date.now() - DAY), dateEnd: null })).toBe(
      true
    );
  });

  it('uses dateEnd when present — not expired while the end is still in the future', () => {
    expect(
      isPromoEventExpired({
        dateStart: new Date(Date.now() - DAY),
        dateEnd: new Date(Date.now() + DAY),
      })
    ).toBe(false);
  });

  it('is expired once dateEnd has passed', () => {
    expect(
      isPromoEventExpired({
        dateStart: new Date(Date.now() - 2 * DAY),
        dateEnd: new Date(Date.now() - DAY),
      })
    ).toBe(true);
  });
});
