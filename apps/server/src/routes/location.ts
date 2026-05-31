import { Hono } from 'hono';

import { env } from '@CeolX/env/server';

const location = new Hono();

const IPAPI_TIMEOUT_MS = 3_000;
const GEOCODE_TIMEOUT_MS = 5_000;

function extractIp(req: Request): string {
  const forwarded = req.headers.get('X-Forwarded-For');
  if (forwarded) {
    const [first = '127.0.0.1'] = forwarded.split(',');
    return first.trim();
  }
  const realIp = req.headers.get('X-Real-IP');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

location.get('/ip', async (c) => {
  const ip = extractIp(c.req.raw);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IPAPI_TIMEOUT_MS);

    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return c.json({ ok: false });
    }

    const data = (await response.json()) as Record<string, unknown>;
    const latitude = data['latitude'];
    const longitude = data['longitude'];

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return c.json({ ok: false });
    }

    return c.json({
      ok: true,
      latitude,
      longitude,
      city: typeof data['city'] === 'string' ? data['city'] : null,
      region: typeof data['region'] === 'string' ? data['region'] : null,
    });
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    if (isAbort) {
      console.warn(`[location/ip] ipapi.co timed out after ${IPAPI_TIMEOUT_MS}ms for ip=${ip}`);
    } else {
      console.error('[location/ip] ipapi.co fetch failed for ip=%s', ip, err);
    }
    return c.json({ ok: false });
  }
});

/**
 * Forward-geocode a free-text place to coordinates via the Google Geocoding
 * API. The app's LocationPicker calls this instead of expo-location's native
 * geocoder, which only works when the device has location services enabled.
 *
 * The Google key lives server-side only (never shipped to the app) and is
 * biased + restricted to Ireland to match the app's scope.
 */
location.get('/geocode', async (c) => {
  const query = c.req.query('q')?.trim();
  if (!query) {
    return c.json({ ok: false, error: 'missing_query' as const }, 400);
  }

  const apiKey = env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('[location/geocode] GOOGLE_MAPS_API_KEY is not configured');
    return c.json({ ok: false, error: 'not_configured' as const }, 503);
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', query);
  url.searchParams.set('key', apiKey);
  // Bias results to Ireland — the app is Irish-music only.
  url.searchParams.set('region', 'ie');
  url.searchParams.set('components', 'country:IE');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error('[location/geocode] google responded %d for q=%s', response.status, query);
      return c.json({ ok: false, error: 'upstream_error' as const }, 502);
    }

    const data = (await response.json()) as {
      status: string;
      results?: {
        formatted_address?: string;
        geometry?: { location?: { lat: number; lng: number } };
      }[];
    };

    // ZERO_RESULTS is a normal "no match" — not an error. REQUEST_DENIED /
    // OVER_QUERY_LIMIT are configuration/billing problems worth logging.
    if (data.status === 'ZERO_RESULTS' || !data.results?.length) {
      return c.json({ ok: true, results: [] });
    }
    if (data.status !== 'OK') {
      console.error('[location/geocode] google status=%s for q=%s', data.status, query);
      return c.json({ ok: false, error: 'upstream_error' as const }, 502);
    }

    const results = data.results
      .map((r) => {
        const loc = r.geometry?.location;
        if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;
        return { lat: loc.lat, lng: loc.lng, address: r.formatted_address ?? query };
      })
      .filter((r): r is { lat: number; lng: number; address: string } => r !== null);

    return c.json({ ok: true, results });
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    if (isAbort) {
      console.warn(
        `[location/geocode] google timed out after ${GEOCODE_TIMEOUT_MS}ms for q=${query}`
      );
    } else {
      console.error('[location/geocode] fetch failed for q=%s', query, err);
    }
    return c.json({ ok: false, error: 'upstream_error' as const }, 502);
  }
});

/**
 * Reverse-geocode coordinates to a human-readable label via Google. Used when
 * the user drops/drags a pin on the map so we can show a place name instead of
 * raw coordinates — again proxied so the app never holds the key and works
 * regardless of device location state.
 */
location.get('/reverse-geocode', async (c) => {
  const lat = Number(c.req.query('lat'));
  const lng = Number(c.req.query('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return c.json({ ok: false, error: 'invalid_coordinates' as const }, 400);
  }

  const apiKey = env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('[location/reverse-geocode] GOOGLE_MAPS_API_KEY is not configured');
    return c.json({ ok: false, error: 'not_configured' as const }, 503);
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${lat},${lng}`);
  url.searchParams.set('key', apiKey);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return c.json({ ok: false, error: 'upstream_error' as const }, 502);
    }

    const data = (await response.json()) as {
      status: string;
      results?: { formatted_address?: string }[];
    };
    const address = data.results?.[0]?.formatted_address ?? null;
    return c.json({ ok: true, address });
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    if (!isAbort) console.error('[location/reverse-geocode] fetch failed', err);
    return c.json({ ok: false, error: 'upstream_error' as const }, 502);
  }
});

export default location;
