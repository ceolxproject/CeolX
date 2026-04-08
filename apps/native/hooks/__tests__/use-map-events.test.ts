import { describe, it, expect, vi } from 'vitest';

// Mock React and hook dependencies so we can test the pure regionToBoundingBox function
// without needing a full React Native / tRPC environment.
vi.mock('react', () => ({
  useCallback: (fn: unknown) => fn,
  useRef: () => ({ current: null }),
  useState: (initial: unknown) => [initial, vi.fn()],
}));
vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn() }));
vi.mock('@/utils/trpc', () => ({
  trpc: {
    events: {
      getMap: {
        queryOptions: vi.fn(() => ({})),
      },
    },
  },
}));
vi.mock('react-native-maps', () => ({}));
vi.mock('@CeolX/shared', () => ({
  MAP_DEBOUNCE_MS: 400,
  MAP_MAX_PINS_PER_FETCH: 50,
}));

import { regionToBoundingBox } from '../use-map-events';

describe('regionToBoundingBox', () => {
  it('converts a region to a bounding box correctly', () => {
    const region = { latitude: 53.27, longitude: -9.05, latitudeDelta: 1.0, longitudeDelta: 1.5 };
    const box = regionToBoundingBox(region);
    expect(box.swLat).toBeCloseTo(52.77);
    expect(box.neLat).toBeCloseTo(53.77);
    expect(box.swLng).toBeCloseTo(-9.8);
    expect(box.neLng).toBeCloseTo(-8.3);
  });

  it('handles Ireland center region', () => {
    const region = { latitude: 53.1424, longitude: -7.6921, latitudeDelta: 4, longitudeDelta: 5 };
    const box = regionToBoundingBox(region);
    expect(box.swLat).toBeCloseTo(51.1424);
    expect(box.neLat).toBeCloseTo(55.1424);
    expect(box.swLng).toBeCloseTo(-10.1921);
    expect(box.neLng).toBeCloseTo(-5.1921);
  });
});

// TODO: add renderHook test for unmount cleanup when @testing-library/react-native is set up
