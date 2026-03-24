import { Hono } from "hono";

// TODO M2-T1: wire up BetterAuth sign-up / sign-in / logout
const authRoutes = new Hono();

authRoutes.post("/sign-up", (c) =>
  c.json({ message: "not implemented", route: "POST /api/v1/auth/sign-up" }),
);

authRoutes.post("/sign-in", (c) =>
  c.json({ message: "not implemented", route: "POST /api/v1/auth/sign-in" }),
);

authRoutes.post("/logout", (c) =>
  c.json({ message: "not implemented", route: "POST /api/v1/auth/logout" }),
);

export default authRoutes;
