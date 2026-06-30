import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockCollabFindFirst, mockEventFindFirst } = vi.hoisted(() => ({
  mockCollabFindFirst: vi.fn(),
  mockEventFindFirst: vi.fn(),
}));

vi.mock('@CeolX/db', () => ({
  db: {
    query: {
      eventCollaborators: { findFirst: mockCollabFindFirst },
      events: { findFirst: mockEventFindFirst },
    },
  },
}));

vi.mock('@CeolX/env/server', () => ({
  env: {
    IOS_APP_STORE_URL: undefined,
    ANDROID_PLAY_STORE_URL: undefined,
    PUBLIC_WEB_ORIGIN: undefined,
  },
}));

import inviteShareRoute from '../../routes/invite-share.js';

function buildApp() {
  const app = new Hono();
  app.route('/', inviteShareRoute);
  return app;
}

const TOKEN = 'tok-abc-123';
const future = () => new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
const past = () => new Date(Date.now() - 1000);

afterEach(() => {
  mockCollabFindFirst.mockReset();
  mockEventFindFirst.mockReset();
});

describe('GET /invite/:token', () => {
  it('renders the event + inviter and a sign-up deep link for a valid invite', async () => {
    mockCollabFindFirst.mockResolvedValue({
      eventId: 'e-1',
      inviteTokenExpiresAt: future(),
      artistProfileId: null,
    });
    mockEventFindFirst.mockResolvedValue({
      id: 'e-1',
      title: 'Trad Night',
      status: 'active',
      dateStart: new Date('2026-07-15T20:00:00Z'),
      coverImage: null,
      venueAddress: 'Dublin',
      venue: { venueName: 'The Cobblestone' },
    });

    const res = await buildApp().request(`/invite/${TOKEN}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Trad Night');
    expect(html).toContain('The Cobblestone');
    expect(html).toContain('ceolx://sign-up?role=artist');
    expect(html).toContain('App Store');
  });

  it('shows the expired/invalid page for an unknown token', async () => {
    mockCollabFindFirst.mockResolvedValue(undefined);
    const res = await buildApp().request(`/invite/${TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
    expect(await res.text()).not.toContain('ceolx://sign-up');
  });

  it('shows the expired page when the token has expired', async () => {
    mockCollabFindFirst.mockResolvedValue({
      eventId: 'e-1',
      inviteTokenExpiresAt: past(),
      artistProfileId: null,
    });
    const res = await buildApp().request(`/invite/${TOKEN}`);
    expect(res.status).toBe(404);
    expect(mockEventFindFirst).not.toHaveBeenCalled();
  });

  it('does not leak an invite whose event is no longer active', async () => {
    mockCollabFindFirst.mockResolvedValue({
      eventId: 'e-1',
      inviteTokenExpiresAt: future(),
      artistProfileId: null,
    });
    mockEventFindFirst.mockResolvedValue({ id: 'e-1', title: 'Gone', status: 'removed' });
    const res = await buildApp().request(`/invite/${TOKEN}`);
    expect(res.status).toBe(404);
  });
});
