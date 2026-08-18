import { render } from '@react-email/render';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { AccountDeletedEmail } from '../templates/account-deleted.js';
import { ActivationReminderEmail } from '../templates/activation-reminder.js';
import { CollaboratorInviteEmail } from '../templates/collaborator-invite.js';
import { EventApprovedEmail } from '../templates/event-approved.js';
import { EventRejectedEmail } from '../templates/event-rejected.js';
import { ManageSubscriptionEmail } from '../templates/manage-subscription.js';
import { NotificationEmail } from '../templates/notification.js';
import { PaymentConfirmationEmail } from '../templates/payment-confirmation.js';
import { TrialEndingEmail } from '../templates/trial-ending.js';
import { VenueActivationEmail } from '../templates/venue-activation.js';
import { WelcomeEmail } from '../templates/welcome.js';

// ---------------------------------------------------------------------------
// venue-activation
// ---------------------------------------------------------------------------
describe('VenueActivationEmail', () => {
  const props = {
    userName: 'Aoife',
    venueName: 'The Hut',
    monthlyUrl: 'https://api.ceolx.com/activate?token=abc&plan=monthly',
    annualUrl: 'https://api.ceolx.com/activate?token=abc&plan=annual',
    monthlyPrice: '€19.99',
    annualPrice: '€199.00',
    expiresInMinutes: 45,
  };

  it('renders personalised greeting, venue name, and both interval links', async () => {
    const html = await render(React.createElement(VenueActivationEmail, props));
    expect(html).toContain('Aoife');
    expect(html).toContain('The Hut');
    // React Email escapes & in href attributes, so match on the plan parameter.
    expect(html).toContain('plan=monthly');
    expect(html).toContain('plan=annual');
  });

  it('shows each interval with its price so the venue can choose (D-08)', async () => {
    const html = await render(React.createElement(VenueActivationEmail, props));
    expect(html).toMatch(/Subscribe monthly/i);
    expect(html).toMatch(/Subscribe annually/i);
    expect(html).toContain('€19.99');
    expect(html).toContain('€199.00');
  });

  it('omits prices rather than inventing them when Stripe was unreachable', async () => {
    const html = await render(
      React.createElement(VenueActivationEmail, {
        ...props,
        monthlyPrice: undefined,
        annualPrice: undefined,
      })
    );
    expect(html).toMatch(/Subscribe monthly/i);
    expect(html).toMatch(/Subscribe annually/i);
    expect(html).not.toContain('€');
  });

  // Rewritten in M8-T1: the old assertion looked for a "5 minutes" go-live promise.
  // What matters now is the link lifetime (D-17) and the newest-link-wins wording
  // that D-18 explicitly asks for, since a venue may hold several emails.
  it('states the link lifetime and that only the newest email works (D-17, D-18)', async () => {
    const html = await render(React.createElement(VenueActivationEmail, props));
    // React Email splits interpolated values from adjacent static text with an
    // HTML comment, so "45 minutes" is never contiguous in the output. Assert the
    // interpolated value and the surrounding copy separately.
    expect(html).toMatch(/expire in/i);
    expect(html).toContain('45');
    expect(html).toMatch(/minutes/i);
    expect(html).toMatch(/most recent/i);
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
    manageUrl: 'https://ceolx.com/account',
    invoiceUrl: 'https://pay.stripe.com/invoice/abc',
  };

  it('includes amount, plan name, next billing date, and manage URL', async () => {
    const html = await render(React.createElement(PaymentConfirmationEmail, props));
    expect(html).toContain('€20.00');
    expect(html).toContain('CeolX Venue');
    expect(html).toContain('2026-05-22');
    expect(html).toContain('https://ceolx.com/account');
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

  it('adds the free-access line for venues, with no price or subscribe link', async () => {
    const html = await render(React.createElement(WelcomeEmail, { ...props, isVenue: true }));
    expect(html).toMatch(/free access period/i);
    expect(html).toMatch(/future update/i);
    // 3.1.1 guard. React Email emits a bare `<!--$-->`, so require a digit
    // after the symbol — a lone `$` isn't evidence of a price.
    expect(html).not.toContain('ceolx.com/subscribe');
    expect(html).not.toMatch(/[€$]\s?\d/);
  });

  it('omits the free-access line for non-venue personas', async () => {
    const html = await render(React.createElement(WelcomeEmail, props));
    expect(html).not.toMatch(/free access period/i);
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
    inviteUrl: 'https://ceolx.com/invite/tok-abc',
  };

  it('names the inviter, the event, and the join link', async () => {
    const html = await render(React.createElement(CollaboratorInviteEmail, props));
    expect(html).toContain('The Temple Bar');
    expect(html).toContain('Trad Night');
    expect(html).toContain('https://ceolx.com/invite/tok-abc');
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

// ---------------------------------------------------------------------------
// activation-reminder (M8-T6, D-26)
// ---------------------------------------------------------------------------
describe('ActivationReminderEmail', () => {
  const props = {
    userName: 'Aoife',
    venueName: 'The Hut',
    monthlyUrl: 'https://api.ceolx.com/activate?token=abc&plan=monthly',
    annualUrl: 'https://api.ceolx.com/activate?token=abc&plan=annual',
    monthlyPrice: '€19.99',
    annualPrice: '€199.00',
    expiresInMinutes: 45,
  };

  it('offers both intervals, same as the original activation email', async () => {
    const html = await render(React.createElement(ActivationReminderEmail, props));
    expect(html).toContain('The Hut');
    expect(html).toContain('plan=monthly');
    expect(html).toContain('plan=annual');
  });

  it('says the links supersede earlier ones (D-18)', async () => {
    const html = await render(React.createElement(ActivationReminderEmail, props));
    expect(html).toMatch(/replace any links/i);
  });

  it('tells the venue how to stop being reminded', async () => {
    // A nudge with no opt-out reads as nagging, and three of them read worse.
    const html = await render(React.createElement(ActivationReminderEmail, props));
    expect(html).toMatch(/ignore this/i);
  });
});

// ---------------------------------------------------------------------------
// trial-ending (M8-T6, D-30)
// ---------------------------------------------------------------------------
describe('TrialEndingEmail', () => {
  const props = {
    userName: 'Aoife',
    venueName: 'The Hut',
    amount: '€19.99',
    chargeDate: '17 February 2027',
    interval: 'monthly',
    manageUrl: 'https://api.ceolx.com/r?to=/profile',
  };

  it('leads with the amount and the date, not buried in the body', async () => {
    // A charge six months after sign-up is how chargebacks start (D-51 makes one
    // expensive for the venue too), so these two facts must be impossible to miss.
    const html = await render(React.createElement(TrialEndingEmail, props));
    expect(html).toContain('€19.99');
    expect(html).toContain('17 February 2027');
  });

  it('gives an unambiguous way to cancel', async () => {
    const html = await render(React.createElement(TrialEndingEmail, props));
    expect(html).toMatch(/Manage or cancel/i);
    expect(html).toContain(props.manageUrl);
  });

  it('prompts a card update, since six months is long enough for one to expire', async () => {
    const html = await render(React.createElement(TrialEndingEmail, props));
    expect(html).toMatch(/update it before/i);
  });
});

// ---------------------------------------------------------------------------
// manage-subscription (M8-T6, D-45)
// ---------------------------------------------------------------------------
describe('ManageSubscriptionEmail', () => {
  const props = {
    userName: 'Aoife',
    venueName: 'The Hut',
    portalUrl: 'https://billing.stripe.com/p/session_abc',
  };

  it('links to the Stripe Portal and names what can be done there', async () => {
    const html = await render(React.createElement(ManageSubscriptionEmail, props));
    expect(html).toContain(props.portalUrl);
    expect(html).toMatch(/cancel/i);
    expect(html).toMatch(/invoices/i);
  });

  it('warns the link is single-use and short-lived', async () => {
    const html = await render(React.createElement(ManageSubscriptionEmail, props));
    expect(html).toMatch(/single-use/i);
  });
});
