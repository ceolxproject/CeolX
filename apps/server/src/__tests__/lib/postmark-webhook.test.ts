import { describe, expect, it } from 'vitest';

import { parsePostmarkEvent } from '../../lib/postmark-webhook.js';

describe('parsePostmarkEvent', () => {
  it('normalises a HardBounce payload', () => {
    const event = parsePostmarkEvent({
      RecordType: 'Bounce',
      Type: 'HardBounce',
      TypeCode: 1,
      Email: 'bounced@example.com',
      MessageID: 'msg-abc',
      Details: 'The server could not deliver your mail',
    });

    expect(event).toEqual({
      kind: 'bounce',
      email: 'bounced@example.com',
      messageId: 'msg-abc',
      bounceType: 'HardBounce',
      details: 'The server could not deliver your mail',
    });
  });

  it('normalises a SpamComplaint payload', () => {
    const event = parsePostmarkEvent({
      RecordType: 'SpamComplaint',
      Email: 'angry@example.com',
      MessageID: 'msg-xyz',
    });

    expect(event.kind).toBe('spam-complaint');
    expect(event.email).toBe('angry@example.com');
    expect(event.messageId).toBe('msg-xyz');
  });

  it('treats unknown RecordType as "unknown"', () => {
    const event = parsePostmarkEvent({
      RecordType: 'Delivery',
      Email: 'ok@example.com',
      MessageID: 'msg-1',
    });
    expect(event.kind).toBe('unknown');
  });

  it('tolerates a completely missing RecordType', () => {
    const event = parsePostmarkEvent({ Email: 'x@y.com' });
    expect(event.kind).toBe('unknown');
    expect(event.email).toBe('x@y.com');
    expect(event.messageId).toBe('');
  });

  it('omits bounceType + details when not provided', () => {
    const event = parsePostmarkEvent({
      RecordType: 'SpamComplaint',
      Email: 'x@y.com',
      MessageID: 'msg-1',
    });
    expect(event).not.toHaveProperty('bounceType');
    expect(event).not.toHaveProperty('details');
  });
});
