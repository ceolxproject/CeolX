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

  it('calls sendEmail with password-reset tag', async () => {
    await sendPasswordResetEmail(testEmail, testDeepLink);
    expect(sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(call?.tag).toBe('password-reset');
  });

  it('sends to the provided email address', async () => {
    await sendPasswordResetEmail(testEmail, testDeepLink);
    const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(call?.to).toBe(testEmail);
  });

  it('includes the deep link in the html body', async () => {
    await sendPasswordResetEmail(testEmail, testDeepLink);
    const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(call?.htmlBody).toContain(testDeepLink);
  });

  it('includes the deep link in the text body', async () => {
    await sendPasswordResetEmail(testEmail, testDeepLink);
    const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(call?.textBody).toContain(testDeepLink);
  });

  it('uses the correct subject line', async () => {
    await sendPasswordResetEmail(testEmail, testDeepLink);
    const call = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(call?.subject).toBe('Reset your CeolX password');
  });

  it('re-throws if sendEmail fails', async () => {
    const err = new Error('Postmark error');
    vi.mocked(sendEmail).mockRejectedValue(err);
    await expect(sendPasswordResetEmail(testEmail, testDeepLink)).rejects.toThrow('Postmark error');
  });
});
