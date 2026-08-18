import { TRPCError } from '@trpc/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DEFAULT_ENV = {
  STRIPE_SECRET_KEY: 'sk_test_stub',
  STRIPE_PRICE_MONTHLY: 'price_monthly_stub',
  STRIPE_PRICE_ANNUAL: 'price_annual_stub',
};

const { envState, mockSessionsCreate, StripeConstructor } = vi.hoisted(() => {
  const envState: Record<string, string | number | undefined> = {};
  const mockSessionsCreate = vi.fn();
  // `this`-assignment so `new StripeConstructor(...)` populates the instance —
  // mockImplementation returning an object only works for plain calls, not `new`.
  const StripeConstructor = vi.fn(function (this: Record<string, unknown>) {
    this.checkout = { sessions: { create: mockSessionsCreate } };
  });
  return { envState, mockSessionsCreate, StripeConstructor };
});

vi.mock('@CeolX/env/server', () => ({
  get env() {
    return envState;
  },
}));

vi.mock('stripe', () => ({
  default: StripeConstructor,
  Stripe: StripeConstructor,
}));

beforeEach(() => {
  for (const key of Object.keys(envState)) delete envState[key];
  Object.assign(envState, DEFAULT_ENV);
  mockSessionsCreate.mockReset();
  mockSessionsCreate.mockResolvedValue({
    id: 'cs_test_1',
    url: 'https://checkout.stripe.com/c/pay/cs_test_1',
  });
  StripeConstructor.mockClear();
  // The service caches its client at module scope; drop the module so each case
  // starts from a cold cache.
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getStripeClient', () => {
  it('constructs once and caches the client', async () => {
    const { getStripeClient } = await import('../services/stripe.js');
    const first = getStripeClient();
    const second = getStripeClient();
    expect(first).toBe(second);
    expect(StripeConstructor).toHaveBeenCalledTimes(1);
  });

  it('does not pass an apiVersion, so the SDK uses its own pinned version', async () => {
    // Guards the reasoning in the service: a hardcoded version string here would
    // be a second source of truth that drifts from the installed SDK's types.
    const { getStripeClient } = await import('../services/stripe.js');
    getStripeClient();
    // Second constructor argument is the options bag; absent means the SDK picks
    // its own pinned apiVersion.
    const options = (StripeConstructor.mock.calls[0] as unknown[] | undefined)?.[1];
    expect(options).toBeUndefined();
  });

  it('throws PRECONDITION_FAILED naming the missing variable', async () => {
    delete envState.STRIPE_SECRET_KEY;
    const { getStripeClient } = await import('../services/stripe.js');
    try {
      getStripeClient();
      expect.unreachable('expected getStripeClient to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe('PRECONDITION_FAILED');
      expect((err as TRPCError).message).toContain('STRIPE_SECRET_KEY');
    }
    expect(StripeConstructor).not.toHaveBeenCalled();
  });

  it('__resetStripeClientForTests clears the cache', async () => {
    const { getStripeClient, __resetStripeClientForTests } = await import('../services/stripe.js');
    getStripeClient();
    __resetStripeClientForTests();
    getStripeClient();
    expect(StripeConstructor).toHaveBeenCalledTimes(2);
  });
});

describe('priceIdForInterval', () => {
  it('maps each interval to its configured Price', async () => {
    const { priceIdForInterval } = await import('../services/stripe.js');
    expect(priceIdForInterval('monthly')).toBe('price_monthly_stub');
    expect(priceIdForInterval('annual')).toBe('price_annual_stub');
  });

  it.each([
    ['monthly', 'STRIPE_PRICE_MONTHLY'],
    ['annual', 'STRIPE_PRICE_ANNUAL'],
  ] as const)('throws naming %s when unset', async (interval, varName) => {
    delete envState[varName];
    const { priceIdForInterval } = await import('../services/stripe.js');
    try {
      priceIdForInterval(interval);
      expect.unreachable('expected priceIdForInterval to throw');
    } catch (err) {
      expect((err as TRPCError).code).toBe('PRECONDITION_FAILED');
      expect((err as TRPCError).message).toContain(varName);
    }
  });
});

describe('createSubscriptionCheckoutSession', () => {
  const base = {
    interval: 'monthly' as const,
    userId: 'user_1',
    venueId: 'venue_1',
    email: 'venue@example.com',
    trialDays: 183,
    successUrl: 'https://api.ceolx.com/activate/complete',
    cancelUrl: 'https://api.ceolx.com/activate/cancelled',
  };

  /**
   * The Checkout Session payload we handed Stripe.
   *
   * Typed rather than left as `any` so the assertions below are actually checked —
   * an `any` here would let a renamed field pass silently, which defeats the point
   * of pinning the payload shape.
   */
  interface CapturedSession {
    mode?: string;
    integration_identifier?: string;
    line_items?: { price: string; quantity: number }[];
    client_reference_id?: string;
    metadata?: Record<string, string>;
    customer?: string;
    customer_email?: string;
    payment_method_types?: string[];
    payment_method_collection?: string;
    subscription_data?: {
      metadata?: Record<string, string>;
      trial_period_days?: number;
      trial_settings?: { end_behavior?: { missing_payment_method?: string } };
    };
    success_url?: string;
    cancel_url?: string;
  }

  const argOf = (): CapturedSession => mockSessionsCreate.mock.calls[0]?.[0] as CapturedSession;

  it('creates a subscription session against the resolved Price', async () => {
    const { createSubscriptionCheckoutSession } = await import('../services/stripe.js');
    const result = await createSubscriptionCheckoutSession(base);

    expect(result).toEqual({
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
      sessionId: 'cs_test_1',
    });
    expect(argOf()).toMatchObject({
      mode: 'subscription',
      line_items: [{ price: 'price_monthly_stub', quantity: 1 }],
      success_url: base.successUrl,
      cancel_url: base.cancelUrl,
    });
  });

  it('uses the annual Price when the annual interval is chosen', async () => {
    const { createSubscriptionCheckoutSession } = await import('../services/stripe.js');
    await createSubscriptionCheckoutSession({ ...base, interval: 'annual' });
    expect(argOf().line_items?.[0]?.price).toBe('price_annual_stub');
  });

  it('joins the payment to the account by id, never by email (D-23)', async () => {
    const { createSubscriptionCheckoutSession } = await import('../services/stripe.js');
    await createSubscriptionCheckoutSession(base);
    expect(argOf()).toMatchObject({
      client_reference_id: 'user_1',
      metadata: { userId: 'user_1', venueId: 'venue_1' },
    });
  });

  it('mirrors metadata onto the subscription, which is what the webhook reads', async () => {
    const { createSubscriptionCheckoutSession } = await import('../services/stripe.js');
    await createSubscriptionCheckoutSession(base);
    expect(argOf().subscription_data?.metadata).toEqual({ userId: 'user_1', venueId: 'venue_1' });
  });

  it('prefills the email only when there is no existing customer', async () => {
    const { createSubscriptionCheckoutSession } = await import('../services/stripe.js');
    await createSubscriptionCheckoutSession(base);
    expect(argOf().customer_email).toBe('venue@example.com');
    expect(argOf()).not.toHaveProperty('customer');
  });

  it('reuses an existing customer and then omits the email — Stripe rejects both (D-21)', async () => {
    const { createSubscriptionCheckoutSession } = await import('../services/stripe.js');
    await createSubscriptionCheckoutSession({ ...base, stripeCustomerId: 'cus_existing' });
    expect(argOf().customer).toBe('cus_existing');
    expect(argOf()).not.toHaveProperty('customer_email');
  });

  it('applies the trial and cancels rather than invoicing if a card is somehow missing', async () => {
    const { createSubscriptionCheckoutSession } = await import('../services/stripe.js');
    await createSubscriptionCheckoutSession(base);
    expect(argOf().subscription_data).toMatchObject({
      trial_period_days: 183,
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
    });
  });

  it('omits every trial field when the venue has already used its one trial (D-42)', async () => {
    const { createSubscriptionCheckoutSession } = await import('../services/stripe.js');
    await createSubscriptionCheckoutSession({ ...base, trialDays: null });
    const subscriptionData = argOf().subscription_data;
    expect(subscriptionData).not.toHaveProperty('trial_period_days');
    expect(subscriptionData).not.toHaveProperty('trial_settings');
  });

  it('tags the session with a stable integration_identifier for Dashboard comparison', async () => {
    const { createSubscriptionCheckoutSession } = await import('../services/stripe.js');
    await createSubscriptionCheckoutSession(base);
    // Must be constant across sessions — a per-call value would not aggregate.
    expect(argOf().integration_identifier).toBe('ceolx-venue-subscription-krtmvhqz');
  });

  it('never sets payment_method_types — Stripe picks methods dynamically', async () => {
    // Hardcoding ['card'] locks out payment methods that improve conversion, and is
    // explicitly against Stripe's guidance outside Terminal integrations.
    const { createSubscriptionCheckoutSession } = await import('../services/stripe.js');
    await createSubscriptionCheckoutSession(base);
    expect(argOf()).not.toHaveProperty('payment_method_types');
  });

  it('disables Adaptive Pricing so the charge is always the euro price (D-04)', async () => {
    // Adaptive Pricing defaults to the *Dashboard* setting, so leaving this unset is not
    // a neutral choice. A test checkout from India rendered "₹22,923.04 per year — 1 EUR =
    // 115.1912 INR (includes 4% conversion fee)" with no euro figure on the page at all.
    //
    // That breaks two things at once. D-04 fixed the price at €19.99 / €199, and a 4%
    // markup is not that price. And every amount we email is read from the Price in euro,
    // so the trial-ending warning would quote €199 while the card is charged a number the
    // venue has never seen — the precise mismatch D-30 exists to prevent. CeolX has global
    // access, so a non-eurozone venue is a real customer, not a hypothetical.
    //
    // Asserted here rather than trusted to the Dashboard: this is invisible from Ireland,
    // where the page renders in euro either way.
    const { createSubscriptionCheckoutSession } = await import('../services/stripe.js');
    await createSubscriptionCheckoutSession(base);
    expect(argOf()).toMatchObject({ adaptive_pricing: { enabled: false } });
  });

  it('never sets payment_method_collection — Stripe already defaults to always (D-05)', async () => {
    const { createSubscriptionCheckoutSession } = await import('../services/stripe.js');
    await createSubscriptionCheckoutSession(base);
    expect(argOf()).not.toHaveProperty('payment_method_collection');
  });

  it('fails loudly rather than returning an empty redirect', async () => {
    mockSessionsCreate.mockResolvedValue({ id: 'cs_test_2', url: null });
    const { createSubscriptionCheckoutSession } = await import('../services/stripe.js');
    await expect(createSubscriptionCheckoutSession(base)).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
  });
});
