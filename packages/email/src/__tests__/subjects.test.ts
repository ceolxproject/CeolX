import { describe, expect, it } from 'vitest';

import { subjectFor } from '../subjects.js';

describe('subjectFor', () => {
  it('returns the matrix-approved subject for verification', () => {
    expect(subjectFor('verification', { userName: 'A', verificationUrl: 'u' })).toBe(
      'Confirm your email for CeolX'
    );
  });

  it('returns the matrix-approved subject for password-reset', () => {
    expect(subjectFor('password-reset', { userName: 'A', resetUrl: 'u' })).toBe(
      'Reset your CeolX password'
    );
  });

  it('returns the matrix V-03 subject for venue-activation', () => {
    expect(
      subjectFor('venue-activation', {
        userName: 'A',
        venueName: 'The Hut',
        activationUrl: 'https://ceolx.ie/subscribe',
      })
    ).toBe('Activate your CeolX Venue subscription');
  });

  it('returns the matrix A-06/V-06 subject for payment-confirmation', () => {
    expect(
      subjectFor('payment-confirmation', {
        userName: 'A',
        amount: '€20.00',
        planName: 'CeolX Venue',
        nextBillingDate: '2026-05-22',
        manageUrl: 'https://ceolx.ie/account',
        invoiceUrl: 'https://stripe.com/i/1',
      })
    ).toBe('CeolX subscription — payment received');
  });

  it('interpolates the event title into event-approved subjects', () => {
    expect(
      subjectFor('event-approved', {
        userName: 'A',
        eventTitle: 'Trad Night at The Hut',
        eventUrl: 'ceolx://events/123',
      })
    ).toBe('Your event "Trad Night at The Hut" is live on CeolX');
  });

  it('interpolates the event title into event-rejected subjects and stays neutral', () => {
    const subject = subjectFor('event-rejected', {
      userName: 'A',
      eventTitle: 'Trad Night at The Hut',
      reason: 'Date is in the past',
      editUrl: 'ceolx://events/123/edit',
    });
    expect(subject).toBe('Action needed — "Trad Night at The Hut"');
    // R6 copy convention: rejection titles are neutral, not punitive
    expect(subject).not.toMatch(/rejected|denied|failed/i);
  });
});
