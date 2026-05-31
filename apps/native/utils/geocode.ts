import { env } from '@CeolX/env/native';

export type GeocodeResult = { lat: number; lng: number; address: string };

const GEOCODE_TIMEOUT_MS = 8_000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Forward-geocode a free-text place to coordinates via the CeolX server, which
 * proxies the Google Geocoding API (biased to Ireland).
 *
 * This replaces expo-location's `geocodeAsync`, which on Android relies on the
 * device's native geocoder and silently fails whenever location services are
 * off — producing the "could not find location" error and, downstream, events
 * saved at null-island (0,0). Going through the server means search works
 * regardless of the device's location state and the API key stays server-side.
 *
 * Returns matches (possibly empty for "no result"). Throws on network/timeout/
 * server errors so callers can tell "nothing found" apart from "search failed".
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q) return [];

  const url = `${env.EXPO_PUBLIC_SERVER_URL}/location/geocode?q=${encodeURIComponent(q)}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Geocoding request failed (${response.status})`);
  }

  const data = (await response.json()) as
    | { ok: true; results: GeocodeResult[] }
    | { ok: false; error: string };
  if (!data.ok) throw new Error(data.error || 'geocoding_failed');
  return data.results;
}

/**
 * Reverse-geocode coordinates to a human-readable label via the CeolX server.
 * Best-effort: returns null when there's no match or the lookup fails, so
 * callers can fall back to showing the raw coordinates.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `${env.EXPO_PUBLIC_SERVER_URL}/location/reverse-geocode?lat=${lat}&lng=${lng}`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) return null;
    const data = (await response.json()) as { ok: boolean; address?: string | null };
    return data.ok ? (data.address ?? null) : null;
  } catch {
    return null;
  }
}
