import { Hono } from "hono";

// TODO M9-T2: wire all admin event moderation routes
const adminRoutes = new Hono();

adminRoutes.get("/events/pending", (c) =>
  c.json({
    message: "not implemented",
    route: "GET /api/v1/admin/events/pending",
  }),
);

adminRoutes.patch("/events/:id/approve", (c) =>
  c.json({
    message: "not implemented",
    route: "PATCH /api/v1/admin/events/:id/approve",
  }),
);

adminRoutes.patch("/events/:id/reject", (c) =>
  c.json({
    message: "not implemented",
    route: "PATCH /api/v1/admin/events/:id/reject",
  }),
);

export default adminRoutes;
