import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const VENUE_ID = 'venue-profile-1';
const SUB_ID = 'sub_123';
const CUSTOMER_ID = 'cus_123';

const {
  mockSelectLimit,
  mockUpdateWhere,
  mockUpdateSet,
  mockInsertValues,
  mockOnConflictDoUpdate,
  mockTransaction,
  mockDb,
  mockRetrieveSubscription,
  mockRetrieveCharge,
  mockCancelSubscription,
  mockMarkConsumed,
} = vi.hoisted(() => {
  const mockSelectLimit = vi.fn();
  const mockUpdateWhere = vi.fn(() => Promise.resolve());
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockOnConflictDoUpdate = vi.fn(() => Promise.resolve());
  // values() is awaited directly on some paths and chained with .onConflictDoUpdate()
  // on the upsert path — mirror drizzle's thenable builder rather than picking one.
  const mockInsertValues = vi.fn(() =>
    Object.assign(Promise.resolve(), { onConflictDoUpdate: mockOnConflictDoUpdate })
  );
  const mockDb: Record<string, unknown> = {};
  const mockTransaction = vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(mockDb));

  Object.assign(mockDb, {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: mockSelectLimit })) })),
    })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
    insert: vi.fn(() => ({ values: mockInsertValues })),
    transaction: mockTransaction,
  });

  return {
    mockSelectLimit,
    mockOnConflictDoUpdate,
    mockUpdateWhere,
    mockUpdateSet,
    mockInsertValues,
    mockTransaction,
    mockDb,
    mockRetrieveSubscription: vi.fn(),
    mockRetrieveCharge: vi.fn(),
    mockCancelSubscription: vi.fn(),
    mockMarkConsumed: vi.fn(),
  };
});

vi.mock('@CeolX/db', () => ({ db: mockDb }));
vi.mock('../services/stripe', () => ({
  getStripeClient: () => ({
    subscriptions: { retrieve: mockRetrieveSubscription, cancel: mockCancelSubscription },
    charges: { retrieve: mockRetrieveCharge },
  }),
}));
vi.mock('../services/activation-token', () => ({
  markActivationTokenConsumed: mockMarkConsumed,
}));

import {
  blockBillingForCustomer,
  clearPastDueMarker,
  handleStripeSubscriptionEvent,
  mapStripeStatus,
  recordInvoicePaymentFailure,
  syncSubscriptionFromStripe,
} from '../services/subscription-sync';

/**
 * Read an argument out of a mock call.
 *
 * `vi.fn()` with no signature infers its call arguments as an empty tuple, so
 * indexing `.mock.calls[0][0]` is a type error even though it is correct at
 * runtime. This narrows in one place rather than casting at a dozen call sites.
 */
function callArg<T>(fn: { mock: { calls: unknown[][] } }, call = 0, arg = 0): T {
  return fn.mock.calls[call]?.[arg] as T;
}

/** Minimal Stripe subscription shaped the way the SDK returns it. */
function stripeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: SUB_ID,
    status: 'trialing',
    customer: CUSTOMER_ID,
    cancel_at_period_end: false,
    trial_end: 1_776_000_000,
    metadata: { venueId: VENUE_ID, userId: 'user-1' },
    items: {
      data: [
        {
          price: { recurring: { interval: 'month' } },
          current_period_start: 1_760_000_000,
          current_period_end: 1_762_000_000,
        },
      ],
    },
    ...overrides,
  };
}

/** The write captured from the venue_subscriptions branch. */
const subscriptionWrite = (): Record<string, unknown> =>
  callArg<Record<string, unknown> | undefined>(mockInsertValues) ??
  callArg<Record<string, unknown>>(mockUpdateSet);

/** The write captured from the venue_profiles branch (always the last update). */
const profileWrite = (): Record<string, unknown> =>
  callArg<Record<string, unknown>>(mockUpdateSet, mockUpdateSet.mock.calls.length - 1);

