import { describe, it, expect, vi } from 'vitest';

// Mock React so the pure filterCounties function can be tested without a full
// React Native environment.
vi.mock('react', () => ({
  useCallback: (fn: unknown) => fn,
  useEffect: vi.fn(),
  useRef: () => ({ current: null }),
  useState: (initial: unknown) => [initial, vi.fn()],
}));

// Mock @CeolX/shared with the real data so filterCounties can be unit-tested
// without resolving the full shared package (which depends on date-fns etc.).
vi.mock('@CeolX/shared', () => ({
  IRISH_COUNTIES: [
    'Antrim', 'Armagh', 'Carlow', 'Cavan', 'Clare', 'Cork',
    'Derry', 'Donegal', 'Down', 'Dublin', 'Fermanagh', 'Galway',
    'Kerry', 'Kildare', 'Kilkenny', 'Laois', 'Leitrim', 'Limerick',
    'Longford', 'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly',
    'Roscommon', 'Sligo', 'Tipperary', 'Tyrone', 'Waterford',
    'Westmeath', 'Wexford', 'Wicklow',
  ],
  COUNTY_CENTERS: {
    Antrim:    { lat: 54.7,    lng: -6.2    },
    Armagh:    { lat: 54.35,   lng: -6.65   },
    Carlow:    { lat: 52.72,   lng: -6.93   },
    Cavan:     { lat: 53.99,   lng: -7.36   },
    Clare:     { lat: 52.9,    lng: -8.98   },
    Cork:      { lat: 51.9,    lng: -8.47   },
    Derry:     { lat: 54.995,  lng: -7.31   },
    Donegal:   { lat: 54.655,  lng: -8.1    },
    Down:      { lat: 54.32,   lng: -5.93   },
    Dublin:    { lat: 53.3498, lng: -6.2603 },
    Fermanagh: { lat: 54.345,  lng: -7.63   },
    Galway:    { lat: 53.2707, lng: -9.0568 },
    Kerry:     { lat: 52.15,   lng: -9.57   },
    Kildare:   { lat: 53.158,  lng: -6.91   },
    Kilkenny:  { lat: 52.654,  lng: -7.244  },
    Laois:     { lat: 52.994,  lng: -7.332  },
    Leitrim:   { lat: 54.124,  lng: -8.0    },
    Limerick:  { lat: 52.668,  lng: -8.63   },
    Longford:  { lat: 53.727,  lng: -7.793  },
    Louth:     { lat: 53.925,  lng: -6.49   },
    Mayo:      { lat: 53.847,  lng: -9.3    },
    Meath:     { lat: 53.607,  lng: -6.656  },
    Monaghan:  { lat: 54.249,  lng: -6.968  },
    Offaly:    { lat: 53.235,  lng: -7.712  },
    Roscommon: { lat: 53.627,  lng: -8.186  },
    Sligo:     { lat: 54.27,   lng: -8.47   },
    Tipperary: { lat: 52.473,  lng: -8.162  },
    Tyrone:    { lat: 54.6,    lng: -7.3    },
    Waterford: { lat: 52.259,  lng: -7.11   },
    Westmeath: { lat: 53.534,  lng: -7.465  },
    Wexford:   { lat: 52.336,  lng: -6.463  },
    Wicklow:   { lat: 52.98,   lng: -6.36   },
  },
}));

import { filterCounties, type CountyResult } from '../use-county-search';

describe('filterCounties', () => {
  it('returns matching counties for a prefix', () => {
    const results = filterCounties('galw');
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('Galway');
    expect(results[0]!.centre).toEqual({ lat: 53.2707, lng: -9.0568 });
  });

  it('is case-insensitive', () => {
    const results = filterCounties('GALW');
    expect(results).toHaveLength(1);
    expect(results[0]!.name).toBe('Galway');
  });

  it('matches mid-word substring', () => {
    const results = filterCounties('ow');
    const names = results.map((r) => r.name);
    expect(names).toContain('Down');
    expect(names).toContain('Wicklow');
  });

  it('returns empty array for no match', () => {
    expect(filterCounties('zzz')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(filterCounties('')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(filterCounties('   ')).toEqual([]);
  });

  it('returns at most 5 results', () => {
    const results = filterCounties('a');
    expect(results.length).toBeLessThanOrEqual(5);
  });
});
