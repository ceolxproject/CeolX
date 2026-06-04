import * as Location from 'expo-location';
import { describe, expect, it, vi } from 'vitest';

import { resolvePromptState } from '../use-location-permission-prompt';

// expo-location is native-only; stub the PermissionStatus enum used by the pure
// decision function. vi.mock is hoisted above the imports. We test
// resolvePromptState directly (not the hook) — same approach as use-gps-region.
vi.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
}));

describe('resolvePromptState', () => {
  it('never prompts when permission is granted', () => {
    expect(resolvePromptState(Location.PermissionStatus.GRANTED, false)).toBe('done');
    expect(resolvePromptState(Location.PermissionStatus.GRANTED, true)).toBe('done');
  });

  it('prompts on first ask (undetermined, not yet shown this session)', () => {
    expect(resolvePromptState(Location.PermissionStatus.UNDETERMINED, false)).toBe('show');
  });

  it('re-prompts a denied user who has not been asked yet this session', () => {
    expect(resolvePromptState(Location.PermissionStatus.DENIED, false)).toBe('show');
  });

  it('does not re-show within the same session once already shown', () => {
    expect(resolvePromptState(Location.PermissionStatus.UNDETERMINED, true)).toBe('done');
    expect(resolvePromptState(Location.PermissionStatus.DENIED, true)).toBe('done');
  });
});
