// Hoisted mocks — vi.mock is lifted above imports by Vitest.
const mockSendVerification = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSendPasswordReset = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSendVenueActivation = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSendPaymentConfirmation = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSendEventApproved = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSendEventRejected = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@CeolX/email', () => ({
  sendVerificationEmail: mockSendVerification,
  sendPasswordResetEmail: mockSendPasswordReset,
  sendVenueActivationEmail: mockSendVenueActivation,
  sendPaymentConfirmationEmail: mockSendPaymentConfirmation,
  sendEventApprovedEmail: mockSendEventApproved,
  sendEventRejectedEmail: mockSendEventRejected,
}));

import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleEmailSend } from '../../jobs/handlers/email.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('handleEmailSend', () => {
  it('routes verification to sendVerificationEmail with URL and userName', async () => {
    await handleEmailSend({
      to: 'user@example.com',
      template: 'verification',
      locale: 'en',
      data: { verificationUrl: 'ceolx://verify?token=1', userName: 'Aoife' },
    });
    expect(mockSendVerification).toHaveBeenCalledWith(
      'user@example.com',
      'ceolx://verify?token=1',
      'Aoife'
    );
  });

  it('routes password-reset to sendPasswordResetEmail', async () => {
    await handleEmailSend({
      to: 'user@example.com',
      template: 'password-reset',
      locale: 'en',
      data: { resetUrl: 'ceolx://reset?token=1' },
    });
    expect(mockSendPasswordReset).toHaveBeenCalledWith(
      'user@example.com',
      'ceolx://reset?token=1',
      undefined
    );
  });

  it('routes venue-activation with the activation URL and venue name', async () => {
    await handleEmailSend({
      to: 'venue@example.com',
      template: 'venue-activation',
      locale: 'en',
      data: {
        venueName: 'The Hut',
        activationUrl: 'https://ceolx.com/subscribe',
      },
    });
    expect(mockSendVenueActivation).toHaveBeenCalledWith({
      to: 'venue@example.com',
      venueName: 'The Hut',
      activationUrl: 'https://ceolx.com/subscribe',
      userName: undefined,
    });
  });

  it('routes payment-confirmation with required Stripe-derived fields', async () => {
    await handleEmailSend({
      to: 'venue@example.com',
      template: 'payment-confirmation',
      locale: 'en',
      data: {
        amount: '€20.00',
        planName: 'CeolX Venue',
        nextBillingDate: '2026-05-22',
        manageUrl: 'https://ceolx.com/account',
      },
    });
    expect(mockSendPaymentConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '€20.00',
        planName: 'CeolX Venue',
        nextBillingDate: '2026-05-22',
        manageUrl: 'https://ceolx.com/account',
      })
    );
  });

  it('routes event-approved with title and URL', async () => {
    await handleEmailSend({
      to: 'artist@example.com',
      template: 'event-approved',
      locale: 'en',
      data: { eventTitle: 'Trad Night', eventUrl: 'ceolx://events/1' },
    });
    expect(mockSendEventApproved).toHaveBeenCalledWith(
      expect.objectContaining({
        eventTitle: 'Trad Night',
        eventUrl: 'ceolx://events/1',
      })
    );
  });

  it('routes event-rejected with the reason (mandatory per R7.2)', async () => {
    await handleEmailSend({
      to: 'artist@example.com',
      template: 'event-rejected',
      locale: 'en',
      data: {
        eventTitle: 'Trad Night',
        reason: 'Event date is in the past',
        editUrl: 'ceolx://events/1/edit',
      },
    });
    expect(mockSendEventRejected).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Event date is in the past' })
    );
  });

  it('tolerates a missing data field by passing empty strings through', async () => {
    await handleEmailSend({ to: 'user@example.com', template: 'verification', locale: 'en' });
    expect(mockSendVerification).toHaveBeenCalledWith('user@example.com', '', undefined);
  });
});
