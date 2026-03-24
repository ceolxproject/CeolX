import { Hono } from "hono";

// TODO M5-T1: wire POST /
// TODO M5-T3: wire PATCH /:id
const bookingsRoutes = new Hono();

bookingsRoutes.post("/", (c) =>
  c.json({ message: "not implemented", route: "POST /api/v1/bookings" }),
);

bookingsRoutes.patch("/:id", (c) =>
  c.json({ message: "not implemented", route: "PATCH /api/v1/bookings/:id" }),
);

export default bookingsRoutes;
