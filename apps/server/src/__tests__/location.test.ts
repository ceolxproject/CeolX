import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import locationRoutes from '../routes/location.js';

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------

function buildApp() {
  const app = new Hono();
  app.route('/location', locationRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const fetchSpy = vi.fn<typeof globalThis.fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /location/ip', () => {
  it('returns coordinates when ipapi.co responds with valid Irish location', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          latitude: 53.3498,
          longitude: -6.2603,
          city: 'Dublin',
          region: 'Leinster',
        }),
        { status: 200 }
      )
    );

    const app = buildApp();
    const res = await app.request('/location/ip', {
      headers: { 'X-Forwarded-For': '86.45.123.1' },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      latitude: 53.3498,
      longitude: -6.2603,
      city: 'Dublin',
      region: 'Leinster',
    });
  });

  it('extracts IP from X-Forwarded-For (first entry)', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          latitude: 53.27,
          longitude: -9.05,
          city: 'Galway',
          region: 'Connacht',
        }),
        { status: 200 }
      )
    );

    const app = buildApp();
    await app.request('/location/ip', {
      headers: { 'X-Forwarded-For': '86.45.123.1, 10.0.0.1' },
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [firstCall] = fetchSpy.mock.calls;
    const calledUrl = firstCall ? (firstCall[0] as string) : '';

    expect(calledUrl).toContain('86.45.123.1');
  });

  it('returns ok: false when ipapi.co returns no coordinates', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: true, reason: 'Reserved IP' }), { status: 200 })
    );

    const app = buildApp();
    const res = await app.request('/location/ip', {
      headers: { 'X-Forwarded-For': '127.0.0.1' },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: false });
  });

  it('returns ok: false when ipapi.co fetch fails', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    const app = buildApp();
    const res = await app.request('/location/ip', {
      headers: { 'X-Forwarded-For': '86.45.123.1' },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: false });
  });

  it('returns ok: false when ipapi.co returns non-200', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('Rate limited', { status: 429 }));

    const app = buildApp();
    const res = await app.request('/location/ip', {
      headers: { 'X-Forwarded-For': '86.45.123.1' },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: false });
  });
});
