import type { Duration } from '@upstash/ratelimit';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { Context, MiddlewareHandler, Next } from 'hono';

export type RateLimitTier = {
  readonly limit: number;
  readonly window: Duration;
  readonly keyBy: 'ip' | 'userId';
};

export const RATE_LIMIT_TIERS = {
  authLogin: { limit: 10, window: '15 m', keyBy: 'ip' },
  authenticatedGeneral: { limit: 120, window: '1 m', keyBy: 'userId' },
  /** Unauthenticated IP-keyed lookups (e.g. /location/ip). Higher than authLogin — called on every map open. */
  locationLookup: { limit: 60, window: '1 m', keyBy: 'ip' },
  /** Defined for future use — wired in Milestone 04 when RBAC is implemented. */
  adminGeneral: { limit: 300, window: '1 m', keyBy: 'userId' },
  /** Defined for future use — wired in Milestone 04 when RBAC is implemented. */
  adminBulk: { limit: 10, window: '1 m', keyBy: 'userId' },
} as const satisfies Record<string, RateLimitTier>;

export type RateLimitTierName = keyof typeof RATE_LIMIT_TIERS;

// Cache limiter instances so we don't reconstruct on every request
const limiterCache = new Map<string, Ratelimit>();

function isRateLimitEnabled(): boolean {
  if (process.env['NODE_ENV'] === 'test') return false;
  if (process.env['RATE_LIMIT_ENABLED'] === 'false') return false;
  if (!process.env['UPSTASH_REDIS_REST_URL']) return false;
  if (!process.env['UPSTASH_REDIS_REST_TOKEN']) return false;
  return true;
}

function getLimiter(tierName: string, tier: RateLimitTier): Ratelimit {
  const cached = limiterCache.get(tierName);
  if (cached) return cached;

  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(tier.limit, tier.window),
    prefix: 'rl',
  });
  limiterCache.set(tierName, limiter);
  return limiter;
}

function extractIp(c: Context): string {
  const forwarded = c.req.header('X-Forwarded-For');
  if (forwarded) {
    const [first = '127.0.0.1'] = forwarded.split(',');
    return first.trim();
  }
  const realIp = c.req.header('X-Real-IP');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

function extractSessionToken(cookie: string): string | null {
  const parts = cookie.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('better-auth.session_token=')) {
      return trimmed.slice('better-auth.session_token='.length) || null;
    }
  }
  return null;
}

function extractIdentifier(c: Context, tier: RateLimitTier): string {
  if (tier.keyBy === 'ip') {
    return extractIp(c);
  }

  // userId-keyed: use Bearer token, then session cookie, then fall back to IP
  const auth = c.req.header('Authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }

  const cookie = c.req.header('Cookie') ?? '';
  const sessionToken = extractSessionToken(cookie);
  if (sessionToken) return sessionToken;

  return extractIp(c);
}

function isAllowlisted(ip: string): boolean {
  const list = process.env['RATE_LIMIT_IP_ALLOWLIST'];
  if (!list) return false;
  return list.split(',').some((entry) => entry.trim() === ip);
}

export function rateLimiter(tier: RateLimitTier): MiddlewareHandler {
  // Determine tier name for cache key (find key from value reference)
  const tierName =
    Object.entries(RATE_LIMIT_TIERS).find(([, v]) => v === tier)?.[0] ??
    `${tier.limit}:${tier.window}:${tier.keyBy}`;

  return async (c: Context, next: Next): Promise<void | Response> => {
    if (!isRateLimitEnabled()) {
      return next();
    }

    const ip = extractIp(c);
    if (isAllowlisted(ip)) {
      return next();
    }

    const identifier = extractIdentifier(c, tier);
    const limiter = getLimiter(tierName, tier);
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    const resetSecs = Math.ceil(reset / 1000);

    c.res.headers.set('X-RateLimit-Limit', String(limit));
    c.res.headers.set('X-RateLimit-Remaining', String(remaining));
    c.res.headers.set('X-RateLimit-Reset', String(resetSecs));

    if (!success) {
      const retryAfter = Math.max(0, Math.ceil(reset / 1000 - Date.now() / 1000));
      c.res.headers.set('Retry-After', String(retryAfter));

      console.warn(`[rate-limit] blocked ${identifier} on tier ${tierName} — ip=${ip}`);

      return c.json({ error: 'Too Many Requests' }, 429) as unknown as void;
    }

    return next();
  };
}
