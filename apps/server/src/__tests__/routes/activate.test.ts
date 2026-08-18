import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const VALID_TOKEN = 'a'.repeat(43);
const USER_ID = 'user_1';
const VENUE_ID = 'venue_1';
const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_123';

const { mockResolveToken, mockBuildCheckout, mockSelectLimit } = vi.hoisted(() => ({
  mockResolveToken: vi.fn(),
  mockBuildCheckout: vi.fn(),
  mockSelectLimit: vi.fn(),
}));

vi.mock('@CeolX/api/services/activation-token', () => ({
  resolveActivationToken: mockResolveToken,
}));

vi.mock('@CeolX/api/routers/stripe', () => ({
  buildCheckoutSessionForVenue: mockBuildCheckout,
}));

vi.mock('@CeolX/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: mockSelectLimit })) })),
    })),
  },
}));

import activateRoute from '../../routes/activate.js';

function buildApp() {
  const app = new Hono();
  app.route('/', activateRoute);
  return app;
}

/** venue profile lookup, then account lookup — in the order the route makes them. */
function primeVenueLookups() {
  mockSelectLimit
    .mockResolvedValueOnce([{ id: VENUE_ID }])
    .mockResolvedValueOnce([{ email: 'venue@example.com' }]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveToken.mockResolvedValue({ status: 'valid', tokenId: 'tok_1', userId: USER_ID });
  mockBuildCheckout.mockResolvedValue({ url: CHECKOUT_URL, sessionId: 'cs_test_123' });
  mockSelectLimit.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const url = (params: string) => `/activate?${params}`;

describe('GET /activate — happy path', () => {
  it('302s straight to Stripe with no intermediate page (D-60)', async () => {
    primeVenueLookups();
    const res = await buildApp().request(url(`token=${VALID_TOKEN}&plan=monthly`));

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(CHECKOUT_URL);
    // Nothing rendered — no page of our own on the success path.
    expect(await res.text()).toBe('');
  });

  it('passes the chosen interval through to checkout (D-08)', async () => {
    primeVenueLookups();
    await buildApp().request(url(`token=${VALID_TOKEN}&plan=annual`));
    expect(mockBuildCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ interval: 'annual', userId: USER_ID, venueId: VENUE_ID })
    );
  });

  it('never caches the redirect and leaks no referrer to Stripe', async () => {
    primeVenueLookups();
    const res = await buildApp().request(url(`token=${VALID_TOKEN}&plan=monthly`));
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('does NOT consume the token — an abandoned tab must remain usable (D-24)', async () => {
    primeVenueLookups();
    await buildApp().request(url(`token=${VALID_TOKEN}&plan=monthly`));
    // Consumption is the webhook's job, once payment actually succeeds.
    expect(mockResolveToken).toHaveBeenCalledTimes(1);
  });
});

describe('GET /activate — token states are distinct (D-24)', () => {
  it('reports an expired link separately so a fresh one can be offered', async () => {
    mockResolveToken.mockResolvedValue({ status: 'expired' });
    const res = await buildApp().request(url(`token=${VALID_TOKEN}&plan=monthly`));

    expect(res.status).toBe(410);
    const body = await res.text();
    expect(body).toMatch(/expired/i);
    expect(body).toMatch(/Activate Profile/i);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
  });

  it('tells an already-paid venue they are done rather than erroring', async () => {
    mockResolveToken.mockResolvedValue({ status: 'consumed' });
    const res = await buildApp().request(url(`token=${VALID_TOKEN}&plan=monthly`));

    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/already been used/i);
  });

  it('returns invalid — not a 500 — for a superseded link (D-18)', async () => {
    mockResolveToken.mockResolvedValue({ status: 'invalid' });
    const res = await buildApp().request(url(`token=${VALID_TOKEN}&plan=monthly`));

    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/no longer valid|newer activation/i);
  });

  it('never caches a terminal page', async () => {
    mockResolveToken.mockResolvedValue({ status: 'expired' });
    const res = await buildApp().request(url(`token=${VALID_TOKEN}&plan=monthly`));
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('GET /activate — input validation at the boundary', () => {
  it('400s a malformed token without querying anything', async () => {
    const res = await buildApp().request(url('token=short&plan=monthly'));
    expect(res.status).toBe(400);
    expect(mockResolveToken).not.toHaveBeenCalled();
  });

  it('400s a missing plan — the token carries none (D-63)', async () => {
    const res = await buildApp().request(url(`token=${VALID_TOKEN}`));
    expect(res.status).toBe(400);
    expect(mockResolveToken).not.toHaveBeenCalled();
  });

  it('400s an unrecognised plan rather than guessing an interval', async () => {
    const res = await buildApp().request(url(`token=${VALID_TOKEN}&plan=weekly`));
    expect(res.status).toBe(400);
    expect(mockResolveToken).not.toHaveBeenCalled();
  });

  it('refuses a Stripe Price ID supplied as the plan (D-08)', async () => {
    const res = await buildApp().request(url(`token=${VALID_TOKEN}&plan=price_1234567890`));
    expect(res.status).toBe(400);
    expect(mockBuildCheckout).not.toHaveBeenCalled();
  });

  it('does not reflect the token into the rendered page', async () => {
    const res = await buildApp().request(url(`token=${VALID_TOKEN}&plan=monthly`));
    expect(await res.text()).not.toContain(VALID_TOKEN);
  });

  it('escapes rather than reflects an injection attempt in the token', async () => {
    const nasty = `${'a'.repeat(40)}<script>alert(1)</script>`;
    const res = await buildApp().request(
      `/activate?token=${encodeURIComponent(nasty)}&plan=monthly`
    );
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).not.toContain('<script>alert(1)</script>');
  });
});

describe('GET /activate — guard outcomes surface as pages, not JSON', () => {
  it('reports an already-subscribed venue as success (CONFLICT from the shared guard)', async () => {
    primeVenueLookups();
    mockBuildCheckout.mockRejectedValue(Object.assign(new Error('nope'), { code: 'CONFLICT' }));
    const res = await buildApp().request(url(`token=${VALID_TOKEN}&plan=monthly`));

    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/already has an active subscription/i);
  });

  it('reports a billing-blocked account as under review (D-51)', async () => {
    primeVenueLookups();
    mockBuildCheckout.mockRejectedValue(Object.assign(new Error('nope'), { code: 'FORBIDDEN' }));
    const res = await buildApp().request(url(`token=${VALID_TOKEN}&plan=monthly`));

    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/review/i);
  });

  it('renders HTML on an unexpected failure, never the JSON error envelope', async () => {
    primeVenueLookups();
    mockBuildCheckout.mockRejectedValue(new Error('stripe exploded'));
    const res = await buildApp().request(url(`token=${VALID_TOKEN}&plan=monthly`));

    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    const body = await res.text();
    expect(body).toMatch(/went wrong/i);
    // The global handler would have produced this; a venue opening a link from
    // their inbox must never see it.
    expect(body).not.toContain('"statusCode"');
  });

  it('explains a missing venue profile instead of 500-ing', async () => {
    mockSelectLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const res = await buildApp().request(url(`token=${VALID_TOKEN}&plan=monthly`));

    expect(res.status).toBe(400);
    expect(await res.text()).toMatch(/could not find that venue/i);
    expect(mockBuildCheckout).not.toHaveBeenCalled();
  });
});
