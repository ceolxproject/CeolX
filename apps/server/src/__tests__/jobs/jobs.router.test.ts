// Hoisted mocks — vi.mock() factories run before imports.
const mockHandleEmailSend = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../jobs/handlers/email.js', () => ({ handleEmailSend: mockHandleEmailSend }));
vi.mock('../../jobs/handlers/account.js', () => ({
  handleAccountAnonymize: vi.fn().mockRejectedValue(new Error('Not implemented')),
  handleAccountCleanup: vi.fn().mockRejectedValue(new Error('Not implemented')),
}));
vi.mock('../../jobs/handlers/notification.js', () => ({
  handleNotificationPush: vi.fn().mockRejectedValue(new Error('Not implemented')),
  handleNotificationBatch: vi.fn().mockRejectedValue(new Error('Not implemented')),
}));
vi.mock('../../jobs/handlers/ip.js', () => ({
  handleIpAnonymize: vi.fn().mockRejectedValue(new Error('Not implemented')),
}));
vi.mock('../../jobs/handlers/venue.js', () => ({
  handleVenueSubscriptionRetry: vi.fn().mockRejectedValue(new Error('Not implemented')),
}));
vi.mock('../../jobs/handlers/dataExport.js', () => ({
  handleDataExportProcess: vi.fn().mockRejectedValue(new Error('Not implemented')),
  handleDataExportNotify: vi.fn().mockRejectedValue(new Error('Not implemented')),
}));

import { afterEach, describe, expect, it, vi } from 'vitest';

import { routeJob } from '../../jobs/handlers/index.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('routeJob', () => {
  it('dispatches email.send to handleEmailSend', async () => {
    const payload = { to: 'a@b.com', template: 'email-verification' };
    await routeJob(JSON.stringify({ type: 'email.send', payload }));
    expect(mockHandleEmailSend).toHaveBeenCalledOnce();
  });

  it('throws on unknown job type', async () => {
    await expect(routeJob(JSON.stringify({ type: 'unknown.job', payload: {} }))).rejects.toThrow(
      'Unknown job type'
    );
  });

  it('throws on invalid JSON', async () => {
    await expect(routeJob('not-json')).rejects.toThrow();
  });

  it('throws on invalid email.send payload (bad email)', async () => {
    await expect(
      routeJob(
        JSON.stringify({
          type: 'email.send',
          payload: { to: 'bad', template: 'email-verification' },
        })
      )
    ).rejects.toThrow();
  });
});
