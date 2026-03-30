// Hoisted mock factories — vi.mock() is lifted by Vitest before any imports.
const mockPublishJSON = vi.fn().mockResolvedValue({ messageId: 'msg_test' });
const mockSchedulesCreate = vi.fn().mockResolvedValue({ scheduleId: 'sched_test' });

vi.mock('@upstash/qstash', () => ({
  Client: vi.fn().mockImplementation(() => ({
    publishJSON: mockPublishJSON,
    schedules: { create: mockSchedulesCreate },
  })),
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { _resetClientForTesting } from '../../jobs/client.js';
import { parseDuration, publishCron, publishJob } from '../../jobs/publish.js';

// ---------------------------------------------------------------------------
// parseDuration
// ---------------------------------------------------------------------------
describe('parseDuration', () => {
  it('converts seconds', () => {
    expect(parseDuration('10s')).toBe(10);
  });

  it('converts minutes', () => {
    expect(parseDuration('5m')).toBe(300);
  });

  it('converts hours', () => {
    expect(parseDuration('1h')).toBe(3600);
  });

  it('converts days', () => {
    expect(parseDuration('30d')).toBe(2592000);
  });

  it('throws on an invalid format', () => {
    expect(() => parseDuration('30days')).toThrow('Invalid duration');
    expect(() => parseDuration('')).toThrow('Invalid duration');
    expect(() => parseDuration('abc')).toThrow('Invalid duration');
  });
});

// ---------------------------------------------------------------------------
// publishJob
// ---------------------------------------------------------------------------
describe('publishJob', () => {
  beforeEach(() => {
    vi.stubEnv('QSTASH_TOKEN', 'test-token');
    vi.stubEnv('QSTASH_BASE_URL', 'https://api.ceolx.ie/api/webhooks/qstash');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    _resetClientForTesting(); // force fresh Client instance on next test
  });

  it('calls publishJSON with the correct url and body', async () => {
    await publishJob('email.send', {
      to: 'user@example.com',
      template: 'email-verification',
      locale: 'en',
    });

    expect(mockPublishJSON).toHaveBeenCalledOnce();
    expect(mockPublishJSON).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://api.ceolx.ie/api/webhooks/qstash' })
    );
  });

  it('applies default retries of 3', async () => {
    await publishJob('notification.batch', {});
    expect(mockPublishJSON).toHaveBeenCalledWith(expect.objectContaining({ retries: 3 }));
  });

  it('converts string delay to seconds and passes to publishJSON', async () => {
    await publishJob(
      'account.anonymize',
      { userId: '550e8400-e29b-41d4-a716-446655440000', requestedAt: new Date().toISOString() },
      { delay: '30d' }
    );
    expect(mockPublishJSON).toHaveBeenCalledWith(expect.objectContaining({ delay: 2592000 }));
  });

  it('throws when QSTASH_BASE_URL is not set', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('QSTASH_TOKEN', 'test-token');
    await expect(publishJob('notification.batch', {})).rejects.toThrow('QSTASH_BASE_URL');
  });
});

// ---------------------------------------------------------------------------
// publishCron
// ---------------------------------------------------------------------------
describe('publishCron', () => {
  beforeEach(() => {
    vi.stubEnv('QSTASH_TOKEN', 'test-token');
    vi.stubEnv('QSTASH_BASE_URL', 'https://api.ceolx.ie/api/webhooks/qstash');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    _resetClientForTesting();
  });

  it('calls schedules.create with the correct cron and destination', async () => {
    await publishCron('notification.batch', '*/5 * * * *');
    expect(mockSchedulesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: 'https://api.ceolx.ie/api/webhooks/qstash',
        cron: '*/5 * * * *',
      })
    );
  });
});
