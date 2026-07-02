import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockFindFirst } = vi.hoisted(() => ({ mockFindFirst: vi.fn() }));

vi.mock('@CeolX/db', () => ({
  db: { query: { events: { findFirst: mockFindFirst } } },
}));

// Defaults (no store overrides) so the route derives the fallback store urls.
vi.mock('@CeolX/env/server', () => ({
  env: {
    IOS_APP_STORE_URL: undefined,
    ANDROID_PLAY_STORE_URL: undefined,
    PUBLIC_WEB_ORIGIN: undefined,
  },
}));

import eventShareRoute from '../../routes/event-share.js';

function buildApp() {
  const app = new Hono();
  app.route('/', eventShareRoute);
  return app;
}

const VALID_ID = '22222222-2222-4222-8222-222222222222';

function activeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_ID,
    title: 'Trad Session at The Cobblestone',
    description: 'A lively night of Irish music',
    coverImage: 'https://cdn.ceolx.com/events/cover.jpg',
    dateStart: new Date('2026-07-15T20:00:00.000Z'),
    venueAddress: '77 King St N, Dublin',
    status: 'active',
    venue: { venueName: 'The Cobblestone' },
    ...overrides,
  };
}

afterEach(() => {
  mockFindFirst.mockReset();
});

describe('GET /event/:id', () => {
  it('renders OG tags, the cover image, a deep link, and store buttons for an active event', async () => {
    mockFindFirst.mockResolvedValue(activeEvent());

    const res = await buildApp().request(`/event/${VALID_ID}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(res.headers.get('cache-control')).toMatch(/max-age=300/);

    const html = await res.text();
    expect(html).toContain('<meta property="og:title" content="Trad Session at The Cobblestone">');
    expect(html).toContain('The Cobblestone');
    expect(html).toContain(
      `<meta property="og:url" content="https://ceolx.com/event/${VALID_ID}">`
    );
    expect(html).toContain('https://cdn.ceolx.com/events/cover.jpg');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain(`href="ceolx://event/${VALID_ID}"`);
    expect(html).toContain('play.google.com/store/apps/details?id=com.ceolx.app');
    expect(html).toContain('apps.apple.com');
  });

  it('falls back to venueAddress when there is no registered venue', async () => {
    mockFindFirst.mockResolvedValue(activeEvent({ venue: null }));
    const html = await (await buildApp().request(`/event/${VALID_ID}`)).text();
    expect(html).toContain('77 King St N, Dublin');
  });

  it('omits og:image and uses the summary card when the event has no cover', async () => {
    mockFindFirst.mockResolvedValue(activeEvent({ coverImage: null }));
    const html = await (await buildApp().request(`/event/${VALID_ID}`)).text();
    expect(html).not.toContain('og:image');
    expect(html).toContain('<meta name="twitter:card" content="summary">');
  });

  it('escapes HTML in the title so an event cannot inject markup', async () => {
    mockFindFirst.mockResolvedValue(activeEvent({ title: '<script>alert(1)</script>' }));
    const html = await (await buildApp().request(`/event/${VALID_ID}`)).text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('returns a 404 download page for a malformed id without touching the db', async () => {
    const res = await buildApp().request('/event/not-a-uuid');
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
    expect(mockFindFirst).not.toHaveBeenCalled();
    const html = await res.text();
    expect(html).toContain('apps.apple.com');
    expect(html).toContain('play.google.com');
  });

  it('returns a 404 download page when the event is missing or not active', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    expect((await buildApp().request(`/event/${VALID_ID}`)).status).toBe(404);

    mockFindFirst.mockResolvedValue(activeEvent({ status: 'removed' }));
    expect((await buildApp().request(`/event/${VALID_ID}`)).status).toBe(404);

    mockFindFirst.mockResolvedValue(activeEvent({ status: 'archived' }));
    expect((await buildApp().request(`/event/${VALID_ID}`)).status).toBe(404);
  });
});
