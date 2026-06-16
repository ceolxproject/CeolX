import * as SecureStore from 'expo-secure-store';

/**
 * The user's persisted base location — the place they explicitly set via the
 * "Add your Location" screen. Used by the GPS resolution chain when no live GPS
 * fix is available, in preference to coarse IP / Ireland. Survives cold starts.
 *
 * Same shape as `FeedLocation` (kept structural to avoid a cross-module import).
 */
export type BaseLocation = { lat: number; lng: number; label: string };

const KEY = 'ceolx.base-location';

function isValid(value: unknown): value is BaseLocation {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.lat === 'number' &&
    Number.isFinite(v.lat) &&
    typeof v.lng === 'number' &&
    Number.isFinite(v.lng) &&
    typeof v.label === 'string'
  );
}

/**
 * Read the saved base location. Returns null when nothing is stored or the
 * stored value is corrupt/legacy — never throws to callers.
 */
export async function getBaseLocation(): Promise<BaseLocation | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function setBaseLocation(loc: BaseLocation): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(loc));
}

export async function clearBaseLocation(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
