import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before imports
// ---------------------------------------------------------------------------

const mockGetForegroundPermissionsAsync = vi.fn();
const mockGetLastKnownPositionAsync = vi.fn();

vi.mock('expo-location', () => ({
  getForegroundPermissionsAsync: (...args: unknown[]) =>
    mockGetForegroundPermissionsAsync(...args) as unknown,
  getLastKnownPositionAsync: (...args: unknown[]) =>
    mockGetLastKnownPositionAsync(...args) as unknown,
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  // requestForegroundPermissionsAsync is the responsibility of LocationPermissionScreen
}));

vi.mock('@CeolX/shared', () => ({
  IRELAND_INITIAL_REGION: {
    latitude: 53.1424,
    longitude: -7.6921,
    latitudeDelta: 4,
    longitudeDelta: 5,
  },
}));

vi.mock('@CeolX/env/native', () => ({
  env: { EXPO_PUBLIC_SERVER_URL: 'http://localhost:3001' },
}));

// We don't need React for testing resolveLocation directly
vi.mock('react', () => ({
  useEffect: vi.fn(),
  useState: vi.fn(),
}));

const fetchSpy = vi.fn<typeof globalThis.fetch>();
vi.stubGlobal('fetch', fetchSpy);

// Import after all mocks
import { resolveLocation } from '../use-gps-region';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSetters() {
  return {
    setInitialRegion: vi.fn(),
    setGpsPermissionGranted: vi.fn(),
    setLocationSource: vi.fn(),
    setMapKey: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveLocation', () => {
  it('reads permission passively without prompting', async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetLastKnownPositionAsync.mockResolvedValue({
      coords: { latitude: 53.35, longitude: -6.26 },
    });

    const setters = createSetters();
    await resolveLocation(setters);

    expect(mockGetForegroundPermissionsAsync).toHaveBeenCalledOnce();
  });

  it('sets GPS region when permission granted and position available', async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetLastKnownPositionAsync.mockResolvedValue({
      coords: { latitude: 53.35, longitude: -6.26 },
    });

    const setters = createSetters();
    await resolveLocation(setters);

    expect(setters.setGpsPermissionGranted).toHaveBeenCalledWith(true);
    expect(setters.setLocationSource).toHaveBeenCalledWith('gps');
    expect(setters.setInitialRegion).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 53.35, longitude: -6.26 })
    );
    expect(setters.setMapKey).toHaveBeenCalled();
  });

  it('falls back to IP geolocation when permission denied', async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          latitude: 51.9,
          longitude: -8.47,
          city: 'Cork',
          region: 'Munster',
        }),
        { status: 200 }
      )
    );

    const setters = createSetters();
    await resolveLocation(setters);

    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3001/location/ip');
    expect(setters.setLocationSource).toHaveBeenCalledWith('ip');
    expect(setters.setInitialRegion).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 51.9, longitude: -8.47 })
    );
  });

  it('falls back to Ireland default when IP returns ok:false', async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false }), { status: 200 }));

    const setters = createSetters();
    await resolveLocation(setters);

    expect(setters.setLocationSource).toHaveBeenCalledWith('default');
    expect(setters.setInitialRegion).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 53.1424, longitude: -7.6921 })
    );
  });

  it('falls back to Ireland default when IP fetch throws', async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    const setters = createSetters();
    await resolveLocation(setters);

    expect(setters.setLocationSource).toHaveBeenCalledWith('default');
    expect(setters.setInitialRegion).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 53.1424, longitude: -7.6921 })
    );
  });

  it('falls through to IP when granted but no position available', async () => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetLastKnownPositionAsync.mockResolvedValue(null);
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, latitude: 53.27, longitude: -9.05 }), { status: 200 })
    );

    const setters = createSetters();
    await resolveLocation(setters);

    expect(setters.setGpsPermissionGranted).toHaveBeenCalledWith(true);
    expect(setters.setLocationSource).toHaveBeenCalledWith('ip');
  });

  it('falls back to default when permission check throws', async () => {
    mockGetForegroundPermissionsAsync.mockRejectedValue(new Error('Unavailable'));

    const setters = createSetters();
    await resolveLocation(setters);

    expect(setters.setLocationSource).toHaveBeenCalledWith('default');
  });
});
