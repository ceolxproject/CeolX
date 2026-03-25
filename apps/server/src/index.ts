import { createContext } from "@CeolX/api/context";
import { appRouter } from "@CeolX/api/routers/index";
import { auth } from "@CeolX/auth";
import { env } from "@CeolX/env/server";
import { trpcServer } from "@hono/trpc-server";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { errorHandler } from "./middleware/errorHandler";
import webhooksRoutes from "./routes/webhooks";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ALLOWED_ORIGINS.split("|"),
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

// BetterAuth — sign-up, sign-in, sign-out, email verification, OAuth callbacks
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// tRPC — all feature procedures (events, artists, bookings, admin) live in packages/api
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => createContext({ context }),
  }),
);

// Stripe webhook — raw body required, cannot go through tRPC (wired in M8-T2)
app.route("/api/webhooks", webhooksRoutes);

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
