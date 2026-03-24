import type { Context, Next } from "hono";

// TODO M2-T1: replace stub with real BetterAuth session verification
export const authMiddleware = async (c: Context, next: Next) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    c.set("userId", null);
    c.set("currentRole", null);
    return next();
  }

  // Token present but empty after stripping "Bearer " prefix
  if (token.trim() === "") {
    return c.json(
      {
        error: "Unauthorized",
        code: "INVALID_TOKEN",
        message: "Invalid authorization token",
        statusCode: 401,
      },
      401,
    );
  }

  // Stub: real verification wired in M2-T1
  c.set("userId", "stub-user-id");
  c.set("currentRole", "spectator");
  return next();
};
