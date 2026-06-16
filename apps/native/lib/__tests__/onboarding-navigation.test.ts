import { describe, expect, it } from 'vitest';

import { isBackNavigationAction } from '../onboarding-navigation';

describe('isBackNavigationAction', () => {
  it('treats GO_BACK / POP / POP_TO_TOP as back navigation', () => {
    expect(isBackNavigationAction('GO_BACK')).toBe(true);
    expect(isBackNavigationAction('POP')).toBe(true);
    expect(isBackNavigationAction('POP_TO_TOP')).toBe(true);
  });

  it('does not treat REPLACE as back navigation', () => {
    // The Google sign-up roundtrip redirects /(app)/(tabs)/map →
    // /(auth)/venue-onboarding via router.replace. That REPLACE removes the
    // onboarding screen and must NOT trigger the discard dialog (Asana 1215278068024772).
    expect(isBackNavigationAction('REPLACE')).toBe(false);
  });

  it('does not treat forward navigation (NAVIGATE / PUSH) as back navigation', () => {
    expect(isBackNavigationAction('NAVIGATE')).toBe(false);
    expect(isBackNavigationAction('PUSH')).toBe(false);
  });

  it('returns false for an undefined action type', () => {
    expect(isBackNavigationAction(undefined)).toBe(false);
  });
});
