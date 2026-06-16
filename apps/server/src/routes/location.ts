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
 * Build the human-readable label stored against an event/venue from a Places
 * result. Leads with the place name the user searched for ("Leisureland") so
 * the picker shows what they typed, not just the street it sits on.
 *
 * `name` is the POI/business name (Places `displayName.text`); `formattedAddress`
 * is the full street address. Either can be empty — for a plain address search
 * Google echoes the address back as the name, so they overlap.
 *
 * Returns the final single-line label. The route below has already trimmed
 * both inputs and guaranteed at least one is non-empty.
 */
function buildLocationLabel(name: string, formattedAddress: string): string {
  // Either side may be empty — fall back to whichever we have.
  if (!name) return formattedAddress;
  if (!formattedAddress) return name;

  // For plain-address searches Google echoes the address as the displayName,
  // so the name is already the leading part of the address. Concatenating would
  // give "Upper Salthill Rd, Upper Salthill Rd, Galway" — just use the address.
  if (formattedAddress.toLowerCase().startsWith(name.toLowerCase())) {
    return formattedAddress;
  }

  // POI search: lead with the place name the user recognises, then the street
  // for context — "Leisureland, Upper Salthill Rd, Galway, Ireland".
  return `${name}, ${formattedAddress}`;
}

/**
 * Forward-geocode a free-text place to coordinates via the Google Places API
 * (Text Search, New). The app's LocationPicker calls this instead of
 * expo-location's native geocoder, which only works when the device has
 * location services enabled.
 *
 * Places (not Geocoding) is used so a venue/business name like "Leisureland"
 * resolves to its place name + address rather than only the underlying street.
 * The Google key lives server-side only (never shipped to the app). Search is
 * global (no Ireland region bias) so events can be created anywhere.
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

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // Field mask is mandatory on the New Places API — only billed for the
        // fields requested. We need the name, address and coordinates.
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
      },
      // No region bias — search is global so events can be created anywhere.
      body: JSON.stringify({ textQuery: query }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      // Surface Google's error body — a 403 spells out the exact cause
      // (API not enabled, key API-restricted, billing off), which the bare
      // status code hides.
      const detail = await response.text().catch(() => '');
      console.error(
        '[location/geocode] places responded %d for q=%s — %s',
        response.status,
        query,
        detail.slice(0, 500)
      );
      return c.json({ ok: false, error: 'upstream_error' as const }, 502);
    }

    const data = (await response.json()) as {
      places?: {
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
      }[];
    };

    // No `places` key is the New API's "no match" — a normal empty result.
    if (!data.places?.length) {
      return c.json({ ok: true, results: [] });
    }

    const results = data.places
      .map((p) => {
        const loc = p.location;
        if (!loc || typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') {
          return null;
        }
        const name = p.displayName?.text?.trim() ?? '';
        const formattedAddress = p.formattedAddress?.trim() ?? '';
        // Skip entries with no usable label at all rather than echoing the query.
        if (!name && !formattedAddress) return null;
        return {
          lat: loc.latitude,
          lng: loc.longitude,
          address: buildLocationLabel(name, formattedAddress),
        };
      })
      .filter((r): r is { lat: number; lng: number; address: string } => r !== null);

    return c.json({ ok: true, results });
  } catch (err: unknown) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    if (isAbort) {
      console.warn(
        `[location/geocode] places timed out after ${GEOCODE_TIMEOUT_MS}ms for q=${query}`
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
