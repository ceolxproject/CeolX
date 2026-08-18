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
        monthlyUrl: 'https://api.ceolx.com/activate?token=abc&plan=monthly',
        annualUrl: 'https://api.ceolx.com/activate?token=abc&plan=annual',
        expiresInMinutes: 45,
      })
    ).toBe('Activate your CeolX Venue/Festival subscription');
  });

  it('returns the matrix A-06/V-06 subject for payment-confirmation', () => {
    expect(
      subjectFor('payment-confirmation', {
        userName: 'A',
        amount: '€20.00',
        planName: 'CeolX Venue',
        nextBillingDate: '2026-05-22',
        manageUrl: 'https://ceolx.com/account',
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

  it('passes the pre-built subject straight through for notification', () => {
    expect(
      subjectFor('notification', {
        userName: 'A',
        subject: 'New performance request — "Trad Night"',
        body: 'Someone applied.',
        ctaUrl: 'https://api.ceolx.com/r?to=%2Fbookings%2Fx',
      })
    ).toBe('New performance request — "Trad Night"');
  });

  it('returns the onboarding subject for welcome (ONB-01)', () => {
    expect(
      subjectFor('welcome', { userName: 'Aoife', ctaUrl: 'https://api.ceolx.com/r?to=%2Fdiscover' })
    ).toBe("You're in! Welcome to CeolX 🎶");
  });

  it('names the inviter and event for collaborator-invite (matrix A-14)', () => {
    expect(
      subjectFor('collaborator-invite', {
        inviterName: 'The Temple Bar',
        eventTitle: 'Trad Night',
        inviteUrl: 'https://ceolx.com/invite/tok-abc',
      })
    ).toBe('The Temple Bar added you to "Trad Night" on CeolX');
  });

  it('returns the matrix S-06 subject for account-deleted', () => {
    expect(subjectFor('account-deleted', { userName: 'Aoife' })).toBe(
      'Your CeolX account has been deleted'
    );
  });

  it('names the venue in the activation-reminder subject', () => {
    expect(
      subjectFor('activation-reminder', {
        userName: 'A',
        venueName: 'The Hut',
        monthlyUrl: 'https://api.ceolx.com/activate?token=abc&plan=monthly',
        annualUrl: 'https://api.ceolx.com/activate?token=abc&plan=annual',
        expiresInMinutes: 45,
      })
    ).toBe("The Hut isn't visible on CeolX yet");
  });

  it('puts the amount and date in the trial-ending subject', () => {
    // For many venues the subject line is the only part they read, and an
    // unannounced debit six months after sign-up is how disputes start (D-30).
    expect(
      subjectFor('trial-ending', {
        userName: 'A',
        venueName: 'The Hut',
        amount: '€19.99',
        chargeDate: '17 February 2027',
        interval: 'monthly',
        manageUrl: 'https://api.ceolx.com/r?to=/profile',
      })
    ).toBe('Your CeolX trial ends soon — €19.99 on 17 February 2027');
  });

  it('has a plain subject for the manage-subscription link', () => {
    expect(
      subjectFor('manage-subscription', {
        userName: 'A',
        venueName: 'The Hut',
        portalUrl: 'https://billing.stripe.com/p/session_abc',
      })
    ).toBe('Manage your CeolX subscription');
  });
});