beforeEach(() => {
  vi.clearAllMocks();
  mockSelectLimit.mockResolvedValue([]);
  mockUpdateWhere.mockResolvedValue(undefined);
  mockUpdateSet.mockImplementation(() => ({ where: mockUpdateWhere }));
  // insert().values() is chained with .onConflictDoUpdate() on the upsert path, so it
  // has to return drizzle's thenable builder rather than a bare promise.
  mockOnConflictDoUpdate.mockResolvedValue(undefined);
  mockInsertValues.mockImplementation(() =>
    Object.assign(Promise.resolve(), { onConflictDoUpdate: mockOnConflictDoUpdate })
  );
  mockTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(mockDb));
  mockRetrieveSubscription.mockResolvedValue(stripeSubscription());
  mockMarkConsumed.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mapStripeStatus', () => {
  it.each([
    ['trialing', 'trialing'],
    ['active', 'active'],
    ['past_due', 'past_due'],
    ['unpaid', 'past_due'],
    ['canceled', 'cancelled'],
    ['incomplete', 'inactive'],
    ['incomplete_expired', 'inactive'],
    ['paused', 'inactive'],
  ])('maps %s → %s', (stripeStatus, expected) => {
    expect(mapStripeStatus(stripeStatus)).toBe(expected);
  });

  it("translates Stripe's single-l `canceled` to our `cancelled` (D-12)", () => {
    expect(mapStripeStatus('canceled')).toBe('cancelled');
    // Our spelling is not a Stripe status, so it must not round-trip.
    expect(mapStripeStatus('cancelled')).toBeNull();
  });

  it('returns null for an unknown status rather than guessing', () => {
    // Defaulting to active would hand out free visibility; defaulting to inactive
    // would hide a paying customer. Both are worse than refusing to act.
    expect(mapStripeStatus('some_future_status')).toBeNull();
    expect(mapStripeStatus('')).toBeNull();
  });
});

