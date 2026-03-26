/**
 * Integration test: confirms 429 is returned after exhausting the limit
 * by sending N+1 real requests to a Hono app instance.
 */
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: vi.fn(() => ({})),
  },
}));

// Stateful mock: succeeds for the first `limit` calls, then fails
let callCount = 0;
const LIMIT = 3;
const RESET_MS = Date.now() + 60_000;

vi.mock("@upstash/ratelimit", () => {
  return {
    Ratelimit: vi.fn().mockImplementation(() => ({
      limit: vi.fn().mockImplementation(async () => {
        callCount++;
        const success = callCount <= LIMIT;
        return {
          success,
          limit: LIMIT,
          remaining: Math.max(0, LIMIT - callCount),
          reset: RESET_MS,
        };
      }),
    })),
  };
});

import { Ratelimit } from "@upstash/ratelimit";
(Ratelimit as unknown as Record<string, unknown>).slidingWindow = vi.fn(
  () => "sliding-window-config",
);

beforeEach(() => {
  vi.resetModules();
  callCount = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("integration: 429 after exceeding limit", () => {
  it("returns 200 for first N requests then 429", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_ENABLED", "true");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");

    const { rateLimiter, RATE_LIMIT_TIERS } = await import("../rate-limit.js");
    const app = new Hono();
    app.use("/*", rateLimiter(RATE_LIMIT_TIERS.authLogin));
    app.get("/", (c) => c.json({ ok: true }));

    // First LIMIT requests should pass
    for (let i = 0; i < LIMIT; i++) {
      const res = await app.request("/", {
        headers: { "X-Forwarded-For": "1.2.3.4" },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Remaining")).toBe(
        String(LIMIT - 1 - i),
      );
    }

    // Next request should be blocked
    const blockedRes = await app.request("/", {
      headers: { "X-Forwarded-For": "1.2.3.4" },
    });
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(blockedRes.headers.get("Retry-After")).not.toBeNull();

    const body = await blockedRes.json();
    expect(body).toEqual({ error: "Too Many Requests" });
  });

  it("subsequent requests after block also return 429", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_ENABLED", "true");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");

    const { rateLimiter, RATE_LIMIT_TIERS } = await import("../rate-limit.js");
    const app = new Hono();
    app.use("/*", rateLimiter(RATE_LIMIT_TIERS.authLogin));
    app.get("/", (c) => c.json({ ok: true }));

    // Exhaust the limit
    for (let i = 0; i <= LIMIT; i++) {
      await app.request("/", { headers: { "X-Forwarded-For": "2.3.4.5" } });
    }

    // One more — should still be 429
    const res = await app.request("/", {
      headers: { "X-Forwarded-For": "2.3.4.5" },
    });
    expect(res.status).toBe(429);
  });
});
