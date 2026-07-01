import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { customersTable, paymentMethodsTable, subscriptionsTable } from '@nombaone/core-db/schema';
import { createCustomer } from '@nombaone/sara/customers';
import { createPlan } from '@nombaone/sara/plans';
import { createPrice } from '@nombaone/sara/prices';
import { registerRail } from '@nombaone/sara/rails';
import { mintReference } from '@nombaone/sara/reference';

import { startHarness, type Harness } from '../helpers/harness';

import type { NombaClient } from '@nombaone/sara/nomba';

const fakeNomba: NombaClient = {
  getToken: async () => 'tok',
  async request<T = unknown>() { return { status: 200, ok: true, data: {} as T }; },
  requeryTransaction: async () => ({ found: true, succeeded: true, amount: 0 }),
};

describe('observability + docs e2e (L/M)', () => {
  let harness: Harness;
  let bearer: string;
  let ctx: { organizationId: string; environment: 'test' };

  const scopes = ['customers:read', 'customers:write', 'subscriptions:read', 'subscriptions:write', 'metrics:read'];

  beforeAll(async () => {
    harness = await startHarness();
    harness.setNombaClient(fakeNomba);
    registerRail({ key: 'card', direction: 'pull', collect: async () => ({ status: 'succeeded' }) });
    const org = await harness.seedOrg('Obs');
    bearer = (await harness.mintApiKey(org.organizationId, 'test', scopes)).secret;
    ctx = { organizationId: org.organizationId, environment: 'test' };
  });

  afterAll(async () => { await harness?.stop(); });

  const auth = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearer}`);
  let seq = 0;
  const uniq = (): string => `${Date.now()}-${seq++}`;

  async function seedSub(unit = 500000): Promise<string> {
    const u = uniq();
    const customer = await createCustomer(harness.db, ctx, { email: `o${u}@acme.test`, name: 'C' });
    const plan = await createPlan(harness.db, ctx, { name: `Plan ${u}` });
    const price = await createPrice(harness.db, ctx, {
      planRef: plan.id, unitAmount: unit, interval: 'month', intervalCount: 1, usageType: 'licensed', billingScheme: 'per_unit', trialPeriodDays: 0,
    });
    const [c] = await harness.db.select({ id: customersTable.id }).from(customersTable)
      .where(and(eq(customersTable.organizationId, ctx.organizationId), eq(customersTable.reference, customer.id))).limit(1);
    const pmRef = mintReference('PMT');
    await harness.db.insert(paymentMethodsTable).values({
      reference: pmRef, organizationId: ctx.organizationId, environment: 'test', customerId: c!.id,
      kind: 'card', status: 'active', tokenKey: 'tok', brand: 'visa', last4: '4242', isDefault: true,
    });
    const res = await auth(request(harness.app).post('/v1/subscriptions')).set('Idempotency-Key', `s-${uniq()}`)
      .send({ customerId: customer.id, priceId: price.id, paymentMethodId: pmRef });
    return res.body.data.id as string;
  }

  // ── M readiness probe ────────────────────────────────────────────────────────
  it('M — GET /v1/ready deep-checks DB + Redis and returns the per-dependency map', async () => {
    const ready = await request(harness.app).get('/v1/ready'); // unauthenticated
    expect(ready.status).toBe(200);
    expect(ready.body.data.ready).toBe(true);
    expect(ready.body.data.dependencies).toMatchObject({ db: 'ok', redis: 'ok' });
    const health = await request(harness.app).get('/v1/health');
    expect(health.status).toBe(200); // liveness still cheap
  });

  // ── L public event catalog ────────────────────────────────────────────────────
  it('L — GET /v1/events/catalog publishes the machine-readable webhook catalog (public)', async () => {
    const cat = await request(harness.app).get('/v1/events/catalog'); // no auth
    expect(cat.status).toBe(200);
    expect(cat.body.data['invoice.paid']).toBeTruthy();
    expect(cat.body.data['invoice.paid'].payload).toContain('reference');
    expect(cat.body.data['subscription.churned']).toBeTruthy();
  });

  // ── M ★ business metrics ──────────────────────────────────────────────────────
  it('M ★ — GET /v1/metrics/billing returns MRR + active count + funnel, derived from state', async () => {
    await seedSub(500000);
    await seedSub(300000);
    const noScope = await request(harness.app).get('/v1/metrics/billing'); // no key → 401
    expect(noScope.status).toBe(401);

    const m = await auth(request(harness.app).get('/v1/metrics/billing'));
    expect(m.status).toBe(200);
    expect(m.body.data.mrrKobo).toBe(800000); // 500000 + 300000 monthly
    expect(m.body.data.activeCount).toBeGreaterThanOrEqual(2);
    expect(m.body.data.dunningFunnel).toBeTruthy();
    expect(typeof m.body.data.failedChargeRate).toBe('number');
    expect(m.body.data.windowFrom).toBeTruthy();
  });

  // ── M per-subscription audit trail ─────────────────────────────────────────────
  it('M — GET /v1/subscriptions/:ref/events replays the subscription audit trail', async () => {
    const subRef = await seedSub(500000);
    const events = await auth(request(harness.app).get(`/v1/subscriptions/${subRef}/events`));
    expect(events.status).toBe(200);
    const types = events.body.data.map((e: { type: string }) => e.type);
    expect(types).toContain('subscription.created');
    // events are ordered oldest-first and carry the EVT reference
    expect(events.body.data[0].id).toMatch(/evt$/);
  });
});
