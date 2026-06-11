import { describe, it, expect } from 'vitest';

import { resolveFeedLocation } from '../feed-location';

const region = { latitude: 53.5, longitude: -6.2 };

describe('resolveFeedLocation', () => {
  it('uses the override verbatim when present', () => {
    const override = { lat: 51.9, lng: -8.47, label: 'Cork City Centre' };
    expect(resolveFeedLocation(override, region, 'Dublin', 'gps')).toEqual(override);
  });

  it('uses the reverse-geocoded place label when there is no override', () => {
    expect(resolveFeedLocation(null, region, 'Swords', 'gps')).toEqual({
      lat: 53.5,
      lng: -6.2,
      label: 'Swords',
    });
  });

  it('falls back to a source label when no place label is available', () => {
    expect(resolveFeedLocation(null, region, null, 'gps').label).toBe('Current Location');
    expect(resolveFeedLocation(null, region, null, 'ip').label).toBe('Approximate Location');
    expect(resolveFeedLocation(null, region, null, 'venue-profile').label).toBe('Your venue');
    expect(resolveFeedLocation(null, region, null, 'default').label).toBe('Ireland');
    expect(resolveFeedLocation(null, region, null, 'pending').label).toBe('Ireland');
  });
});
