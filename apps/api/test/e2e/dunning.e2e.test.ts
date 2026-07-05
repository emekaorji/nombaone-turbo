import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  customersTable,
  domainEventsTable,
  dunningAttemptsTable,
  invoicesTable,
  paymentMethodsTable,
  subscriptionsTable,
} from '@nombaone/core-db/schema';
import { runCycle } from '@/domain/billing';
import { createCustomer } from '@/domain/customers';
import { processInboundDunningEvent, runDunningSweep } from '@/domain/dunning';
import { createPlan } from '@/domain/plans';
import { createPrice } from '@/domain/prices';
import { registerRail } from '@nombaone/sara/rails';
import { mintReference } from '@nombaone/sara/reference';
import { loadSubscriptionRow } from '@/domain/subscriptions';

import { startHarness, type Harness } from '../helpers/harness';

import type { PaymentFailureReason , NombaClient } from '@nombaone/sara/nomba';

// Scriptable rail: drive the scripted outcome + failure reason + count charges.
let railStatus: 'succeeded' | 'failed' | 'pending' = 'succeeded';
let railReason: PaymentFailureReason = 'insufficient_funds';
let railCallCount = 0;

const fakeNomba: NombaClient = {
  getToken: async () => 'tok',
  async request<T = unknown>() {
    return { status: 200, ok: true, data: {} as T };
  },
  requeryTransaction: async () => ({ found: true, succeeded: true, amount: 0 }),
};

