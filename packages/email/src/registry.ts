import type { ComponentType } from 'react';

import { AccountDeletedEmail } from './templates/account-deleted.js';
import { CollaboratorInviteEmail } from './templates/collaborator-invite.js';
import { EventApprovedEmail } from './templates/event-approved.js';
import { EventRejectedEmail } from './templates/event-rejected.js';
import { NotificationEmail } from './templates/notification.js';
import { PasswordResetEmail } from './templates/password-reset.js';
import { PaymentConfirmationEmail } from './templates/payment-confirmation.js';
import { VenueActivationEmail } from './templates/venue-activation.js';
import { VerificationEmail } from './templates/verification.js';
import { WelcomeEmail } from './templates/welcome.js';
import type { EmailTemplate, EmailTemplateMap } from './types.js';

/**
 * Single source of truth mapping each transactional template key to its React
 * Email component. The mapped-type constraint forces exhaustiveness: adding a
 * new entry to `EmailTemplateMap` without a matching component here is a
 * compile-time error, and the component's props must match the template's
 * declared data shape.
 */
export type TemplateRegistry = {
  [K in EmailTemplate]: { component: ComponentType<EmailTemplateMap[K]> };
};

export const registry: TemplateRegistry = {
  verification: { component: VerificationEmail },
  'password-reset': { component: PasswordResetEmail },
  'venue-activation': { component: VenueActivationEmail },
  'payment-confirmation': { component: PaymentConfirmationEmail },
  'event-approved': { component: EventApprovedEmail },
  'event-rejected': { component: EventRejectedEmail },
  notification: { component: NotificationEmail },
  welcome: { component: WelcomeEmail },
  'collaborator-invite': { component: CollaboratorInviteEmail },
  'account-deleted': { component: AccountDeletedEmail },
};
