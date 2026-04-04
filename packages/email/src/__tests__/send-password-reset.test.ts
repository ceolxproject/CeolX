import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendPasswordResetEmail } from '../send-password-reset.js';
import { sendEmail } from '../send.js';

vi.mock('../send.js', () => ({
  sendEmail: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sendEmail).mockResolvedValue(undefined);
});

describe('sendPasswordResetEmail', () => {
  const testEmail = 'user@example.com';
  const testDeepLink = 'ceolx://reset-password?token=abc-123';

  it('calls sendEmail with the password-reset template', async () => {
    await sendPasswordResetEmail(testEmail, testDeepLink);
    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(call?.template).toBe('password-reset');
  });

  it('sends to the provided email address', async () => {
    await sendPasswordResetEmail(testEmail, testDeepLink);
    const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(call?.to).toBe(testEmail);
  });

  it('passes the reset URL in the template data', async () => {
    await sendPasswordResetEmail(testEmail, testDeepLink);
    const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(call?.data).toMatchObject({ resetUrl: testDeepLink });
  });

  it('uses empty string for userName when not provided', async () => {
    await sendPasswordResetEmail(testEmail, testDeepLink);
    const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(call?.data).toMatchObject({ userName: '' });
  });

  it('passes userName when provided', async () => {
    await sendPasswordResetEmail(testEmail, testDeepLink, 'Aoife');
    const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(call?.data).toMatchObject({ userName: 'Aoife' });
  });

  it('re-throws if sendEmail fails', async () => {
    const err = new Error('Postmark error');
    vi.mocked(sendEmail).mockRejectedValue(err);
    await expect(sendPasswordResetEmail(testEmail, testDeepLink)).rejects.toThrow('Postmark error');
  });
});
