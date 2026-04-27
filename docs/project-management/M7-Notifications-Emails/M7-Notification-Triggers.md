# CeolX · Notification Trigger Registry (TypeScript reference)

Generated from `M7-T0-Notifications-Matrix.xlsx`. One entry per matrix row, grouped by persona.

**Legend**

- `push` / `inApp` / `email` is `null` when the channel is intentionally not sent for that trigger (— in the matrix).
- Entries marked `// ⏳ V2` are deferred — the registry holds copy for completeness, but the dispatcher should skip them in V1.
- All `{placeholder}` tokens are template variables resolved at send time.
- `routeTemplate: null` means there's no deep link (e.g. GDPR account-deletion email).

---

## Shared types

```typescript
export type NotificationPersona = 'spectator' | 'artist' | 'venue' | 'super_admin' | 'any';

export interface PushPayload {
  title: string;
  body: string;
}

export interface InAppPayload {
  title: string;
  body: string;
}

export interface EmailPayload {
  subject: string;
  body: string;
}

export interface NotificationDefinition {
  matrixRef: string; // e.g. 'A-09'
  type: string; // semantic category
  persona: NotificationPersona;
  routeTemplate: string | null; // deep-link with {param} placeholders
  push: PushPayload | null;
  inApp: InAppPayload | null;
  email: EmailPayload | null;
}
```

## NotificationTrigger enum

