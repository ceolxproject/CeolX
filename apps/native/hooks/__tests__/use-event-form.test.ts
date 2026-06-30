import { describe, expect, it, vi } from 'vitest';

// Mock the hook's runtime dependencies so importing the module in a plain
// Node env doesn't pull in React Native / tRPC. We only exercise the pure
// end-time validation helper, which touches none of these.
vi.mock('react', () => ({
  useCallback: (fn: unknown) => fn,
  useEffect: vi.fn(),
  useState: vi.fn(() => [undefined, vi.fn()]),
}));
vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(),
  useQueryClient: vi.fn(),
}));
vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
}));
vi.mock('react-native', () => ({ Alert: { alert: vi.fn() } }));
vi.mock('@/components/AppToast', () => ({
  appToast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/hooks/use-media-delete', () => ({ keyFromCdnUrl: vi.fn(), useMediaDelete: vi.fn() }));
vi.mock('@/hooks/use-media-upload', () => ({ useMediaUpload: vi.fn() }));
vi.mock('@/utils/trpc', () => ({ trpc: {} }));

import { endTimeBeforeStartError } from '../use-event-form';

// A fixed event date — the helper anchors both times to it before comparing.
const eventDate = new Date('2026-07-01T00:00:00.000Z');
const at = (h: number, m: number) => new Date(2026, 6, 1, h, m, 0, 0);

describe('endTimeBeforeStartError', () => {
  it('rejects an end time earlier than the start time (the reported bug)', () => {
    // Repro from the Asana task: start 20:42, end 17:46.
    expect(endTimeBeforeStartError(eventDate, at(20, 42), at(17, 46))).toBe(
      'End time cannot be before the start time'
    );
  });

  it('accepts an end time later than the start time', () => {
    expect(endTimeBeforeStartError(eventDate, at(18, 0), at(21, 30))).toBeUndefined();
  });

  it('accepts equal start and end times (zero-length event, matching the shared schema)', () => {
    expect(endTimeBeforeStartError(eventDate, at(20, 0), at(20, 0))).toBeUndefined();
  });

  it('is valid when the end time is one minute after the start', () => {
    expect(endTimeBeforeStartError(eventDate, at(20, 0), at(20, 1))).toBeUndefined();
  });

  it('is invalid when the end time is one minute before the start', () => {
    expect(endTimeBeforeStartError(eventDate, at(20, 1), at(20, 0))).toBe(
      'End time cannot be before the start time'
    );
  });

  it('is valid when the end time is not set (end time is optional)', () => {
    expect(endTimeBeforeStartError(eventDate, at(20, 0), null)).toBeUndefined();
  });

  it('is valid when the start time is not set yet (nothing to compare)', () => {
    expect(endTimeBeforeStartError(eventDate, null, at(20, 0))).toBeUndefined();
  });

  it('is valid when the event date is not set yet', () => {
    expect(endTimeBeforeStartError(null, at(20, 0), at(17, 0))).toBeUndefined();
  });
});
