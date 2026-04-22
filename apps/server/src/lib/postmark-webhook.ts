/**
 * Parse + log Postmark's inbound bounce / spam-complaint webhook payloads.
 *
 * Postmark automatically suppresses future sends to hard-bounced and
 * spam-complained addresses — we don't need to maintain our own suppression
 * list. This module records the event for observability so ops can see
 * which sends are failing and why. Surfacing bounces in-product
 * (emailBouncedAt flag on `users`) is deferred to a follow-up task.
 *
 * Relevant shapes (subset of Postmark's payload):
 *
 *   Bounce:         { RecordType: "Bounce", Type, TypeCode, Email, MessageID, Details? }
 *   SpamComplaint:  { RecordType: "SpamComplaint", Email, MessageID }
 */

export type PostmarkEventKind = 'bounce' | 'spam-complaint' | 'unknown';

export interface PostmarkEvent {
  kind: PostmarkEventKind;
  email: string;
  messageId: string;
  bounceType?: string; // e.g. "HardBounce", "Transient"
  details?: string;
}

interface PostmarkRawPayload {
  RecordType?: unknown;
  Type?: unknown;
  Email?: unknown;
  MessageID?: unknown;
  Details?: unknown;
  [k: string]: unknown;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function parsePostmarkEvent(payload: PostmarkRawPayload): PostmarkEvent {
  const recordType = str(payload.RecordType).toLowerCase();
  const kind: PostmarkEventKind =
    recordType === 'bounce'
      ? 'bounce'
      : recordType === 'spamcomplaint'
        ? 'spam-complaint'
        : 'unknown';

  return {
    kind,
    email: str(payload.Email),
    messageId: str(payload.MessageID),
    ...(payload.Type ? { bounceType: str(payload.Type) } : {}),
    ...(payload.Details ? { details: str(payload.Details) } : {}),
  };
}

/**
 * Structured log for the parsed event. Kept separate from the parser so
 * tests can assert on parse output independently of the logger.
 */
export function logPostmarkEvent(event: PostmarkEvent): void {
  console.warn('[postmark-webhook]', {
    kind: event.kind,
    email: event.email,
    messageId: event.messageId,
    ...(event.bounceType ? { bounceType: event.bounceType } : {}),
    ...(event.details ? { details: event.details } : {}),
  });
}
