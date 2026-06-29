import { render } from '@react-email/render';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { AccountDeletedEmail } from '../templates/account-deleted.js';
import { CollaboratorInviteEmail } from '../templates/collaborator-invite.js';
import { EventApprovedEmail } from '../templates/event-approved.js';
import { EventRejectedEmail } from '../templates/event-rejected.js';
import { NotificationEmail } from '../templates/notification.js';
import { PaymentConfirmationEmail } from '../templates/payment-confirmation.js';
import { VenueActivationEmail } from '../templates/venue-activation.js';
import { WelcomeEmail } from '../templates/welcome.js';

// ---------------------------------------------------------------------------
// venue-activation
// ---------------------------------------------------------------------------
describe('VenueActivationEmail', () => {
  const props = {
    userName: 'Aoife',
    venueName: 'The Hut',
    activationUrl: 'https://ceolx.ie/subscribe?token=abc',
  };

  it('renders personalised greeting, venue name, and activation URL', async () => {
    const html = await render(React.createElement(VenueActivationEmail, props));
    expect(html).toContain('Aoife');
    expect(html).toContain('The Hut');
    expect(html).toContain('https://ceolx.ie/subscribe?token=abc');
  });

  it('references the 5-minute activation window (R4.6)', async () => {
    const html = await render(React.createElement(VenueActivationEmail, props));
    expect(html).toMatch(/5 minutes/i);
  });

  it('falls back to "there" when userName is empty', async () => {
    const html = await render(
      React.createElement(VenueActivationEmail, { ...props, userName: '' })
    );
    // React Email inserts `<!-- -->` between text nodes, so assert on the
    // interpolated value only.
    expect(html).toContain('>there<');
  });
});

// ---------------------------------------------------------------------------
// payment-confirmation
// ---------------------------------------------------------------------------
describe('PaymentConfirmationEmail', () => {
  const props = {
    userName: 'Aoife',
    amount: '€20.00',
    planName: 'CeolX Venue',
    nextBillingDate: '2026-05-22',
    manageUrl: 'https://ceolx.ie/account',
    invoiceUrl: 'https://pay.stripe.com/invoice/abc',
  };

  it('includes amount, plan name, next billing date, and manage URL', async () => {
    const html = await render(React.createElement(PaymentConfirmationEmail, props));
    expect(html).toContain('€20.00');
    expect(html).toContain('CeolX Venue');
    expect(html).toContain('2026-05-22');
    expect(html).toContain('https://ceolx.ie/account');
  });

  it('renders the Stripe invoice link when provided', async () => {
    const html = await render(React.createElement(PaymentConfirmationEmail, props));
    expect(html).toContain('https://pay.stripe.com/invoice/abc');
  });

  it('omits the invoice section when invoiceUrl is not provided', async () => {
    const html = await render(
      React.createElement(PaymentConfirmationEmail, { ...props, invoiceUrl: undefined })
    );
    expect(html).not.toContain('Download it here');
  });
});

// ---------------------------------------------------------------------------
// event-approved
// ---------------------------------------------------------------------------
describe('EventApprovedEmail', () => {
  const props = {
    userName: 'Aoife',
    eventTitle: 'Trad Night at The Hut',
    eventUrl: 'ceolx://events/123',
    eventDate: '2026-05-01',
  };

  it('includes event title, CTA URL, and congratulations copy (R6.2)', async () => {
    const html = await render(React.createElement(EventApprovedEmail, props));
    expect(html).toContain('Trad Night at The Hut');
    expect(html).toContain('ceolx://events/123');
    expect(html).toMatch(/great news|live/i);
  });

  it('renders event date when provided', async () => {
    const html = await render(React.createElement(EventApprovedEmail, props));
    expect(html).toContain('2026-05-01');
  });

  it('omits event date gracefully when undefined', async () => {
    const html = await render(
      React.createElement(EventApprovedEmail, { ...props, eventDate: undefined })
    );
    expect(html).not.toContain('2026-05-01');
    // Body still reads cleanly: "your event \"...\" is live"
    expect(html).toContain('Trad Night at The Hut');
  });
});

