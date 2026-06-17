import { describe, expect, it } from 'vitest';

import { toProgressFraction } from '../upload-progress';

describe('toProgressFraction', () => {
  it('returns the raw ratio while it is within 0–1', () => {
    expect(toProgressFraction(50, 100)).toBe(0.5);
    expect(toProgressFraction(0, 100)).toBe(0);
    expect(toProgressFraction(100, 100)).toBe(1);
  });

  it('clamps overshoot to 1 (RN reports loaded > total → ">100%" in UI)', () => {
    // 118 / 100 = 1.18 → must not surface as 118% (Asana 1215484454792689)
    expect(toProgressFraction(118, 100)).toBe(1);
  });

  it('treats a missing or zero total as 0 rather than NaN/Infinity', () => {
    expect(toProgressFraction(10, 0)).toBe(0);
    expect(toProgressFraction(10, Number.NaN)).toBe(0);
  });

  it('floors negative ratios at 0', () => {
    expect(toProgressFraction(-5, 100)).toBe(0);
  });
});
