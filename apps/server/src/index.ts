import { createContext } from "@CeolX/api/context";
import { appRouter } from "@CeolX/api/routers/index";
import { auth } from "@CeolX/auth";
import { trpcServer } from "@hono/trpc-server";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth";
import eventsRoutes from "./routes/events";
import artistsRoutes from "./routes/artists";
import bookingsRoutes from "./routes/bookings";
import adminRoutes from "./routes/admin";
import webhooksRoutes from "./routes/webhooks";

type Variables = { userId: string | null; currentRole: string | null };

const app = new Hono<{ Variables: Variables }>();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: [
      "https://app.ceolx.ie",
      "https://admin.ceolx.ie",
      "http://localhost:3000",
      "http://localhost:8081",
    ],
    credentials: true,
  }),
);

// Health check — no auth required
app.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  }),
);

// BetterAuth handler — untouched from M1-T2
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// tRPC — untouched from M1-T2
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => createContext({ context }),
  }),
);

// Stub auth middleware for all REST routes (fully wired in M2-T1)
app.use("/api/*", authMiddleware);

// REST routes
app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/events", eventsRoutes);
app.route("/api/v1/artists", artistsRoutes);
app.route("/api/v1/bookings", bookingsRoutes);
app.route("/api/v1/admin", adminRoutes);
app.route("/api/v1/webhooks", webhooksRoutes);

app.onError(errorHandler);
app.notFound((c) =>
  c.json(
    {
      error: "NotFound",
      code: "ROUTE_NOT_FOUND",
      message: "Endpoint not found",
      statusCode: 404,
    },
    404,
  ),
);

const port = Number(process.env.PORT) || 3001;
serve({ fetch: app.fetch, port }, () => {
  console.log(`API running on http://localhost:${port}`);
});

export default app;
