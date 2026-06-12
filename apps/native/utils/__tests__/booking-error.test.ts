import { describe, expect, it } from 'vitest';

import { BOOKING_ERROR_FALLBACK, getBookingActionErrorBody } from '../booking-error';

describe('getBookingActionErrorBody', () => {
  it('maps a double-withdraw (cancelled → cancelled) to a friendly message', () => {
    const err = new Error('Cannot transition from "cancelled" to "cancelled"');
    expect(getBookingActionErrorBody(err)).toBe('This request has already been withdrawn.');
  });

  it('maps any action on an already-cancelled request to "already withdrawn"', () => {
    const err = new Error('Cannot transition from "cancelled" to "accepted"');
    expect(getBookingActionErrorBody(err)).toBe('This request has already been withdrawn.');
  });

  it('maps an action on an already-rejected request to "already declined"', () => {
    const err = new Error('Cannot transition from "rejected" to "accepted"');
    expect(getBookingActionErrorBody(err)).toBe('This request has already been declined.');
  });

  it('maps a re-accept/re-reject (from accepted) to "already accepted"', () => {
    const err = new Error('Cannot transition from "accepted" to "rejected"');
    expect(getBookingActionErrorBody(err)).toBe('This request has already been accepted.');
  });

  it('falls back to the generic message for non-transition errors', () => {
    expect(getBookingActionErrorBody(new Error('Network request failed'))).toBe(
      BOOKING_ERROR_FALLBACK
    );
    expect(getBookingActionErrorBody(new Error('Booking not found'))).toBe(BOOKING_ERROR_FALLBACK);
  });

  it('falls back to the generic message for non-Error values', () => {
    expect(getBookingActionErrorBody(undefined)).toBe(BOOKING_ERROR_FALLBACK);
    expect(getBookingActionErrorBody('some string')).toBe(BOOKING_ERROR_FALLBACK);
    expect(getBookingActionErrorBody({ message: 'nope' })).toBe(BOOKING_ERROR_FALLBACK);
  });
});
