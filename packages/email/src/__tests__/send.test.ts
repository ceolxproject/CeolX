import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTransport } from '../client.js';
import type { EmailTransport } from '../client.js';
import { sendEmail } from '../send.js';

// Mock the client and render modules so transport is injected without network calls
vi.mock('../client.js', () => ({
  getTransport: vi.fn(),
}));

vi.mock('../render.js', () => ({
  renderEmail: vi.fn().mockResolvedValue({
    html: '<p>Verify your account</p>',
    text: 'Verify your account',
    subject: 'Verify your CeolX account',
  }),
}));

const mockSend = vi.fn();
const mockTransport: EmailTransport = { send: mockSend };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTransport).mockReturnValue(mockTransport);
});

describe('sendEmail', () => {
  type SendPayload = Parameters<EmailTransport['send']>[0];
  const baseOptions = {
    to: 'user@example.com',
    template: 'verification' as const,
    data: { userName: 'Priya', verificationUrl: 'ceolx://verify-email?token=abc' },
  };

  it('calls transport.send with correct from, to, subject, html, text', async () => {
    mockSend.mockResolvedValue(undefined);
    await sendEmail(baseOptions);
    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0]?.[0] as SendPayload | undefined;
    expect(call).toBeDefined();
    if (!call) throw new Error('Expected send payload');
    expect(call).toMatchObject({
      to: 'user@example.com',
      subject: 'Verify your CeolX account',
      html: '<p>Verify your account</p>',
      text: 'Verify your account',
    });
    expect(call.from).toContain('CeolX');
    // R1.3 + AC-10: branded sender admin@ceolx.com (not noreply — users may reply).
    expect(call.from).toContain('admin@ceolx.com');
  });

  it('re-throws transport errors after the R8.6 retry also fails', async () => {
    vi.useFakeTimers();
    try {
      const err = new Error('SMTP connection refused');
      mockSend.mockRejectedValue(err);
      const assertion = expect(sendEmail(baseOptions)).rejects.toThrow('SMTP connection refused');
      await vi.runAllTimersAsync();
      await assertion;
      // first attempt + one retry = 2
      expect(mockSend).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not log subject or html on success', async () => {
    mockSend.mockResolvedValue(undefined);
    const consoleSpy = vi.spyOn(console, 'warn');
    await sendEmail(baseOptions);
    const loggedArgs = consoleSpy.mock.calls.flatMap((c) => JSON.stringify(c));
    expect(loggedArgs.join('')).not.toContain('Verify your CeolX account');
    expect(loggedArgs.join('')).not.toContain('<p>Verify your account</p>');
  });

  it('logs template and to on success', async () => {
    mockSend.mockResolvedValue(undefined);
    const consoleSpy = vi.spyOn(console, 'warn');
    await sendEmail(baseOptions);
    const loggedArgs = consoleSpy.mock.calls.flatMap((c) => JSON.stringify(c));
    const combined = loggedArgs.join('');
    expect(combined).toContain('verification');
    expect(combined).toContain('user@example.com');
  });
});