```typescript
export enum NotificationTrigger {
  // --- Spectator ---
  EMAIL_VERIFICATION_SPECTATOR = 'EMAIL_VERIFICATION_SPECTATOR', // S-01 — Sign-up — email verification
  PASSWORD_RESET_SPECTATOR = 'PASSWORD_RESET_SPECTATOR', // S-02 — Password reset requested
  FOLLOWED_ARTIST_NEW_EVENT = 'FOLLOWED_ARTIST_NEW_EVENT', // S-03 — New event posted by a followed Artist
  FOLLOWED_VENUE_NEW_EVENT = 'FOLLOWED_VENUE_NEW_EVENT', // S-04 — New event posted by a followed Venue
  FOLLOWED_NEW_POST = 'FOLLOWED_NEW_POST', // S-05 — New post from a followed Artist / Venue (feed update)
  ACCOUNT_DELETED_SPECTATOR = 'ACCOUNT_DELETED_SPECTATOR', // S-06 — GDPR — account deletion complete
  DATA_EXPORT_READY_SPECTATOR = 'DATA_EXPORT_READY_SPECTATOR', // S-07 — GDPR — data export ready for download
  INACTIVE_ACCOUNT_WARNING_SPECTATOR = 'INACTIVE_ACCOUNT_WARNING_SPECTATOR', // S-08 — Inactive account warning (24-month dormancy)
  // --- Artist ---
  EMAIL_VERIFICATION_ARTIST = 'EMAIL_VERIFICATION_ARTIST', // A-01 — Sign-up — email verification
  PASSWORD_RESET_ARTIST = 'PASSWORD_RESET_ARTIST', // A-02 — Password reset
  ARTIST_PERSONA_ACTIVATION = 'ARTIST_PERSONA_ACTIVATION', // A-03 — Artist persona selected — activation email (Stripe link)
  ARTIST_PERSONA_ACTIVATION_RESENT = 'ARTIST_PERSONA_ACTIVATION_RESENT', // A-04 — Activation email resent (from in-app pending screen)
  ARTIST_SUBSCRIPTION_ACTIVATED = 'ARTIST_SUBSCRIPTION_ACTIVATED', // A-05 — Subscription activated (first successful payment)
  ARTIST_SUBSCRIPTION_RENEWED = 'ARTIST_SUBSCRIPTION_RENEWED', // A-06 — Subscription renewed (recurring invoice.payment_succeeded)
  ARTIST_PAYMENT_FAILED = 'ARTIST_PAYMENT_FAILED', // A-07 — Payment failed (past_due)
  ARTIST_SUBSCRIPTION_CANCELLED = 'ARTIST_SUBSCRIPTION_CANCELLED', // A-08 — Subscription cancelled (customer.subscription.deleted)
  BOOKING_INVITE_TO_ARTIST = 'BOOKING_INVITE_TO_ARTIST', // A-09 — Booking invitation received — Venue invited Artist to an event
  BOOKING_ACCEPTED_TO_ARTIST = 'BOOKING_ACCEPTED_TO_ARTIST', // A-10 — Booking accepted — Venue accepted Artist's application
  BOOKING_REJECTED_TO_ARTIST = 'BOOKING_REJECTED_TO_ARTIST', // A-11 — Booking rejected — Venue declined Artist's application
  BOOKING_CANCELLED_TO_ARTIST = 'BOOKING_CANCELLED_TO_ARTIST', // A-12 — Booking cancelled — counter-party cancelled an accepted booking
  COLLABORATOR_ADDED_ARTIST = 'COLLABORATOR_ADDED_ARTIST', // A-13 — Added as confirmed Collaborator on a Venue's event
  COLLABORATOR_INVITE_OUTSIDE_PLATFORM = 'COLLABORATOR_INVITE_OUTSIDE_PLATFORM', // A-14 — Invited as outside-platform collaborator (no account)
  EVENT_REMOVED_BY_ADMIN_ARTIST = 'EVENT_REMOVED_BY_ADMIN_ARTIST', // A-15 — Event removed by admin (Artist is creator) — with reason
  EVENT_RESUBMITTED_ARTIST = 'EVENT_RESUBMITTED_ARTIST', // A-16 — Event resubmitted successfully
  ARTIST_NEW_FOLLOWER = 'ARTIST_NEW_FOLLOWER', // A-17 — New follower on Artist profile
  ACCOUNT_DELETED_ARTIST = 'ACCOUNT_DELETED_ARTIST', // A-18 — GDPR — account deletion complete
  DATA_EXPORT_READY_ARTIST = 'DATA_EXPORT_READY_ARTIST', // A-19 — GDPR — data export ready
  // --- Venue ---
  EMAIL_VERIFICATION_VENUE = 'EMAIL_VERIFICATION_VENUE', // V-01 — Sign-up — email verification
  PASSWORD_RESET_VENUE = 'PASSWORD_RESET_VENUE', // V-02 — Password reset
  VENUE_PERSONA_ACTIVATION = 'VENUE_PERSONA_ACTIVATION', // V-03 — Venue persona selected — activation email (Stripe link)
  VENUE_PERSONA_ACTIVATION_RESENT = 'VENUE_PERSONA_ACTIVATION_RESENT', // V-04 — Activation email resent (from in-app pending screen)
  VENUE_SUBSCRIPTION_ACTIVATED = 'VENUE_SUBSCRIPTION_ACTIVATED', // V-05 — Subscription activated (first successful payment)
  VENUE_SUBSCRIPTION_RENEWED = 'VENUE_SUBSCRIPTION_RENEWED', // V-06 — Subscription renewed (recurring payment)
  VENUE_PAYMENT_FAILED = 'VENUE_PAYMENT_FAILED', // V-07 — Payment failed (past_due)
  VENUE_SUBSCRIPTION_CANCELLED = 'VENUE_SUBSCRIPTION_CANCELLED', // V-08 — Subscription cancelled
  BOOKING_REQUEST_TO_VENUE = 'BOOKING_REQUEST_TO_VENUE', // V-09 — Booking request received — Artist applied to Venue's event
  BOOKING_ACCEPTED_TO_VENUE = 'BOOKING_ACCEPTED_TO_VENUE', // V-10 — Booking accepted — Artist accepted Venue's invitation
  BOOKING_REJECTED_TO_VENUE = 'BOOKING_REJECTED_TO_VENUE', // V-11 — Booking rejected — Artist declined Venue's invitation
  BOOKING_CANCELLED_TO_VENUE = 'BOOKING_CANCELLED_TO_VENUE', // V-12 — Booking cancelled — counter-party cancelled an accepted booking
  BOOKING_APPLICATION_WITHDRAWN_TO_VENUE = 'BOOKING_APPLICATION_WITHDRAWN_TO_VENUE', // V-13 — Pending Artist cancelled their application before Venue responded
  EVENT_REMOVED_BY_ADMIN_VENUE = 'EVENT_REMOVED_BY_ADMIN_VENUE', // V-14 — Event removed by admin (Venue is creator) — with reason
  EVENT_RESUBMITTED_VENUE = 'EVENT_RESUBMITTED_VENUE', // V-15 — Event resubmitted successfully
  VENUE_NEW_FOLLOWER = 'VENUE_NEW_FOLLOWER', // V-16 — New follower on Venue profile
  ACCOUNT_DELETED_VENUE = 'ACCOUNT_DELETED_VENUE', // V-17 — GDPR — account deletion complete
  DATA_EXPORT_READY_VENUE = 'DATA_EXPORT_READY_VENUE', // V-18 — GDPR — data export ready
  // --- Super Admin ---
  ADMIN_PASSWORD_RESET = 'ADMIN_PASSWORD_RESET', // X-01 — Admin password reset
  ADMIN_NEW_EVENT_FOR_REVIEW = 'ADMIN_NEW_EVENT_FOR_REVIEW', // X-02 — New event created (feeds Content Review dashboard)
  // --- Universal ---
  SAVED_EVENT_REMINDER_2D = 'SAVED_EVENT_REMINDER_2D', // U-01 — Saved event reminder — 2 days before start (Universal)
  SAVED_EVENT_REMINDER_1D = 'SAVED_EVENT_REMINDER_1D', // U-02 — Saved event reminder — 1 day before start (Universal)
  SAVED_EVENT_REMOVED = 'SAVED_EVENT_REMOVED', // U-03 — Saved event removed by admin (Universal)
  SAVED_EVENT_UPDATED = 'SAVED_EVENT_UPDATED', // U-04 — Saved event details changed by creator (Universal)
}
```

## Registry

