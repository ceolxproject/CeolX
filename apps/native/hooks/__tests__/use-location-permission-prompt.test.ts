import * as Location from 'expo-location';
import { describe, expect, it, vi } from 'vitest';

import { resolvePromptState } from '../use-location-permission-prompt';

vi.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
}));

// Mock base-location + location-setup so importing the hook doesn't pull in
// expo-secure-store (native-only) in the Node test env. resolvePromptState
// itself is pure.
vi.mock('@/utils/base-location', () => ({
  getBaseLocation: vi.fn(),
}));
vi.mock('@/utils/location-setup', () => ({
  getLocationSetupComplete: vi.fn(),
}));

const GRANTED = Location.PermissionStatus.GRANTED;
const DENIED = Location.PermissionStatus.DENIED;
const UNDETERMINED = Location.PermissionStatus.UNDETERMINED;

describe('resolvePromptState', () => {
  // signature: (status, canAskAgain, shownThisSession, hasSavedLocation, servicesEnabled)

  it('never prompts when permission is granted', () => {
    expect(resolvePromptState(GRANTED, true, false, false, true)).toBe('done');
    expect(resolvePromptState(GRANTED, true, true, true, true)).toBe('done');
  });

  describe('no saved location (existing matrix)', () => {
    it('prompts on first ask', () => {
      expect(resolvePromptState(UNDETERMINED, true, false, false, true)).toBe('show');
      expect(resolvePromptState(DENIED, false, false, false, true)).toBe('show');
    });
    it('does not re-show within the same session', () => {
      expect(resolvePromptState(UNDETERMINED, true, true, false, true)).toBe('done');
      expect(resolvePromptState(DENIED, false, true, false, true)).toBe('done');
    });
    it('still prompts on first ask even when device services are off', () => {
      // No saved location → the services gate does not apply; the first-ask prompt
      // still shows (the priming screen offers "Select location manually").
      expect(resolvePromptState(UNDETERMINED, true, false, false, false)).toBe('show');
    });
  });

  describe('saved location exists (services-aware upgrade ask)', () => {
    it('asks once when services on, can ask again, not yet shown', () => {
      expect(resolvePromptState(UNDETERMINED, true, false, true, true)).toBe('show');
      expect(resolvePromptState(DENIED, true, false, true, true)).toBe('show');
    });
    it('stays silent when device services are off', () => {
      expect(resolvePromptState(DENIED, true, false, true, false)).toBe('done');
    });
    it('stays silent when hard-denied (cannot ask again)', () => {
      expect(resolvePromptState(DENIED, false, false, true, true)).toBe('done');
    });
    it('stays silent once already shown this session', () => {
      expect(resolvePromptState(UNDETERMINED, true, true, true, true)).toBe('done');
    });
  });
});
