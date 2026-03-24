import { Hono } from "hono";

// TODO M3-T3: wire GET /search
// TODO M6-T1: wire GET /:id
const artistsRoutes = new Hono();

artistsRoutes.get("/search", (c) =>
  c.json({ message: "not implemented", route: "GET /api/v1/artists/search" }),
);

artistsRoutes.get("/:id", (c) =>
  c.json({ message: "not implemented", route: "GET /api/v1/artists/:id" }),
);

export default artistsRoutes;
