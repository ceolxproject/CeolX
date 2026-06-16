import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPlaceSearch, type PlaceSearchSnapshot } from '../use-place-search';

import type { GeocodeResult } from '@/utils/geocode';

// Stub the geocode module so importing the hook doesn't pull in @CeolX/env
// (which validates EXPO_PUBLIC_* vars absent in the bare `node` test env). The
// controller receives `geocode` via DI, so the real implementation is unused.
// Hoisted above all imports by vitest regardless of its position here.
vi.mock('@/utils/geocode', () => ({ geocodeAddress: vi.fn() }));

// A manually-resolvable promise so tests can control the order in which two
// in-flight geocode requests settle (used for the stale-response guard test).
function defer<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Let queued microtasks (awaited promise continuations) run to completion.
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const galway: GeocodeResult = { lat: 53.27, lng: -9.05, address: 'Galway, Ireland' };
const cork: GeocodeResult = { lat: 51.9, lng: -8.47, address: 'Cork, Ireland' };
const leisureland: GeocodeResult = {
  lat: 53.26,
  lng: -9.08,
  address: 'Leisureland, Salthill, Galway',
};

const DEBOUNCE = 300;

describe('createPlaceSearch', () => {
  let snapshots: PlaceSearchSnapshot[];
  let geocode: ReturnType<typeof vi.fn>;

  const latest = () => snapshots[snapshots.length - 1];

  beforeEach(() => {
    vi.useFakeTimers();
    snapshots = [];
    geocode = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function make() {
    return createPlaceSearch({
      geocode,
      onChange: (snap) => snapshots.push(snap),
      debounceMs: DEBOUNCE,
    });
  }

  it('does not call geocode for empty input', async () => {
    const c = make();
    c.setQuery('');
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(geocode).not.toHaveBeenCalled();
    expect(latest().suggestions).toEqual([]);
    expect(latest().isDropdownVisible).toBe(false);
  });

  it('does not call geocode for whitespace-only input', async () => {
    const c = make();
    c.setQuery('   ');
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    expect(geocode).not.toHaveBeenCalled();
  });

  it('debounces rapid input into a single geocode call for the final value', async () => {
    geocode.mockResolvedValue([leisureland]);
    const c = make();
    c.setQuery('lei');
    c.setQuery('leis');
    c.setQuery('leisure');
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    await flush();
    expect(geocode).toHaveBeenCalledTimes(1);
    expect(geocode).toHaveBeenCalledWith('leisure');
  });

  it('populates suggestions and shows the dropdown on success', async () => {
    geocode.mockResolvedValue([leisureland]);
    const c = make();
    c.setQuery('leisureland');
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    await flush();
    expect(latest().suggestions).toEqual([leisureland]);
    expect(latest().isDropdownVisible).toBe(true);
    expect(latest().isSearching).toBe(false);
    expect(latest().hasError).toBe(false);
  });

  it('keeps the dropdown visible with empty suggestions for the no-match state', async () => {
    geocode.mockResolvedValue([]);
    const c = make();
    c.setQuery('zzzzz');
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    await flush();
    expect(latest().suggestions).toEqual([]);
    expect(latest().isDropdownVisible).toBe(true);
    expect(latest().hasError).toBe(false);
  });

  it('sets hasError and hides the dropdown when geocode throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    geocode.mockRejectedValue(new Error('network'));
    const c = make();
    c.setQuery('galway');
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    await flush();
    expect(latest().hasError).toBe(true);
    expect(latest().isDropdownVisible).toBe(false);
    expect(latest().isSearching).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('ignores a stale response that resolves after a newer query', async () => {
    const first = defer<GeocodeResult[]>();
    const second = defer<GeocodeResult[]>();
    geocode.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const c = make();
    c.setQuery('galway');
    await vi.advanceTimersByTimeAsync(DEBOUNCE); // fires request #1
    c.setQuery('cork');
    await vi.advanceTimersByTimeAsync(DEBOUNCE); // fires request #2

    // Newer request resolves first, then the stale one resolves late.
    second.resolve([cork]);
    await flush();
    first.resolve([galway]);
    await flush();

    expect(latest().suggestions).toEqual([cork]);
  });

  it('commitSelection keeps the label, clears suggestions, hides the dropdown, and cancels a pending search', async () => {
    geocode.mockResolvedValue([leisureland]);
    const c = make();
    c.setQuery('leisure');
    c.commitSelection('Leisureland, Salthill, Galway');
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    await flush();
    expect(geocode).not.toHaveBeenCalled();
    expect(latest().query).toBe('Leisureland, Salthill, Galway');
    expect(latest().suggestions).toEqual([]);
    expect(latest().isDropdownVisible).toBe(false);
  });

  it('clear resets state and cancels a pending search', async () => {
    geocode.mockResolvedValue([leisureland]);
    const c = make();
    c.setQuery('leisure');
    c.clear();
    await vi.advanceTimersByTimeAsync(DEBOUNCE);
    await flush();
    expect(geocode).not.toHaveBeenCalled();
    expect(latest().query).toBe('');
    expect(latest().suggestions).toEqual([]);
    expect(latest().isDropdownVisible).toBe(false);
  });
});
