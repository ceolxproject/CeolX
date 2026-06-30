import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createTransportMock = vi.fn((_opts?: unknown) => ({ sendMail: vi.fn() }));
const postmarkConstructorMock = vi.fn();

vi.mock('nodemailer', () => ({
  default: { createTransport: (opts: unknown) => createTransportMock(opts) },
}));

vi.mock('postmark', () => ({
  ServerClient: class {
    constructor(token: string) {
      postmarkConstructorMock(token);
    }
    sendEmail = vi.fn();
  },
}));

beforeEach(() => {
  vi.resetModules();
  createTransportMock.mockClear();
  postmarkConstructorMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getTransport', () => {
  it('uses SMTP in development when no token is set', async () => {
    vi.stubEnv('APP_ENV', '');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('POSTMARK_API_TOKEN', '');
    const { getTransport } = await import('../client.js');
    getTransport();
    expect(createTransportMock).toHaveBeenCalledOnce();
    expect(postmarkConstructorMock).not.toHaveBeenCalled();
  });

  it('uses Postmark whenever a token is set, even in development', async () => {
    vi.stubEnv('APP_ENV', '');
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('POSTMARK_API_TOKEN', 'pm-token-dev');
    const { getTransport } = await import('../client.js');
    getTransport();
    expect(postmarkConstructorMock).toHaveBeenCalledWith('pm-token-dev');
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it('uses SMTP when APP_ENV=staging even if NODE_ENV=production', async () => {
    vi.stubEnv('APP_ENV', 'staging');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('POSTMARK_API_TOKEN', '');
    const { getTransport } = await import('../client.js');
    getTransport();
    expect(createTransportMock).toHaveBeenCalledOnce();
    expect(postmarkConstructorMock).not.toHaveBeenCalled();
  });

  it('uses Postmark when APP_ENV=production and token is set', async () => {
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('POSTMARK_API_TOKEN', 'pm-token-abc');
    const { getTransport } = await import('../client.js');
    getTransport();
    expect(postmarkConstructorMock).toHaveBeenCalledWith('pm-token-abc');
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it('falls back to NODE_ENV=production when APP_ENV is unset', async () => {
    vi.stubEnv('APP_ENV', '');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('POSTMARK_API_TOKEN', 'pm-token-xyz');
    const { getTransport } = await import('../client.js');
    getTransport();
    expect(postmarkConstructorMock).toHaveBeenCalledWith('pm-token-xyz');
  });

  it('throws when production but POSTMARK_API_TOKEN is missing', async () => {
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('POSTMARK_API_TOKEN', '');
    const { getTransport } = await import('../client.js');
    expect(() => getTransport()).toThrow('POSTMARK_API_TOKEN is required');
  });

  it('honors SMTP_SECURE=true', async () => {
    vi.stubEnv('APP_ENV', 'staging');
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('SMTP_PORT', '465');
    vi.stubEnv('SMTP_SECURE', 'true');
    const { getTransport } = await import('../client.js');
    getTransport();
    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
    });
  });

  it('defaults SMTP_SECURE to false when unset or any non-"true" value', async () => {
    vi.stubEnv('APP_ENV', 'staging');
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('SMTP_PORT', '1125');
    vi.stubEnv('SMTP_SECURE', 'false');
    const { getTransport } = await import('../client.js');
    getTransport();
    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 1125,
      secure: false,
    });
  });

  it('returns the same singleton on repeated calls', async () => {
    vi.stubEnv('APP_ENV', 'staging');
    const { getTransport } = await import('../client.js');
    expect(getTransport()).toBe(getTransport());
  });
});
