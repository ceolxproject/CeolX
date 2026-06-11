import * as Location from 'expo-location';

/**
 * Best-effort current device coordinates. Requests foreground permission if not
 * already granted. Returns null on denial or any failure so the caller can keep
 * the current map centre instead of crashing.
 */
export async function getDeviceLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      ({ status } = await Location.requestForegroundPermissionsAsync());
    }
    if (status !== Location.PermissionStatus.GRANTED) return null;

    const pos =
      (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync());
    if (!pos) return null;
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (err: unknown) {
    console.warn('[getDeviceLocation] failed:', err);
    return null;
  }
}