describe('dunning & recovery e2e (★ D/E)', () => {
  let harness: Harness;
  let bearerA: string;
  let ctxA: { organizationId: string; mode: 'sandbox' };

  const scopes = [
    'customers:read',
    'customers:write',
    'subscriptions:read',
    'subscriptions:write',
    'billing_settings:read',
    'billing_settings:write',
  ];

  beforeAll(async () => {
    harness = await startHarness();
    harness.setNombaClient(fakeNomba);
    registerRail({
      key: 'card',
      direction: 'pull',
      collect: async () => {
        railCallCount += 1;
        if (railStatus === 'failed') return { status: 'failed', failureReason: railReason };
        if (railStatus === 'pending') return { status: 'pending', providerReference: 'nomba_px' };
        return { status: 'succeeded' };
      },
    });
    registerRail({ key: 'mandate', direction: 'pull', collect: async () => ({ status: railStatus }) });
    registerRail({
      key: 'transfer',
      direction: 'push',
      collect: async () => ({ status: 'pending', payInstructions: {} }),
    });

    const orgA = await harness.seedOrg('Dun A');
    bearerA = (await harness.mintApiKey(orgA.organizationId, 'sandbox', scopes)).secret;
    ctxA = { organizationId: orgA.organizationId, mode: 'sandbox' };
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const asA = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearerA}`);
  let seq = 0;
  const uniq = (): string => `${Date.now()}-${seq++}`;

  async function seedActiveCardSub(unit = 500000): Promise<{ subRef: string; subId: string; customerRef: string }> {
    const u = uniq();
    const customer = await createCustomer(harness.db, ctxA, { email: `d${u}@acme.test`, name: 'C' });
    const plan = await createPlan(harness.db, ctxA, { name: `Plan ${u}` });
    const price = await createPrice(harness.db, ctxA, {
      planRef: plan.id, unitAmount: unit, interval: 'month', intervalCount: 1, usageType: 'licensed', billingScheme: 'per_unit', trialPeriodDays: 0,
    });
    const [c] = await harness.db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(and(eq(customersTable.organizationId, ctxA.organizationId), eq(customersTable.reference, customer.id)))
      .limit(1);
    const pmRef = mintReference('PMT');
    await harness.db.insert(paymentMethodsTable).values({
      reference: pmRef, organizationId: ctxA.organizationId, mode: 'sandbox', customerId: c!.id,
      kind: 'card', status: 'active', tokenKey: 'tok_test', brand: 'visa', last4: '4242', isDefault: true,
    });
    railStatus = 'succeeded';
    const res = await asA(request(harness.app).post('/v1/subscriptions'))
      .set('Idempotency-Key', `s-${uniq()}`)
      .send({ customerId: customer.id, priceId: price.id, paymentMethodId: pmRef });
    const subRef = res.body.data.id as string;
    const subId = (await loadSubscriptionRow(harness.db, ctxA, subRef)).id;
    return { subRef, subId, customerRef: customer.id };
  }

  async function setDue(subRef: string): Promise<void> {
    const row = await loadSubscriptionRow(harness.db, ctxA, subRef);
    await harness.db.update(subscriptionsTable).set({ nextBillingAt: new Date(Date.now() - 60_000) }).where(eq(subscriptionsTable.id, row.id));
  }

  // Force a renewal charge to fail with a scripted reason → sub past_due, invoice open.
  async function failRenewal(subRef: string, reason: PaymentFailureReason): Promise<void> {
    railStatus = 'failed';
    railReason = reason;
    await setDue(subRef);
    await runCycle(harness.db, ctxA, subRef);
  }

  const sweep = () => runDunningSweep({ db: harness.db, mode: 'sandbox', now: new Date(), batchSize: 100 });

  async function makeAttemptsDue(subId: string): Promise<void> {
    await harness.db
      .update(dunningAttemptsTable)
      .set({ nextAttemptAt: new Date(Date.now() - 60_000) })
      .where(and(eq(dunningAttemptsTable.subscriptionId, subId), eq(dunningAttemptsTable.status, 'scheduled')));
  }

  async function attemptsFor(subId: string) {
    return harness.db
      .select()
      .from(dunningAttemptsTable)
      .where(eq(dunningAttemptsTable.subscriptionId, subId))
      .orderBy(dunningAttemptsTable.attemptNumber);
  }

  async function eventTypesFor(reference: string): Promise<string[]> {
    const rows = await harness.db
      .select({ type: domainEventsTable.type, payload: domainEventsTable.payload })
      .from(domainEventsTable)
      .where(eq(domainEventsTable.organizationId, ctxA.organizationId));
    return rows.filter((r) => (r.payload as { reference?: string }).reference === reference).map((r) => r.type);
  }

  // ── D1/D8 recovery ─────────────────────────────────────────────────────────
  it('D1/D8 — insufficient_funds → past_due → scheduled retry → recovery (active + invoice paid)', async () => {
    const { subRef, subId } = await seedActiveCardSub();
    await failRenewal(subRef, 'insufficient_funds');

    expect((await loadSubscriptionRow(harness.db, ctxA, subRef)).status).toBe('past_due');
    await sweep(); // DETECT: schedule attempt #1
    const [a1] = await attemptsFor(subId);
    expect(a1!.attemptNumber).toBe(1);
    expect(a1!.branch).toBe('reschedule');
    expect(a1!.status).toBe('scheduled');

    // The retry succeeds → recovery.
    railStatus = 'succeeded';
    await makeAttemptsDue(subId);
    await sweep(); // EXECUTE attempt #1

    const sub = await asA(request(harness.app).get(`/v1/subscriptions/${subRef}`));
    expect(sub.body.data.status).toBe('active'); // D8
    const [inv] = await harness.db.select({ reference: invoicesTable.reference, paidAt: invoicesTable.paidAt }).from(invoicesTable).where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.periodIndex, 1)));
    expect(inv!.paidAt).toBeTruthy();
    expect(await eventTypesFor(inv!.reference)).toContain('invoice.payment_recovered');
  });

  // ── D4 ★ / D5 expired card → card-update, NEVER a blind retry ───────────────
  it('D4 ★ — expired_card branches to card_update_required with ZERO charge re-attempts', async () => {
    const { subRef, subId } = await seedActiveCardSub();
    await failRenewal(subRef, 'expired_card');

    await sweep(); // DETECT
    const callsAfterDetect = railCallCount;
    await sweep(); // a second tick must NOT charge (card_update_required is never due)
    await sweep();
    expect(railCallCount).toBe(callsAfterDetect); // D4 ★ — no blind retries

    const [a1] = await attemptsFor(subId);
    expect(a1!.branch).toBe('card_update_required');
    expect(a1!.status).toBe('card_update_required');
    expect(a1!.nextAttemptAt).toBeNull();
    const [inv] = await harness.db.select({ reference: invoicesTable.reference }).from(invoicesTable).where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.periodIndex, 1)));
    expect(await eventTypesFor(inv!.reference)).toContain('payment_method.expiring'); // D5 prompt
  });

  // ── E6 ★ / D10 card update mid-dunning → atomic swap + immediate re-attempt ──
  it('E6 ★ / D10 — a card update swaps the token atomically and triggers an immediate recovery', async () => {
    const { subRef, subId } = await seedActiveCardSub();
    await failRenewal(subRef, 'expired_card');
    await sweep(); // card_update_required

    // Update the card (new token) — atomic swap; the sub's default now has a valid token.
    railStatus = 'succeeded';
    const updated = await asA(request(harness.app).post(`/v1/subscriptions/${subRef}/payment-method`))
      .set('Idempotency-Key', `cu-${uniq()}`)
      .send({ checkoutToken: 'tok_new_valid' });
    expect(updated.status).toBe(200);

    // E6: default_payment_method_id points at an ACTIVE row that HAS a token.
    const sub = await loadSubscriptionRow(harness.db, ctxA, subRef);
    const [defPm] = await harness.db.select().from(paymentMethodsTable).where(eq(paymentMethodsTable.id, sub.defaultPaymentMethodId!));
    expect(defPm!.status).toBe('active');
    expect(defPm!.tokenKey).toBe('tok_new_valid');

    // D10: the held attempt was armed to run now → the next sweep recovers immediately.
    const [held] = await attemptsFor(subId);
    expect(held!.status).toBe('scheduled'); // flipped from card_update_required
    await sweep();
    expect((await loadSubscriptionRow(harness.db, ctxA, subRef)).status).toBe('active');
  });

  // ── D6 / D13 ★ hard decline → short path → involuntary churn ────────────────
  it('D6 / D13 ★ — hard_decline takes the short path to involuntary churn (distinct event)', async () => {
    const { subRef, subId } = await seedActiveCardSub();
    await failRenewal(subRef, 'hard_decline');
    await sweep(); // DETECT: attempt #1 short_path scheduled

    await makeAttemptsDue(subId);
    railStatus = 'failed';
    railReason = 'hard_decline';
    await sweep(); // EXECUTE the courtesy retry → fails → churn

    const sub = await asA(request(harness.app).get(`/v1/subscriptions/${subRef}`));
    expect(sub.body.data.status).toBe('canceled'); // D6
    expect(sub.body.data.cancellationReason).toBe('involuntary'); // D13 ★
    expect(await eventTypesFor(subRef)).toContain('subscription.churned');
    const [inv] = await harness.db.select({ uncollectibleAt: invoicesTable.uncollectibleAt }).from(invoicesTable).where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.periodIndex, 1)));
    expect(inv!.uncollectibleAt).toBeTruthy();
  });

  // ── D9 ⚠ idempotent comms + K4/J6 no duplicate attempt ──────────────────────
  it('D9 ⚠ / K4 — a replayed sweep re-sends nothing and creates no duplicate attempt', async () => {
    const { subRef, subId } = await seedActiveCardSub();
    await failRenewal(subRef, 'insufficient_funds');

    await sweep();
    await sweep(); // replay the DETECT pass
    await sweep();

    const [inv] = await harness.db.select({ reference: invoicesTable.reference }).from(invoicesTable).where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.periodIndex, 1)));
    const failedEvents = (await eventTypesFor(inv!.reference)).filter((t) => t === 'invoice.payment_failed');
    expect(failedEvents).toHaveLength(1); // D9 — exactly one comms
    const a1 = (await attemptsFor(subId)).filter((a) => a.attemptNumber === 1);
    expect(a1).toHaveLength(1); // no duplicate attempt row
  });

  // ── D11 every attempt logged + inspect endpoint ─────────────────────────────
  it('D11 — every attempt is logged with failure reason + outcome, and inspectable', async () => {
    const { subRef, subId } = await seedActiveCardSub();
    await failRenewal(subRef, 'insufficient_funds');
    await sweep(); // #1 scheduled

    railStatus = 'failed';
    railReason = 'insufficient_funds';
    await makeAttemptsDue(subId);
    await sweep(); // #1 executes, fails → #2 scheduled

    const state = await asA(request(harness.app).get(`/v1/subscriptions/${subRef}/dunning`));
    expect(state.status).toBe(200);
    expect(state.body.data.attemptsUsed).toBeGreaterThanOrEqual(2);

    const list = await asA(request(harness.app).get(`/v1/subscriptions/${subRef}/dunning/attempts`));
    expect(list.body.data.length).toBeGreaterThanOrEqual(2);
    const first = list.body.data.find((a: { attemptNumber: number }) => a.attemptNumber === 1);
    expect(first.failureReason).toBe('insufficient_funds');
    expect(first.outcome).toBe('rescheduled');
  });

  // ── D2 config: schedule is per-tenant configurable ─────────────────────────
  it('D2 — billing-settings round-trips and a reduced max-attempts exhausts sooner', async () => {
    const put = await asA(request(harness.app).put('/v1/organization/billing'))
      .set('Idempotency-Key', `bs-${uniq()}`)
      .send({ dunningMaxAttempts: 1, dunningIntervalsHours: [1], dunningMaxWindowHours: 1, paydayBiasEnabled: false });
    expect(put.status).toBe(200);
    expect(put.body.data.dunningMaxAttempts).toBe(1);
    const get = await asA(request(harness.app).get('/v1/organization/billing'));
    expect(get.body.data.dunningMaxAttempts).toBe(1);

    // With maxAttempts=1, the first executed retry that fails exhausts → churn.
    const { subRef, subId } = await seedActiveCardSub();
    await failRenewal(subRef, 'insufficient_funds');
    await sweep(); // #1 scheduled
    railStatus = 'failed';
    railReason = 'insufficient_funds';
    await makeAttemptsDue(subId);
    await sweep(); // #1 executes, fails, attemptsUsed(1) >= max(1) → churn
    expect((await loadSubscriptionRow(harness.db, ctxA, subRef)).status).toBe('canceled');
  });

  // ── N4 auth + isolation ─────────────────────────────────────────────────────
  it('N4 — dunning + billing-settings routes reject missing key / wrong scope', async () => {
    const { subRef } = await seedActiveCardSub();
    expect((await request(harness.app).get(`/v1/subscriptions/${subRef}/dunning`)).status).toBe(401);
    expect((await request(harness.app).get('/v1/organization/billing')).status).toBe(401);

    const orgC = await harness.seedOrg('Dun RO');
    const ro = (await harness.mintApiKey(orgC.organizationId, 'sandbox', ['subscriptions:read'])).secret;
    const forbidden = await request(harness.app)
      .put('/v1/organization/billing')
      .set('Authorization', `Bearer ${ro}`)
      .set('Idempotency-Key', `bs-${uniq()}`)
      .send({ dunningMaxAttempts: 3 });
    expect(forbidden.status).toBe(403);
  });

  // ── item 9: async card-charge → dunning bridge ──────────────────────────────
  async function pendingRetry(): Promise<{ subRef: string; subId: string; attemptRef: string; invRef: string; amountDue: number }> {
    // Reset the tenant's dunning policy to defaults (an earlier test lowered maxAttempts).
    await asA(request(harness.app).put('/v1/organization/billing')).set('Idempotency-Key', `rst-${uniq()}`)
      .send({ dunningMaxAttempts: 4, dunningMaxWindowHours: 336, dunningIntervalsHours: [24, 72, 120, 168] });
    const { subRef, subId } = await seedActiveCardSub();
    await failRenewal(subRef, 'insufficient_funds'); // → past_due
    await sweep(); // schedule attempt #1
    railStatus = 'pending'; // the retry is accepted, awaiting the async result
    await makeAttemptsDue(subId);
    await sweep(); // execute #1 → pending → re-armed
    const [a1] = await attemptsFor(subId);
    expect(a1!.status).toBe('scheduled');
    expect(a1!.outcome).toBe('pending');
    const [inv] = await harness.db.select({ reference: invoicesTable.reference, amountDue: invoicesTable.amountDue }).from(invoicesTable).where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.periodIndex, 1)));
    return { subRef, subId, attemptRef: a1!.reference, invRef: inv!.reference, amountDue: inv!.amountDue };
  }

  const clientRequerying = (r: { succeeded: boolean; amount?: number; status?: string; gatewayMessage?: string }): NombaClient => ({
    getToken: async () => 'tok',
    async request<T = unknown>() { return { status: 200, ok: true, data: {} as T }; },
    requeryTransaction: async () => ({ found: true, ...r }),
  });

  it('item 9 — an async dunning retry that SUCCEEDS at Nomba is settled + recovered via the DUN-ref webhook', async () => {
    const { subRef, subId, attemptRef, invRef, amountDue } = await pendingRetry();

    // The real payment_success webhook carries the DUN attempt reference (not an invoice ref).
    const res = await processInboundDunningEvent(harness.db, () => clientRequerying({ succeeded: true, amount: amountDue }), {
      requestId: 'dun-ok-1', eventType: 'payment_success', payload: { data: { orderReference: attemptRef } },
    });
    expect(res.matched).toBe(true);
    expect(res.settled).toBe(true);

    expect((await loadSubscriptionRow(harness.db, ctxA, subRef)).status).toBe('active');
    const [after] = await harness.db.select({ paidAt: invoicesTable.paidAt }).from(invoicesTable).where(eq(invoicesTable.reference, invRef));
    expect(after!.paidAt).toBeTruthy();
    expect((await attemptsFor(subId))[0]!.status).toBe('succeeded');
    expect(await eventTypesFor(invRef)).toContain('invoice.payment_recovered');
  });

  it('item 9 — an async dunning retry that FAILS at Nomba drives the dunning branch (reschedule)', async () => {
    const { subRef, subId, attemptRef } = await pendingRetry();

    const res = await processInboundDunningEvent(harness.db, () => clientRequerying({ succeeded: false, status: 'failed', gatewayMessage: 'insufficient funds' }), {
      requestId: 'dun-fail-1', eventType: 'payment_failed', payload: { data: { orderReference: attemptRef } },
    });
    expect(res.matched).toBe(true);
    expect(res.settled).toBe(false);

    const attempts = await attemptsFor(subId);
    expect(attempts.find((a) => a.attemptNumber === 1)!.outcome).toBe('rescheduled');
    expect(attempts.length).toBeGreaterThanOrEqual(2); // a next attempt was scheduled
    expect((await loadSubscriptionRow(harness.db, ctxA, subRef)).status).toBe('past_due');
  });
});
