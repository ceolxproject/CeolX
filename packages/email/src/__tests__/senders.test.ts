import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendEmail } from '../send.js';
import { sendAccountDeletedEmail } from '../senders/account-deleted.js';
import { sendCollaboratorInviteEmail } from '../senders/collaborator-invite.js';
import { sendEventApprovedEmail } from '../senders/event-approved.js';
import { sendEventRejectedEmail } from '../senders/event-rejected.js';
import { sendNotificationEmail } from '../senders/notification.js';
import { sendPasswordResetEmail } from '../senders/password-reset.js';
import { sendPaymentConfirmationEmail } from '../senders/payment-confirmation.js';
import { sendVenueActivationEmail } from '../senders/venue-activation.js';
import { sendVerificationEmail } from '../senders/verification.js';
import { sendWelcomeEmail } from '../senders/welcome.js';

vi.mock('../send.js', () => ({ sendEmail: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sendEmail).mockResolvedValue(undefined);
});

describe('sendVerificationEmail', () => {
  it('dispatches the verification template with userName + URL', async () => {
    await sendVerificationEmail('u@example.com', 'ceolx://verify?token=1', 'Aoife');
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'u@example.com',
      template: 'verification',
      data: { userName: 'Aoife', verificationUrl: 'ceolx://verify?token=1' },
    });
  });

  it('defaults userName to empty string', async () => {
    await sendVerificationEmail('u@example.com', 'ceolx://verify?token=1');
    expect(vi.mocked(sendEmail).mock.calls[0]?.[0].data).toMatchObject({ userName: '' });
  });
});

describe('sendPasswordResetEmail', () => {
  it('dispatches the password-reset template', async () => {
    await sendPasswordResetEmail('u@example.com', 'ceolx://reset?token=1', 'Aoife');
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'u@example.com',
      template: 'password-reset',
      data: { userName: 'Aoife', resetUrl: 'ceolx://reset?token=1' },
    });
  });
});

describe('sendVenueActivationEmail', () => {
  it('dispatches the venue-activation template with venue name + URL', async () => {
    await sendVenueActivationEmail({
      to: 'v@example.com',
      venueName: 'The Hut',
      activationUrl: 'https://ceolx.ie/subscribe',
      userName: 'Sean',
    });
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'v@example.com',
      template: 'venue-activation',
      data: {
        userName: 'Sean',
        venueName: 'The Hut',
        activationUrl: 'https://ceolx.ie/subscribe',
      },
    });
  });
});

describe('sendPaymentConfirmationEmail', () => {
  it('dispatches with required fields and omits invoiceUrl when absent', async () => {
    await sendPaymentConfirmationEmail({
      to: 'v@example.com',
      amount: '€20.00',
      planName: 'CeolX Venue',
      nextBillingDate: '2026-05-22',
      manageUrl: 'https://ceolx.ie/account',
    });
    const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(call?.template).toBe('payment-confirmation');
    expect(call?.data).not.toHaveProperty('invoiceUrl');
  });

  it('passes invoiceUrl through when provided', async () => {
    await sendPaymentConfirmationEmail({
      to: 'v@example.com',
      amount: '€20.00',
      planName: 'CeolX Venue',
      nextBillingDate: '2026-05-22',
      manageUrl: 'https://ceolx.ie/account',
      invoiceUrl: 'https://pay.stripe.com/invoice/abc',
    });
    const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(call?.data).toMatchObject({ invoiceUrl: 'https://pay.stripe.com/invoice/abc' });
  });
});

describe('sendEventApprovedEmail', () => {
  it('dispatches with event title + URL', async () => {
    await sendEventApprovedEmail({
      to: 'a@example.com',
      eventTitle: 'Trad Night',
      eventUrl: 'ceolx://events/123',
    });
    const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(call?.template).toBe('event-approved');
    expect(call?.data).toMatchObject({
      eventTitle: 'Trad Night',
      eventUrl: 'ceolx://events/123',
    });
  });
});

