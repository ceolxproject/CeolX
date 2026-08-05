import { afterEach, describe, expect, it, vi } from 'vitest';

const ping = vi.fn();

vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: vi.fn(() => ({ ping })) },
}));

const { isRedisConfigured, isRateLimitActive, pingRedis } = await import('../rate-limit.js');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function setUpstashEnv(url?: string, token?: string) {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', url ?? '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', token ?? '');
}

describe('isRedisConfigured', () => {
  it('is true only when both Upstash vars are present', () => {
    setUpstashEnv('https://test.upstash.io', 'token');
    expect(isRedisConfigured()).toBe(true);
  });

  // Health checks read this to decide whether Redis is a dependency at all, so a
  // half-configured deployment must not read as configured.
  it('is false when only the URL is set', () => {
    setUpstashEnv('https://test.upstash.io', undefined);
    expect(isRedisConfigured()).toBe(false);
  });

  it('is false when only the token is set', () => {
    setUpstashEnv(undefined, 'token');
    expect(isRedisConfigured()).toBe(false);
  });

  it('is false when neither is set', () => {
    setUpstashEnv();
    expect(isRedisConfigured()).toBe(false);
  });
});

describe('isRateLimitActive', () => {
  it('is true when Redis is configured and the flag is unset', () => {
    setUpstashEnv('https://test.upstash.io', 'token');
    expect(isRateLimitActive()).toBe(true);
  });

  // Health checks read this rather than isRedisConfigured: with the limiter off by
  // flag, nothing touches Redis, so an Upstash outage must not report as an outage.
  it('is false when RATE_LIMIT_ENABLED=false even with both vars set', () => {
    setUpstashEnv('https://test.upstash.io', 'token');
    vi.stubEnv('RATE_LIMIT_ENABLED', 'false');
    expect(isRateLimitActive()).toBe(false);
  });

  it('is false when Redis is not configured', () => {
    setUpstashEnv();
    expect(isRateLimitActive()).toBe(false);
  });

  // Only the literal string disables it — an unset or any other value leaves it on.
  it('stays true for a non-false flag value', () => {
    setUpstashEnv('https://test.upstash.io', 'token');
    vi.stubEnv('RATE_LIMIT_ENABLED', 'true');
    expect(isRateLimitActive()).toBe(true);
  });
});

describe('pingRedis', () => {
  it('resolves when Redis answers', async () => {
    ping.mockResolvedValue('PONG');
    await expect(pingRedis()).resolves.toBeUndefined();
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('rejects when Redis is unreachable so callers can report it down', async () => {
    ping.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(pingRedis()).rejects.toThrow('ENOTFOUND');
  });
});
