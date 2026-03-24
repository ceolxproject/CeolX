import { Hono } from "hono";

// TODO M3-T1: wire GET /map (bounding-box query)
// TODO M4-T1: wire POST /, GET /:id, PATCH /:id
const eventsRoutes = new Hono();

eventsRoutes.get("/map", (c) =>
  c.json({ message: "not implemented", route: "GET /api/v1/events/map" }),
);

eventsRoutes.post("/", (c) =>
  c.json({ message: "not implemented", route: "POST /api/v1/events" }),
);

eventsRoutes.get("/:id", (c) =>
  c.json({ message: "not implemented", route: "GET /api/v1/events/:id" }),
);

eventsRoutes.patch("/:id", (c) =>
  c.json({ message: "not implemented", route: "PATCH /api/v1/events/:id" }),
);

export default eventsRoutes;
