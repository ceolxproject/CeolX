import { Hono } from "hono";

const webhooksRoutes = new Hono();

// TODO M8-T2: wire Stripe webhook handler
webhooksRoutes.post("/stripe", (c) =>
  c.json({ message: "not implemented", route: "POST /api/webhooks/stripe" }),
);

// TODO M7: wire Postmark bounce and spam complaint handler
webhooksRoutes.post("/postmark", (c) =>
  c.json({ message: "not implemented", route: "POST /api/webhooks/postmark" }),
);

export default webhooksRoutes;
