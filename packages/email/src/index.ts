export { sendEmail } from './send.js';
export { getTransport } from './client.js';

// Per-template senders — one file per business-level dispatch.
export { sendVerificationEmail } from './senders/verification.js';
export { sendPasswordResetEmail } from './senders/password-reset.js';
export { sendVenueActivationEmail } from './senders/venue-activation.js';
export { sendPaymentConfirmationEmail } from './senders/payment-confirmation.js';
export { sendEventApprovedEmail } from './senders/event-approved.js';
export { sendEventRejectedEmail } from './senders/event-rejected.js';
export { sendNotificationEmail } from './senders/notification.js';

export type { EmailTransport } from './client.js';
export type { EmailTemplate, EmailTemplateMap, SendEmailOptions } from './types.js';