// ---------------------------------------------------------------------------
// event-rejected
// ---------------------------------------------------------------------------
describe('EventRejectedEmail', () => {
  const props = {
    userName: 'Aoife',
    eventTitle: 'Trad Night at The Hut',
    reason: 'Event date is in the past',
    editUrl: 'ceolx://events/123/edit',
  };

  it('surfaces the removal reason (R7.2 — reason required)', async () => {
    const html = await render(React.createElement(EventRejectedEmail, props));
    expect(html).toContain('Event date is in the past');
  });

  it('provides the edit-and-resubmit link (R7.3)', async () => {
    const html = await render(React.createElement(EventRejectedEmail, props));
    expect(html).toContain('ceolx://events/123/edit');
    expect(html).toMatch(/edit.*event/i);
  });

  it('uses neutral, non-punitive copy (R6 convention)', async () => {
    const html = await render(React.createElement(EventRejectedEmail, props));
    // Heading per matrix A-15 / V-14: "Your event needs revision"
    expect(html).toMatch(/needs revision/i);
    expect(html).not.toMatch(/rejected|denied|failed|violation/i);
  });
});

// ---------------------------------------------------------------------------
// notification (generic — drives booking-lifecycle emails A-09..V-13)
// ---------------------------------------------------------------------------
describe('NotificationEmail', () => {
  const props = {
    userName: 'Aoife',
    subject: 'You\'ve been invited to play "Trad Night"',
    body: 'The Hut invited you to perform at "Trad Night" on 1 May.',
    ctaUrl: 'https://api.ceolx.com/r?to=%2Fbookings%2Fb-123',
  };

  it('renders subject heading, body copy, and the CTA url', async () => {
    const html = await render(React.createElement(NotificationEmail, props));
    expect(html).toContain('Aoife');
    expect(html).toContain('The Hut invited you to perform at');
    expect(html).toMatch(/been invited to play/); // subject rendered as the heading
    expect(html).toContain('https://api.ceolx.com/r?to=%2Fbookings%2Fb-123');
  });

  it('falls back to a generic greeting when userName is empty', async () => {
    const html = await render(React.createElement(NotificationEmail, { ...props, userName: '' }));
    // React Email inserts <!-- --> between text nodes around the fallback
    expect(html).toContain('>there<');
  });
});

// ---------------------------------------------------------------------------
// welcome (ONB-01 — onboarding)
// ---------------------------------------------------------------------------
describe('WelcomeEmail', () => {
  const props = {
    userName: 'Aoife',
    ctaUrl: 'https://api.ceolx.com/r?to=%2F(app)%2F(tabs)%2Fdiscover',
  };

  it('greets by name, lists what to do, and renders the Open CeolX CTA', async () => {
    const html = await render(React.createElement(WelcomeEmail, props));
    expect(html).toContain('Aoife');
    expect(html).toMatch(/Welcome to CeolX/);
    expect(html).toContain('Explore events near you');
    expect(html).toContain('Follow your favourite artists and venues');
    expect(html).toContain('https://api.ceolx.com/r?to=%2F(app)%2F(tabs)%2Fdiscover');
  });

  it('falls back to "there" when userName is empty', async () => {
    const html = await render(React.createElement(WelcomeEmail, { ...props, userName: '' }));
    expect(html).toContain('>there<');
  });
});

// ---------------------------------------------------------------------------
// account-deleted (matrix S-06 / A-18 / V-17 — GDPR erasure confirmation)
// ---------------------------------------------------------------------------
describe('AccountDeletedEmail', () => {
  it('confirms deletion and greets the user by name', async () => {
    const html = await render(React.createElement(AccountDeletedEmail, { userName: 'Aoife' }));
    expect(html).toContain('Aoife');
    expect(html).toMatch(/deleted/i);
  });

  it('falls back to "there" when userName is empty', async () => {
    const html = await render(React.createElement(AccountDeletedEmail, { userName: '' }));
    expect(html).toContain('>there<');
  });
});

// ---------------------------------------------------------------------------
// collaborator-invite (matrix A-14 — outside-platform invite)
// ---------------------------------------------------------------------------
describe('CollaboratorInviteEmail', () => {
  const props = {
    inviterName: 'The Temple Bar',
    eventTitle: 'Trad Night',
    eventDate: '1 May',
    inviteUrl: 'https://ceolx.ie/invite/tok-abc',
  };

  it('names the inviter, the event, and the join link', async () => {
    const html = await render(React.createElement(CollaboratorInviteEmail, props));
    expect(html).toContain('The Temple Bar');
    expect(html).toContain('Trad Night');
    expect(html).toContain('https://ceolx.ie/invite/tok-abc');
  });

  it('mentions the 14-day expiry (R: link TTL)', async () => {
    const html = await render(React.createElement(CollaboratorInviteEmail, props));
    expect(html).toMatch(/14 days/i);
  });

  it('renders cleanly without an event date', async () => {
    const html = await render(
      React.createElement(CollaboratorInviteEmail, { ...props, eventDate: undefined })
    );
    expect(html).toContain('Trad Night');
    expect(html).not.toContain('1 May');
  });
});
