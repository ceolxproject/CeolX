// Vercel auto-detects this default export as a Web-Standard fetch handler
// (Hono's `app` exposes a `.fetch(request)` method) and invokes it via the
// modern serverless runtime, which preserves the original Request URL even
// after vercel.json rewrites — so Hono's routes match the caller-facing
// paths without any prefix-strip dance.
//
// Do NOT switch this to `handle(app)` from `hono/vercel`: that returns a
// Node-style (req, res) handler, which Vercel invokes via the legacy
// runtime where `req.url` is replaced with the rewrite destination — every
// route would 404.
export { app as default } from './app';