describe('syncSubscriptionFromStripe', () => {
  it('re-fetches from Stripe rather than trusting the event payload', async () => {
    await syncSubscriptionFromStripe(SUB_ID);
    expect(mockRetrieveSubscription).toHaveBeenCalledWith(SUB_ID);
  });

  it('writes both tables inside one transaction (D-14)', async () => {
    await syncSubscriptionFromStripe(SUB_ID);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(profileWrite().subscriptionStatus).toBe('trialing');
  });

  it('upserts the billing row on venue_id', async () => {
    await syncSubscriptionFromStripe(SUB_ID);
    expect(mockInsertValues).toHaveBeenCalledTimes(1);
    expect(subscriptionWrite()).toMatchObject({
      venueId: VENUE_ID,
      stripeSubscriptionId: SUB_ID,
      stripeCustomerId: CUSTOMER_ID,
      plan: 'monthly',
    });
  });

  it('never branches on the SELECT — two concurrent first events cannot both insert', async () => {
    // The race this closes: read and write are separate statements under READ
    // COMMITTED, so both callers saw no row and both INSERTed, one dying on the unique
    // violation. Stripe fans out subscription.created and invoice.paid together and
    // there is deliberately no processed-event table to serialise them.
    mockSelectLimit.mockResolvedValue([]);
    await syncSubscriptionFromStripe(SUB_ID);

    expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1);
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.anything() as unknown })
    );
  });

  it('takes the same upsert path when a row already exists', async () => {
    mockSelectLimit.mockResolvedValue([
      { id: 'row1', trialEndsAt: null, pastDueSince: null, plan: 'monthly' },
    ]);
    await syncSubscriptionFromStripe(SUB_ID);

    // One code path for both cases — no insert-vs-update branch left to get wrong.
    expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it('derives the interval from the Stripe price', async () => {
    mockRetrieveSubscription.mockResolvedValue(
      stripeSubscription({
        items: {
          data: [
            {
              price: { recurring: { interval: 'year' } },
              current_period_start: 1,
              current_period_end: 2,
            },
          ],
        },
      })
    );
    await syncSubscriptionFromStripe(SUB_ID);
    expect(subscriptionWrite().plan).toBe('annual');
  });

  it('converts Stripe epoch seconds to real dates', async () => {
    await syncSubscriptionFromStripe(SUB_ID);
    const write = subscriptionWrite();
    expect(write.trialEndsAt).toBeInstanceOf(Date);
    expect((write.trialEndsAt as Date).toISOString()).toBe(
      new Date(1_776_000_000 * 1000).toISOString()
    );
  });

  it('is idempotent — a redelivered event produces the same write', async () => {
    await syncSubscriptionFromStripe(SUB_ID);
    const first = { ...subscriptionWrite() };
    vi.clearAllMocks();
    mockSelectLimit.mockResolvedValue([]);
    mockUpdateSet.mockImplementation(() => ({ where: mockUpdateWhere }));
    mockRetrieveSubscription.mockResolvedValue(stripeSubscription());
    await syncSubscriptionFromStripe(SUB_ID);
    const second = subscriptionWrite();
    expect({ ...second, updatedAt: null }).toEqual({ ...first, updatedAt: null });
  });

  describe('unresolvable input is inert, not destructive', () => {
    it('writes nothing when no venue can be resolved', async () => {
      mockRetrieveSubscription.mockResolvedValue(
        stripeSubscription({ metadata: {}, customer: null })
      );
      await syncSubscriptionFromStripe(SUB_ID);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('writes nothing for an unmapped Stripe status', async () => {
      mockRetrieveSubscription.mockResolvedValue(
        stripeSubscription({ status: 'some_future_status' })
      );
      await syncSubscriptionFromStripe(SUB_ID);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('falls back to the customer id when metadata is absent', async () => {
      mockRetrieveSubscription.mockResolvedValue(stripeSubscription({ metadata: {} }));
      mockSelectLimit.mockResolvedValueOnce([{ venueId: VENUE_ID }]);
      await syncSubscriptionFromStripe(SUB_ID);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('trial_ends_at is the record of a consumed trial (D-42)', () => {
    it('never clears an existing trial end date', async () => {
      const original = new Date('2027-02-17T00:00:00.000Z');
      mockSelectLimit.mockResolvedValue([
        { id: 'row1', trialEndsAt: original, pastDueSince: null },
      ]);
      mockRetrieveSubscription.mockResolvedValue(
        stripeSubscription({ status: 'canceled', trial_end: null })
      );

      await syncSubscriptionFromStripe(SUB_ID);
      // If a cancellation wiped this, the venue would get a second free trial.
      expect(subscriptionWrite().trialEndsAt).toBe(original);
    });

    it('records it on first sight', async () => {
      mockSelectLimit.mockResolvedValue([{ id: 'row1', trialEndsAt: null, pastDueSince: null }]);
      await syncSubscriptionFromStripe(SUB_ID);
      expect(subscriptionWrite().trialEndsAt).toBeInstanceOf(Date);
    });
  });

  describe('grace-window marker', () => {
    it('preserves past_due_since while still past_due', async () => {
      const since = new Date('2026-08-15T00:00:00.000Z');
      mockSelectLimit.mockResolvedValue([{ id: 'row1', trialEndsAt: null, pastDueSince: since }]);
      mockRetrieveSubscription.mockResolvedValue(stripeSubscription({ status: 'past_due' }));
      await syncSubscriptionFromStripe(SUB_ID);
      // Resetting it on each retry would mean the window never expires.
      expect(subscriptionWrite().pastDueSince).toBe(since);
    });

    it('clears it once the subscription is healthy again (D-36)', async () => {
      mockSelectLimit.mockResolvedValue([
        { id: 'row1', trialEndsAt: null, pastDueSince: new Date('2026-08-15T00:00:00.000Z') },
      ]);
      mockRetrieveSubscription.mockResolvedValue(stripeSubscription({ status: 'active' }));
      await syncSubscriptionFromStripe(SUB_ID);
      expect(subscriptionWrite().pastDueSince).toBeNull();
    });
  });

  describe('activation token consumption (D-17)', () => {
    it('consumes the token once the subscription is paying', async () => {
      mockRetrieveSubscription.mockResolvedValue(
        stripeSubscription({
          status: 'active',
          metadata: { venueId: VENUE_ID, activationTokenId: 'tok_1' },
        })
      );
      await syncSubscriptionFromStripe(SUB_ID);
      expect(mockMarkConsumed).toHaveBeenCalledWith('tok_1');
    });

    it('consumes it on a trial start too — the card is already committed', async () => {
      mockRetrieveSubscription.mockResolvedValue(
        stripeSubscription({ metadata: { venueId: VENUE_ID, activationTokenId: 'tok_1' } })
      );
      await syncSubscriptionFromStripe(SUB_ID);
      expect(mockMarkConsumed).toHaveBeenCalledWith('tok_1');
    });

    it('leaves the token usable when checkout did not result in payment (D-24)', async () => {
      mockRetrieveSubscription.mockResolvedValue(
        stripeSubscription({
          status: 'incomplete',
          metadata: { venueId: VENUE_ID, activationTokenId: 'tok_1' },
        })
      );
      await syncSubscriptionFromStripe(SUB_ID);
      expect(mockMarkConsumed).not.toHaveBeenCalled();
    });
  });
});

describe('recordInvoicePaymentFailure', () => {
  it('records the first failure as the grace-window origin (D-64)', async () => {
    mockSelectLimit.mockResolvedValue([{ id: 'row1', pastDueSince: null }]);
    const at = new Date('2026-08-18T10:00:00.000Z');
    await recordInvoicePaymentFailure(CUSTOMER_ID, at);
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ pastDueSince: at }));
  });

  it('leaves an existing origin alone, so the window actually expires', async () => {
    const original = new Date('2026-08-15T00:00:00.000Z');
    mockSelectLimit.mockResolvedValue([{ id: 'row1', pastDueSince: original }]);
    await recordInvoicePaymentFailure(CUSTOMER_ID, new Date('2026-08-18T10:00:00.000Z'));
    // Stripe retries several times; restarting the clock on each would keep an
    // unpaid venue visible indefinitely.
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('does nothing for an unknown customer', async () => {
    mockSelectLimit.mockResolvedValue([]);
    await recordInvoicePaymentFailure('cus_unknown');
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });
});

describe('clearPastDueMarker', () => {
  it('nulls the origin on recovery', async () => {
    await clearPastDueMarker(CUSTOMER_ID);
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ pastDueSince: null }));
  });
});

describe('blockBillingForCustomer', () => {
  it('blocks billing and hides the venue immediately (D-51)', async () => {
    mockSelectLimit.mockResolvedValue([{ id: 'row1', venueId: VENUE_ID }]);
    await blockBillingForCustomer(CUSTOMER_ID);

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    const writes = mockUpdateSet.mock.calls.map((_c, i) =>
      callArg<Record<string, unknown>>(mockUpdateSet, i)
    );
    expect(writes.some((w) => w.billingBlocked === true)).toBe(true);
    // A dispute is not an innocent card failure — no grace window applies.
    expect(writes.some((w) => w.subscriptionStatus === 'cancelled')).toBe(true);
  });

  it('does nothing for an unknown customer rather than blocking the wrong account', async () => {
    mockSelectLimit.mockResolvedValue([]);
    await blockBillingForCustomer('cus_unknown');
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockCancelSubscription).not.toHaveBeenCalled();
  });

  it('cancels the subscription at Stripe, or the block reverts within a cycle', async () => {
    // Without this the subscription keeps billing and the next invoice.paid re-syncs
    // the venue to `active`, undoing the local write above.
    mockSelectLimit.mockResolvedValue([
      { id: 'row1', venueId: VENUE_ID, stripeSubscriptionId: 'sub_disputed' },
    ]);
    await blockBillingForCustomer(CUSTOMER_ID);

    expect(mockCancelSubscription).toHaveBeenCalledWith('sub_disputed');
  });

  it('keeps the local block when the Stripe cancel fails', async () => {
    // Degrades to "hidden but still billing", which is recoverable by hand. Losing the
    // block instead would put a disputed venue back on the map.
    mockSelectLimit.mockResolvedValue([
      { id: 'row1', venueId: VENUE_ID, stripeSubscriptionId: 'sub_disputed' },
    ]);
    mockCancelSubscription.mockRejectedValue(new Error('stripe down'));

    await expect(blockBillingForCustomer(CUSTOMER_ID)).resolves.toBeUndefined();
    const writes = mockUpdateSet.mock.calls.map((_c, i) =>
      callArg<Record<string, unknown>>(mockUpdateSet, i)
    );
    expect(writes.some((w) => w.billingBlocked === true)).toBe(true);
  });

  it('skips the Stripe call when no subscription id was ever recorded', async () => {
    mockSelectLimit.mockResolvedValue([
      { id: 'row1', venueId: VENUE_ID, stripeSubscriptionId: null },
    ]);
    await blockBillingForCustomer(CUSTOMER_ID);

    expect(mockCancelSubscription).not.toHaveBeenCalled();
  });
});

describe('handleStripeSubscriptionEvent', () => {
  const event = (type: string, object: Record<string, unknown>) =>
    ({ id: 'evt_1', type, data: { object } }) as never;

  it.each([
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.subscription.trial_will_end',
  ])('syncs on %s', async (type) => {
    await handleStripeSubscriptionEvent(event(type, { id: SUB_ID }));
    expect(mockRetrieveSubscription).toHaveBeenCalledWith(SUB_ID);
  });

  it('records the failure origin on invoice.payment_failed', async () => {
    mockSelectLimit.mockResolvedValue([{ id: 'row1', pastDueSince: null }]);
    await handleStripeSubscriptionEvent(event('invoice.payment_failed', { customer: CUSTOMER_ID }));
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ pastDueSince: expect.any(Date) as unknown })
    );
  });

  it('clears the marker and re-syncs on invoice.paid', async () => {
    await handleStripeSubscriptionEvent(
      event('invoice.paid', {
        customer: CUSTOMER_ID,
        parent: { subscription_details: { subscription: SUB_ID } },
      })
    );
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ pastDueSince: null }));
    expect(mockRetrieveSubscription).toHaveBeenCalledWith(SUB_ID);
  });

  it('reads the legacy top-level subscription field on an invoice too', async () => {
    // Where this lives moved between API versions; both shapes must resolve so an
    // SDK upgrade cannot silently stop renewals being recorded.
    await handleStripeSubscriptionEvent(
      event('invoice.paid', { customer: CUSTOMER_ID, subscription: SUB_ID })
    );
    expect(mockRetrieveSubscription).toHaveBeenCalledWith(SUB_ID);
  });

  it('resolves the customer behind a dispute via its charge', async () => {
    // A Stripe Dispute carries no customer of its own.
    mockRetrieveCharge.mockResolvedValue({ customer: CUSTOMER_ID });
    mockSelectLimit.mockResolvedValue([{ id: 'row1', venueId: VENUE_ID }]);

    await handleStripeSubscriptionEvent(event('charge.dispute.created', { charge: 'ch_1' }));

    expect(mockRetrieveCharge).toHaveBeenCalledWith('ch_1');
    const writes = mockUpdateSet.mock.calls.map((_c, i) =>
      callArg<Record<string, unknown>>(mockUpdateSet, i)
    );
    expect(writes.some((w) => w.billingBlocked === true)).toBe(true);
  });

  it('blocks nothing if the charge behind a dispute cannot be read', async () => {
    mockRetrieveCharge.mockRejectedValue(new Error('stripe down'));
    await handleStripeSubscriptionEvent(event('charge.dispute.created', { charge: 'ch_1' }));
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('acknowledges an unsubscribed event type without touching anything', async () => {
    await handleStripeSubscriptionEvent(event('payment_intent.succeeded', { id: 'pi_1' }));
    expect(mockRetrieveSubscription).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });
});

