import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Reset singleton between tests
beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getTransport", () => {
  it("returns SMTP transport in development regardless of token", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("POSTMARK_API_TOKEN", "some-token");
    const { getTransport } = await import("../client.js");
    const transport = getTransport();
    expect(transport).toBeDefined();
    expect(typeof transport.send).toBe("function");
  });

  it("throws when NODE_ENV is production and POSTMARK_API_TOKEN is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("POSTMARK_API_TOKEN", "");
    const { getTransport } = await import("../client.js");
    expect(() => getTransport()).toThrow("POSTMARK_API_TOKEN is required");
  });

  it("returns Postmark transport in production when token is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("POSTMARK_API_TOKEN", "test-token-abc");
    const { getTransport } = await import("../client.js");
    const transport = getTransport();
    expect(transport).toBeDefined();
    expect(typeof transport.send).toBe("function");
  });

  it("returns the same singleton instance on repeated calls", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { getTransport } = await import("../client.js");
    const t1 = getTransport();
    const t2 = getTransport();
    expect(t1).toBe(t2);
  });
});
