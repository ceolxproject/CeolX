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

describe('GET /location/geocode', () => {
  type GeocodeBody = {
    ok: boolean;
    error?: string;
    results?: { lat: number; lng: number; address: string }[];
  };

  // A Places API (New) searchText response for "Leisureland".
  const placesResponse = (
    places: Array<{
      name?: string;
      formattedAddress?: string;
      lat?: number;
      lng?: number;
    }>
  ) =>
    new Response(
      JSON.stringify({
        places: places.map((p) => ({
          displayName: p.name === undefined ? undefined : { text: p.name },
          formattedAddress: p.formattedAddress,
          location:
            p.lat === undefined || p.lng === undefined
              ? undefined
              : { latitude: p.lat, longitude: p.lng },
        })),
      }),
      { status: 200 }
    );

  it('queries the Places API (New) searchText endpoint with a field mask', async () => {
    fetchSpy.mockResolvedValueOnce(
      placesResponse([
        {
          name: 'Leisureland',
          formattedAddress: 'Upper Salthill Rd, Galway, Ireland',
          lat: 53.26,
          lng: -9.07,
        },
      ])
    );

    const app = buildApp();
    await app.request('/location/geocode?q=Leisureland');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [calledUrl, init] = fetchSpy.mock.calls[0] ?? [];
    expect(calledUrl).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('X-Goog-FieldMask')).toContain('places.displayName');
    expect(JSON.parse(init?.body as string)).toMatchObject({
      textQuery: 'Leisureland',
      regionCode: 'IE',
    });
  });

  it('returns coordinates from the place location', async () => {
    fetchSpy.mockResolvedValueOnce(
      placesResponse([
        {
          name: 'Leisureland',
          formattedAddress: 'Upper Salthill Rd, Galway, Ireland',
          lat: 53.26,
          lng: -9.07,
        },
      ])
    );

    const app = buildApp();
    const res = await app.request('/location/geocode?q=Leisureland');
    const body = (await res.json()) as GeocodeBody;

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.results?.[0]).toMatchObject({ lat: 53.26, lng: -9.07 });
  });

  // ---- Spec for buildLocationLabel (Priya's contribution) -------------------

  it('leads the label with the place name the user searched for', async () => {
    fetchSpy.mockResolvedValueOnce(
      placesResponse([
        {
          name: 'Leisureland',
          formattedAddress: 'Upper Salthill Rd, Galway, Ireland',
          lat: 53.26,
          lng: -9.07,
        },
      ])
    );

    const app = buildApp();
    const res = await app.request('/location/geocode?q=Leisureland');
    const body = (await res.json()) as GeocodeBody;

    // The whole point of the bug fix: "Leisureland" must appear, not just the street.
    const address = body.results?.[0]?.address ?? '';
    expect(address).toContain('Leisureland');
    expect(address.startsWith('Leisureland')).toBe(true);
  });

  it('does not duplicate the name when it is already the start of the address', async () => {
    // Plain-address search: Google echoes the address as the displayName too.
    fetchSpy.mockResolvedValueOnce(
      placesResponse([
        {
          name: 'Upper Salthill Rd',
          formattedAddress: 'Upper Salthill Rd, Galway, Ireland',
          lat: 53.26,
          lng: -9.07,
        },
      ])
    );

    const app = buildApp();
    const res = await app.request('/location/geocode?q=Upper%20Salthill%20Rd');
    const body = (await res.json()) as GeocodeBody;

    expect(body.results?.[0]?.address).toBe('Upper Salthill Rd, Galway, Ireland');
  });

  // ---- Edge cases -----------------------------------------------------------

  it('returns an empty result set when Places returns no matches', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));

    const app = buildApp();
    const res = await app.request('/location/geocode?q=nowhere-xyz');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, results: [] });
  });

  it('returns 400 when the query is missing', async () => {
    const app = buildApp();
    const res = await app.request('/location/geocode');
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ ok: false, error: 'missing_query' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 502 when Places responds with a non-200', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('quota exceeded', { status: 429 }));

    const app = buildApp();
    const res = await app.request('/location/geocode?q=Leisureland');
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body).toEqual({ ok: false, error: 'upstream_error' });
  });
});