describe('plan is never guessed (H5 — chargeback risk)', () => {
  it('keeps the stored interval when Stripe sends no recurring block', async () => {
    // Relabelling an annual subscriber as monthly makes the trial-ending email quote
    // €19.99 seven days before we take €199.
    mockSelectLimit.mockResolvedValue([
      { id: 'row1', trialEndsAt: null, pastDueSince: null, plan: 'annual' },
    ]);
    mockRetrieveSubscription.mockResolvedValue({
      id: 'sub_1',
      status: 'active',
      customer: CUSTOMER_ID,
      cancel_at_period_end: false,
      trial_end: null,
      items: { data: [{ price: {}, current_period_start: null, current_period_end: null }] },
      metadata: { venueId: VENUE_ID },
    });

    await syncSubscriptionFromStripe('sub_1', {});

    // The billing row is upserted, so the payload is on insert().values().
    expect(subscriptionWrite()).toMatchObject({ plan: 'annual' });
  });

  it('throws rather than defaulting when there is no interval and no stored plan', async () => {
    mockSelectLimit.mockResolvedValue([]);
    mockRetrieveSubscription.mockResolvedValue({
      id: 'sub_2',
      status: 'active',
      customer: CUSTOMER_ID,
      cancel_at_period_end: false,
      trial_end: null,
      items: { data: [{ price: {}, current_period_start: null, current_period_end: null }] },
      metadata: { venueId: VENUE_ID },
    });

    // 500 means Stripe retries and someone sees it, which beats a plausible wrong row.
    await expect(syncSubscriptionFromStripe('sub_2', {})).rejects.toThrow(/refusing to guess/);
  });
});

