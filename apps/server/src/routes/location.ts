import { Hono } from 'hono';

const location = new Hono();

const IPAPI_TIMEOUT_MS = 3_000;

function extractIp(req: Request): string {
  const forwarded = req.headers.get('X-Forwarded-For');
  if (forwarded) {
    const [first = '127.0.0.1'] = forwarded.split(',');
    return first.trim();
  }
  const realIp = req.headers.get('X-Real-IP');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

location.get('/ip', async (c) => {
  const ip = extractIp(c.req.raw);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IPAPI_TIMEOUT_MS);

    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return c.json({ ok: false });
    }

    const data = (await response.json()) as Record<string, unknown>;
    const latitude = data['latitude'];
    const longitude = data['longitude'];

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return c.json({ ok: false });
    }

    return c.json({
      ok: true,
      latitude,
      longitude,
      city: typeof data['city'] === 'string' ? data['city'] : null,
      region: typeof data['region'] === 'string' ? data['region'] : null,
    });
  } catch {
    return c.json({ ok: false });
  }
});

export default location;
