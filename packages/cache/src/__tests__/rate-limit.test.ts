import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @upstash/redis and @upstash/ratelimit before any imports
vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: vi.fn(() => ({})),
  },
}));

const mockLimit = vi.fn();
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({ limit: mockLimit })),
  // Static method on constructor
}));

// Patch Ratelimit.slidingWindow as a static method
import { Ratelimit } from "@upstash/ratelimit";
(Ratelimit as unknown as Record<string, unknown>).slidingWindow = vi.fn(
  () => "sliding-window-config",
);

beforeEach(() => {
  vi.resetModules();
  mockLimit.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// Helper: build a minimal Hono app with rateLimiter applied
async function buildApp(tier: "authLogin" | "authenticatedGeneral") {
  const { rateLimiter, RATE_LIMIT_TIERS } = await import("../rate-limit.js");
  const app = new Hono();
  app.use("/*", rateLimiter(RATE_LIMIT_TIERS[tier]));
  app.get("/", (c) => c.json({ ok: true }));
  return app;
}

describe("RATE_LIMIT_TIERS", () => {
  it("defines authLogin tier with correct config", async () => {
    const { RATE_LIMIT_TIERS } = await import("../rate-limit.js");
    expect(RATE_LIMIT_TIERS.authLogin).toMatchObject({
      limit: 10,
      window: "15 m",
      keyBy: "ip",
    });
  });

  it("defines authenticatedGeneral tier with correct config", async () => {
    const { RATE_LIMIT_TIERS } = await import("../rate-limit.js");
    expect(RATE_LIMIT_TIERS.authenticatedGeneral).toMatchObject({
      limit: 120,
      window: "1 m",
      keyBy: "userId",
    });
  });

  it("defines adminGeneral tier (not wired, for future M4)", async () => {
    const { RATE_LIMIT_TIERS } = await import("../rate-limit.js");
    expect(RATE_LIMIT_TIERS.adminGeneral).toMatchObject({
      limit: 300,
      window: "1 m",
      keyBy: "userId",
    });
  });
});

describe("rateLimiter — no-op conditions", () => {
  it("bypasses rate limiting when NODE_ENV=test", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");

    const app = await buildApp("authLogin");
    const res = await app.request("/");

    expect(res.status).toBe(200);
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("bypasses rate limiting when RATE_LIMIT_ENABLED=false", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_ENABLED", "false");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");

    const app = await buildApp("authLogin");
    const res = await app.request("/");

    expect(res.status).toBe(200);
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("bypasses rate limiting when UPSTASH_REDIS_REST_URL is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_ENABLED", "true");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");

    const app = await buildApp("authLogin");
    const res = await app.request("/");

    expect(res.status).toBe(200);
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("bypasses rate limiting when UPSTASH_REDIS_REST_TOKEN is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_ENABLED", "true");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const app = await buildApp("authLogin");
    const res = await app.request("/");

    expect(res.status).toBe(200);
    expect(mockLimit).not.toHaveBeenCalled();
  });
});

describe("rateLimiter — IP allowlist", () => {
  it("bypasses rate limiting for allowlisted IP", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_ENABLED", "true");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.stubEnv("RATE_LIMIT_IP_ALLOWLIST", "10.0.0.1,10.0.0.2");

    const app = await buildApp("authLogin");
    const res = await app.request("/", {
      headers: { "X-Forwarded-For": "10.0.0.1" },
    });

    expect(res.status).toBe(200);
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("does NOT bypass for non-allowlisted IP", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_ENABLED", "true");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.stubEnv("RATE_LIMIT_IP_ALLOWLIST", "10.0.0.1");

    mockLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 900_000,
    });

    const app = await buildApp("authLogin");
    const res = await app.request("/", {
      headers: { "X-Forwarded-For": "9.9.9.9" },
    });

    expect(res.status).toBe(200);
    expect(mockLimit).toHaveBeenCalledOnce();
  });
});