describe('past_due always records an origin (H6)', () => {
  it('stamps pastDueSince when the row goes past_due without one', async () => {
    // recordInvoicePaymentFailure no-ops when no row matches the customer, so a
    // first-invoice failure at trial end can land here with nothing recorded. A null
    // origin makes venueVisibilityFor fail open permanently — free visibility forever.
    mockSelectLimit.mockResolvedValue([
      { id: 'row1', trialEndsAt: null, pastDueSince: null, plan: 'monthly' },
    ]);
    mockRetrieveSubscription.mockResolvedValue({
      id: 'sub_3',
      status: 'past_due',
      customer: CUSTOMER_ID,
      cancel_at_period_end: false,
      trial_end: null,
      items: {
        data: [
          {
            price: { recurring: { interval: 'month' } },
            current_period_start: null,
            current_period_end: null,
          },
        ],
      },
      metadata: { venueId: VENUE_ID },
    });

    await syncSubscriptionFromStripe('sub_3', {});

    expect(subscriptionWrite().pastDueSince).toBeInstanceOf(Date);
  });

  it('preserves an existing origin rather than resetting the grace window', async () => {
    const original = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    mockSelectLimit.mockResolvedValue([
      { id: 'row1', trialEndsAt: null, pastDueSince: original, plan: 'monthly' },
    ]);
    mockRetrieveSubscription.mockResolvedValue({
      id: 'sub_4',
      status: 'past_due',
      customer: CUSTOMER_ID,
      cancel_at_period_end: false,
      trial_end: null,
      items: {
        data: [
          {
            price: { recurring: { interval: 'month' } },
            current_period_start: null,
            current_period_end: null,
          },
        ],
      },
      metadata: { venueId: VENUE_ID },
    });

    await syncSubscriptionFromStripe('sub_4', {});

    // Re-stamping on every redelivered event would restart the 7-day window each time.
    expect(subscriptionWrite().pastDueSince).toBe(original);
  });
});
