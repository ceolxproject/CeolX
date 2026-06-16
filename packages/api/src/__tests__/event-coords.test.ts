import { TRPCError } from '@trpc/server';
import { describe, it, expect } from 'vitest';

import { resolveEventCoordinates } from '../routers/events/helpers';

// resolveEventCoordinates is the single source of truth for an event's pin.
// Map and feed are coordinate-driven, so it must always yield real coordinates
// or reject — it must never produce the (0,0) fallback that made events land in
// the Atlantic and disappear from Discovery/Map.
describe('resolveEventCoordinates', () => {
  const noVenue = () => Promise.resolve(null);

  it('uses explicit lat/lng when provided', async () => {
    const coords = await resolveEventCoordinates({ lat: 53.3498, lng: -6.2603 }, noVenue);
    expect(coords).toEqual({ lat: '53.3498', lng: '-6.2603' });
  });

  it('inherits the venue pin when only a venueId is provided', async () => {
    const lookup = (id: string) =>
      Promise.resolve(id === 'venue-1' ? { lat: '53.5', lng: '-6.5' } : null);
    const coords = await resolveEventCoordinates({ venueId: 'venue-1' }, lookup);
    expect(coords).toEqual({ lat: '53.5', lng: '-6.5' });
  });

  it('prefers explicit coordinates over the venue pin', async () => {
    const lookup = () => Promise.resolve({ lat: '10', lng: '10' });
    const coords = await resolveEventCoordinates(
      { lat: 53.3498, lng: -6.2603, venueId: 'venue-1' },
      lookup
    );
    expect(coords).toEqual({ lat: '53.3498', lng: '-6.2603' });
  });

  it('throws BAD_REQUEST when the venue has no stored coordinates', async () => {
    await expect(resolveEventCoordinates({ venueId: 'venue-1' }, noVenue)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('throws BAD_REQUEST when neither coordinates nor a venueId are given', async () => {
    await expect(resolveEventCoordinates({}, noVenue)).rejects.toBeInstanceOf(TRPCError);
  });

  it('never returns the (0,0) fallback', async () => {
    // A free-text address with no pin and no venue must reject, not silently
    // become (0,0).
    await expect(resolveEventCoordinates({}, noVenue)).rejects.toThrow();
  });
});
