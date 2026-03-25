import { Hono } from "hono";

// TODO M8-T2: wire Stripe webhook handler
const webhooksRoutes = new Hono();

webhooksRoutes.post("/stripe", (c) =>
  c.json({ message: "not implemented", route: "POST /api/v1/webhooks/stripe" }),
);

export default webhooksRoutes;
