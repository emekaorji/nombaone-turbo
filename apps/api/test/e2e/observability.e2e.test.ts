import { Writable } from 'node:stream';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { transports } from 'winston';

import { customersTable, paymentMethodsTable } from '@nombaone/core-db/schema';
import { createCustomer } from '@/domain/customers';
import { createPlan } from '@/domain/plans';
import { createPrice } from '@/domain/prices';
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
  let ctx: { organizationId: string; mode: 'sandbox' };

  const scopes = ['customers:read', 'customers:write', 'subscriptions:read', 'subscriptions:write', 'metrics:read'];

  beforeAll(async () => {
    harness = await startHarness();
    harness.setNombaClient(fakeNomba);
    registerRail({ key: 'card', direction: 'pull', collect: async () => ({ status: 'succeeded' }) });
    const org = await harness.seedOrg('Obs');
    bearer = (await harness.mintApiKey(org.organizationId, 'sandbox', scopes)).secret;
    ctx = { organizationId: org.organizationId, mode: 'sandbox' };
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
      reference: pmRef, organizationId: ctx.organizationId, mode: 'sandbox', customerId: c!.id,
      kind: 'card', status: 'active', tokenKey: 'tok', brand: 'visa', last4: '4242', isDefault: true,
    });
    const res = await auth(request(harness.app).post('/v1/subscriptions')).set('Idempotency-Key', `s-${uniq()}`)
      .send({ customerId: customer.id, priceId: price.id, paymentMethodId: pmRef });
    return res.body.data.id as string;
  }

  // ── M liveness probe (readiness lives in the admin/ops surface, not the public API) ──
  it('M — GET /v1/health is a cheap, unauthenticated liveness probe', async () => {
    const health = await request(harness.app).get('/v1/health');
    expect(health.status).toBe(200);
    expect(health.body.data.status).toBe('ok');
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
    expect(m.body.data.mrrInKobo).toBe(800000); // 500000 + 300000 monthly
    expect(m.body.data.activeCount).toBeGreaterThanOrEqual(2);
    expect(m.body.data.dunningFunnel).toBeTruthy();
    expect(typeof m.body.data.failedChargeRate).toBe('number');
    expect(m.body.data.windowFrom).toBeTruthy();
  });

  // ── L ⚠ OpenAPI conformance ───────────────────────────────────────────────────
  it('L ⚠ — GET /v1/openapi.json serves a valid spec matching mounted behavior', async () => {
    const spec = await request(harness.app).get('/v1/openapi.json'); // public
    expect(spec.status).toBe(200);
    const doc = spec.body;
    expect(doc.openapi).toMatch(/^3\./);
    // auth scheme documented
    expect(doc.components.securitySchemes.ApiKeyAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
    // the ApiError envelope + PUBLIC_ERROR_CODES enum are declared
    expect(doc.components.schemas.ApiError.properties.error.properties.code.enum).toContain('SUBSCRIPTION_NOT_FOUND');
    // paths were WALKED from the real router (no drift) — a known mounted path is present
    expect(Object.keys(doc.paths)).toContain('/v1/subscriptions/{id}');
    expect(Object.keys(doc.paths)).toContain('/v1/settlements');
    // a mutating op documents the Idempotency-Key header
    const createSub = doc.paths['/v1/subscriptions']?.post;
    expect(createSub.parameters.some((p: { name: string }) => p.name === 'Idempotency-Key')).toBe(true);

    // a REAL error response matches the documented ApiError envelope + a public code.
    const err = await auth(request(harness.app).get('/v1/subscriptions/nbo000000000000sub'));
    expect(err.status).toBe(404);
    expect(err.body.error.code).toBe('SUBSCRIPTION_NOT_FOUND');
    expect(doc.components.schemas.ApiError.properties.error.properties.code.enum).toContain(err.body.error.code);
  });

  // ── L ⚠ request + response bodies (item 1) ──────────────────────────────────────
  it('L ⚠ — the spec advertises the EXACT enforced request body + typed response data', async () => {
    const doc = (await request(harness.app).get('/v1/openapi.json')).body;

    // (a) request body = the exact validated schema (drift-proof): POST /v1/customers.
    const createBody = doc.paths['/v1/customers'].post.requestBody.content['application/json'].schema;
    expect(createBody.required).toEqual(expect.arrayContaining(['email', 'name']));
    expect(createBody.properties.email).toMatchObject({ type: 'string', format: 'email' });
    expect(createBody.properties.name).toMatchObject({ type: 'string', maxLength: 255 });

    // (b) query params are advertised: GET /v1/customers has `email`, `limit`, `cursor`.
    const listParams = doc.paths['/v1/customers'].get.parameters.map((p: { name: string }) => p.name);
    expect(listParams).toEqual(expect.arrayContaining(['email', 'limit', 'cursor']));

    // (c) a single-resource response `data` $refs the typed schema; the schema is present.
    const getData = doc.paths['/v1/customers/{id}'].get.responses['200'].content['application/json']
      .schema.properties.data;
    expect(getData.$ref).toBe('#/components/schemas/Customer');
    expect(Object.keys(doc.components.schemas.Customer.properties)).toEqual(
      expect.arrayContaining(['id', 'email', 'name', 'phone', 'metadata', 'mode', 'createdAt'])
    );

    // (d) a LIST response `data` is a typed array of the resource.
    const listData = doc.paths['/v1/customers'].get.responses['200'].content['application/json']
      .schema.properties.data;
    expect(listData).toMatchObject({ type: 'array', items: { $ref: '#/components/schemas/Customer' } });

    // (e) round-trip: a LIVE create response's data conforms to the advertised Customer schema.
    const created = await auth(request(harness.app).post('/v1/customers'))
      .set('Idempotency-Key', `oa-${uniq()}`)
      .send({ email: `oa${uniq()}@acme.test`, name: 'OA' });
    expect(created.status).toBe(201);
    const advertised = new Set(Object.keys(doc.components.schemas.Customer.properties));
    for (const key of Object.keys(created.body.data)) {
      expect(advertised.has(key)).toBe(true); // no undocumented field on the wire
    }
    // every REQUIRED advertised field is present on the live payload.
    for (const key of doc.components.schemas.Customer.required) {
      expect(created.body.data).toHaveProperty(key);
    }
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

  // ── item 5: correlation logging + Prometheus ────────────────────────────────────
  //
  // These use the SAME singleton logger / ALS store / metrics registry the running
  // app wires, so they prove the real mechanism (not a stand-in). The modules are
  // imported dynamically so they bind to the harness's env-configured redis.

  /** Capture every JSON log line the app logger emits while `fn` runs. */
  async function captureLogs(fn: () => Promise<void> | void): Promise<Record<string, unknown>[]> {
    const { logger } = await import('../../src/shared/observability/logger');
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _enc, cb) {
        chunk
          .toString()
          .split('\n')
          .forEach((l) => l.trim() && lines.push(l.trim()));
        cb();
      },
    });
    const capture = new transports.Stream({ stream: sink });
    logger.add(capture);
    try {
      await fn();
      await new Promise((r) => setTimeout(r, 25)); // let transports flush
    } finally {
      logger.remove(capture);
    }
    return lines
      .map((l) => {
        try {
          return JSON.parse(l) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((v): v is Record<string, unknown> => v !== null);
  }

  const metricsText = async (): Promise<string> => {
    const res = await request(harness.app).get('/metrics');
    expect(res.status).toBe(200);
    return res.text;
  };

  /** Value of `metric{label="value"}` from a Prometheus text payload, or null. */
  const labeled = (text: string, metric: string, label: string, value: string): number | null => {
    const re = new RegExp(`^${metric}\\{[^}]*${label}="${value}"[^}]*\\}\\s+([0-9.eE+-]+)`, 'm');
    const m = text.match(re);
    return m ? Number(m[1]) : null;
  };

  it('item5 — logger mixes the ambient correlation fields onto every line (HTTP + job shape)', async () => {
    // (a) an authenticated request that 4xx's logs a warn line INSIDE the request
    //     context — it carries the request id as correlationId + the resolved tenant.
    let requestIdHeader = '';
    const httpLines = await captureLogs(async () => {
      const res = await auth(request(harness.app).get('/v1/subscriptions/nbo000000000000mis'));
      expect(res.status).toBe(404);
      requestIdHeader = res.headers['x-request-id'] ?? '';
    });
    const httpLine = httpLines.find((l) => l.correlationId === requestIdHeader);
    expect(httpLine).toBeTruthy();
    expect(httpLine).toMatchObject({
      correlationId: requestIdHeader,
      organizationId: ctx.organizationId,
      mode: 'sandbox',
    });

    // (b) the job path uses the same runWithCorrelation + logger; a line logged in a
    //     job context carries correlationId + task (+ tenant, when the job has one).
    const { runWithCorrelation } = await import('../../src/shared/observability/correlation');
    const jobLines = await captureLogs(async () => {
      await runWithCorrelation(
        { correlationId: 'job_abc', task: 'billing', organizationId: ctx.organizationId, mode: 'sandbox' },
        async () => {
          await Promise.resolve(); // correlation must survive an await
          const { logger } = await import('../../src/shared/observability/logger');
          logger.info('[worker] test job line', { detail: 1 });
        }
      );
    });
    const jobLine = jobLines.find((l) => l.correlationId === 'job_abc');
    expect(jobLine).toMatchObject({ correlationId: 'job_abc', task: 'billing', organizationId: ctx.organizationId, detail: 1 });

    // (c) a line logged outside any context leaks no correlation fields.
    const orphan = (await captureLogs(async () => {
      const { logger } = await import('../../src/shared/observability/logger');
      logger.info('[test] no-context line');
    })).find((l) => l.message === '[test] no-context line');
    expect(orphan).toBeTruthy();
    expect(orphan?.correlationId).toBeUndefined();
  });

  it('item5 — GET /metrics serves a Prometheus payload with the default + product metrics', async () => {
    // drive one request so the histogram has a sample
    await request(harness.app).get('/v1/health');
    const text = await metricsText();
    // default process/node metrics
    expect(text).toMatch(/nodejs_eventloop|process_cpu_seconds_total/);
    // our three product signals are declared
    expect(text).toContain('http_request_duration_seconds');
    expect(text).toContain('nombaone_charge_failures_total');
    expect(text).toContain('nombaone_scheduler_lag_seconds');
    // the request histogram actually observed traffic
    expect(text).toMatch(/http_request_duration_seconds_count\{[^}]+\}\s+[1-9]/);
  });

  it('item5 — recordChargeFailure increments the charge-failure counter', async () => {
    const { recordChargeFailure } = await import('../../src/shared/observability/prometheus');
    const before = labeled(await metricsText(), 'nombaone_charge_failures_total', 'reason', 'past_due') ?? 0;
    recordChargeFailure('past_due');
    const after = labeled(await metricsText(), 'nombaone_charge_failures_total', 'reason', 'past_due') ?? 0;
    expect(after).toBe(before + 1);
  });

  it('item5 — scheduler-lag gauge rises when a sweep goes stale and resets when it completes', async () => {
    const { redis } = await import('../../src/shared/config/redis');
    const { markSweepCompleted } = await import('../../src/shared/observability/prometheus');

    // simulate: billing-sweep last completed 60s ago, none since → lag ≈ 60s
    await redis.set('scheduler:last_sweep:billing-sweep', String(Date.now() - 60_000));
    const stale = labeled(await metricsText(), 'nombaone_scheduler_lag_seconds', 'sweep', 'billing-sweep');
    expect(stale).not.toBeNull();
    expect(stale!).toBeGreaterThan(50);

    // a fresh completion resets the lag toward 0
    await markSweepCompleted('billing-sweep');
    const fresh = labeled(await metricsText(), 'nombaone_scheduler_lag_seconds', 'sweep', 'billing-sweep');
    expect(fresh!).toBeLessThan(5);
  });
});
