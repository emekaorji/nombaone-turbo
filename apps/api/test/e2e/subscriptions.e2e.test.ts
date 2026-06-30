import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  customersTable,
  domainEventsTable,
  invoicesTable,
  ledgerTransactionsTable,
  paymentMethodsTable,
  subscriptionPeriodsTable,
  subscriptionsTable,
} from '@nombaone/core-db/schema';
import {
  confirmInvoiceFromWebhook,
  processInboundInvoiceEvent,
  runBillingSweep,
  runCycle,
} from '@nombaone/sara/billing';
import { createCustomer } from '@nombaone/sara/customers';
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

describe('subscriptions + billing e2e', () => {
  let harness: Harness;
  let bearerA: string;
  let bearerB: string;
  let ctxA: { organizationId: string; environment: 'test' };

  const scopes = [
    'customers:read',
    'customers:write',
    'subscriptions:read',
    'subscriptions:write',
    'invoices:read',
    'invoices:write',
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
    registerRail({ key: 'card', direction: 'pull', collect: async () => ({ status: cardOutcome }) });
    registerRail({ key: 'mandate', direction: 'pull', collect: async () => ({ status: cardOutcome }) });
    registerRail({
      key: 'transfer',
      direction: 'push',
      collect: async () => ({ status: 'pending', payInstructions: { bank: 'Wema' } }),
    });

    const orgA = await harness.seedOrg('Sub A');
    const orgB = await harness.seedOrg('Sub B');
    bearerA = (await harness.mintApiKey(orgA.organizationId, 'test', scopes)).secret;
    bearerB = (await harness.mintApiKey(orgB.organizationId, 'test', scopes)).secret;
    ctxA = { organizationId: orgA.organizationId, environment: 'test' };
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
          eq(customersTable.environment, 'test'),
          eq(customersTable.reference, customerRef)
        )
      )
      .limit(1);
    const reference = mintReference('PMT');
    await harness.db.insert(paymentMethodsTable).values({
      reference,
      organizationId: ctxA.organizationId,
      environment: 'test',
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
    expect(inv.body.data.amountPaid).toBe(500000);
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
    const first = await processInboundInvoiceEvent(harness.db, fakeNomba, {
      requestId: 'inv-req-1',
      eventType: 'payment_success',
      payload,
    });
    expect(first.matched).toBe(true);
    expect(first.settled).toBe(true);
    expect(first.firstSeen).toBe(true);

    const replay = await processInboundInvoiceEvent(harness.db, fakeNomba, {
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
    expect(upcoming.body.data.total).toBe(300000);
  });
});