```typescript
export const NOTIFICATION_REGISTRY: Record<NotificationTrigger, NotificationDefinition> = {
  // ============================================================
  // Spectator
  // ============================================================
  [NotificationTrigger.EMAIL_VERIFICATION_SPECTATOR]: {
    matrixRef: 'S-01',
    type: 'email_verification',
    persona: 'spectator',
    routeTemplate: '/verify-email?token={token}',
    push: null,
    inApp: null,
    email: {
      subject: 'Confirm your email for CeolX',
      body: "Hi {firstName},\n\nTap the button below to verify your email and finish setting up your CeolX account. This link expires in 24 hours.\n\n[Verify my email]\n\nIf you didn't sign up for CeolX, you can safely ignore this email.",
    },
  },
  [NotificationTrigger.PASSWORD_RESET_SPECTATOR]: {
    matrixRef: 'S-02',
    type: 'password_reset',
    persona: 'spectator',
    routeTemplate: '/reset-password?token={token}',
    push: null,
    inApp: null,
    email: {
      subject: 'Reset your CeolX password',
      body: "Hi {firstName},\n\nWe got a request to reset the password for your CeolX account. Tap below to choose a new one. The link expires in 1 hour.\n\n[Reset my password]\n\nIf you didn't request this, you can ignore the email — your password won't change.",
    },
  },
  // ⏳ V2 — schema entry only, not dispatched in V1
  [NotificationTrigger.FOLLOWED_ARTIST_NEW_EVENT]: {
    matrixRef: 'S-03',
    type: 'new_event_from_followed',
    persona: 'spectator',
    routeTemplate: '/events/{eventId}',
    push: {
      title: 'New from {artistName}',
      body: '{artistName} just posted "{eventTitle}" — tap to see the gig.',
    },
    inApp: {
      title: 'New event from {artistName}',
      body: '{artistName} posted a new event: "{eventTitle}" on {date} at {venue}.',
    },
    email: null,
  },
  // ⏳ V2 — schema entry only, not dispatched in V1
  [NotificationTrigger.FOLLOWED_VENUE_NEW_EVENT]: {
    matrixRef: 'S-04',
    type: 'new_event_from_followed',
    persona: 'spectator',
    routeTemplate: '/events/{eventId}',
    push: {
      title: 'New at {venueName}',
      body: '{venueName} just posted "{eventTitle}" — tap for details.',
    },
    inApp: {
      title: 'New event at {venueName}',
      body: '{venueName} posted a new event: "{eventTitle}" on {date}.',
    },
    email: null,
  },
  // ⏳ V2 — schema entry only, not dispatched in V1
  [NotificationTrigger.FOLLOWED_NEW_POST]: {
    matrixRef: 'S-05',
    type: 'new_post_from_followed',
    persona: 'spectator',
    routeTemplate: '/posts/{postId}',
    push: {
      title: '{authorName} posted',
      body: '{authorName}: "{postExcerpt}"',
    },
    inApp: {
      title: '{authorName} shared an update',
      body: '{postExcerpt}',
    },
    email: null,
  },
  [NotificationTrigger.ACCOUNT_DELETED_SPECTATOR]: {
    matrixRef: 'S-06',
    type: 'account_deleted',
    persona: 'spectator',
    routeTemplate: null,
    push: null,
    inApp: null,
    email: {
      subject: 'Your CeolX account has been deleted',
      body: "Hi {firstName},\n\nYour CeolX account and associated personal data have been permanently deleted on {deletedAt}. We're sorry to see you go.\n\nIf this wasn't you, please contact support@ceolx.ie immediately.",
    },
  },
  [NotificationTrigger.DATA_EXPORT_READY_SPECTATOR]: {
    matrixRef: 'S-07',
    type: 'data_export_ready',
    persona: 'spectator',
    routeTemplate: 'ceolx.ie/export/{token}',
    push: null,
    inApp: null,
    email: {
      subject: 'Your CeolX data export is ready',
      body: 'Hi {firstName},\n\nYour data export is ready. Tap the link below to download a ZIP of your CeolX data. The link expires in 7 days.\n\n[Download my data]\n\nAfter that it will be deleted from our servers.',
    },
  },
  [NotificationTrigger.INACTIVE_ACCOUNT_WARNING_SPECTATOR]: {
    matrixRef: 'S-08',
    type: 'inactive_account_warning',
    persona: 'spectator',
    routeTemplate: null,
    push: null,
    inApp: null,
    email: {
      subject: 'We miss you at CeolX',
      body: "Hi {firstName},\n\nYou haven't signed in to CeolX for 24 months. To keep your account active, sign in within the next 30 days. Otherwise we'll delete it automatically, in line with our retention policy.\n\n[Sign in to CeolX]",
    },
  },

  // ============================================================
  // Artist
  // ============================================================
  [NotificationTrigger.EMAIL_VERIFICATION_ARTIST]: {
    matrixRef: 'A-01',
    type: 'email_verification',
    persona: 'artist',
    routeTemplate: '/verify-email?token={token}',
    push: null,
    inApp: null,
    email: {
      subject: 'Confirm your email for CeolX',
      body: 'Hi {firstName},\n\nWelcome to CeolX. Tap below to verify your email and start setting up your artist profile. Link expires in 24 hours.\n\n[Verify my email]',
    },
  },
  [NotificationTrigger.PASSWORD_RESET_ARTIST]: {
    matrixRef: 'A-02',
    type: 'password_reset',
    persona: 'artist',
    routeTemplate: '/reset-password?token={token}',
    push: null,
    inApp: null,
    email: {
      subject: 'Reset your CeolX password',
      body: 'Hi {firstName},\n\nWe received a password reset request. Tap below to choose a new password. This link expires in 1 hour.\n\n[Reset my password]',
    },
  },
  [NotificationTrigger.ARTIST_PERSONA_ACTIVATION]: {
    matrixRef: 'A-03',
    type: 'subscription_activation',
    persona: 'artist',
    routeTemplate: 'ceolx.ie/subscribe',
    push: null,
    inApp: null,
    email: {
      subject: 'Activate your CeolX Artist subscription',
      body: 'Hi {firstName},\n\nTo finish activating your artist profile, complete your subscription on Stripe. Plan: {planName} — {planPrice}/mo.\n\n[Activate my subscription]\n\nYou can preview the app in read-only mode until your payment is confirmed.',
    },
  },
  [NotificationTrigger.ARTIST_PERSONA_ACTIVATION_RESENT]: {
    matrixRef: 'A-04',
    type: 'subscription_activation_resent',
    persona: 'artist',
    routeTemplate: 'ceolx.ie/subscribe',
    push: null,
    inApp: null,
    email: {
      subject: "Here's your Artist activation link again",
      body: 'Hi {firstName},\n\nYou asked us to resend your activation link. Tap below to complete your subscription.\n\n[Activate my subscription]',
    },
  },
  [NotificationTrigger.ARTIST_SUBSCRIPTION_ACTIVATED]: {
    matrixRef: 'A-05',
    type: 'subscription_activated',
    persona: 'artist',
    routeTemplate: '/profile',
    push: {
      title: 'Subscription Active ✓',
      body: 'Your Artist subscription is live. Start posting events and accepting bookings.',
    },
    inApp: {
      title: 'Subscription Active ✓',
      body: 'Welcome to Artist on CeolX. Your subscription is active — go live on your profile.',
    },
    email: {
      subject: "You're live on CeolX Artist ✓",
      body: 'Hi {firstName},\n\nYour Artist subscription is active. You can now post events, accept bookings, and grow your audience.\n\nReceipt: {invoiceNumber} — {amount}\n\n[Go to my profile]',
    },
  },
  [NotificationTrigger.ARTIST_SUBSCRIPTION_RENEWED]: {
    matrixRef: 'A-06',
    type: 'subscription_renewed',
    persona: 'artist',
    routeTemplate: '/profile',
    push: {
      title: 'Payment Received ✓',
      body: 'Your Artist subscription renewed for another month. Thanks for staying with CeolX.',
    },
    inApp: {
      title: 'Payment Received ✓',
      body: 'Your Artist subscription renewed — next renewal {nextRenewalDate}.',
    },
    email: {
      subject: 'CeolX Artist — payment received',
      body: 'Hi {firstName},\n\nWe received your monthly payment of {amount} for CeolX Artist.\n\nReceipt: {invoiceNumber}\nNext renewal: {nextRenewalDate}\n\n[View receipt]',
    },
  },
  [NotificationTrigger.ARTIST_PAYMENT_FAILED]: {
    matrixRef: 'A-07',
    type: 'payment_failed',
    persona: 'artist',
    routeTemplate: 'ceolx.ie/account',
    push: null,
    inApp: null,
    email: {
      subject: "We couldn't process your CeolX Artist payment",
      body: "Hi {firstName},\n\nWe weren't able to charge your payment method for your Artist subscription. We'll retry automatically, but please update your card to keep access to bookings and events.\n\n[Update payment method]\n\nIf this isn't resolved within 7 days, your subscription will move to past_due and then be cancelled.",
    },
  },
  [NotificationTrigger.ARTIST_SUBSCRIPTION_CANCELLED]: {
    matrixRef: 'A-08',
    type: 'subscription_cancelled',
    persona: 'artist',
    routeTemplate: 'ceolx.ie/account',
    push: null,
    inApp: null,
    email: {
      subject: 'Your CeolX Artist subscription has been cancelled',
      body: "Hi {firstName},\n\nYour Artist subscription is cancelled, effective {endDate}. Your profile will return to read-only on that date.\n\nWe'd love to have you back any time — just re-subscribe.\n\n[Reactivate Artist]",
    },
  },
  [NotificationTrigger.BOOKING_INVITE_TO_ARTIST]: {
    matrixRef: 'A-09',
    type: 'booking_invitation',
    persona: 'artist',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'New booking invite',
      body: '{venueName} invited you to play "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'New booking invite',
      body: '{venueName} invited you to play "{eventTitle}" on {date}. Respond before it expires.',
    },
    email: {
      subject: 'You\'ve been invited to play "{eventTitle}"',
      body: 'Hi {firstName},\n\n{venueName} invited you to perform at "{eventTitle}" on {date}.\n\nFee offered: {fee}\nExpires: {expiresAt}\n\n[View invitation]',
    },
  },
  [NotificationTrigger.BOOKING_ACCEPTED_TO_ARTIST]: {
    matrixRef: 'A-10',
    type: 'booking_accepted',
    persona: 'artist',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'Booking Accepted ✓',
      body: '{venueName} accepted your application for "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Booking Accepted ✓',
      body: 'You\'re confirmed for "{eventTitle}" at {venueName} on {date}.',
    },
    email: {
      subject: 'Booking confirmed — "{eventTitle}" ✓',
      body: 'Hi {firstName},\n\nGood news — {venueName} accepted your application for "{eventTitle}" on {date}.\n\n[View booking]',
    },
  },
  [NotificationTrigger.BOOKING_REJECTED_TO_ARTIST]: {
    matrixRef: 'A-11',
    type: 'booking_rejected',
    persona: 'artist',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'Booking Not Accepted',
      body: '{venueName} has passed on your application for "{eventTitle}".',
    },
    inApp: {
      title: 'Booking Not Accepted',
      body: '{venueName} has passed on your application for "{eventTitle}" on {date}.',
    },
    email: {
      subject: 'Update on your booking request',
      body: 'Hi {firstName},\n\n{venueName} has decided not to move ahead with your application for "{eventTitle}" on {date}. Keep an eye on the feed — new opportunities land every day.\n\n[Browse events]',
    },
  },
  [NotificationTrigger.BOOKING_CANCELLED_TO_ARTIST]: {
    matrixRef: 'A-12',
    type: 'booking_cancelled',
    persona: 'artist',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'Booking Cancelled',
      body: '{venueName} cancelled "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Booking Cancelled',
      body: '{venueName} cancelled your confirmed booking for "{eventTitle}" on {date}.',
    },
    email: {
      subject: '"{eventTitle}" — booking cancelled',
      body: 'Hi {firstName},\n\n{venueName} has cancelled the confirmed booking for "{eventTitle}" on {date}.\n\nReason (if provided): {reason}\n\n[View details]',
    },
  },
  [NotificationTrigger.COLLABORATOR_ADDED_ARTIST]: {
    matrixRef: 'A-13',
    type: 'collaborator_added',
    persona: 'artist',
    routeTemplate: '/events/{eventId}',
    push: {
      title: 'Added as collaborator',
      body: '{venueName} added you as a collaborator on "{eventTitle}".',
    },
    inApp: {
      title: 'Added as collaborator',
      body: 'You\'re listed as a collaborator on "{eventTitle}" at {venueName} on {date}.',
    },
    email: null,
  },
  [NotificationTrigger.COLLABORATOR_INVITE_OUTSIDE_PLATFORM]: {
    matrixRef: 'A-14',
    type: 'collaborator_invite_external',
    persona: 'artist',
    routeTemplate: 'ceolx.ie/invite/{token}',
    push: null,
    inApp: null,
    email: {
      subject: '{inviterName} added you to "{eventTitle}" on CeolX',
      body: 'Hi,\n\n{inviterName} tagged you as a collaborator on "{eventTitle}" on {date}. Create a free CeolX account to claim the listing and manage your artist profile.\n\n[Join CeolX]\n\nLink expires in 14 days.',
    },
  },
  [NotificationTrigger.EVENT_REMOVED_BY_ADMIN_ARTIST]: {
    matrixRef: 'A-15',
    type: 'event_removed',
    persona: 'artist',
    routeTemplate: '/events/{eventId}',
    push: {
      title: 'Your event needs revision',
      body: 'Moderation removed "{eventTitle}". Reason: {reason}.',
    },
    inApp: {
      title: 'Your event needs revision',
      body: 'We\'ve removed "{eventTitle}" pending edits. Reason: {reason}. Update and resubmit.',
    },
    email: {
      subject: 'Action needed — "{eventTitle}"',
      body: 'Hi {firstName},\n\nOur moderation team removed your event "{eventTitle}" on {date}. Reason:\n\n{reason}\n\nYou can edit and resubmit it from your event page.\n\n[Edit event]',
    },
  },
  [NotificationTrigger.EVENT_RESUBMITTED_ARTIST]: {
    matrixRef: 'A-16',
    type: 'event_resubmitted',
    persona: 'artist',
    routeTemplate: '/events/{eventId}',
    push: {
      title: 'Event Resubmitted ✓',
      body: '"{eventTitle}" is back live after your edits.',
    },
    inApp: {
      title: 'Event Resubmitted ✓',
      body: 'Your updated event "{eventTitle}" is back live on CeolX.',
    },
    email: null,
  },
  // ⏳ V2 — schema entry only, not dispatched in V1
  [NotificationTrigger.ARTIST_NEW_FOLLOWER]: {
    matrixRef: 'A-17',
    type: 'new_follower',
    persona: 'artist',
    routeTemplate: '/profile/followers',
    push: {
      title: 'New follower',
      body: '{followerName} started following you on CeolX.',
    },
    inApp: {
      title: 'New follower',
      body: '{followerName} is now following your artist profile.',
    },
    email: null,
  },
  [NotificationTrigger.ACCOUNT_DELETED_ARTIST]: {
    matrixRef: 'A-18',
    type: 'account_deleted',
    persona: 'artist',
    routeTemplate: null,
    push: null,
    inApp: null,
    email: {
      subject: 'Your CeolX account has been deleted',
      body: "Hi {firstName},\n\nYour CeolX Artist account and all associated personal data have been permanently deleted on {deletedAt}. If this wasn't you, contact support@ceolx.ie immediately.",
    },
  },
  [NotificationTrigger.DATA_EXPORT_READY_ARTIST]: {
    matrixRef: 'A-19',
    type: 'data_export_ready',
    persona: 'artist',
    routeTemplate: 'ceolx.ie/export/{token}',
    push: null,
    inApp: null,
    email: {
      subject: 'Your CeolX data export is ready',
      body: 'Hi {firstName},\n\nYour data export is ready. The link below expires in 7 days.\n\n[Download my data]',
    },
  },

  // ============================================================
  // Venue
  // ============================================================
  [NotificationTrigger.EMAIL_VERIFICATION_VENUE]: {
    matrixRef: 'V-01',
    type: 'email_verification',
    persona: 'venue',
    routeTemplate: '/verify-email?token={token}',
    push: null,
    inApp: null,
    email: {
      subject: 'Confirm your email for CeolX',
      body: 'Hi {firstName},\n\nWelcome to CeolX. Verify your email below to set up your venue. Link expires in 24 hours.\n\n[Verify my email]',
    },
  },
  [NotificationTrigger.PASSWORD_RESET_VENUE]: {
    matrixRef: 'V-02',
    type: 'password_reset',
    persona: 'venue',
    routeTemplate: '/reset-password?token={token}',
    push: null,
    inApp: null,
    email: {
      subject: 'Reset your CeolX password',
      body: 'Hi {firstName},\n\nWe received a password reset request. Tap below to choose a new password. Link expires in 1 hour.\n\n[Reset my password]',
    },
  },
  [NotificationTrigger.VENUE_PERSONA_ACTIVATION]: {
    matrixRef: 'V-03',
    type: 'subscription_activation',
    persona: 'venue',
    routeTemplate: 'ceolx.ie/subscribe',
    push: null,
    inApp: null,
    email: {
      subject: 'Activate your CeolX Venue subscription',
      body: 'Hi {firstName},\n\nTo publish events and manage bookings, complete your Venue subscription on Stripe. Plan: {planName} — {planPrice}/mo.\n\n[Activate my subscription]',
    },
  },
  [NotificationTrigger.VENUE_PERSONA_ACTIVATION_RESENT]: {
    matrixRef: 'V-04',
    type: 'subscription_activation_resent',
    persona: 'venue',
    routeTemplate: 'ceolx.ie/subscribe',
    push: null,
    inApp: null,
    email: {
      subject: "Here's your Venue activation link again",
      body: 'Hi {firstName},\n\nYou asked us to resend your Venue activation link. Tap below to finish.\n\n[Activate my subscription]',
    },
  },
  [NotificationTrigger.VENUE_SUBSCRIPTION_ACTIVATED]: {
    matrixRef: 'V-05',
    type: 'subscription_activated',
    persona: 'venue',
    routeTemplate: '/profile',
    push: {
      title: 'Subscription Active ✓',
      body: 'Your Venue subscription is live. Start posting events and booking artists.',
    },
    inApp: {
      title: 'Subscription Active ✓',
      body: 'Welcome to Venue on CeolX. Your subscription is active.',
    },
    email: {
      subject: "You're live on CeolX Venue ✓",
      body: 'Hi {firstName},\n\nYour Venue subscription is active. Post events, invite artists, and start managing your calendar.\n\nReceipt: {invoiceNumber} — {amount}\n\n[Go to my venue profile]',
    },
  },
  [NotificationTrigger.VENUE_SUBSCRIPTION_RENEWED]: {
    matrixRef: 'V-06',
    type: 'subscription_renewed',
    persona: 'venue',
    routeTemplate: '/profile',
    push: {
      title: 'Payment Received ✓',
      body: 'Your Venue subscription renewed for another month.',
    },
    inApp: {
      title: 'Payment Received ✓',
      body: 'Your Venue subscription renewed — next renewal {nextRenewalDate}.',
    },
    email: {
      subject: 'CeolX Venue — payment received',
      body: 'Hi {firstName},\n\nWe received your monthly payment of {amount} for CeolX Venue.\n\nReceipt: {invoiceNumber}\nNext renewal: {nextRenewalDate}\n\n[View receipt]',
    },
  },
  [NotificationTrigger.VENUE_PAYMENT_FAILED]: {
    matrixRef: 'V-07',
    type: 'payment_failed',
    persona: 'venue',
    routeTemplate: 'ceolx.ie/account',
    push: null,
    inApp: null,
    email: {
      subject: "We couldn't process your CeolX Venue payment",
      body: "Hi {firstName},\n\nWe weren't able to charge your payment method. Please update your card to keep your venue active.\n\n[Update payment method]\n\nIf unresolved within 7 days the subscription will be cancelled.",
    },
  },
  [NotificationTrigger.VENUE_SUBSCRIPTION_CANCELLED]: {
    matrixRef: 'V-08',
    type: 'subscription_cancelled',
    persona: 'venue',
    routeTemplate: 'ceolx.ie/account',
    push: null,
    inApp: null,
    email: {
      subject: 'Your CeolX Venue subscription has been cancelled',
      body: 'Hi {firstName},\n\nYour Venue subscription is cancelled, effective {endDate}. Your listings will move to read-only on that date.\n\n[Reactivate Venue]',
    },
  },
  [NotificationTrigger.BOOKING_REQUEST_TO_VENUE]: {
    matrixRef: 'V-09',
    type: 'booking_request',
    persona: 'venue',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'New booking request',
      body: '{artistName} applied for "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'New booking request',
      body: '{artistName} applied for "{eventTitle}" on {date}. Review and respond.',
    },
    email: {
      subject: 'New booking request — "{eventTitle}"',
      body: 'Hi {firstName},\n\n{artistName} applied to play "{eventTitle}" on {date}.\n\n[Review application]',
    },
  },
  [NotificationTrigger.BOOKING_ACCEPTED_TO_VENUE]: {
    matrixRef: 'V-10',
    type: 'booking_accepted',
    persona: 'venue',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'Booking Accepted ✓',
      body: '{artistName} accepted your invite for "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Booking Accepted ✓',
      body: '{artistName} is confirmed for "{eventTitle}" on {date}.',
    },
    email: {
      subject: 'Artist confirmed — "{eventTitle}" ✓',
      body: 'Hi {firstName},\n\n{artistName} accepted your invitation to play "{eventTitle}" on {date}.\n\n[View booking]',
    },
  },
  [NotificationTrigger.BOOKING_REJECTED_TO_VENUE]: {
    matrixRef: 'V-11',
    type: 'booking_rejected',
    persona: 'venue',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'Invitation Declined',
      body: '{artistName} can\'t make "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Invitation Declined',
      body: '{artistName} declined your invitation for "{eventTitle}" on {date}.',
    },
    email: {
      subject: 'Update on your booking invite',
      body: 'Hi {firstName},\n\n{artistName} won\'t be able to play "{eventTitle}" on {date}. Browse other artists to invite.\n\n[Find artists]',
    },
  },
  [NotificationTrigger.BOOKING_CANCELLED_TO_VENUE]: {
    matrixRef: 'V-12',
    type: 'booking_cancelled',
    persona: 'venue',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'Booking Cancelled',
      body: '{artistName} cancelled "{eventTitle}" on {date}.',
    },
    inApp: {
      title: 'Booking Cancelled',
      body: '{artistName} cancelled the confirmed booking for "{eventTitle}" on {date}.',
    },
    email: {
      subject: '"{eventTitle}" — booking cancelled',
      body: 'Hi {firstName},\n\n{artistName} has cancelled the confirmed booking for "{eventTitle}" on {date}.\n\nReason (if provided): {reason}\n\n[View details]',
    },
  },
  [NotificationTrigger.BOOKING_APPLICATION_WITHDRAWN_TO_VENUE]: {
    matrixRef: 'V-13',
    type: 'booking_application_withdrawn',
    persona: 'venue',
    routeTemplate: '/bookings/{bookingId}',
    push: {
      title: 'Application Withdrawn',
      body: '{artistName} withdrew their application for "{eventTitle}".',
    },
    inApp: {
      title: 'Application Withdrawn',
      body: '{artistName} withdrew their application for "{eventTitle}" on {date}.',
    },
    email: {
      subject: 'Application withdrawn — "{eventTitle}"',
      body: 'Hi {firstName},\n\n{artistName} withdrew their application for "{eventTitle}" on {date} before you responded. The slot is open again.\n\n[Review applicants]',
    },
  },
  [NotificationTrigger.EVENT_REMOVED_BY_ADMIN_VENUE]: {
    matrixRef: 'V-14',
    type: 'event_removed',
    persona: 'venue',
    routeTemplate: '/events/{eventId}',
    push: {
      title: 'Your event needs revision',
      body: 'Moderation removed "{eventTitle}". Reason: {reason}.',
    },
    inApp: {
      title: 'Your event needs revision',
      body: 'We\'ve removed "{eventTitle}" pending edits. Reason: {reason}.',
    },
    email: {
      subject: 'Action needed — "{eventTitle}"',
      body: 'Hi {firstName},\n\nOur moderation team removed your event "{eventTitle}" on {date}. Reason:\n\n{reason}\n\nYou can edit and resubmit from the event page.\n\n[Edit event]',
    },
  },
  [NotificationTrigger.EVENT_RESUBMITTED_VENUE]: {
    matrixRef: 'V-15',
    type: 'event_resubmitted',
    persona: 'venue',
    routeTemplate: '/events/{eventId}',
    push: {
      title: 'Event Resubmitted ✓',
      body: '"{eventTitle}" is back live after your edits.',
    },
    inApp: {
      title: 'Event Resubmitted ✓',
      body: 'Your updated event "{eventTitle}" is back live on CeolX.',
    },
    email: null,
  },
  // ⏳ V2 — schema entry only, not dispatched in V1
  [NotificationTrigger.VENUE_NEW_FOLLOWER]: {
    matrixRef: 'V-16',
    type: 'new_follower',
    persona: 'venue',
    routeTemplate: '/profile/followers',
    push: {
      title: 'New follower',
      body: '{followerName} started following your venue.',
    },
    inApp: {
      title: 'New follower',
      body: '{followerName} is now following your venue.',
    },
    email: null,
  },
  [NotificationTrigger.ACCOUNT_DELETED_VENUE]: {
    matrixRef: 'V-17',
    type: 'account_deleted',
    persona: 'venue',
    routeTemplate: null,
    push: null,
    inApp: null,
    email: {
      subject: 'Your CeolX account has been deleted',
      body: 'Hi {firstName},\n\nYour CeolX Venue account and all associated personal data have been permanently deleted on {deletedAt}.',
    },
  },
  [NotificationTrigger.DATA_EXPORT_READY_VENUE]: {
    matrixRef: 'V-18',
    type: 'data_export_ready',
    persona: 'venue',
    routeTemplate: 'ceolx.ie/export/{token}',
    push: null,
    inApp: null,
    email: {
      subject: 'Your CeolX data export is ready',
      body: 'Hi {firstName},\n\nYour data export is ready. The link below expires in 7 days.\n\n[Download my data]',
    },
  },

  // ============================================================
  // Super Admin
  // ============================================================
  [NotificationTrigger.ADMIN_PASSWORD_RESET]: {
    matrixRef: 'X-01',
    type: 'password_reset',
    persona: 'super_admin',
    routeTemplate: '/reset-password?token={token}',
    push: null,
    inApp: null,
    email: {
      subject: 'Reset your CeolX Admin password',
      body: "Hi {firstName},\n\nWe received a password reset request for the CeolX admin dashboard. Tap below to choose a new password. Link expires in 30 minutes.\n\n[Reset my password]\n\nIf you didn't request this, contact security@ceolx.ie immediately.",
    },
  },
  [NotificationTrigger.ADMIN_NEW_EVENT_FOR_REVIEW]: {
    matrixRef: 'X-02',
    type: 'event_pending_review',
    persona: 'super_admin',
    routeTemplate: '/admin/events',
    push: null,
    inApp: {
      title: 'New event pending review',
      body: '{creatorName} posted "{eventTitle}" on {date} — review from the queue.',
    },
    email: null,
  },

  // ============================================================
  // Universal
  // ============================================================
  [NotificationTrigger.SAVED_EVENT_REMINDER_2D]: {
    matrixRef: 'U-01',
    type: 'saved_event_reminder',
    persona: 'any',
    routeTemplate: '/events/{eventId}',
    push: {
      title: 'Gig in 2 days',
      body: '"{eventTitle}" at {venue} is in 2 days — tap for details.',
    },
    inApp: {
      title: '2 days until "{eventTitle}"',
      body: '{eventTitle} at {venue} on {date}. Tap to view or unsave.',
    },
    email: null,
  },
  [NotificationTrigger.SAVED_EVENT_REMINDER_1D]: {
    matrixRef: 'U-02',
    type: 'saved_event_reminder',
    persona: 'any',
    routeTemplate: '/events/{eventId}',
    push: {
      title: 'Gig tomorrow',
      body: '"{eventTitle}" at {venue} is tomorrow at {time} — see you there?',
    },
    inApp: {
      title: '"{eventTitle}" is tomorrow',
      body: '{eventTitle} at {venue} on {date} {time}.',
    },
    email: null,
  },
  [NotificationTrigger.SAVED_EVENT_REMOVED]: {
    matrixRef: 'U-03',
    type: 'saved_event_removed',
    persona: 'any',
    routeTemplate: '/events/{eventId}',
    push: {
      title: 'Event removed',
      body: '"{eventTitle}" has been removed. Tap for details.',
    },
    inApp: {
      title: 'Saved event removed',
      body: '"{eventTitle}" was removed by the moderation team. It\'s no longer in your saved list.',
    },
    email: null,
  },
  [NotificationTrigger.SAVED_EVENT_UPDATED]: {
    matrixRef: 'U-04',
    type: 'saved_event_updated',
    persona: 'any',
    routeTemplate: '/events/{eventId}',
    push: {
      title: 'Event updated',
      body: '"{eventTitle}" has a change — {changeSummary}.',
    },
    inApp: {
      title: 'Saved event updated',
      body: '{eventTitle} — {changeSummary}. Tap to view the latest details.',
    },
    email: null,
  },
};
```

---

## Notes for implementers

- All confirmation titles use the trailing `✓` glyph (M7-T1 R6). Keep this exact character — UI copy depends on it for the success badge style.
- Push body is capped at 120 characters (M7-T1 R6). In-app body can be longer because it renders in the Notification Centre row.
- Email bodies are draft prose for Postmark templates. The `body` strings here use `\n` line breaks; rendering should map them to `<br>` in the HTML template or paragraph splits in the plain-text version.
- Persona auto-switch on tap (M7-T1 R4.1) is driven by the `persona` field on the FCM payload. Universal rows use `'any'` — the tap handler should keep the user on their current persona.
- `routeTemplate` placeholders use the `{paramName}` convention. The dispatcher must replace them with concrete values from the trigger context (e.g. `{bookingId}` → the booking's UUID).
