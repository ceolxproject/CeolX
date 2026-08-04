import { afterEach, describe, expect, it, vi } from 'vitest';

const ping = vi.fn();

vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: vi.fn(() => ({ ping })) },
}));

const { isRedisConfigured, pingRedis } = await import('../rate-limit.js');

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