describe("rateLimiter — successful request (within limit)", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_ENABLED", "true");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  });

  it("passes request and sets X-RateLimit headers", async () => {
    const resetMs = Date.now() + 900_000;
    mockLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 7,
      reset: resetMs,
    });

    const app = await buildApp("authLogin");
    const res = await app.request("/", {
      headers: { "X-Forwarded-For": "1.2.3.4" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("7");
    expect(res.headers.get("X-RateLimit-Reset")).toBe(
      String(Math.ceil(resetMs / 1000)),
    );
    // Retry-After should NOT be present on success
    expect(res.headers.get("Retry-After")).toBeNull();
  });

  it("uses X-Forwarded-For header as identifier for ip-keyed tier", async () => {
    mockLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 900_000,
    });

    const app = await buildApp("authLogin");
    await app.request("/", {
      headers: { "X-Forwarded-For": "5.6.7.8" },
    });

    expect(mockLimit).toHaveBeenCalledWith(expect.stringContaining("5.6.7.8"));
  });

  it("uses X-Real-IP as fallback when X-Forwarded-For is absent", async () => {
    mockLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 900_000,
    });

    const app = await buildApp("authLogin");
    await app.request("/", {
      headers: { "X-Real-IP": "3.3.3.3" },
    });

    expect(mockLimit).toHaveBeenCalledWith(expect.stringContaining("3.3.3.3"));
  });

  it("uses Authorization Bearer token as key for userId-keyed tier", async () => {
    mockLimit.mockResolvedValue({
      success: true,
      limit: 120,
      remaining: 119,
      reset: Date.now() + 60_000,
    });

    const app = await buildApp("authenticatedGeneral");
    await app.request("/", {
      headers: { Authorization: "Bearer mytoken123" },
    });

    expect(mockLimit).toHaveBeenCalledWith(
      expect.stringContaining("mytoken123"),
    );
  });

  it("falls back to IP for userId-keyed tier when no auth header", async () => {
    mockLimit.mockResolvedValue({
      success: true,
      limit: 120,
      remaining: 119,
      reset: Date.now() + 60_000,
    });

    const app = await buildApp("authenticatedGeneral");
    await app.request("/", {
      headers: { "X-Forwarded-For": "7.8.9.0" },
    });

    expect(mockLimit).toHaveBeenCalledWith(expect.stringContaining("7.8.9.0"));
  });
});

describe("rateLimiter — rate limit exceeded (429)", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_ENABLED", "true");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  });

  it("returns 429 with JSON error body", async () => {
    const resetMs = Date.now() + 900_000;
    mockLimit.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: resetMs,
    });

    const app = await buildApp("authLogin");
    const res = await app.request("/");

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toEqual({ error: "Too Many Requests" });
  });

  it("sets all rate limit headers on 429", async () => {
    const resetMs = Date.now() + 900_000;
    mockLimit.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: resetMs,
    });

    const app = await buildApp("authLogin");
    const res = await app.request("/");

    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(res.headers.get("X-RateLimit-Reset")).toBe(
      String(Math.ceil(resetMs / 1000)),
    );
  });

  it("sets Retry-After header on 429", async () => {
    const now = Date.now();
    const resetMs = now + 45_000; // 45 seconds from now
    mockLimit.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: resetMs,
    });

    const app = await buildApp("authLogin");
    const res = await app.request("/");

    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(45);
  });

  it("X-RateLimit-Reset is in Unix seconds, not milliseconds", async () => {
    const resetMs = 1_700_000_000_000; // clearly ms-scale
    mockLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 5,
      reset: resetMs,
    });

    const app = await buildApp("authLogin");
    const res = await app.request("/");

    const resetHeader = Number(res.headers.get("X-RateLimit-Reset"));
    // Should be seconds (~1.7B), not milliseconds (~1.7T)
    expect(resetHeader).toBe(Math.ceil(resetMs / 1000));
    expect(resetHeader).toBeLessThan(10_000_000_000);
  });
});
