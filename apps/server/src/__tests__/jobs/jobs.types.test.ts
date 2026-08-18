import { describe, expect, it } from 'vitest';

import { jobPayloadSchemas } from '../../jobs/types.js';

describe('jobPayloadSchemas', () => {
  // ---------------------------------------------------------------------------
  // email.send
  // ---------------------------------------------------------------------------
  describe('email.send', () => {
    it('accepts a valid payload', () => {
      expect(() =>
        jobPayloadSchemas['email.send'].parse({
          to: 'user@example.com',
          // 'venue-activation' is deliberately not queueable — queuing it would put
          // a live activation token in Upstash's message store (M8-T1).
          template: 'payment-confirmation',
        })
      ).not.toThrow();
    });

    it('defaults locale to en when omitted', () => {
      const result = jobPayloadSchemas['email.send'].parse({
        to: 'user@example.com',
        template: 'verification',
      });
      expect(result.locale).toBe('en');
    });

    it('accepts optional data record', () => {
      expect(() =>
        jobPayloadSchemas['email.send'].parse({
          to: 'user@example.com',
          template: 'event-approved',
          data: { eventTitle: 'Session at The Crane Bar' },
        })
      ).not.toThrow();
    });

    it('rejects an invalid email address', () => {
      const result = jobPayloadSchemas['email.send'].safeParse({
        to: 'not-an-email',
        template: 'verification',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an unknown template', () => {
      const result = jobPayloadSchemas['email.send'].safeParse({
        to: 'user@example.com',
        template: 'unknown-template',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a missing to field', () => {
      const result = jobPayloadSchemas['email.send'].safeParse({
        template: 'password-reset',
      });
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // account.anonymize
  // ---------------------------------------------------------------------------
  describe('account.anonymize', () => {
    it('accepts a valid payload', () => {
      expect(() =>
        jobPayloadSchemas['account.anonymize'].parse({
          userId: '550e8400-e29b-41d4-a716-446655440000',
          requestedAt: '2026-03-30T00:00:00.000Z',
        })
      ).not.toThrow();
    });

    it('rejects a non-uuid userId', () => {
      const result = jobPayloadSchemas['account.anonymize'].safeParse({
        userId: 'not-a-uuid',
        requestedAt: '2026-03-30T00:00:00.000Z',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a non-datetime requestedAt', () => {
      const result = jobPayloadSchemas['account.anonymize'].safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        requestedAt: '30-03-2026',
      });
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // account.cleanup
  // ---------------------------------------------------------------------------
  describe('account.cleanup', () => {
    it('accepts a valid payload', () => {
      expect(() =>
        jobPayloadSchemas['account.cleanup'].parse({
          userId: '550e8400-e29b-41d4-a716-446655440000',
        })
      ).not.toThrow();
    });

    it('rejects a non-uuid userId', () => {
      const result = jobPayloadSchemas['account.cleanup'].safeParse({ userId: 'bad' });
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // account.flag-inactive
  // ---------------------------------------------------------------------------
  describe('account.flag-inactive', () => {
    it('accepts an empty payload', () => {
      expect(() => jobPayloadSchemas['account.flag-inactive'].parse({})).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // ip.anonymize
  // ---------------------------------------------------------------------------
  describe('ip.anonymize', () => {
    it('defaults olderThanDays to 30 when omitted', () => {
      const result = jobPayloadSchemas['ip.anonymize'].parse({});
      expect(result.olderThanDays).toBe(30);
    });

    it('accepts a custom olderThanDays value', () => {
      const result = jobPayloadSchemas['ip.anonymize'].parse({ olderThanDays: 60 });
      expect(result.olderThanDays).toBe(60);
    });

    it('rejects a non-positive olderThanDays', () => {
      const result = jobPayloadSchemas['ip.anonymize'].safeParse({ olderThanDays: 0 });
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // notification.push
  // ---------------------------------------------------------------------------
  describe('notification.push', () => {
    it('accepts a valid per-user payload', () => {
      expect(() =>
        jobPayloadSchemas['notification.push'].parse({
          userId: 'user-123',
          title: 'Event Approved',
          body: 'Your event is now live.',
          persona: 'artist',
          route: '/events/123',
        })
      ).not.toThrow();
    });

    it('rejects an unknown persona', () => {
      const result = jobPayloadSchemas['notification.push'].safeParse({
        userId: 'user-123',
        title: 'Hi',
        body: 'Hello',
        persona: 'admin',
        route: '/home',
      });
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // notification.batch
  // ---------------------------------------------------------------------------
  describe('notification.batch', () => {
    it('accepts an empty payload', () => {
      expect(() => jobPayloadSchemas['notification.batch'].parse({})).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // venue.subscription-retry
  // ---------------------------------------------------------------------------
  // Rewritten in M8-T6. 'venue.subscription-retry' was deleted: it was never
  // implemented, and the webhook's re-fetch approach removed the need for it
  // entirely. These are the two jobs that replaced it.
  describe('subscription.activation-reminder', () => {
    it('accepts a valid payload', () => {
      expect(() =>
        jobPayloadSchemas['subscription.activation-reminder'].parse({
          userId: 'user_abc',
          attempt: 2,
        })
      ).not.toThrow();
    });

    it('rejects an attempt outside 1-3', () => {
      expect(() =>
        jobPayloadSchemas['subscription.activation-reminder'].parse({
          userId: 'user_abc',
          attempt: 4,
        })
      ).toThrow();
    });

    it('carries no token or URL — a queued credential would sit in Upstash', () => {
      const parsed = jobPayloadSchemas['subscription.activation-reminder'].parse({
        userId: 'user_abc',
        attempt: 1,
        token: 'should-be-stripped',
        monthlyUrl: 'https://example.com',
      });
      expect(parsed).toEqual({ userId: 'user_abc', attempt: 1 });
    });
  });

  describe('subscription.trial-ending', () => {
    it('accepts a valid payload', () => {
      expect(() =>
        jobPayloadSchemas['subscription.trial-ending'].parse({
          venueId: '550e8400-e29b-41d4-a716-446655440000',
        })
      ).not.toThrow();
    });

    it('rejects a non-uuid venueId', () => {
      expect(() =>
        jobPayloadSchemas['subscription.trial-ending'].parse({ venueId: 'nope' })
      ).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // data-export.process
  // ---------------------------------------------------------------------------
  describe('data-export.process', () => {
    it('accepts a valid payload', () => {
      expect(() =>
        jobPayloadSchemas['data-export.process'].parse({
          userId: '550e8400-e29b-41d4-a716-446655440000',
          requestId: '660e8400-e29b-41d4-a716-446655440001',
        })
      ).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // data-export.notify
  // ---------------------------------------------------------------------------
  describe('data-export.notify', () => {
    it('accepts a valid payload', () => {
      expect(() =>
        jobPayloadSchemas['data-export.notify'].parse({
          userId: '550e8400-e29b-41d4-a716-446655440000',
          downloadUrl: 'https://cdn.ceolx.com/exports/file.json',
          expiresAt: '2026-04-30T00:00:00.000Z',
        })
      ).not.toThrow();
    });

    it('rejects a non-url downloadUrl', () => {
      const result = jobPayloadSchemas['data-export.notify'].safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        downloadUrl: 'not-a-url',
        expiresAt: '2026-04-30T00:00:00.000Z',
      });
      expect(result.success).toBe(false);
    });
  });
});
