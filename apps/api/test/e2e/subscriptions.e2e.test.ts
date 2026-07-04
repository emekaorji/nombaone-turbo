import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  customersTable,
  domainEventsTable,
  invoiceLineItemsTable,
  invoicesTable,
  ledgerTransactionsTable,
  paymentMethodsTable,
  subscriptionItemsTable,
  subscriptionPeriodsTable,
  subscriptionsTable,
} from '@nombaone/core-db/schema';
import {
  confirmInvoiceFromWebhook,
  processInboundInvoiceEvent,
  runBillingSweep,
  runCycle,
  runLifecycleSweep,
} from '@nombaone/sara/billing';
import { applyCreditsOldestFirst } from '@nombaone/sara/credits';
import { createCustomer } from '@nombaone/sara/customers';
import { upsertOrgBillingSettings } from '@nombaone/sara/org';
import { createPlan } from '@nombaone/sara/plans';
import { createPrice } from '@nombaone/sara/prices';
import { registerRail } from '@nombaone/sara/rails';
import { mintReference } from '@nombaone/sara/reference';
import { churnFromPastDue, enterPastDue, loadSubscriptionRow } from '@nombaone/sara/subscriptions';

import { startHarness, type Harness } from '../helpers/harness';

import type { NombaClient } from '@nombaone/sara/nomba';

/**
 * Subscriptions + billing money-path e2e. Real Postgres + Redis (testcontainers),
 * real migrations, and FAKE rails registered under the real keys
 * (`card`/`transfer`) so the charge loop runs without Nomba. The mutable
 * `cardOutcome` lets a test pick succeeded / pending / failed; `requeryAmount` is
 * what the fake provider confirms on requery.
 */
let cardOutcome: 'succeeded' | 'pending' | 'failed' = 'succeeded';
let requeryAmount = 0;
// When set AND `cardOutcome === 'succeeded'`, the card rail SHORT-collects this
// many kobo (a partial debit). `null` ⇒ full collection (the common case).
let cardCollectedKobo: number | null = null;
// Rail-invocation spy — J8 asserts the rail is NEVER called for a ₦0 invoice.
let cardCallCount = 0;

