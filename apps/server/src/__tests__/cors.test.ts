import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { cors } from "hono/cors";

// Must be imported after vi.stubEnv calls in each test — use inline imports
// to ensure process.env is read at call time, not module load time.
import { buildAllowedOrigins, isAllowedOrigin } from "../config/cors.js";

// ---------------------------------------------------------------------------
// Unit tests — buildAllowedOrigins & isAllowedOrigin
// ---------------------------------------------------------------------------

describe("buildAllowedOrigins", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns configured origins from pipe-separated env var in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(
      "CORS_ALLOWED_ORIGINS",
      "https://app.ceolx.ie|https://admin.ceolx.ie",
    );
    expect(buildAllowedOrigins()).toEqual([
      "https://app.ceolx.ie",
      "https://admin.ceolx.ie",
    ]);
  });

  it("auto-injects dev origins when NODE_ENV is development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://app.ceolx.ie");
    const origins = buildAllowedOrigins();
    expect(origins).toContain("https://app.ceolx.ie");
    expect(origins).toContain("http://localhost:3000");
    expect(origins).toContain("http://localhost:3001");
    expect(origins).toContain("http://localhost:8081");
    expect(origins).toContain("http://localhost:19006");
  });

  it("does not include dev origins in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://app.ceolx.ie");
    const origins = buildAllowedOrigins();
    expect(origins).not.toContain("http://localhost:3000");
    expect(origins).not.toContain("http://localhost:8081");
  });

  it("deduplicates origins when env var repeats a dev origin", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv(
      "CORS_ALLOWED_ORIGINS",
      "http://localhost:3000|https://app.ceolx.ie",
    );
    const origins = buildAllowedOrigins();
    const count = origins.filter((o) => o === "http://localhost:3000").length;
    expect(count).toBe(1);
  });

  it("trims whitespace from origins", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(
      "CORS_ALLOWED_ORIGINS",
      " https://app.ceolx.ie | https://admin.ceolx.ie ",
    );
    expect(buildAllowedOrigins()).toEqual([
      "https://app.ceolx.ie",
      "https://admin.ceolx.ie",
    ]);
  });

  it("returns only dev origins when CORS_ALLOWED_ORIGINS is empty in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "");
    const origins = buildAllowedOrigins();
    expect(origins).toContain("http://localhost:3000");
    expect(origins).not.toContain("");
  });

  it("returns empty array when CORS_ALLOWED_ORIGINS is unset in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "");
    expect(buildAllowedOrigins()).toEqual([]);
  });
});

describe("isAllowedOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true for a whitelisted origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://app.ceolx.ie");
    expect(isAllowedOrigin("https://app.ceolx.ie")).toBe(true);
  });

  it("returns false for a non-whitelisted origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://app.ceolx.ie");
    expect(isAllowedOrigin("https://evil.example.com")).toBe(false);
  });

  it("is case-sensitive", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://app.ceolx.ie");
    expect(isAllowedOrigin("https://APP.CEOLX.IE")).toBe(false);
  });

  it("returns true for dev origin in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://app.ceolx.ie");
    expect(isAllowedOrigin("http://localhost:8081")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration tests — CORS middleware via Hono app.request()
// ---------------------------------------------------------------------------

function buildTestApp(allowedOrigins: string[]) {
  const app = new Hono();

  app.use(
    "/*",
    cors({
      origin: (origin) => {
        if (!origin) return null;
        if (allowedOrigins.includes(origin)) return origin;
        return null;
      },
      credentials: true,
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: [
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
      ],
      maxAge: 86400,
    }),
  );

  app.get("/test", (c) => c.json({ ok: true }));

  return app;
}

describe("CORS middleware integration", () => {
  const allowed = ["https://app.ceolx.ie", "http://localhost:3000"];

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("echoes allowed origin as Access-Control-Allow-Origin", async () => {
    const app = buildTestApp(allowed);
    const res = await app.request("/test", {
      headers: { Origin: "https://app.ceolx.ie" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://app.ceolx.ie",
    );
  });

  it("sets Access-Control-Allow-Credentials: true for allowed origin", async () => {
    const app = buildTestApp(allowed);
    const res = await app.request("/test", {
      headers: { Origin: "https://app.ceolx.ie" },
    });
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("returns no Access-Control-Allow-Origin for disallowed origin", async () => {
    const app = buildTestApp(allowed);
    const res = await app.request("/test", {
      headers: { Origin: "https://evil.example.com" },
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("passes through requests with no Origin header", async () => {
    const app = buildTestApp(allowed);
    const res = await app.request("/test");
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("OPTIONS preflight from allowed origin returns 204", async () => {
    const app = buildTestApp(allowed);
    const res = await app.request("/test", {
      method: "OPTIONS",
      headers: {
        Origin: "https://app.ceolx.ie",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });
    expect(res.status).toBe(204);
  });

  it("OPTIONS preflight includes Access-Control-Max-Age: 86400", async () => {
    const app = buildTestApp(allowed);
    const res = await app.request("/test", {
      method: "OPTIONS",
      headers: {
        Origin: "https://app.ceolx.ie",
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
  });

  it("exposes X-RateLimit-* headers via Access-Control-Expose-Headers", async () => {
    const app = buildTestApp(allowed);
    const res = await app.request("/test", {
      headers: { Origin: "https://app.ceolx.ie" },
    });
    const exposed = res.headers.get("Access-Control-Expose-Headers") ?? "";
    expect(exposed).toContain("X-RateLimit-Limit");
    expect(exposed).toContain("X-RateLimit-Remaining");
    expect(exposed).toContain("X-RateLimit-Reset");
  });

  it("OPTIONS preflight includes correct allowed methods", async () => {
    const app = buildTestApp(allowed);
    const res = await app.request("/test", {
      method: "OPTIONS",
      headers: {
        Origin: "https://app.ceolx.ie",
        "Access-Control-Request-Method": "PATCH",
      },
    });
    const methods = res.headers.get("Access-Control-Allow-Methods") ?? "";
    expect(methods).toContain("GET");
    expect(methods).toContain("POST");
    expect(methods).toContain("PATCH");
    expect(methods).toContain("DELETE");
    expect(methods).toContain("OPTIONS");
  });
});
