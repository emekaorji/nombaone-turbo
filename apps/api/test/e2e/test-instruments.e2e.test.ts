import http from 'node:http';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createCustomer } from '@/domain/customers';
import { createPlan } from '@/domain/plans';
import { createPrice } from '@/domain/prices';
import { registerRail } from '@nombaone/sara/rails';

import { startHarness, type Harness } from '../helpers/harness';

import type { NombaClient } from '@nombaone/sara/nomba';
import type { AddressInfo } from 'node:net';

/**
 * Test-mode simulation instruments e2e. Real Postgres + Redis. NO fake `card`
 * rail is registered for charging — instead a THROWING card rail proves the
 * rail simulator (`maybeSimulateTestCollect`) short-circuits BEFORE any real rail
 * for a seeded test method. A real local HTTP receiver proves the webhook
 * simulate delivers through the genuine signed path.
 */
describe('test-mode simulation instruments e2e', () => {
  let harness: Harness;
  let bearer: string;
  let ctx: { organizationId: string; mode: 'sandbox' };
  let receiver: http.Server;
  let receiverUrl: string;
  const received: Array<{ body: unknown }> = [];

  const scopes = [
    'customers:read',
    'customers:write',
    'plans:write',
    'prices:write',
    'subscriptions:read',
    'subscriptions:write',
    'invoices:read',
    'payment_methods:read',
    'payment_methods:write',
    'webhooks:read',
    'webhooks:write',
  ];

  const fakeNomba: NombaClient = {
    getToken: async () => 'tok',
    async request<T = unknown>() {
      return { status: 200, ok: true, data: {} as T };
    },
    requeryTransaction: async () => ({ found: true, succeeded: true, amount: 0 }),
  };

  beforeAll(async () => {
    harness = await startHarness();
    harness.setNombaClient(fakeNomba);
    // A test method must never reach the real rail — throw if it does.
    registerRail({
      key: 'card',
      direction: 'pull',
      collect: async () => {
        throw new Error('the real card rail must not run for a test payment method');
      },
    });

    receiver = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        received.push({ body: raw ? JSON.parse(raw) : null });
        res.writeHead(200).end('ok');
      });
    });
    await new Promise<void>((resolve) => receiver.listen(0, '127.0.0.1', resolve));
    receiverUrl = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}/hook`;

    const org = await harness.seedOrg('Test Instruments');
    bearer = (await harness.mintApiKey(org.organizationId, 'sandbox', scopes)).secret;
    ctx = { organizationId: org.organizationId, mode: 'sandbox' };
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => receiver.close(() => resolve()));
    await harness?.stop();
  });

  const as = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearer}`);
  let seq = 0;
  const uniq = (): string => `${Date.now()}-${seq++}`;

  async function seedPrice(unitAmount: number): Promise<{ customerRef: string; priceRef: string }> {
    const u = uniq();
    const customer = await createCustomer(harness.db, ctx, { email: `c${u}@acme.test`, name: 'C' });
    const plan = await createPlan(harness.db, ctx, { name: `Plan ${u}` });
    const price = await createPrice(harness.db, ctx, {
      planRef: plan.id,
      unitAmount,
      interval: 'month',
      intervalCount: 1,
      usageType: 'licensed',
      billingScheme: 'per_unit',
      trialPeriodDays: 0,
    });
    return { customerRef: customer.id, priceRef: price.id };
  }

  const createTestPM = (customerId: string, behavior: string): request.Test =>
    as(request(harness.app).post('/v1/sandbox/payment-methods'))
      .set('Idempotency-Key', `pm-${uniq()}`)
      .send({ customerId, behavior });

  const newSub = (body: Record<string, unknown>): request.Test =>
    as(request(harness.app).post('/v1/subscriptions'))
      .set('Idempotency-Key', `s-${uniq()}`)
      .send(body);

  const advance = (subId: string): request.Test =>
    as(request(harness.app).post(`/v1/sandbox/subscriptions/${subId}/advance-cycle`))
      .set('Idempotency-Key', `adv-${uniq()}`)
      .send({});

  it('success method → subscription active + first invoice paid; advance-cycle bills the next period', async () => {
    const { customerRef, priceRef } = await seedPrice(500_000);

    const pm = await createTestPM(customerRef, 'success');
    expect(pm.status).toBe(201);
    expect(pm.body.data.domain).toBe('payment_method');
    expect(pm.body.data.status).toBe('active');

    const sub = await newSub({
      customerId: customerRef,
      priceId: priceRef,
      paymentMethodId: pm.body.data.id,
    });
    expect(sub.status).toBe(201);
    // The deterministic success rail settles the first invoice synchronously.
    expect(sub.body.data.status).toBe('active');

    const adv = await advance(sub.body.data.id);
    expect(adv.status).toBe(201);
    expect(adv.body.data.domain).toBe('advance_cycle_result');
    expect(adv.body.data.outcome).toBe('paid');
    expect(adv.body.data.invoice.domain).toBe('invoice');
    expect(adv.body.data.invoice.status).toBe('paid');
    expect(adv.body.data.invoice.amountPaidInKobo).toBe(500_000);
  });

  it('decline method → the first charge fails, the subscription is not active', async () => {
    const { customerRef, priceRef } = await seedPrice(300_000);
    const pm = await createTestPM(customerRef, 'decline_insufficient_funds');
    const sub = await newSub({
      customerId: customerRef,
      priceId: priceRef,
      paymentMethodId: pm.body.data.id,
    });
    expect(sub.status).toBe(201);
    expect(sub.body.data.status).not.toBe('active');
  });

  it('advance-cycle on a non-active subscription → 422; unknown subscription → 404', async () => {
    const { customerRef, priceRef } = await seedPrice(200_000);
    const pm = await createTestPM(customerRef, 'success');
    const sub = await newSub({
      customerId: customerRef,
      priceId: priceRef,
      paymentMethodId: pm.body.data.id,
    });
    await as(request(harness.app).post(`/v1/subscriptions/${sub.body.data.id}/cancel`))
      .set('Idempotency-Key', `cancel-${uniq()}`)
      .send({ mode: 'now' });

    const nonActive = await advance(sub.body.data.id);
    expect(nonActive.status).toBe(422);
    expect(nonActive.body.error.code).toBe('SUBSCRIPTION_ILLEGAL_TRANSITION');

    const missing = await advance('nbo000000000000sub');
    expect(missing.status).toBe(404);
  });

  it('webhook simulate → emits a real catalog event and delivers it (signed) to a subscribed endpoint', async () => {
    const wh = await as(request(harness.app).post('/v1/webhooks'))
      .set('Idempotency-Key', `wh-${uniq()}`)
      .send({ url: receiverUrl, enabledEvents: ['*'] });
    expect(wh.status).toBe(201);

    const before = received.length;
    const sim = await as(request(harness.app).post('/v1/sandbox/webhooks/simulate'))
      .set('Idempotency-Key', `sim-${uniq()}`)
      .send({ type: 'customer.created' });

    expect(sim.status).toBe(201);
    expect(sim.body.data.domain).toBe('webhook_simulation');
    expect(sim.body.data.type).toBe('customer.created');
    expect(typeof sim.body.data.event).toBe('string');
    expect(sim.body.data.deliveredCount).toBeGreaterThanOrEqual(1);
    // The real signed POST actually reached the local receiver.
    expect(received.length).toBeGreaterThan(before);
  });

  it('webhook simulate with an uncatalogued event type → 400', async () => {
    const sim = await as(request(harness.app).post('/v1/sandbox/webhooks/simulate'))
      .set('Idempotency-Key', `sim-${uniq()}`)
      .send({ type: 'not.a.real.event' });
    expect(sim.status).toBe(400);
  });
});