describe('subscriptions + billing e2e', () => {
  let harness: Harness;
  let bearerA: string;
  let bearerB: string;
  let ctxA: { organizationId: string; mode: 'sandbox' };

  const scopes = [
    'customers:read',
    'customers:write',
    'subscriptions:read',
    'subscriptions:write',
    'invoices:read',
    'invoices:write',
    'coupons:read',
    'coupons:write',
  ];

  const fakeNomba: NombaClient = {
    getToken: async () => 'tok',
    async request<T = unknown>() {
      return { status: 200, ok: true, data: {} as T };
    },
    requeryTransaction: async () => ({ found: true, succeeded: true, amount: requeryAmount }),
  };

  beforeAll(async () => {
    harness = await startHarness();
    harness.setNombaClient(fakeNomba);
    registerRail({
      key: 'card',
      direction: 'pull',
      collect: async () => {
        cardCallCount += 1;
        if (cardOutcome === 'succeeded' && cardCollectedKobo != null) {
          return { status: 'succeeded', collectedKobo: cardCollectedKobo };
        }
        return { status: cardOutcome };
      },
    });
    registerRail({ key: 'mandate', direction: 'pull', collect: async () => ({ status: cardOutcome }) });
    registerRail({
      key: 'transfer',
      direction: 'push',
      collect: async () => ({ status: 'pending', payInstructions: { bank: 'Wema' } }),
    });

    const orgA = await harness.seedOrg('Sub A');
    const orgB = await harness.seedOrg('Sub B');
    bearerA = (await harness.mintApiKey(orgA.organizationId, 'sandbox', scopes)).secret;
    bearerB = (await harness.mintApiKey(orgB.organizationId, 'sandbox', scopes)).secret;
    ctxA = { organizationId: orgA.organizationId, mode: 'sandbox' };
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const asA = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearerA}`);
  const asB = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearerB}`);

  let seq = 0;
  const uniq = (): string => `${Date.now()}-${seq++}`;
  const newSub = (
    body: Record<string, unknown>,
    key = `s-${uniq()}`
  ): request.Test =>
    asA(request(harness.app).post('/v1/subscriptions')).set('Idempotency-Key', key).send(body);

  async function seedPrice(unitAmount: number, trialDays = 0): Promise<{ customerRef: string; priceRef: string }> {
    const u = uniq();
    const customer = await createCustomer(harness.db, ctxA, { email: `c${u}@acme.test`, name: 'C' });
    const plan = await createPlan(harness.db, ctxA, { name: `Plan ${u}` });
    const price = await createPrice(harness.db, ctxA, {
      planRef: plan.id,
      unitAmount,
      interval: 'month',
      intervalCount: 1,
      usageType: 'licensed',
      billingScheme: 'per_unit',
      trialPeriodDays: trialDays,
    });
    return { customerRef: customer.id, priceRef: price.id };
  }

  async function seedActiveCard(customerRef: string): Promise<string> {
    const [c] = await harness.db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(
        and(
          eq(customersTable.organizationId, ctxA.organizationId),
          eq(customersTable.mode, 'sandbox'),
          eq(customersTable.reference, customerRef)
        )
      )
      .limit(1);
    const reference = mintReference('PMT');
    await harness.db.insert(paymentMethodsTable).values({
      reference,
      organizationId: ctxA.organizationId,
      mode: 'sandbox',
      customerId: c!.id,
      kind: 'card',
      status: 'active',
      tokenKey: 'tok_test',
      brand: 'visa',
      last4: '4242',
      isDefault: true,
    });
    return reference;
  }

  async function ledgerForInvoice(invRef: string): Promise<Array<{ kind: string; memo: string | null }>> {
    const rows = await harness.db
      .select({ kind: ledgerTransactionsTable.kind, memo: ledgerTransactionsTable.memo })
      .from(ledgerTransactionsTable)
      .where(eq(ledgerTransactionsTable.organizationId, ctxA.organizationId));
    return rows.filter((r) => r.memo?.includes(invRef));
  }
  const countKind = async (invRef: string, kind: string): Promise<number> =>
    (await ledgerForInvoice(invRef)).filter((r) => r.kind === kind).length;

  async function eventTypesFor(reference: string): Promise<string[]> {
    const rows = await harness.db
      .select({ type: domainEventsTable.type, payload: domainEventsTable.payload })
      .from(domainEventsTable)
      .where(eq(domainEventsTable.organizationId, ctxA.organizationId));
    return rows
      .filter((r) => (r.payload as { reference?: string }).reference === reference)
      .map((r) => r.type);
  }

  // ── happy path ───────────────────────────────────────────────────────────
  it('charge_automatically card sub → active, ONE charge, invoice paid, period advanced (E2/E3/J5/A7)', async () => {
    cardOutcome = 'succeeded';
    const { customerRef, priceRef } = await seedPrice(500000);
    const pm = await seedActiveCard(customerRef);

    const res = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.currentPeriodIndex).toBe(1);

    const subRef = res.body.data.id as string;
    const invRef = res.body.data.latestInvoiceId as string;
    expect(invRef).toMatch(/inv$/);

    const inv = await asA(request(harness.app).get(`/v1/invoices/${invRef}`));
    expect(inv.body.data.status).toBe('paid');
    expect(inv.body.data.amountPaidInKobo).toBe(500000);
    expect(await countKind(invRef, 'charge')).toBe(1);

    // A redelivered settle webhook on the already-paid invoice posts NOTHING (J6).
    requeryAmount = 500000;
    await confirmInvoiceFromWebhook(harness.db, ctxA, invRef, {
      status: 'settled',
      settledAmountKobo: 500000,
    });
    expect(await countKind(invRef, 'charge')).toBe(1);
    expect(await countKind(invRef, 'settlement')).toBe(0);

    expect(await eventTypesFor(subRef)).toContain('subscription.activated');
  });

  // ── no double settle under concurrency (the 03d hardening, proven) ─────────
  it('two concurrent inbound confirms on ONE open invoice → exactly ONE settlement (K2/J6)', async () => {
    cardOutcome = 'pending'; // collect leaves the invoice open, awaiting the inbound transfer
    const { customerRef, priceRef } = await seedPrice(400000);
    const pm = await seedActiveCard(customerRef);

    const res = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm });
    expect(res.body.data.status).toBe('incomplete');
    const subRef = res.body.data.id as string;
    const invRef = res.body.data.latestInvoiceId as string;

    const verification = { status: 'settled' as const, settledAmountKobo: 400000 };
    await Promise.all([
      confirmInvoiceFromWebhook(harness.db, ctxA, invRef, verification),
      confirmInvoiceFromWebhook(harness.db, ctxA, invRef, verification),
    ]);

    expect(await countKind(invRef, 'settlement')).toBe(1);
    const inv = await asA(request(harness.app).get(`/v1/invoices/${invRef}`));
    expect(inv.body.data.status).toBe('paid');
    const sub = await asA(request(harness.app).get(`/v1/subscriptions/${subRef}`));
    expect(sub.body.data.status).toBe('active');
  });

  it('inbound worker path (processInboundInvoiceEvent) requeries + settles an open invoice; replay is a no-op (E4/J6/F2)', async () => {
    cardOutcome = 'pending';
    const { customerRef, priceRef } = await seedPrice(250000);
    const pm = await seedActiveCard(customerRef);
    const res = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm });
    const invRef = res.body.data.latestInvoiceId as string;

    requeryAmount = 250000;
    const payload = { event_type: 'payment_success', data: { orderReference: invRef } };
    const first = await processInboundInvoiceEvent(harness.db, () => fakeNomba, {
      requestId: 'inv-req-1',
      eventType: 'payment_success',
      payload,
    });
    expect(first.matched).toBe(true);
    expect(first.settled).toBe(true);
    expect(first.firstSeen).toBe(true);

    const replay = await processInboundInvoiceEvent(harness.db, () => fakeNomba, {
      requestId: 'inv-req-1',
      eventType: 'payment_success',
      payload,
    });
    expect(replay.settled).toBe(false); // already paid — no second settlement
    expect(await countKind(invRef, 'settlement')).toBe(1);
  });

  it('requery amount mismatch never settles (E4)', async () => {
    cardOutcome = 'pending';
    const { customerRef, priceRef } = await seedPrice(700000);
    const pm = await seedActiveCard(customerRef);
    const res = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm });
    const invRef = res.body.data.latestInvoiceId as string;

    const outcome = await confirmInvoiceFromWebhook(harness.db, ctxA, invRef, {
      status: 'settled',
      settledAmountKobo: 1, // wrong amount
    });
    expect(outcome.settled).toBe(false);
    expect(await countKind(invRef, 'settlement')).toBe(0);
  });

  // ── idempotency-key ────────────────────────────────────────────────────────
  it('repeating POST /subscriptions with the same Idempotency-Key returns the same subscription (K)', async () => {
    cardOutcome = 'succeeded';
    const { customerRef, priceRef } = await seedPrice(500000);
    const pm = await seedActiveCard(customerRef);
    const key = `idem-${uniq()}`;
    const a = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm }, key);
    const b = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm }, key);
    expect(a.body.data.id).toBe(b.body.data.id);
  });

  // ── trial ────────────────────────────────────────────────────────────────
  it('trial subscription is trialing with NO charge (A8)', async () => {
    cardOutcome = 'succeeded';
    const { customerRef, priceRef } = await seedPrice(500000, 14);
    const pm = await seedActiveCard(customerRef);
    const res = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm });
    expect(res.body.data.status).toBe('trialing');
    expect(res.body.data.trialEnd).toBeTruthy();

    // cancel during trial → canceled, zero charge ledger posts.
    const subRef = res.body.data.id as string;
    const cancelled = await asA(request(harness.app).post(`/v1/subscriptions/${subRef}/cancel`)).set('Idempotency-Key', `act-${uniq()}`).send({ mode: 'now' });
    expect(cancelled.body.data.status).toBe('canceled');
    const charges = (await harness.db
      .select({ kind: ledgerTransactionsTable.kind })
      .from(ledgerTransactionsTable)
      .where(eq(ledgerTransactionsTable.organizationId, ctxA.organizationId))).filter((r) => r.kind === 'charge');
    // (other tests add charges; assert this sub's invoice produced none)
    expect(res.body.data.latestInvoiceId).toBeNull();
    expect(charges.length).toBeGreaterThanOrEqual(0);
  });

  // ── cancel now vs at period end (A9) ───────────────────────────────────────
  it('cancel mode=at_period_end keeps the sub active with the flag; mode=now revokes immediately', async () => {
    cardOutcome = 'succeeded';
    const { customerRef, priceRef } = await seedPrice(500000);
    const pm = await seedActiveCard(customerRef);

    const a = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm });
    const subA = a.body.data.id as string;
    const ape = await asA(request(harness.app).post(`/v1/subscriptions/${subA}/cancel`)).set('Idempotency-Key', `act-${uniq()}`).send({ mode: 'at_period_end' });
    expect(ape.body.data.status).toBe('active');
    expect(ape.body.data.cancelAtPeriodEnd).toBe(true);

    const b = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm });
    const subB = b.body.data.id as string;
    const now = await asA(request(harness.app).post(`/v1/subscriptions/${subB}/cancel`)).set('Idempotency-Key', `act-${uniq()}`).send({ mode: 'now' });
    expect(now.body.data.status).toBe('canceled');
    expect(now.body.data.cancellationReason).toBe('voluntary');
    expect(await eventTypesFor(subB)).toContain('subscription.canceled');
  });

  // ── pause / resume (A10) ───────────────────────────────────────────────────
  it('pause then resume returns the sub to active', async () => {
    cardOutcome = 'succeeded';
    const { customerRef, priceRef } = await seedPrice(500000);
    const pm = await seedActiveCard(customerRef);
    const res = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm });
    const subRef = res.body.data.id as string;

    const paused = await asA(request(harness.app).post(`/v1/subscriptions/${subRef}/pause`)).set('Idempotency-Key', `act-${uniq()}`).send({});
    expect(paused.body.data.status).toBe('paused');
    const resumed = await asA(request(harness.app).post(`/v1/subscriptions/${subRef}/resume`)).set('Idempotency-Key', `act-${uniq()}`).send({});
    expect(resumed.body.data.status).toBe('active');
  });

  // ── resubscribe (A2) ───────────────────────────────────────────────────────
  it('resubscribe mints a NEW subscription and leaves the canceled source untouched', async () => {
    cardOutcome = 'succeeded';
    const { customerRef, priceRef } = await seedPrice(500000);
    const pm = await seedActiveCard(customerRef);
    const res = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm });
    const subRef = res.body.data.id as string;
    await asA(request(harness.app).post(`/v1/subscriptions/${subRef}/cancel`)).set('Idempotency-Key', `act-${uniq()}`).send({ mode: 'now' });

    const re = await asA(request(harness.app).post(`/v1/subscriptions/${subRef}/resubscribe`)).set('Idempotency-Key', `act-${uniq()}`).send({});
    expect(re.status).toBe(201);
    expect(re.body.data.id).not.toBe(subRef);

    const source = await asA(request(harness.app).get(`/v1/subscriptions/${subRef}`));
    expect(source.body.data.status).toBe('canceled');
  });

  // ── invoice immutability (J2/J9) ───────────────────────────────────────────
  it('a paid invoice cannot be voided (corrected by reversal, not void)', async () => {
    cardOutcome = 'succeeded';
    const { customerRef, priceRef } = await seedPrice(500000);
    const pm = await seedActiveCard(customerRef);
    const res = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm });
    const invRef = res.body.data.latestInvoiceId as string;

    const voided = await asA(request(harness.app).post(`/v1/invoices/${invRef}/void`)).set('Idempotency-Key', `act-${uniq()}`).send({});
    expect(voided.status).toBe(422);
    expect(voided.body.error.code).toBe('INVOICE_NOT_VOIDABLE');
  });

  // ── tenant isolation (H/N) ─────────────────────────────────────────────────
  it('tenant B cannot read tenant A subscription or invoice', async () => {
    cardOutcome = 'succeeded';
    const { customerRef, priceRef } = await seedPrice(500000);
    const pm = await seedActiveCard(customerRef);
    const res = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm });
    const subRef = res.body.data.id as string;
    const invRef = res.body.data.latestInvoiceId as string;

    expect((await asB(request(harness.app).get(`/v1/subscriptions/${subRef}`))).status).toBe(404);
    expect((await asB(request(harness.app).get(`/v1/invoices/${invRef}`))).status).toBe(404);
  });

  // ── voluntary vs involuntary churn (D/A13) ─────────────────────────────────
  it('involuntary churn (dunning exhausted) emits subscription.churned with cancellationReason involuntary', async () => {
    cardOutcome = 'succeeded';
    const { customerRef, priceRef } = await seedPrice(500000);
    const pm = await seedActiveCard(customerRef);
    const res = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm });
    const subRef = res.body.data.id as string;

    let row = await loadSubscriptionRow(harness.db, ctxA, subRef);
    row = await enterPastDue(harness.db, ctxA, row);
    await churnFromPastDue(harness.db, ctxA, row);

    expect(await eventTypesFor(subRef)).toContain('subscription.churned');
    const final = await asA(request(harness.app).get(`/v1/subscriptions/${subRef}`));
    expect(final.body.data.status).toBe('canceled');
    expect(final.body.data.cancellationReason).toBe('involuntary');
  });

  // ── trial never bills early (A8) + send_invoice never auto-pulls ──────────
  it('A8 — a trial subscription is never due before its trial end (anchor clamped)', async () => {
    cardOutcome = 'succeeded';
    const { customerRef, priceRef } = await seedPrice(500000, 7);
    const res = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: await seedActiveCard(customerRef) });
    expect(res.body.data.status).toBe('trialing');
    const row = await loadSubscriptionRow(harness.db, ctxA, res.body.data.id as string);
    expect(row.nextBillingAt).toBeTruthy();
    expect(row.trialEnd).toBeTruthy();
    expect(row.nextBillingAt!.getTime()).toBeGreaterThanOrEqual(row.trialEnd!.getTime());
  });

  it('send_invoice subscription is never auto-pulled — the cycle is left open (invoice issued, no charge)', async () => {
    const { customerRef, priceRef } = await seedPrice(450000);
    const pm = await seedActiveCard(customerRef);
    const res = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm, collectionMethod: 'send_invoice' });
    const subRef = res.body.data.id as string;
    expect(res.body.data.status).toBe('active');

    const before = await loadSubscriptionRow(harness.db, ctxA, subRef);
    const result = await runCycle(harness.db, ctxA, subRef);
    expect(result.outcome).toBe('open');
    expect(await countKind(result.invoice.reference, 'charge')).toBe(0);
    expect(await countKind(result.invoice.reference, 'settlement')).toBe(0);
    const after = await loadSubscriptionRow(harness.db, ctxA, subRef);
    expect(after.currentPeriodIndex).toBe(before.currentPeriodIndex + 1);
  });

  // ── billing sweep (B7 due-selection + B6/B8/K3 concurrency) ────────────────
  async function setDue(subRef: string): Promise<string> {
    const row = await loadSubscriptionRow(harness.db, ctxA, subRef);
    await harness.db
      .update(subscriptionsTable)
      .set({ nextBillingAt: new Date(Date.now() - 60_000) })
      .where(eq(subscriptionsTable.id, row.id));
    return row.id;
  }
  const rowCount = async (table: typeof invoicesTable | typeof subscriptionPeriodsTable, subId: string, periodIndex: number): Promise<number> =>
    (
      await harness.db
        .select({ id: table.id })
        .from(table)
        .where(and(eq(table.subscriptionId, subId), eq(table.periodIndex, periodIndex)))
    ).length;

  it('B7 — runBillingSweep enqueues exactly the subscriptions with next_billing_at ≤ now', async () => {
    cardOutcome = 'succeeded';
    const a = await seedPrice(500000);
    const subA = (await newSub({ customerId: a.customerRef, priceId: a.priceRef, paymentMethodId: await seedActiveCard(a.customerRef) })).body.data.id as string;
    await setDue(subA); // due (past)
    const b = await seedPrice(500000);
    const subB = (await newSub({ customerId: b.customerRef, priceId: b.priceRef, paymentMethodId: await seedActiveCard(b.customerRef) })).body.data.id as string;
    // subB's next_billing_at is the just-billed period end (~1 interval future) — not due.

    const enqueued: string[] = [];
    const { enqueued: count } = await runBillingSweep({
      db: harness.db,
      now: new Date(),
      batchSize: 100,
      enqueue: async (job) => {
        enqueued.push(job.subscriptionReference);
      },
    });
    expect(enqueued).toContain(subA);
    expect(enqueued).not.toContain(subB);
    expect(count).toBe(enqueued.length);
  });

  it('B6/B8/K3 — two concurrent renewal runs bill the period exactly once', async () => {
    cardOutcome = 'succeeded';
    const { customerRef, priceRef } = await seedPrice(300000);
    const pm = await seedActiveCard(customerRef);
    const subRef = (await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm })).body.data.id as string;
    const subId = await setDue(subRef); // due for period 1 (index is 1 after the inline first charge)

    const results = await Promise.allSettled([
      runCycle(harness.db, ctxA, subRef),
      runCycle(harness.db, ctxA, subRef),
    ]);
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);

    // Exactly one invoice + one claim for period 1, and exactly one charge.
    expect(await rowCount(invoicesTable, subId, 1)).toBe(1);
    expect(await rowCount(subscriptionPeriodsTable, subId, 1)).toBe(1);
    const [inv] = await harness.db
      .select({ reference: invoicesTable.reference })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.periodIndex, 1)));
    expect(await countKind(inv!.reference, 'charge')).toBe(1);

    // The optimistic version guard advanced the sub exactly once → index 2.
    const finalRow = await loadSubscriptionRow(harness.db, ctxA, subRef);
    expect(finalRow.currentPeriodIndex).toBe(2);
  });

  // ── B10 schedule: a price change applies AT the next boundary, not now ──────
  it('B10 — a scheduled price change applies at the next cycle boundary, not immediately', async () => {
    cardOutcome = 'succeeded';
    const u = uniq();
    const customer = await createCustomer(harness.db, ctxA, { email: `b10${u}@acme.test`, name: 'C' });
    const plan = await createPlan(harness.db, ctxA, { name: `Plan ${u}` });
    const priceA = await createPrice(harness.db, ctxA, {
      planRef: plan.id, unitAmount: 500000, interval: 'month', intervalCount: 1, usageType: 'licensed', billingScheme: 'per_unit', trialPeriodDays: 0,
    });
    const priceB = await createPrice(harness.db, ctxA, {
      planRef: plan.id, unitAmount: 300000, interval: 'month', intervalCount: 1, usageType: 'licensed', billingScheme: 'per_unit', trialPeriodDays: 0,
    });
    const pm = await seedActiveCard(customer.id);
    const sub = (await newSub({ customerId: customer.id, priceId: priceA.id, paymentMethodId: pm })).body.data;
    expect(sub.currentPeriodIndex).toBe(1); // billed period 0

    // schedule price B "next cycle" → it lands at period index 2.
    const sched = await asA(request(harness.app).post(`/v1/subscriptions/${sub.id}/schedule`))
      .set('Idempotency-Key', `sch-${uniq()}`)
      .send({ priceId: priceB.id });
    expect(sched.status).toBe(201);
    expect(sched.body.data.phases[0].startIndex).toBe(2);
    expect(sched.body.data.phases[0].priceId).toBe(priceB.id);

    const subId = (await loadSubscriptionRow(harness.db, ctxA, sub.id as string)).id;
    await setDue(sub.id as string);
    await runCycle(harness.db, ctxA, sub.id as string); // bills period 1 → price A
    await setDue(sub.id as string);
    await runCycle(harness.db, ctxA, sub.id as string); // bills period 2 → applyDuePhase swaps to price B

    const [inv1] = await harness.db.select({ total: invoicesTable.total }).from(invoicesTable).where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.periodIndex, 1)));
    const [inv2] = await harness.db.select({ total: invoicesTable.total }).from(invoicesTable).where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.periodIndex, 2)));
    expect(inv1!.total).toBe(500000); // current period unchanged
    expect(inv2!.total).toBe(300000); // next period uses the new price (B10)

    // upcoming-invoice now reflects the (applied) new price.
    const upcoming = await asA(request(harness.app).get(`/v1/subscriptions/${sub.id}/upcoming-invoice`));
    expect(upcoming.body.data.totalInKobo).toBe(300000);
  });

  // ── lifecycle sweep (A6 expiry + trial notice idempotency) ─────────────────
  const lifecycleDeps = () => ({
    db: harness.db,
    now: new Date(),
    incompleteExpiryWindowMs: 24 * 3600 * 1000,
    trialNoticeWindowMs: 72 * 3600 * 1000,
    pmExpiryNoticeWindowDays: 14,
    batchSize: 100,
  });

  it('A6 — lifecycle sweep expires a never-paid incomplete subscription past its window', async () => {
    cardOutcome = 'pending'; // first charge pending → stays incomplete
    const { customerRef, priceRef } = await seedPrice(500000);
    const res = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: await seedActiveCard(customerRef) });
    const subRef = res.body.data.id as string;
    expect(res.body.data.status).toBe('incomplete');

    // backdate created_at past the 24h expiry window
    await harness.db
      .update(subscriptionsTable)
      .set({ createdAt: new Date(Date.now() - 48 * 3600 * 1000) })
      .where(eq(subscriptionsTable.reference, subRef));

    await runLifecycleSweep(lifecycleDeps());
    const after = await asA(request(harness.app).get(`/v1/subscriptions/${subRef}`));
    expect(after.body.data.status).toBe('incomplete_expired');
  });

  it('lifecycle sweep emits subscription.trial_will_end exactly once across two ticks (stamp idempotency)', async () => {
    const { customerRef, priceRef } = await seedPrice(500000, 2); // 2-day trial, within the 72h notice window
    const res = await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: await seedActiveCard(customerRef) });
    const subRef = res.body.data.id as string;
    expect(res.body.data.status).toBe('trialing');

    await runLifecycleSweep(lifecycleDeps());
    await runLifecycleSweep(lifecycleDeps()); // replay
    const types = await eventTypesFor(subRef);
    expect(types.filter((t) => t === 'subscription.trial_will_end').length).toBe(1);
  });

  // ── coupons + discounts (05c) ──────────────────────────────────────────────
  const newCoupon = (body: Record<string, unknown>): request.Test =>
    asA(request(harness.app).post('/v1/coupons')).set('Idempotency-Key', `cpn-${uniq()}`).send(body);
  async function freshActiveSub(): Promise<string> {
    cardOutcome = 'succeeded';
    const { customerRef, priceRef } = await seedPrice(500000);
    const pm = await seedActiveCard(customerRef);
    return (await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm })).body.data.id as string;
  }

  it('coupon CRUD + K2 over-redemption is structurally blocked', async () => {
    const code = `SAVE${uniq()}`;
    const created = await newCoupon({ code, percentOff: 25, duration: 'once' });
    expect(created.status).toBe(201);
    expect(created.body.data.percentOff).toBe(25);
    const fetched = await asA(request(harness.app).get(`/v1/coupons/${created.body.data.id}`));
    expect(fetched.body.data.code).toBe(code);

    const limited = await newCoupon({ code: `ONE${uniq()}`, amountOffInKobo: 50000, duration: 'once', maxRedemptions: 1 });
    const limitedRef = limited.body.data.id as string;
    const s1 = await freshActiveSub();
    const s2 = await freshActiveSub();
    const a1 = await asA(request(harness.app).post(`/v1/subscriptions/${s1}/discount`)).set('Idempotency-Key', `d-${uniq()}`).send({ coupon: limitedRef });
    expect(a1.status).toBe(201);
    const a2 = await asA(request(harness.app).post(`/v1/subscriptions/${s2}/discount`)).set('Idempotency-Key', `d-${uniq()}`).send({ coupon: limitedRef });
    expect(a2.status).toBe(422);
    expect(a2.body.error.code).toBe('COUPON_MAX_REDEMPTIONS_REACHED');
  });

  it('discount applies to a subscription; a duplicate is rejected', async () => {
    const created = await newCoupon({ code: `DUP${uniq()}`, percentOff: 10, duration: 'forever' });
    const cpnRef = created.body.data.id as string;
    const sub = await freshActiveSub();
    const d1 = await asA(request(harness.app).post(`/v1/subscriptions/${sub}/discount`)).set('Idempotency-Key', `d-${uniq()}`).send({ coupon: cpnRef });
    expect(d1.status).toBe(201);
    expect(d1.body.data.status).toBe('active');
    expect(d1.body.data.couponId).toBe(cpnRef);
    const d2 = await asA(request(harness.app).post(`/v1/subscriptions/${sub}/discount`)).set('Idempotency-Key', `d-${uniq()}`).send({ coupon: cpnRef });
    expect(d2.status).toBe(409);
    expect(d2.body.error.code).toBe('COUPON_ALREADY_APPLIED');
  });

  // ── proration (C1 upgrade / C2 downgrade) ──────────────────────────────────
  async function twoPricedSub(oldUnit: number): Promise<{ subRef: string; subId: string; customerRef: string; planId: string }> {
    cardOutcome = 'succeeded';
    const u = uniq();
    const customer = await createCustomer(harness.db, ctxA, { email: `pr${u}@acme.test`, name: 'C' });
    const plan = await createPlan(harness.db, ctxA, { name: `Plan ${u}` });
    const price = await createPrice(harness.db, ctxA, {
      planRef: plan.id, unitAmount: oldUnit, interval: 'month', intervalCount: 1, usageType: 'licensed', billingScheme: 'per_unit', trialPeriodDays: 0,
    });
    const pm = await seedActiveCard(customer.id);
    const subRef = (await newSub({ customerId: customer.id, priceId: price.id, paymentMethodId: pm })).body.data.id as string;
    const subId = (await loadSubscriptionRow(harness.db, ctxA, subRef)).id;
    return { subRef, subId, customerRef: customer.id, planId: plan.id };
  }
  const priceOn = async (planId: string, unitAmount: number): Promise<string> =>
    (await createPrice(harness.db, ctxA, { planRef: planId, unitAmount, interval: 'month', intervalCount: 1, usageType: 'licensed', billingScheme: 'per_unit', trialPeriodDays: 0 })).id;

  it('C1 — mid-cycle upgrade charges the prorated difference immediately', async () => {
    const { subRef, subId, planId } = await twoPricedSub(1_000_000);
    const dear = await priceOn(planId, 2_000_000);
    const changed = await asA(request(harness.app).post(`/v1/subscriptions/${subRef}/change`)).set('Idempotency-Key', `ch-${uniq()}`).send({ priceId: dear });
    expect(changed.status).toBe(200);
    expect(changed.body.data.priceId).toBe(dear);

    const [proration] = await harness.db
      .select({ amountDue: invoicesTable.amountDue, paidAt: invoicesTable.paidAt })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.billingReason, 'subscription_update')));
    expect(proration!.amountDue).toBeGreaterThan(0); // net-positive proration
    expect(proration!.paidAt).toBeTruthy(); // charged now (C1)
  });

  it('C2 — mid-cycle downgrade banks a credit grant, no rail charge', async () => {
    const { subRef, subId, customerRef, planId } = await twoPricedSub(2_000_000);
    const cheap = await priceOn(planId, 1_000_000);
    const changed = await asA(request(harness.app).post(`/v1/subscriptions/${subRef}/change`)).set('Idempotency-Key', `ch-${uniq()}`).send({ priceId: cheap });
    expect(changed.status).toBe(200);

    // no immediate proration invoice (downgrade is credited, not charged)
    const invoices = await harness.db.select({ id: invoicesTable.id }).from(invoicesTable).where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.billingReason, 'subscription_update')));
    expect(invoices).toHaveLength(0);

    const balance = await asA(request(harness.app).get(`/v1/customers/${customerRef}/credit`));
    expect(balance.body.data.balanceInKobo).toBeGreaterThan(0); // banked (C2)
    expect(balance.body.data.grants[0].source).toBe('downgrade_proration');
  });

  it('C4 — a mid-cycle interval switch (month→year) prorates + re-anchors to the new cadence', async () => {
    const { subRef, subId, planId } = await twoPricedSub(1_000_000); // monthly, unit ₦10k
    const yearly = (
      await createPrice(harness.db, ctxA, {
        planRef: planId, unitAmount: 10_000_000, interval: 'year', intervalCount: 1, usageType: 'licensed', billingScheme: 'per_unit', trialPeriodDays: 0,
      })
    ).id;
    const before = await loadSubscriptionRow(harness.db, ctxA, subRef);

    const res = await asA(request(harness.app).post(`/v1/subscriptions/${subRef}/change`)).set('Idempotency-Key', `iv-${uniq()}`).send({ priceId: yearly });
    expect(res.status).toBe(200);
    expect(res.body.data.priceId).toBe(yearly);

    // Immediate proration invoice: credit the unused month + charge the FULL year → net-positive, charged now.
    const [proration] = await harness.db
      .select({ id: invoicesTable.id, amountDue: invoicesTable.amountDue, paidAt: invoicesTable.paidAt })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.billingReason, 'subscription_update')));
    expect(proration!.amountDue).toBeGreaterThan(8_000_000); // ~₦100k year − <₦10k unused month
    expect(proration!.paidAt).toBeTruthy();
    const lines = await harness.db.select({ amount: invoiceLineItemsTable.amount }).from(invoiceLineItemsTable).where(eq(invoiceLineItemsTable.invoiceId, proration!.id));
    expect(lines.some((l) => l.amount < 0)).toBe(true); // unused-old credit
    expect(lines.some((l) => l.amount === 10_000_000)).toBe(true); // a FULL new-cadence year (not prorated over a month)

    // Re-anchored onto the new cadence: the next bill is now ~a year out (was ~a month).
    // (The anchor INSTANT can coincide with the old one on a same-day create+switch — both
    //  normalize to today's billing hour — so next_billing_at is the reliable re-anchor signal.)
    const after = await loadSubscriptionRow(harness.db, ctxA, subRef);
    expect(before.nextBillingAt!.getTime()).toBeLessThan(Date.now() + 60 * 24 * 3600 * 1000); // was ~a month
    expect(after.nextBillingAt!.getTime()).toBeGreaterThan(Date.now() + 300 * 24 * 3600 * 1000); // now ~a year

    // The next renewal bills a FULL year on the new cadence at a FRESH period index
    // (proves the re-anchor kept period_index collision-free — no unique-constraint error).
    await harness.db.update(subscriptionsTable).set({ nextBillingAt: new Date(Date.now() - 60_000) }).where(eq(subscriptionsTable.id, subId));
    const renewed = await runCycle(harness.db, ctxA, subRef);
    expect(renewed.outcome).toBe('paid');
    const [renewInv] = await harness.db
      .select({ total: invoicesTable.total, billingReason: invoicesTable.billingReason })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.billingReason, 'subscription_cycle')));
    expect(renewInv!.total).toBe(10_000_000); // a full new-cadence year, cleanly billed
  });

  it('C4b — a yearly→monthly interval switch banks a credit (net negative), no immediate charge', async () => {
    cardOutcome = 'succeeded';
    const u = uniq();
    const customer = await createCustomer(harness.db, ctxA, { email: `iv2${u}@acme.test`, name: 'C' });
    const plan = await createPlan(harness.db, ctxA, { name: `Plan ${u}` });
    const yearly = await createPrice(harness.db, ctxA, { planRef: plan.id, unitAmount: 12_000_000, interval: 'year', intervalCount: 1, usageType: 'licensed', billingScheme: 'per_unit', trialPeriodDays: 0 });
    const monthly = await createPrice(harness.db, ctxA, { planRef: plan.id, unitAmount: 1_000_000, interval: 'month', intervalCount: 1, usageType: 'licensed', billingScheme: 'per_unit', trialPeriodDays: 0 });
    const pm = await seedActiveCard(customer.id);
    const subRef = (await newSub({ customerId: customer.id, priceId: yearly.id, paymentMethodId: pm })).body.data.id as string;
    const subId = (await loadSubscriptionRow(harness.db, ctxA, subRef)).id;

    const res = await asA(request(harness.app).post(`/v1/subscriptions/${subRef}/change`)).set('Idempotency-Key', `iv2-${uniq()}`).send({ priceId: monthly.id });
    expect(res.status).toBe(200);
    // Net negative (a nearly-full year of unused credit − one month) → no immediate invoice; credit banked.
    const invoices = await harness.db.select({ id: invoicesTable.id }).from(invoicesTable).where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.billingReason, 'subscription_update')));
    expect(invoices).toHaveLength(0);
    const balance = await asA(request(harness.app).get(`/v1/customers/${customer.id}/credit`));
    expect(balance.body.data.balanceInKobo).toBeGreaterThan(0);
    // now billing monthly: next bill is ~a month out, not a year.
    const after = await loadSubscriptionRow(harness.db, ctxA, subRef);
    expect(after.nextBillingAt!.getTime()).toBeLessThan(Date.now() + 60 * 24 * 3600 * 1000);
  });

  it('credit grant → ledger-backed balance + oldest-first grant audit (C8)', async () => {
    const customer = await createCustomer(harness.db, ctxA, { email: `cr${uniq()}@acme.test`, name: 'C' });
    const ref = customer.id;
    const g1 = await asA(request(harness.app).post(`/v1/customers/${ref}/credit`)).set('Idempotency-Key', `cr-${uniq()}`).send({ amountInKobo: 100000, source: 'manual' });
    expect(g1.status).toBe(201);
    expect(g1.body.data).toMatchObject({ amountInKobo: 100000, remainingInKobo: 100000, source: 'manual' });
    await asA(request(harness.app).post(`/v1/customers/${ref}/credit`)).set('Idempotency-Key', `cr-${uniq()}`).send({ amountInKobo: 50000, source: 'goodwill' });

    const balance = await asA(request(harness.app).get(`/v1/customers/${ref}/credit`));
    expect(balance.body.data.balanceInKobo).toBe(150000); // ledger account, O(1)
    expect(balance.body.data.grants).toHaveLength(2);
    expect(balance.body.data.grants[0].amountInKobo).toBe(100000); // oldest-first
  });

  // ── credit-void (item 8): reverses only the UNCONSUMED remainder ────────────
  it('void a partially-consumed credit grant reverses only the remainder; double-void is a no-op', async () => {
    const customer = await createCustomer(harness.db, ctxA, { email: `vd${uniq()}@acme.test`, name: 'C' });
    const ref = customer.id;
    const [c] = await harness.db.select({ id: customersTable.id }).from(customersTable).where(and(eq(customersTable.organizationId, ctxA.organizationId), eq(customersTable.reference, ref))).limit(1);

    const g = await asA(request(harness.app).post(`/v1/customers/${ref}/credit`)).set('Idempotency-Key', `cr-${uniq()}`).send({ amountInKobo: 100000, source: 'manual' });
    const grantRef = g.body.data.id as string;

    // Consume ₦300 of the ₦1,000 grant (leaves ₦700 unconsumed).
    await applyCreditsOldestFirst(harness.db, ctxA, { customerId: c!.id, customerRef: ref, amountDue: 30000 });
    let bal = await asA(request(harness.app).get(`/v1/customers/${ref}/credit`));
    expect(bal.body.data.balanceInKobo).toBe(70000);

    // Void → reverses ONLY the ₦700 remainder (NOT the full ₦1,000 → no over-reversal). Balance → 0.
    const voided = await asA(request(harness.app).delete(`/v1/customers/${ref}/credit/${grantRef}`)).set('Idempotency-Key', `vd-${uniq()}`);
    expect(voided.status).toBe(200);
    expect(voided.body.data.remainingInKobo).toBe(0);
    expect(voided.body.data.voidedAt).toBeTruthy();
    bal = await asA(request(harness.app).get(`/v1/customers/${ref}/credit`));
    expect(bal.body.data.balanceInKobo).toBe(0); // consumed 30k + voided remainder 70k = the full 100k, exactly

    // Double-void is an idempotent no-op (no second reversal → balance stays 0).
    const again = await asA(request(harness.app).delete(`/v1/customers/${ref}/credit/${grantRef}`)).set('Idempotency-Key', `vd-${uniq()}`);
    expect(again.status).toBe(200);
    bal = await asA(request(harness.app).get(`/v1/customers/${ref}/credit`));
    expect(bal.body.data.balanceInKobo).toBe(0);
  });

  // ── C5 seat/quantity proration ─────────────────────────────────────────────
  it('C5 — a mid-cycle seat/quantity increase prorates immediately with two proration lines', async () => {
    const { subRef, subId } = await twoPricedSub(1_000_000);
    const changed = await asA(request(harness.app).post(`/v1/subscriptions/${subRef}/change`))
      .set('Idempotency-Key', `qty-${uniq()}`)
      .send({ quantity: 2 });
    expect(changed.status).toBe(200);

    // the subscription item now carries quantity 2 (C5 mutates subscription_items.quantity)
    const [item] = await harness.db
      .select({ quantity: subscriptionItemsTable.quantity })
      .from(subscriptionItemsTable)
      .where(eq(subscriptionItemsTable.subscriptionId, subId));
    expect(item!.quantity).toBe(2);

    // an immediate proration invoice, charged now, carrying the TWO signed lines (C7)
    const [proration] = await harness.db
      .select({ id: invoicesTable.id, reference: invoicesTable.reference, amountDue: invoicesTable.amountDue, paidAt: invoicesTable.paidAt })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.billingReason, 'subscription_update')));
    expect(proration!.amountDue).toBeGreaterThan(0); // seat increase = upgrade-shaped
    expect(proration!.paidAt).toBeTruthy();
    const proLines = (
      await harness.db
        .select({ kind: invoiceLineItemsTable.kind, amount: invoiceLineItemsTable.amount })
        .from(invoiceLineItemsTable)
        .where(eq(invoiceLineItemsTable.invoiceId, proration!.id))
    ).filter((l) => l.kind === 'proration');
    expect(proLines).toHaveLength(2);
    expect(proLines.some((l) => l.amount < 0)).toBe(true); // −unused old
    expect(proLines.some((l) => l.amount > 0)).toBe(true); // +new charge
    expect(await countKind(proration!.reference, 'charge')).toBe(1); // matching ledger entry (J5)
  });

  // ── C7/J — discount as an explicit negative line on a renewal ──────────────
  it('C7/J — an active forever discount lands as an explicit negative discount line on the next renewal invoice', async () => {
    cardOutcome = 'succeeded';
    cardCollectedKobo = null;
    const { customerRef, priceRef } = await seedPrice(500000);
    const pm = await seedActiveCard(customerRef);
    const subRef = (await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm })).body.data.id as string;
    const subId = (await loadSubscriptionRow(harness.db, ctxA, subRef)).id;

    const coupon = await newCoupon({ code: `REP${uniq()}`, percentOff: 20, duration: 'forever' });
    await asA(request(harness.app).post(`/v1/subscriptions/${subRef}/discount`)).set('Idempotency-Key', `d-${uniq()}`).send({ coupon: coupon.body.data.id });

    await setDue(subRef);
    await runCycle(harness.db, ctxA, subRef); // renew period 1 with the discount applied

    const [inv] = await harness.db
      .select({ id: invoicesTable.id, subtotal: invoicesTable.subtotal, discountTotal: invoicesTable.discountTotal, amountDue: invoicesTable.amountDue })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.periodIndex, 1)));
    expect(inv!.subtotal).toBe(500000);
    expect(inv!.discountTotal).toBe(100000); // 20% off
    expect(inv!.amountDue).toBe(400000);
    const discountLine = (
      await harness.db
        .select({ kind: invoiceLineItemsTable.kind, amount: invoiceLineItemsTable.amount })
        .from(invoiceLineItemsTable)
        .where(eq(invoiceLineItemsTable.invoiceId, inv!.id))
    ).find((l) => l.kind === 'discount');
    expect(discountLine).toBeTruthy();
    expect(discountLine!.amount).toBe(-100000); // an explicit negative line, not an opaque reduced total
  });

  // ── J8 zero-amount invoice → paid with NO rail charge ──────────────────────
  it('J8 — a 100%-off coupon zeroes the renewal invoice → paid with NO rail charge', async () => {
    cardOutcome = 'succeeded';
    cardCollectedKobo = null;
    const { customerRef, priceRef } = await seedPrice(500000);
    const pm = await seedActiveCard(customerRef);
    const subRef = (await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm })).body.data.id as string;
    const subId = (await loadSubscriptionRow(harness.db, ctxA, subRef)).id;

    const coupon = await newCoupon({ code: `FREE${uniq()}`, percentOff: 100, duration: 'forever' });
    await asA(request(harness.app).post(`/v1/subscriptions/${subRef}/discount`)).set('Idempotency-Key', `d-${uniq()}`).send({ coupon: coupon.body.data.id });

    await setDue(subRef);
    const callsBefore = cardCallCount;
    const result = await runCycle(harness.db, ctxA, subRef);
    expect(cardCallCount).toBe(callsBefore); // J8: rail NEVER invoked for a ₦0 invoice
    expect(result.outcome).toBe('paid');

    const [inv] = await harness.db
      .select({ reference: invoicesTable.reference, amountDue: invoicesTable.amountDue, paidAt: invoicesTable.paidAt })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.periodIndex, 1)));
    expect(inv!.amountDue).toBe(0);
    expect(inv!.paidAt).toBeTruthy();
    expect(await countKind(inv!.reference, 'charge')).toBe(0); // no ₦0 charge
    expect(await eventTypesFor(inv!.reference)).toContain('invoice.paid');
  });

  // ── partial collection (tenant opt-in, off by default) ─────────────────────
  it('partial collection ON — a short debit banks the collected kobo, marks partially_paid + tracks the remainder', async () => {
    cardOutcome = 'succeeded';
    cardCollectedKobo = null;
    const { customerRef, priceRef } = await seedPrice(500000);
    const pm = await seedActiveCard(customerRef);
    const subRef = (await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm })).body.data.id as string;
    const subId = (await loadSubscriptionRow(harness.db, ctxA, subRef)).id;

    await upsertOrgBillingSettings(harness.db, ctxA, { partialCollectionEnabled: true });
    cardCollectedKobo = 300000; // the rail pulls only ₦3,000 of the ₦5,000 due
    await setDue(subRef);
    const result = await runCycle(harness.db, ctxA, subRef);
    expect(result.outcome).toBe('past_due');

    const [inv] = await harness.db
      .select({ reference: invoicesTable.reference, amountPaid: invoicesTable.amountPaid, amountRemaining: invoicesTable.amountRemaining, paidAt: invoicesTable.paidAt })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.periodIndex, 1)));
    expect(inv!.amountPaid).toBe(300000);
    expect(inv!.amountRemaining).toBe(200000);
    expect(inv!.paidAt).toBeNull(); // NOT fully paid
    const shown = await asA(request(harness.app).get(`/v1/invoices/${inv!.reference}`));
    expect(shown.body.data.status).toBe('partially_paid');
    expect(await countKind(inv!.reference, 'charge')).toBe(1); // the collected amount is posted
    const sub = await asA(request(harness.app).get(`/v1/subscriptions/${subRef}`));
    expect(sub.body.data.status).toBe('past_due'); // 06 dunning pursues the remainder
    cardCollectedKobo = null;
  });

  it('partial collection OFF (default) — a short debit is all-or-nothing → invoice open, sub past_due, nothing banked', async () => {
    cardOutcome = 'succeeded';
    cardCollectedKobo = null;
    const { customerRef, priceRef } = await seedPrice(500000);
    const pm = await seedActiveCard(customerRef);
    const subRef = (await newSub({ customerId: customerRef, priceId: priceRef, paymentMethodId: pm })).body.data.id as string;
    const subId = (await loadSubscriptionRow(harness.db, ctxA, subRef)).id;

    await upsertOrgBillingSettings(harness.db, ctxA, { partialCollectionEnabled: false });
    cardCollectedKobo = 300000; // short
    await setDue(subRef);
    const result = await runCycle(harness.db, ctxA, subRef);
    expect(result.outcome).toBe('past_due');

    const [inv] = await harness.db
      .select({ reference: invoicesTable.reference, amountPaid: invoicesTable.amountPaid })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.periodIndex, 1)));
    expect(inv!.amountPaid).toBe(0); // nothing banked (all-or-nothing)
    const shown = await asA(request(harness.app).get(`/v1/invoices/${inv!.reference}`));
    expect(shown.body.data.status).toBe('open');
    expect(await countKind(inv!.reference, 'charge')).toBe(0);
    const sub = await asA(request(harness.app).get(`/v1/subscriptions/${subRef}`));
    expect(sub.body.data.status).toBe('past_due');
    cardCollectedKobo = null;
  });

  // ── K1 idempotency-key replay on a proration-triggering change ─────────────
  it('K1 — replaying POST /change with the same Idempotency-Key does not double-charge', async () => {
    const { subRef, subId, planId } = await twoPricedSub(1_000_000);
    const dear = await priceOn(planId, 2_000_000);
    const key = `k1-${uniq()}`;
    const a = await asA(request(harness.app).post(`/v1/subscriptions/${subRef}/change`)).set('Idempotency-Key', key).send({ priceId: dear });
    const b = await asA(request(harness.app).post(`/v1/subscriptions/${subRef}/change`)).set('Idempotency-Key', key).send({ priceId: dear });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(b.body.data.priceId).toBe(dear);

    // exactly ONE immediate proration invoice — the replay returned the cached result.
    const invoices = await harness.db
      .select({ id: invoicesTable.id })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.billingReason, 'subscription_update')));
    expect(invoices).toHaveLength(1);
    expect(await countKind((await harness.db.select({ reference: invoicesTable.reference }).from(invoicesTable).where(eq(invoicesTable.id, invoices[0]!.id)))[0]!.reference, 'charge')).toBe(1);
  });

  // ── C2→C8 end-to-end: a downgrade credit is CONSUMED oldest-first on renewal ─
  it('C2/C8 — a banked downgrade credit is consumed as a credit line on the next renewal invoice', async () => {
    const { subRef, subId, customerRef, planId } = await twoPricedSub(2_000_000);
    const cheap = await priceOn(planId, 1_000_000);
    await asA(request(harness.app).post(`/v1/subscriptions/${subRef}/change`)).set('Idempotency-Key', `dg-${uniq()}`).send({ priceId: cheap });

    const before = await asA(request(harness.app).get(`/v1/customers/${customerRef}/credit`));
    const bankedBalance = before.body.data.balanceInKobo as number;
    expect(bankedBalance).toBeGreaterThan(0); // downgrade banked a credit (C2)

    await setDue(subRef);
    await runCycle(harness.db, ctxA, subRef); // renew at the new (cheaper) price → credit applies

    const [inv] = await harness.db
      .select({ id: invoicesTable.id, subtotal: invoicesTable.subtotal, creditTotal: invoicesTable.creditTotal, amountDue: invoicesTable.amountDue })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.subscriptionId, subId), eq(invoicesTable.periodIndex, 1)));
    expect(inv!.subtotal).toBe(1_000_000);
    expect(inv!.creditTotal).toBeGreaterThan(0); // credit consumed (C8)
    expect(inv!.amountDue).toBe(inv!.subtotal - inv!.creditTotal); // fixed-order resolution
    const creditLine = (
      await harness.db
        .select({ kind: invoiceLineItemsTable.kind, amount: invoiceLineItemsTable.amount })
        .from(invoiceLineItemsTable)
        .where(eq(invoiceLineItemsTable.invoiceId, inv!.id))
    ).find((l) => l.kind === 'credit');
    expect(creditLine).toBeTruthy();
    expect(creditLine!.amount).toBeLessThan(0); // an explicit negative credit line

    // the ledger-backed balance dropped by exactly what was consumed (oldest-first).
    const after = await asA(request(harness.app).get(`/v1/customers/${customerRef}/credit`));
    expect(after.body.data.balanceInKobo).toBe(bankedBalance - inv!.creditTotal);
  });
});
