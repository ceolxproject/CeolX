import type { EmailTemplate, EmailTemplateMap } from './types.js';

/**
 * Subject-line builders, one per template. Static strings are wrapped in a
 * closure so every subject has the same call shape — callers never need to
 * branch on whether a subject is dynamic.
 *
 * Copy is sourced from the M7-T0 Notifications Matrix xlsx (PM draft rev 2,
 * 2026-04-18). Keep these in sync with the matrix rather than with the older
 * M7-T3 task doc, which was superseded by the matrix audit.
 */
type SubjectBuilders = {
  [K in EmailTemplate]: (data: EmailTemplateMap[K]) => string;
};

const builders: SubjectBuilders = {
  verification: () => 'Confirm your email for CeolX',
  'password-reset': () => 'Reset your CeolX password',
  'venue-activation': () => 'Activate your CeolX Venue subscription',
  'payment-confirmation': () => 'CeolX subscription — payment received',
  'event-approved': ({ eventTitle }) => `Your event "${eventTitle}" is live on CeolX`,
  'event-rejected': ({ eventTitle }) => `Action needed — "${eventTitle}"`,
  // Subject is pre-built from the trigger's EMAIL SurfaceCopy upstream.
  notification: ({ subject }) => subject,
  'collaborator-invite': ({ inviterName, eventTitle }) =>
    `${inviterName} added you to "${eventTitle}" on CeolX`,
  'account-deleted': () => 'Your CeolX account has been deleted',
};

export function subjectFor<T extends EmailTemplate>(
  template: T,
  data: EmailTemplateMap[T]
): string {
  return builders[template](data);
}