describe('sendEventRejectedEmail', () => {
  it('dispatches with reason (mandatory per R7.2)', async () => {
    await sendEventRejectedEmail({
      to: 'a@example.com',
      eventTitle: 'Trad Night',
      reason: 'Event date is in the past',
      editUrl: 'ceolx://events/123/edit',
    });
    const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(call?.template).toBe('event-rejected');
    expect(call?.data).toMatchObject({
      eventTitle: 'Trad Night',
      reason: 'Event date is in the past',
      editUrl: 'ceolx://events/123/edit',
    });
  });
});

describe('sendNotificationEmail', () => {
  it('dispatches the notification template with subject, body, and CTA', async () => {
    await sendNotificationEmail({
      to: 'a@example.com',
      subject: 'New performance request — "Trad Night"',
      body: 'Sean applied to play "Trad Night" on 1 May.',
      ctaUrl: 'https://api.ceolx.com/r?to=%2Fbookings%2Fb-1',
      userName: 'Aoife',
    });
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'a@example.com',
      template: 'notification',
      data: {
        userName: 'Aoife',
        subject: 'New performance request — "Trad Night"',
        body: 'Sean applied to play "Trad Night" on 1 May.',
        ctaUrl: 'https://api.ceolx.com/r?to=%2Fbookings%2Fb-1',
      },
    });
  });

  it('defaults userName to empty string when omitted', async () => {
    await sendNotificationEmail({
      to: 'a@example.com',
      subject: 'Performance confirmed',
      body: 'Confirmed.',
      ctaUrl: 'https://api.ceolx.com/r?to=%2Fbookings%2Fb-2',
    });
    expect(vi.mocked(sendEmail).mock.calls[0]?.[0].data).toMatchObject({ userName: '' });
  });
});

describe('sendWelcomeEmail', () => {
  it('dispatches the welcome template with userName + ctaUrl', async () => {
    await sendWelcomeEmail('u@example.com', 'https://api.ceolx.com/r?to=%2Fdiscover', 'Aoife');
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'u@example.com',
      template: 'welcome',
      data: { userName: 'Aoife', ctaUrl: 'https://api.ceolx.com/r?to=%2Fdiscover' },
    });
  });

  it('defaults userName to empty string when omitted', async () => {
    await sendWelcomeEmail('u@example.com', 'https://api.ceolx.com/r?to=%2Fdiscover');
    expect(vi.mocked(sendEmail).mock.calls[0]?.[0].data).toMatchObject({ userName: '' });
  });
});

describe('sendAccountDeletedEmail', () => {
  it('dispatches the account-deleted template with userName', async () => {
    await sendAccountDeletedEmail({ to: 'gone@example.com', userName: 'Aoife' });
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'gone@example.com',
      template: 'account-deleted',
      data: { userName: 'Aoife' },
    });
  });

  it('defaults userName to empty string when omitted', async () => {
    await sendAccountDeletedEmail({ to: 'gone@example.com' });
    expect(vi.mocked(sendEmail).mock.calls[0]?.[0].data).toMatchObject({ userName: '' });
  });
});

describe('sendCollaboratorInviteEmail', () => {
  it('dispatches the collaborator-invite template with inviter, event, and URL', async () => {
    await sendCollaboratorInviteEmail({
      to: 'artist@example.com',
      inviterName: 'The Temple Bar',
      eventTitle: 'Trad Night',
      eventDate: '1 May',
      inviteUrl: 'https://ceolx.ie/invite/tok-abc',
    });
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'artist@example.com',
      template: 'collaborator-invite',
      data: {
        inviterName: 'The Temple Bar',
        eventTitle: 'Trad Night',
        eventDate: '1 May',
        inviteUrl: 'https://ceolx.ie/invite/tok-abc',
      },
    });
  });

  it('omits eventDate when not provided', async () => {
    await sendCollaboratorInviteEmail({
      to: 'artist@example.com',
      inviterName: 'The Temple Bar',
      eventTitle: 'Trad Night',
      inviteUrl: 'https://ceolx.ie/invite/tok-abc',
    });
    expect(vi.mocked(sendEmail).mock.calls[0]?.[0].data).not.toHaveProperty('eventDate');
  });
});
