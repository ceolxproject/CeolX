import { describe, expect, it } from 'vitest';

import { combineDateAndTime, endDateTimeError, platformInviteIds } from '../use-event-form.utils';

// A fixed calendar day, plus a helper to build a Date carrying only a time.
const DAY = new Date(2026, 5, 10);

function timeAt(hours: number, minutes: number): Date {
  const d = new Date(2026, 5, 10);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

describe('combineDateAndTime', () => {
  it('merges the date portion with the time portion', () => {
    const iso = combineDateAndTime(DAY, timeAt(20, 30));
    expect(iso).toBeDefined();
    const parsed = new Date(iso ?? '');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(5);
    expect(parsed.getDate()).toBe(10);
    expect(parsed.getHours()).toBe(20);
    expect(parsed.getMinutes()).toBe(30);
  });

  it('returns undefined when the date is missing', () => {
    expect(combineDateAndTime(null, timeAt(20, 0))).toBeUndefined();
  });

  it('returns undefined when the time is missing', () => {
    expect(combineDateAndTime(DAY, null)).toBeUndefined();
  });
});

describe('endDateTimeError', () => {
  it('flags an end time earlier than the start time on the same day', () => {
    // 20:00 start, 18:00 end → end is before start
    expect(endDateTimeError(DAY, timeAt(20, 0), null, timeAt(18, 0))).toBe(
      'End time must be after start time'
    );
  });

  it('accepts an end time after the start time', () => {
    expect(endDateTimeError(DAY, timeAt(18, 0), null, timeAt(20, 0))).toBeUndefined();
  });

  it('accepts an end time equal to the start time (>= is valid, matching the schema)', () => {
    expect(endDateTimeError(DAY, timeAt(20, 0), null, timeAt(20, 0))).toBeUndefined();
  });

  it('is valid when no end time is set (end time is optional)', () => {
    expect(endDateTimeError(DAY, timeAt(20, 0), null, null)).toBeUndefined();
  });

  it('is valid when the start time is missing (its own required rule covers that)', () => {
    expect(endDateTimeError(DAY, null, null, timeAt(18, 0))).toBeUndefined();
  });

  it('compares against an explicit end date when one is supplied', () => {
    const nextDay = new Date(2026, 5, 11);
    // End on the following day at an earlier clock time is still valid.
    expect(endDateTimeError(DAY, timeAt(20, 0), nextDay, timeAt(9, 0))).toBeUndefined();
  });
});

describe('platformInviteIds', () => {
  // The form now holds the full artist display objects (so the invite chips
  // survive a step change); the payload still wants just the IDs. These guard
  // that derivation. (Asana 1215484565234867)
  const artist = (id: string) => ({ id, stageName: id, genre: null, image: null, name: null });

  it('maps selected artist objects down to their IDs', () => {
    expect(platformInviteIds([artist('a1'), artist('a2')])).toEqual(['a1', 'a2']);
  });

  it('preserves order and keeps every selection (no dedupe — the picker guards that)', () => {
    expect(platformInviteIds([artist('b'), artist('a'), artist('c')])).toEqual(['b', 'a', 'c']);
  });

  it('returns undefined for an empty selection so the optional field is omitted', () => {
    expect(platformInviteIds([])).toBeUndefined();
  });
});
